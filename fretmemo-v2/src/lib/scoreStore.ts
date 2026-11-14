/**
 * IndexedDB persistence for imported Guitar Pro files.
 *
 * Score binaries are far too large for localStorage (JSON-only, ~5 MB quota),
 * so they live in a dedicated database. The wrapper is intentionally thin:
 * promise-based CRUD plus defensive validation on read, so a corrupted or
 * partially-written record cannot crash the Library page.
 */
import type { GuitarProFormat, ScoreRecord, ScoreSummary } from "@/types/scores";
import type { SongProgress } from "@/lib/songProgress";

const DB_NAME = "fretmemo-scores-v1";
const DB_VERSION = 3;
const STORE = "files";
const TRACK_CONFIGS_STORE = "trackConfigs";
const SONG_PROGRESS_STORE = "songProgress";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains(TRACK_CONFIGS_STORE)) {
                    db.createObjectStore(TRACK_CONFIGS_STORE, { keyPath: "scoreId" });
                }
                if (!db.objectStoreNames.contains(SONG_PROGRESS_STORE)) {
                    db.createObjectStore(SONG_PROGRESS_STORE, { keyPath: "hash" });
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                // Free the connection when another tab upgrades the schema so
                // future migrations are not blocked; the next call reopens.
                db.onversionchange = () => {
                    db.close();
                    dbPromise = null;
                };
                resolve(db);
            };
            request.onerror = () => {
                // Never cache a failed open: the next call retries.
                dbPromise = null;
                reject(request.error ?? new Error("Failed to open IndexedDB"));
            };
        });
    }
    return dbPromise;
}

function isGuitarProFormat(value: unknown): value is GuitarProFormat {
    return value === "gp3" || value === "gp4" || value === "gp5" || value === "gp";
}

/** Narrows an unknown record into a `ScoreSummary`, or `null` when malformed. */
function toSummary(record: unknown): ScoreSummary | null {
    if (typeof record !== "object" || record === null) {
        return null;
    }
    const r = record as Record<string, unknown>;
    if (
        typeof r.id !== "string" ||
        typeof r.name !== "string" ||
        typeof r.addedAt !== "number" ||
        typeof r.sizeBytes !== "number" ||
        !isGuitarProFormat(r.format)
    ) {
        return null;
    }
    return {
        id: r.id,
        name: r.name,
        addedAt: r.addedAt,
        sizeBytes: r.sizeBytes,
        format: r.format,
        title: typeof r.title === "string" && r.title.length > 0 ? r.title : r.name,
        trackCount: typeof r.trackCount === "number" ? r.trackCount : 0,
        tempoBpm: typeof r.tempoBpm === "number" ? r.tempoBpm : null,
    };
}

/**
 * Runs an operation against the track-configs store and settles when the
 * surrounding transaction commits (so writes are durable on resolve).
 */
export async function withTrackConfigsStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
    const db = await openDb();
    const tx = db.transaction(TRACK_CONFIGS_STORE, mode);
    const store = tx.objectStore(TRACK_CONFIGS_STORE);
    const result = await run(store);
    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
    return result;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
    });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
            reject(transaction.error ?? new Error("IndexedDB transaction failed"));
        transaction.onabort = () =>
            reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    });
}

export async function putScoreFile(record: ScoreRecord): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    await transactionDone(tx);
}

/** Newest imports first. Malformed records are skipped, not thrown. */
export async function listScoreMeta(): Promise<ScoreSummary[]> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const records = await requestToPromise(tx.objectStore(STORE).getAll());
    return records
        .map(toSummary)
        .filter((summary): summary is ScoreSummary => summary !== null)
        .sort((a, b) => b.addedAt - a.addedAt);
}

export async function getScoreBytes(id: string): Promise<ArrayBuffer | null> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const record = await requestToPromise(
        tx.objectStore(STORE).get(id) as IDBRequest<unknown>,
    );
    if (typeof record !== "object" || record === null) {
        return null;
    }
    const bytes = (record as { bytes?: unknown }).bytes;
    // Realm-safe binary check: `instanceof ArrayBuffer` fails for clones
    // produced in another VM context (e.g. the jsdom realm in tests).
    if (
        typeof bytes !== "object" ||
        bytes === null ||
        typeof (bytes as { byteLength?: unknown }).byteLength !== "number" ||
        ArrayBuffer.isView(bytes)
    ) {
        return null;
    }
    return bytes as ArrayBuffer;
}

export async function deleteScoreFile(id: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await transactionDone(tx);
}

/** Removes every stored score. Also used by tests for isolation. */
export async function clearAllScores(): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await transactionDone(tx);
}

/**
 * Replaces a stored score's binary payload (tab editor save) while keeping
 * the summary fields. Also refreshes the byte size to match the new payload.
 * No-op when the score id is unknown.
 */
export async function updateScoreBytes(id: string, bytes: ArrayBuffer): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const record = await requestToPromise(store.get(id) as IDBRequest<unknown>);
    if (typeof record !== "object" || record === null) {
        return;
    }
    const updated = { ...(record as Record<string, unknown>), bytes, sizeBytes: bytes.byteLength };
    store.put(updated);
    await transactionDone(tx);
}

// ─── Song progress (R-08: state keyed by file-content hash) ──────────────

/** Reads the practice progress for a score-content hash (null when absent). */
export async function getSongProgress(hash: string): Promise<unknown | null> {
    try {
        const db = await openDb();
        const tx = db.transaction(SONG_PROGRESS_STORE, "readonly");
        const request = tx.objectStore(SONG_PROGRESS_STORE).get(hash);
        const result = await requestToPromise(request);
        return (result as unknown) ?? null;
    } catch {
        // No IndexedDB (private mode, tests) — progress is best-effort.
        return null;
    }
}

/** Upserts the practice progress record for a hash (best-effort). */
export async function setSongProgress(record: SongProgress): Promise<void> {
    try {
        const db = await openDb();
        const tx = db.transaction(SONG_PROGRESS_STORE, "readwrite");
        tx.objectStore(SONG_PROGRESS_STORE).put(record);
        await transactionDone(tx);
    } catch {
        // Best-effort persistence — playback works without it.
    }
}

/**
 * Copies progress from one content hash to another (after an editor save
 * the bytes change; the practice history must follow the song).
 */
export async function copySongProgress(fromHash: string, toHash: string): Promise<void> {
    if (fromHash === toHash) return;
    const progress = await getSongProgress(fromHash);
    if (progress && typeof progress === "object") {
        await setSongProgress({
            ...(progress as SongProgress),
            hash: toHash,
            updatedAt: Date.now(),
        });
    }
}

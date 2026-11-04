/**
 * State and actions for the Sound screen: user-authored presets ("tone
 * designer") plus a mirror of the sound engine status.
 *
 * Persistence: IndexedDB (`fretmemo-sound-presets-v1`), following the scores
 * store pattern — the DB wrapper lives in this module (promise-based CRUD,
 * defensive validation on read so a corrupted record cannot break the Sound
 * page) and the store is an in-memory cache hydrated by `loadCustomPresets`.
 *
 * Data model conventions for custom presets (`SoundPreset` from
 * `src/audio/presets.ts`):
 * - `id` is always `custom-<uuid>`;
 * - `kind` is always 'custom' (the engine call site adapts it — see
 *   `toEnginePreset` — because the engine keys NAM loading off `kind`);
 * - `nameKey` holds the **literal user-entered name** (it is not an i18n key
 *   for custom presets; the UI renders it directly);
 * - `amp` is 'classic' or a NAM model id from `NAM_MODELS`;
 * - `updatedAt` (extra field) orders the list newest first.
 *
 * The active preset id lives in the SETTINGS store (`full.audio.soundPreset`)
 * — this store never owns it. It only mirrors engine status and the custom
 * preset list.
 */
import { create } from "zustand";
import {
    soundEngine,
    type SoundEngineState,
} from "@/audio/engine";
import {
    CHAIN_PARAM_RANGES,
    NAM_MODELS,
    type ChainParams,
    type SoundPreset,
} from "@/audio/presets";

export type SoundStorageError = "storage-error";

/** Persisted record: a custom preset plus ordering metadata. */
export type CustomPresetRecord = SoundPreset & { updatedAt: number };

interface SoundStoreState {
    /** User-authored presets, newest first. Empty until `loadCustomPresets` ran. */
    customPresets: SoundPreset[];
    isLoading: boolean;
    /** True once the cache has been hydrated from IndexedDB. */
    isLoaded: boolean;
    /** Last storage error, surfaced by the Sound page. */
    lastError: SoundStorageError | null;
    /** Mirror of `soundEngine.getState()` (the engine drives it). */
    engine: SoundEngineState;
    loadCustomPresets(): Promise<void>;
    saveCustomPreset(input: SaveCustomPresetInput): Promise<SoundPreset | null>;
    deleteCustomPreset(id: string): Promise<void>;
    clearError(): void;
}

export interface SaveCustomPresetInput {
    /** When given (and known), the existing preset is updated instead of created. */
    id?: string;
    /** User-entered display name (stored literally in `nameKey`). */
    name: string;
    /** 'classic' or a NAM model id from `NAM_MODELS`. */
    amp: string;
    params: ChainParams;
}

/* ─────────── IndexedDB wrapper (thin, promise-based) ─────────── */

const DB_NAME = "fretmemo-sound-presets-v1";
const DB_VERSION = 1;
const STORE = "customPresets";

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

export async function listCustomPresetRecords(): Promise<CustomPresetRecord[]> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const records = await requestToPromise(tx.objectStore(STORE).getAll());
    return records
        .filter(isPersistedRecord)
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putCustomPresetRecord(record: CustomPresetRecord): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    await transactionDone(tx);
}

export async function deleteCustomPresetRecord(id: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await transactionDone(tx);
}

/** Removes every stored custom preset. Also used by tests for isolation. */
export async function clearAllCustomPresets(): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await transactionDone(tx);
}

/* ─────────── Validation (defensive read) ─────────── */

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/** Type guard: is every `ChainParams` field a finite number in declared range? */
function isValidChainParams(value: unknown): value is ChainParams {
    if (!isPlainObject(value)) return false;
    return (Object.keys(CHAIN_PARAM_RANGES) as Array<keyof ChainParams>).every((key) => {
        const raw = value[key];
        const { min, max } = CHAIN_PARAM_RANGES[key];
        return typeof raw === "number" && Number.isFinite(raw) && raw >= min && raw <= max;
    });
}

function isPersistedRecord(value: unknown): value is CustomPresetRecord {
    return (
        isPlainObject(value) &&
        typeof value.id === "string" &&
        value.id.length > 0 &&
        typeof value.nameKey === "string" &&
        typeof value.amp === "string" &&
        typeof value.updatedAt === "number" &&
        Number.isFinite(value.updatedAt) &&
        isValidChainParams(value.params)
    );
}

interface ParsedCustomPreset {
    preset: CustomPresetRecord;
    /** True when an unknown amp id was rewritten to 'classic' (self-heal). */
    ampRepaired: boolean;
}

/**
 * Narrow a persisted record into a valid custom preset.
 * - Records with unknown amp ids (e.g. a model removed from the registry in a
 *   newer app version) fall back to `amp: 'classic'` rendering.
 * - Returns `null` for malformed records (dropped by the caller, never thrown).
 */
export function parseCustomPresetRecord(value: CustomPresetRecord): ParsedCustomPreset | null {
    const name = value.nameKey.trim();
    if (name.length === 0) {
        return null;
    }
    const amp = value.amp === "classic" || value.amp in NAM_MODELS ? value.amp : "classic";
    const preset: CustomPresetRecord = {
        id: value.id,
        kind: "custom",
        amp,
        params: { ...value.params },
        nameKey: name,
        builtIn: false,
        updatedAt: value.updatedAt,
    };
    return { preset, ampRepaired: amp !== value.amp };
}

/** Stable id for a new custom preset: `custom-<uuid>`. */
function createCustomPresetId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `custom-${crypto.randomUUID()}`;
    }
    // Deterministic-quality fallback for environments without crypto.randomUUID.
    return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/* ─────────── Engine adaptation ─────────── */

/**
 * Adapt a preset for `soundEngine.setPreset`. The engine decides between the
 * classic amp stage and a NAM model load from `kind` (`'nam'` → NAM), while
 * custom presets are persisted with `kind: 'custom'`. The persisted data model
 * is untouched — only the object handed to the engine is adapted.
 */
export function toEnginePreset(preset: SoundPreset): SoundPreset {
    if (preset.kind !== "custom") {
        return preset;
    }
    return { ...preset, kind: preset.amp === "classic" ? "classic" : "nam" };
}

/* ─────────── Store ─────────── */

export const useSoundStore = create<SoundStoreState>()((set, get) => ({
    customPresets: [],
    isLoading: false,
    isLoaded: false,
    lastError: null,
    engine: soundEngine.getState(),

    loadCustomPresets: async () => {
        if (get().isLoading) {
            return;
        }
        set({ isLoading: true });
        try {
            const records = await listCustomPresetRecords();
            const presets: SoundPreset[] = [];
            const repairs: CustomPresetRecord[] = [];
            for (const record of records) {
                const parsed = parseCustomPresetRecord(record);
                if (!parsed) {
                    // Malformed record: dropped from the list (never thrown),
                    // mirroring the scores store read policy.
                    continue;
                }
                presets.push(parsed.preset);
                if (parsed.ampRepaired) {
                    repairs.push({ ...parsed.preset, updatedAt: record.updatedAt });
                }
            }
            set({
                customPresets: presets,
                isLoaded: true,
                isLoading: false,
                lastError: null,
            });
            // Self-heal repaired records best-effort (unknown amp → classic).
            for (const record of repairs) {
                void putCustomPresetRecord(record).catch(() => {
                    // Best-effort only; the in-memory fix is already applied.
                });
            }
        } catch {
            set({ isLoading: false, lastError: "storage-error" });
        }
    },

    saveCustomPreset: async (input) => {
        const name = input.name.trim();
        if (name.length === 0) {
            return null;
        }
        const existing = input.id
            ? get().customPresets.find((preset) => preset.id === input.id)
            : undefined;
        const record: CustomPresetRecord = {
            id: existing?.id ?? createCustomPresetId(),
            kind: "custom",
            amp: input.amp,
            params: { ...input.params },
            nameKey: name,
            builtIn: false,
            updatedAt: Date.now(),
        };
        try {
            await putCustomPresetRecord(record);
            // Every in-memory custom preset is a full record (parse keeps
            // updatedAt), so the newest-first ordering stays total.
            const next = [
                record,
                ...get().customPresets.filter((preset) => preset.id !== record.id),
            ] as CustomPresetRecord[];
            next.sort((a, b) => b.updatedAt - a.updatedAt);
            set({ customPresets: next, lastError: null });
            return record;
        } catch {
            set({ lastError: "storage-error" });
            return null;
        }
    },

    deleteCustomPreset: async (id) => {
        try {
            await deleteCustomPresetRecord(id);
            set((state) => ({
                customPresets: state.customPresets.filter((preset) => preset.id !== id),
            }));
        } catch {
            set({ lastError: "storage-error" });
        }
    },

    clearError: () => set({ lastError: null }),
}));

/* ─────────── Engine status mirror + reload repair ─────────── */

/**
 * The engine's initial chain is resolved from built-ins only
 * (`getPresetById`): after a reload with a custom preset persisted as
 * `full.audio.soundPreset`, the first engine init falls back to the classic
 * chain with an `Unknown sound preset` error. Once custom presets are known
 * here, re-apply the persisted custom preset — the engine was initialized by
 * a user gesture at that point, so the repair is autoplay-safe. Guarded to at
 * most one repair per preset id per session so a genuinely broken preset
 * cannot loop.
 */
const repairedPresetIds = new Set<string>();

soundEngine.subscribe((state) => {
    useSoundStore.setState({ engine: state });

    const error = state.error;
    if (
        state.status !== "error" ||
        typeof error !== "string" ||
        !error.startsWith("Unknown sound preset:") ||
        repairedPresetIds.has(state.presetId)
    ) {
        return;
    }
    const custom = useSoundStore
        .getState()
        .customPresets.find((preset) => preset.id === state.presetId);
    if (!custom) {
        return;
    }
    repairedPresetIds.add(state.presetId);
    void soundEngine.setPreset(toEnginePreset(custom));
});

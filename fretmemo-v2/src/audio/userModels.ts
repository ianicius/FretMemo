/**
 * User-imported NAM models (IndexedDB).
 *
 * The tone designer lets users load their own `.nam` files (e.g. downloaded
 * from tone3000.com). Imported models are validated at import time, stored
 * locally in `fretmemo-user-models-v1` and exposed to the engine as blob
 * URLs — `loadNamNode` fetches that URL through its normal pipeline, so no
 * bundler/URL handling changes were needed for the feature.
 *
 * Licensing: user-imported models never leave the device and are NOT covered
 * by the bundled-model licenses in `public/sound/LICENSES.md` — the user is
 * responsible for their own files (the designer states this on import).
 */

import { isSlimmableContainerJson } from './nam';

export type UserModelErrorCode =
    | 'invalid-model'
    | 'legacy-format'
    | 'too-large'
    | 'storage-error';

export class UserModelError extends Error {
    code: UserModelErrorCode;
    constructor(code: UserModelErrorCode, message: string) {
        super(message);
        this.code = code;
    }
}

export interface UserModelMeta {
    id: string;
    name: string;
    addedAt: number;
    sizeBytes: number;
}

export interface UserModelRecord extends UserModelMeta {
    bytes: ArrayBuffer;
}

const DB_NAME = 'fretmemo-user-models-v1';
const STORE = 'models';
/** Hard cap: the biggest bundled model is ~0.4 MB; 15 MB is generous headroom. */
export const MAX_USER_MODEL_BYTES = 15 * 1024 * 1024;

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE)) {
                request.result.createObjectStore(STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const request = action(tx.objectStore(STORE));
            request.onsuccess = () => resolve(request.result as T);
            request.onerror = () => reject(request.error);
        });
    } finally {
        db.close();
    }
}

/** Decode bytes as text and validate the A2 SlimmableContainer format. */
export function validateUserModel(bytes: ArrayBuffer): void {
    if (bytes.byteLength > MAX_USER_MODEL_BYTES) {
        throw new UserModelError(
            'too-large',
            `model exceeds ${Math.round(MAX_USER_MODEL_BYTES / (1024 * 1024))} MB`,
        );
    }
    const text = new TextDecoder().decode(bytes);
    if (isSlimmableContainerJson(text)) return;
    if (text.trimStart().startsWith('{')) {
        // JSON but not A2 — most commonly a legacy single-architecture file.
        const legacy = /"(architecture|version)"\s*:\s*"(WaveNet|LSTM|ConvNet|[01]\.)"/i.test(text);
        throw new UserModelError(
            'legacy-format',
            legacy ? 'legacy single-architecture NAM file' : 'not an A2 SlimmableContainer file',
        );
    }
    throw new UserModelError('invalid-model', 'not a valid .nam JSON file');
}

export async function listUserModels(): Promise<UserModelMeta[]> {
    try {
        const rows = await withStore<UserModelRecord[]>('readonly', (store) => store.getAll());
        return rows
            .map(({ bytes: _bytes, ...meta }) => meta)
            .sort((a, b) => b.addedAt - a.addedAt);
    } catch {
        return [];
    }
}

export async function saveUserModel(name: string, bytes: ArrayBuffer): Promise<UserModelMeta> {
    validateUserModel(bytes);
    const record: UserModelRecord = {
        id: `user-${crypto.randomUUID()}`,
        name: name.trim() || 'Imported model',
        addedAt: Date.now(),
        sizeBytes: bytes.byteLength,
        bytes,
    };
    try {
        await withStore('readwrite', (store) => store.put(record));
    } catch {
        throw new UserModelError('storage-error', 'failed to persist the model locally');
    }
    invalidateBlobUrl(record.id);
    return { id: record.id, name: record.name, addedAt: record.addedAt, sizeBytes: record.sizeBytes };
}

export async function deleteUserModel(id: string): Promise<void> {
    try {
        await withStore('readwrite', (store) => store.delete(id));
    } catch {
        throw new UserModelError('storage-error', 'failed to delete the model');
    }
    invalidateBlobUrl(id);
}

export async function getUserModelBytes(id: string): Promise<ArrayBuffer | null> {
    try {
        const record = await withStore<UserModelRecord | undefined>('readonly', (store) => store.get(id));
        return record ? record.bytes : null;
    } catch {
        return null;
    }
}

// — Session blob-URL cache (the engine fetches models by URL) —

const blobUrls = new Map<string, string>();

export async function getUserModelBlobUrl(id: string): Promise<string | null> {
    if (blobUrls.has(id)) return blobUrls.get(id) ?? null;
    const bytes = await getUserModelBytes(id);
    if (!bytes) return null;
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
    blobUrls.set(id, url);
    return url;
}

export function invalidateBlobUrl(id: string): void {
    const url = blobUrls.get(id);
    if (url) {
        URL.revokeObjectURL(url);
        blobUrls.delete(id);
    }
}

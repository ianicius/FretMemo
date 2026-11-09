/**
 * Per-song practice progress keyed by FILE CONTENT hash (roadmap R-08).
 *
 * The Orfeo idea — "state travels with the object" — translated for the
 * web: the practice position, tempo and loop range live in IndexedDB under
 * a SHA-256 of the score bytes, so re-importing the same file (even
 * renamed) restores its progress, while a different file never inherits it.
 * Pure hashing here; persistence lives in scoreStore (songProgress store).
 */

export interface SongProgress {
    /** SHA-256 hex of the score bytes. */
    hash: string;
    /** Last playback position in ms ("where I finished"). */
    lastPositionMs?: number;
    /** Practice tempo (soundfont speed, 0.5–1.5). */
    speed?: number;
    loopEnabled?: boolean;
    loopStartBar?: number;
    loopEndBar?: number;
    updatedAt: number;
}

/** SHA-256 of the score bytes as a hex string. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
    // The readers produce exact-size plain ArrayBuffers; the cast satisfies
    // TS 5.9 ArrayBuffer generics (SharedArrayBuffer can never occur here).
    const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

/** Same content → same hash (renames and re-imports keep their progress). */
export async function sameSongHash(a: Uint8Array, b: Uint8Array): Promise<boolean> {
    const [hashA, hashB] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
    return hashA === hashB;
}

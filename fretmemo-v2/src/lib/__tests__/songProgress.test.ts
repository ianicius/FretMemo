import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { sha256Hex, sameSongHash, type SongProgress } from "../songProgress";
import { getSongProgress, setSongProgress, copySongProgress } from "../scoreStore";

describe("songProgress — hashing", () => {
    it("produces a stable 64-char hex digest", async () => {
        const bytes = new Uint8Array([1, 2, 3, 4, 5]);
        const hash1 = await sha256Hex(bytes);
        const hash2 = await sha256Hex(new Uint8Array([1, 2, 3, 4, 5]));
        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("differs for different content", async () => {
        const a = await sha256Hex(new Uint8Array([1, 2, 3]));
        const b = await sha256Hex(new Uint8Array([1, 2, 4]));
        expect(a).not.toBe(b);
    });

    it("sameSongHash ignores file names by construction", async () => {
        // Same bytes under a "different name" — the hash is content-only.
        expect(await sameSongHash(new Uint8Array([9, 8, 7]), new Uint8Array([9, 8, 7]))).toBe(true);
    });
});

describe("songProgress — persistence (IndexedDB)", () => {
    // Unique hashes per test instead of wiping the DB — the store caches its
    // connection, and best-effort writes into a deleted DB fail silently.
    let counter = 0;
    const uniqueHash = () => (counter++).toString(16).padStart(64, "0");
    const HASH_A = uniqueHash();
    const HASH_B = uniqueHash();

    it("round-trips a progress record by hash", async () => {
        const record: SongProgress = {
            hash: HASH_A,
            lastPositionMs: 42_000,
            speed: 0.75,
            loopEnabled: true,
            loopStartBar: 2,
            loopEndBar: 5,
            updatedAt: 1,
        };
        await setSongProgress(record);
        const loaded = (await getSongProgress(HASH_A)) as SongProgress;
        expect(loaded.lastPositionMs).toBe(42_000);
        expect(loaded.loopStartBar).toBe(2);
        expect(loaded.speed).toBe(0.75);
        expect(await getSongProgress(HASH_B)).toBeNull();
    });

    it("copies progress to a new hash after an editor save", async () => {
        await setSongProgress({ hash: HASH_A, lastPositionMs: 12_000, updatedAt: 1 });
        await copySongProgress(HASH_A, HASH_B);
        const copied = (await getSongProgress(HASH_B)) as SongProgress;
        expect(copied.lastPositionMs).toBe(12_000);
        expect(copied.hash).toBe(HASH_B);
        // Original untouched.
        expect(((await getSongProgress(HASH_A)) as SongProgress).hash).toBe(HASH_A);
    });

    it("tolerates a missing source record on copy", async () => {
        const freshTarget = uniqueHash();
        await copySongProgress("f".repeat(64), freshTarget);
        expect(await getSongProgress(freshTarget)).toBeNull();
    });
});

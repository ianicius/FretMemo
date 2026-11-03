import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ScoreRecord } from "@/types/scores";
import {
    clearAllScores,
    deleteScoreFile,
    getScoreBytes,
    listScoreMeta,
    putScoreFile,
} from "../scoreStore";

function makeRecord(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
    return {
        id: "score-1",
        name: "song.gp5",
        addedAt: 1_700_000_000_000,
        sizeBytes: 3,
        format: "gp5",
        title: "Test Song",
        trackCount: 2,
        tempoBpm: 120,
        bytes: new Uint8Array([1, 2, 3]).buffer,
        ...overrides,
    };
}

beforeAll(async () => {
    await clearAllScores();
});

beforeEach(async () => {
    await clearAllScores();
});

describe("scoreStore", () => {
    it("round-trips a score record: put → meta list → bytes", async () => {
        const record = makeRecord();
        await putScoreFile(record);

        const meta = await listScoreMeta();
        expect(meta).toHaveLength(1);
        expect(meta[0]).toEqual({
            id: "score-1",
            name: "song.gp5",
            addedAt: 1_700_000_000_000,
            sizeBytes: 3,
            format: "gp5",
            title: "Test Song",
            trackCount: 2,
            tempoBpm: 120,
        });
        // Meta must not leak the binary payload.
        expect("bytes" in meta[0]).toBe(false);

        const bytes = await getScoreBytes("score-1");
        expect(bytes).not.toBeNull();
        expect(new Uint8Array(bytes as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("returns null for a missing id", async () => {
        expect(await getScoreBytes("nope")).toBeNull();
    });

    it("deletes a score and leaves others intact", async () => {
        await putScoreFile(makeRecord({ id: "a" }));
        await putScoreFile(makeRecord({ id: "b" }));

        await deleteScoreFile("a");

        expect(await getScoreBytes("a")).toBeNull();
        expect(await getScoreBytes("b")).not.toBeNull();
        const meta = await listScoreMeta();
        expect(meta.map((m) => m.id)).toEqual(["b"]);
    });

    it("skips malformed records on read instead of throwing", async () => {
        await putScoreFile(makeRecord({ id: "good" }));
        // Corrupt the store directly with a record missing required fields.
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const open = indexedDB.open("fretmemo-scores-v1", 1);
            open.onsuccess = () => resolve(open.result);
            open.onerror = () => reject(open.error);
        });
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction("files", "readwrite");
            tx.objectStore("files").put({ id: "bad" });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();

        const meta = await listScoreMeta();
        expect(meta.map((m) => m.id)).toEqual(["good"]);
    });

    it("clears everything via clearAllScores", async () => {
        await putScoreFile(makeRecord({ id: "a" }));
        await putScoreFile(makeRecord({ id: "b" }));
        await clearAllScores();
        expect(await listScoreMeta()).toEqual([]);
    });
});

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScoreParseError } from "@/lib/guitarProImport";
import { clearAllScores, listScoreMeta, putScoreFile } from "@/lib/scoreStore";
import type { ScoreRecord, ScoreSummary } from "@/types/scores";
import { useScoresStore } from "../useScoresStore";

/**
 * The store is tested against the real IndexedDB wrapper (`fake-indexeddb`)
 * and the real file reader; only alphaTab parsing is mocked, at our own
 * module boundary (mocking the externalized package does not reach its
 * dynamic `import()` from the store's module graph).
 */
vi.mock("@/lib/guitarProImport", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/lib/guitarProImport")>();
    return {
        ...actual,
        parseScoreSummary: vi.fn(),
    };
});

import { parseScoreSummary } from "@/lib/guitarProImport";
const parseMock = vi.mocked(parseScoreSummary);

function makeSummary(overrides: Partial<ScoreSummary> = {}): ScoreSummary {
    return {
        id: "score-1",
        name: "song.gp4",
        addedAt: 1_700_000_000_000,
        sizeBytes: 8,
        format: "gp4",
        title: "Test Song",
        trackCount: 2,
        tempoBpm: 96,
        ...overrides,
    };
}

beforeEach(async () => {
    await clearAllScores();
    parseMock.mockReset();
    useScoresStore.setState({
        scores: [],
        isLoading: false,
        isLoaded: false,
        lastError: null,
    });
});

describe("useScoresStore", () => {
    it("addScore parses, persists to IndexedDB and updates the list", async () => {
        parseMock.mockResolvedValue(makeSummary());
        const file = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], "song.gp4");

        const summary = await useScoresStore.getState().addScore(file);

        expect(summary).not.toBeNull();
        expect(summary?.title).toBe("Test Song");
        expect(parseMock).toHaveBeenCalledWith(
            expect.any(Uint8Array),
            "song.gp4",
            8,
        );
        expect(useScoresStore.getState().scores).toHaveLength(1);
        expect(useScoresStore.getState().lastError).toBeNull();

        const meta = await listScoreMeta();
        expect(meta).toHaveLength(1);
        expect(meta[0].id).toBe(summary?.id);
    });

    it("addScore keeps the list sorted newest first", async () => {
        parseMock
            .mockResolvedValueOnce(makeSummary({ id: "old", addedAt: 1_000 }))
            .mockResolvedValueOnce(makeSummary({ id: "new", addedAt: 2_000 }));

        await useScoresStore
            .getState()
            .addScore(new File([new Uint8Array([1])], "old.gp4"));
        await useScoresStore
            .getState()
            .addScore(new File([new Uint8Array([2])], "new.gp4"));

        expect(useScoresStore.getState().scores.map((s) => s.id)).toEqual([
            "new",
            "old",
        ]);
    });

    it("addScore reports unsupported-format for non-GP data", async () => {
        parseMock.mockRejectedValue(
            new ScoreParseError("Unsupported file format: readme.txt", {
                kind: "format",
            }),
        );
        const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "readme.txt");

        const summary = await useScoresStore.getState().addScore(file);

        expect(summary).toBeNull();
        expect(useScoresStore.getState().lastError).toBe("unsupported-format");
        expect(useScoresStore.getState().scores).toHaveLength(0);
    });

    it("addScore reports parse-error when the parser fails on a GP file", async () => {
        parseMock.mockRejectedValue(
            new ScoreParseError("Failed to parse broken.gp5", { kind: "parse" }),
        );

        const summary = await useScoresStore
            .getState()
            .addScore(new File([new Uint8Array([9])], "broken.gp5"));

        expect(summary).toBeNull();
        expect(useScoresStore.getState().lastError).toBe("parse-error");
    });

    it("addScore reports storage-error on unexpected IO failures", async () => {
        parseMock.mockRejectedValue(new Error("disk on fire"));

        const summary = await useScoresStore
            .getState()
            .addScore(new File([new Uint8Array([9])], "song.gp4"));

        expect(summary).toBeNull();
        expect(useScoresStore.getState().lastError).toBe("storage-error");
    });

    it("removeScore deletes from IndexedDB and the list", async () => {
        parseMock.mockResolvedValue(makeSummary({ id: "kill-me" }));
        await useScoresStore
            .getState()
            .addScore(new File([new Uint8Array([1])], "song.gp4"));

        await useScoresStore.getState().removeScore("kill-me");

        expect(useScoresStore.getState().scores).toHaveLength(0);
        expect(await listScoreMeta()).toHaveLength(0);
    });

    it("loadScores hydrates the cache from IndexedDB", async () => {
        const record: ScoreRecord = {
            ...makeSummary({ id: "seeded" }),
            bytes: new Uint8Array([1, 2, 3]).buffer,
        };
        await putScoreFile(record);
        useScoresStore.setState({ scores: [], isLoaded: false });

        await useScoresStore.getState().loadScores();

        expect(useScoresStore.getState().isLoaded).toBe(true);
        expect(useScoresStore.getState().scores).toHaveLength(1);
        expect(useScoresStore.getState().scores[0].id).toBe("seeded");
    });

    it("clearError resets lastError", async () => {
        parseMock.mockRejectedValue(
            new ScoreParseError("nope", { kind: "format" }),
        );
        await useScoresStore
            .getState()
            .addScore(new File([new Uint8Array([9])], "junk.bin"));
        expect(useScoresStore.getState().lastError).toBe("unsupported-format");

        useScoresStore.getState().clearError();
        expect(useScoresStore.getState().lastError).toBeNull();
    });
});

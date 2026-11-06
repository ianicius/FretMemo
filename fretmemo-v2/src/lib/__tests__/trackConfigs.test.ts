import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
    getTrackConfigs,
    setTrackConfigs,
    sanitizeTrackConfigs,
    type TrackConfig,
} from "../trackConfigs";
import { getBuiltinPresets } from "@/audio/presets";

const VALID: TrackConfig[] = [
    { trackIndex: 0, kind: "preset", presetId: getBuiltinPresets()[0].id, muted: false },
    { trackIndex: 1, kind: "direct", muted: true },
];

beforeEach(async () => {
    // Fresh store per test (fake-indexeddb is in-memory per file run).
    await setTrackConfigs("score-x", []);
});

describe("trackConfigs persistence", () => {
    it("round-trips configs per score id", async () => {
        await setTrackConfigs("score-1", VALID);
        expect(await getTrackConfigs("score-1")).toEqual(VALID);
        await setTrackConfigs("score-2", VALID.slice(0, 1));
        expect(await getTrackConfigs("score-1")).toEqual(VALID);
        expect(await getTrackConfigs("score-2")).toEqual(VALID.slice(0, 1));
    });

    it("returns an empty array when nothing was stored", async () => {
        expect(await getTrackConfigs("never-stored")).toEqual([]);
    });

    it("overwrites previous configs on set", async () => {
        await setTrackConfigs("score-1", VALID);
        await setTrackConfigs("score-1", [{ trackIndex: 0, kind: "direct", muted: false }]);
        expect(await getTrackConfigs("score-1")).toEqual([
            { trackIndex: 0, kind: "direct", muted: false },
        ]);
    });
});

describe("sanitizeTrackConfigs", () => {
    it("keeps valid preset and direct entries", () => {
        expect(sanitizeTrackConfigs(VALID, 2)).toEqual(VALID);
    });

    it("drops entries with unknown preset ids", () => {
        const configs: TrackConfig[] = [
            { trackIndex: 0, kind: "preset", presetId: "no-such-preset", muted: false },
            { trackIndex: 1, kind: "direct", muted: false },
        ];
        expect(sanitizeTrackConfigs(configs, 2)).toEqual([configs[1]]);
    });

    it("drops entries with out-of-range track indexes and duplicates", () => {
        const configs: TrackConfig[] = [
            { trackIndex: 5, kind: "direct", muted: false },
            { trackIndex: 0, kind: "direct", muted: false },
            { trackIndex: 0, kind: "preset", presetId: getBuiltinPresets()[1].id, muted: false },
        ];
        const sanitized = sanitizeTrackConfigs(configs, 2);
        expect(sanitized).toHaveLength(1);
        expect(sanitized[0].trackIndex).toBe(0);
    });

    it("coerces malformed records instead of throwing", () => {
        const garbage = [
            null,
            { trackIndex: "zero", kind: "direct" },
            { trackIndex: 0, kind: "preset", presetId: getBuiltinPresets()[0].id },
        ] as unknown as TrackConfig[];
        const sanitized = sanitizeTrackConfigs(garbage, 1);
        expect(sanitized).toEqual([
            { trackIndex: 0, kind: "preset", presetId: getBuiltinPresets()[0].id, muted: false },
        ]);
    });
});

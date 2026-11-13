import { describe, expect, it } from "vitest";
import {
    barHitRatios,
    weakestBarWindow,
    midiToPitchClass,
    recordBeatResult,
    type BarStatsMap,
} from "../barScore";

describe("barScore — recordBeatResult", () => {
    it("accumulates hits and attempts per bar", () => {
        let map: BarStatsMap = {};
        map = recordBeatResult(map, 0, true);
        map = recordBeatResult(map, 0, false);
        map = recordBeatResult(map, 0, true);
        map = recordBeatResult(map, 2, false);
        expect(map[0]).toEqual({ hits: 2, attempts: 3 });
        expect(map[2]).toEqual({ hits: 0, attempts: 1 });
        expect(map[1]).toBeUndefined();
    });

    it("does not mutate the input map", () => {
        const map: BarStatsMap = { 0: { hits: 1, attempts: 1 } };
        const next = recordBeatResult(map, 0, false);
        expect(map[0].attempts).toBe(1);
        expect(next[0].attempts).toBe(2);
    });
});

describe("barScore — barHitRatios", () => {
    it("returns hit ratio per bar, null for bars without attempts", () => {
        const map: BarStatsMap = {
            0: { hits: 4, attempts: 4 },
            1: { hits: 1, attempts: 4 },
        };
        const ratios = barHitRatios(map, 4);
        expect(ratios).toEqual([1, 0.25, null, null]);
    });

    it("handles an empty stats map", () => {
        expect(barHitRatios({}, 3)).toEqual([null, null, null]);
    });
});

describe("barScore — weakestBarWindow", () => {
    const ratios = [1, 0.2, 0.1, 0.9, 0.5, null, null];

    it("finds the contiguous window with the lowest average ratio", () => {
        // Bars 1-3: (0.2+0.1+0.9)/3 = 0.4; bars 1-2: 0.15 — the 2-bar window wins.
        expect(weakestBarWindow(ratios, 6, 2)).toEqual({ start: 1, end: 2 });
    });

    it("prefers the weakest window among attempted bars only", () => {
        // Window spanning the null bars must be skipped entirely.
        expect(weakestBarWindow(ratios, 7, 3)).toEqual({ start: 1, end: 3 });
        // 3-bar window [1,3] avg 0.4 vs [3,5]? [3,5] has null — skipped.
    });

    it("returns null when there is no scored data at all", () => {
        expect(weakestBarWindow([null, null], 2, 2)).toBeNull();
    });

    it("breaks ties by the earliest window", () => {
        const tie: Array<number | null> = [0.5, 0.5, 0.5, 0.5];
        expect(weakestBarWindow(tie, 4, 2)).toEqual({ start: 0, end: 1 });
    });
});

describe("barScore — midiToPitchClass", () => {
    it("maps midi numbers to pitch-class names", () => {
        expect(midiToPitchClass(60)).toBe("C");
        expect(midiToPitchClass(61)).toBe("C#");
        expect(midiToPitchClass(69)).toBe("A");
        expect(midiToPitchClass(64)).toBe("E");
    });
});

describe("barScore — buildBeatMarkers", async () => {
    const { buildBeatMarkers } = await import("../barScore");

    const score = {
        masterBars: [{ start: 0 }, { start: 3840 }],
        tracks: [
            {
                staves: [
                    {
                        bars: [
                            {
                                voices: [
                                    {
                                        beats: [
                                            { playbackDuration: 1920, isEmpty: false, notes: [{ realValue: 60 }, { realValue: 64 }] },
                                            { playbackDuration: 1920, isEmpty: true, notes: [] },
                                            { playbackDuration: 0, isEmpty: false, notes: [{ realValue: 67 }] },
                                        ],
                                    },
                                ],
                            },
                            {
                                voices: [
                                    {
                                        beats: [
                                            { playbackDuration: 3840, isEmpty: false, notes: [{ realValue: 69 }] },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            // second track ignored when trackIndex = 0
            {
                staves: [
                    {
                        bars: [
                            { voices: [{ beats: [{ playbackDuration: 3840, isEmpty: false, notes: [{ realValue: 40 }] }] }] },
                            { voices: [{ beats: [{ playbackDuration: 3840, isEmpty: false, notes: [{ realValue: 45 }] }] }] },
                        ],
                    },
                ],
            },
        ],
    };

    it("builds scored beat markers with bar/beat/pitch classes for the chosen track", () => {
        const markers = buildBeatMarkers(score as never, 0);
        expect(markers).toHaveLength(3); // empty beat skipped
        expect(markers[0]).toEqual({ barIndex: 0, beatIndex: 0, startTick: 0, pitchClasses: ["C", "E"] });
        // The empty beat still occupies its duration — the scored beat starts
        // after BOTH prior beats (1920 + 1920 ticks).
        expect(markers[1]).toEqual({ barIndex: 0, beatIndex: 2, startTick: 3840, pitchClasses: ["G"] });
        expect(markers[2]).toEqual({ barIndex: 1, beatIndex: 0, startTick: 3840, pitchClasses: ["A"] });
    });

    it("honours the track index", () => {
        const markers = buildBeatMarkers(score as never, 1);
        expect(markers.map((m) => m.pitchClasses[0])).toEqual(["E", "A"]);
    });
});

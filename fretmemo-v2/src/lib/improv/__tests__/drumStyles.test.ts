import { describe, expect, it } from "vitest";
import { DRUM_STYLE_IDS, DRUM_STYLES, drumHitsForBeat } from "../drumStyles";

describe("plan F4: drum styles", () => {
    it("keeps every hit inside one 4/4 bar and returns each hit exactly once over the bar", () => {
        for (const style of DRUM_STYLE_IDS) {
            for (const hit of DRUM_STYLES[style]) {
                expect(hit.at, style).toBeGreaterThanOrEqual(0);
                expect(hit.at, style).toBeLessThan(4);
            }
            const total = [0, 1, 2, 3].reduce((sum, beat) => sum + drumHitsForBeat(style, beat).length, 0);
            expect(total, style).toBe(DRUM_STYLES[style].length);
        }
    });

    it("puts the triplet hits of the swing and the shuffle two thirds into the beat", () => {
        const swing = drumHitsForBeat("swing", 1).map((hit) => hit.offset);
        const shuffle = drumHitsForBeat("shuffle", 0).filter((hit) => hit.voice === "hat").map((hit) => hit.offset);
        for (const offsets of [swing, shuffle]) {
            expect(offsets).toHaveLength(2);
            expect(offsets[0]).toBe(0);
            expect(offsets[1]).toBeCloseTo(2 / 3);
        }
        expect(drumHitsForBeat("off", 0)).toEqual([]);
    });
});

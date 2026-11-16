import { describe, expect, it } from "vitest";
import { BASS_STYLES, COMP_STYLES, DRUM_STYLE_IDS, DRUM_STYLES, bassHitsForBeat, bassSemitones, compHitsForBeat, drumHitsForBeat } from "../drumStyles";

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

    it("gives every groove style its own comping and bass, all inside one bar", () => {
        for (const style of DRUM_STYLE_IDS.filter((id) => id !== "off")) {
            for (const [patterns, slice] of [[COMP_STYLES, compHitsForBeat], [BASS_STYLES, (id: typeof style, beat: number) => bassHitsForBeat(id, beat, false)]] as const) {
                const hits = patterns[style];
                expect(hits.length, style).toBeGreaterThan(0);
                for (const hit of hits) expect(hit.at + hit.len, style).toBeLessThanOrEqual(4);
                expect([0, 1, 2, 3].reduce((sum, beat) => sum + slice(style, beat).length, 0), style).toBe(hits.length);
            }
        }
        expect(compHitsForBeat("swing", 1)[0].offset).toBeCloseTo(2 / 3);
    });

    it("starts a chord on its root and picks the sixth or minor seventh by chord quality", () => {
        expect(bassHitsForBeat("swing", 2, false)[0].degree).toBe("fifth");
        expect(bassHitsForBeat("swing", 2, true)[0].degree).toBe("root");
        expect(bassSemitones("sixth", "A7")).toBe(9);
        expect(bassSemitones("sixth", "Am7")).toBe(10);
        expect(bassSemitones("fifth", "Am7")).toBe(7);
    });
});

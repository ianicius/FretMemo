import { describe, expect, it } from "vitest";
import { barRangeTicks, barRangeToMsWindow, TICKS_PER_QUARTER } from "../barLoop";

/** 4/4 bars of quarter notes = 4 quarters = 3840 ticks each, tempo baked. */
function makeMasterBar(startTick: number, quarters: number, tempoBpm?: number) {
    return {
        start: startTick,
        calculateDuration: () => quarters * TICKS_PER_QUARTER,
        tempoAutomations: tempoBpm
            ? [{ isLinear: true, ratioPosition: 0, type: 0, value: tempoBpm }]
            : [],
    };
}

function makeScore(bars: ReturnType<typeof makeMasterBar>[]) {
    return { tempo: 120, masterBars: bars };
}

describe("barLoop — barRangeTicks", () => {
    it("maps a bar range to the tick window covering the bars", () => {
        const score = makeScore([
            makeMasterBar(0, 4),
            makeMasterBar(3840, 4),
            makeMasterBar(7680, 4),
        ]);
        expect(barRangeTicks(score as never, 1, 2)).toEqual({
            startTick: 3840,
            endTick: 11520,
        });
    });

    it("clamps the end bar to the last bar index", () => {
        const score = makeScore([makeMasterBar(0, 4), makeMasterBar(3840, 4)]);
        expect(barRangeTicks(score as never, 0, 99)).toEqual({
            startTick: 0,
            endTick: 7680,
        });
    });

    it("rejects an inverted or empty range", () => {
        const score = makeScore([makeMasterBar(0, 4), makeMasterBar(3840, 4)]);
        expect(() => barRangeTicks(score as never, 2, 1)).toThrow();
        expect(() => barRangeTicks(score as never, -1, 0)).toThrow();
        expect(() => barRangeTicks(score as never, 0, -1)).toThrow();
    });
});

describe("barLoop — barRangeToMsWindow", () => {
    it("converts a bar range to a millisecond window at constant tempo", () => {
        // 4/4 at 120 BPM = 2 s per bar.
        const score = makeScore([
            makeMasterBar(0, 4),
            makeMasterBar(3840, 4),
            makeMasterBar(7680, 4),
        ]);
        expect(barRangeToMsWindow(score as never, 1, 1)).toEqual({
            startMs: 2000,
            endMs: 4000,
        });
    });

    it("follows tempo automations at bar starts", () => {
        const score = makeScore([
            makeMasterBar(0, 4), // 120 BPM -> 2000 ms
            makeMasterBar(3840, 4, 60), // 60 BPM -> 4000 ms
            makeMasterBar(7680, 4), // keeps 60 BPM -> 4000 ms
        ]);
        expect(barRangeToMsWindow(score as never, 0, 2)).toEqual({
            startMs: 0,
            endMs: 10000,
        });
        // Loop over just the slow bars.
        expect(barRangeToMsWindow(score as never, 1, 2)).toEqual({
            startMs: 2000,
            endMs: 10000,
        });
    });

    it("rejects an inverted range", () => {
        const score = makeScore([makeMasterBar(0, 4), makeMasterBar(3840, 4)]);
        expect(() => barRangeToMsWindow(score as never, 1, 0)).toThrow();
    });
});

describe("barLoop — msToTicks", () => {
    it("inverts barRangeToMsWindow at constant tempo", async () => {
        const { msToTicks } = await import("../barLoop");
        const score = makeScore([
            makeMasterBar(0, 4),
            makeMasterBar(3840, 4),
            makeMasterBar(7680, 4),
        ]);
        // 2000 ms = start of bar 1 = tick 3840 (at 120 BPM, 960 ticks/quarter).
        expect(msToTicks(score as never, 2000)).toBe(3840);
        expect(msToTicks(score as never, 0)).toBe(0);
        // Past the end: clamps to the final tick.
        expect(msToTicks(score as never, 99999)).toBe(11520);
    });

    it("follows tempo automations (slow bar covers fewer ticks per ms)", async () => {
        const { msToTicks } = await import("../barLoop");
        const score = makeScore([
            makeMasterBar(0, 4),
            makeMasterBar(3840, 4, 60),
            makeMasterBar(7680, 4),
        ]);
        // At 2000 ms the walk is exactly at the bar 1 boundary (tick 3840).
        expect(msToTicks(score as never, 2000)).toBe(3840);
        // Halfway into the 60-BPM bar (2000 ms more) = 1920 ticks further.
        expect(msToTicks(score as never, 4000)).toBe(3840 + 1920);
    });
});

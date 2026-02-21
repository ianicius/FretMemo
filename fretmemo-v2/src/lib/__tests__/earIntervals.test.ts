import { describe, expect, it } from "vitest";
import { EAR_INTERVALS, getEarIntervalsFromTokens, resolveEarInterval } from "../earIntervals";

describe("earIntervals helpers", () => {
    it("resolves TT alias to tritone", () => {
        const interval = resolveEarInterval("TT");
        expect(interval?.name).toBe("A4");
        expect(interval?.semitones).toBe(6);
    });

    it("returns canonical ordered intervals for tokens", () => {
        const intervals = getEarIntervalsFromTokens(["P5", "TT", "P5", "unknown"]);
        expect(intervals.map((item) => item.name)).toEqual(["A4", "P5"]);
    });

    it("falls back to full catalog when tokens are empty/invalid", () => {
        const fromEmpty = getEarIntervalsFromTokens([]);
        const fromInvalid = getEarIntervalsFromTokens(["???"]);

        expect(fromEmpty).toHaveLength(EAR_INTERVALS.length);
        expect(fromInvalid).toHaveLength(EAR_INTERVALS.length);
        expect(fromEmpty[0]?.name).toBe("P1");
        expect(fromEmpty[fromEmpty.length - 1]?.name).toBe("P8");
    });
});

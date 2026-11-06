import { describe, expect, it } from "vitest";
import {
    assignFingerings,
    fingerForFret,
    handPositionFor,
} from "../fingering";

describe("fingering — fingerForFret", () => {
    it("maps frets within the hand window to fingers 1-4", () => {
        expect(fingerForFret(5, 5)).toBe(1);
        expect(fingerForFret(6, 5)).toBe(2);
        expect(fingerForFret(7, 5)).toBe(3);
        expect(fingerForFret(8, 5)).toBe(4);
    });

    it("returns null for open strings", () => {
        expect(fingerForFret(0, 5)).toBeNull();
    });

    it("returns null when the fret is outside the hand window", () => {
        expect(fingerForFret(9, 5)).toBeNull();
        expect(fingerForFret(4, 5)).toBeNull();
    });
});

describe("fingering — handPositionFor", () => {
    it("keeps the current position when the fret fits the window", () => {
        expect(handPositionFor(7, 5)).toBe(5);
        expect(handPositionFor(8, 5)).toBe(5);
    });

    it("chooses the closest valid new position when the fret is above the window", () => {
        // Fret 12 cannot fit [5,8] — new position must cover 12: [9..12].
        // Closest to 5 → shift up as little as possible → 9 (window [9,12]).
        expect(handPositionFor(12, 5)).toBe(9);
    });

    it("chooses the closest valid new position when the fret is below the window", () => {
        // Fret 2 cannot fit [5,8] — position must cover 2: [1..2] (fret >= 1).
        // Closest to 5 → 2 (window [2,5]).
        expect(handPositionFor(2, 5)).toBe(2);
    });

    it("clamps the position to fret 1 minimum", () => {
        expect(handPositionFor(1, 5)).toBe(1);
    });

    it("never moves the hand for an open string", () => {
        expect(handPositionFor(0, 5)).toBe(5);
    });
});

describe("fingering — assignFingerings", () => {
    it("assigns fingers within one stable hand position", () => {
        const steps = assignFingerings([
            { stringIndex: 0, fret: 5 },
            { stringIndex: 0, fret: 6 },
            { stringIndex: 0, fret: 7 },
        ]);
        expect(steps.map((s) => s.finger)).toEqual([1, 2, 3]);
        expect(steps.map((s) => s.handPositionFret)).toEqual([5, 5, 5]);
    });

    it("leaves open strings unfingered but keeps the hand position", () => {
        const steps = assignFingerings([
            { stringIndex: 0, fret: 5 },
            { stringIndex: 0, fret: 0 },
            { stringIndex: 0, fret: 6 },
        ]);
        expect(steps.map((s) => s.finger)).toEqual([1, null, 2]);
        expect(steps[1].handPositionFret).toBe(5);
    });

    it("shifts the hand position upward with minimal movement", () => {
        const steps = assignFingerings([
            { stringIndex: 0, fret: 5 },
            { stringIndex: 0, fret: 12 },
        ]);
        // Position jumps 5 -> 9 to cover fret 12 with the pinky.
        expect(steps[1].handPositionFret).toBe(9);
        expect(steps[1].finger).toBe(4);
    });

    it("shifts the hand position downward and re-fingers", () => {
        const steps = assignFingerings([
            { stringIndex: 0, fret: 8 },
            { stringIndex: 0, fret: 3 },
        ]);
        // Down-shift lands the index on the note: position = fret = 3.
        expect(steps[1].handPositionFret).toBe(3);
        expect(steps[1].finger).toBe(1);
    });

    it("keeps fingering consistent across string changes within the window", () => {
        const steps = assignFingerings([
            { stringIndex: 0, fret: 5 },
            { stringIndex: 1, fret: 7 },
            { stringIndex: 2, fret: 5 },
        ]);
        expect(steps.map((s) => s.finger)).toEqual([1, 3, 1]);
    });

    it("accepts an initial hand position", () => {
        const steps = assignFingerings([{ stringIndex: 1, fret: 7 }], 7);
        expect(steps[0].finger).toBe(1);
        expect(steps[0].handPositionFret).toBe(7);
    });

    it("handles an empty sequence", () => {
        expect(assignFingerings([])).toEqual([]);
    });

    it("walks a chromatic run 5-6-7-8 with fingers 1-2-3-4 and no shift", () => {
        const steps = assignFingerings(
            [5, 6, 7, 8].map((fret) => ({ stringIndex: 0, fret })),
        );
        expect(steps.map((s) => s.finger)).toEqual([1, 2, 3, 4]);
        expect(new Set(steps.map((s) => s.handPositionFret))).toEqual(new Set([5]));
    });
});

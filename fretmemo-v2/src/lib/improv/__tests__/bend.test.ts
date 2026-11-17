import { describe, expect, it } from "vitest";
import { BEND_HOLD_MS, BEND_IDLE, centsAbove, frettedMidi, stepBend } from "../bend";

const WHOLE = { minCents: 180, maxCents: 220 };

/** Feeds frames of 50 ms and returns how many repetitions were counted. */
function run(frames: Array<number | null>, range = WHOLE): number {
    let state = BEND_IDLE;
    let reps = 0;
    for (const cents of frames) {
        const next = stepBend(state, cents, 50, range);
        state = next.state;
        if (next.counted) reps += 1;
    }
    return reps;
}

describe("bend trainer logic", () => {
    it("reads fretted notes and cents", () => {
        expect(frettedMidi(3, 7)).toBe(62); // D on the G string
        expect(frettedMidi(6, 5)).toBe(45); // A on the low E string
        expect(centsAbove(440, 69)).toBeCloseTo(0);
        expect(centsAbove(440 * 2 ** (2 / 12), 69)).toBeCloseTo(200);
        expect(centsAbove(415.3, 69)).toBeLessThan(-90);
    });

    it("counts a bend held in range for the hold time, once", () => {
        const held = Array<number>(BEND_HOLD_MS / 50).fill(200);
        expect(run(held)).toBe(1);
        // Holding on does not count again without a release.
        expect(run([...held, ...held, ...held])).toBe(1);
        // Released (or silent) in between: two repetitions.
        expect(run([...held, 0, ...held])).toBe(2);
        expect(run([...held, null, ...held])).toBe(2);
    });

    it("does not count a short, flat or overshot bend", () => {
        expect(run(Array<number>(BEND_HOLD_MS / 50 - 1).fill(200))).toBe(0);
        expect(run(Array<number>(20).fill(150))).toBe(0);
        expect(run(Array<number>(20).fill(260))).toBe(0);
        // Leaving the range restarts the hold.
        expect(run([200, 200, 200, 200, 150, 200, 200, 200, 200])).toBe(0);
    });

    it("a curl counts only between the fretted note and the half step", () => {
        const curl = { minCents: 25, maxCents: 75 };
        expect(run(Array<number>(10).fill(50), curl)).toBe(1);
        expect(run(Array<number>(10).fill(100), curl)).toBe(0);
    });
});

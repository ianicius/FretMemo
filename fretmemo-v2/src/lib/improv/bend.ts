/**
 * Pure logic of the bend trainer: how far the played pitch is above the
 * fretted note (in cents) and when a held bend counts as one repetition.
 * No React, no audio — unit-tested in __tests__/bend.test.ts.
 */

/** Open strings of standard tuning as MIDI numbers, string 1 (high E) first. */
const OPEN_MIDI = [64, 59, 55, 50, 45, 40];

/** MIDI number of a fretted note; string 1 = high E … 6 = low E. */
export function frettedMidi(string: number, fret: number): number {
    return (OPEN_MIDI[string - 1] ?? 64) + fret;
}

/** Cents of `frequency` above the MIDI note (negative = below). */
export function centsAbove(frequency: number, midi: number): number {
    return 1200 * Math.log2(frequency / (440 * 2 ** ((midi - 69) / 12)));
}

/** The bend must stay in the target range this long to count. */
export const BEND_HOLD_MS = 400;
/** Below this the string counts as released (back on the fretted note). */
export const BEND_RELEASE_CENTS = 15;

export interface BendProgress {
    /** Milliseconds the pitch has stayed inside the target range. */
    heldMs: number;
    /** False after a counted repetition, until the string is released or goes silent. */
    armed: boolean;
}

export const BEND_IDLE: BendProgress = { heldMs: 0, armed: true };

/**
 * Advances the repetition state by one detector frame. `cents` is null when
 * nothing is heard. A repetition counts once per bend: the pitch has to come
 * back down (or stop) before the next one.
 */
export function stepBend(
    state: BendProgress,
    cents: number | null,
    dtMs: number,
    range: { minCents: number; maxCents: number },
): { state: BendProgress; counted: boolean } {
    if (cents === null || cents < BEND_RELEASE_CENTS) return { state: BEND_IDLE, counted: false };
    if (!state.armed) return { state, counted: false };
    if (cents < range.minCents || cents > range.maxCents) return { state: { heldMs: 0, armed: true }, counted: false };
    const heldMs = state.heldMs + dtMs;
    return heldMs >= BEND_HOLD_MS
        ? { state: { heldMs: 0, armed: false }, counted: true }
        : { state: { heldMs, armed: true }, counted: false };
}

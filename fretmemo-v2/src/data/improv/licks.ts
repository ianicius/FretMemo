import { Key, Note } from "tonal";

/**
 * Plan D2: licks — short phrases in standard tuning, shown on the fretboard
 * with their order and played back. Each lick names the scale or chord its
 * notes come from (guarded by licks.test.ts) and, when it is a target-tone
 * phrase, the chord its last note lands on.
 */

/** One note: string 1 = high E … 6 = low E, fret, length in eighths. */
export type LickNote = [string: number, fret: number, eighths: number];

export interface Lick {
    id: string;
    /** Key the frets are written in; the transposition selector starts here. */
    key: string;
    /** Notes must come from this tonal scale ("A minor pentatonic") or chord ("Am7"). */
    fits: { scale: string } | { chord: string };
    /** The last note is a tone of this chord (target-tone licks). */
    landsOn?: string;
    notes: LickNote[];
}

export const LICKS: Lick[] = [
    // Module 3: the first box of A minor pentatonic (frets 5–8).
    { id: "pent3Descent", key: "Am", fits: { scale: "A minor pentatonic" }, landsOn: "Am",
        notes: [[1, 8, 1], [1, 5, 1], [2, 8, 1], [2, 5, 1], [3, 7, 1], [3, 5, 1], [4, 7, 2]] },
    { id: "pent3Answer", key: "Am", fits: { scale: "A minor pentatonic" }, landsOn: "Am",
        notes: [[3, 5, 1], [3, 7, 1], [2, 5, 2], [2, 8, 2], [2, 5, 1], [3, 7, 1], [3, 5, 1], [4, 7, 3]] },
    { id: "pent3Blue", key: "Am", fits: { scale: "A minor blues" }, landsOn: "Am",
        notes: [[3, 5, 1], [3, 7, 1], [3, 8, 1], [3, 7, 1], [3, 5, 1], [4, 7, 3]] },
    // Module 6: G minor pentatonic across boxes 1 and 2, and along one string.
    { id: "pos6Climb", key: "Gm", fits: { scale: "G minor pentatonic" }, landsOn: "Gm",
        notes: [[4, 5, 1], [4, 8, 1], [3, 5, 1], [3, 7, 1], [2, 6, 1], [2, 8, 1], [1, 6, 1], [1, 8, 1], [2, 8, 4]] },
    { id: "pos6Slide", key: "Gm", fits: { scale: "G minor pentatonic" }, landsOn: "Gm",
        notes: [[2, 3, 1], [2, 6, 1], [2, 8, 2], [2, 6, 1], [2, 8, 1], [2, 6, 1], [2, 3, 3]] },
    // Module 11: arpeggios.
    { id: "arp11Am7", key: "Am", fits: { chord: "Am7" },
        notes: [[4, 7, 1], [3, 5, 1], [2, 5, 1], [2, 8, 1], [1, 5, 2], [2, 8, 1], [2, 5, 1], [3, 5, 1], [4, 7, 3]] },
    { id: "arp11Cmaj7", key: "C", fits: { chord: "Cmaj7" },
        notes: [[3, 5, 1], [2, 5, 1], [2, 8, 1], [1, 7, 1], [1, 8, 2], [1, 7, 1], [2, 8, 1], [2, 5, 1], [3, 5, 3]] },
    { id: "arp11TwoFiveOne", key: "C", fits: { scale: "C major" }, landsOn: "Cmaj7",
        notes: [
            [5, 5, 1], [4, 3, 1], [4, 7, 1], [3, 5, 1], // Dm7: D F A C
            [4, 5, 1], [3, 4, 1], [3, 7, 1], [2, 6, 1], // G7: G B D F
            [3, 5, 1], [2, 5, 1], [2, 8, 1], [1, 7, 5], // Cmaj7: C E G B
        ] },
    // Module 12: land on the third of the chord.
    { id: "tgt12Am", key: "Am", fits: { scale: "A minor pentatonic" }, landsOn: "Am",
        notes: [[2, 5, 1], [2, 8, 1], [2, 5, 1], [3, 7, 1], [3, 5, 4]] },
    { id: "tgt12C", key: "Am", fits: { scale: "A minor pentatonic" }, landsOn: "C",
        notes: [[3, 5, 1], [3, 7, 1], [3, 5, 1], [3, 7, 1], [2, 5, 4]] },
];

export function getLick(id: string): Lick | undefined {
    return LICKS.find((lick) => lick.id === id);
}

export const LICK_MAX_FRET = 17;

/** Open strings of standard tuning as MIDI numbers, string 1 (high E) first. */
const OPEN_MIDI = [64, 59, 55, 50, 45, 40];

export function lickNoteMidi([string, fret]: LickNote): number {
    return OPEN_MIDI[string - 1] + fret;
}

/** Note name in the given key ("Gm", "E"): sharps only in keys whose signature has sharps. */
export function lickNoteName(note: LickNote, key: string): string {
    const minor = key.endsWith("m");
    const tonic = minor ? key.slice(0, -1) : key;
    const signature = minor ? Key.minorKey(tonic).keySignature : Key.majorKey(tonic).keySignature;
    const midi = lickNoteMidi(note);
    return Note.pitchClass(signature.includes("#") ? Note.fromMidiSharps(midi) : Note.fromMidi(midi));
}

/**
 * Fret shift that moves the lick to the key with pitch class `targetPc`:
 * the smaller of the two octave choices that keeps every note on frets 0–17
 * (always possible for licks spanning at most six frets).
 */
export function lickShift(lick: Lick, originalPc: number, targetPc: number): number {
    const up = (targetPc - originalPc + 12) % 12;
    const frets = lick.notes.map(([, fret]) => fret);
    const fits = (shift: number) => Math.min(...frets) + shift >= 0 && Math.max(...frets) + shift <= LICK_MAX_FRET;
    const choices = [up, up - 12].filter(fits).sort((a, b) => Math.abs(a) - Math.abs(b));
    return choices[0] ?? up;
}

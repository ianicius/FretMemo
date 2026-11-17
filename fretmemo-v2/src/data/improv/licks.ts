import { Key, Note } from "tonal";

/**
 * Plan D2: licks — short phrases in standard tuning, shown on the fretboard
 * with their order and played back. Each lick names the scale or chord its
 * notes come from (guarded by licks.test.ts) and, when it is a target-tone
 * phrase, the chord its last note lands on.
 */

/** How a note is played, when it is not simply picked. */
export interface LickMods {
    /** Bend up by this many semitones (0.5 = a quarter-tone "curl"). */
    bend?: number;
    /** Hammer-on, pull-off or slide from the previous note; vibrato on this one. */
    tech?: "h" | "p" | "s" | "v";
    /** A second note sounding together with this one (double stop). */
    also?: [string: number, fret: number];
}

/** One note: string 1 = high E … 6 = low E, fret, length in eighths, and how it is played. */
export type LickNote = [string: number, fret: number, eighths: number, mods?: LickMods];

export interface Lick {
    id: string;
    /** Key the frets are written in; the transposition selector starts here. */
    key: string;
    /** Notes must come from this tonal scale ("A minor pentatonic"), from any of several scales, or from a chord ("Am7"). */
    fits: { scale: string | string[] } | { chord: string };
    /** "shuffle": pairs of eighths are played long–short (two thirds and one third of the beat). */
    feel?: "shuffle";
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
    // ── Blues track ──
    // Boogie riffs on the two lowest strings of the chord: root with the fifth, then with the sixth.
    { id: "bluesBoogie", key: "A", fits: { scale: "A mixolydian" }, feel: "shuffle",
        notes: [
            [5, 0, 1, { also: [4, 2] }], [5, 0, 1, { also: [4, 2] }], [5, 0, 1, { also: [4, 4] }], [5, 0, 1, { also: [4, 4] }],
            [5, 0, 1, { also: [4, 2] }], [5, 0, 1, { also: [4, 2] }], [5, 0, 1, { also: [4, 4] }], [5, 0, 1, { also: [4, 4] }],
        ] },
    { id: "bluesBoogieSeventh", key: "A", fits: { scale: "A mixolydian" }, feel: "shuffle",
        notes: [
            [5, 0, 1, { also: [4, 2] }], [5, 0, 1, { also: [4, 2] }], [5, 0, 1, { also: [4, 4] }], [5, 0, 1, { also: [4, 4] }],
            [5, 0, 1, { also: [4, 5] }], [5, 0, 1, { also: [4, 5] }], [5, 0, 1, { also: [4, 4] }], [5, 0, 1, { also: [4, 4] }],
        ] },
    // Bends in the first box of A minor pentatonic.
    { id: "bluesBendFifth", key: "A", fits: { scale: "A minor pentatonic" }, landsOn: "A7",
        notes: [[3, 7, 2, { bend: 2 }], [2, 5, 1], [2, 8, 1], [1, 5, 4, { tech: "v" }]] },
    { id: "bluesBendRoot", key: "A", fits: { scale: "A minor pentatonic" }, landsOn: "A7",
        notes: [[2, 8, 3, { bend: 2 }], [2, 8, 1], [2, 5, 1], [3, 7, 1], [3, 5, 1], [4, 7, 3, { tech: "v" }]] },
    { id: "bluesCurl", key: "A", fits: { scale: "A minor pentatonic" }, landsOn: "A7", feel: "shuffle",
        notes: [[3, 5, 2, { bend: 0.5 }], [4, 7, 2], [3, 5, 1, { bend: 0.5 }], [4, 7, 1], [4, 5, 1], [4, 7, 3]] },
    // A small vocabulary in the first box.
    { id: "bluesOpen", key: "A", fits: { scale: "A minor pentatonic" }, landsOn: "A7", feel: "shuffle",
        notes: [[3, 5, 1], [3, 7, 1, { tech: "h" }], [2, 5, 2], [3, 7, 1], [3, 5, 1], [4, 7, 4]] },
    { id: "bluesTriplet", key: "A", fits: { scale: "A minor pentatonic" }, landsOn: "A7",
        notes: [
            [1, 5, 2 / 3], [2, 8, 2 / 3], [2, 5, 2 / 3], [1, 5, 2 / 3], [2, 8, 2 / 3], [2, 5, 2 / 3],
            [1, 5, 2 / 3], [2, 8, 2 / 3], [2, 5, 2 / 3], [1, 5, 2],
        ] },
    { id: "bluesBlueNote", key: "A", fits: { scale: "A minor blues" }, landsOn: "A7", feel: "shuffle",
        notes: [[1, 8, 1], [1, 5, 1], [2, 8, 1], [2, 5, 1], [3, 7, 1], [3, 8, 1], [3, 7, 1, { tech: "p" }], [3, 5, 1], [4, 7, 4]] },
    { id: "bluesSlide", key: "A", fits: { scale: "A minor pentatonic" }, landsOn: "A7", feel: "shuffle",
        notes: [[3, 7, 1], [3, 9, 1, { tech: "s" }], [2, 8, 1], [2, 10, 2, { tech: "s" }], [1, 8, 1], [2, 10, 3, { tech: "v" }]] },
    { id: "bluesAnswer", key: "A", fits: { scale: "A minor pentatonic" }, landsOn: "A7", feel: "shuffle",
        notes: [[3, 7, 2, { bend: 2 }], [3, 5, 1], [4, 7, 1], [4, 5, 1], [4, 7, 3, { tech: "v" }]] },
    { id: "bluesLow", key: "A", fits: { scale: "A minor blues" }, landsOn: "A7", feel: "shuffle",
        notes: [[6, 5, 1], [6, 8, 1], [5, 5, 1], [5, 6, 1], [5, 7, 1], [4, 5, 1], [4, 7, 2]] },
    // The box around the root on the B string.
    { id: "bluesBoxCall", key: "A", fits: { scale: ["A mixolydian", "A minor pentatonic"] }, landsOn: "A7",
        notes: [[2, 10, 2], [1, 10, 1], [2, 12, 1, { bend: 2 }], [2, 10, 4, { tech: "v" }]] },
    { id: "bluesBoxSweet", key: "A", fits: { scale: ["A mixolydian", "A minor pentatonic"] }, landsOn: "A7",
        notes: [[3, 11, 1], [2, 10, 1], [2, 12, 2, { bend: 1 }], [2, 12, 1], [2, 10, 1], [3, 11, 1], [2, 10, 3, { tech: "v" }]] },
    // ── Triads track ──
    // A C major triad up and down on the top strings.
    { id: "triadArpC", key: "C", fits: { chord: "C" }, landsOn: "C",
        notes: [[3, 5, 1], [2, 5, 1], [1, 3, 1], [2, 8, 1], [1, 8, 2], [1, 3, 1], [2, 5, 1], [3, 5, 2]] },
    // One triad per chord of C–Am–F–G, each a step from the last, back home to C.
    { id: "triadChanges", key: "C", fits: { scale: "C major" }, landsOn: "C",
        notes: [[3, 5, 1], [2, 5, 1], [2, 8, 2], [2, 5, 1], [1, 5, 1], [1, 8, 2], [2, 6, 1], [1, 5, 1], [1, 8, 2], [2, 8, 1], [1, 7, 1], [1, 10, 2], [1, 8, 4]] },
    // Triad pair F + G over Am: up through both triads, and the same notes coming down.
    { id: "pairFG", key: "Am", fits: { scale: "C major" }, landsOn: "Am",
        notes: [[3, 10, 1], [2, 10, 1], [1, 8, 1], [3, 12, 1], [2, 12, 1], [1, 10, 1], [2, 10, 2]] },
    { id: "pairFGDown", key: "Am", fits: { scale: "C major" }, landsOn: "Am",
        notes: [[1, 10, 1], [1, 8, 1], [2, 12, 1], [2, 10, 1], [3, 12, 1], [3, 10, 1], [3, 14, 2]] },
    // Turnarounds: a chromatic line into the V chord.
    { id: "bluesTurnDown", key: "A", fits: { scale: "A chromatic" }, landsOn: "E7", feel: "shuffle",
        notes: [[4, 5, 1], [1, 5, 1], [4, 4, 1], [1, 5, 1], [4, 3, 1], [1, 5, 1], [4, 2, 2]] },
    { id: "bluesTurnUp", key: "A", fits: { scale: "A chromatic" }, landsOn: "E7", feel: "shuffle",
        notes: [[6, 5, 2], [5, 4, 1], [5, 5, 1], [5, 6, 1], [5, 7, 3]] },
];

export function getLick(id: string): Lick | undefined {
    return LICKS.find((lick) => lick.id === id);
}

export const LICK_MAX_FRET = 17;

/** Open strings of standard tuning as MIDI numbers, string 1 (high E) first. */
const OPEN_MIDI = [64, 59, 55, 50, 45, 40];

export function lickNoteMidi([string, fret]: LickNote | [number, number]): number {
    return OPEN_MIDI[string - 1] + fret;
}

/** The pitch a note sounds at: a bend of whole semitones reaches the bent note (a curl stays on the fretted one). */
export function lickSoundingMidi(note: LickNote): number {
    return lickNoteMidi(note) + Math.floor(note[3]?.bend ?? 0);
}

/** Short mark of how a note is played, shown next to it ("½" curl, "↑1" whole-step bend, "h", "~"). */
export function lickTechMark(mods: LickMods | undefined): string {
    if (!mods) return "";
    if (mods.bend === 0.5) return "¼↑";
    if (mods.bend) return mods.bend === 1 ? "½↑" : "1↑";
    return mods.tech === "v" ? "~" : mods.tech ?? "";
}

/** Order numbers of one position as a short label: runs are joined ("1–8", "1–2·5–6"). */
export function lickOrderLabel(indexes: number[]): string {
    const runs: Array<[number, number]> = [];
    for (const index of indexes) {
        const last = runs[runs.length - 1];
        if (last && index === last[1] + 1) last[1] = index;
        else runs.push([index, index]);
    }
    return runs.map(([from, to]) => (from === to ? `${from + 1}` : `${from + 1}–${to + 1}`)).join("·");
}

/**
 * Start of a note in beats, from its start in eighths. Straight: two eighths
 * per beat. Shuffle: the first eighth of each beat takes two thirds of it.
 */
export function lickBeat(eighths: number, feel?: "shuffle"): number {
    if (feel !== "shuffle") return eighths / 2;
    const beat = Math.floor(eighths / 2 + 1e-9);
    const within = eighths - beat * 2;
    return beat + (within <= 1 ? within * (2 / 3) : 2 / 3 + (within - 1) / 3);
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
    const frets = lick.notes.flatMap(([, fret, , mods]) => (mods?.also ? [fret, mods.also[1]] : [fret]));
    const fits = (shift: number) => Math.min(...frets) + shift >= 0 && Math.max(...frets) + shift <= LICK_MAX_FRET;
    const choices = [up, up - 12].filter(fits).sort((a, b) => Math.abs(a) - Math.abs(b));
    return choices[0] ?? up;
}

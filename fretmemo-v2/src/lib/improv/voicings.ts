/**
 * Chord voicings on a set of strings and voice leading between them.
 * Pure functions shared by the triad visualizer, the voicing drill and the
 * backing loop. By default a voicing is closed (each string holds the next
 * chord tone up); `orders` give any other layout — drop 2, drop 3, shells,
 * guide tones — as the chord tone on each string from the lowest.
 *
 * String indices follow the app convention: 0 = high E … 5 = low E. A string
 * set is listed from the lowest-sounding string to the highest ([2, 1, 0] =
 * G, B, high E).
 */

import { Note } from "tonal";
import { STANDARD_TUNING, getNoteAt } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";
import { getChordInfo } from "./chords";

export const STRING_SETS = {
    top: [2, 1, 0],
    middle: [3, 2, 1],
    lowMiddle: [4, 3, 2],
    low: [5, 4, 3],
} as const;

export interface ChordShape {
    rootPc: number;
    /** Semitones above the root, ascending, starting with 0. */
    intervals: number[];
}

export interface Voicing {
    /** The string set, lowest-sounding string first. */
    strings: number[];
    /** Fret on each string of the set, same order. */
    frets: number[];
    /** Index into the chord's intervals for each string, same order. */
    tones: number[];
    /** 0 = root position, 1 = first inversion …: the tone in the bass. */
    inversion: number;
}

const pcOf = (note: string) => Note.chroma(note) ?? 0;

/** Root pitch class and intervals of a chord symbol ("Bdim" → 11, [0, 3, 6]); null when unknown. */
export function chordShape(symbol: string): ChordShape | null {
    const info = getChordInfo(symbol);
    if (!info) return null;
    const rootPc = pcOf(info.root);
    const intervals = [...new Set(info.tones.map((tone) => (pcOf(tone) - rootPc + 12) % 12))].sort((a, b) => a - b);
    return { rootPc, intervals };
}

/** Degree label of a semitone interval above the root. */
const DEGREE_LABELS: Record<number, string> = { 0: "1", 2: "2", 3: "b3", 4: "3", 5: "4", 6: "b5", 7: "5", 8: "#5", 9: "6", 10: "b7", 11: "7" };

export function degreeLabel(shape: ChordShape, tone: number): string {
    return DEGREE_LABELS[shape.intervals[tone] ?? 0] ?? "?";
}

export interface VoicingOptions {
    maxFret?: number;
    /** Widest stretch between the lowest and highest fret of a voicing. */
    maxSpan?: number;
    /**
     * Chord tone (index into the intervals: 0 = root, 1 = third …) on each
     * string, lowest string first; one list per voicing type or inversion.
     * Omitted = the closed inversions of a chord with one tone per string.
     */
    orders?: number[][];
}

/** A string set together with the voicing orders played on it. */
export interface VoicingLayout {
    strings: number[];
    orders?: number[][];
}

/** Closed inversions of a four-note chord, lowest string first. */
const CLOSED4 = [0, 1, 2, 3].map((start) => [0, 1, 2, 3].map((step) => (start + step) % 4));

/** Drop 2: the second voice from the top of each closed inversion goes down an octave. */
export const DROP2_ORDERS = CLOSED4.map(([a, b, c, d]) => [c, a, b, d] as number[]);
/** Drop 3: the third voice from the top goes down an octave (for string sets with a gap). */
export const DROP3_ORDERS = CLOSED4.map(([a, b, c, d]) => [b, a, c, d] as number[]);
/** Shell voicings: root, seventh, third and root, third, seventh (no fifth). */
export const SHELL_ROOT_7_3 = [[0, 3, 1]];
export const SHELL_ROOT_3_7 = [[0, 1, 3]];
/** Guide tones: third and seventh, either one on top. */
export const GUIDE_TONE_ORDERS = [[1, 3], [3, 1]];

/**
 * Every closed-position voicing of the chord on the string set: each string
 * holds the next chord tone up, starting from the bass tone of the inversion.
 * Sorted up the neck (lowest fret first). Empty when the chord has a
 * different number of tones than the set has strings.
 */
export function chordVoicings(
    shape: ChordShape,
    strings: readonly number[],
    tuning: readonly NoteName[],
    { maxFret = 15, maxSpan = 4, orders }: VoicingOptions = {},
): Voicing[] {
    const size = shape.intervals.length;
    if (strings.some((string) => string >= tuning.length)) return [];
    const closed = strings.length === size ? strings.map((_, inversion) => strings.map((__, index) => (inversion + index) % size)) : [];
    const layouts = (orders ?? closed).filter((order) => order.length === strings.length && order.every((tone) => tone < size));
    const voicings: Voicing[] = [];
    const seen = new Set<string>();
    for (const tones of layouts) {
        const baseFrets = strings.map((string, index) =>
            (shape.rootPc + (shape.intervals[tones[index] as number] ?? 0) - pcOf(tuning[string] as string) + 24) % 12);
        // Each string can sit in either octave of the board; keep the playable combinations.
        for (let mask = 0; mask < 2 ** strings.length; mask += 1) {
            const frets = baseFrets.map((fret, index) => fret + ((mask >> index) & 1) * 12);
            if (frets.some((fret) => fret > maxFret)) continue;
            if (Math.max(...frets) - Math.min(...frets) > maxSpan) continue;
            // The voices must rise from the lowest string, or the layout is not the one asked for.
            const midis = frets.map((fret, index) => openStringMidi(tuning, strings[index] as number) + fret);
            if (midis.some((midi, index) => index > 0 && midi <= (midis[index - 1] as number))) continue;
            const key = frets.join(",");
            if (seen.has(key)) continue;
            seen.add(key);
            voicings.push({ strings: [...strings], frets, tones: [...tones], inversion: tones[0] as number });
        }
    }
    return voicings.sort((a, b) => Math.min(...a.frets) - Math.min(...b.frets) || a.inversion - b.inversion);
}

const averageFret = (voicing: Voicing) => voicing.frets.reduce((sum, fret) => sum + fret, 0) / voicing.frets.length;

/**
 * Movement of every voice from one voicing to the next in semitones, lowest
 * voice first (0 = the note stays). On one string set it equals the fret move.
 */
export function voicingMoves(from: Voicing, to: Voicing, tuning: readonly NoteName[]): number[] {
    const target = voicingMidis(to, tuning);
    return voicingMidis(from, tuning).map((midi, index) => (target[index] ?? midi) - midi);
}

/**
 * Fret movement of the hand per voice: on the same strings, each string's own
 * move; on other strings (a shell with the root on the other bass string),
 * how far the whole hand shifts, since the bass leaps a fourth either way.
 */
function handMoves(from: Voicing, to: Voicing): number[] {
    const sameStrings = from.strings.every((string, index) => to.strings[index] === string);
    if (sameStrings) return from.frets.map((fret, index) => Math.abs((to.frets[index] ?? fret) - fret));
    const shift = Math.abs(averageFret(to) - averageFret(from));
    return to.frets.map(() => shift);
}

/** The candidate closest to `from`: least total hand movement, then smallest single move, then lower on the neck. */
export function nearestVoicing(from: Voicing, candidates: Voicing[]): Voicing | undefined {
    const score = (candidate: Voicing) => {
        const moves = handMoves(from, candidate);
        return [moves.reduce((sum, move) => sum + move, 0), Math.max(...moves), averageFret(candidate)];
    };
    return candidates.filter((candidate) => candidate.frets.length === from.frets.length).sort((a, b) => {
        const [sa, sb] = [score(a), score(b)];
        return (sa[0] as number) - (sb[0] as number) || (sa[1] as number) - (sb[1] as number) || (sa[2] as number) - (sb[2] as number);
    })[0];
}

/**
 * Voice-led path through a progression on one string set: the first chord
 * sits closest to `startFret`, every next chord takes the voicing nearest to
 * the previous one. `layouts` add other string sets to choose from (shells
 * with the root on the sixth or the fifth string). Chords without a voicing
 * are left out of the path (the result is then shorter than `shapes`).
 */
export function voiceLeadPath(
    shapes: ChordShape[],
    strings: readonly number[],
    tuning: readonly NoteName[],
    { startFret = 5, layouts = [], ...options }: VoicingOptions & { startFret?: number; layouts?: VoicingLayout[] } = {},
): Voicing[] {
    const path: Voicing[] = [];
    for (const shape of shapes) {
        const candidates = [
            ...chordVoicings(shape, strings, tuning, options),
            ...layouts.flatMap((layout) => chordVoicings(shape, layout.strings, tuning, { ...options, orders: layout.orders })),
        ];
        const previous = path[path.length - 1];
        const next = previous
            ? nearestVoicing(previous, candidates)
            : [...candidates].sort((a, b) => Math.abs(averageFret(a) - startFret) - Math.abs(averageFret(b) - startFret) || averageFret(a) - averageFret(b))[0];
        if (next) path.push(next);
    }
    return path;
}

/** Open-string MIDI numbers of standard tuning, string 0 (high E) first. */
const STANDARD_OPEN_MIDI = [64, 59, 55, 50, 45, 40];

/** MIDI number of an open string: the standard octave, moved to the tuning's note (drop D → 38). */
export function openStringMidi(tuning: readonly NoteName[], string: number): number {
    const base = STANDARD_OPEN_MIDI[string] ?? 40 - 5 * (string - 5);
    let shift = (pcOf(tuning[string] ?? "E") - pcOf(STANDARD_TUNING[string] ?? "E") + 12) % 12;
    if (shift > 6) shift -= 12;
    return base + shift;
}

export function voicingMidis(voicing: Voicing, tuning: readonly NoteName[]): number[] {
    return voicing.frets.map((fret, index) => openStringMidi(tuning, voicing.strings[index] as number) + fret);
}

/** Note on the highest string of a voicing (the melody of a voice-led path). */
export function topVoiceNote(voicing: Voicing, tuning: readonly NoteName[]): NoteName {
    const last = voicing.strings.length - 1;
    return getNoteAt(tuning[voicing.strings[last] as number] as NoteName, voicing.frets[last] as number);
}

/**
 * Microphone targets that follow the top voice of a voice-led path: for each
 * chord symbol, the top notes it gets anywhere in the path.
 */
export function topVoiceTargets(chords: readonly string[], path: Voicing[], tuning: readonly NoteName[]): Array<{ chord: string; pitchClasses: string[] }> {
    const byChord = new Map<string, Set<string>>();
    chords.forEach((chord, index) => {
        const voicing = path[index];
        if (!voicing) return;
        byChord.set(chord, (byChord.get(chord) ?? new Set()).add(topVoiceNote(voicing, tuning)));
    });
    return [...byChord].map(([chord, notes]) => ({ chord, pitchClasses: [...notes] }));
}

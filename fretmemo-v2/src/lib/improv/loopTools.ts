/**
 * Pure helpers for the E4 backing loop (improvement plan stage B):
 * transposition to another key (B2), the per-chord mic report after a loop
 * (B3) and the optional tempo ramp (B5). No React, no audio — unit-tested in
 * src/lib/improv/__tests__/loopTools.test.ts.
 */

import { Chord, Interval, Note } from "tonal";
import type { ChordMicTargets, ProgressionEntry } from "@/data/improv/curriculum";

/* ─────────── B2: transposition ─────────── */

const ROOT = /^([A-G][#b]?)(.*)$/;

/** Key-selector tonics by pitch class (common spellings for major and minor keys). */
const MAJOR_TONICS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_TONICS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

/** Transposes a note name by a tonal interval ("4P", "2m" …); double accidentals and E#/Cb get simplified. */
export function transposeNote(note: string, interval: string): string {
    if (interval === "1P") return note;
    const moved = Note.transpose(note, interval);
    return moved ? Note.simplify(moved) || moved : note;
}

/** Transposes the root of a chord symbol, keeping its suffix ("Dm7" + "4P" → "Gm7"). */
export function transposeChord(symbol: string, interval: string): string {
    const match = ROOT.exec(symbol);
    if (!match) return symbol;
    return `${transposeNote(match[1] as string, interval)}${match[2] ?? ""}`;
}

export function transposeProgression(
    progression: Array<string | ProgressionEntry>,
    interval: string,
): Array<string | ProgressionEntry> {
    return progression.map((entry) =>
        typeof entry === "string"
            ? transposeChord(entry, interval)
            : { ...entry, chord: transposeChord(entry.chord, interval) });
}

/** Mic targets follow the chords: the same interval on chord symbols and pitch classes. */
export function transposeTargets(
    targets: ChordMicTargets[] | undefined,
    interval: string,
): ChordMicTargets[] | undefined {
    return targets?.map((target) => ({
        chord: transposeChord(target.chord, interval),
        pitchClasses: target.pitchClasses.map((pitchClass) => transposeNote(pitchClass, interval)),
    }));
}

/** The loop's key: explicit, or the first chord's root (+ "m" when that chord is minor). */
export function loopKey(explicitKey: string | undefined, firstChord: string): string {
    if (explicitKey) return explicitKey;
    const chord = Chord.get(firstChord.replace("(maj7)", "Maj7"));
    const root = ROOT.exec(firstChord)?.[1] ?? "C";
    return `${chord.tonic || root}${chord.quality === "Minor" ? "m" : ""}`;
}

function splitKey(key: string): { tonic: string; minor: boolean } {
    const match = ROOT.exec(key);
    return { tonic: match?.[1] ?? "C", minor: (match?.[2] ?? "") === "m" };
}

/** The 12 keys offered by the selector, in the mode of `key` ("Am" → "Cm", "C#m" …). */
export function keyChoices(key: string): string[] {
    const { minor } = splitKey(key);
    return (minor ? MINOR_TONICS : MAJOR_TONICS).map((tonic) => `${tonic}${minor ? "m" : ""}`);
}

/** Pitch class of a key's tonic (selector value). */
export function keyPitchClass(key: string): number {
    return Note.chroma(splitKey(key).tonic) ?? 0;
}

/** Interval that moves `fromKey` to `toKey` (spelled from tonic to tonic; "1P" when equal). */
export function keyShiftInterval(fromKey: string, toKey: string): string {
    const from = splitKey(fromKey).tonic;
    const to = splitKey(toKey).tonic;
    if (Note.chroma(from) === Note.chroma(to)) return "1P";
    return Interval.distance(from, to);
}

/* ─────────── B3: per-chord report ─────────── */

export interface ChordHitResult {
    chord: string;
    hit: boolean;
}

/** One row per progression entry (in order): was its first-beat target hit in this loop? */
export function loopChordReport(chords: readonly string[], hits: readonly boolean[]): ChordHitResult[] {
    return chords.map((chord, index) => ({ chord, hit: Boolean(hits[index]) }));
}

/* ─────────── B5: tempo ramp ─────────── */

export const RAMP_STEP_BPM = 5;
export const RAMP_EVERY_PASSES = 2;

/**
 * Tempo after the `passCount`-th successful loop of the session: +5 BPM on
 * every second pass, never above `maxBpm`.
 */
export function rampBpmAfterPass(bpm: number, passCount: number, maxBpm: number): number {
    if (passCount <= 0 || passCount % RAMP_EVERY_PASSES !== 0) return Math.min(bpm, maxBpm);
    return Math.min(maxBpm, bpm + RAMP_STEP_BPM);
}

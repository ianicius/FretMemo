/**
 * Chord voice data for the E4 backing-loop engine (run improv-training-2026-11-13).
 *
 * Pure tonal-based helpers: chord symbol → pitch classes / ascending MIDI
 * notes. The backing loop plays them as block chords (tones staggered by a
 * few dozen ms) through `playTone` in src/lib/audio.ts.
 */

import { Chord, Interval, Note } from "tonal";
import { getNoteAt } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";

export interface ImprovChordInfo {
    /** Normalized symbol as parsed by tonal (e.g. "G#m7"). */
    symbol: string;
    root: string;
    /** Chord tones as tonal note names, ascending from the root. */
    tones: string[];
}

/** tonal chord; it reads "mMaj7" but not the "m(maj7)" spelling used in the curriculum texts. */
function tonalChord(chordName: string) {
    return Chord.get(chordName.replace("(maj7)", "Maj7"));
}

/** Parses a chord symbol; returns null for unknown input (never throws). */
export function getChordInfo(chordName: string): ImprovChordInfo | null {
    const chord = tonalChord(chordName);
    if (!chord || typeof chord.tonic !== "string" || chord.notes.length === 0) {
        return null;
    }
    return { symbol: chordName, root: chord.tonic, tones: [...chord.notes] };
}

/**
 * Ascending MIDI notes for the chord: root placed in the octave starting at
 * `baseMidi` (default C3 = 48), remaining tones stacked within the next
 * octave. Falls back to the root alone when the symbol cannot be parsed.
 */
export function getChordMidis(chordName: string, baseMidi = 48): number[] {
    const info = getChordInfo(chordName);
    if (!info) return [baseMidi];
    const rootPc = Note.chroma(info.root) ?? 0;
    let rootMidi = baseMidi + rootPc;
    if (rootMidi >= baseMidi + 12) rootMidi -= 12;
    return info.tones.map((tone) => {
        const pc = Note.chroma(tone) ?? 0;
        const offset = (pc - rootPc + 12) % 12;
        return rootMidi + offset;
    });
}

/** Pitch classes (chroma) of the chord tones — for target-tone highlights. */
export function getChordPitchClasses(chordName: string): number[] {
    const info = getChordInfo(chordName);
    if (!info) return [];
    return info.tones.map((tone) => Note.chroma(tone) ?? 0);
}

/** MIDI number for a tonic placed in the octave starting at `baseMidi`. */
export function tonicMidi(key: string, baseMidi = 48): number {
    // Chord symbols like "Ammaj7" carry a suffix that Note.chroma cannot
    // parse — extract the root (letter + optional accidental) first.
    const root = key.match(/^[A-G][#b]?/)?.[0] ?? key;
    const pc = Note.chroma(root) ?? 0;
    return baseMidi + pc;
}

/** Degree label of a tonal interval name: "3m" → "b3", "5A" → "#5", "11A" → "#11". */
function degreeLabel(interval: string): string {
    const info = Interval.get(interval);
    if (info.empty) return interval;
    const accidental = info.alt < 0 ? "b".repeat(-info.alt) : "#".repeat(info.alt);
    return `${accidental}${info.num}`;
}

export interface ChordTonePosition {
    stringIndex: number;
    fret: number;
    note: NoteName;
    /** Chord degree of the note (1, b3, 5, b7 …). */
    label: string;
    isRoot: boolean;
    /** The note's pitch class is one of the loop's mic targets for this chord. */
    isTarget: boolean;
}

/**
 * Plan B1: every fretboard position in [fretFrom, fretTo] holding a tone of
 * the chord, labelled with its degree; `targets` (pitch-class names, e.g.
 * the mic targets) mark the positions to emphasize. Unknown chord → [].
 */
export function getChordTonePositions(
    chordName: string,
    options: { tuning: readonly NoteName[]; fretFrom: number; fretTo: number; targets?: readonly string[] },
): ChordTonePosition[] {
    const chord = tonalChord(chordName);
    if (!chord || typeof chord.tonic !== "string" || chord.notes.length === 0) return [];
    const rootPc = Note.chroma(chord.tonic) ?? 0;
    const labelByPc = new Map<number, string>();
    for (const interval of chord.intervals) {
        const pc = (rootPc + (Interval.get(interval).chroma ?? 0)) % 12;
        if (!labelByPc.has(pc)) labelByPc.set(pc, degreeLabel(interval));
    }
    const targetPcs = new Set((options.targets ?? []).map((name) => Note.chroma(name)));
    const positions: ChordTonePosition[] = [];
    options.tuning.forEach((openNote, stringIndex) => {
        for (let fret = Math.max(0, options.fretFrom); fret <= options.fretTo; fret += 1) {
            const note = getNoteAt(openNote, fret);
            const pc = Note.chroma(note) ?? -1;
            const label = labelByPc.get(pc);
            if (label === undefined) continue;
            positions.push({ stringIndex, fret, note, label, isRoot: pc === rootPc, isTarget: targetPcs.has(pc) });
        }
    });
    return positions;
}

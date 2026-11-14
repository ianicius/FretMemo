/**
 * Chord voice data for the E4 backing-loop engine (run improv-training-2026-11-13).
 *
 * Pure tonal-based helpers: chord symbol → pitch classes / ascending MIDI
 * notes. The backing loop plays them as block chords (tones staggered by a
 * few dozen ms) through `playTone` in src/lib/audio.ts.
 */

import { Chord, Note } from "tonal";

export interface ImprovChordInfo {
    /** Normalized symbol as parsed by tonal (e.g. "G#m7"). */
    symbol: string;
    root: string;
    /** Chord tones as tonal note names, ascending from the root. */
    tones: string[];
}

/** Parses a chord symbol; returns null for unknown input (never throws). */
export function getChordInfo(chordName: string): ImprovChordInfo | null {
    // tonal reads "mMaj7" but not the "m(maj7)" spelling used in the curriculum texts.
    const chord = Chord.get(chordName.replace("(maj7)", "Maj7"));
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

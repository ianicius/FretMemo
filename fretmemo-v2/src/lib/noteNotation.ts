import { Note } from "tonal";
import { NOTES } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";

export type NoteDisplayMode = "sharps" | "flats";

const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

function normalizePitchClassIndex(index: number): number {
    return ((index % 12) + 12) % 12;
}

function resolvePitchClassIndex(input: string | number): number | null {
    if (typeof input === "number") return normalizePitchClassIndex(input);
    const chroma = Note.chroma(input);
    return typeof chroma === "number" ? chroma : null;
}

export function getPitchClassIndex(note: string | null | undefined): number | null {
    if (!note) return null;
    const chroma = Note.chroma(note);
    return typeof chroma === "number" ? chroma : null;
}

export function pitchClassIndexFromMidi(midi: number): number {
    return normalizePitchClassIndex(midi);
}

export function areEnharmonic(
    left: string | number | null | undefined,
    right: string | number | null | undefined,
): boolean {
    if (left === null || left === undefined || right === null || right === undefined) return false;
    const leftIndex = resolvePitchClassIndex(left);
    const rightIndex = resolvePitchClassIndex(right);
    if (leftIndex === null || rightIndex === null) return false;
    return leftIndex === rightIndex;
}

export function toSharpPitchClass(input: string | number): NoteName | null {
    const pitchClassIndex = resolvePitchClassIndex(input);
    if (pitchClassIndex === null) return null;
    return NOTES[pitchClassIndex];
}

export function formatPitchClass(input: string | number, notation: NoteDisplayMode = "sharps"): string {
    const pitchClassIndex = resolvePitchClassIndex(input);
    if (pitchClassIndex === null) return typeof input === "string" ? input : "";
    if (notation === "flats") return FLAT_NOTES[pitchClassIndex];
    return NOTES[pitchClassIndex];
}

export function formatPitchClassWithEnharmonic(input: string | number, notation: NoteDisplayMode = "sharps"): string {
    const pitchClassIndex = resolvePitchClassIndex(input);
    if (pitchClassIndex === null) return typeof input === "string" ? input : "";

    const primary = notation === "flats" ? FLAT_NOTES[pitchClassIndex] : NOTES[pitchClassIndex];
    const alternate = notation === "flats" ? NOTES[pitchClassIndex] : FLAT_NOTES[pitchClassIndex];
    if (primary === alternate) return primary;
    return `${primary} (${alternate})`;
}

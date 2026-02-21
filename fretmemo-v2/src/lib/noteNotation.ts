import { Note } from "tonal";
import { NOTES } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";

import i18n from "@/lib/i18n";

export type NoteDisplayMode = "sharps" | "flats" | "random";
export type ResolvedNoteDisplayMode = "sharps" | "flats";
export type AccidentalComplexity = "standard" | "advanced";

const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const RANDOM_SESSION_SEED = `session:${Math.floor(Math.random() * 1_000_000_000)}`;
const ADVANCED_SHARP_NOTES = [
    ["C", "Dbb"],
    ["C#", "B##"],
    ["D", "C##", "Ebb"],
    ["D#", "Fbb"],
    ["E", "D##"],
    ["F", "Gbb"],
    ["F#", "E##"],
    ["G", "F##", "Abb"],
    ["G#"],
    ["A", "G##", "Bbb"],
    ["A#", "Cbb"],
    ["B", "A##"],
] as const;
const ADVANCED_FLAT_NOTES = [
    ["C", "Dbb"],
    ["Db", "B##"],
    ["D", "Ebb", "C##"],
    ["Eb", "Fbb"],
    ["E", "D##"],
    ["F", "Gbb"],
    ["Gb", "E##"],
    ["G", "Abb", "F##"],
    ["Ab"],
    ["A", "Bbb", "G##"],
    ["Bb", "Cbb"],
    ["B", "A##"],
] as const;

export function applyPolishNotation(noteStr: string): string {
    // Basic replacements for full matching or starting with B/Bb (like B4, Bbm, etc.)
    // Note: Bbm -> Bm in Polish since Bb is B and B is H.
    // Bbmaj -> Bmaj
    // Bmaj -> Hmaj

    if (noteStr === "Bb") return "B";
    if (noteStr === "B") return "H";

    if (noteStr.startsWith("Bb")) {
        return "B" + noteStr.slice(2);
    }
    if (noteStr.startsWith("B")) {
        return "H" + noteStr.slice(1);
    }
    return noteStr;
}

function normalizePitchClassIndex(index: number): number {
    return ((index % 12) + 12) % 12;
}

function resolvePitchClassIndex(input: string | number): number | null {
    if (typeof input === "number") return normalizePitchClassIndex(input);
    const chroma = Note.chroma(input);
    return typeof chroma === "number" ? chroma : null;
}

function hashSeed(seed: string): number {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }
    return hash;
}

function resolveRandomSeed(seed: string | number | undefined): string {
    if (seed !== undefined) return String(seed);
    return RANDOM_SESSION_SEED;
}

function pickDeterministically(candidates: readonly string[], seed: string, salt: string): string {
    if (candidates.length <= 1) return candidates[0] ?? "";
    const hash = hashSeed(`${seed}:${salt}`);
    return candidates[hash % candidates.length];
}

function getPitchClassCandidates(
    pitchClassIndex: number,
    notation: ResolvedNoteDisplayMode,
    accidentalComplexity: AccidentalComplexity,
): readonly string[] {
    const safeIndex = normalizePitchClassIndex(pitchClassIndex);
    if (accidentalComplexity === "advanced") {
        const advanced = notation === "flats"
            ? ADVANCED_FLAT_NOTES[safeIndex]
            : ADVANCED_SHARP_NOTES[safeIndex];
        if (advanced) return advanced;
    }
    return [notation === "flats" ? FLAT_NOTES[safeIndex] : NOTES[safeIndex]];
}

function getPitchClassLabel(
    pitchClassIndex: number,
    notation: ResolvedNoteDisplayMode,
    seed: string,
    accidentalComplexity: AccidentalComplexity,
): string {
    const candidates = getPitchClassCandidates(pitchClassIndex, notation, accidentalComplexity);
    return pickDeterministically(candidates, seed, `pc:${pitchClassIndex}:${notation}:${accidentalComplexity}`);
}

export function resolveNoteDisplayMode(
    notation: NoteDisplayMode = "sharps",
    seed?: string | number,
): ResolvedNoteDisplayMode {
    if (notation !== "random") return notation;
    const effectiveSeed = seed === undefined ? RANDOM_SESSION_SEED : String(seed);
    return hashSeed(effectiveSeed) % 2 === 0 ? "sharps" : "flats";
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

export function formatPitchClass(
    input: string | number,
    notation: NoteDisplayMode = "sharps",
    seed?: string | number,
    accidentalComplexity: AccidentalComplexity = "standard",
): string {
    const resolvedSeed = resolveRandomSeed(seed);
    const pitchClassIndex = resolvePitchClassIndex(input);
    const resolvedNotation = resolveNoteDisplayMode(notation, resolvedSeed);
    let result = "";
    if (pitchClassIndex === null) {
        result = typeof input === "string" ? input : "";
    } else {
        result = getPitchClassLabel(pitchClassIndex, resolvedNotation, resolvedSeed, accidentalComplexity);
    }

    if (i18n.resolvedLanguage === 'pl' || i18n.language === 'pl') {
        return applyPolishNotation(result);
    }
    return result;
}

export function formatPitchClassWithEnharmonic(
    input: string | number,
    notation: NoteDisplayMode = "sharps",
    seed?: string | number,
    accidentalComplexity: AccidentalComplexity = "standard",
): string {
    const resolvedSeed = resolveRandomSeed(seed);
    const pitchClassIndex = resolvePitchClassIndex(input);
    const resolvedNotation = resolveNoteDisplayMode(notation, resolvedSeed);
    if (pitchClassIndex === null) {
        const str = typeof input === "string" ? input : "";
        if (i18n.resolvedLanguage === 'pl' || i18n.language === 'pl') {
            return applyPolishNotation(str);
        }
        return str;
    }

    const alternateNotation: ResolvedNoteDisplayMode = resolvedNotation === "flats" ? "sharps" : "flats";
    let primary = getPitchClassLabel(pitchClassIndex, resolvedNotation, resolvedSeed, accidentalComplexity);
    let alternate = getPitchClassLabel(pitchClassIndex, alternateNotation, resolvedSeed, "standard");

    if (i18n.resolvedLanguage === 'pl' || i18n.language === 'pl') {
        primary = applyPolishNotation(primary);
        alternate = applyPolishNotation(alternate);
    }

    if (primary === alternate) return primary;
    return `${primary} (${alternate})`;
}

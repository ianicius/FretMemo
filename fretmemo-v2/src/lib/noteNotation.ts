import { Note } from "tonal";
import { NOTES } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";

import i18n from "@/lib/i18n";

export type NoteDisplayMode = "sharps" | "flats" | "random";
export type ResolvedNoteDisplayMode = "sharps" | "flats";

const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const RANDOM_SESSION_SEED = `session:${Math.floor(Math.random() * 1_000_000_000)}`;

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
): string {
    const pitchClassIndex = resolvePitchClassIndex(input);
    const resolvedNotation = resolveNoteDisplayMode(notation, resolveRandomSeed(seed));
    let result = "";
    if (pitchClassIndex === null) {
        result = typeof input === "string" ? input : "";
    } else {
        result = resolvedNotation === "flats" ? FLAT_NOTES[pitchClassIndex] : NOTES[pitchClassIndex];
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
): string {
    const pitchClassIndex = resolvePitchClassIndex(input);
    const resolvedNotation = resolveNoteDisplayMode(notation, resolveRandomSeed(seed));
    if (pitchClassIndex === null) {
        const str = typeof input === "string" ? input : "";
        if (i18n.resolvedLanguage === 'pl' || i18n.language === 'pl') {
            return applyPolishNotation(str);
        }
        return str;
    }

    let primary: string = resolvedNotation === "flats" ? FLAT_NOTES[pitchClassIndex] : NOTES[pitchClassIndex];
    let alternate: string = resolvedNotation === "flats" ? NOTES[pitchClassIndex] : FLAT_NOTES[pitchClassIndex];

    if (i18n.resolvedLanguage === 'pl' || i18n.language === 'pl') {
        primary = applyPolishNotation(primary);
        alternate = applyPolishNotation(alternate);
    }

    if (primary === alternate) return primary;
    return `${primary} (${alternate})`;
}

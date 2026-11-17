/**
 * Quiz generators for triad inversions and voice leading between triads.
 * Registered in questions.ts like every other generator, so any track can use them.
 */

import { Chord, Key, Note } from "tonal";
import type { ChoiceQuestion, Rng } from "./questions";

const TRIADS = ["C", "G", "D", "A", "E", "F", "Bb", "Eb", "Am", "Em", "Dm", "Bm", "F#m", "Cm", "Gm"];
const KEYS = ["C", "G", "F", "D", "Bb", "A"];

export const INVERSION_KEYS = [
    "improv.q.triadInversion.root",
    "improv.q.triadInversion.first",
    "improv.q.triadInversion.second",
] as const;

const notesOf = (chord: string) => Chord.get(chord).notes;
const chroma = (note: string) => Note.chroma(note) ?? 0;

function options(correct: string, distractors: string[], rng: Rng): { options: string[]; correctIndex: number } {
    const unique = [...new Set([correct, ...distractors])].slice(0, 4);
    const shuffled = rng.shuffle(unique);
    return { options: shuffled, correctIndex: shuffled.indexOf(correct) };
}

/** The triad's notes from the bass up in the given inversion: (C, 1) → E G C. */
export function invert(notes: string[], inversion: number): string[] {
    return [...notes.slice(inversion), ...notes.slice(0, inversion)];
}

/** Same root, other quality: C → Cm, Am → A. */
const parallel = (chord: string) => (chord.endsWith("m") ? chord.slice(0, -1) : `${chord}m`);

export function generateTriadInversion(rng: Rng, direction: string): ChoiceQuestion {
    const chord = rng.pick(TRIADS);
    const notes = notesOf(chord);
    const inversion = rng.int(3);
    const voiced = invert(notes, inversion);
    const hint = { hintKey: "improv.q.triadInversion.hintVoiced", hintValues: { chord, notes: voiced.join("-") } };
    if (direction === "inversion-to-bass") {
        const wrong = Note.simplify(Note.transpose(notes[0] as string, "2M"));
        return {
            id: "triadInversion",
            promptKey: "improv.q.triadInversion.inversionToBass",
            promptValues: { chord, type: INVERSION_KEYS[inversion] as string },
            ...options(voiced[0] as string, [...notes, wrong], rng),
            ...hint,
        };
    }
    if (direction === "inversion-notes") {
        const others = [1, 2].map((offset) => invert(notes, (inversion + offset) % 3).join(" "));
        return {
            id: "triadInversion",
            promptKey: "improv.q.triadInversion.inversionNotes",
            promptValues: { chord, type: INVERSION_KEYS[inversion] as string },
            ...options(voiced.join(" "), [...others, invert(notesOf(parallel(chord)), inversion).join(" ")], rng),
            ...hint,
        };
    }
    return {
        id: "triadInversion",
        promptKey: "improv.q.triadInversion.bassToInversion",
        promptValues: { chord, root: voiced[0] as string },
        ...options(INVERSION_KEYS[inversion] as string, [...INVERSION_KEYS], rng),
        ...hint,
    };
}

/** Signed shortest move between two pitch classes, in semitones (−5 … +6). */
function step(from: string, to: string): number {
    const up = (chroma(to) - chroma(from) + 12) % 12;
    return up > 6 ? up - 12 : up;
}

const PERMUTATIONS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

/**
 * Where each note of the first triad goes in the second one, moving the voices
 * as little as possible in total (each voice to a different note).
 */
export function voiceMoves(first: string, second: string): string[] {
    const from = notesOf(first);
    const to = notesOf(second);
    const cost = (perm: number[]) => perm.reduce((sum, target, index) => sum + Math.abs(step(from[index] as string, to[target] as string)), 0);
    const best = [...PERMUTATIONS].sort((a, b) => cost(a) - cost(b))[0] as number[];
    return best.map((target) => to[target] as string);
}

export function commonTones(first: string, second: string): string[] {
    const other = new Set(notesOf(second).map(chroma));
    return notesOf(first).filter((note) => other.has(chroma(note)));
}

function pickPair(rng: Rng, accept: (first: string, second: string) => boolean): [string, string] {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const triads = Key.majorKey(rng.pick(KEYS)).triads;
        const [first, second] = rng.shuffle(triads) as [string, string];
        if (accept(first, second)) return [first, second];
    }
    return ["C", "F"];
}

export function generateVoiceLeading(rng: Rng, direction: string): ChoiceQuestion {
    if (direction === "common-name") {
        const [first, second] = pickPair(rng, (a, b) => commonTones(a, b).length === 1);
        const correct = commonTones(first, second)[0] as string;
        const others = [...notesOf(first), ...notesOf(second)].filter((note) => chroma(note) !== chroma(correct));
        return {
            id: "voiceLeading",
            promptKey: "improv.q.voiceLeading.commonName",
            promptValues: { first, second },
            ...options(correct, rng.shuffle(others), rng),
            hintKey: "improv.q.voiceLeading.hintNotes",
            hintValues: { first, second, notes: notesOf(first).join("-"), list: notesOf(second).join(", ") },
        };
    }
    if (direction === "voice-move") {
        const [first, second] = pickPair(rng, (a, b) => commonTones(a, b).length < 3);
        const moves = voiceMoves(first, second);
        const from = notesOf(first);
        const moving = from.map((_, index) => index).filter((index) => chroma(from[index] as string) !== chroma(moves[index] as string));
        const index = rng.pick(moving);
        return {
            id: "voiceLeading",
            promptKey: "improv.q.voiceLeading.voiceMove",
            promptValues: { first, second, source: from[index] as string },
            ...options(moves[index] as string, notesOf(second), rng),
            hintKey: "improv.q.voiceLeading.hintMoves",
            hintValues: { first, second, notes: from.join("-"), list: moves.join(", ") },
        };
    }
    const [first, second] = pickPair(rng, () => true);
    const count = commonTones(first, second).length;
    return {
        id: "voiceLeading",
        promptKey: "improv.q.voiceLeading.commonCount",
        promptValues: { first, second },
        ...options(String(count), ["0", "1", "2"], rng),
        hintKey: "improv.q.voiceLeading.hintNotes",
        hintValues: { first, second, notes: notesOf(first).join("-"), list: notesOf(second).join(", ") },
    };
}

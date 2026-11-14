/**
 * Question generators for the Improv Training module (run improv-training-2026-11-13).
 *
 * E2 closed choice questions produced by named generators (`keySig`,
 * `modes`, `triadBuild`, …) — one canonical correct answer plus distractors.
 * Fretboard note drills moved to the `practice-link` engine in plan phase 2
 * (module 1/5 practice /practice with SM2 progress and mic support).
 *
 * Everything is a pure function of (generator, seed, index): a seeded
 * mulberry32 PRNG keeps runs reproducible for tests. Answer matching happens
 * on the raw (non-localized) strings the generator returns.
 */

import type { NoteName } from "@/types/fretboard";
import { NOTES } from "@/lib/constants";
import { Key } from "tonal";

/* ─────────── Seeded PRNG ─────────── */

export function hashSeed(seed: string): number {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export interface Rng {
    next(): number;
    int(maxExclusive: number): number;
    pick<T>(items: readonly T[]): T;
    shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32 — small, fast, deterministic. */
export function createRng(seed: string): Rng {
    let state = hashSeed(seed) || 1;
    const next = (): number => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        int: (maxExclusive: number) => Math.floor(next() * Math.max(1, maxExclusive)),
        pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
        shuffle: <T>(items: readonly T[]): T[] => {
            const copy = [...items];
            for (let index = copy.length - 1; index > 0; index -= 1) {
                const swapIndex = Math.floor(next() * (index + 1));
                const tmp = copy[index] as T;
                copy[index] = copy[swapIndex] as T;
                copy[swapIndex] = tmp;
            }
            return copy;
        },
    };
}

/* ─────────── Question shapes ─────────── */

export interface ChoiceQuestion {
    /** Stable id: `${generatorId}:${index}:${seed hash}` — unique inside a run. */
    id: string;
    /** i18n key of the prompt template. */
    promptKey: string;
    /** Interpolation values for the prompt (raw note/chord tokens). */
    promptValues: Record<string, string | number>;
    /** Display options; `options[correctIndex]` is the canonical answer. */
    options: string[];
    correctIndex: number;
    /** Optional i18n key + values of an after-answer explanation. */
    hintKey?: string;
    hintValues?: Record<string, string | number>;
    /** Optional audio prompt (plan phase 5: mode recognition by ear). */
    audio?: { root: string; order: number };
}

export type FretboardQuestionDirection = "position-to-note" | "note-to-position";

/* ─────────── E2 data tables ─────────── */

export const MAJOR_KEY_SIGNATURES: Array<{ key: string; count: number; type: "sharps" | "flats" | "none"; list: string[] }> = [
    { key: "C", count: 0, type: "none", list: [] },
    { key: "G", count: 1, type: "sharps", list: ["F#"] },
    { key: "D", count: 2, type: "sharps", list: ["F#", "C#"] },
    { key: "A", count: 3, type: "sharps", list: ["F#", "C#", "G#"] },
    { key: "E", count: 4, type: "sharps", list: ["F#", "C#", "G#", "D#"] },
    { key: "B", count: 5, type: "sharps", list: ["F#", "C#", "G#", "D#", "A#"] },
    { key: "F#", count: 6, type: "sharps", list: ["F#", "C#", "G#", "D#", "A#", "E#"] },
    { key: "C#", count: 7, type: "sharps", list: ["F#", "C#", "G#", "D#", "A#", "E#", "B#"] },
    { key: "F", count: 1, type: "flats", list: ["Bb"] },
    { key: "Bb", count: 2, type: "flats", list: ["Bb", "Eb"] },
    { key: "Eb", count: 3, type: "flats", list: ["Bb", "Eb", "Ab"] },
    { key: "Ab", count: 4, type: "flats", list: ["Bb", "Eb", "Ab", "Db"] },
    { key: "Db", count: 5, type: "flats", list: ["Bb", "Eb", "Ab", "Db", "Gb"] },
    { key: "Gb", count: 6, type: "flats", list: ["Bb", "Eb", "Ab", "Db", "Gb", "Cb"] },
];

export const MODES: Array<{ order: number; name: string; pattern: string; characteristic: string }> = [
    { order: 1, name: "Ionian", pattern: "W-W-H-W-W-W-H", characteristic: "—" },
    { order: 2, name: "Dorian", pattern: "W-H-W-W-W-H-W", characteristic: "6" },
    { order: 3, name: "Phrygian", pattern: "H-W-W-W-H-W-W", characteristic: "b2" },
    { order: 4, name: "Lydian", pattern: "W-W-W-H-W-W-H", characteristic: "#4" },
    { order: 5, name: "Mixolydian", pattern: "W-W-H-W-W-H-W", characteristic: "b7" },
    { order: 6, name: "Aeolian", pattern: "W-H-W-W-H-W-W", characteristic: "b6" },
    { order: 7, name: "Locrian", pattern: "H-W-W-H-W-W-W", characteristic: "b5" },
];

/** Diatonic 7th chords of C major and their modes (video module 9). */
export const CHORD_SCALE_MAJOR: Array<{ chord: string; mode: string }> = [
    { chord: "Cmaj7", mode: "Ionian" },
    { chord: "Dm7", mode: "Dorian" },
    { chord: "Em7", mode: "Phrygian" },
    { chord: "Fmaj7", mode: "Lydian" },
    { chord: "G7", mode: "Mixolydian" },
    { chord: "Am7", mode: "Aeolian" },
    { chord: "Bm7b5", mode: "Locrian" },
    // Characteristic tensions shown in the video.
    { chord: "Dm13", mode: "Dorian" },
    { chord: "Fmaj7#11", mode: "Lydian" },
    { chord: "E7sus(b9)", mode: "Phrygian" },
];

export const CHORD_SCALE_MELODIC: Array<{ chord: string; mode: string }> = [
    { chord: "m(Maj7)", mode: "Melodic Minor" },
    { chord: "m7", mode: "Dorian b2" },
    { chord: "Maj7#5", mode: "Lydian Augmented" },
    { chord: "7#11", mode: "Lydian Dominant" },
    { chord: "7b13", mode: "Mixolydian b6" },
    { chord: "m7b5", mode: "Aeolian b5" },
    // Video pairs Altered with -7(b5); standard pairing is 7alt (see docs).
    { chord: "7alt", mode: "Altered" },
];

export const MELODIC_MINOR_MODES = ["Melodic Minor", "Dorian b2", "Lydian Augmented", "Lydian Dominant", "Mixolydian b6", "Aeolian b5", "Altered"];

export const CHORD_SCALE_HARMONIC: Array<{ chord: string; mode: string }> = [
    { chord: "m(Maj7)", mode: "Harmonic Minor" },
    { chord: "m7b5", mode: "Locrian #6" },
    { chord: "Maj7#5", mode: "Ionian #5" },
    { chord: "m7", mode: "Dorian #4" },
    { chord: "7", mode: "Phrygian Dominant" },
    { chord: "Maj7", mode: "Lydian #2" },
    { chord: "dim7", mode: "Superlocrian bb7" },
];

export const HARMONIC_MINOR_MODES = ["Harmonic Minor", "Locrian #6", "Ionian #5", "Dorian #4", "Phrygian Dominant", "Lydian #2", "Superlocrian bb7"];

export const CHORD_TYPE_INTERVALS: Array<{ label: string; intervals: string }> = [
    { label: "major (M)", intervals: "1 3 5" },
    { label: "minor (m)", intervals: "1 b3 5" },
    { label: "diminished (dim)", intervals: "1 b3 b5" },
    { label: "augmented (aug)", intervals: "1 3 #5" },
    { label: "7 (dominant)", intervals: "1 3 5 b7" },
    { label: "maj7", intervals: "1 3 5 7" },
    { label: "m7", intervals: "1 b3 5 b7" },
    { label: "m7b5 (half-dim)", intervals: "1 b3 b5 b7" },
    { label: "dim7", intervals: "1 b3 b5 bb7" },
    { label: "mMaj7", intervals: "1 b3 5 7" },
];

/** Secondary dominants in C major (video module 16, incl. the V7/I note). */
export const SECONDARY_DOMINANTS: Array<{ target: string; dominant: string }> = [
    { target: "Dm7", dominant: "A7" },
    { target: "Em7", dominant: "B7" },
    { target: "Fmaj7", dominant: "C7" },
    { target: "G7", dominant: "D7" },
    { target: "Am7", dominant: "E7" },
];

/** Borrowed chords in C major (video module 17). */
export const BORROWED_CHORDS: Array<{ chord: string; degree: string; source: string }> = [
    { chord: "Bb7", degree: "bVII7", source: "Cm" },
    { chord: "Fm7", degree: "iv7", source: "Cm" },
    { chord: "Abmaj7", degree: "bVImaj7", source: "Cm" },
    { chord: "Ebmaj7", degree: "bIIImaj7", source: "Cm" },
    { chord: "Fm7–Bb7–C", degree: "backdoor ii-V", source: "Cm" },
];

const GIANT_STEPS_CYCLE = ["B", "G", "Eb"];
const GIANT_STEPS_RESOLUTIONS: Array<{ dominant: string; target: string }> = [
    { dominant: "D7", target: "G" },
    { dominant: "Bb7", target: "Eb" },
    { dominant: "F#7", target: "B" },
];

const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

/** Pitch class of a chord's root: parses the leading note token (sharps + flats). */
function pcOf(note: string): number {
    const match = /^([A-G])([#b])?/.exec(note);
    if (!match) return 0;
    const letter = match[1];
    const accidental = match[2] ?? "";
    const token = accidental === "b" ? `${letter}b` : accidental === "#" ? `${letter}#` : letter;
    const flatIndex = FLAT_NAMES.indexOf(token as (typeof FLAT_NAMES)[number]);
    if (flatIndex >= 0) return flatIndex;
    const sharpIndex = NOTES.indexOf(token as NoteName);
    return sharpIndex >= 0 ? sharpIndex : 0;
}

/** Tritone (subV) dominant of a dominant chord, flat-spelled: G7 → Db7. */
const KEY_POOL = ["C", "G", "D", "A", "E", "B", "F", "Bb", "Eb", "Ab", "Db", "Gb"];
const MINOR_KEY_POOL = ["C", "G", "D", "A", "E", "B", "F", "Bb", "Eb", "Ab", "Db", "Gb"];

/** Flat-spelled pitch class name for a chromatic index. */
function flatName(pc: number): string {
    return FLAT_NAMES[((pc % 12) + 12) % 12];
}

/** Chord/scale pairs for a major key at question time (plan phase 5: all 12 keys). */
export function chordScaleMajorPairs(key: string): Array<{ chord: string; mode: string }> {
    const scale = Key.majorKey(key).scale as string[];
    return [
        { chord: `${scale[0]}maj7`, mode: "Ionian" },
        { chord: `${scale[1]}m7`, mode: "Dorian" },
        { chord: `${scale[1]}m13`, mode: "Dorian" },
        { chord: `${scale[2]}m7`, mode: "Phrygian" },
        { chord: `${scale[2]}7sus(b9)`, mode: "Phrygian" },
        { chord: `${scale[3]}maj7`, mode: "Lydian" },
        { chord: `${scale[3]}maj7#11`, mode: "Lydian" },
        { chord: `${scale[4]}7`, mode: "Mixolydian" },
        { chord: `${scale[5]}m7`, mode: "Aeolian" },
        { chord: `${scale[6]}m7b5`, mode: "Locrian" },
    ];
}

/** Secondary-dominant pairs for a major key, incl. the V7/I note from the video. */
function secondaryDomPairs(key: string): Array<{ target: string; dominant: string }> {
    const scale = Key.majorKey(key).scale as string[];
    const qualities = ["m7", "m7", "maj7", "7", "m7"];
    const pairs: Array<{ target: string; dominant: string }> = [];
    for (let idx = 1; idx <= 5; idx += 1) {
        pairs.push({
            target: `${scale[idx]}${qualities[idx - 1]}`,
            dominant: `${scale[(idx + 4) % 7]}7`,
        });
    }
    // V7/I from the video: C7 in C major pulls to the tonic as well.
    pairs.push({ target: `${scale[0]}maj7`, dominant: `${scale[0]}7` });
    return pairs;
}

/** Borrowed-chord pairs for a major key (parallel minor), flat-spelled. */
function borrowedPairs(key: string): Array<{ chord: string; degree: string }> {
    const pc = pcOf(key);
    return [
        { chord: `${flatName(pc + 10)}7`, degree: "bVII7" },
        { chord: `${flatName(pc + 5)}m7`, degree: "iv7" },
        { chord: `${flatName(pc + 8)}maj7`, degree: "bVImaj7" },
        { chord: `${flatName(pc + 3)}maj7`, degree: "bIIImaj7" },
        { chord: `${flatName(pc + 5)}m7–${flatName(pc + 10)}7–${key}`, degree: "backdoor ii-V" },
    ];
}

/** The notes of a mode rooted on `root` (parent major scale a (order-1) fifth-ish below). */
export function modeNotesFromRoot(root: string, order: number): string[] {
    const parentPc = (pcOf(root) - (order - 1) + 12) % 12;
    return Key.majorKey(flatName(parentPc)).scale as string[];
}

export function tritoneSub(chord: string): string {
    const root = chord.replace(/7.*$/, "");
    const pc = pcOf(root);
    return `${FLAT_NAMES[(pc + 6) % 12]}7`;
}

/**
 * Where a subV resolves: a fifth below the original dominant's root — the
 * tonic the original dominant was pointing at. Db7 (subV of G7) → C,
 * Gb7 (subV of C7) → F, Ab7 (subV of D7) → G.
 */
export function subVResolutionTarget(dominant: string): string {
    return FLAT_NAMES[(pcOf(dominant.replace(/7$/, "")) + 5) % 12];
}

function chordOptions(correct: string, distractors: string[], rng: Rng): { options: string[]; correctIndex: number } {
    const unique = [...new Set([correct, ...distractors])].slice(0, 4);
    const options = rng.shuffle(unique);
    return { options, correctIndex: options.indexOf(correct) };
}

function numericOptions(correct: number, rng: Rng, min: number, max: number): { options: string[]; correctIndex: number } {
    const values = new Set<number>([correct]);
    while (values.size < 4) {
        values.add(min + rng.int(max - min + 1));
    }
    const options = rng.shuffle([...values]).map(String);
    return { options, correctIndex: options.indexOf(String(correct)) };
}

/* ─────────── E2 generators ─────────── */

export type ChoiceGeneratorId =
    | "keySig"
    | "modes"
    | "triadBuild"
    | "chordScaleMajor"
    | "triadType"
    | "chordScaleMelodic"
    | "chordScaleHarmonic"
    | "tritone"
    | "secondaryDom"
    | "borrowed"
    | "pivot"
    | "coltrane";

export function listChoiceGeneratorIds(): ChoiceGeneratorId[] {
    return ["keySig", "modes", "triadBuild", "chordScaleMajor", "triadType", "chordScaleMelodic", "chordScaleHarmonic", "tritone", "secondaryDom", "borrowed", "pivot", "coltrane"];
}

function generateKeySig(rng: Rng, direction: string): ChoiceQuestion {
    const entry = rng.pick(MAJOR_KEY_SIGNATURES);
    if (direction === "key-type") {
        // Sharps or flats — only keys that actually carry accidentals.
        const pool = MAJOR_KEY_SIGNATURES.filter((item) => item.count > 0);
        const picked = rng.pick(pool);
        const other = picked.type === "sharps" ? "flats" : "sharps";
        const { options, correctIndex } = chordOptions(picked.type, [other], rng);
        return {
            id: "keySig",
            promptKey: "improv.q.keySig.keyType",
            promptValues: { key: picked.key },
            options,
            correctIndex,
            hintKey: "improv.q.keySig.hintAccidentals",
            hintValues: { key: picked.key, list: picked.list.join(", ") || "—" },
        };
    }
    if (direction === "key-accidentals") {
        const raised = rng.pick(MAJOR_KEY_SIGNATURES.filter((item) => item.count > 0));
        const distractorKeys = MAJOR_KEY_SIGNATURES.filter((item) => item.count > 0 && item.key !== raised.key);
        const distractors = rng.shuffle(distractorKeys).slice(0, 3).map((item) => item.list.join(", "));
        const { options, correctIndex } = chordOptions(raised.list.join(", "), distractors, rng);
        return {
            id: "keySig",
            promptKey: "improv.q.keySig.keyAccidentals",
            promptValues: { key: raised.key },
            options,
            correctIndex,
            hintKey: "improv.q.keySig.hintCount",
            hintValues: { key: raised.key, count: raised.count },
        };
    }
    if (direction === "parallel-minor") {
        const picked = rng.pick(MAJOR_KEY_SIGNATURES);
        const { options, correctIndex } = chordOptions(`${picked.key}m`, rng.shuffle(MAJOR_KEY_SIGNATURES.filter((item) => item.key !== picked.key)).slice(0, 3).map((item) => `${item.key}m`), rng);
        return {
            id: "keySig",
            promptKey: "improv.q.keySig.parallelMinor",
            promptValues: { key: picked.key },
            options,
            correctIndex,
            hintKey: "improv.q.keySig.hintAccidentals",
            hintValues: { key: picked.key, list: picked.list.join(", ") || "—" },
        };
    }
    if (direction === "count-to-key") {
        // Only keys with accidentals: "0 accidentals" would be ambiguous.
        const pool = MAJOR_KEY_SIGNATURES.filter((item) => item.count > 0);
        const correct = rng.pick(pool);
        const distractors = MAJOR_KEY_SIGNATURES.filter((item) => item.count !== correct.count || item.count === 0);
        const { options, correctIndex } = chordOptions(correct.key, rng.shuffle(distractors).slice(0, 3).map((item) => item.key), rng);
        return {
            id: "keySig",
            promptKey: "improv.q.keySig.countToKey",
            promptValues: { count: correct.count, type: correct.type },
            options,
            correctIndex,
            hintKey: "improv.q.keySig.hintAccidentals",
            hintValues: { key: correct.key, list: correct.list.join(", ") || "—" },
        };
    }
    if (direction === "key-to-accidentals") {
        const distractors = MAJOR_KEY_SIGNATURES.filter((item) => item.list.join() !== entry.list.join());
        const { options, correctIndex } = chordOptions(entry.key, rng.shuffle(distractors).slice(0, 3).map((item) => item.key), rng);
        return {
            id: "keySig",
            promptKey: "improv.q.keySig.accidentalsToKey",
            promptValues: { list: entry.list.join(", ") || "—", type: entry.type },
            options,
            correctIndex,
            hintKey: "improv.q.keySig.hintCount",
            hintValues: { key: entry.key, count: entry.count },
        };
    }
    const { options, correctIndex } = numericOptions(entry.count, rng, 0, 7);
    return {
        id: "keySig",
        promptKey: "improv.q.keySig.keyToCount",
        promptValues: { key: entry.key },
        options,
        correctIndex,
        hintKey: "improv.q.keySig.hintAccidentals",
        hintValues: { key: entry.key, list: entry.list.join(", ") || "—" },
    };
}

function generateModes(rng: Rng, direction: string): ChoiceQuestion {
    const modeNames = MODES.map((mode) => mode.name);
    const entry = rng.pick(MODES);
    if (direction === "mode-to-order") {
        const { options, correctIndex } = numericOptions(entry.order, rng, 1, 7);
        return {
            id: "modes",
            promptKey: "improv.q.modes.modeToOrder",
            promptValues: { mode: entry.name },
            options,
            correctIndex,
            hintKey: "improv.q.modes.hintPattern",
            hintValues: { mode: entry.name, pattern: entry.pattern },
        };
    }
    if (direction === "pattern-to-mode") {
        const distractors = MODES.filter((mode) => mode.name !== entry.name).map((mode) => mode.name);
        const { options, correctIndex } = chordOptions(entry.name, rng.shuffle(distractors).slice(0, 3), rng);
        return {
            id: "modes",
            promptKey: "improv.q.modes.patternToMode",
            promptValues: { pattern: entry.pattern },
            options,
            correctIndex,
            hintKey: "improv.q.modes.hintCharacteristic",
            hintValues: { mode: entry.name, characteristic: entry.characteristic },
        };
    }
    if (direction === "mode-notes") {
        const root = rng.pick(["C", "D", "E", "G", "A", "Bb"]);
        const notes = modeNotesFromRoot(root, entry.order);
        const distractorRoots = ["C", "D", "E", "G", "A", "Bb"].filter((item) => item !== root);
        const distractors = rng.shuffle(distractorRoots).slice(0, 3).map((other) => modeNotesFromRoot(other, entry.order).join(" "));
        const { options, correctIndex } = chordOptions(notes.join(" "), distractors, rng);
        return {
            id: "modes",
            promptKey: "improv.q.modes.modeNotesFromRoot",
            promptValues: { mode: entry.name, root },
            options,
            correctIndex,
            hintKey: "improv.q.modes.hintPattern",
            hintValues: { mode: entry.name, pattern: entry.pattern },
        };
    }
    if (direction === "mode-parent") {
        const root = rng.pick(["C", "D", "E", "G", "A", "Bb"]);
        const parent = flatName((pcOf(root) - (entry.order - 1) + 12) % 12);
        const otherParents = KEY_POOL.filter((item) => item !== parent);
        const { options, correctIndex } = chordOptions(parent, rng.shuffle(otherParents).slice(0, 3), rng);
        return {
            id: "modes",
            promptKey: "improv.q.modes.modeParent",
            promptValues: { mode: entry.name, root },
            options,
            correctIndex,
            hintKey: "improv.q.modes.hintCharacteristic",
            hintValues: { mode: entry.name, characteristic: entry.characteristic },
        };
    }
    if (direction === "sound-to-mode") {
        const root = rng.pick(["C", "D", "E", "G", "A"]);
        const modeNames = MODES.map((mode) => mode.name);
        const { options, correctIndex } = chordOptions(entry.name, rng.shuffle(modeNames.filter((name) => name !== entry.name)).slice(0, 3), rng);
        return {
            id: "modes",
            promptKey: "improv.q.modes.soundToMode",
            promptValues: { root },
            options,
            correctIndex,
            audio: { root, order: entry.order },
            hintKey: "improv.q.modes.hintPattern",
            hintValues: { mode: entry.name, pattern: entry.pattern },
        };
    }
    if (direction === "characteristic-to-mode") {
        const withCharacteristic = MODES.filter((mode) => mode.characteristic !== "—");
        const picked = rng.pick(withCharacteristic);
        const { options, correctIndex } = chordOptions(picked.name, rng.shuffle(modeNames.filter((name) => name !== picked.name)).slice(0, 3), rng);
        return {
            id: "modes",
            promptKey: "improv.q.modes.characteristicToMode",
            promptValues: { characteristic: picked.characteristic },
            options,
            correctIndex,
            hintKey: "improv.q.modes.hintPattern",
            hintValues: { mode: picked.name, pattern: picked.pattern },
        };
    }
    // order-to-mode
    const { options, correctIndex } = chordOptions(entry.name, rng.shuffle(modeNames.filter((name) => name !== entry.name)).slice(0, 3), rng);
    return {
        id: "modes",
        promptKey: "improv.q.modes.orderToMode",
        promptValues: { order: entry.order },
        options,
        correctIndex,
        hintKey: "improv.q.modes.hintCharacteristic",
        hintValues: { mode: entry.name, characteristic: entry.characteristic },
    };
}

function triadTypeOf(root: string, third: string, fifth: string): string {
    const semitones = (pcOf(third) - pcOf(root) + 12) % 12;
    const fifthSemitones = (pcOf(fifth) - pcOf(root) + 12) % 12;
    if (semitones === 4 && fifthSemitones === 7) return "";
    if (semitones === 3 && fifthSemitones === 7) return "m";
    if (semitones === 3 && fifthSemitones === 6) return "dim";
    if (semitones === 4 && fifthSemitones === 8) return "aug";
    return "";
}

const TRIAD_TYPE_LABELS: Record<string, string> = {
    "": "major",
    m: "minor",
    dim: "diminished",
    aug: "augmented",
};

const TRIAD_SEVENTH_LABELS: Record<string, string> = {
    maj7: "maj7",
    "7": "7 (dominant)",
    m7: "m7",
    "m7b5": "m7b5",
};

/** Seventh-chord suffix from stacked scale notes (root, 3rd, 5th, 7th). */
function triadSeventhSuffix(root: string, third: string, fifth: string, seventh: string): string {
    const thirdSemi = (pcOf(third) - pcOf(root) + 12) % 12;
    const fifthSemi = (pcOf(fifth) - pcOf(root) + 12) % 12;
    const seventhSemi = (pcOf(seventh) - pcOf(root) + 12) % 12;
    if (thirdSemi === 4 && fifthSemi === 7 && seventhSemi === 11) return "maj7";
    if (thirdSemi === 4 && fifthSemi === 7 && seventhSemi === 10) return "7";
    if (thirdSemi === 3 && fifthSemi === 7 && seventhSemi === 10) return "m7";
    if (thirdSemi === 3 && fifthSemi === 6 && seventhSemi === 10) return "m7b5";
    return "m7";
}

function generateTriadBuild(rng: Rng, direction: string): ChoiceQuestion {
    const keyName = rng.pick(["C", "D", "E", "F", "G", "A", "Bb", "Eb"]);
    const scale = Key.majorKey(keyName).scale;
    const degree = 1 + rng.int(7);
    const root = scale[degree - 1] as string;
    const third = scale[(degree + 1) % 7] as string;
    const fifth = scale[(degree + 3) % 7] as string;
    const suffix = triadTypeOf(root, third, fifth);
    const typeLabel = TRIAD_TYPE_LABELS[suffix] ?? "major";
    if (direction === "degree-to-seventh") {
        const seventh = scale[(degree + 5) % 7] as string;
        const seventhSuffix = triadSeventhSuffix(root, third, fifth, seventh);
        const typeLabelSeventh = TRIAD_SEVENTH_LABELS[seventhSuffix] ?? seventhSuffix;
        const symbol = `${root}${seventhSuffix}`;
        const distractors = Object.keys(TRIAD_SEVENTH_LABELS).filter((item) => item !== seventhSuffix);
        const { options, correctIndex } = chordOptions(symbol, distractors.map((item) => `${root}${item}`), rng);
        return {
            id: "triadBuild",
            promptKey: "improv.q.triadBuild.degreeToSeventh",
            promptValues: { key: keyName, degree, notes: `${root}-${third}-${fifth}-${seventh}` },
            options,
            correctIndex,
            hintKey: "improv.q.triadBuild.hintType",
            hintValues: { type: typeLabelSeventh },
        };
    }
    if (direction === "degree-to-triad") {
        const distractorSuffixes = Object.keys(TRIAD_TYPE_LABELS).filter((item) => item !== suffix);
        const { options, correctIndex } = chordOptions(`${root}${suffix}`, distractorSuffixes.map((item) => `${root}${item}`), rng);
        return {
            id: "triadBuild",
            promptKey: "improv.q.triadBuild.degreeToTriad",
            promptValues: { key: keyName, degree, notes: `${root}-${third}-${fifth}` },
            options,
            correctIndex,
            hintKey: "improv.q.triadBuild.hintType",
            hintValues: { type: typeLabel },
        };
    }
    const { options, correctIndex } = chordOptions(typeLabel, ["minor", "major", "diminished", "augmented"].filter((item) => item !== typeLabel), rng);
    return {
        id: "triadBuild",
        promptKey: "improv.q.triadBuild.degreeToType",
        promptValues: { key: keyName, degree, notes: `${root}-${third}-${fifth}` },
        options,
        correctIndex,
        hintKey: "improv.q.triadBuild.hintSpelling",
        hintValues: { notes: `${root}-${third}-${fifth}` },
    };
}

function chordScaleQuestion(rng: Rng, direction: string, pairs: Array<{ chord: string; mode: string }>, modeOptions: string[], idPrefix: string, chordToModePromptKey = "improv.q.chordScale.chordToMode", modeToChordPromptKey = "improv.q.chordScale.modeToChord", keyName?: string): ChoiceQuestion {
    const entry = rng.pick(pairs);
    if (direction === "mode-to-chord") {
        // Distractors must map to a *different* mode (Dm13 would also be Dorian).
        const distractors = pairs.filter((item) => item.mode !== entry.mode && item.chord !== entry.chord).map((item) => item.chord);
        const { options, correctIndex } = chordOptions(entry.chord, rng.shuffle(distractors).slice(0, 3), rng);
        return {
            id: idPrefix,
            promptKey: modeToChordPromptKey,
            promptValues: keyName ? { mode: entry.mode, key: keyName } : { mode: entry.mode },
            options,
            correctIndex,
            hintKey: "improv.q.chordScale.hintPair",
            hintValues: { chord: entry.chord, mode: entry.mode },
        };
    }
    const distractors = modeOptions.filter((mode) => mode !== entry.mode);
    const { options, correctIndex } = chordOptions(entry.mode, rng.shuffle(distractors).slice(0, 3), rng);
    return {
        id: idPrefix,
        promptKey: chordToModePromptKey,
        promptValues: keyName ? { chord: entry.chord, key: keyName } : { chord: entry.chord },
        options,
        correctIndex,
        hintKey: "improv.q.chordScale.hintPair",
        hintValues: { chord: entry.chord, mode: entry.mode },
    };
}

function generateTriadType(rng: Rng, direction: string): ChoiceQuestion {
    const entry = rng.pick(CHORD_TYPE_INTERVALS);
    if (direction === "intervals-to-name") {
        const distractors = CHORD_TYPE_INTERVALS.filter((item) => item.intervals !== entry.intervals).map((item) => item.label);
        const { options, correctIndex } = chordOptions(entry.label, rng.shuffle(distractors).slice(0, 3), rng);
        return {
            id: "triadType",
            promptKey: "improv.q.triadType.intervalsToName",
            promptValues: { intervals: entry.intervals },
            options,
            correctIndex,
            hintKey: "improv.q.triadType.hintIntervals",
            hintValues: { intervals: entry.intervals },
        };
    }
    const distractors = CHORD_TYPE_INTERVALS.filter((item) => item.label !== entry.label).map((item) => item.intervals);
    const { options, correctIndex } = chordOptions(entry.intervals, rng.shuffle(distractors).slice(0, 3), rng);
    return {
        id: "triadType",
        promptKey: "improv.q.triadType.nameToIntervals",
        promptValues: { label: entry.label },
        options,
        correctIndex,
        hintKey: "improv.q.triadType.hintIntervals",
        hintValues: { intervals: entry.intervals },
    };
}

function generateTritone(rng: Rng, direction: string): ChoiceQuestion {
    const dominant = rng.pick(["C7", "Db7", "D7", "Eb7", "E7", "F7", "Gb7", "G7", "Ab7", "A7", "Bb7", "B7"]);
    const sub = tritoneSub(dominant);
    if (direction === "subv-to-v") {
        const originalRoot = FLAT_NAMES[(pcOf(sub.replace(/7$/, "")) + 6) % 12];
        const correct = `${originalRoot}7`;
        const distractors = ["C7", "D7", "Eb7", "Gb7", "A7", "B7"].filter((item) => item !== correct);
        const { options, correctIndex } = chordOptions(correct, rng.shuffle(distractors).slice(0, 3), rng);
        return {
            id: "tritone",
            promptKey: "improv.q.tritone.subvToV",
            promptValues: { sub: sub },
            options,
            correctIndex,
            hintKey: "improv.q.tritone.hintResolution",
            hintValues: { sub, target: subVResolutionTarget(dominant) },
        };
    }
    if (direction === "subv-resolution") {
        const target = subVResolutionTarget(dominant);
        const distractors = ["C", "Db", "D", "Eb", "F", "Gb", "A", "B"].filter((item) => item !== target);
        const { options, correctIndex } = chordOptions(target, rng.shuffle(distractors).slice(0, 3), rng);
        return {
            id: "tritone",
            promptKey: "improv.q.tritone.subvResolution",
            promptValues: { sub },
            options,
            correctIndex,
            hintKey: "improv.q.tritone.hintSubV",
            hintValues: { sub, v: dominant },
        };
    }
    const distractors = ["C7", "Db7", "D7", "Eb7", "Gb7", "A7", "B7", "F7"].filter((item) => item !== sub);
    const { options, correctIndex } = chordOptions(sub, rng.shuffle(distractors).slice(0, 3), rng);
    return {
        id: "tritone",
        promptKey: "improv.q.tritone.vToSubv",
        promptValues: { v: dominant },
        options,
        correctIndex,
        hintKey: "improv.q.tritone.hintResolution",
        hintValues: { sub, target: subVResolutionTarget(dominant) },
    };
}

const MELODIC_MINOR_CHORD_PAIRS: Array<{ offset: number; quality: string; labelKey: string }> = [
    { offset: 0, quality: "m(maj7)", labelKey: "improv.goals.mmMinor251" },
    { offset: 2, quality: "m7", labelKey: "improv.goals.mmDorian2" },
    { offset: 4, quality: "Maj7#5", labelKey: "improv.goals.mmLydianAug" },
    { offset: 7, quality: "7#11", labelKey: "improv.goals.mmLydianDom" },
    { offset: 9, quality: "7b13", labelKey: "improv.goals.mmMixolydian6" },
    { offset: 10, quality: "m7b5", labelKey: "improv.goals.mmAeolian5" },
    { offset: 11, quality: "7alt", labelKey: "improv.goals.mmAltered" },
];

const HARMONIC_MINOR_CHORD_PAIRS: Array<{ offset: number; quality: string; labelKey: string }> = [
    { offset: 0, quality: "m(maj7)", labelKey: "improv.goals.hmTonic" },
    { offset: 2, quality: "m7b5", labelKey: "improv.goals.hmLocrian2" },
    { offset: 4, quality: "Maj7#5", labelKey: "improv.goals.hmIonian5" },
    { offset: 5, quality: "m7", labelKey: "improv.goals.hmDorian4" },
    { offset: 7, quality: "7", labelKey: "improv.goals.hmPhrygianDom" },
    { offset: 9, quality: "Maj7", labelKey: "improv.goals.hmLydian2" },
    { offset: 11, quality: "dim7", labelKey: "improv.goals.hmSuperlocrian" },
];

/** In-context chord/scale question (plan phase 5): a concrete chord in a
 * minor key; the answer is the parent melodic/harmonic minor scale. */
function generateChordScaleInContext(rng: Rng, kind: "melodic" | "harmonic"): ChoiceQuestion {
    const parentKey = rng.pick(MINOR_KEY_POOL);
    const parentPc = pcOf(parentKey);
    const pairs = kind === "melodic" ? MELODIC_MINOR_CHORD_PAIRS : HARMONIC_MINOR_CHORD_PAIRS;
    const entry = rng.pick(pairs);
    const root = flatName(parentPc + entry.offset);
    const chord = `${root}${entry.quality}`;
    const parent = `${parentKey} ${kind === "melodic" ? "melodic" : "harmonic"} minor`;
    const otherParents = MINOR_KEY_POOL.filter((item) => item !== parentKey)
        .slice(0, 6);
    const { options, correctIndex } = chordOptions(
        parent,
        rng.shuffle(otherParents).slice(0, 3).map((item) => `${item} ${kind === "melodic" ? "melodic" : "harmonic"} minor`),
        rng,
    );
    return {
        id: `chordScale${kind === "melodic" ? "Melodic" : "Harmonic"}`,
        promptKey: kind === "melodic" ? "improv.q.chordScaleMM.inContext" : "improv.q.chordScaleHM.inContext",
        promptValues: { chord, key: parentKey },
        options,
        correctIndex,
        hintKey: "improv.q.chordScale.hintParent",
        hintValues: { chord, parent },
    };
}

function generateSecondaryDom(rng: Rng, direction: string): ChoiceQuestion {
    const key = rng.pick(KEY_POOL);
    const entry = rng.pick(secondaryDomPairs(key));
    if (direction === "secondary-to-chord") {
        const distractors = SECONDARY_DOMINANTS.filter((item) => item.target !== entry.target).map((item) => item.target);
        const { options, correctIndex } = chordOptions(entry.target, rng.shuffle(distractors).slice(0, 3), rng);
        return {
            id: "secondaryDom",
            promptKey: "improv.q.secondaryDom.secondaryToChord",
            promptValues: { dominant: entry.dominant },
            options,
            correctIndex,
            hintKey: "improv.q.secondaryDom.hintPair",
            hintValues: { dominant: entry.dominant, target: entry.target },
        };
    }
    const distractors = SECONDARY_DOMINANTS.filter((item) => item.dominant !== entry.dominant).map((item) => item.dominant);
    const { options, correctIndex } = chordOptions(entry.dominant, rng.shuffle(distractors).slice(0, 3), rng);
    return {
        id: "secondaryDom",
        promptKey: "improv.q.secondaryDom.chordToSecondary",
        promptValues: { target: entry.target },
        options,
        correctIndex,
        hintKey: "improv.q.secondaryDom.hintPair",
        hintValues: { dominant: entry.dominant, target: entry.target },
    };
}

function generateBorrowed(rng: Rng, direction: string): ChoiceQuestion {
    const degrees = ["bVII7", "iv7", "bVImaj7", "bIIImaj7", "ii7", "V7", "vi7"];
    const key = rng.pick(["C", "G", "D", "A", "E", "B", "F", "Bb", "Eb", "Ab", "Db", "Gb"]);
    const pairs = borrowedPairs(key);
    const entry = rng.pick(pairs);
    if (direction === "backdoor") {
        // Always the full backdoor sequence for the drawn key: iv m7 – bVII7 – I.
        const backdoorEntry = pairs.find((item) => item.degree === "backdoor ii-V") ?? pairs[pairs.length - 1];
        const { options, correctIndex } = chordOptions(
            "improv.q.borrowed.answerBackdoor",
            ["improv.q.borrowed.answerDiatonic251", "improv.q.borrowed.answerMinor251", "improv.q.borrowed.answerTurnaround"],
            rng,
        );
        return {
            id: "borrowed",
            promptKey: "improv.q.borrowed.backdoor",
            promptValues: { chord: backdoorEntry.chord, key },
            options,
            correctIndex,
            hintKey: "improv.q.borrowed.hintBackdoor",
            hintValues: { source: "Cm" },
        };
    }
    const { options, correctIndex } = chordOptions(entry.degree, rng.shuffle(degrees.filter((degree) => degree !== entry.degree)).slice(0, 3), rng);
    return {
        id: "borrowed",
        promptKey: "improv.q.borrowed.identifyDegree",
        promptValues: { chord: entry.chord, key },
        options,
        correctIndex,
        hintKey: "improv.q.borrowed.hintSource",
        hintValues: { chord: entry.chord, source: "Cm" },
    };
}

function diatonicTriads(keyName: string): string[] {
    return [...Key.majorKey(keyName).triads];
}

function generatePivot(rng: Rng, direction: string): ChoiceQuestion {
    const keyPool = ["C", "G", "D", "A", "E", "F", "Bb", "Eb"];
    const first = rng.pick(keyPool);
    const candidates = keyPool.filter((key) => key !== first);
    const second = rng.pick(candidates);
    if (direction === "pivot-target") {
        const targetKey = rng.pick(keyPool);
        const scale = Key.majorKey(targetKey).scale;
        const ii = `${scale[1]}m7`;
        const v = `${scale[4]}7`;
        const correct = `${ii}–${v}`;
        const distractorKeys = keyPool.filter((key) => key !== targetKey);
        const distractors = distractorKeys.map((key) => {
            const otherScale = Key.majorKey(key).scale;
            return `${otherScale[1]}m7–${otherScale[4]}7`;
        });
        const { options, correctIndex } = chordOptions(correct, distractors, rng);
        return {
            id: "pivot",
            promptKey: "improv.q.pivot.pivotTarget",
            promptValues: { key: targetKey },
            options,
            correctIndex,
            hintKey: "improv.q.pivot.hintTarget",
            hintValues: { ii, v, key: targetKey },
        };
    }
    const triadsFirst = diatonicTriads(first);
    const triadsSecond = diatonicTriads(second);
    const common = triadsFirst.filter((triad) => triadsSecond.includes(triad));
    if (common.length === 0) {
        // Keys a tritone apart share nothing — fall back to a direct question.
        return generatePivot(rng, "pivot-target");
    }
    const correct = rng.pick(common);
    const distractors = [...new Set([...triadsFirst, ...triadsSecond])].filter((triad) => !common.includes(triad));
    const { options, correctIndex } = chordOptions(correct, distractors, rng);
    return {
        id: "pivot",
        promptKey: "improv.q.pivot.commonChord",
        promptValues: { first, second },
        options,
        correctIndex,
        hintKey: "improv.q.pivot.hintCommon",
        hintValues: { chord: correct, first, second },
    };
}

function generateColtrane(rng: Rng, direction: string): ChoiceQuestion {
    if (direction === "resolution") {
        const entry = rng.pick(GIANT_STEPS_RESOLUTIONS);
        const distractors = ["B", "G", "Eb", "D", "F#", "Bb", "C"].filter((item) => item !== entry.target);
        const { options, correctIndex } = chordOptions(entry.target, rng.shuffle(distractors).slice(0, 3), rng);
        return {
            id: "coltrane",
            promptKey: "improv.q.coltrane.resolution",
            promptValues: { dominant: entry.dominant },
            options,
            correctIndex,
            hintKey: "improv.q.coltrane.hintCycle",
            hintValues: { cycle: GIANT_STEPS_CYCLE.join("–") },
        };
    }
    if (direction === "ii-v-of") {
        const target = rng.pick(GIANT_STEPS_CYCLE);
        const targetPc = pcOf(target);
        const ii = `${flatName(targetPc + 2)}m7`;
        const v = `${flatName(targetPc + 5)}7`;
        const correct = `${ii}–${v}`;
        const distractors = GIANT_STEPS_CYCLE.filter((item) => item !== target)
            .map((item) => {
                const itemPc = pcOf(item);
                return `${flatName(itemPc + 2)}m7–${flatName(itemPc + 5)}7`;
            });
        const { options, correctIndex } = chordOptions(correct, distractors, rng);
        return {
            id: "coltrane",
            promptKey: "improv.q.coltrane.iiVOf",
            promptValues: { target },
            options,
            correctIndex,
            hintKey: "improv.q.coltrane.hintCycle",
            hintValues: { cycle: GIANT_STEPS_CYCLE.join("–") },
        };
    }
    const offset = rng.int(12) - 6;
    const shifted = GIANT_STEPS_CYCLE.map((root) => flatName(pcOf(root) + offset + 12));
    const correct = shifted.join("–");
    const distractorOffsets = [3, -2, 1, 5].filter((value) => value !== offset);
    const distractors = distractorOffsets.map((value) =>
        GIANT_STEPS_CYCLE.map((root) => flatName(pcOf(root) + value + 12)).join("–"));
    const { options, correctIndex } = chordOptions(correct, distractors, rng);
    return {
        id: "coltrane",
        promptKey: "improv.q.coltrane.cycleTransposed",
        promptValues: { offset: offset === 0 ? "B" : offset === 3 ? "Eb" : offset === -2 ? "A" : "C" },
        options,
        correctIndex,
        hintKey: "improv.q.coltrane.hintCycle",
        hintValues: { cycle: correct },
    };
}

function generateQuestion(generatorId: ChoiceGeneratorId, rng: Rng, direction: string | undefined): ChoiceQuestion {
    const resolvedDirection = direction ?? "mixed";
    const pickDirection = (): string => {
        if (resolvedDirection !== "mixed") return resolvedDirection;
        switch (generatorId) {
            case "keySig": return rng.pick(["key-to-count", "count-to-key", "key-to-accidentals", "key-type", "key-accidentals", "parallel-minor"]);
            case "modes": return rng.pick(["order-to-mode", "mode-to-order", "pattern-to-mode", "characteristic-to-mode", "mode-notes", "mode-parent", "sound-to-mode"]);
            case "triadBuild": return rng.pick(["degree-to-type", "degree-to-triad", "degree-to-seventh", "degree-to-seventh"]);
            case "chordScaleMajor": return rng.pick(["chord-to-mode", "mode-to-chord", "chord-to-mode"]);
            case "triadType": return rng.pick(["name-to-intervals", "intervals-to-name"]);
            case "chordScaleMelodic":
            case "chordScaleHarmonic": return rng.pick(["chord-to-mode", "mode-to-chord", "in-context"]);
            case "tritone": return rng.pick(["v-to-subv", "subv-to-v", "subv-resolution"]);
            case "secondaryDom": return rng.pick(["chord-to-secondary", "secondary-to-chord"]);
            case "borrowed": return rng.pick(["identify-degree", "backdoor"]);
            case "pivot": return rng.pick(["common-chord", "pivot-target"]);
            case "coltrane": return rng.pick(["cycle-order", "resolution", "ii-v-of", "cycle-transposed"]);
            default: return "mixed";
        }
    };

    switch (generatorId) {
        case "keySig": return generateKeySig(rng, pickDirection());
        case "modes": return generateModes(rng, pickDirection());
        case "triadBuild": return generateTriadBuild(rng, pickDirection());
        case "chordScaleMajor": {
            const key = rng.pick(KEY_POOL);
            return chordScaleQuestion(
                rng,
                pickDirection() === "mode-to-chord" ? "mode-to-chord" : "chord-to-mode",
                chordScaleMajorPairs(key),
                MODES.map((mode) => mode.name),
                "chordScaleMajor",
                "improv.q.chordScale.chordToModeKey",
                "improv.q.chordScale.modeToChordKey",
                key,
            );
        }
        case "triadType": return generateTriadType(rng, pickDirection());
        case "chordScaleMelodic": return pickDirection() === "in-context"
            ? generateChordScaleInContext(rng, "melodic")
            : chordScaleQuestion(rng, pickDirection() === "mode-to-chord" ? "mode-to-chord" : "chord-to-mode", CHORD_SCALE_MELODIC, MELODIC_MINOR_MODES, "chordScaleMelodic", "improv.q.chordScale.chordToModeGeneric");
        case "chordScaleHarmonic": return pickDirection() === "in-context"
            ? generateChordScaleInContext(rng, "harmonic")
            : chordScaleQuestion(rng, pickDirection() === "mode-to-chord" ? "mode-to-chord" : "chord-to-mode", CHORD_SCALE_HARMONIC, HARMONIC_MINOR_MODES, "chordScaleHarmonic", "improv.q.chordScale.chordToModeGeneric");
        case "tritone": return generateTritone(rng, pickDirection());
        case "secondaryDom": return generateSecondaryDom(rng, pickDirection());
        case "borrowed": return generateBorrowed(rng, pickDirection());
        case "pivot": return generatePivot(rng, pickDirection());
        case "coltrane": return generateColtrane(rng, pickDirection());
        default: return generateKeySig(rng, "key-to-count");
    }
}

export interface ChoiceQuizGenerationParams {
    generatorId: ChoiceGeneratorId | "mixed";
    questionCount: number;
    answerOptions?: number;
    direction?: string;
    /** For "mixed": restrict questions to these generators (plan phase 6:
     * review sessions draw from passed modules only). */
    allowedGenerators?: ChoiceGeneratorId[];
}

/**
 * Generates a full quiz run. Each question gets a distinct seed so question N
 * does not constrain question N+1; the whole run stays deterministic per seed.
 */
export function generateChoiceQuiz(params: ChoiceQuizGenerationParams, seed: string): ChoiceQuestion[] {
    const questions: ChoiceQuestion[] = [];
    for (let index = 0; index < params.questionCount; index += 1) {
        const rng = createRng(`${seed}:${params.generatorId}:${index}`);
        // "mixed" draws a concrete generator per question (plan phase 6:
        // review sessions). With allowedGenerators, the draw is restricted.
        const effectiveGenerator = params.generatorId === "mixed"
            ? rng.pick(params.allowedGenerators ?? listChoiceGeneratorIds())
            : params.generatorId;
        const direction = params.generatorId === "mixed"
            ? (params.direction ?? undefined)
            : params.direction;
        const question = generateQuestion(effectiveGenerator, rng, direction);
        const { options, correctIndex, ...rest } = question;
        const trimmed = options.slice(0, params.answerOptions ?? 4);
        questions.push({
            ...rest,
            id: `${params.generatorId}:${index}`,
            options: trimmed,
            correctIndex: Math.max(0, trimmed.indexOf(options[correctIndex])),
        });
    }
    return questions;
}

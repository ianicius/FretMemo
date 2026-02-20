import { NOTES } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";

export type FunctionalDegree = "1" | "2" | "3" | "4" | "5" | "6" | "7";
export type FunctionalMode = "major";

export interface FunctionalQuestion {
    keyRoot: NoteName;
    mode: FunctionalMode;
    degree: FunctionalDegree;
    targetMidi: number;
    contextChords: number[][];
    askedAtMs: number;
}

export interface FunctionalQuestionOptions {
    mode?: FunctionalMode;
    degrees?: FunctionalDegree[];
    keyRoot?: NoteName;
}

export const FUNCTIONAL_DEGREES: FunctionalDegree[] = ["1", "2", "3", "4", "5", "6", "7"];
const MAJOR_SCALE_OFFSETS: Record<FunctionalDegree, number> = {
    "1": 0,
    "2": 2,
    "3": 4,
    "4": 5,
    "5": 7,
    "6": 9,
    "7": 11,
};

function randomItem<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}

function toPitchClass(note: NoteName): number {
    return NOTES.indexOf(note);
}

function toMidi(note: NoteName, octave: number): number {
    // MIDI formula: C-1 = 0, C4 = 60
    return (octave + 1) * 12 + toPitchClass(note);
}

function buildMajorTriad(rootMidi: number): number[] {
    return [rootMidi, rootMidi + 4, rootMidi + 7];
}

export function degreeToSemitone(degree: FunctionalDegree, mode: FunctionalMode = "major"): number {
    if (mode === "major") return MAJOR_SCALE_OFFSETS[degree];
    return MAJOR_SCALE_OFFSETS[degree];
}

export function degreeToNoteName(
    keyRoot: NoteName,
    degree: FunctionalDegree,
    mode: FunctionalMode = "major",
): NoteName {
    const rootPc = toPitchClass(keyRoot);
    const semitone = degreeToSemitone(degree, mode);
    return NOTES[(rootPc + semitone) % 12];
}

export function buildCadenceForKey(keyRoot: NoteName, mode: FunctionalMode = "major", baseOctave = 4): number[][] {
    const rootMidi = toMidi(keyRoot, baseOctave);
    if (mode === "major") {
        const I = buildMajorTriad(rootMidi);
        const IV = buildMajorTriad(rootMidi + MAJOR_SCALE_OFFSETS["4"]);
        const V = buildMajorTriad(rootMidi + MAJOR_SCALE_OFFSETS["5"]);
        return [I, IV, V, I];
    }
    const I = buildMajorTriad(rootMidi);
    return [I, I, I, I];
}

export function buildFunctionalQuestion(options: FunctionalQuestionOptions = {}): FunctionalQuestion {
    const mode = options.mode ?? "major";
    const degrees = options.degrees && options.degrees.length > 0 ? options.degrees : FUNCTIONAL_DEGREES;
    const keyRoot = options.keyRoot ?? randomItem(NOTES);
    const degree = randomItem(degrees);
    const keyRootMidi = toMidi(keyRoot, 4);
    const targetMidi = keyRootMidi + degreeToSemitone(degree, mode);

    return {
        keyRoot,
        mode,
        degree,
        targetMidi,
        contextChords: buildCadenceForKey(keyRoot, mode, 4),
        askedAtMs: Date.now(),
    };
}


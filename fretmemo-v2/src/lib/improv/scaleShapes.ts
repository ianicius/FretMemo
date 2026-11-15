/**
 * Scale/shape geometry for the Improv Training module (run improv-training-2026-11-13).
 *
 * Pure functions only (no alphaTab, no Web Audio): given a shape definition
 * (semitone offsets from the root), a tonic and a fret window, they return the
 * fretboard positions that belong to the shape. Used by the E3 diagram-drill
 * engine (src/components/improv/DiagramDrill.tsx) and by unit tests.
 *
 * String indices follow the app convention (src/types/fretboard.ts):
 * 0 = high E … 5 = low E for the standard tuning array.
 */

import type { NoteName } from "@/types/fretboard";
import { NOTES, STANDARD_TUNING, getNoteAt } from "@/lib/constants";

export type ScaleShapeId =
    | "min-pent"
    | "maj-pent"
    | "major"
    | "melodic-minor"
    | "harmonic-minor"
    | "dorian"
    | "aeolian"
    | "phrygian"
    | "lydian"
    | "mixolydian"
    | "m7-arp"
    | "dom7-arp"
    | "maj7-arp"
    | "m7b5-arp";

/**
 * Every shape is rendered as a "scale": all chord/scale tones inside the
 * fret window, on all six strings (plan phase 2 — arpeggios show the full
 * chord in the window, like the video's Cm7 at the 8th fret).
 */
export interface ScaleShapeDefinition {
    id: ScaleShapeId;
    /** Semitone offsets from the root, ascending. */
    semitones: number[];
    /** Compact degree labels matching `semitones` (1, b3, 5 …). */
    degrees: string[];
}

export const SCALE_SHAPES: Record<ScaleShapeId, ScaleShapeDefinition> = {
    "min-pent": { id: "min-pent", semitones: [0, 3, 5, 7, 10], degrees: ["1", "b3", "4", "5", "b7"] },
    "maj-pent": { id: "maj-pent", semitones: [0, 2, 4, 7, 9], degrees: ["1", "2", "3", "5", "6"] },
    major: { id: "major", semitones: [0, 2, 4, 5, 7, 9, 11], degrees: ["1", "2", "3", "4", "5", "6", "7"] },
    "melodic-minor": { id: "melodic-minor", semitones: [0, 2, 3, 5, 7, 9, 11], degrees: ["1", "2", "b3", "4", "5", "6", "7"] },
    "harmonic-minor": { id: "harmonic-minor", semitones: [0, 2, 3, 5, 7, 8, 11], degrees: ["1", "2", "b3", "4", "5", "b6", "7"] },
    dorian: { id: "dorian", semitones: [0, 2, 3, 5, 7, 9, 10], degrees: ["1", "2", "b3", "4", "5", "6", "b7"] },
    aeolian: { id: "aeolian", semitones: [0, 2, 3, 5, 7, 8, 10], degrees: ["1", "2", "b3", "4", "5", "b6", "b7"] },
    phrygian: { id: "phrygian", semitones: [0, 1, 3, 5, 7, 8, 10], degrees: ["1", "b2", "b3", "4", "5", "b6", "b7"] },
    lydian: { id: "lydian", semitones: [0, 2, 4, 6, 7, 9, 11], degrees: ["1", "2", "3", "#4", "5", "6", "7"] },
    mixolydian: { id: "mixolydian", semitones: [0, 2, 4, 5, 7, 9, 10], degrees: ["1", "2", "3", "4", "5", "6", "b7"] },
    "m7-arp": { id: "m7-arp", semitones: [0, 3, 7, 10], degrees: ["1", "b3", "5", "b7"] },
    "dom7-arp": { id: "dom7-arp", semitones: [0, 4, 7, 10], degrees: ["1", "3", "5", "b7"] },
    "maj7-arp": { id: "maj7-arp", semitones: [0, 4, 7, 11], degrees: ["1", "3", "5", "7"] },
    "m7b5-arp": { id: "m7b5-arp", semitones: [0, 3, 6, 10], degrees: ["1", "b3", "b5", "b7"] },
};

/**
 * Plan C7: every mode except Locrian is a pentatonic from the same root plus
 * two notes ("major" is Ionian).
 */
export const MODE_PENTATONIC: Partial<Record<ScaleShapeId, "min-pent" | "maj-pent">> = {
    dorian: "min-pent",
    aeolian: "min-pent",
    phrygian: "min-pent",
    lydian: "maj-pent",
    major: "maj-pent",
    mixolydian: "maj-pent",
};

/** Plan C2: the note each diagram view adds to the minor pentatonic. */
export const PENTATONIC_ADDITIONS = {
    blues: { semitone: 6, degree: "b5" },
    hex: { semitone: 2, degree: "2" },
} as const;

/** Plan C3: minor-pentatonic degrees that are usually bent (towards 3, 5 and 1). */
export const BEND_DEGREES: readonly string[] = ["b3", "4", "b7"];

/** Semitone offsets of a shape (kept as a named export for tests). */
export function shapeSemitones(shapeId: ScaleShapeId): number[] {
    return SCALE_SHAPES[shapeId].semitones;
}

export interface ShapePosition {
    stringIndex: number;
    fret: number;
    /** Index into the shape's `degrees` array. */
    degreeIndex: number;
    isRoot: boolean;
    note: NoteName;
}

export interface ShapeRenderOptions {
    tuning?: NoteName[];
    fretFrom: number;
    fretTo: number;
}

/**
 * Flat spellings indexed by pitch class — mirrors the FLAT_NAMES pattern from
 * questions.ts. Covers the flat keys the curriculum uses (`ImprovKey`:
 * "Bb"|"Db"|"Eb"|"Gb"|"Ab"); `NOTES` covers the sharp spellings.
 */
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

function notePitchClass(note: string): number {
    const flatIndex = FLAT_NAMES.indexOf(note as (typeof FLAT_NAMES)[number]);
    if (flatIndex >= 0) return flatIndex;
    const sharpIndex = NOTES.indexOf(note as NoteName);
    return sharpIndex >= 0 ? sharpIndex : 0;
}

/** Pitch classes covered by the shape for the given tonic. */
export function getShapePitchClasses(shapeId: ScaleShapeId, key: string): number[] {
    const rootPc = notePitchClass(key);
    return SCALE_SHAPES[shapeId].semitones.map((offset) => (rootPc + offset) % 12);
}

/**
 * All scale-shape positions inside the fret window [fretFrom, fretTo] across
 * every string of the tuning. Fret 0 is only included when the window asks
 * for it (open strings belong to lower positions, not to a box).
 */
export function getScaleShapePositions(
    shapeId: ScaleShapeId,
    key: string,
    options: ShapeRenderOptions,
): ShapePosition[] {
    const tuning = options.tuning ?? STANDARD_TUNING;
    const pitchClasses = new Set(getShapePitchClasses(shapeId, key));
    const semitones = SCALE_SHAPES[shapeId].semitones;
    const rootPc = notePitchClass(key);

    const positions: ShapePosition[] = [];
    tuning.forEach((openNote, stringIndex) => {
        for (let fret = Math.max(0, options.fretFrom); fret <= options.fretTo; fret += 1) {
            const note = getNoteAt(openNote, fret);
            if (!pitchClasses.has(notePitchClass(note))) continue;
            const offset = (notePitchClass(note) - rootPc + 12) % 12;
            const degreeIndex = semitones.indexOf(offset);
            if (degreeIndex < 0) continue;
            positions.push({ stringIndex, fret, degreeIndex, isRoot: offset === 0, note });
        }
    });
    return positions;
}

export type StringShape = "rect" | "stack";

/**
 * Plan C1: in a pentatonic box every string carries two notes, three frets
 * apart (rectangle) or two frets apart (stack). Strings with any other
 * content are left out.
 */
export function stringShapes(positions: ShapePosition[]): Map<number, StringShape> {
    const fretsByString = new Map<number, number[]>();
    for (const position of positions) {
        fretsByString.set(position.stringIndex, [...(fretsByString.get(position.stringIndex) ?? []), position.fret]);
    }
    const shapes = new Map<number, StringShape>();
    for (const [stringIndex, frets] of fretsByString) {
        if (frets.length !== 2) continue;
        const gap = Math.abs((frets[0] as number) - (frets[1] as number));
        if (gap === 3) shapes.set(stringIndex, "rect");
        if (gap === 2) shapes.set(stringIndex, "stack");
    }
    return shapes;
}

/** Positions of one pitch (semitones above the tonic) inside the fret window. */
export function getPitchPositions(
    key: string,
    semitone: number,
    options: ShapeRenderOptions,
): Array<{ stringIndex: number; fret: number; note: NoteName }> {
    const tuning = options.tuning ?? STANDARD_TUNING;
    const target = (notePitchClass(key) + semitone) % 12;
    const positions: Array<{ stringIndex: number; fret: number; note: NoteName }> = [];
    tuning.forEach((openNote, stringIndex) => {
        for (let fret = Math.max(0, options.fretFrom); fret <= options.fretTo; fret += 1) {
            const note = getNoteAt(openNote, fret);
            if (notePitchClass(note) === target) positions.push({ stringIndex, fret, note });
        }
    });
    return positions;
}

/**
 * Tonic anchor for tonic-relative windows: the fret where the tonic sits on
 * the low E string. Below the 3rd fret a full box would clip against the
 * nut, so the anchor jumps an octave up (E → 12, F → 13).
 */
export function tonicAnchorFret(key: string): number {
    const pc = notePitchClass(key);
    const tonicFret = (pc - 4 + 12) % 12;
    return tonicFret < 3 ? tonicFret + 12 : tonicFret;
}

/**
 * True when the six guitar strings are in standard tuning (extra low strings
 * of a 7/8-string guitar do not matter). The tonic anchor and the box
 * offsets assume the low E string, so other tunings get a notice (plan A3).
 */
export function isStandardTuning(tuning: readonly string[]): boolean {
    return tuning.length >= STANDARD_TUNING.length
        && STANDARD_TUNING.every((note, index) => notePitchClass(tuning[index] ?? "") === notePitchClass(note));
}

/**
 * Alias kept for call-site readability: every shape renders through the
 * scale renderer (plan phase 2 — arpeggios are full-window shapes).
 */
export const getShapePositions = getScaleShapePositions;

/**
 * True when every degree of the shape occurs at least once in the rendered
 * positions — guards the curriculum windows against "holes" (see tests).
 */
export function coversAllDegrees(shapeId: ScaleShapeId, key: string, options: ShapeRenderOptions): boolean {
    const positions = getShapePositions(shapeId, key, options);
    const seen = new Set(positions.map((position) => position.degreeIndex));
    const expected = SCALE_SHAPES[shapeId].semitones.length;
    return seen.size === expected;
}

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
    | "triad"
    | "m7-arp"
    | "dom7-arp";

export type ShapeKind = "scale" | "chord";

export interface ScaleShapeDefinition {
    id: ScaleShapeId;
    kind: ShapeKind;
    /** Semitone offsets from the root, ascending. */
    semitones: number[];
    /** Compact degree labels matching `semitones` (1, b3, 5 …). */
    degrees: string[];
    /**
     * For chord shapes: strings used for the one-note-per-string voicing
     * (0 = high E). Scales ignore this (they fill every string in the window).
     */
    stringIndices?: number[];
}

export const SCALE_SHAPES: Record<ScaleShapeId, ScaleShapeDefinition> = {
    "min-pent": { id: "min-pent", kind: "scale", semitones: [0, 3, 5, 7, 10], degrees: ["1", "b3", "4", "5", "b7"] },
    "maj-pent": { id: "maj-pent", kind: "scale", semitones: [0, 2, 4, 7, 9], degrees: ["1", "2", "3", "5", "6"] },
    major: { id: "major", kind: "scale", semitones: [0, 2, 4, 5, 7, 9, 11], degrees: ["1", "2", "3", "4", "5", "6", "7"] },
    "melodic-minor": { id: "melodic-minor", kind: "scale", semitones: [0, 2, 3, 5, 7, 9, 11], degrees: ["1", "2", "b3", "4", "5", "6", "7"] },
    "harmonic-minor": { id: "harmonic-minor", kind: "scale", semitones: [0, 2, 3, 5, 7, 8, 11], degrees: ["1", "2", "b3", "4", "5", "b6", "7"] },
    // `triad` quality is resolved at call time (see resolveChordSemitones).
    triad: { id: "triad", kind: "chord", semitones: [0, 4, 7], degrees: ["1", "3", "5"], stringIndices: [2, 1, 0] },
    "m7-arp": { id: "m7-arp", kind: "chord", semitones: [0, 3, 7, 10], degrees: ["1", "b3", "5", "b7"], stringIndices: [5, 4, 3, 2] },
    "dom7-arp": { id: "dom7-arp", kind: "chord", semitones: [0, 4, 7, 10], degrees: ["1", "3", "5", "b7"], stringIndices: [5, 4, 3, 2] },
};

export type TriadQuality = "maj" | "min" | "dim" | "aug";

const TRIAD_SEMITONES: Record<TriadQuality, number[]> = {
    maj: [0, 4, 7],
    min: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
};

/** Resolves the semitone set for a shape, honoring the triad quality override. */
export function resolveChordSemitones(shapeId: ScaleShapeId, triadQuality?: TriadQuality): number[] {
    const definition = SCALE_SHAPES[shapeId];
    if (shapeId === "triad" && triadQuality) {
        return TRIAD_SEMITONES[triadQuality];
    }
    return definition.semitones;
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
    /** Only for `triad`. */
    triadQuality?: TriadQuality;
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
export function getShapePitchClasses(shapeId: ScaleShapeId, key: string, triadQuality?: TriadQuality): number[] {
    const rootPc = notePitchClass(key);
    return resolveChordSemitones(shapeId, triadQuality).map((offset) => (rootPc + offset) % 12);
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
    const pitchClasses = new Set(getShapePitchClasses(shapeId, key, options.triadQuality));
    const semitones = resolveChordSemitones(shapeId, options.triadQuality);
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

interface VoicingCandidate {
    frets: number[];
    spread: number;
    total: number;
}

/**
 * One-note-per-string chord shapes (triads, arpeggios). Explores every
 * combination of matching frets on the shape's strings that uses each chord
 * tone exactly once, then deterministically prefers the most compact voicing
 * (smallest fret spread, then lowest average). Falls back to the lowest
 * matching fret per string when no full coverage exists in the window.
 */
export function getChordShapePositions(
    shapeId: ScaleShapeId,
    key: string,
    options: ShapeRenderOptions,
): ShapePosition[] {
    const tuning = options.tuning ?? STANDARD_TUNING;
    const semitones = resolveChordSemitones(shapeId, options.triadQuality);
    const chordPcs = semitones.map((offset) => (notePitchClass(key) + offset) % 12);
    const rootPc = notePitchClass(key);
    const strings = SCALE_SHAPES[shapeId].stringIndices ?? [5, 4, 3, 2];

    // Matching frets per string (in string order of `strings`).
    const allowed: number[][] = strings.map((stringIndex) => {
        const openNote = tuning[stringIndex] ?? "C";
        const frets: number[] = [];
        for (let fret = Math.max(0, options.fretFrom); fret <= options.fretTo; fret += 1) {
            if (chordPcs.includes(notePitchClass(getNoteAt(openNote, fret)))) {
                frets.push(fret);
            }
        }
        return frets;
    });

    const candidates: VoicingCandidate[] = [];
    const current: number[] = [];
    const usedPcs = new Set<number>();
    const explore = (stringPos: number) => {
        if (stringPos === strings.length) {
            if (usedPcs.size === chordPcs.length) {
                const spread = Math.max(...current) - Math.min(...current);
                const total = current.reduce((sum, fret) => sum + fret, 0);
                candidates.push({ frets: [...current], spread, total });
            }
            return;
        }
        for (const fret of allowed[stringPos]) {
            const pc = notePitchClass(getNoteAt(tuning[strings[stringPos]] ?? "C", fret));
            if (usedPcs.has(pc)) continue;
            usedPcs.add(pc);
            current.push(fret);
            explore(stringPos + 1);
            current.pop();
            usedPcs.delete(pc);
        }
    };
    explore(0);

    let frets: number[];
    if (candidates.length > 0) {
        candidates.sort((left, right) =>
            left.spread - right.spread
            || left.total - right.total
            || compareArrays(left.frets, right.frets));
        frets = candidates[0].frets;
    } else {
        // Fallback: lowest matching fret per string (coverage not guaranteed).
        frets = allowed.map((list) => list[0]).filter((fret) => typeof fret === "number");
        if (frets.length !== strings.length) return [];
    }

    return strings.map((stringIndex, pos) => {
        const fret = frets[pos];
        const note = getNoteAt(tuning[stringIndex] ?? "C", fret);
        const offset = (notePitchClass(note) - rootPc + 12) % 12;
        const degreeIndex = semitones.indexOf(offset);
        return { stringIndex, fret, degreeIndex: Math.max(0, degreeIndex), isRoot: offset === 0, note };
    });
}

function compareArrays(left: number[], right: number[]): number {
    for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
        if (left[index] !== right[index]) return left[index] - right[index];
    }
    return left.length - right.length;
}

/** Dispatches to the scale or chord renderer depending on the shape kind. */
export function getShapePositions(shapeId: ScaleShapeId, key: string, options: ShapeRenderOptions): ShapePosition[] {
    return SCALE_SHAPES[shapeId].kind === "chord"
        ? getChordShapePositions(shapeId, key, options)
        : getScaleShapePositions(shapeId, key, options);
}

/**
 * True when every degree of the shape occurs at least once in the rendered
 * positions — guards the curriculum windows against "holes" (see tests).
 */
export function coversAllDegrees(shapeId: ScaleShapeId, key: string, options: ShapeRenderOptions): boolean {
    const positions = getShapePositions(shapeId, key, options);
    const seen = new Set(positions.map((position) => position.degreeIndex));
    const expected = resolveChordSemitones(shapeId, options.triadQuality).length;
    return seen.size === expected;
}

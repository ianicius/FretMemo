import { describe, expect, it } from "vitest";
import { STANDARD_TUNING, getNoteAt } from "@/lib/constants";
import {
    SCALE_SHAPES,
    coversAllDegrees,
    getScaleShapePositions,
    getShapePitchClasses,
    getShapePositions,
    shapeSemitones,
} from "../scaleShapes";

describe("scaleShapes — scale boxes", () => {
    it("A minor pentatonic in frets 5-8 yields only the pentatonic pitch classes and marks roots", () => {
        const positions = getScaleShapePositions("min-pent", "A", { fretFrom: 5, fretTo: 8 });
        const pcs = new Set(
            positions.map((p) => getNoteAt(STANDARD_TUNING[p.stringIndex] as never, p.fret)),
        );
        expect([...pcs].sort()).toEqual(["A", "C", "D", "E", "G"].sort());
        // A min-pent pitch classes: A C D E G → chroma indices sorted.
        expect(getShapePitchClasses("min-pent", "A").sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 9]);
        expect(positions.filter((p) => p.isRoot).length).toBeGreaterThan(0);
        expect(positions.every((p) => p.fret >= 5 && p.fret <= 8)).toBe(true);
    });

    it("the classic A min-pent box contains exactly two notes per string (frets 5/7/8)", () => {
        const positions = getScaleShapePositions("min-pent", "A", { fretFrom: 5, fretTo: 8 });
        const lowE = positions.filter((p) => p.stringIndex === 5).map((p) => p.fret).sort((a, b) => a - b);
        expect(lowE).toEqual([5, 8]); // A and C on the low E string
    });

    it("transposes with the key (C min-pent stays within the 8-11 window)", () => {
        const positions = getScaleShapePositions("min-pent", "C", { fretFrom: 8, fretTo: 11 });
        const notes = new Set(positions.map((p) => getNoteAt(STANDARD_TUNING[p.stringIndex] as never, p.fret)));
        // Sharp spelling from getNoteAt: C D#(Eb) F G A#(Bb).
        expect([...notes].sort()).toEqual(["A#", "C", "D#", "F", "G"].sort());
        expect(coversAllDegrees("min-pent", "C", { fretFrom: 8, fretTo: 11 })).toBe(true);
    });

    it("coversAllDegrees detects a hole in a too-narrow window", () => {
        // Fret 6 alone matches no A min-pent note on any string.
        expect(coversAllDegrees("min-pent", "A", { fretFrom: 6, fretTo: 6 })).toBe(false);
        expect(coversAllDegrees("min-pent", "A", { fretFrom: 5, fretTo: 8 })).toBe(true);
    });

    it("is invariant under the tonic shift: same shape in A and C after subtracting the anchor (plan phase 2)", () => {
        // A anchors at fret 5, C at fret 8 — the same min-pent box rendered
        // with tonic-relative offsets [0,3] must produce identical relative
        // layouts.
        const relative = (positions: Array<{ stringIndex: number; fret: number; degreeIndex: number }>, anchor: number) =>
            positions.map((p) => `${p.stringIndex}:${p.fret - anchor}:${p.degreeIndex}`).sort();
        const inA = relative(getScaleShapePositions("min-pent", "A", { fretFrom: 5, fretTo: 8 }), 5);
        const inC = relative(getScaleShapePositions("min-pent", "C", { fretFrom: 8, fretTo: 11 }), 8);
        expect(inC).toEqual(inA);
    });
});

describe("scaleShapes — flat key spellings (ImprovKey)", () => {
    it("resolves Bb maj-pent to Bb pitch classes, not the C fallback", () => {
        // Bb maj-pent: Bb C D F G → chroma [10, 0, 2, 5, 7].
        expect(getShapePitchClasses("maj-pent", "Bb").sort((a, b) => a - b)).toEqual([0, 2, 5, 7, 10]);
    });

    it("resolves Db and Eb (and the remaining ImprovKey flats) to correct pitch classes", () => {
        // Db min-pent: Db + [0,3,5,7,10] → chroma [1,4,6,8,11].
        expect(getShapePitchClasses("min-pent", "Db").sort((a, b) => a - b)).toEqual([1, 4, 6, 8, 11]);
        // Eb min-pent: Eb Gb Ab Bb Db → chroma [3,6,8,10,1].
        expect(getShapePitchClasses("min-pent", "Eb").sort((a, b) => a - b)).toEqual([1, 3, 6, 8, 10]);
        // Gb and Ab round out the flat keys the curriculum declares.
        expect(getShapePitchClasses("min-pent", "Gb").sort((a, b) => a - b)).toEqual([1, 4, 6, 9, 11]);
        expect(getShapePitchClasses("min-pent", "Ab").sort((a, b) => a - b)).toEqual([1, 3, 6, 8, 11]);
    });

    it("renders an Eb min-pent box with sharp-spelled notes and roots only on D#(Eb)", () => {
        const positions = getScaleShapePositions("min-pent", "Eb", { fretFrom: 6, fretTo: 9 });
        expect(positions.length).toBeGreaterThan(0);
        // Eb min-pent: Eb Gb Ab Bb Db → D# F# G# A# C#.
        const allowed = ["C#", "D#", "F#", "G#", "A#"];
        expect(positions.every((p) => allowed.includes(p.note))).toBe(true);
        const roots = positions.filter((p) => p.isRoot);
        expect(roots.length).toBeGreaterThan(0);
        expect(roots.every((p) => p.note === "D#")).toBe(true);
    });
});

describe("scaleShapes — arpeggios as full-window shapes (plan phase 2)", () => {
    it("shows every Cm7 chord tone in the window across six strings (like the video's Cm7 at fret 8)", () => {
        const positions = getScaleShapePositions("m7-arp", "C", { fretFrom: 8, fretTo: 11 });
        expect(positions.length).toBeGreaterThan(0);
        // Cm7: C Eb G Bb — sharp spelling from getNoteAt.
        const allowed = ["A#", "C", "D#", "G"];
        expect(positions.every((p) => allowed.includes(p.note))).toBe(true);
        const roots = positions.filter((p) => p.isRoot);
        expect(roots.length).toBeGreaterThan(0);
        expect(roots.every((p) => p.note === "C")).toBe(true);
    });

    it("keeps the four arp shapes with correct semitone sets", () => {
        expect(shapeSemitones("m7-arp")).toEqual([0, 3, 7, 10]);
        expect(shapeSemitones("dom7-arp")).toEqual([0, 4, 7, 10]);
        expect(shapeSemitones("maj7-arp")).toEqual([0, 4, 7, 11]);
        expect(shapeSemitones("m7b5-arp")).toEqual([0, 3, 6, 10]);
    });

    it("maj7-arp in G renders G B D F# tones in the window", () => {
        const positions = getScaleShapePositions("maj7-arp", "G", { fretFrom: 0, fretTo: 7 });
        const notes = new Set(positions.map((p) => p.note));
        // Sharp spelling: F#(Gb) G B D.
        for (const note of ["F#", "G", "B", "D"] as const) {
            expect(notes.has(note)).toBe(true);
        }
        expect(positions.filter((p) => p.isRoot).every((p) => p.note === "G")).toBe(true);
    });

    it("m7b5-arp spells 1 b3 b5 b7 (B half-diminished in C: B D F Ab)", () => {
        const pcs = getShapePitchClasses("m7b5-arp", "B").sort((a, b) => a - b);
        // B D F A (b7 of B is A natural) → chroma [2, 5, 9, 11].
        expect(pcs).toEqual([2, 5, 9, 11]);
    });

    it("dispatches every shape through getShapePositions", () => {
        const viaDispatch = getShapePositions("dom7-arp", "G", { fretFrom: 0, fretTo: 7 });
        expect(viaDispatch.length).toBeGreaterThan(0);
    });
});

describe("scaleShapes — registry", () => {
    it("keeps the plan-0.2 removal: no dorian/phrygian/mixo pent shapes", () => {
        for (const removed of ["dorian-pent", "phrygian-pent", "mixo-pent", "triad"]) {
            expect(removed in SCALE_SHAPES).toBe(false);
        }
    });

    it("keeps the teaching shapes used by the curriculum", () => {
        for (const required of ["min-pent", "maj-pent", "major", "melodic-minor", "harmonic-minor", "m7-arp", "dom7-arp", "maj7-arp", "m7b5-arp"]) {
            expect(required in SCALE_SHAPES).toBe(true);
        }
    });
});

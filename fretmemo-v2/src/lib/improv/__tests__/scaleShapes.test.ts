import { describe, expect, it } from "vitest";
import { STANDARD_TUNING, getNoteAt } from "@/lib/constants";
import {
    SCALE_SHAPES,
    coversAllDegrees,
    getChordShapePositions,
    getScaleShapePositions,
    getShapePitchClasses,
    getShapePositions,
    resolveChordSemitones,
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
});

describe("scaleShapes — flat key spellings (ImprovKey)", () => {
    it("resolves Bb maj-pent to Bb pitch classes, not the C fallback", () => {
        // Bb maj-pent: Bb C D F G → chroma [10, 0, 2, 5, 7].
        expect(getShapePitchClasses("maj-pent", "Bb").sort((a, b) => a - b)).toEqual([0, 2, 5, 7, 10]);
    });

    it("renders the Bb m7 arpeggio with every chord tone and the root only on A#(Bb)", () => {
        const positions = getChordShapePositions("m7-arp", "Bb", { fretFrom: 0, fretTo: 12 });
        expect(positions).toHaveLength(4);
        // Bb m7: Bb Db F Ab — sharp spelling from getNoteAt: A# C# F G#.
        expect(positions.map((p) => p.note).sort()).toEqual(["A#", "C#", "F", "G#"].sort());
        const roots = positions.filter((p) => p.isRoot);
        expect(roots).toHaveLength(1);
        expect(roots.every((p) => p.note === "A#")).toBe(true);
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

describe("scaleShapes — chord shapes (one note per string)", () => {
    it("builds a compact Am triad on the top three strings with every chord tone once", () => {
        const positions = getChordShapePositions("triad", "A", { fretFrom: 0, fretTo: 12, triadQuality: "min" });
        expect(positions).toHaveLength(3);
        const notes = positions.map((p) => p.note).sort();
        expect(notes).toEqual(["A", "C", "E"].sort());
        const spread = Math.max(...positions.map((p) => p.fret)) - Math.min(...positions.map((p) => p.fret));
        expect(spread).toBeLessThanOrEqual(2);
        expect(positions.filter((p) => p.isRoot)).toHaveLength(1);
    });

    it("resolves the triad quality (maj vs min change the third)", () => {
        expect(resolveChordSemitones("triad", "maj")).toEqual([0, 4, 7]);
        expect(resolveChordSemitones("triad", "min")).toEqual([0, 3, 7]);
        expect(resolveChordSemitones("m7-arp")).toEqual([0, 3, 7, 10]);
    });

    it("builds an m7 arpeggio across EADG covering 1 b3 5 b7", () => {
        const positions = getChordShapePositions("m7-arp", "C", { fretFrom: 0, fretTo: 12 });
        expect(positions).toHaveLength(4);
        expect(positions.map((p) => p.stringIndex).sort()).toEqual([2, 3, 4, 5]);
        const notes = positions.map((p) => p.note).sort();
        // Sharp spelling: A#(Bb) C D#(Eb) G.
        expect(notes).toEqual(["A#", "C", "D#", "G"].sort());
        expect(positions.filter((p) => p.isRoot)).toHaveLength(1);
    });

    it("dom7 arpeggio in G uses 1 3 5 b7", () => {
        const positions = getChordShapePositions("dom7-arp", "G", { fretFrom: 0, fretTo: 12 });
        const notes = positions.map((p) => p.note).sort();
        expect(notes).toEqual(["B", "D", "F", "G"].sort());
    });

    it("dispatches chord shapes through getShapePositions by kind", () => {
        const viaDispatch = getShapePositions("dom7-arp", "G", { fretFrom: 0, fretTo: 12 });
        expect(viaDispatch).toHaveLength(4);
        expect(SCALE_SHAPES["dom7-arp"].kind).toBe("chord");
    });
});

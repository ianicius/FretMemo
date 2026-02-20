import { describe, it, expect } from "vitest";
import { NOTES, getNoteAt } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";

/**
 * CAGED shape definitions — mirrored from CagedVisualizer.tsx for testing.
 * String indices: 0 = high E, 1 = B, 2 = G, 3 = D, 4 = A, 5 = low E
 */
const CAGED_SHAPES: Record<string, { nativeRoot: number; frets: (number | null)[] }> = {
    C: { nativeRoot: 0, frets: [0, 1, 0, 2, 3, null] },
    A: { nativeRoot: 9, frets: [0, 2, 2, 2, 0, null] },
    G: { nativeRoot: 7, frets: [3, 0, 0, 0, 2, 3] },
    E: { nativeRoot: 4, frets: [0, 0, 1, 2, 2, 0] },
    D: { nativeRoot: 2, frets: [2, 3, 2, 0, null, null] },
};

const STANDARD_TUNING: NoteName[] = ["E", "B", "G", "D", "A", "E"];

/** Major chord intervals: root (0), major 3rd (4), perfect 5th (7) */
const MAJOR_INTERVALS = new Set([0, 4, 7]);

function getChordTones(shapeKey: string, rootName: NoteName): { stringIdx: number; fret: number; note: NoteName }[] {
    const shape = CAGED_SHAPES[shapeKey];
    const targetRootIndex = NOTES.indexOf(rootName);
    const shift = (targetRootIndex - shape.nativeRoot + 12) % 12;

    const tones: { stringIdx: number; fret: number; note: NoteName }[] = [];
    for (let stringIdx = 0; stringIdx < shape.frets.length; stringIdx++) {
        const nativeFret = shape.frets[stringIdx];
        if (nativeFret === null) continue;
        const fret = nativeFret + shift;
        if (fret < 0 || fret > 24) continue;
        const note = getNoteAt(STANDARD_TUNING[stringIdx], fret);
        tones.push({ stringIdx, fret, note });
    }
    return tones;
}

describe("CAGED positions", () => {
    const allRoots = NOTES as NoteName[];

    for (const shapeKey of Object.keys(CAGED_SHAPES)) {
        describe(`${shapeKey} Shape`, () => {
            for (const root of allRoots) {
                it(`produces only major chord tones for root ${root}`, () => {
                    const tones = getChordTones(shapeKey, root);
                    const rootIndex = NOTES.indexOf(root);

                    expect(tones.length).toBeGreaterThan(0);

                    for (const tone of tones) {
                        const noteIndex = NOTES.indexOf(tone.note);
                        const interval = (noteIndex - rootIndex + 12) % 12;
                        expect(
                            MAJOR_INTERVALS.has(interval),
                            `${shapeKey} shape, root ${root}: string ${tone.stringIdx} fret ${tone.fret} = ${tone.note} (interval ${interval}) is NOT a major chord tone`
                        ).toBe(true);
                    }
                });

                it(`contains the root note for root ${root}`, () => {
                    const tones = getChordTones(shapeKey, root);
                    const hasRoot = tones.some((t) => NOTES.indexOf(t.note) === NOTES.indexOf(root));
                    expect(hasRoot, `${shapeKey} shape for root ${root} should contain the root`).toBe(true);
                });
            }
        });
    }

    describe("native open position spot checks", () => {
        it("C shape at root C produces correct open C chord", () => {
            const tones = getChordTones("C", "C");
            // Expected: highE=0(E), B=1(C), G=0(G), D=2(E), A=3(C)
            expect(tones).toEqual([
                { stringIdx: 0, fret: 0, note: "E" },
                { stringIdx: 1, fret: 1, note: "C" },
                { stringIdx: 2, fret: 0, note: "G" },
                { stringIdx: 3, fret: 2, note: "E" },
                { stringIdx: 4, fret: 3, note: "C" },
            ]);
        });

        it("E shape at root E produces correct open E chord", () => {
            const tones = getChordTones("E", "E");
            // Expected: highE=0(E), B=0(B), G=1(G#), D=2(E), A=2(B), lowE=0(E)
            expect(tones).toEqual([
                { stringIdx: 0, fret: 0, note: "E" },
                { stringIdx: 1, fret: 0, note: "B" },
                { stringIdx: 2, fret: 1, note: "G#" },
                { stringIdx: 3, fret: 2, note: "E" },
                { stringIdx: 4, fret: 2, note: "B" },
                { stringIdx: 5, fret: 0, note: "E" },
            ]);
        });

        it("A shape at root A produces correct open A chord", () => {
            const tones = getChordTones("A", "A");
            // Expected: highE=0(E), B=2(C#), G=2(A), D=2(E), A=0(A)
            expect(tones).toEqual([
                { stringIdx: 0, fret: 0, note: "E" },
                { stringIdx: 1, fret: 2, note: "C#" },
                { stringIdx: 2, fret: 2, note: "A" },
                { stringIdx: 3, fret: 2, note: "E" },
                { stringIdx: 4, fret: 0, note: "A" },
            ]);
        });

        it("D shape at root D produces correct open D chord", () => {
            const tones = getChordTones("D", "D");
            // Expected: highE=2(F#), B=3(D), G=2(A), D=0(D)
            expect(tones).toEqual([
                { stringIdx: 0, fret: 2, note: "F#" },
                { stringIdx: 1, fret: 3, note: "D" },
                { stringIdx: 2, fret: 2, note: "A" },
                { stringIdx: 3, fret: 0, note: "D" },
            ]);
        });

        it("G shape at root G produces correct open G chord", () => {
            const tones = getChordTones("G", "G");
            // Expected: highE=3(G), B=0(B), G=0(G), D=0(D), A=2(B), lowE=3(G)
            expect(tones).toEqual([
                { stringIdx: 0, fret: 3, note: "G" },
                { stringIdx: 1, fret: 0, note: "B" },
                { stringIdx: 2, fret: 0, note: "G" },
                { stringIdx: 3, fret: 0, note: "D" },
                { stringIdx: 4, fret: 2, note: "B" },
                { stringIdx: 5, fret: 3, note: "G" },
            ]);
        });
    });

    describe("transposition", () => {
        it("E shape transposed to F produces F major barre chord", () => {
            const tones = getChordTones("E", "F");
            // F major barre at fret 1: all E shape frets +1
            expect(tones).toEqual([
                { stringIdx: 0, fret: 1, note: "F" },
                { stringIdx: 1, fret: 1, note: "C" },
                { stringIdx: 2, fret: 2, note: "A" },
                { stringIdx: 3, fret: 3, note: "F" },
                { stringIdx: 4, fret: 3, note: "C" },
                { stringIdx: 5, fret: 1, note: "F" },
            ]);
        });

        it("A shape transposed to B produces B major barre chord", () => {
            const tones = getChordTones("A", "B");
            // B major barre at fret 2: all A shape frets +3 (B is 3 semi above A? No, B=11, A=9, shift=2)
            // shift = (11 - 9 + 12) % 12 = 2
            expect(tones).toEqual([
                { stringIdx: 0, fret: 2, note: "F#" },
                { stringIdx: 1, fret: 4, note: "D#" },
                { stringIdx: 2, fret: 4, note: "B" },
                { stringIdx: 3, fret: 4, note: "F#" },
                { stringIdx: 4, fret: 2, note: "B" },
            ]);
        });
    });
});

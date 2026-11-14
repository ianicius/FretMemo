import { describe, expect, it } from "vitest";
import { Chord, Note } from "tonal";
import { STANDARD_TUNING, getNoteAt } from "@/lib/constants";
import { getChordTonePositions } from "../chords";

/** B1: chord-tone fretboard under the loop prompter. */
describe("getChordTonePositions (plan B1)", () => {
    const options = { tuning: STANDARD_TUNING, fretFrom: 1, fretTo: 12 };

    it.each(["Am", "Cmaj7", "D7", "Dm7b5", "G7", "F#m7", "Bb7", "Ebmaj7"])(
        "%s: positions are exactly the tonal chord notes, root flagged, degrees labelled",
        (symbol) => {
            const chord = Chord.get(symbol);
            const chordPcs = new Set(chord.notes.map((note) => Note.chroma(note)));
            const positions = getChordTonePositions(symbol, options);
            expect(positions.length).toBeGreaterThan(0);
            for (const position of positions) {
                const sounding = getNoteAt(STANDARD_TUNING[position.stringIndex] as never, position.fret);
                expect(position.note).toBe(sounding);
                expect(chordPcs.has(Note.chroma(sounding)), `${symbol} ${sounding}`).toBe(true);
                expect(position.isRoot).toBe(Note.chroma(sounding) === Note.chroma(chord.tonic as string));
                expect(position.fret).toBeGreaterThanOrEqual(1);
                expect(position.fret).toBeLessThanOrEqual(12);
            }
            // Every chord tone appears somewhere in frets 1–12.
            expect(new Set(positions.map((p) => Note.chroma(p.note)))).toEqual(chordPcs);
            // Complete: no chord-tone cell in the window is missing.
            let expected = 0;
            STANDARD_TUNING.forEach((open) => {
                for (let fret = 1; fret <= 12; fret += 1) if (chordPcs.has(Note.chroma(getNoteAt(open, fret)))) expected += 1;
            });
            expect(positions).toHaveLength(expected);
        },
    );

    it("labels degrees from the chord intervals (Am7: 1 b3 5 b7; Dm7b5: b5)", () => {
        const labels = (symbol: string) => Object.fromEntries(
            getChordTonePositions(symbol, options).map((p) => [p.note, p.label]),
        );
        expect(labels("Am7")).toEqual({ A: "1", C: "b3", E: "5", G: "b7" });
        expect(labels("Dm7b5")).toEqual({ D: "1", F: "b3", "G#": "b5", C: "b7" });
        expect(labels("Cmaj7")).toEqual({ C: "1", E: "3", G: "5", B: "7" });
    });

    it("marks mic targets and parses m(maj7)", () => {
        const positions = getChordTonePositions("Am", { ...options, targets: ["C"] });
        expect(positions.filter((p) => p.isTarget).every((p) => p.note === "C")).toBe(true);
        expect(positions.some((p) => p.isTarget)).toBe(true);
        expect(getChordTonePositions("Am(maj7)", options).some((p) => p.label === "7" && p.note === "G#")).toBe(true);
        expect(getChordTonePositions("nonsense", options)).toEqual([]);
    });
});

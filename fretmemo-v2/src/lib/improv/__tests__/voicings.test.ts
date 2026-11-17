import { describe, expect, it } from "vitest";
import { Note } from "tonal";
import { STANDARD_TUNING, getNoteAt } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";
import {
    STRING_SETS,
    chordShape,
    chordVoicings,
    degreeLabel,
    openStringMidi,
    topVoiceTargets,
    voiceLeadPath,
    voicingMidis,
    voicingMoves,
} from "../voicings";

const TUNING = STANDARD_TUNING as NoteName[];
const shape = (symbol: string) => chordShape(symbol) as NonNullable<ReturnType<typeof chordShape>>;
const notesOf = (voicing: { strings: number[]; frets: number[] }) =>
    voicing.frets.map((fret, index) => getNoteAt(TUNING[voicing.strings[index] as number] as NoteName, fret));

describe("chord voicings", () => {
    it("parses chord symbols into a root and intervals", () => {
        expect(chordShape("C")).toEqual({ rootPc: 0, intervals: [0, 4, 7] });
        expect(chordShape("Am")).toEqual({ rootPc: 9, intervals: [0, 3, 7] });
        expect(chordShape("Bdim")).toEqual({ rootPc: 11, intervals: [0, 3, 6] });
        expect(chordShape("Caug")).toEqual({ rootPc: 0, intervals: [0, 4, 8] });
        expect(chordShape("nonsense")).toBeNull();
        expect(degreeLabel(shape("Am"), 1)).toBe("b3");
    });

    it("finds every closed voicing of a triad on each string set, with the right bass and tones", () => {
        for (const strings of Object.values(STRING_SETS)) {
            for (const symbol of ["C", "Am", "F#", "Bdim"]) {
                const chord = shape(symbol);
                const voicings = chordVoicings(chord, strings, TUNING);
                // Three inversions, each found at least once below fret 15.
                expect(new Set(voicings.map((voicing) => voicing.inversion)), `${symbol} ${strings}`).toEqual(new Set([0, 1, 2]));
                for (const voicing of voicings) {
                    expect(Math.max(...voicing.frets) - Math.min(...voicing.frets)).toBeLessThanOrEqual(4);
                    const pcs = notesOf(voicing).map((note) => Note.chroma(note));
                    expect(new Set(pcs).size, `${symbol} ${voicing.frets}`).toBe(3);
                    expect(pcs[0]).toBe((chord.rootPc + (chord.intervals[voicing.inversion] as number)) % 12);
                    // Closed position: every voice is higher than the one below it.
                    const midis = voicingMidis(voicing, TUNING);
                    expect(midis[0] as number).toBeLessThan(midis[1] as number);
                    expect(midis[1] as number).toBeLessThan(midis[2] as number);
                }
                const lowest = voicings.map((voicing) => Math.min(...voicing.frets));
                expect(lowest).toEqual([...lowest].sort((a, b) => a - b));
            }
        }
    });

    it("finds the three textbook C major shapes on the top strings", () => {
        const frets = chordVoicings(shape("C"), STRING_SETS.top, TUNING).map((voicing) => voicing.frets.join("-"));
        expect(frets).toContain("5-5-3"); // C E G, root position
        expect(frets).toContain("9-8-8"); // E G C, first inversion
        expect(frets).toContain("12-13-12"); // G C E, second inversion
    });

    it("refuses chords whose size does not match the string set", () => {
        expect(chordVoicings(shape("C7"), STRING_SETS.top, TUNING)).toEqual([]);
        expect(chordVoicings(shape("C7"), [3, 2, 1, 0], TUNING).length).toBeGreaterThan(0);
    });
});

describe("voice leading", () => {
    it("keeps common tones and moves the rest by step from C to F to G to C", () => {
        const path = voiceLeadPath(["C", "F", "G", "C"].map(shape), STRING_SETS.top, TUNING);
        expect(path).toHaveLength(4);
        const [c, f, g] = path as [typeof path[0], typeof path[0], typeof path[0]];
        expect(notesOf(c)).toEqual(["C", "E", "G"]);
        // C → F: C stays, E → F, G → A.
        expect(notesOf(f)).toEqual(["C", "F", "A"]);
        expect(voicingMoves(c, f)).toEqual([0, 1, 2]);
        // F → G: both candidates move 6 frets in total; the even whole-step move wins over a 3-fret leap.
        expect(notesOf(g)).toEqual(["D", "G", "B"]);
        expect(voicingMoves(f, g)).toEqual([2, 2, 2]);
        for (let index = 1; index < path.length; index += 1) {
            const moves = voicingMoves(path[index - 1] as typeof c, path[index] as typeof c);
            expect(Math.max(...moves.map(Math.abs)), `step ${index}`).toBeLessThanOrEqual(2);
        }
    });

    it("moves by small steps through the cycle of fourths, with at most one octave jump", () => {
        // Voice-led fourths climb an octave per cycle, so the board runs out once at most.
        const cycle = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "B", "E", "A", "D", "G"];
        for (const strings of Object.values(STRING_SETS)) {
            for (const startFret of [1, 5]) {
                const path = voiceLeadPath(cycle.map(shape), strings, TUNING, { startFret });
                expect(path).toHaveLength(12);
                const totals = path.slice(1).map((voicing, index) =>
                    voicingMoves(path[index] as typeof voicing, voicing).reduce((sum, move) => sum + Math.abs(move), 0));
                expect(totals.filter((total) => total > 5).length, `${strings} from ${startFret}: ${totals}`).toBeLessThanOrEqual(1);
            }
        }
        // Started low on the top strings, the whole cycle fits without a jump.
        const low = voiceLeadPath(cycle.map(shape), STRING_SETS.top, TUNING, { startFret: 1 });
        expect(low.slice(1).every((voicing, index) => voicingMoves(low[index] as typeof voicing, voicing).every((move) => Math.abs(move) <= 2))).toBe(true);
    });

    it("derives microphone targets from the top voice", () => {
        const chords = ["C", "F", "G", "C"];
        const path = voiceLeadPath(chords.map(shape), STRING_SETS.top, TUNING);
        expect(topVoiceTargets(chords, path, TUNING)).toEqual([
            // The closing C is voiced higher (E G C), so either top note counts for C.
            { chord: "C", pitchClasses: ["G", "C"] },
            { chord: "F", pitchClasses: ["A"] },
            { chord: "G", pitchClasses: ["B"] },
        ]);
    });

    it("places open strings in the right octave, also in other tunings", () => {
        expect(openStringMidi(TUNING, 0)).toBe(64);
        expect(openStringMidi(TUNING, 5)).toBe(40);
        expect(openStringMidi(["E", "B", "G", "D", "A", "D"] as NoteName[], 5)).toBe(38);
    });
});

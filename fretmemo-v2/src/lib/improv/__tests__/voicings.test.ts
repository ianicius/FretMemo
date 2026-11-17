import { describe, expect, it } from "vitest";
import { Note } from "tonal";
import { STANDARD_TUNING, getNoteAt } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";
import {
    DROP2_ORDERS,
    DROP3_ORDERS,
    GUIDE_TONE_ORDERS,
    SHELL_ROOT_3_7,
    SHELL_ROOT_7_3,
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
        expect(voicingMoves(c, f, TUNING)).toEqual([0, 1, 2]);
        // F → G: both candidates move 6 frets in total; the even whole-step move wins over a 3-fret leap.
        expect(notesOf(g)).toEqual(["D", "G", "B"]);
        expect(voicingMoves(f, g, TUNING)).toEqual([2, 2, 2]);
        for (let index = 1; index < path.length; index += 1) {
            const moves = voicingMoves(path[index - 1] as typeof c, path[index] as typeof c, TUNING);
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
                    voicingMoves(path[index] as typeof voicing, voicing, TUNING).reduce((sum, move) => sum + Math.abs(move), 0));
                expect(totals.filter((total) => total > 5).length, `${strings} from ${startFret}: ${totals}`).toBeLessThanOrEqual(1);
            }
        }
        // Started low on the top strings, the whole cycle fits without a jump.
        const low = voiceLeadPath(cycle.map(shape), STRING_SETS.top, TUNING, { startFret: 1 });
        expect(low.slice(1).every((voicing, index) => voicingMoves(low[index] as typeof voicing, voicing, TUNING).every((move) => Math.abs(move) <= 2))).toBe(true);
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

    it("lays out drop 2, drop 3 and shell voicings in the asked order", () => {
        const notes = (symbol: string, strings: number[], orders: number[][], maxSpan = 4) =>
            chordVoicings(shape(symbol), strings, TUNING, { orders, maxSpan }).map((voicing) => `${voicing.frets.join("-")} ${notesOf(voicing).join(" ")}`);
        expect(DROP2_ORDERS).toEqual([[2, 0, 1, 3], [3, 1, 2, 0], [0, 2, 3, 1], [1, 3, 0, 2]]);
        // Cmaj7 drop 2 on strings 1-4, root position: G C E B at the fifth fret.
        expect(notes("Cmaj7", [3, 2, 1, 0], DROP2_ORDERS)).toContain("5-5-5-7 G C E B");
        expect(new Set(chordVoicings(shape("Cmaj7"), [3, 2, 1, 0], TUNING, { orders: DROP2_ORDERS }).map((voicing) => voicing.inversion))).toEqual(new Set([0, 1, 2, 3]));
        // Cmaj7 drop 3 with the root on the sixth string: C B E G.
        expect(notes("Cmaj7", [5, 3, 2, 1], DROP3_ORDERS, 5)).toContain("8-9-9-8 C B E G");
        // G7 shells with the root on the sixth string: 1-3-7 and 1-7-3.
        expect(notes("G7", [5, 4, 3], SHELL_ROOT_3_7)).toContain("3-2-3 G B F");
        expect(notes("G7", [5, 3, 2], SHELL_ROOT_7_3)).toContain("3-3-4 G F B");
    });

    it("alternates guide tones and moves drop 2 voicings by step through ii–V–I", () => {
        const twoFiveOne = ["Dm7", "G7", "Cmaj7"].map(shape);
        const guide = voiceLeadPath(twoFiveOne, [3, 2], TUNING, { orders: GUIDE_TONE_ORDERS });
        expect(guide.map(notesOf)).toEqual([["F", "C"], ["F", "B"], ["E", "B"]]);
        const drop2 = voiceLeadPath(twoFiveOne, [3, 2, 1, 0], TUNING, { orders: DROP2_ORDERS });
        expect(drop2).toHaveLength(3);
        for (let index = 1; index < drop2.length; index += 1) {
            expect(Math.max(...voicingMoves(drop2[index - 1] as typeof drop2[0], drop2[index] as typeof drop2[0], TUNING).map(Math.abs))).toBeLessThanOrEqual(2);
        }
        // Shells may switch between the root on the sixth and on the fifth string.
        const shells = voiceLeadPath(twoFiveOne, [5, 3, 2], TUNING, {
            orders: SHELL_ROOT_7_3,
            layouts: [{ strings: [5, 4, 3], orders: SHELL_ROOT_3_7 }, { strings: [4, 2, 1], orders: SHELL_ROOT_7_3 }, { strings: [4, 3, 2], orders: SHELL_ROOT_3_7 }],
        });
        // Dm7 on the fifth string, G7 on the sixth, Cmaj7 back on the fifth: the hand stays around frets 3–5.
        expect(shells.map((voicing) => voicing.strings[0])).toEqual([4, 5, 4]);
        expect(Math.max(...shells.flatMap((voicing) => voicing.frets)) - Math.min(...shells.flatMap((voicing) => voicing.frets))).toBeLessThanOrEqual(4);
    });

    it("places open strings in the right octave, also in other tunings", () => {
        expect(openStringMidi(TUNING, 0)).toBe(64);
        expect(openStringMidi(TUNING, 5)).toBe(40);
        expect(openStringMidi(["E", "B", "G", "D", "A", "D"] as NoteName[], 5)).toBe(38);
    });
});

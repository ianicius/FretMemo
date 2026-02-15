import { describe, expect, it } from "vitest";
import {
    areEnharmonic,
    formatPitchClass,
    formatPitchClassWithEnharmonic,
    getPitchClassIndex,
    pitchClassIndexFromMidi,
    toSharpPitchClass,
} from "../noteNotation";

describe("noteNotation", () => {
    it("normalizes enharmonic pitch classes to the same index", () => {
        expect(getPitchClassIndex("A#")).toBe(10);
        expect(getPitchClassIndex("Bb")).toBe(10);
        expect(getPitchClassIndex("Gb")).toBe(6);
        expect(getPitchClassIndex("F#")).toBe(6);
    });

    it("compares enharmonics correctly", () => {
        expect(areEnharmonic("A#", "Bb")).toBe(true);
        expect(areEnharmonic("C#", "Db")).toBe(true);
        expect(areEnharmonic("A", "Bb")).toBe(false);
    });

    it("formats pitch classes by notation preference", () => {
        expect(formatPitchClass(10, "sharps")).toBe("A#");
        expect(formatPitchClass(10, "flats")).toBe("Bb");
        expect(formatPitchClass("Bb", "sharps")).toBe("A#");
        expect(formatPitchClass("A#", "flats")).toBe("Bb");
    });

    it("shows enharmonic companion for accidental notes", () => {
        expect(formatPitchClassWithEnharmonic(6, "sharps")).toBe("F# (Gb)");
        expect(formatPitchClassWithEnharmonic(10, "flats")).toBe("Bb (A#)");
        expect(formatPitchClassWithEnharmonic(0, "flats")).toBe("C");
    });

    it("converts arbitrary notes to canonical sharp pitch classes", () => {
        expect(toSharpPitchClass("Bb")).toBe("A#");
        expect(toSharpPitchClass("Db")).toBe("C#");
        expect(toSharpPitchClass("E#")).toBe("F");
    });

    it("maps midi notes to pitch classes", () => {
        expect(pitchClassIndexFromMidi(58)).toBe(10);
        expect(pitchClassIndexFromMidi(69)).toBe(9);
        expect(pitchClassIndexFromMidi(-1)).toBe(11);
    });
});

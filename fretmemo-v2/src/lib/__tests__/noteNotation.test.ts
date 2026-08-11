import { describe, expect, it } from "vitest";
import {
    areEnharmonic,
    formatLocalizedNoteToken,
    formatPitchClass,
    formatPitchClassWithEnharmonic,
    formatTuningSummary,
    getPitchClassIndex,
    pitchClassIndexFromMidi,
    resolveNoteDisplayMode,
    toSharpPitchClass,
} from "../noteNotation";
import i18n from "@/lib/i18n";

describe("noteNotation", () => {
    it.each([
        ["B", "en", "B"],
        ["Bb", "en", "Bb"],
        ["Bm7b5", "en", "Bm7b5"],
        ["Bbmaj7", "en", "Bbmaj7"],
        ["B", "pl", "H"],
        ["Bb", "pl", "B"],
        ["Bm7b5", "pl", "Hm7b5"],
        ["Bbmaj7", "pl-PL", "Bmaj7"],
        ["F#", "pl", "F#"],
    ])("formats %s for %s as %s", (input, language, expected) => {
        expect(formatLocalizedNoteToken(input, language)).toBe(expected);
    });

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

    it("formats every note in a Polish tuning summary", async () => {
        const previousLanguage = i18n.resolvedLanguage ?? i18n.language;
        try {
            await i18n.changeLanguage("pl");
            expect(["E", "A", "D", "G", "B", "E"].map((note) => formatPitchClass(note)).join("-"))
                .toBe("E-A-D-G-H-E");
        } finally {
            await i18n.changeLanguage(previousLanguage || "en");
        }
    });

    it("builds a localized tuning summary through the shared formatter", async () => {
        const previousLanguage = i18n.resolvedLanguage ?? i18n.language;
        try {
            await i18n.changeLanguage("pl");
            expect(formatTuningSummary(["E", "A", "D", "G", "B", "E"], "sharps"))
                .toBe("E-A-D-G-H-E");
        } finally {
            await i18n.changeLanguage(previousLanguage || "en");
        }
    });

    it("shows enharmonic companion for accidental notes", () => {
        expect(formatPitchClassWithEnharmonic(6, "sharps")).toBe("F# (Gb)");
        expect(formatPitchClassWithEnharmonic(10, "flats")).toBe("Bb (A#)");
        expect(formatPitchClassWithEnharmonic(0, "flats")).toBe("C");
    });

    it("resolves random notation deterministically per seed", () => {
        const first = resolveNoteDisplayMode("random", "question-1");
        const second = resolveNoteDisplayMode("random", "question-1");
        const other = resolveNoteDisplayMode("random", "question-2");

        expect(first).toBe(second);
        expect(["sharps", "flats"]).toContain(first);
        expect(["sharps", "flats"]).toContain(other);
    });

    it("formats random notation consistently for the same prompt seed", () => {
        const first = formatPitchClass(10, "random", "prompt-1");
        const second = formatPitchClass("Bb", "random", "prompt-1");
        const withDifferentPrompt = formatPitchClass(10, "random", "prompt-2");

        expect(first).toBe(second);
        expect(["A#", "Bb"]).toContain(first);
        expect(["A#", "Bb"]).toContain(withDifferentPrompt);
    });

    it("supports advanced accidental complexity with deterministic naming", () => {
        const advancedOne = formatPitchClass(1, "sharps", "advanced-seed", "advanced");
        const advancedTwo = formatPitchClass("C#", "sharps", "advanced-seed", "advanced");
        const standard = formatPitchClass(1, "sharps", "advanced-seed", "standard");

        expect(advancedOne).toBe(advancedTwo);
        expect(["C#", "B##"]).toContain(advancedOne);
        expect(standard).toBe("C#");
    });

    it("shows advanced accidental as primary with standard enharmonic fallback", () => {
        const label = formatPitchClassWithEnharmonic(10, "sharps", "advanced-enharmonic", "advanced");
        const firstToken = label.split(" ")[0];
        expect(["A#", "Cbb"]).toContain(firstToken);
        expect(label.includes("(Bb)")).toBe(true);
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

/**
 * Tests for the improv display helpers (XP-4 fix): prompt/hint values get
 * the Polish note notation only on note-token fields — matching always
 * happens on raw tokens elsewhere, so this is display-only.
 */
import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import { localizeAnswer, localizePromptValues } from "../display";

describe("localizePromptValues", () => {
    afterEach(async () => {
        await i18n.changeLanguage("en");
    });

    it("passes values through unchanged in English", () => {
        const values = { key: "Bb", chord: "Bb7", count: 5, label: "Backdoor ii-V-I" };
        expect(localizePromptValues(values)).toEqual(values);
    });

    it("applies Polish notation to note-token fields in Polish", async () => {
        await i18n.changeLanguage("pl");
        expect(
            localizePromptValues({ key: "Bb", chord: "Bb7", dominant: "B7", target: "Dm7", source: "Bb Mixolydian" }),
        ).toEqual({ key: "B", chord: "B7", dominant: "H7", target: "Dm7", source: "B Mixolydian" });
    });

    it("localizes comma- and dash-joined note lists, keeping separators", async () => {
        await i18n.changeLanguage("pl");
        expect(localizePromptValues({ list: "Bb, Eb" })).toEqual({ list: "B, Eb" });
        expect(localizePromptValues({ notes: "Bb-D-F" })).toEqual({ notes: "B-D-F" });
        expect(localizePromptValues({ cycle: "B–G–Eb–D" })).toEqual({ cycle: "H–G–Eb–D" });
        expect(localizePromptValues({ keys: "B, G, Eb" })).toEqual({ keys: "H, G, Eb" });
    });

    it("leaves non-note fields untouched (no B-prefix mangling)", async () => {
        await i18n.changeLanguage("pl");
        const values = { label: "Backdoor ii-V-I", characteristic: "b6", count: 5, type: "flats", pattern: "1 2 b3 4 5 6 b7" };
        expect(localizePromptValues(values)).toEqual(values);
    });

    it("translates mode names and parent scales, and localizes notes inside answers", async () => {
        await i18n.changeLanguage("pl");
        expect(localizePromptValues({ mode: "Dorian" })).toEqual({ mode: "dorycki (Dorian)" });
        expect(localizeAnswer("Bb melodic minor")).toBe("B-moll melodyczna");
        expect(localizeAnswer("Bm7–E7")).toBe("Hm7–E7");
        expect(localizeAnswer("Bb C D Eb")).toBe("B C D Eb");
        expect(localizeAnswer("Dorian b2")).toBe("dorycki b2");
        expect(localizeAnswer("improv.q.keySig.flats")).toBe("bemole");
    });

    it("keeps numbers as numbers", async () => {
        await i18n.changeLanguage("pl");
        const localized = localizePromptValues({ count: 5, key: "Bb" });
        expect(localized.count).toBe(5);
        expect(localized.key).toBe("B");
    });
});

describe("chord parsing used by the backing loops", () => {
    it("plays every curriculum chord as a real chord (no single-note fallback)", async () => {
        const { CURRICULUM } = await import("@/data/improv/curriculum");
        const { getChordMidis } = await import("../chords");
        for (const module of CURRICULUM) {
            for (const exercise of module.exercises) {
                if (exercise.engine !== "backing-improv") continue;
                const params = exercise.params as { progression: Array<string | { chord: string }>; variants?: Array<{ progression: Array<string | { chord: string }> }> };
                for (const progression of [params.progression, ...(params.variants ?? []).map((variant) => variant.progression)]) {
                    for (const entry of progression) {
                        const chord = typeof entry === "string" ? entry : entry.chord;
                        expect(getChordMidis(chord, 48).length, chord).toBeGreaterThanOrEqual(3);
                    }
                }
            }
        }
    });
});

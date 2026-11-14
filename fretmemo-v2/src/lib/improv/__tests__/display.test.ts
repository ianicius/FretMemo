/**
 * Tests for the improv display helpers (XP-4 fix): prompt/hint values get
 * the Polish note notation only on note-token fields — matching always
 * happens on raw tokens elsewhere, so this is display-only.
 */
import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import { localizePromptValues } from "../display";

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
        const values = { label: "Backdoor ii-V-I", mode: "Dorian", characteristic: "b6", count: 5, type: "flats", pattern: "1 2 b3 4 5 6 b7" };
        expect(localizePromptValues(values)).toEqual(values);
    });

    it("keeps numbers as numbers", async () => {
        await i18n.changeLanguage("pl");
        const localized = localizePromptValues({ count: 5, key: "Bb" });
        expect(localized.count).toBe(5);
        expect(localized.key).toBe("B");
    });
});

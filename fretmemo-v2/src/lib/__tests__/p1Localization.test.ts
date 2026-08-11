import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/locales/en/translation.json";
import pl from "@/locales/pl/translation.json";
import i18n from "@/lib/i18n";

function flatten(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
}

function normalizePluralKey(key: string): string {
  return key.replace(/_(one|few|many|other|zero|two)$/, "");
}

const forbiddenLiterals = {
  "components/layout/AppShell.tsx": ["Skip to main content"],
  "components/layout/DarkModeToggle.tsx": ["Switch to Light Mode", "Switch to Dark Mode", "Light Mode", "Dark Mode"],
  "components/ui/mastery-bar.tsx": ["Mastery progress", "% mastery"],
  "components/fretboard/NoteDot.tsx": ["Note at string"],
  "components/practice/AnswerButtons.tsx": ["Answer ${displayNote}"],
  "pages/Practice.tsx": ["5 streak! Keep it up!", "Amazing! 10 streak!", "Perfect Session! 20 streak!", "Streak broken at"],
};

describe("P1 localization", () => {
  it.each([
    ["library.summary.modes", 1, "1 tryb • 0% śr"],
    ["library.summary.modes", 2, "2 tryby • 0% śr"],
    ["library.summary.modes", 5, "5 trybów • 0% śr"],
    ["library.summary.modes", 22, "22 tryby • 0% śr"],
    ["library.summary.exercises", 1, "1 ćwiczenie • 0% śr"],
    ["library.summary.exercises", 2, "2 ćwiczenia • 0% śr"],
    ["library.summary.exercises", 5, "5 ćwiczeń • 0% śr"],
    ["library.theorySummary", 6, "6 narzędzi"],
    ["library.earSummary", 4, "4 tryby"],
  ])("renders %s count %i in Polish", (key, count, expected) => {
    expect(i18n.getFixedT("pl")(key, { count, avg: 0 })).toBe(expected);
  });

  it("keeps normalized EN and PL catalog keys in parity", () => {
    const enKeys = new Set(flatten(en).map(normalizePluralKey));
    const plKeys = new Set(flatten(pl).map(normalizePluralKey));
    expect([...enKeys].filter((key) => !plKeys.has(key))).toEqual([]);
    expect([...plKeys].filter((key) => !enKeys.has(key))).toEqual([]);
  });

  it("removes audited English literals from localized components", () => {
    for (const [file, literals] of Object.entries(forbiddenLiterals)) {
      const source = readFileSync(resolve(process.cwd(), "src", file), "utf8");
      for (const literal of literals) {
        expect(source).not.toContain(literal);
      }
    }
  });
});

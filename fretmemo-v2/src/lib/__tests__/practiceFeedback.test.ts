/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import {
  getPracticeFeedbackTone,
  getPromptFeedback,
  translatePracticeFeedback,
  type PracticeFeedback,
} from "../practiceFeedback";

describe("practice feedback", () => {
  it.each([
    ["en", { kind: "prompt", mode: "fretboardToNote" }, "Identify the note!"],
    ["pl", { kind: "prompt", mode: "fretboardToNote" }, "Rozpoznaj nutę!"],
    ["en", { kind: "correct" }, "Correct!"],
    ["pl", { kind: "correct" }, "Poprawnie!"],
    ["pl", { kind: "incorrect-note", actualNote: "B" }, "Niepoprawnie! Prawidłowa nuta: H"],
    ["pl", { kind: "incorrect-position", stringNumber: 4, fret: 5 }, "Niepoprawnie! Prawidłowo: struna 4, próg 5"],
    ["pl", { kind: "too-slow" }, "Za wolno!"],
  ])("renders %s feedback", (language, feedback, expected) => {
    const t = i18n.getFixedT(language);
    const formatNote = (note: string) => language === "pl" && note === "B" ? "H" : note;
    expect(translatePracticeFeedback(feedback as PracticeFeedback, t, formatNote)).toBe(expected);
  });

  it("derives styling from semantic feedback rather than English text", () => {
    expect(getPracticeFeedbackTone({ kind: "correct" })).toBe("success");
    expect(getPracticeFeedbackTone({ kind: "too-slow" })).toBe("error");
    expect(getPracticeFeedbackTone(getPromptFeedback("playNotes"))).toBe("neutral");
  });

  it("keeps user-visible feedback literals out of the game store", () => {
    const source = readFileSync(resolve(process.cwd(), "src/stores/useGameStore.ts"), "utf8");
    for (const literal of [
      "Identify the note!",
      "Pick the correct tab position!",
      "Play the note (mic)!",
      "Play the tab sequence (mic)!",
      "Correct!",
      "Incorrect! It was",
      "Too slow!",
    ]) {
      expect(source).not.toContain(literal);
    }
  });
});

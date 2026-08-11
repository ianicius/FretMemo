import type { PracticeMode } from "@/stores/useGameStore";

export type PracticeFeedback =
  | { kind: "prompt"; mode: PracticeMode }
  | { kind: "correct" }
  | { kind: "incorrect-note"; actualNote: string }
  | { kind: "incorrect-position"; stringNumber: number; fret: number }
  | { kind: "too-slow" }
  | { kind: "incorrect-detected"; note: string }
  | { kind: "hint"; note: string; penalty: number };

const PROMPT_KEYS: Record<PracticeMode, string> = {
  fretboardToNote: "practice.feedback.prompts.identifyNote",
  tabToNote: "practice.feedback.prompts.identifyNote",
  noteToTab: "practice.feedback.prompts.pickTab",
  playNotes: "practice.feedback.prompts.playNote",
  playTab: "practice.feedback.prompts.playSequence",
};

export function getPromptFeedback(mode: PracticeMode): PracticeFeedback {
  return { kind: "prompt", mode };
}

export function translatePracticeFeedback(
  feedback: PracticeFeedback | null,
  translate: (key: string, options?: Record<string, unknown>) => string,
  formatNote: (note: string) => string = (note) => note,
): string {
  if (!feedback) return "";

  switch (feedback.kind) {
    case "prompt":
      return translate(PROMPT_KEYS[feedback.mode]);
    case "correct":
      return translate("practice.feedback.correct");
    case "incorrect-note":
      return translate("practice.feedback.incorrectNote", { note: formatNote(feedback.actualNote) });
    case "incorrect-position":
      return translate("practice.feedback.incorrectPosition", { string: feedback.stringNumber, fret: feedback.fret });
    case "too-slow":
      return translate("practice.feedback.tooSlow");
    case "incorrect-detected":
      return translate("practice.feedback.incorrectDetected", { note: formatNote(feedback.note) });
    case "hint":
      return translate("practice.feedback.hint", { note: formatNote(feedback.note), penalty: feedback.penalty });
  }
}

export function getPracticeFeedbackTone(
  feedback: PracticeFeedback,
): "success" | "error" | "neutral" {
  if (feedback.kind === "correct") return "success";
  if (["incorrect-note", "incorrect-position", "too-slow", "incorrect-detected"].includes(feedback.kind)) {
    return "error";
  }
  return "neutral";
}

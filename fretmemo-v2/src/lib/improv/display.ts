/**
 * Display helpers for the improv engines (run improv-training-2026-11-13).
 * Kept out of the component files so they stay fast-refresh friendly
 * (components-only exports).
 */

import { formatLocalizedNoteToken } from "@/lib/noteNotation";
import i18n from "@/lib/i18n";
import type { ImprovEngineType } from "@/data/improv/curriculum";

export const ENGINE_LABEL_KEYS: Record<ImprovEngineType, string> = {
    "fretboard-quiz": "improv.engine.fretboardQuiz",
    "choice-quiz": "improv.engine.choiceQuiz",
    "diagram-drill": "improv.engine.diagramDrill",
    "backing-improv": "improv.engine.backingLoop",
};

/** Localizes a note/chord token for display (B→H convention in Polish). */
export function localizeToken(value: string): string {
    return formatLocalizedNoteToken(value, i18n.resolvedLanguage ?? i18n.language);
}

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

/**
 * Question/hint value fields that hold a single note or chord token
 * ("Bb", "Db7", "Dm7"…) and follow the B→H display convention.
 * Field names are the generator contract in src/lib/improv/questions.ts;
 * matching always happens on raw tokens — this map is display-only.
 */
const NOTE_TOKEN_FIELDS = new Set(["key", "chord", "sub", "v", "dominant", "target", "ii", "first", "second", "source"]);
/** Comma-joined note tokens ("F#, C#, G#"). */
const LIST_NOTE_FIELDS = new Set(["list", "keys"]);
/** Dash-joined note tokens ("A-C#-E" triad spellings, "B–G–Eb…" cycles). */
const DASH_NOTE_FIELDS = new Set(["notes", "cycle"]);

function localizeJoined(value: string, separator: RegExp, joiner: string): string {
    return value
        .split(separator)
        .map((token) => formatLocalizedNoteToken(token.trim(), i18n.resolvedLanguage ?? i18n.language))
        .join(joiner);
}

/**
 * Prepares generator prompt/hint values for interpolation: note-token fields
 * get the Polish display convention, everything else passes through. Pure
 * over the values — the raw tokens in `options`/`correctIndex` are untouched,
 * so answer matching is unaffected.
 */
export function localizePromptValues(
    values: Record<string, string | number>,
): Record<string, string | number> {
    const language = i18n.resolvedLanguage ?? i18n.language;
    if (!language.toLowerCase().startsWith("pl")) return values;
    const localized: Record<string, string | number> = {};
    for (const [field, value] of Object.entries(values)) {
        if (typeof value === "number") {
            localized[field] = value;
        } else if (NOTE_TOKEN_FIELDS.has(field)) {
            localized[field] = formatLocalizedNoteToken(value, language);
        } else if (LIST_NOTE_FIELDS.has(field)) {
            localized[field] = localizeJoined(value, /,/, ", ");
        } else if (DASH_NOTE_FIELDS.has(field)) {
            localized[field] = localizeJoined(value, /[-–]/, value.includes("–") ? "–" : "-");
        } else {
            localized[field] = value;
        }
    }
    return localized;
}

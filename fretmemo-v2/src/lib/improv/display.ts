/**
 * Display helpers for the improv engines (run improv-training-2026-11-13).
 * Kept out of the component files so they stay fast-refresh friendly
 * (components-only exports).
 */

import { formatLocalizedNoteToken } from "@/lib/noteNotation";
import i18n from "@/lib/i18n";
import type { ImprovEngineType } from "@/data/improv/curriculum";

/**
 * Applied to (or around) every Fretboard rendered by improv: string rows grow with the
 * note dot (`.note-dot` = clamp(16px, 4.6vw, 34px), ×1.12 when active), so markers on
 * adjacent strings never overlap at desktop widths. Phone rows stay 1.75rem.
 */
export const IMPROV_FRETBOARD_ROWS = "[&_.fret-cell]:min-h-[clamp(1.75rem,5.6vw,2.75rem)]";

export const ENGINE_LABEL_KEYS: Record<ImprovEngineType, string> = {
    "practice-link": "improv.engine.practiceLink",
    "choice-quiz": "improv.engine.choiceQuiz",
    "diagram-drill": "improv.engine.diagramDrill",
    "backing-improv": "improv.engine.backingLoop",
};

/** Localizes a note/chord token for display (B→H convention in Polish). */
export function localizeToken(value: string): string {
    return formatLocalizedNoteToken(value, i18n.resolvedLanguage ?? i18n.language);
}

/** Chord/note tokens inside longer answers ("Dm7–G7", "D E F# G", "Bb, Eb"). */
const EMBEDDED_TOKEN = /(^|[\s,–(-])([A-G][#b]?[0-9mMajdiugslt#b()+]*)(?=$|[\s,–)-])/g;
const PARENT_MINOR = /^([A-G][#b]?) (melodic|harmonic) minor$/;

/**
 * Display text of a raw answer/label token. Matching always uses the raw
 * value; this is display-only:
 * - "improv.…" keys are translated;
 * - words with an `improv.term.*` entry (mode names, chord types,
 *   "major"…) use the localized term;
 * - "G melodic minor" style parents use a localized template;
 * - everything else gets the note notation on each embedded chord token.
 */
export function localizeAnswer(value: string): string {
    if (value.startsWith("improv.")) return i18n.t(value);
    const termKey = `improv.term.${value}`;
    if (i18n.exists(termKey)) return i18n.t(termKey);
    const parent = PARENT_MINOR.exec(value);
    if (parent) {
        return i18n.t(`improv.term.parentMinor.${parent[2]}`, { key: localizeToken(parent[1] as string) });
    }
    return value.replace(EMBEDDED_TOKEN, (_match, lead: string, token: string) => `${lead}${localizeToken(token)}`);
}

/** Prompt/hint fields holding a mode name, chord-type label or parent scale. */
const TERM_FIELDS = new Set(["mode", "label", "type", "parent"]);

/**
 * Question/hint value fields that hold a single note or chord token
 * ("Bb", "Db7", "Dm7"…) and follow the B→H display convention.
 * Field names are the generator contract in src/lib/improv/questions.ts;
 * matching always happens on raw tokens — this map is display-only.
 */
const NOTE_TOKEN_FIELDS = new Set(["key", "chord", "sub", "v", "dominant", "target", "ii", "first", "second", "source", "root", "offset"]);
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
    const isPolish = language.toLowerCase().startsWith("pl");
    const localized: Record<string, string | number> = {};
    for (const [field, value] of Object.entries(values)) {
        if (typeof value === "number") {
            localized[field] = value;
        } else if (TERM_FIELDS.has(field)) {
            localized[field] = localizeAnswer(value);
        } else if (!isPolish) {
            localized[field] = value;
        } else if (NOTE_TOKEN_FIELDS.has(field)) {
            // Covers single tokens ("Bb7") and sequences ("Em7–A7–B").
            localized[field] = value.replace(EMBEDDED_TOKEN, (_match, lead: string, token: string) => `${lead}${formatLocalizedNoteToken(token, language)}`);
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

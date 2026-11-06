/**
 * Tab editor operations (roadmap R-07) on the live alphaTab model.
 *
 * Pure functions over the real alphaTab model objects (Score/Beat/Note are
 * passed in by the caller — this module never imports alphaTab at runtime,
 * keeping the editor logic unit-testable and the main bundle lean). Callers
 * must run `score.finish(settings)` and refresh the API after a batch of
 * mutations — alphaTab recomputes beat indices, playback starts and note
 * chaining only there.
 */

/** Minimal structural shape of an alphaTab Beat used by the editor. */
export interface EditorBeat {
    notes: Array<{ string: number; fret: number }>;
    duration: number;
    dots: number;
    isRest: boolean;
    isEmpty: boolean;
    addNote(note: { string: number; fret: number }): void;
    removeNote(note: { string: number; fret: number }): void;
    getNoteOnString(string: number): { string: number; fret: number } | null;
    updateDurations(): void;
}

/** Per-string fret summary (index 0 = string 1, the bottom tab line). */
export type BeatStringSummary = Array<number | null>;

function findNoteOnString(beat: EditorBeat, string: number): { string: number; fret: number } | undefined {
    return beat.notes.find((note) => note.string === string);
}

/** Sets the fret of the existing note on `string` (1-based). */
export function setNoteFret(beat: EditorBeat, string: number, fret: number): void {
    if (!Number.isInteger(fret) || fret < 0) {
        throw new Error(`Invalid fret: ${fret}`);
    }
    const note = findNoteOnString(beat, string);
    if (!note) {
        throw new Error(`No note on string ${string}`);
    }
    note.fret = fret;
}

/**
 * Adds a new note on a free string. `makeNote` must return a real alphaTab
 * `model.Note` — the model requires actual class instances (score.finish
 * calls methods like `note.chain()` on every note).
 */
export function addNoteToString(
    beat: EditorBeat,
    string: number,
    fret: number,
    makeNote: () => { string: number; fret: number },
): void {
    if (!Number.isInteger(fret) || fret < 0) {
        throw new Error(`Invalid fret: ${fret}`);
    }
    if (findNoteOnString(beat, string)) {
        throw new Error(`String ${string} already has a note`);
    }
    const note = makeNote();
    note.string = string;
    note.fret = fret;
    beat.addNote(note as never);
}

/** Removes the note from a string. */
export function removeNoteFromString(beat: EditorBeat, string: number): void {
    const note = findNoteOnString(beat, string);
    if (!note) {
        throw new Error(`No note on string ${string}`);
    }
    beat.removeNote(note);
}

/** Clears every note — the beat becomes an explicit rest. */
export function clearBeat(beat: EditorBeat): void {
    for (const note of [...beat.notes]) {
        beat.removeNote(note);
    }
    // Mark explicitly: alphaTab's isRest getter ORs this in, and an empty
    // beat with the flag unset renders as ghost silence in some paths.
    beat.isEmpty = true;
}

const KNOWN_DURATIONS = new Set<number>([
    -4, -2, 1, 2, 4, 8, 16, 32, 64, 128, 256,
]);

/** Sets the beat duration (alphaTab Duration value) and dot count. */
export function setBeatDuration(
    beat: EditorBeat,
    duration: number,
    dots = 0,
): void {
    if (!KNOWN_DURATIONS.has(duration)) {
        throw new Error(`Unknown duration: ${duration}`);
    }
    if (!Number.isInteger(dots) || dots < 0 || dots > 2) {
        throw new Error(`Invalid dots: ${dots}`);
    }
    beat.duration = duration;
    beat.dots = dots;
    beat.updateDurations();
}

/** Per-string fret summary for the editor panel (null = no note on string). */
export function beatSummary(beat: EditorBeat, stringCount: number): BeatStringSummary {
    const summary: BeatStringSummary = Array.from({ length: stringCount }, () => null);
    for (const note of beat.notes) {
        if (note.string >= 1 && note.string <= stringCount) {
            summary[note.string - 1] = note.fret;
        }
    }
    return summary;
}

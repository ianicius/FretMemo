import type { NoteName } from "@/types/fretboard";

export const NOTES: NoteName[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const STANDARD_TUNING: NoteName[] = ["E", "B", "G", "D", "A", "E"]; // High E to Low E

// Helper to get note at specific fret
export function getNoteAt(openNote: NoteName, fret: number): NoteName {
    const startIndex = NOTES.indexOf(openNote);
    const targetIndex = (startIndex + fret) % 12;
    return NOTES[targetIndex];
}

export const FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

export function isMarker(fret: number): boolean {
    return FRET_MARKERS.includes(fret);
}

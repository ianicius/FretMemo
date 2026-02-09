export type NoteName = "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";

export interface Position {
    stringIndex: number; // 0 (High E) to 5 (Low E) or configurable
    fret: number;
    note: NoteName;
}

export type FretboardLayer = "standard" | "heatmap" | "scale" | "intervals";

export interface NoteStatus {
    position: Position;
    status: "idle" | "active" | "correct" | "incorrect";
    opacity?: number; // For heatmap
    label?: string; // For intervals/scales
    color?: string; // Custom override
    feedbackText?: string; // Short contextual feedback near active note
    emphasis?: "normal" | "strong"; // Optional visual emphasis for active instruction notes
}

export interface FretboardProps {
    tuning?: NoteName[]; // Default: E A D G B E
    frets?: number; // Default: 12 or 24
    showFretNumbers?: boolean;
    leftHanded?: boolean;
    activeLayer?: FretboardLayer;

    // Interaction
    interactive?: boolean;
    onNoteClick?: (pos: Position) => void;

    // Data for layers
    heatmapData?: Map<string, number>; // "string-fret" -> accuracy 0-1
    activeNotes?: NoteStatus[]; // Notes to highlight
}

/**
 * Fretboard shown with a choice question: the given notes in open position
 * (frets 0–4). With `onPick` the dots are the answer buttons.
 */

import { useMemo } from "react";
import { Note } from "tonal";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { getNoteAt } from "@/lib/constants";
import { normalizeTuning } from "@/lib/tuning";
import { IMPROV_FRETBOARD_ROWS } from "@/lib/improv/display";
import type { QuestionVisual } from "@/lib/improv/questions";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { NoteStatus, Position } from "@/types/fretboard";

const LAST_FRET = 4;

interface QuestionFretboardProps {
    visual: Extract<QuestionVisual, { kind: "fretboard" }>;
    /** The chosen option once the question is answered. */
    selected: string | null;
    onPick?: (note: string) => void;
}

export function QuestionFretboard({ visual, selected, onPick }: QuestionFretboardProps) {
    const leftHanded = useSettingsStore((state) => state.full.instrument.leftHanded);
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);

    const dotAt = (position: Position) => {
        const chroma = Note.chroma(getNoteAt(tuning[position.stringIndex] ?? "C", position.fret));
        return visual.dots.find((dot) => Note.chroma(dot.note) === chroma);
    };

    const activeNotes: NoteStatus[] = [];
    tuning.forEach((_open, stringIndex) => {
        for (let fret = 0; fret <= LAST_FRET; fret += 1) {
            const position: Position = { stringIndex, fret, note: getNoteAt(tuning[stringIndex] ?? "C", fret) };
            const dot = dotAt(position);
            if (!dot) continue;
            const revealed = Boolean(selected) && visual.reveal?.includes(dot.note);
            const wrongPick = Boolean(selected) && visual.tap && dot.note === selected && !revealed;
            activeNotes.push({
                position,
                status: revealed ? "correct" : wrongPick ? "incorrect" : "active",
                label: dot.note,
                emphasis: dot.strong ? "strong" : "normal",
            });
        }
    });

    return (
        <Fretboard
            frets={LAST_FRET}
            activeNotes={activeNotes}
            tuning={tuning}
            leftHanded={leftHanded}
            fitContainer
            onNoteClick={onPick ? (position) => { const dot = dotAt(position); if (dot) onPick(dot.note); } : undefined}
            className={`rounded-lg border border-border bg-card/60 ${IMPROV_FRETBOARD_ROWS}`}
        />
    );
}

import { useState, useMemo } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { normalizeTuning } from "@/lib/tuning";
import { getNoteAt, NOTES } from "@/lib/constants";
import { areEnharmonic, formatPitchClass } from "@/lib/noteNotation";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { Select } from "@/components/ui/select";
import type { NoteStatus, NoteName } from "@/types/fretboard";

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const CAGED_SHAPES: Record<string, { label: string; color: string; offsets: number[][] }> = {
    C: {
        label: "C Shape",
        color: "#ef4444",
        offsets: [[0, 3], [1, 3], [2, 2], [3, 0], [4, 1], [5, 0]],
    },
    A: {
        label: "A Shape",
        color: "#f97316",
        offsets: [[1, 0], [2, 2], [3, 2], [4, 2], [5, 0]],
    },
    G: {
        label: "G Shape",
        color: "#eab308",
        offsets: [[0, 3], [1, 0], [2, 0], [3, 0], [4, 0], [5, 3]],
    },
    E: {
        label: "E Shape",
        color: "#22c55e",
        offsets: [[0, 0], [1, 0], [2, 1], [3, 2], [4, 2], [5, 0]],
    },
    D: {
        label: "D Shape",
        color: "#3b82f6",
        offsets: [[2, 0], [3, 2], [4, 3], [5, 2]],
    },
};

const CAGED_ORDER = ["C", "A", "G", "E", "D"];

const SHAPE_BASE_FRETS: Record<string, number> = {
    C: 0, A: 3, G: 5, E: 8, D: 10,
};

export default function CagedVisualizer() {
    const [root, setRoot] = useState<NoteName>("C");
    const [enabledShapes, setEnabledShapes] = useState<Set<string>>(new Set(CAGED_ORDER));
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const notation = useSettingsStore((state) => state.full.instrument.notation);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);
    const maxFret = 15;

    const semitoneOffset = NOTES.indexOf(root);

    const activeNotes: NoteStatus[] = useMemo(() => {
        const result: NoteStatus[] = [];

        for (const [shapeKey, shape] of Object.entries(CAGED_SHAPES)) {
            if (!enabledShapes.has(shapeKey)) continue;
            const baseFret = SHAPE_BASE_FRETS[shapeKey] + semitoneOffset;

            for (const [stringIdx, fretOffset] of shape.offsets) {
                const fret = baseFret + fretOffset;
                if (fret < 0 || fret > maxFret) continue;

                const note = getNoteAt(tuning[stringIdx], fret);
                const isRoot = areEnharmonic(note, root);

                result.push({
                    position: { stringIndex: stringIdx, fret, note },
                    status: "active",
                    label: formatPitchClass(note, notation),
                    color: isRoot ? "#ef4444" : shape.color,
                    emphasis: isRoot ? "strong" : "normal",
                });
            }
        }

        return result;
    }, [enabledShapes, tuning, semitoneOffset, maxFret, root, notation]);

    const toggleShape = (shape: string) => {
        setEnabledShapes((prev) => {
            const next = new Set(prev);
            if (next.has(shape)) next.delete(shape);
            else next.add(shape);
            return next;
        });
    };

    const shapeButtonColors: Record<string, string> = {
        C: "bg-red-500 text-white border-transparent",
        A: "bg-orange-500 text-white border-transparent",
        G: "bg-yellow-500 text-black border-transparent",
        E: "bg-green-500 text-white border-transparent",
        D: "bg-blue-500 text-white border-transparent",
    };

    return (
        <div className="space-y-5">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Root</label>
                    <Select
                        value={root}
                        onChange={(e) => setRoot(e.target.value as NoteName)}
                        className="w-20 rounded-lg py-2 font-bold"
                    >
                        {ROOTS.map((r) => (
                            <option key={r} value={r}>{formatPitchClass(r, notation)}</option>
                        ))}
                    </Select>
                </div>

                <div className="space-y-1 flex-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shapes</label>
                    <div className="flex flex-wrap gap-2">
                        {CAGED_ORDER.map((shape) => {
                            const active = enabledShapes.has(shape);
                            return (
                                <button
                                    key={shape}
                                    onClick={() => toggleShape(shape)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${active
                                        ? shapeButtonColors[shape]
                                        : "bg-card border-border text-muted-foreground opacity-50"
                                        }`}
                                >
                                    {CAGED_SHAPES[shape].label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Fretboard */}
            <Fretboard
                tuning={tuning}
                frets={maxFret}
                activeNotes={activeNotes}
                showFretNumbers
            />

            {/* Legend */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">CAGED System</p>
                <p className="mt-1">
                    The CAGED system connects five open chord shapes across the fretboard.
                    Toggle individual shapes to see how they overlap and connect for any root note.
                </p>
            </div>
        </div>
    );
}

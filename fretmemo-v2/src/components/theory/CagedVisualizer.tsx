import { useState, useMemo } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { normalizeTuning } from "@/lib/tuning";
import { getNoteAt, NOTES } from "@/lib/constants";
import { areEnharmonic, formatPitchClass } from "@/lib/noteNotation";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { Select } from "@/components/ui/select";
import type { NoteStatus, NoteName } from "@/types/fretboard";
import { useTranslation } from "react-i18next";

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/**
 * CAGED shapes defined as absolute fret numbers per string in open position.
 * String indices: 0 = high E, 1 = B, 2 = G, 3 = D, 4 = A, 5 = low E
 * null = string not played in this shape.
 * nativeRoot = semitone index of the root in open position (C=0, D=2, E=4, G=7, A=9).
 */
interface CagedShape {
    color: string;
    nativeRoot: number;
    frets: (number | null)[];
}

const CAGED_SHAPES: Record<string, CagedShape> = {
    C: {
        color: "#ef4444",
        nativeRoot: 0, // C
        // Open C: high E=0(E), B=1(C), G=0(G), D=2(E), A=3(C), low E=null
        frets: [0, 1, 0, 2, 3, null],
    },
    A: {
        color: "#f97316",
        nativeRoot: 9, // A
        // Open A: high E=0(E), B=2(C#), G=2(A), D=2(E), A=0(A), low E=null
        frets: [0, 2, 2, 2, 0, null],
    },
    G: {
        color: "#eab308",
        nativeRoot: 7, // G
        // Open G: high E=3(G), B=0(B), G=0(G), D=0(D), A=2(B), low E=3(G)
        frets: [3, 0, 0, 0, 2, 3],
    },
    E: {
        color: "#22c55e",
        nativeRoot: 4, // E
        // Open E: high E=0(E), B=0(B), G=1(G#), D=2(E), A=2(B), low E=0(E)
        frets: [0, 0, 1, 2, 2, 0],
    },
    D: {
        color: "#3b82f6",
        nativeRoot: 2, // D
        // Open D: high E=2(F#), B=3(D), G=2(A), D=0(D), A=null, low E=null
        frets: [2, 3, 2, 0, null, null],
    },
};

const CAGED_ORDER = ["C", "A", "G", "E", "D"];

export default function CagedVisualizer() {
    const { t } = useTranslation();
    const [root, setRoot] = useState<NoteName>("C");
    const [enabledShapes, setEnabledShapes] = useState<Set<string>>(new Set(CAGED_ORDER));
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const notation = useSettingsStore((state) => state.full.instrument.notation);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);
    const maxFret = 15;

    const targetRootIndex = NOTES.indexOf(root);

    const activeNotes: NoteStatus[] = useMemo(() => {
        const result: NoteStatus[] = [];

        for (const [shapeKey, shape] of Object.entries(CAGED_SHAPES)) {
            if (!enabledShapes.has(shapeKey)) continue;

            // How many semitones to shift from native open position
            const shift = (targetRootIndex - shape.nativeRoot + 12) % 12;

            for (let stringIdx = 0; stringIdx < shape.frets.length; stringIdx++) {
                const nativeFret = shape.frets[stringIdx];
                if (nativeFret === null) continue;

                const fret = nativeFret + shift;
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
    }, [enabledShapes, tuning, targetRootIndex, maxFret, root, notation]);

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
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("theory.caged.root")}</label>
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
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("theory.caged.shapes")}</label>
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
                                    {shape}
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
                <p className="font-medium text-foreground">{t("theory.caged.systemTitle")}</p>
                <p className="mt-1">{t("theory.caged.legend")}</p>
            </div>
        </div>
    );
}


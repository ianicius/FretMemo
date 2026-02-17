import { useState, useMemo } from "react";
import { Scale } from "tonal";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { normalizeTuning } from "@/lib/tuning";
import { getNoteAt } from "@/lib/constants";
import { formatPitchClass, getPitchClassIndex } from "@/lib/noteNotation";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { Select } from "@/components/ui/select";
import type { NoteStatus, NoteName } from "@/types/fretboard";

const ROOTS: NoteName[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALE_TYPES = [
    { id: "major", label: "Major (Ionian)" },
    { id: "minor", label: "Minor (Aeolian)" },
    { id: "dorian", label: "Dorian" },
    { id: "mixolydian", label: "Mixolydian" },
    { id: "major pentatonic", label: "Major Pentatonic" },
    { id: "minor pentatonic", label: "Minor Pentatonic" },
    { id: "blues", label: "Blues" },
    { id: "harmonic minor", label: "Harmonic Minor" },
    { id: "melodic minor", label: "Melodic Minor" },
    { id: "phrygian", label: "Phrygian" },
    { id: "lydian", label: "Lydian" },
    { id: "locrian", label: "Locrian" },
];

const DEGREE_COLORS = [
    "#ef4444", // 1 root – red
    "#f97316", // 2 – orange
    "#eab308", // 3 – yellow
    "#22c55e", // 4 – green
    "#06b6d4", // 5 – cyan
    "#3b82f6", // 6 – blue
    "#a855f7", // 7 – purple
];

const DEGREE_BG_CLASSES = [
    "bg-red-500 text-white",
    "bg-orange-500 text-white",
    "bg-yellow-500 text-black",
    "bg-green-500 text-white",
    "bg-cyan-500 text-white",
    "bg-blue-500 text-white",
    "bg-purple-500 text-white",
];

/**
 * Convert tonal interval notation to guitar-standard notation.
 * "1P" → "R",  "3M" → "3",  "3m" → "♭3",  "7m" → "♭7",
 * "4A"/"4a" → "♯4",  "5d" → "♭5",  "2m" → "♭2",  etc.
 */
function formatInterval(interval: string): string {
    // Parse: digit(s) + quality letter
    const match = interval.match(/^(\d+)(.*)/);
    if (!match) return interval;
    const degree = match[1];
    const quality = match[2]; // P, M, m, A, d, etc.

    if (degree === "1" && (quality === "P" || quality === "")) return "R";
    if (quality === "P" || quality === "M") return degree;
    if (quality === "m") return `♭${degree}`;
    if (quality === "A" || quality === "a") return `♯${degree}`;
    if (quality === "d") return `♭${degree}`;
    return interval;
}

export default function ScaleExplorer() {
    const [root, setRoot] = useState<NoteName>("C");
    const [scaleType, setScaleType] = useState("major");
    const [showIntervals, setShowIntervals] = useState(false);
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const notation = useSettingsStore((state) => state.full.instrument.notation);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);
    const maxFret = 12;

    const scaleData = useMemo(() => {
        const scaleObj = Scale.get(`${root} ${scaleType}`);
        const pitchClasses = scaleObj.notes
            .map((note) => getPitchClassIndex(note))
            .filter((pitchClass): pitchClass is number => pitchClass !== null);
        const intervals = scaleObj.intervals;
        return { pitchClasses, intervals, name: scaleObj.name };
    }, [root, scaleType]);

    // Build NoteStatus[] for the existing Fretboard component
    const activeNotes: NoteStatus[] = useMemo(() => {
        const result: NoteStatus[] = [];
        const rootPitchClass = getPitchClassIndex(root);
        if (rootPitchClass === null) return result;

        for (let s = 0; s < tuning.length; s++) {
            for (let f = 0; f <= maxFret; f++) {
                const note = getNoteAt(tuning[s], f);
                const notePitchClass = getPitchClassIndex(note);
                if (notePitchClass === null) continue;
                const degreeIndex = scaleData.pitchClasses.findIndex((pitchClass) => pitchClass === notePitchClass);
                if (degreeIndex < 0) continue;

                const isRoot = notePitchClass === rootPitchClass;
                result.push({
                    position: { stringIndex: s, fret: f, note },
                    status: "active",
                    label: showIntervals ? formatInterval(scaleData.intervals[degreeIndex]) : formatPitchClass(note, notation),
                    color: DEGREE_COLORS[degreeIndex % DEGREE_COLORS.length],
                    emphasis: isRoot ? "strong" : "normal",
                });
            }
        }
        return result;
    }, [tuning, scaleData, showIntervals, maxFret, notation, root]);

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

                <div className="space-y-1 flex-1 min-w-[180px]">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scale</label>
                    <Select
                        value={scaleType}
                        onChange={(e) => setScaleType(e.target.value)}
                        className="w-full rounded-lg py-2 font-bold"
                    >
                        {SCALE_TYPES.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                    </Select>
                </div>

                <div className="flex items-center gap-2 mt-auto">
                    <button
                        onClick={() => setShowIntervals(!showIntervals)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${showIntervals
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-card border-border text-muted-foreground"
                            }`}
                    >
                        {showIntervals ? "Intervals" : "Notes"}
                    </button>
                </div>
            </div>

            {/* Scale notes legend */}
            <div className="flex flex-wrap items-center gap-2">
                {scaleData.pitchClasses.map((pitchClass, i) => (
                    <span
                        key={`${pitchClass}-${i}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${DEGREE_BG_CLASSES[i % DEGREE_BG_CLASSES.length]}`}
                    >
                        {formatInterval(scaleData.intervals[i])} {formatPitchClass(pitchClass, notation)}
                    </span>
                ))}
            </div>

            {/* Reuse existing Fretboard component */}
            <Fretboard
                tuning={tuning}
                frets={maxFret}
                activeNotes={activeNotes}
                showFretNumbers
            />
        </div>
    );
}

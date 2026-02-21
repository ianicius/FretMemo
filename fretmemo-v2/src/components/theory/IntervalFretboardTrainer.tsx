import { useState, useCallback, useMemo } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { normalizeTuning } from "@/lib/tuning";
import { getNoteAt } from "@/lib/constants";
import {
    areEnharmonic,
    formatPitchClass,
    formatPitchClassWithEnharmonic,
    getPitchClassIndex,
} from "@/lib/noteNotation";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, RotateCcw } from "lucide-react";
import type { NoteStatus, NoteName, Position } from "@/types/fretboard";
import { useTranslation } from "react-i18next";

const INTERVALS = [
    { semitones: 1, name: "m2", labelKey: "ear.intervals.labels.m2" },
    { semitones: 2, name: "M2", labelKey: "ear.intervals.labels.M2" },
    { semitones: 3, name: "m3", labelKey: "ear.intervals.labels.m3" },
    { semitones: 4, name: "M3", labelKey: "ear.intervals.labels.M3" },
    { semitones: 5, name: "P4", labelKey: "ear.intervals.labels.P4" },
    { semitones: 6, name: "A4", labelKey: "ear.intervals.labels.A4" },
    { semitones: 7, name: "P5", labelKey: "ear.intervals.labels.P5" },
    { semitones: 8, name: "m6", labelKey: "ear.intervals.labels.m6" },
    { semitones: 9, name: "M6", labelKey: "ear.intervals.labels.M6" },
    { semitones: 10, name: "m7", labelKey: "ear.intervals.labels.m7" },
    { semitones: 11, name: "M7", labelKey: "ear.intervals.labels.M7" },
    { semitones: 12, name: "P8", labelKey: "ear.intervals.labels.P8" },
];

const ROOTS: NoteName[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getRandomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export default function IntervalFretboardTrainer() {
    const { t } = useTranslation();
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const notation = useSettingsStore((state) => state.full.instrument.notation);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);
    const maxFret = 12;

    const [isPlaying, setIsPlaying] = useState(false);
    const [rootNote, setRootNote] = useState<NoteName>("C");
    const [targetInterval, setTargetInterval] = useState(INTERVALS[0]);
    const [rootPosition, setRootPosition] = useState<{ s: number; f: number } | null>(null);
    const [selectedPosition, setSelectedPosition] = useState<{ s: number; f: number } | null>(null);
    const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [enabledIntervals, setEnabledIntervals] = useState<number[]>([3, 4, 5, 7, 12]);

    const targetPitchClass = useMemo(() => {
        const rootPitchClass = getPitchClassIndex(rootNote);
        if (rootPitchClass === null) return null;
        return (rootPitchClass + targetInterval.semitones) % 12;
    }, [rootNote, targetInterval]);
    const displayedRootNote = useMemo(() => formatPitchClass(rootNote, notation), [rootNote, notation]);
    const displayedTargetNote = useMemo(
        () => (targetPitchClass === null ? "" : formatPitchClassWithEnharmonic(targetPitchClass, notation)),
        [targetPitchClass, notation],
    );

    const generateNewQuestion = useCallback(() => {
        const root = getRandomItem(ROOTS);
        const semitones = getRandomItem(enabledIntervals);
        const interval = INTERVALS.find(i => i.semitones === semitones)!;

        // Pick a random valid position for root on fretboard
        const positions: { s: number; f: number }[] = [];
        tuning.forEach((open, s) => {
            for (let f = 0; f <= maxFret; f++) {
                const note = getNoteAt(open, f);
                if (areEnharmonic(note, root)) {
                    positions.push({ s, f });
                }
            }
        });
        if (positions.length === 0) return;
        const pos = getRandomItem(positions);

        setRootNote(root);
        setTargetInterval(interval);
        setRootPosition(pos);
        setSelectedPosition(null);
        setResult(null);
    }, [tuning, enabledIntervals, maxFret]);

    const handleStart = useCallback(() => {
        setIsPlaying(true);
        setScore(0);
        setStreak(0);
        generateNewQuestion();
    }, [generateNewQuestion]);

    const handleCellClick = useCallback((pos: Position) => {
        if (!isPlaying || result !== null || !rootPosition) return;
        if (targetPitchClass === null) return;

        const cellPitchClass = getPitchClassIndex(pos.note);
        if (cellPitchClass === null) return;
        setSelectedPosition({ s: pos.stringIndex, f: pos.fret });
        const isCorrect = cellPitchClass === targetPitchClass;

        if (isCorrect) {
            setResult("correct");
            setScore(s => s + 10 + streak * 2);
            setStreak(s => s + 1);
        } else {
            setResult("incorrect");
            setStreak(0);
        }
    }, [isPlaying, result, rootPosition, targetPitchClass, streak]);

    const toggleInterval = (semitones: number) => {
        setEnabledIntervals(prev => {
            if (prev.includes(semitones)) {
                if (prev.length <= 2) return prev;
                return prev.filter(s => s !== semitones);
            }
            return [...prev, semitones];
        });
    };

    // Build activeNotes for Fretboard
    const activeNotes: NoteStatus[] = useMemo(() => {
        if (!isPlaying || !rootPosition) return [];
        const notes: NoteStatus[] = [];

        // Root highlight
        const rootFretNote = getNoteAt(tuning[rootPosition.s], rootPosition.f);
        notes.push({
            position: { stringIndex: rootPosition.s, fret: rootPosition.f, note: rootFretNote },
            status: "active",
            label: formatPitchClass(rootFretNote, notation),
            color: "#f59e0b",
            emphasis: "strong",
        });

        // After answer: show correct positions + wrong selection
        if (result !== null && targetPitchClass !== null) {
            tuning.forEach((open, s) => {
                for (let f = 0; f <= maxFret; f++) {
                    if (s === rootPosition.s && f === rootPosition.f) continue;
                    const note = getNoteAt(open, f);
                    if (areEnharmonic(note, targetPitchClass)) {
                        notes.push({
                            position: { stringIndex: s, fret: f, note },
                            status: "correct",
                            label: formatPitchClass(note, notation),
                            color: "#22c55e",
                        });
                    }
                }
            });

            if (result === "incorrect" && selectedPosition) {
                const wrongNote = getNoteAt(tuning[selectedPosition.s], selectedPosition.f);
                notes.push({
                    position: { stringIndex: selectedPosition.s, fret: selectedPosition.f, note: wrongNote },
                    status: "incorrect",
                    label: formatPitchClass(wrongNote, notation),
                });
            }
        }

        return notes;
    }, [isPlaying, rootPosition, result, selectedPosition, tuning, targetPitchClass, maxFret, notation]);

    if (!isPlaying) {
        return (
            <div className="flex flex-col items-center gap-6 py-12">
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold">{t("theory.intervalFretboard.title")}</h2>
                    <p className="text-muted-foreground text-sm max-w-md">
                        {t("theory.intervalFretboard.description")}
                    </p>
                </div>

                <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block text-center">{t("theory.intervalFretboard.activeIntervals")}</label>
                    <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
                        {INTERVALS.map(i => (
                            <button
                                key={i.semitones}
                                onClick={() => toggleInterval(i.semitones)}
                                className={cn(
                                    "px-2.5 py-1.5 rounded-lg border text-xs font-bold transition",
                                    enabledIntervals.includes(i.semitones)
                                        ? "bg-primary/10 border-primary text-primary"
                                        : "bg-card border-border text-muted-foreground opacity-50"
                                )}
                            >
                                {i.name}
                            </button>
                        ))}
                    </div>
                </div>

                <Button className="control-btn control-btn--primary" onClick={handleStart}>
                    <Play className="w-4 h-4 mr-2" /> {t("ear.common.startTraining")}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Stats + prompt */}
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-primary">{t("ear.common.score")}: {score}</span>
                    <span className="text-amber-600 dark:text-amber-300">🔥 {streak}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsPlaying(false)} className="text-muted-foreground">{t("ear.common.end")}</Button>
            </div>

            <div className="text-center rounded-xl bg-primary/5 py-3 px-4">
                <span className="text-sm text-muted-foreground">{t("theory.intervalFretboard.findThe")} </span>
                <span className="text-lg font-bold text-primary">{t(targetInterval.labelKey)}</span>
                <span className="text-sm text-muted-foreground"> {t("theory.intervalFretboard.from")} </span>
                <span className="text-lg font-bold">{displayedRootNote}</span>
            </div>

            {/* Feedback */}
            {result && (
                <div className="flex items-center justify-between">
                    <div className={`flex-1 text-center text-sm font-bold rounded-lg py-2 ${result === "correct"
                            ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300"
                            : "text-rose-700 bg-rose-500/10 dark:text-rose-300"
                        }`}>
                        {result === "correct"
                            ? t("theory.intervalFretboard.correctFeedback", {
                                interval: targetInterval.name,
                                root: displayedRootNote,
                                note: displayedTargetNote,
                            })
                            : t("theory.intervalFretboard.wrongFeedback", { note: displayedTargetNote })}
                    </div>
                    <Button variant="outline" size="sm" className="ml-2" onClick={generateNewQuestion}>
                        <RotateCcw className="w-4 h-4 mr-1" /> {t("ear.common.next")}
                    </Button>
                </div>
            )}

            {/* Reuse existing Fretboard */}
            <Fretboard
                tuning={tuning}
                frets={maxFret}
                activeNotes={activeNotes}
                onNoteClick={handleCellClick}
                showFretNumbers
            />
        </div>
    );
}

import { useState, useCallback, useEffect, useMemo } from "react";
import { playTone, initAudio } from "@/lib/audio";
import { useEarTrainingStore } from "@/stores/useEarTrainingStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { normalizeTuning } from "@/lib/tuning";
import { getNoteAt } from "@/lib/constants";
import {
    areEnharmonic,
    formatPitchClass,
    formatPitchClassWithEnharmonic,
    getPitchClassIndex,
    pitchClassIndexFromMidi,
    resolveNoteDisplayMode,
} from "@/lib/noteNotation";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { Button } from "@/components/ui/button";
import { Volume2, RotateCcw, Play, Lightbulb } from "lucide-react";
import type { NoteStatus, Position } from "@/types/fretboard";
import { useTranslation } from "react-i18next";

function getRandomMidi(minMidi: number, maxMidi: number): number {
    return Math.floor(Math.random() * (maxMidi - minMidi + 1)) + minMidi;
}

export default function SoundToFretboard() {
    const { t } = useTranslation();
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const notation = useSettingsStore((state) => state.full.instrument.notation);
    const notationRandomization = useSettingsStore((state) => state.full.instrument.notationRandomization);
    const accidentalComplexity = useSettingsStore((state) => state.full.instrument.accidentalComplexity);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);
    const maxFret = 12;

    const {
        isPlaying,
        currentMidi,
        lastResult,
        score,
        streak,
        totalCorrect,
        totalIncorrect,
        startSession,
        endSession,
        setCurrentNote,
        audioReady,
        setAudioReady,
    } = useEarTrainingStore();

    const [showHint, setShowHint] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<{ s: number; f: number } | null>(null);

    const targetPitchClass = useMemo(
        () => (currentMidi === null ? null : pitchClassIndexFromMidi(currentMidi)),
        [currentMidi],
    );
    const questionNotationSeed = currentMidi === null
        ? "sound-to-fretboard:idle"
        : `sound-to-fretboard:${currentMidi}:${totalCorrect + totalIncorrect}`;
    const notationSeed = notationRandomization === "question"
        ? questionNotationSeed
        : undefined;
    const displayNotation = useMemo(
        () => resolveNoteDisplayMode(notation, notationSeed),
        [notation, notationSeed],
    );
    const displayedTargetNote = useMemo(
        () => (
            targetPitchClass === null
                ? ""
                : formatPitchClassWithEnharmonic(targetPitchClass, displayNotation, notationSeed, accidentalComplexity)
        ),
        [targetPitchClass, displayNotation, notationSeed, accidentalComplexity],
    );

    const handleInitAudio = useCallback(() => {
        initAudio();
        setAudioReady(true);
    }, [setAudioReady]);

    const setQuestion = useCallback((midi: number) => {
        setCurrentNote(midi);
        useEarTrainingStore.setState({
            currentAnswer: String(pitchClassIndexFromMidi(midi)),
            lastResult: null,
        });
    }, [setCurrentNote]);

    const generateNewNote = useCallback(() => {
        const midi = getRandomMidi(40, 72);
        setQuestion(midi);
        setShowHint(false);
        setSelectedPosition(null);
        playTone(midi);
    }, [setQuestion]);

    const handleStart = useCallback(() => {
        handleInitAudio();
        startSession();
        setTimeout(() => {
            const midi = getRandomMidi(40, 72);
            setQuestion(midi);
            playTone(midi);
        }, 300);
    }, [handleInitAudio, startSession, setQuestion]);

    const handleReplay = useCallback(() => {
        if (currentMidi !== null) playTone(currentMidi);
    }, [currentMidi]);

    const handleCellClick = useCallback((pos: Position) => {
        if (!isPlaying || currentMidi === null || lastResult !== null) return;
        if (targetPitchClass === null) return;

        const cellPitchClass = getPitchClassIndex(pos.note);
        if (cellPitchClass === null) return;
        setSelectedPosition({ s: pos.stringIndex, f: pos.fret });
        useEarTrainingStore.getState().submitAnswer(String(cellPitchClass));
    }, [isPlaying, currentMidi, lastResult, targetPitchClass]);

    const handleNext = useCallback(() => {
        generateNewNote();
    }, [generateNewNote]);

    useEffect(() => {
        return () => { endSession(); };
    }, [endSession]);

    // Build activeNotes for Fretboard
    const activeNotes: NoteStatus[] = useMemo(() => {
        if (!isPlaying || lastResult === null || targetPitchClass === null) return [];
        const notes: NoteStatus[] = [];

        // Show all correct positions
        tuning.forEach((open, s) => {
            for (let f = 0; f <= maxFret; f++) {
                const note = getNoteAt(open, f);
                if (areEnharmonic(note, targetPitchClass)) {
                    notes.push({
                        position: { stringIndex: s, fret: f, note },
                        status: "correct",
                        label: formatPitchClass(note, displayNotation, notationSeed, accidentalComplexity),
                        color: "#22c55e",
                    });
                }
            }
        });

        // Show incorrect selection
        if (lastResult === "incorrect" && selectedPosition) {
            const wrongNote = getNoteAt(tuning[selectedPosition.s], selectedPosition.f);
            if (!areEnharmonic(wrongNote, targetPitchClass)) {
                notes.push({
                    position: { stringIndex: selectedPosition.s, fret: selectedPosition.f, note: wrongNote },
                    status: "incorrect",
                    label: formatPitchClass(wrongNote, displayNotation, notationSeed, accidentalComplexity),
                });
            }
        }

        return notes;
    }, [isPlaying, lastResult, selectedPosition, tuning, targetPitchClass, maxFret, displayNotation, notationSeed, accidentalComplexity]);

    if (!isPlaying) {
        return (
            <div className="flex flex-col items-center gap-6 py-12">
                <div className="text-center space-y-2">
                    <Volume2 className="w-12 h-12 mx-auto text-primary/60" />
                    <h2 className="text-xl font-bold">{t("ear.soundToFretboard.title")}</h2>
                    <p className="text-muted-foreground text-sm max-w-md">
                        {t("ear.soundToFretboard.description")}
                    </p>
                </div>
                {!audioReady && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">{t("ear.soundToFretboard.enableAudioHint")}</p>
                )}
                <Button className="control-btn control-btn--primary" onClick={handleStart}>
                    <Play className="w-4 h-4 mr-2" /> {t("ear.common.startTraining")}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Stats bar */}
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-primary">{t("ear.common.score")}: {score}</span>
                    <span className="text-amber-600 dark:text-amber-300">🔥 {streak}</span>
                </div>
                <div className="text-muted-foreground">
                    ✓{totalCorrect} ✗{totalIncorrect}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleReplay} disabled={currentMidi === null}>
                    <Volume2 className="w-4 h-4 mr-1" /> {t("ear.common.replay")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowHint(!showHint)}>
                    <Lightbulb className="w-4 h-4 mr-1" /> {showHint ? t("ear.common.hideHint") : t("ear.common.hint")}
                </Button>
                {lastResult && (
                    <Button variant="outline" size="sm" onClick={handleNext} className="ml-auto">
                        <RotateCcw className="w-4 h-4 mr-1" /> {t("ear.common.next")}
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={endSession} className="ml-auto text-muted-foreground">
                    {t("ear.common.end")}
                </Button>
            </div>

            {/* Hint */}
            {showHint && displayedTargetNote && (
                <div className="text-center text-sm font-bold text-primary bg-primary/5 rounded-lg py-2">
                    {t("ear.soundToFretboard.noteIs", { note: displayedTargetNote })}
                </div>
            )}

            {/* Feedback */}
            {lastResult && (
                <div className={`text-center text-sm font-bold rounded-lg py-2 ${lastResult === "correct"
                    ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300"
                    : "text-rose-700 bg-rose-500/10 dark:text-rose-300"
                    }`}>
                    {lastResult === "correct"
                        ? t("ear.common.correct")
                        : t("ear.soundToFretboard.noteWas", { note: displayedTargetNote })}
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

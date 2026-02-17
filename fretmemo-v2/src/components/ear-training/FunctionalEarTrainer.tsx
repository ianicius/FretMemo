import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { initAudio, playCadence, playFunctionalPrompt, playTone } from "@/lib/audio";
import { NOTES } from "@/lib/constants";
import {
    buildFunctionalQuestion,
    FUNCTIONAL_DEGREES,
    type FunctionalDegree,
    type FunctionalQuestion,
} from "@/lib/functionalEar";
import { formatPitchClass, formatPitchClassWithEnharmonic } from "@/lib/noteNotation";
import { useEarTrainingStore } from "@/stores/useEarTrainingStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { RotateCcw, Play, Volume2, Music2 } from "lucide-react";
import type { NoteName } from "@/types/fretboard";

type KeyMode = "random" | "fixed";

interface DegreeStat {
    correct: number;
    wrong: number;
    avgResponseMs: number;
    samples: number;
}

function createInitialDegreeStats(): Record<FunctionalDegree, DegreeStat> {
    return FUNCTIONAL_DEGREES.reduce((acc, degree) => {
        acc[degree] = { correct: 0, wrong: 0, avgResponseMs: 0, samples: 0 };
        return acc;
    }, {} as Record<FunctionalDegree, DegreeStat>);
}

function sortDegrees(degrees: FunctionalDegree[]): FunctionalDegree[] {
    return [...degrees].sort((a, b) => Number(a) - Number(b));
}

export default function FunctionalEarTrainer() {
    const notation = useSettingsStore((state) => state.full.instrument.notation);
    const checkAndUpdateStreak = useProgressStore((state) => state.checkAndUpdateStreak);
    const recordFunctionalEarAnswer = useProgressStore((state) => state.recordFunctionalEarAnswer);
    const recordSession = useProgressStore((state) => state.recordSession);
    const updatePracticeTime = useProgressStore((state) => state.updatePracticeTime);
    const {
        isPlaying,
        lastResult,
        score,
        streak,
        totalCorrect,
        totalIncorrect,
        currentAnswer,
        startSession,
        endSession,
        submitAnswer,
        setAudioReady,
        setMode,
    } = useEarTrainingStore();

    const [keyMode, setKeyMode] = useState<KeyMode>("random");
    const [fixedKey, setFixedKey] = useState<NoteName>("C");
    const [enabledDegrees, setEnabledDegrees] = useState<FunctionalDegree[]>([...FUNCTIONAL_DEGREES]);
    const [autoNext, setAutoNext] = useState(true);
    const [question, setQuestion] = useState<FunctionalQuestion | null>(null);
    const [selectedDegree, setSelectedDegree] = useState<FunctionalDegree | null>(null);
    const [degreeStats, setDegreeStats] = useState<Record<FunctionalDegree, DegreeStat>>(createInitialDegreeStats);
    const [isAudioBusy, setIsAudioBusy] = useState(false);
    const [audioStateLabel, setAudioStateLabel] = useState<string | null>(null);

    const playbackTokenRef = useRef(0);
    const autoNextTimerRef = useRef<number | null>(null);
    const sessionStartedAtRef = useRef<number | null>(null);
    const sessionFinalizedRef = useRef(false);

    const stopAutoNextTimer = useCallback(() => {
        if (autoNextTimerRef.current !== null) {
            window.clearTimeout(autoNextTimerRef.current);
            autoNextTimerRef.current = null;
        }
    }, []);

    const runPlayback = useCallback(async (label: string, action: () => Promise<void>) => {
        const playbackToken = playbackTokenRef.current + 1;
        playbackTokenRef.current = playbackToken;
        setIsAudioBusy(true);
        setAudioStateLabel(label);
        try {
            await action();
        } finally {
            if (playbackTokenRef.current === playbackToken) {
                setIsAudioBusy(false);
                setAudioStateLabel(null);
            }
        }
    }, []);

    const generateQuestion = useCallback(async (playPrompt = true) => {
        const nextQuestion = buildFunctionalQuestion({
            mode: "major",
            keyRoot: keyMode === "fixed" ? fixedKey : undefined,
            degrees: sortDegrees(enabledDegrees),
        });

        setQuestion(nextQuestion);
        setSelectedDegree(null);
        useEarTrainingStore.setState({
            currentAnswer: nextQuestion.degree,
            currentMidi: nextQuestion.targetMidi,
            currentInterval: null,
            currentChordMidis: null,
            lastResult: null,
        });

        if (!playPrompt) return;
        await runPlayback("Playing context + target...", async () => {
            await playFunctionalPrompt({
                contextChords: nextQuestion.contextChords,
                targetMidi: nextQuestion.targetMidi,
                chordDurationSec: 0.72,
                chordGapSec: 0.06,
                targetDurationSec: 1.0,
                targetGapSec: 0.14,
                includeTarget: true,
            });
        });
    }, [enabledDegrees, fixedKey, keyMode, runPlayback]);

    const handleStart = useCallback(async () => {
        initAudio();
        setAudioReady(true);
        setMode("functional");
        checkAndUpdateStreak();
        sessionStartedAtRef.current = Date.now();
        sessionFinalizedRef.current = false;
        startSession();
        setDegreeStats(createInitialDegreeStats());
        stopAutoNextTimer();
        await generateQuestion(true);
    }, [checkAndUpdateStreak, generateQuestion, setAudioReady, setMode, startSession, stopAutoNextTimer]);

    const finalizeSession = useCallback(() => {
        if (sessionFinalizedRef.current) return;

        const earState = useEarTrainingStore.getState();
        const startedAt = sessionStartedAtRef.current;
        if (!earState.isPlaying && startedAt === null) return;

        const durationSeconds = startedAt
            ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
            : 0;

        if (startedAt && durationSeconds > 0) {
            const minutes = Math.floor(durationSeconds / 60);
            if (minutes > 0) {
                updatePracticeTime(minutes);
            }
        }

        recordSession({
            startedAt,
            correct: earState.totalCorrect,
            incorrect: earState.totalIncorrect,
            durationSeconds,
        });

        sessionFinalizedRef.current = true;
        sessionStartedAtRef.current = null;
        endSession();
    }, [endSession, recordSession, updatePracticeTime]);

    const handleEnd = useCallback(() => {
        playbackTokenRef.current += 1;
        stopAutoNextTimer();
        setIsAudioBusy(false);
        setAudioStateLabel(null);
        finalizeSession();
        setQuestion(null);
        setSelectedDegree(null);
    }, [finalizeSession, stopAutoNextTimer]);

    const handleReplayContext = useCallback(async () => {
        if (!question || isAudioBusy) return;
        await runPlayback("Replaying context...", async () => {
            await playCadence(question.contextChords, { chordDurationSec: 0.72, chordGapSec: 0.06 });
        });
    }, [isAudioBusy, question, runPlayback]);

    const handleReplayTarget = useCallback(async () => {
        if (!question || isAudioBusy) return;
        await runPlayback("Replaying target...", async () => {
            await playTone(question.targetMidi, 1.0);
        });
    }, [isAudioBusy, question, runPlayback]);

    const handleReplayFull = useCallback(async () => {
        if (!question || isAudioBusy) return;
        await runPlayback("Replaying full prompt...", async () => {
            await playFunctionalPrompt({
                contextChords: question.contextChords,
                targetMidi: question.targetMidi,
                chordDurationSec: 0.72,
                chordGapSec: 0.06,
                targetDurationSec: 1.0,
                targetGapSec: 0.14,
                includeTarget: true,
            });
        });
    }, [isAudioBusy, question, runPlayback]);

    const updateDegreeStats = useCallback((degree: FunctionalDegree, correct: boolean, responseMs: number) => {
        setDegreeStats((previous) => {
            const prev = previous[degree];
            const nextSamples = prev.samples + 1;
            const nextAvg = prev.avgResponseMs + (responseMs - prev.avgResponseMs) / nextSamples;
            return {
                ...previous,
                [degree]: {
                    correct: prev.correct + (correct ? 1 : 0),
                    wrong: prev.wrong + (correct ? 0 : 1),
                    avgResponseMs: Math.max(0, Math.round(nextAvg)),
                    samples: nextSamples,
                },
            };
        });
    }, []);

    const handleAnswer = useCallback((degree: FunctionalDegree) => {
        if (!question || lastResult !== null) return;
        const responseMs = Date.now() - question.askedAtMs;
        const correct = degree === question.degree;
        setSelectedDegree(degree);
        submitAnswer(degree);
        updateDegreeStats(question.degree, correct, responseMs);
        recordFunctionalEarAnswer(question.degree, correct, responseMs);

        if (correct && autoNext) {
            stopAutoNextTimer();
            autoNextTimerRef.current = window.setTimeout(() => {
                void generateQuestion(true);
            }, 900);
        }
    }, [
        autoNext,
        generateQuestion,
        lastResult,
        question,
        recordFunctionalEarAnswer,
        stopAutoNextTimer,
        submitAnswer,
        updateDegreeStats,
    ]);

    const toggleDegree = (degree: FunctionalDegree) => {
        setEnabledDegrees((previous) => {
            if (previous.includes(degree)) {
                if (previous.length <= 3) return previous;
                return previous.filter((item) => item !== degree);
            }
            return sortDegrees([...previous, degree]);
        });
    };

    const degreeStatsList = useMemo(() => {
        return FUNCTIONAL_DEGREES
            .map((degree) => ({ degree, ...degreeStats[degree] }))
            .filter((item) => item.samples > 0);
    }, [degreeStats]);

    const keyLabel = question ? formatPitchClass(question.keyRoot, notation) : "--";
    const targetLabel = question ? formatPitchClassWithEnharmonic(question.targetMidi, notation) : "--";

    useEffect(() => {
        return () => {
            stopAutoNextTimer();
            playbackTokenRef.current += 1;
            finalizeSession();
        };
    }, [finalizeSession, stopAutoNextTimer]);

    if (!isPlaying) {
        return (
            <div className="flex flex-col items-center gap-6 py-10">
                <div className="text-center space-y-2">
                    <Music2 className="w-12 h-12 mx-auto text-primary/60" />
                    <h2 className="text-xl font-bold">Functional Ear Training</h2>
                    <p className="text-muted-foreground text-sm max-w-md">
                        Hear a cadence that establishes key center, then identify the scale degree of the target tone.
                    </p>
                </div>

                <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Key Mode</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setKeyMode("random")}
                                className={cn(
                                    "px-3 py-2 rounded-lg border text-sm font-bold transition",
                                    keyMode === "random"
                                        ? "bg-primary/10 border-primary text-primary"
                                        : "bg-card border-border text-muted-foreground",
                                )}
                            >
                                Random
                            </button>
                            <button
                                onClick={() => setKeyMode("fixed")}
                                className={cn(
                                    "px-3 py-2 rounded-lg border text-sm font-bold transition",
                                    keyMode === "fixed"
                                        ? "bg-primary/10 border-primary text-primary"
                                        : "bg-card border-border text-muted-foreground",
                                )}
                            >
                                Fixed Key
                            </button>
                        </div>
                        {keyMode === "fixed" && (
                            <Select
                                value={fixedKey}
                                onChange={(event) => setFixedKey(event.target.value as NoteName)}
                                className="mt-2 w-28 rounded-lg py-2 font-bold"
                            >
                                {NOTES.map((note) => (
                                    <option key={note} value={note}>
                                        {formatPitchClass(note, notation)}
                                    </option>
                                ))}
                            </Select>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Active Degrees</label>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                            {FUNCTIONAL_DEGREES.map((degree) => (
                                <button
                                    key={degree}
                                    onClick={() => toggleDegree(degree)}
                                    className={cn(
                                        "h-10 rounded-lg border text-sm font-bold transition",
                                        enabledDegrees.includes(degree)
                                            ? "bg-primary/10 border-primary text-primary"
                                            : "bg-card border-border text-muted-foreground opacity-55",
                                    )}
                                >
                                    {degree}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                        <div className="space-y-0.5">
                            <p className="text-sm font-semibold">Auto Next</p>
                            <p className="text-xs text-muted-foreground">Move to next question after correct answers.</p>
                        </div>
                        <Switch checked={autoNext} onCheckedChange={setAutoNext} />
                    </div>
                </div>

                <Button className="control-btn control-btn--primary" onClick={() => void handleStart()}>
                    <Play className="w-4 h-4 mr-2" /> Start Training
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-primary">Score: {score}</span>
                    <span className="text-amber-600 dark:text-amber-300">🔥 {streak}</span>
                </div>
                <div className="text-muted-foreground">
                    ✓{totalCorrect} ✗{totalIncorrect}
                </div>
            </div>

            <div className="rounded-xl border border-border bg-primary/5 p-4 space-y-1 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Key Center
                </p>
                <p className="text-lg font-bold">
                    {keyLabel} major
                </p>
                <p className="text-sm text-muted-foreground">
                    Listen and identify the scale degree of the target tone.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void handleReplayContext()} disabled={!question || isAudioBusy}>
                    <Volume2 className="w-4 h-4 mr-1" /> Replay Context
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleReplayTarget()} disabled={!question || isAudioBusy}>
                    <Volume2 className="w-4 h-4 mr-1" /> Replay Target
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleReplayFull()} disabled={!question || isAudioBusy}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Replay Full
                </Button>
                {lastResult && (
                    <Button variant="outline" size="sm" onClick={() => void generateQuestion(true)} disabled={isAudioBusy}>
                        <RotateCcw className="w-4 h-4 mr-1" /> Next
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleEnd} className="ml-auto text-muted-foreground">
                    End
                </Button>
            </div>

            {audioStateLabel && (
                <div className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/20 px-3 py-2">
                    {audioStateLabel}
                </div>
            )}

            {lastResult && question && (
                <div
                    className={cn(
                        "text-center text-sm font-bold rounded-lg py-2",
                        lastResult === "correct"
                            ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300"
                            : "text-rose-700 bg-rose-500/10 dark:text-rose-300",
                    )}
                >
                    {lastResult === "correct"
                        ? `✓ Correct! Degree ${question.degree} in ${keyLabel} major is ${targetLabel}.`
                        : `✗ Wrong. You chose ${selectedDegree ?? "?"}. Correct degree is ${currentAnswer ?? question.degree} (${targetLabel}).`}
                </div>
            )}

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {sortDegrees(enabledDegrees).map((degree) => {
                    const isCorrectOption = lastResult !== null && question?.degree === degree;
                    const isSelectedWrong = lastResult === "incorrect" && selectedDegree === degree;
                    return (
                        <button
                            key={degree}
                            onClick={() => handleAnswer(degree)}
                            disabled={lastResult !== null || !question}
                            className={cn(
                                "h-14 rounded-xl border-2 font-bold text-lg transition-all",
                                lastResult === null && "hover:border-primary hover:bg-primary/5 active:scale-95",
                                isCorrectOption && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                                isSelectedWrong && "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300",
                                !isCorrectOption && !isSelectedWrong && "border-border bg-card",
                            )}
                        >
                            {degree}
                        </button>
                    );
                })}
            </div>

            {degreeStatsList.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Session Degree Stats</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {degreeStatsList.map((item) => {
                            const accuracy = Math.round((item.correct / item.samples) * 100);
                            return (
                                <div key={item.degree} className="rounded-lg border border-border bg-muted/20 p-2 text-xs">
                                    <p className="font-bold text-sm">Degree {item.degree}</p>
                                    <p className="text-muted-foreground">Accuracy: {accuracy}%</p>
                                    <p className="text-muted-foreground">Avg: {item.avgResponseMs} ms</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

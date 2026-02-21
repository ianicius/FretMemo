import { useState, useCallback, useEffect } from "react";
import { playIntervalPrompt, initAudio } from "@/lib/audio";
import { EAR_INTERVALS, getEarIntervalsFromTokens } from "@/lib/earIntervals";
import { useEarTrainingStore } from "@/stores/useEarTrainingStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { Button } from "@/components/ui/button";
import { Volume2, RotateCcw, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type Difficulty = "easy" | "medium" | "hard";
const DIFFICULTY_SETS: Record<Difficulty, number[]> = {
    easy: [0, 3, 4, 5, 7, 12], // P1, m3, M3, P4, P5, P8
    medium: [0, 2, 3, 4, 5, 7, 9, 12], // + M2, M6
    hard: EAR_INTERVALS.map((interval) => interval.semitones),
};

function getRandomRoot(): number {
    return Math.floor(Math.random() * 12) + 48; // C3 to B3
}

export default function IntervalTrainer() {
    const { t } = useTranslation();
    const [difficulty, setDifficulty] = useState<Difficulty>("easy");
    const configuredIntervals = useSettingsStore((state) => state.modules.earTraining.intervals);
    const intervalDirection = useSettingsStore((state) => state.modules.earTraining.direction);
    const {
        isPlaying, lastResult, score, streak, totalCorrect, totalIncorrect,
        currentInterval, currentAnswer,
        startSession, endSession, setCurrentInterval, setAudioReady, setMode,
    } = useEarTrainingStore();

    const configured = getEarIntervalsFromTokens(configuredIntervals);
    const byDifficulty = new Set(DIFFICULTY_SETS[difficulty]);
    const constrained = configured.filter((interval) => byDifficulty.has(interval.semitones));
    const activeIntervals = constrained.length > 0 ? constrained : configured;

    const generateNewQuestion = useCallback(async () => {
        if (activeIntervals.length === 0) return;
        const interval = activeIntervals[Math.floor(Math.random() * activeIntervals.length)];
        const root = getRandomRoot();
        const target = root + interval.semitones;

        setCurrentInterval([root, target], interval.name);
        await playIntervalPrompt(root, target, {
            direction: intervalDirection,
            noteDuration: 0.8,
            gap: 0.12,
        });
    }, [activeIntervals, intervalDirection, setCurrentInterval]);

    const handleStart = useCallback(() => {
        initAudio();
        setAudioReady(true);
        setMode("intervals");
        startSession();
        setTimeout(() => {
            void generateNewQuestion();
        }, 300);
    }, [generateNewQuestion, setAudioReady, setMode, startSession]);

    const handleReplay = useCallback(() => {
        if (currentInterval) {
            void playIntervalPrompt(currentInterval[0], currentInterval[1], {
                direction: intervalDirection,
                noteDuration: 0.8,
                gap: 0.12,
            });
        }
    }, [currentInterval, intervalDirection]);

    const handleAnswer = useCallback((intervalName: string) => {
        if (lastResult !== null) return;
        useEarTrainingStore.getState().submitAnswer(intervalName);
    }, [lastResult]);

    useEffect(() => {
        return () => { endSession(); };
    }, [endSession]);

    if (!isPlaying) {
        return (
            <div className="flex flex-col items-center gap-6 py-12">
                <div className="text-center space-y-2">
                    <Volume2 className="w-12 h-12 mx-auto text-primary/60" />
                    <h2 className="text-xl font-bold">{t("ear.page.modes.intervalRecognition")}</h2>
                    <p className="text-muted-foreground text-sm max-w-md">
                        {t("ear.intervals.description")}
                    </p>
                </div>

                <div className="flex gap-2">
                    {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                        <button
                            key={d}
                            onClick={() => setDifficulty(d)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-bold border capitalize transition",
                                d === difficulty
                                    ? "bg-primary/10 border-primary text-primary"
                                    : "bg-card border-border text-muted-foreground"
                            )}
                        >
                            {t(`ear.intervals.difficulty.${d}`)}
                        </button>
                    ))}
                </div>

                <Button className="control-btn control-btn--primary" onClick={handleStart}>
                    <Play className="w-4 h-4 mr-2" /> {t("ear.common.startTraining")}
                </Button>
            </div>
        );
    }

    const correctInterval = EAR_INTERVALS.find((interval) => interval.name === currentAnswer);

    return (
        <div className="space-y-4">
            {/* Stats */}
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
                <Button variant="outline" size="sm" onClick={handleReplay} disabled={!currentInterval}>
                    <Volume2 className="w-4 h-4 mr-1" /> {t("ear.common.replay")}
                </Button>
                {lastResult && (
                    <Button variant="outline" size="sm" onClick={generateNewQuestion}>
                        <RotateCcw className="w-4 h-4 mr-1" /> {t("ear.common.next")}
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={endSession} className="ml-auto text-muted-foreground">
                    {t("ear.common.end")}
                </Button>
            </div>

            {/* Feedback */}
            {lastResult && (
                <div className={`text-center text-sm font-bold rounded-lg py-2 ${lastResult === "correct"
                    ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300"
                    : "text-rose-700 bg-rose-500/10 dark:text-rose-300"
                    }`}>
                    {lastResult === "correct"
                        ? t("ear.common.correct")
                        : t("ear.intervals.itWas", {
                            interval: correctInterval ? t(correctInterval.labelKey) : currentAnswer ?? "?",
                        })
                    }
                </div>
            )}

            {/* Answer grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeIntervals.map((interval) => {
                    const isCorrectOption = lastResult !== null && interval.name === currentAnswer;
                    const isWrongChoice = lastResult === "incorrect" && interval.name !== currentAnswer;
                    return (
                        <button
                            key={interval.name}
                            onClick={() => handleAnswer(interval.name)}
                            disabled={lastResult !== null}
                            className={cn(
                                "h-14 rounded-xl border-2 font-bold text-sm transition-all",
                                lastResult === null && "hover:border-primary hover:bg-primary/5 active:scale-95",
                                isCorrectOption && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                                isWrongChoice && "opacity-50",
                                !isCorrectOption && !isWrongChoice && "border-border bg-card"
                            )}
                        >
                            <div className="text-xs text-muted-foreground">{interval.name}</div>
                            <div>{t(interval.labelKey)}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

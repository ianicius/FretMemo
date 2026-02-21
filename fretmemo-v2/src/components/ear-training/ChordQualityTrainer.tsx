import { useState, useCallback, useEffect } from "react";
import { playChord, initAudio } from "@/lib/audio";
import { useEarTrainingStore } from "@/stores/useEarTrainingStore";
import { Button } from "@/components/ui/button";
import { Volume2, RotateCcw, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const CHORD_QUALITIES = [
    { name: "major", labelKey: "ear.chords.qualities.major", intervals: [0, 4, 7] },
    { name: "minor", labelKey: "ear.chords.qualities.minor", intervals: [0, 3, 7] },
    { name: "diminished", labelKey: "ear.chords.qualities.diminished", intervals: [0, 3, 6] },
    { name: "augmented", labelKey: "ear.chords.qualities.augmented", intervals: [0, 4, 8] },
    { name: "sus2", labelKey: "ear.chords.qualities.sus2", intervals: [0, 2, 7] },
    { name: "sus4", labelKey: "ear.chords.qualities.sus4", intervals: [0, 5, 7] },
    { name: "dom7", labelKey: "ear.chords.qualities.dom7", intervals: [0, 4, 7, 10] },
    { name: "maj7", labelKey: "ear.chords.qualities.maj7", intervals: [0, 4, 7, 11] },
    { name: "min7", labelKey: "ear.chords.qualities.min7", intervals: [0, 3, 7, 10] },
];

type Difficulty = "triads" | "extended";
const DIFFICULTY_SETS: Record<Difficulty, string[]> = {
    triads: ["major", "minor", "diminished", "augmented"],
    extended: CHORD_QUALITIES.map(q => q.name),
};

function getRandomRoot(): number {
    return Math.floor(Math.random() * 12) + 48; // C3 to B3
}

export default function ChordQualityTrainer() {
    const { t } = useTranslation();
    const [difficulty, setDifficulty] = useState<Difficulty>("triads");
    const {
        isPlaying, lastResult, score, streak, totalCorrect, totalIncorrect,
        currentChordMidis, currentAnswer,
        startSession, endSession, setCurrentChord, setAudioReady, setMode,
    } = useEarTrainingStore();

    const activeQualities = CHORD_QUALITIES.filter(q => DIFFICULTY_SETS[difficulty].includes(q.name));

    const generateNewQuestion = useCallback(() => {
        const set = DIFFICULTY_SETS[difficulty];
        const qualityName = set[Math.floor(Math.random() * set.length)];
        const quality = CHORD_QUALITIES.find(q => q.name === qualityName)!;
        const root = getRandomRoot();
        const midis = quality.intervals.map(i => root + i);

        setCurrentChord(midis, quality.name);
        playChord(midis);
    }, [difficulty, setCurrentChord]);

    const handleStart = useCallback(() => {
        initAudio();
        setAudioReady(true);
        setMode("chord-quality");
        startSession();
        setTimeout(() => generateNewQuestion(), 300);
    }, [generateNewQuestion, setAudioReady, setMode, startSession]);

    const handleReplay = useCallback(() => {
        if (currentChordMidis) {
            playChord(currentChordMidis);
        }
    }, [currentChordMidis]);

    const handleAnswer = useCallback((qualityName: string) => {
        if (lastResult !== null) return;
        useEarTrainingStore.getState().submitAnswer(qualityName);
    }, [lastResult]);

    useEffect(() => {
        return () => { endSession(); };
    }, [endSession]);

    if (!isPlaying) {
        return (
            <div className="flex flex-col items-center gap-6 py-12">
                <div className="text-center space-y-2">
                    <Volume2 className="w-12 h-12 mx-auto text-primary/60" />
                    <h2 className="text-xl font-bold">{t("ear.page.modes.chordQuality")}</h2>
                    <p className="text-muted-foreground text-sm max-w-md">
                        {t("ear.chords.description")}
                    </p>
                </div>

                <div className="flex gap-2">
                    {(["triads", "extended"] as Difficulty[]).map((d) => (
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
                            {t(`ear.chords.difficulty.${d}`)}
                        </button>
                    ))}
                </div>

                <Button className="control-btn control-btn--primary" onClick={handleStart}>
                    <Play className="w-4 h-4 mr-2" /> {t("ear.common.startTraining")}
                </Button>
            </div>
        );
    }

    const correctQuality = CHORD_QUALITIES.find(q => q.name === currentAnswer);

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
                <Button variant="outline" size="sm" onClick={handleReplay} disabled={!currentChordMidis}>
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
                        : t("ear.chords.itWas", {
                            quality: correctQuality ? t(correctQuality.labelKey) : currentAnswer ?? "?",
                        })
                    }
                </div>
            )}

            {/* Answer grid */}
            <div className="grid grid-cols-2 gap-2">
                {activeQualities.map((quality) => {
                    const isCorrectOption = lastResult !== null && quality.name === currentAnswer;
                    const isWrongChoice = lastResult === "incorrect" && quality.name !== currentAnswer;
                    return (
                        <button
                            key={quality.name}
                            onClick={() => handleAnswer(quality.name)}
                            disabled={lastResult !== null}
                            className={cn(
                                "h-14 rounded-xl border-2 font-bold text-sm transition-all",
                                lastResult === null && "hover:border-primary hover:bg-primary/5 active:scale-95",
                                isCorrectOption && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                                isWrongChoice && "opacity-50",
                                !isCorrectOption && !isWrongChoice && "border-border bg-card"
                            )}
                        >
                            {t(quality.labelKey)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

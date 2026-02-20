import { useState, useCallback, useEffect } from "react";
import { playInterval as playIntervalAudio, initAudio } from "@/lib/audio";
import { useEarTrainingStore } from "@/stores/useEarTrainingStore";
import { Button } from "@/components/ui/button";
import { Volume2, RotateCcw, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const INTERVALS = [
    { semitones: 1, name: "m2", label: "Minor 2nd" },
    { semitones: 2, name: "M2", label: "Major 2nd" },
    { semitones: 3, name: "m3", label: "Minor 3rd" },
    { semitones: 4, name: "M3", label: "Major 3rd" },
    { semitones: 5, name: "P4", label: "Perfect 4th" },
    { semitones: 6, name: "A4", label: "Tritone" },
    { semitones: 7, name: "P5", label: "Perfect 5th" },
    { semitones: 8, name: "m6", label: "Minor 6th" },
    { semitones: 9, name: "M6", label: "Major 6th" },
    { semitones: 10, name: "m7", label: "Minor 7th" },
    { semitones: 11, name: "M7", label: "Major 7th" },
    { semitones: 12, name: "P8", label: "Octave" },
];

type Difficulty = "easy" | "medium" | "hard";
const DIFFICULTY_SETS: Record<Difficulty, number[]> = {
    easy: [3, 4, 5, 7, 12],       // m3, M3, P4, P5, P8
    medium: [2, 3, 4, 5, 7, 9, 12], // + M2, M6
    hard: INTERVALS.map(i => i.semitones),
};

function getRandomRoot(): number {
    return Math.floor(Math.random() * 12) + 48; // C3 to B3
}

export default function IntervalTrainer() {
    const [difficulty, setDifficulty] = useState<Difficulty>("easy");
    const {
        isPlaying, lastResult, score, streak, totalCorrect, totalIncorrect,
        currentInterval, currentAnswer,
        startSession, endSession, setCurrentInterval, setAudioReady,
    } = useEarTrainingStore();

    const activeIntervals = INTERVALS.filter(i => DIFFICULTY_SETS[difficulty].includes(i.semitones));

    const generateNewQuestion = useCallback(async () => {
        const set = DIFFICULTY_SETS[difficulty];
        const semitones = set[Math.floor(Math.random() * set.length)];
        const interval = INTERVALS.find(i => i.semitones === semitones)!;
        const root = getRandomRoot();
        const target = root + semitones;

        setCurrentInterval([root, target], interval.name);
        await playIntervalAudio(root, target);
    }, [difficulty, setCurrentInterval]);

    const handleStart = useCallback(() => {
        initAudio();
        setAudioReady(true);
        startSession();
        setTimeout(() => generateNewQuestion(), 300);
    }, [startSession, setAudioReady, generateNewQuestion]);

    const handleReplay = useCallback(() => {
        if (currentInterval) {
            playIntervalAudio(currentInterval[0], currentInterval[1]);
        }
    }, [currentInterval]);

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
                    <h2 className="text-xl font-bold">Interval Recognition</h2>
                    <p className="text-muted-foreground text-sm max-w-md">
                        Listen to two notes played in sequence and identify the interval between them.
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
                            {d}
                        </button>
                    ))}
                </div>

                <Button className="control-btn control-btn--primary" onClick={handleStart}>
                    <Play className="w-4 h-4 mr-2" /> Start Training
                </Button>
            </div>
        );
    }

    const correctInterval = INTERVALS.find(i => i.name === currentAnswer);

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-primary">Score: {score}</span>
                    <span className="text-amber-600 dark:text-amber-300">🔥 {streak}</span>
                </div>
                <div className="text-muted-foreground">
                    ✓{totalCorrect} ✗{totalIncorrect}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleReplay} disabled={!currentInterval}>
                    <Volume2 className="w-4 h-4 mr-1" /> Replay
                </Button>
                {lastResult && (
                    <Button variant="outline" size="sm" onClick={generateNewQuestion}>
                        <RotateCcw className="w-4 h-4 mr-1" /> Next
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={endSession} className="ml-auto text-muted-foreground">
                    End
                </Button>
            </div>

            {/* Feedback */}
            {lastResult && (
                <div className={`text-center text-sm font-bold rounded-lg py-2 ${lastResult === "correct"
                    ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300"
                    : "text-rose-700 bg-rose-500/10 dark:text-rose-300"
                    }`}>
                    {lastResult === "correct"
                        ? "✓ Correct!"
                        : `✗ It was ${correctInterval?.label ?? currentAnswer}`
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
                            <div>{interval.label}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

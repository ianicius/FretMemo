import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useProgressStore } from "@/stores/useProgressStore";
import { useGameStore } from "@/stores/useGameStore";
import { cn } from "@/lib/utils";
import { Calendar, ChevronDown, Flame, Play, Sparkles, Target, Zap } from "lucide-react";

type ChallengeRouteConfig = {
    type: "timed" | "survival" | "findAll";
    label: string;
    timeLimitSec?: number;
    targetNote?: "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";
};

type ChallengeConstraintConfig = {
    fretRange?: { min: number; max: number };
    enabledStrings?: boolean[];
    noteFilter?: "all" | "naturals";
    rootNote?: ChallengeRouteConfig["targetNote"];
    scaleType?: "major" | "minor" | "majorPentatonic" | "minorPentatonic";
};

function getDailyChallenge() {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));

    const challenges = [
        { id: "speed-20", name: "Speed Sprint", description: "Identify 20 notes as fast as possible", target: 20, type: "speed" as const },
        { id: "accuracy-50", name: "Accuracy Master", description: "Get 50 correct answers in a row", target: 50, type: "accuracy" as const },
        { id: "coverage-all", name: "Full Coverage", description: "Practice at least one note on every string", target: 6, type: "coverage" as const },
        { id: "streak-10", name: "Perfect Streak", description: "Get 10 correct without mistakes", target: 10, type: "streak" as const },
        { id: "speed-30", name: "Lightning Round", description: "Identify 30 notes in under 2 minutes", target: 30, type: "speed" as const },
        { id: "accuracy-100", name: "Century Club", description: "Answer 100 questions with 90%+ accuracy", target: 100, type: "accuracy" as const },
        { id: "strings-all", name: "String Master", description: "Practice all 6 strings equally", target: 6, type: "coverage" as const },
    ];

    return challenges[dayOfYear % challenges.length];
}

const WEEKLY_GOALS = [
    { id: "practice-3", name: "Consistent Practice", target: 3, current: 2, unit: "days" },
    { id: "notes-100", name: "Note Master", target: 100, current: 67, unit: "notes" },
    { id: "streak-7", name: "Week Warrior", target: 7, current: 5, unit: "days" },
];

const ACHIEVEMENT_HUNTS: Array<{
    id: string;
    name: string;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    reward: string;
    mode?: "fretboardToNote" | "tabToNote" | "noteToTab" | "playNotes" | "playTab";
    bpm?: number;
    constraints?: ChallengeConstraintConfig;
    challenge?: ChallengeRouteConfig;
}> = [
    {
        id: "perfect-session",
        name: "Perfect Session",
        description: "Get 20 correct in a row",
        difficulty: "medium",
        reward: "Gold Badge",
        mode: "fretboardToNote",
        bpm: 80,
        constraints: { noteFilter: "naturals", fretRange: { min: 1, max: 7 } },
    },
    {
        id: "speed-demon",
        name: "Speed Demon",
        description: "Practice at 120+ BPM",
        difficulty: "hard",
        reward: "Speed Badge",
        mode: "fretboardToNote",
        bpm: 120,
        constraints: { noteFilter: "all", fretRange: { min: 1, max: 12 } },
    },
    {
        id: "explorer",
        name: "Explorer",
        description: "Practice all 6 strings",
        difficulty: "easy",
        reward: "Explorer Badge",
        mode: "noteToTab",
        constraints: {
            enabledStrings: [true, true, true, true, true, true],
            fretRange: { min: 1, max: 12 },
        },
    },
    {
        id: "timed-blitz",
        name: "60s Blitz",
        description: "Score as many correct answers as possible in 60 seconds",
        difficulty: "hard",
        reward: "+250 XP",
        mode: "fretboardToNote",
        bpm: 90,
        constraints: { noteFilter: "all", fretRange: { min: 1, max: 12 } },
        challenge: { type: "timed", label: "60s Blitz", timeLimitSec: 60 },
    },
    {
        id: "survival",
        name: "Survival",
        description: "One mistake ends the run",
        difficulty: "hard",
        reward: "Survivor Badge",
        mode: "fretboardToNote",
        bpm: 75,
        constraints: { noteFilter: "naturals", fretRange: { min: 1, max: 10 } },
        challenge: { type: "survival", label: "Survival Mode" },
    },
    {
        id: "find-all-a",
        name: "Find All A",
        description: "Locate every A note in your active range",
        difficulty: "medium",
        reward: "Navigator Badge",
        mode: "noteToTab",
        constraints: { noteFilter: "all", fretRange: { min: 1, max: 12 } },
        challenge: { type: "findAll", label: "Find All A", targetNote: "A" },
    },
];

export default function Challenges() {
    const navigate = useNavigate();
    const { streakDays, totalCorrect, totalIncorrect } = useProgressStore();
    const { setMode, setBpm, setPracticeConstraints } = useGameStore();
    const [showAllHunts, setShowAllHunts] = useState(false);

    const dailyChallenge = useMemo(() => getDailyChallenge(), []);
    const overallAccuracy = totalCorrect + totalIncorrect > 0
        ? Math.round((totalCorrect / (totalCorrect + totalIncorrect)) * 100)
        : 0;

    const openPracticeSetup = ({
        mode = "fretboardToNote",
        source,
        bpm,
        constraints,
        challenge,
    }: {
        mode?: "fretboardToNote" | "tabToNote" | "noteToTab" | "playNotes" | "playTab";
        source: string;
        bpm?: number;
        constraints?: Parameters<typeof setPracticeConstraints>[0];
        challenge?: ChallengeRouteConfig;
    }) => {
        setMode(mode);
        if (typeof bpm === "number") {
            setBpm(bpm);
        }
        if (constraints) {
            setPracticeConstraints(constraints);
        }
        navigate("/practice", {
            state: {
                openPreFlight: true,
                source,
                mode,
                challenge,
            },
        });
    };

    const handleStartChallenge = () => {
        if (dailyChallenge.type === "speed") {
            openPracticeSetup({
                source: "challenges-daily-speed",
                mode: "fretboardToNote",
                bpm: 90,
                constraints: { noteFilter: "all", fretRange: { min: 1, max: 12 } },
            });
            return;
        }

        if (dailyChallenge.type === "accuracy") {
            openPracticeSetup({
                source: "challenges-daily-accuracy",
                mode: "fretboardToNote",
                bpm: 60,
                constraints: { noteFilter: "naturals", fretRange: { min: 1, max: 8 } },
            });
            return;
        }

        if (dailyChallenge.type === "coverage") {
            openPracticeSetup({
                source: "challenges-daily-coverage",
                mode: "noteToTab",
                constraints: {
                    enabledStrings: [true, true, true, true, true, true],
                    fretRange: { min: 1, max: 12 },
                    noteFilter: "all",
                },
            });
            return;
        }

        openPracticeSetup({
            source: "challenges-daily-streak",
            mode: "fretboardToNote",
            bpm: 70,
            constraints: { noteFilter: "naturals", fretRange: { min: 1, max: 5 } },
        });
    };

    const handleStartHunt = (huntId: string) => {
        const hunt = ACHIEVEMENT_HUNTS.find((item) => item.id === huntId);
        if (!hunt) return;
        openPracticeSetup({
            source: `challenges-hunt-${huntId}`,
            mode: hunt.mode ?? "fretboardToNote",
            bpm: hunt.bpm,
            constraints: hunt.constraints,
            challenge: hunt.challenge,
        });
    };

    const visibleHunts = showAllHunts ? ACHIEVEMENT_HUNTS : ACHIEVEMENT_HUNTS.slice(0, 3);

    return (
        <div className="space-y-6 pb-8">
            <div>
                <h1 className="type-display">Challenges</h1>
                <p className="text-muted-foreground mt-1">Daily momentum, weekly goals, and long-term hunts.</p>
            </div>

            <Card className="border-gold-200 bg-gradient-to-br from-gold-50/90 via-amber-50/50 to-graphite-50 dark:border-amber-500/30 dark:from-amber-900/20 dark:via-slate-950 dark:to-slate-900">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                            <Zap className="mr-1 h-3 w-3" />
                            Featured
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                        </span>
                    </div>
                    <CardTitle className="text-2xl">{dailyChallenge.name}</CardTitle>
                    <CardDescription>{dailyChallenge.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span className="inline-flex items-center gap-1">
                            <Target className="h-4 w-4 text-graphite-500" />
                            Target: <strong>{dailyChallenge.target}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <Sparkles className="h-4 w-4 text-amber-600" />
                            Reward: <strong>+100 XP</strong>
                        </span>
                    </div>
                    <Button size="lg" className="control-btn--primary" onClick={handleStartChallenge}>
                        <Play className="mr-2 h-4 w-4" />
                        Start Challenge
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">This Week</CardTitle>
                    <CardDescription>{WEEKLY_GOALS.filter((goal) => goal.current >= goal.target).length} of {WEEKLY_GOALS.length} goals completed</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {WEEKLY_GOALS.map((goal) => {
                        const progress = Math.min(100, Math.round((goal.current / goal.target) * 100));
                        const isComplete = goal.current >= goal.target;
                        return (
                            <div key={goal.id} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">{goal.name}</span>
                                    <span className={cn("text-xs font-semibold", isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-graphite-500")}>
                                        {goal.current}/{goal.target} {goal.unit}
                                    </span>
                                </div>
                                <Progress value={progress} className="h-2" />
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl">Hunts</CardTitle>
                        <Badge variant="secondary">{ACHIEVEMENT_HUNTS.length} active</Badge>
                    </div>
                    <CardDescription>Long-term goals that stay available every day.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {visibleHunts.map((hunt) => (
                        <div key={hunt.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="truncate font-semibold">{hunt.name}</p>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "capitalize",
                                            hunt.difficulty === "easy" && "border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300",
                                            hunt.difficulty === "medium" && "border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-300",
                                            hunt.difficulty === "hard" && "border-rose-300 text-rose-700 dark:border-rose-500/40 dark:text-rose-300"
                                        )}
                                    >
                                        {hunt.difficulty}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{hunt.description}</p>
                                <p className="text-xs text-muted-foreground">Reward: {hunt.reward}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleStartHunt(hunt.id)}>
                                Start
                            </Button>
                        </div>
                    ))}
                    {ACHIEVEMENT_HUNTS.length > 3 && (
                        <Button
                            variant="ghost"
                            className="w-full justify-center gap-2 text-muted-foreground"
                            onClick={() => setShowAllHunts((prev) => !prev)}
                        >
                            {showAllHunts ? "Show fewer hunts" : `Show all ${ACHIEVEMENT_HUNTS.length} hunts`}
                            <ChevronDown className={cn("h-4 w-4 transition-transform", showAllHunts && "rotate-180")} />
                        </Button>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-3">
                <MiniStat title="Streak" value={`${streakDays}`} icon={Flame} tone="warning" />
                <MiniStat title="Accuracy" value={`${overallAccuracy}%`} icon={Target} tone={overallAccuracy >= 75 ? "success" : overallAccuracy >= 50 ? "warning" : "danger"} />
                <MiniStat title="Events" value={`${WEEKLY_GOALS.length + ACHIEVEMENT_HUNTS.length}`} icon={Calendar} tone="default" />
            </div>
        </div>
    );
}

function MiniStat({
    title,
    value,
    icon: Icon,
    tone = "default",
}: {
    title: string;
    value: string;
    icon: React.ElementType;
    tone?: "default" | "success" | "warning" | "danger";
}) {
    const toneClasses = {
        default: "text-foreground",
        success: "text-emerald-600 dark:text-emerald-400",
        warning: "text-amber-700 dark:text-amber-300",
        danger: "text-rose-600 dark:text-rose-400",
    };

    return (
        <div className="rounded-xl border border-border bg-card p-3 text-center">
            <div className={cn("mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted", toneClasses[tone])}>
                <Icon className="h-4 w-4" />
            </div>
            <div className={cn("text-lg font-bold", toneClasses[tone])}>{value}</div>
            <div className="text-xs text-muted-foreground">{title}</div>
        </div>
    );
}

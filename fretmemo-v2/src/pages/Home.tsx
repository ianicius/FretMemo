import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProgressStore } from "@/stores/useProgressStore";
import { useGameStore } from "@/stores/useGameStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { usePinnedExercisesStore, type PinnedExerciseId } from "@/stores/usePinnedExercisesStore";
import { useRhythmDojoStore, type RhythmModeId } from "@/stores/useRhythmDojoStore";
import { normalizeTuning } from "@/lib/tuning";
import { ExerciseCard } from "@/components/ui/exercise-card";
import { EmptyState } from "@/components/ui/empty-state";
import { MasteryBar } from "@/components/ui/mastery-bar";
import { StatLine } from "@/components/ui/stat-line";
import { ArrowRight, Compass, Flame, Music2, Play, Sparkles, Star, Target, Trophy } from "lucide-react";

type PracticeMode = "fretboardToNote" | "tabToNote" | "noteToTab" | "playNotes" | "playTab";
type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";

const TECHNIQUE_NAMES: Record<string, string> = {
    spider: "Spider Walk",
    permutation: "Permutation Trainer",
    linear: "Linear Shifter",
    diagonal: "Diagonal Patterns",
    stringskip: "String Skipping",
    legato: "Legato Builder",
};

const DRILL_META: Record<PracticeMode, { title: string; difficulty: ExerciseDifficulty; source: string; masteryOffset: number }> = {
    fretboardToNote: {
        title: "Fretboard → Note",
        difficulty: "beginner",
        source: "home-pinned-fretboard-to-note",
        masteryOffset: 0,
    },
    playNotes: {
        title: "Note Generator",
        difficulty: "beginner",
        source: "home-pinned-note-names",
        masteryOffset: 8,
    },
    noteToTab: {
        title: "Note → Tab",
        difficulty: "intermediate",
        source: "home-pinned-note-to-tab",
        masteryOffset: 16,
    },
    tabToNote: {
        title: "Tab → Note",
        difficulty: "intermediate",
        source: "home-pinned-tab-to-note",
        masteryOffset: 24,
    },
    playTab: {
        title: "Tab Sequence",
        difficulty: "advanced",
        source: "home-pinned-tab-sequence",
        masteryOffset: 32,
    },
};

const TECHNIQUE_META: Record<string, { title: string; difficulty: ExerciseDifficulty }> = {
    spider: { title: "Spider Walk", difficulty: "beginner" },
    permutation: { title: "Permutation Trainer", difficulty: "intermediate" },
    linear: { title: "Linear Shifter", difficulty: "intermediate" },
    diagonal: { title: "Diagonal Patterns", difficulty: "intermediate" },
    stringskip: { title: "String Skipping", difficulty: "advanced" },
    legato: { title: "Legato Builder", difficulty: "intermediate" },
};

const RHYTHM_META: Record<RhythmModeId, { title: string; difficulty: ExerciseDifficulty }> = {
    "tap-beat": { title: "Tap the Beat", difficulty: "beginner" },
    "strum-patterns": { title: "Strum Patterns", difficulty: "beginner" },
    "rhythm-reading": { title: "Rhythm Reading", difficulty: "intermediate" },
    "groove-lab": { title: "Groove Lab", difficulty: "intermediate" },
};

const TECHNIQUE_MASTERY_TARGET_BPM: Record<string, number> = {
    spider: 120,
    permutation: 140,
    linear: 140,
    diagonal: 140,
    stringskip: 160,
    legato: 150,
};

function formatRelativeTime(isoTimestamp: string | null): string {
    if (!isoTimestamp) return "New";
    const timestamp = Date.parse(isoTimestamp);
    if (Number.isNaN(timestamp)) return "New";

    const elapsedMs = Date.now() - timestamp;
    if (elapsedMs < 60_000) return "Just now";

    const elapsedMinutes = Math.floor(elapsedMs / 60_000);
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;

    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays === 1) return "Yesterday";
    if (elapsedDays < 7) return `${elapsedDays} days ago`;

    return new Date(isoTimestamp).toLocaleDateString();
}

export default function Home() {
    const navigate = useNavigate();
    const { streakDays, totalCorrect, totalIncorrect, positionStats } = useProgressStore();
    const { setMode, setPracticeConstraints } = useGameStore();
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const techniqueSettings = useSettingsStore((state) => state.modules.technique);
    const pinnedIds = usePinnedExercisesStore((state) => state.pinnedIds);
    const maxPins = usePinnedExercisesStore((state) => state.maxPins);
    const unpin = usePinnedExercisesStore((state) => state.unpin);
    const rhythmModeStats = useRhythmDojoStore((state) => state.modeStats);
    const getRhythmModeMastery = useRhythmDojoStore((state) => state.getModeMastery);

    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);
    const positionsPracticed = Object.keys(positionStats).length;
    const totalPositions = tuning.length * 12;
    const coverage = Math.round((positionsPracticed / totalPositions) * 100);
    const hasPracticeData = totalCorrect + totalIncorrect > 0 || positionsPracticed > 0;

    const overallAccuracy = totalCorrect + totalIncorrect > 0
        ? Math.round((totalCorrect / (totalCorrect + totalIncorrect)) * 100)
        : 0;
    const xp = totalCorrect * 10;
    const level = Math.floor(xp / 1000) + 1;
    const xpProgress = ((xp % 1000) / 1000) * 100;
    const xpToNext = 1000 - (xp % 1000);
    const momentumLabel = streakDays > 1 ? `${streakDays} days` : streakDays === 1 ? "1 day" : "start";

    const weakAreas = useMemo(() => {
        const candidates = Object.entries(positionStats)
            .filter(([, stats]) => stats.total >= 2)
            .map(([key, stats]) => {
                const parsedLastPracticed = stats.lastPracticed ? Date.parse(stats.lastPracticed) : Number.NaN;
                return {
                    key,
                    stats,
                    lastPracticedTs: Number.isNaN(parsedLastPracticed) ? null : parsedLastPracticed,
                };
            });

        const latestPracticeTs = candidates.reduce((maxTs, item) => {
            if (item.lastPracticedTs === null) return maxTs;
            return Math.max(maxTs, item.lastPracticedTs);
        }, 0);

        return candidates
            .map(({ key, stats, lastPracticedTs }) => {
                const accuracy = stats.correct / stats.total;
                // Weight accuracy more heavily for positions with more data.
                const sampleWeight = Math.min(1, stats.total / 10); // max weight at 10+ attempts

                // Recency penalty anchored to the latest recorded practice timestamp in local data.
                // Recently practiced areas get deprioritized as weak spots.
                let recencyBonus = 0;
                if (lastPracticedTs !== null && latestPracticeTs > 0) {
                    const hoursSince = (latestPracticeTs - lastPracticedTs) / (60 * 60 * 1000);
                    recencyBonus = Math.max(0, 1 - hoursSince / 24) * 0.3;
                }

                // Lower score = more likely to be suggested.
                const weaknessScore = (accuracy * sampleWeight) + recencyBonus;
                return { key, stats, score: weaknessScore };
            })
            .sort((a, b) => a.score - b.score)
            .map(({ key, stats }) => [key, stats] as const);
    }, [positionStats]);

    const weakestArea = weakAreas[0] ?? null;
    const weakSummary = useMemo(() => {
        if (!weakestArea) return null;
        const [key, stats] = weakestArea;
        const [stringIndex, fret] = key.split("-").map(Number);
        const accuracy = Math.round((stats.correct / stats.total) * 100);
        return { stringIndex, fret, accuracy };
    }, [weakestArea]);

    const recentExercises = useMemo(() => {
        const entries = Object.entries(techniqueSettings.lastPracticedAt ?? {})
            .filter(([, timestamp]) => Boolean(timestamp))
            .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))
            .slice(0, 2);

        return entries.map(([id, lastPracticed]) => {
            const bestBpm = techniqueSettings.bestBpm?.[id] ?? 0;
            const mastery = bestBpm > 0 ? Math.min(100, Math.round((bestBpm / 140) * 100)) : 0;
            return {
                id,
                title: TECHNIQUE_NAMES[id] ?? "Technique Drill",
                mastery,
                lastPracticed: formatRelativeTime(lastPracticed),
            };
        });
    }, [techniqueSettings.bestBpm, techniqueSettings.lastPracticedAt]);
    const continuePrimary = recentExercises[0] ?? null;
    const continueList = continuePrimary ? recentExercises.slice(1) : recentExercises;

    const pinnedExercises = useMemo(() => {
        return pinnedIds
            .map((id) => {
                if (id in DRILL_META) {
                    const drillId = id as PracticeMode;
                    const drill = DRILL_META[drillId];
                    return {
                        id,
                        title: drill.title,
                        difficulty: drill.difficulty,
                        kind: "drill" as const,
                        source: drill.source,
                        mastery: Math.max(0, overallAccuracy - drill.masteryOffset),
                    };
                }

                if (id in RHYTHM_META) {
                    const rhythmId = id as RhythmModeId;
                    const rhythmMeta = RHYTHM_META[rhythmId];
                    const rhythmSessions = rhythmModeStats[rhythmId]?.sessions ?? 0;
                    return {
                        id,
                        title: rhythmMeta.title,
                        difficulty: rhythmMeta.difficulty,
                        kind: "rhythm" as const,
                        mastery: getRhythmModeMastery(rhythmId),
                        isNew: rhythmSessions === 0,
                    };
                }

                const technique = TECHNIQUE_META[id];
                if (!technique) return null;
                const bestBpm = techniqueSettings.bestBpm?.[id] ?? 0;
                const masteryTarget = TECHNIQUE_MASTERY_TARGET_BPM[id] ?? 140;

                return {
                    id,
                    title: technique.title,
                    difficulty: technique.difficulty,
                    kind: "technique" as const,
                    mastery: bestBpm > 0
                        ? Math.min(100, Math.round((bestBpm / masteryTarget) * 100))
                        : 0,
                };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));
    }, [getRhythmModeMastery, overallAccuracy, pinnedIds, rhythmModeStats, techniqueSettings.bestBpm]);

    const applyWeakAreaPracticePreset = (stringIndex: number, fret: number) => {
        // Expand fret range: 4 frets centered on weak spot
        const min = Math.max(1, fret - 2);
        const max = Math.min(12, fret + 2);

        // Include 3 neighboring strings centered on weak spot
        // e.g., if stringIndex=4, enable strings 3,4,5 (or edge cases handled)
        const focusedStrings = Array.from({ length: tuning.length }, (_, idx) => {
            const distance = Math.abs(idx - stringIndex);
            return distance <= 1; // Include the weak string and 1 neighbor on each side
        });

        setPracticeConstraints({
            fretRange: { min, max },
            enabledStrings: focusedStrings,
        });
    };

    const openPracticeSetup = (mode: PracticeMode, source: string) => {
        setMode(mode);
        navigate("/practice", {
            state: {
                openPreFlight: true,
                source,
                mode,
            },
        });
    };

    const startNextStep = () => {
        if (weakSummary) {
            setMode("fretboardToNote");
            applyWeakAreaPracticePreset(weakSummary.stringIndex, weakSummary.fret);
            navigate("/practice", {
                state: {
                    openPreFlight: true,
                    source: "home-next-step-weak-spot",
                    mode: "fretboardToNote",
                },
            });
            return;
        }

        openPracticeSetup("fretboardToNote", "home-next-step-default");
    };

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-3">
                <div className="flex items-center justify-between">
                    <h1 className="type-display">Welcome back</h1>
                    <div className="inline-flex items-center gap-4 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm">
                        <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            <Flame className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                            {streakDays}
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            <Star className="h-4 w-4 text-primary" />
                            {xp}
                        </span>
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Level {level}</span>
                        <span>{xpToNext} XP to next level</span>
                    </div>
                    <MasteryBar value={xpProgress} showLabel={false} />
                </div>
            </header>

            <Card className="border-gold-200 bg-gradient-to-br from-gold-50/90 via-amber-50/50 to-graphite-50 dark:border-amber-500/30 dark:from-amber-900/20 dark:via-slate-950 dark:to-slate-900">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Your Next Step
                    </CardTitle>
                    <CardDescription>
                        {weakSummary
                            ? `Strings ${Math.max(1, weakSummary.stringIndex)}-${Math.min(6, weakSummary.stringIndex + 2)}, frets ${Math.max(1, weakSummary.fret - 2)}-${Math.min(12, weakSummary.fret + 2)} need extra reps.`
                            : "Start with a short fretboard drill to lock in note locations."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {hasPracticeData && (
                        <div className="grid gap-2 sm:grid-cols-3">
                            <StatLine icon={Target} label="Accuracy" value={`${overallAccuracy}%`} tone={overallAccuracy >= 75 ? "success" : overallAccuracy >= 50 ? "warning" : "danger"} />
                            <StatLine icon={Compass} label="Coverage" value={`${coverage}%`} tone={coverage >= 70 ? "success" : coverage >= 40 ? "warning" : "danger"} />
                            <StatLine icon={Trophy} label="Momentum" value={momentumLabel} />
                        </div>
                    )}
                    <Button size="lg" className="w-full control-btn--primary justify-between" onClick={startNextStep}>
                        <span className="inline-flex items-center gap-2">
                            <Play className="h-4 w-4" />
                            {weakSummary ? "Start Focused Practice" : "Start First Drill"}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Today&apos;s Challenge</CardTitle>
                    <CardDescription>Lightning Round · 30 notes · +100 XP</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3">
                    <Button className="control-btn--primary" onClick={() => openPracticeSetup("fretboardToNote", "home-daily-challenge")}>
                        <Play className="mr-2 h-4 w-4" />
                        Start Challenge
                    </Button>
                    <span className="text-sm text-muted-foreground">Fast recall under light time pressure.</span>
                </CardContent>
            </Card>

            {continuePrimary && (
                <Card className="border-border/80">
                    <CardHeader className="pb-3">
                        <CardTitle>Continue Last Session</CardTitle>
                        <CardDescription>
                            {continuePrimary.title} · Last practiced {continuePrimary.lastPracticed}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Mastery progress</span>
                            <span className="font-semibold text-foreground">{continuePrimary.mastery}%</span>
                        </div>
                        <MasteryBar value={continuePrimary.mastery} showLabel={false} />
                        <Button
                            size="lg"
                            className="w-full justify-between"
                            onClick={() => navigate(`/technique/${continuePrimary.id}`)}
                        >
                            <span className="inline-flex items-center gap-2">
                                <Play className="h-4 w-4" />
                                Resume Session
                            </span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            )}

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pinned</h2>
                    <span className="text-xs text-muted-foreground">{pinnedExercises.length}/{maxPins}</span>
                </div>
                {pinnedExercises.length === 0 ? (
                    <EmptyState
                        title="No pinned exercises yet"
                        description="Pin your favorites in Train for quick access here."
                        ctaLabel="Open Train"
                        onCtaClick={() => navigate("/train")}
                    />
                ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                        {pinnedExercises.map((exercise) => (
                            <div key={`pinned-home-${exercise.id}`} className="relative">
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                    onClick={() => unpin(exercise.id as PinnedExerciseId)}
                                    aria-label={`Unpin ${exercise.title}`}
                                    title="Unpin"
                                >
                                    <Star className="h-3.5 w-3.5 fill-current" />
                                </Button>
                                <ExerciseCard
                                    title={exercise.title}
                                    description="Pinned quick launch."
                                    difficulty={exercise.difficulty}
                                    mastery={exercise.mastery}
                                    icon={exercise.kind === "drill" ? Target : exercise.kind === "technique" ? Trophy : Music2}
                                    onClick={() =>
                                        exercise.kind === "drill"
                                            ? openPracticeSetup(exercise.id as PracticeMode, exercise.source)
                                            : exercise.kind === "technique"
                                                ? navigate(`/technique/${exercise.id}`)
                                                : navigate(`/rhythm/${exercise.id}`)
                                    }
                                />
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {(continueList.length > 0 || !continuePrimary) && (
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Continue</h2>
                    {continueList.length === 0 ? (
                        <EmptyState
                            title="No recent technique sessions"
                            description="Open Train and pick a technique exercise to build consistency."
                            ctaLabel="Open Train"
                            onCtaClick={() => navigate("/train")}
                        />
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {continueList.map((exercise) => (
                                <ExerciseCard
                                    key={exercise.id}
                                    title={exercise.title}
                                    description="Resume where you left off."
                                    difficulty="intermediate"
                                    mastery={exercise.mastery}
                                    lastPracticedLabel={exercise.lastPracticed}
                                    icon={Target}
                                    onClick={() => navigate(`/technique/${exercise.id}`)}
                                />
                            ))}
                        </div>
                    )}
                </section>
            )}

            <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Explore</h2>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => openPracticeSetup("fretboardToNote", "home-explore-drills")}>Fretboard Drills</Button>
                    <Button variant="outline" onClick={() => navigate("/train")}>Technique</Button>
                    <Button variant="outline" onClick={() => navigate("/theory/scales")}>Theory Tools</Button>
                    <Button variant="outline" onClick={() => navigate("/ear-training/sound-to-fret")}>Ear Training</Button>
                </div>
            </section>
        </div>
    );
}

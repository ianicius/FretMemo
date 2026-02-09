import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { AccuracyChart, type AccuracyChartPoint } from "@/components/progress/AccuracyChart";
import { EmptyState } from "@/components/ui/empty-state";
import { StatLine } from "@/components/ui/stat-line";
import { useFeedbackStore, type AppFeedbackTone } from "@/stores/useFeedbackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { NoteStatus } from "@/types/fretboard";
import { getNoteAt } from "@/lib/constants";
import { normalizeTuning } from "@/lib/tuning";
import { cn } from "@/lib/utils";
import { Award, BarChart3, Clock, Flame, RotateCcw, Target, TrendingUp } from "lucide-react";

const ACHIEVEMENT_ICONS: Record<string, React.ElementType> = {
    first_note: Target,
    streak_7: Flame,
    streak_30: Clock,
    perfect_session: Award,
    speed_demon: TrendingUp,
    explorer: Target,
};

export default function ProgressPage() {
    const navigate = useNavigate();
    const {
        positionStats,
        heatMapEnabled,
        toggleHeatMap,
        resetHeatMap,
        totalPracticeTime,
        streakDays,
        streakFreezes,
        totalCorrect,
        totalIncorrect,
        achievements,
        getAccuracyForFretboard,
        sessionHistory,
    } = useProgressStore();
    const leftHanded = useSettingsStore((state) => state.full.instrument.leftHanded);
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);
    const enqueueFeedback = useFeedbackStore((state) => state.enqueue);
    const [searchParams, setSearchParams] = useSearchParams();
    const [isResetHeatMapConfirmOpen, setIsResetHeatMapConfirmOpen] = useState(false);

    const chartRangeParam = searchParams.get("range");
    const chartRange: "week" | "month" | "all" =
        chartRangeParam === "month" || chartRangeParam === "all"
            ? chartRangeParam
            : "week";

    const setChartRange = (next: "week" | "month" | "all") => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("range", next);
        setSearchParams(nextParams, { replace: true });
    };

    const showFeedback = (message: string, tone: AppFeedbackTone = "info") => {
        enqueueFeedback(message, tone);
    };

    const stats = useMemo(() => {
        const total = totalCorrect + totalIncorrect;
        const accuracy = total > 0 ? Math.round((totalCorrect / total) * 100) : 0;
        const positionsPracticed = Object.keys(positionStats).length;
        const totalPositions = tuning.length * 12;
        const coverage = Math.round((positionsPracticed / totalPositions) * 100);

        const weakPositions = Object.entries(positionStats)
            .filter(([, data]) => data.total >= 3)
            .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
            .slice(0, 5);

        return { total, accuracy, positionsPracticed, coverage, weakPositions };
    }, [positionStats, totalCorrect, totalIncorrect, tuning.length]);

    const heatmapNotes: NoteStatus[] = useMemo(() => {
        if (!heatMapEnabled) return [];

        const data = getAccuracyForFretboard();
        return data
            .filter(({ accuracy }) => accuracy !== null)
            .map(({ position, accuracy }) => ({
                position,
                status: "idle" as const,
                opacity: 0.3 + ((accuracy || 0) * 0.7),
            }));
    }, [heatMapEnabled, getAccuracyForFretboard]);

    const ghostNotes: NoteStatus[] = useMemo(() => {
        if (stats.positionsPracticed > 0) return [];

        return tuning.flatMap((openNote, stringIndex) =>
            Array.from({ length: 12 }, (_, offset) => ({
                position: {
                    stringIndex,
                    fret: offset + 1,
                    note: getNoteAt(openNote, offset + 1),
                },
                status: "idle" as const,
                opacity: 0.1,
                color: "hsl(var(--muted-foreground) / 0.35)",
            }))
        );
    }, [stats.positionsPracticed, tuning]);

    const fretboardNotes = stats.positionsPracticed === 0 ? ghostNotes : heatmapNotes;

    const unlockedAchievements = achievements.filter((achievement) => achievement.unlockedAt);
    const chartData: AccuracyChartPoint[] = useMemo(() => {
        const dailyTotals = new Map<string, { correct: number; incorrect: number; total: number }>();

        let cutoffDateKey: string | null = null;
        if (chartRange === "week") {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 6);
            cutoffDateKey = cutoff.toISOString().split("T")[0];
        } else if (chartRange === "month") {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 29);
            cutoffDateKey = cutoff.toISOString().split("T")[0];
        }

        for (const session of sessionHistory) {
            const sessionDateIso = (session.endedAt || session.startedAt || new Date().toISOString()).split("T")[0];
            if (cutoffDateKey && sessionDateIso < cutoffDateKey) continue;

            const current = dailyTotals.get(sessionDateIso) || { correct: 0, incorrect: 0, total: 0 };
            const correct = session.correct || 0;
            const incorrect = session.incorrect || 0;

            dailyTotals.set(sessionDateIso, {
                correct: current.correct + correct,
                incorrect: current.incorrect + incorrect,
                total: current.total + correct + incorrect,
            });
        }

        return Array.from(dailyTotals.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, totals]) => {
                const date = new Date(`${day}T00:00:00`);
                const label = chartRange === "week"
                    ? date.toLocaleDateString(undefined, { weekday: "short" })
                    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

                return {
                    date: label,
                    accuracy: totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : 0,
                    total: totals.total,
                };
            });
    }, [sessionHistory, chartRange]);

    const handleResetHeatMap = () => setIsResetHeatMapConfirmOpen(true);
    const confirmResetHeatMap = () => {
        resetHeatMap();
        showFeedback("Heat map data has been reset.", "success");
    };

    return (
        <div className="space-y-6 pb-8">
            <div className="space-y-3">
                <h1 className="type-display">Progress</h1>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <StatLine icon={Target} label="Total Answers" value={stats.total} />
                    <StatLine icon={TrendingUp} label="Accuracy" value={`${stats.accuracy}%`} tone={stats.accuracy >= 75 ? "success" : stats.accuracy >= 50 ? "warning" : "danger"} />
                    <StatLine icon={BarChart3} label="Coverage" value={`${stats.coverage}%`} tone={stats.coverage >= 70 ? "success" : stats.coverage >= 40 ? "warning" : "danger"} />
                    <StatLine icon={Flame} label="Streak" value={`${streakDays}d • ${streakFreezes} freeze`} />
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl">Your Fretboard</CardTitle>
                        <CardDescription>
                            {stats.positionsPracticed} positions practiced • {stats.coverage}% coverage
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleHeatMap}
                            className={cn(heatMapEnabled && "border-primary/40 bg-primary/10")}
                        >
                            {heatMapEnabled ? "Hide" : "Show"} Heat Map
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetHeatMap}
                            className="text-destructive hover:text-destructive"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {stats.positionsPracticed === 0 && (
                        <EmptyState
                            title="Your fretboard map is empty"
                            description="Each note you practice lights up here. Start a short session to begin."
                            ctaLabel="Start Practice"
                            onCtaClick={() => navigate("/practice", { state: { openPreFlight: true, source: "progress-heatmap-empty", mode: "fretboardToNote" } })}
                        />
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <div className="inline-flex items-center gap-1">
                            <span className="h-3 w-3 rounded-full bg-rose-500/50" />
                            weak {"<"} 60%
                        </div>
                        <div className="inline-flex items-center gap-1">
                            <span className="h-3 w-3 rounded-full bg-amber-400/60" />
                            learning 60-85%
                        </div>
                        <div className="inline-flex items-center gap-1">
                            <span className="h-3 w-3 rounded-full bg-emerald-500/50" />
                            mastered {">"} 85%
                        </div>
                    </div>
                    <div className="rounded-xl border border-border bg-card/50 p-4">
                        <Fretboard
                            frets={12}
                            activeNotes={fretboardNotes}
                            tuning={tuning}
                            leftHanded={leftHanded}
                            className="max-w-full"
                            fitContainer
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <CardTitle className="text-xl">Accuracy Trend</CardTitle>
                            <CardDescription>Track consistency over time</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant={chartRange === "week" ? "secondary" : "outline"} onClick={() => setChartRange("week")}>
                                Week
                            </Button>
                            <Button size="sm" variant={chartRange === "month" ? "secondary" : "outline"} onClick={() => setChartRange("month")}>
                                Month
                            </Button>
                            <Button size="sm" variant={chartRange === "all" ? "secondary" : "outline"} onClick={() => setChartRange("all")}>
                                All
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <AccuracyChart data={chartData} />
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Focus Areas</CardTitle>
                        <CardDescription>Positions with the lowest retention</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats.weakPositions.length === 0 ? (
                            <EmptyState
                                title="No focus areas yet"
                                description="Complete a few sessions to identify weak spots."
                                ctaLabel="Open Train"
                                onCtaClick={() => navigate("/train")}
                            />
                        ) : (
                            <div className="space-y-3">
                                {stats.weakPositions.map(([key, data]) => {
                                    const [stringIndex, fret] = key.split("-").map(Number);
                                    const accuracy = Math.round((data.correct / data.total) * 100);
                                    return (
                                        <div key={key} className="rounded-lg border border-border bg-card p-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium">String {stringIndex + 1}, fret {fret}</span>
                                                <span className={cn(
                                                    "font-mono",
                                                    accuracy >= 75 ? "text-emerald-600 dark:text-emerald-400" : accuracy >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
                                                )}>
                                                    {accuracy}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <Button variant="outline" className="w-full" onClick={() => navigate("/practice", { state: { openPreFlight: true, source: "progress-focus-spots", mode: "fretboardToNote" } })}>
                                    Practice Weak Spots
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Achievements</CardTitle>
                        <CardDescription>{unlockedAchievements.length} / {achievements.length} unlocked</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {achievements.map((achievement) => {
                                const Icon = ACHIEVEMENT_ICONS[achievement.id] ?? Award;
                                return (
                                    <div
                                        key={achievement.id}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg border p-3",
                                            achievement.unlockedAt
                                                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                                                : "border-border bg-muted/40 opacity-70"
                                        )}
                                    >
                                        <div className="rounded-full bg-background p-2 text-muted-foreground">
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">{achievement.name}</p>
                                            <p className="text-xs text-muted-foreground">{achievement.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="text-xs text-muted-foreground">
                Practice time: {Math.floor(totalPracticeTime / 60)}h {totalPracticeTime % 60}m
            </div>

            <ConfirmDialog
                open={isResetHeatMapConfirmOpen}
                onOpenChange={setIsResetHeatMapConfirmOpen}
                title="Reset Heat Map Data?"
                description="This will remove all heat map entries."
                confirmLabel="Reset"
                confirmVariant="destructive"
                onConfirm={confirmResetHeatMap}
            />
        </div>
    );
}

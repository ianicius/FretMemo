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
import { useTranslation, Trans } from "react-i18next";
import { MasteryBar } from "@/components/ui/mastery-bar";
import { StatLine } from "@/components/ui/stat-line";
import { ArrowRight, Compass, Flame, Music2, Play, Sparkles, Star, Target, Trophy, Gift, CheckCircle2 } from "lucide-react";
import { getLevelProgress } from "@/lib/progression";
import { useQuestStore } from "@/stores/useQuestStore";

type PracticeMode = "fretboardToNote" | "tabToNote" | "noteToTab" | "playNotes" | "playTab";
type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";

const TECHNIQUE_TITLE_KEYS: Record<string, string> = {
    spider: "technique.spider.name",
    permutation: "technique.permutation.name",
    linear: "technique.linear.name",
    diagonal: "technique.diagonal.name",
    stringskip: "technique.stringskip.name",
    legato: "technique.legato.name",
};

const DRILL_META: Record<PracticeMode, { titleKey: string; titleFallback: string; difficulty: ExerciseDifficulty; source: string; masteryOffset: number }> = {
    fretboardToNote: {
        titleKey: "practice.modes.fretboardToNote",
        titleFallback: "Fretboard -> Note",
        difficulty: "beginner",
        source: "home-pinned-fretboard-to-note",
        masteryOffset: 0,
    },
    playNotes: {
        titleKey: "practice.modes.playNotes",
        titleFallback: "Note Generator",
        difficulty: "beginner",
        source: "home-pinned-note-names",
        masteryOffset: 8,
    },
    noteToTab: {
        titleKey: "practice.modes.noteToTab",
        titleFallback: "Note -> Tab",
        difficulty: "intermediate",
        source: "home-pinned-note-to-tab",
        masteryOffset: 16,
    },
    tabToNote: {
        titleKey: "practice.modes.tabToNote",
        titleFallback: "Tab -> Note",
        difficulty: "intermediate",
        source: "home-pinned-tab-to-note",
        masteryOffset: 24,
    },
    playTab: {
        titleKey: "practice.modes.playTab",
        titleFallback: "Tab Sequence",
        difficulty: "advanced",
        source: "home-pinned-tab-sequence",
        masteryOffset: 32,
    },
};

const TECHNIQUE_META: Record<string, { titleFallback: string; difficulty: ExerciseDifficulty }> = {
    spider: { titleFallback: "Spider Walk", difficulty: "beginner" },
    permutation: { titleFallback: "Permutation Trainer", difficulty: "intermediate" },
    linear: { titleFallback: "Linear Shifter", difficulty: "intermediate" },
    diagonal: { titleFallback: "Diagonal Patterns", difficulty: "intermediate" },
    stringskip: { titleFallback: "String Skipping", difficulty: "advanced" },
    legato: { titleFallback: "Legato Builder", difficulty: "intermediate" },
};

const RHYTHM_META: Record<RhythmModeId, { titleKey: string; titleFallback: string; difficulty: ExerciseDifficulty }> = {
    "tap-beat": { titleKey: "rhythmModes.tapBeat", titleFallback: "Tap the Beat", difficulty: "beginner" },
    "strum-patterns": { titleKey: "rhythmModes.strumPatterns", titleFallback: "Strum Patterns", difficulty: "beginner" },
    "rhythm-reading": { titleKey: "rhythmModes.rhythmReading", titleFallback: "Rhythm Reading", difficulty: "intermediate" },
    "groove-lab": { titleKey: "rhythmModes.grooveLab", titleFallback: "Groove Lab", difficulty: "intermediate" },
};

const TECHNIQUE_MASTERY_TARGET_BPM: Record<string, number> = {
    spider: 120,
    permutation: 140,
    linear: 140,
    diagonal: 140,
    stringskip: 160,
    legato: 150,
};

function formatRelativeTime(
    isoTimestamp: string | null,
    t: (key: string, options?: Record<string, unknown>) => string,
): string {
    if (!isoTimestamp) return t("home.time.new");
    const timestamp = Date.parse(isoTimestamp);
    if (Number.isNaN(timestamp)) return t("home.time.new");

    const elapsedMs = Date.now() - timestamp;
    if (elapsedMs < 60_000) return t("home.time.justNow");

    const elapsedMinutes = Math.floor(elapsedMs / 60_000);
    if (elapsedMinutes < 60) return t("home.time.minutesAgo", { count: elapsedMinutes });

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return t("home.time.hoursAgo", { count: elapsedHours });

    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays === 1) return t("home.time.yesterday");
    if (elapsedDays < 7) return t("home.time.daysAgo", { count: elapsedDays });

    return new Date(isoTimestamp).toLocaleDateString();
}

export default function Home() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { streakDays, totalCorrect, totalIncorrect, positionStats, totalXP } = useProgressStore();
    const { setMode, setPracticeConstraints } = useGameStore();
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const techniqueSettings = useSettingsStore((state) => state.modules.technique);
    const pinnedIds = usePinnedExercisesStore((state) => state.pinnedIds);
    const maxPins = usePinnedExercisesStore((state) => state.maxPins);
    const unpin = usePinnedExercisesStore((state) => state.unpin);
    const rhythmModeStats = useRhythmDojoStore((state) => state.modeStats);
    const getRhythmModeMastery = useRhythmDojoStore((state) => state.getModeMastery);
    const quests = useQuestStore((state) => state.quests);
    const claimReward = useQuestStore((state) => state.claimReward);

    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);
    const positionsPracticed = Object.keys(positionStats).length;
    const totalPositions = tuning.length * 12;
    const coverage = Math.round((positionsPracticed / totalPositions) * 100);
    const hasPracticeData = totalCorrect + totalIncorrect > 0 || positionsPracticed > 0;

    const overallAccuracy = totalCorrect + totalIncorrect > 0
        ? Math.round((totalCorrect / (totalCorrect + totalIncorrect)) * 100)
        : 0;
    const xp = totalXP ?? totalCorrect * 10;
    const { level, progressPercent, xpRemaining } = getLevelProgress(xp);
    const xpProgress = progressPercent;
    const xpToNext = xpRemaining;
    const momentumLabel = streakDays > 1
        ? t("home.momentumDays", { count: streakDays })
        : streakDays === 1
            ? t("home.momentumDay")
            : t("home.momentumStart");

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
                title: t(TECHNIQUE_TITLE_KEYS[id] ?? "", "Technique Drill"),
                mastery,
                lastPracticed: formatRelativeTime(lastPracticed, t),
            };
        });
    }, [t, techniqueSettings.bestBpm, techniqueSettings.lastPracticedAt]);
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
                        title: t(drill.titleKey, drill.titleFallback),
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
                        title: t(rhythmMeta.titleKey, rhythmMeta.titleFallback),
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
                    title: t(TECHNIQUE_TITLE_KEYS[id] ?? "", technique.titleFallback),
                    difficulty: technique.difficulty,
                    kind: "technique" as const,
                    mastery: bestBpm > 0
                        ? Math.min(100, Math.round((bestBpm / masteryTarget) * 100))
                        : 0,
                };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));
    }, [getRhythmModeMastery, overallAccuracy, pinnedIds, rhythmModeStats, t, techniqueSettings.bestBpm]);

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
                    <h1 className="type-display">{t('home.welcome')}</h1>
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
                        <span>{t('home.level', { level })}</span>
                        <span>{t('home.xpToNext', { xp: xpToNext })}</span>
                    </div>
                    <MasteryBar value={xpProgress} showLabel={false} />
                </div>
            </header>

            <Card className="border-gold-200 bg-gradient-to-br from-gold-50/90 via-amber-50/50 to-graphite-50 dark:border-amber-500/30 dark:from-amber-900/20 dark:via-slate-950 dark:to-slate-900">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        {t('home.nextStep')}
                    </CardTitle>
                    <CardDescription>
                        {weakSummary
                            ? <Trans
                                i18nKey="home.nextStepDescWeak"
                                values={{
                                    minStr: Math.max(1, weakSummary.stringIndex),
                                    maxStr: Math.min(6, weakSummary.stringIndex + 2),
                                    minFret: Math.max(1, weakSummary.fret - 2),
                                    maxFret: Math.min(12, weakSummary.fret + 2)
                                }}
                            />
                            : t('home.nextStepDescDefault')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {hasPracticeData && (
                        <div className="grid gap-2 sm:grid-cols-3">
                            <StatLine icon={Target} label={t('home.accuracy')} value={`${overallAccuracy}%`} tone={overallAccuracy >= 75 ? "success" : overallAccuracy >= 50 ? "warning" : "danger"} />
                            <StatLine icon={Compass} label={t('home.coverage')} value={`${coverage}%`} tone={coverage >= 70 ? "success" : coverage >= 40 ? "warning" : "danger"} />
                            <StatLine icon={Trophy} label={t('home.momentum')} value={momentumLabel} />
                        </div>
                    )}
                    <Button size="lg" className="w-full control-btn--primary justify-between" onClick={startNextStep}>
                        <span className="inline-flex items-center gap-2">
                            <Play className="h-4 w-4" />
                            {weakSummary ? t('home.startFocused') : t('home.startFirst')}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>

            <Card className="border-border/80">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-indigo-500" />
                        <CardTitle>{t('home.dailyQuests')}</CardTitle>
                    </div>
                    <CardDescription>{t('home.dailyQuestsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {quests.map((quest) => (
                        <div key={quest.id} className="space-y-2">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold">{t(`quests.${quest.title.replace(/\s+/g, '').replace(/^[A-Z]/, c => c.toLowerCase())}.title`, quest.title)}</h4>
                                    <p className="text-xs text-muted-foreground">{t(`quests.${quest.title.replace(/\s+/g, '').replace(/^[A-Z]/, c => c.toLowerCase())}.description`, quest.description)}</p>
                                </div>
                                {!quest.isClaimed && quest.isCompleted ? (
                                    <Button
                                        size="sm"
                                        className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white animate-pulse"
                                        onClick={() => claimReward(quest.id)}
                                    >
                                        <Gift className="mr-1 h-3.5 w-3.5" />
                                        {t('home.claimXp', { xp: quest.xpReward })}
                                    </Button>
                                ) : quest.isClaimed ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                                        <CheckCircle2 className="h-4 w-4" />
                                        {t('home.claimed')}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                        <Star className="h-3 w-3" />
                                        {t("home.xpShort", { xp: quest.xpReward })}
                                    </span>
                                )}
                            </div>
                            <MasteryBar
                                value={Math.min(100, Math.round((quest.current / quest.target) * 100))}
                                showLabel={false}
                                className={quest.isCompleted ? "opacity-30" : ""}
                            />
                            <div className="flex w-full justify-between text-[10px] text-muted-foreground">
                                <span>{quest.current}</span>
                                <span>{quest.target}</span>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {continuePrimary && (
                <Card className="border-border/80">
                    <CardHeader className="pb-3">
                        <CardTitle>{t('home.continueLast')}</CardTitle>
                        <CardDescription>
                            {continuePrimary.title} · {t('home.lastPracticed', { time: continuePrimary.lastPracticed })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{t('home.masteryProgress')}</span>
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
                                {t('home.resumeSession')}
                            </span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            )}

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('home.pinned')}</h2>
                    <span className="text-xs text-muted-foreground">{pinnedExercises.length}/{maxPins}</span>
                </div>
                {pinnedExercises.length === 0 ? (
                    <EmptyState
                        title={t('home.noPinned')}
                        description={t('home.noPinnedDesc')}
                        ctaLabel={t('home.openTrain')}
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
                                    aria-label={t("home.unpinAria", { title: exercise.title })}
                                    title={t("home.unpin")}
                                >
                                    <Star className="h-3.5 w-3.5 fill-current" />
                                </Button>
                                <ExerciseCard
                                    title={exercise.title}
                                    description={t("home.pinnedQuickLaunch")}
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
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('home.continue')}</h2>
                    {continueList.length === 0 ? (
                        <EmptyState
                            title={t('home.noRecent')}
                            description={t('home.noRecentDesc')}
                            ctaLabel={t('home.openTrain')}
                            onCtaClick={() => navigate("/train")}
                        />
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {continueList.map((exercise) => (
                                <ExerciseCard
                                    key={exercise.id}
                                    title={exercise.title}
                                    description={t("home.resumeWhereLeft")}
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('home.explore')}</h2>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => openPracticeSetup("fretboardToNote", "home-explore-drills")}>{t('home.fretboardDrills')}</Button>
                    <Button variant="outline" onClick={() => navigate("/train")}>{t('home.technique')}</Button>
                    <Button variant="outline" onClick={() => navigate("/theory/scales")}>{t('home.theoryTools')}</Button>
                    <Button variant="outline" onClick={() => navigate("/ear-training/sound-to-fret")}>{t('home.earTraining')}</Button>
                </div>
            </section>
        </div>
    );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useProgressStore } from "@/stores/useProgressStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { usePinnedExercisesStore, type PinnedExerciseId } from "@/stores/usePinnedExercisesStore";
import { useRhythmDojoStore, type RhythmModeId } from "@/stores/useRhythmDojoStore";
import { SectionCollapse } from "@/components/ui/section-collapse";
import { ExerciseCard } from "@/components/ui/exercise-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Compass, Drum, Ear, Guitar, Music2, Sparkles, Star, Target } from "lucide-react";
import { useTranslation } from "react-i18next";

type TechniqueDifficulty = "beginner" | "intermediate" | "advanced";
type PracticeMode = "fretboardToNote" | "tabToNote" | "noteToTab" | "playNotes" | "playTab";
type TrainSectionKey = "pinned" | "drills" | "technique" | "theory" | "ear" | "rhythm";
type TrainSectionsOpenState = Record<TrainSectionKey, boolean>;

type CatalogCard = {
    id: PracticeMode;
    title: string;
    difficulty: TechniqueDifficulty;
    priority: number;
    mastery: number;
    isNew: boolean;
    source: string;
    minLevel?: number;
    isLocked?: boolean;
};

interface TechniqueExerciseItem {
    id: string;
    title: string;
    difficulty: TechniqueDifficulty;
}

interface RhythmExerciseItem {
    id: RhythmModeId;
    title: string;
    difficulty: TechniqueDifficulty;
    priority: number;
    status: "active" | "coming-soon";
    minLevel?: number;
}

interface TrainUiStateSnapshot {
    sectionsOpen: TrainSectionsOpenState;
    scrollTop: number;
}

const DIFFICULTY_RANK: Record<TechniqueDifficulty, number> = {
    beginner: 0,
    intermediate: 1,
    advanced: 2,
};

const EXERCISE_MASTERY_TARGET_BPM: Record<string, number> = {
    spider: 120,
    permutation: 140,
    linear: 140,
    diagonal: 140,
    stringskip: 160,
    legato: 150,
};

const DRILLS: Array<{
    id: PracticeMode;
    title: string;
    difficulty: TechniqueDifficulty;
    priority: number;
    source: string;
    minLevel?: number;
}> = [
        {
            id: "fretboardToNote",
            title: "Fretboard → Note",
            difficulty: "beginner",
            priority: 1,
            source: "train-drills-fretboard-to-note",
        },
        {
            id: "playNotes",
            title: "Note Generator",
            difficulty: "beginner",
            priority: 2,
            source: "train-drills-play-note-names",
            minLevel: 2,
        },
        {
            id: "noteToTab",
            title: "Note → Tab",
            difficulty: "intermediate",
            priority: 3,
            source: "train-drills-note-to-tab",
            minLevel: 3,
        },
        {
            id: "tabToNote",
            title: "Tab → Note",
            difficulty: "intermediate",
            priority: 4,
            source: "train-drills-tab-to-note",
            minLevel: 3,
        },
        {
            id: "playTab",
            title: "Tab Sequence",
            difficulty: "advanced",
            priority: 5,
            source: "train-drills-play-tab-sequence",
            minLevel: 5,
        },
    ];

const TRAIN_UI_STATE_KEY = "fretmemo.train.ui";

const DEFAULT_SECTIONS_OPEN: TrainSectionsOpenState = {
    pinned: false,
    drills: true,
    technique: true,
    theory: true,
    ear: true,
    rhythm: true,
};

function normalizeSectionsOpen(
    sectionsOpen: Partial<TrainSectionsOpenState> | null | undefined,
    pinnedDefaultOpen: boolean
): TrainSectionsOpenState {
    return {
        pinned: typeof sectionsOpen?.pinned === "boolean" ? sectionsOpen.pinned : pinnedDefaultOpen,
        drills: typeof sectionsOpen?.drills === "boolean" ? sectionsOpen.drills : DEFAULT_SECTIONS_OPEN.drills,
        technique: typeof sectionsOpen?.technique === "boolean" ? sectionsOpen.technique : DEFAULT_SECTIONS_OPEN.technique,
        theory: typeof sectionsOpen?.theory === "boolean" ? sectionsOpen.theory : DEFAULT_SECTIONS_OPEN.theory,
        ear: typeof sectionsOpen?.ear === "boolean" ? sectionsOpen.ear : DEFAULT_SECTIONS_OPEN.ear,
        rhythm: typeof sectionsOpen?.rhythm === "boolean" ? sectionsOpen.rhythm : DEFAULT_SECTIONS_OPEN.rhythm,
    };
}

function readTrainUiState(): TrainUiStateSnapshot | null {
    if (typeof window === "undefined") return null;

    try {
        const raw = window.sessionStorage.getItem(TRAIN_UI_STATE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<TrainUiStateSnapshot>;
        if (!parsed || typeof parsed !== "object") return null;

        const scrollTop = typeof parsed.scrollTop === "number" ? Math.max(0, parsed.scrollTop) : 0;
        const sectionsOpen = normalizeSectionsOpen(parsed.sectionsOpen, DEFAULT_SECTIONS_OPEN.pinned);

        return { sectionsOpen, scrollTop };
    } catch {
        return null;
    }
}

function writeTrainUiState(snapshot: TrainUiStateSnapshot): void {
    if (typeof window === "undefined") return;

    try {
        window.sessionStorage.setItem(TRAIN_UI_STATE_KEY, JSON.stringify(snapshot));
    } catch {
        // Ignore persistence errors (private mode / storage limits)
    }
}

const TECHNIQUE_EXERCISES: TechniqueExerciseItem[] = [
    { id: "spider", title: "Spider Walk", difficulty: "beginner" },
    { id: "permutation", title: "Permutation Trainer", difficulty: "intermediate" },
    { id: "linear", title: "Linear Shifter", difficulty: "intermediate" },
    { id: "diagonal", title: "Diagonal Patterns", difficulty: "intermediate" },
    { id: "stringskip", title: "String Skipping", difficulty: "advanced" },
    { id: "legato", title: "Legato Builder", difficulty: "intermediate" },
];

const RHYTHM_EXERCISES: RhythmExerciseItem[] = [
    { id: "tap-beat", title: "Tap the Beat", difficulty: "beginner", priority: 1, status: "active" },
    { id: "strum-patterns", title: "Strum Patterns", difficulty: "beginner", priority: 2, status: "active" },
    { id: "rhythm-reading", title: "Rhythm Reading", difficulty: "intermediate", priority: 3, status: "active" },
    { id: "groove-lab", title: "Groove Lab", difficulty: "intermediate", priority: 4, status: "active" },
];

const RHYTHM_MODE_TITLE_KEYS: Record<RhythmModeId, string> = {
    "tap-beat": "rhythmModes.tapBeat",
    "strum-patterns": "rhythmModes.strumPatterns",
    "rhythm-reading": "rhythmModes.rhythmReading",
    "groove-lab": "rhythmModes.grooveLab",
};

function getMasteryTargetBpm(exerciseId: string, difficulty: TechniqueDifficulty): number {
    if (EXERCISE_MASTERY_TARGET_BPM[exerciseId]) {
        return EXERCISE_MASTERY_TARGET_BPM[exerciseId];
    }
    if (difficulty === "beginner") return 120;
    if (difficulty === "intermediate") return 140;
    return 160;
}

function sortCatalogCards<T extends { title: string; difficulty: TechniqueDifficulty; mastery: number; priority?: number }>(items: T[]): T[] {
    return [...items].sort((left, right) => {
        const difficultyDiff = DIFFICULTY_RANK[left.difficulty] - DIFFICULTY_RANK[right.difficulty];
        if (difficultyDiff !== 0) return difficultyDiff;

        const leftPriority = left.priority ?? Number.MAX_SAFE_INTEGER;
        const rightPriority = right.priority ?? Number.MAX_SAFE_INTEGER;
        const priorityDiff = leftPriority - rightPriority;
        if (priorityDiff !== 0) return priorityDiff;

        const masteryDiff = left.mastery - right.mastery;
        if (masteryDiff !== 0) return masteryDiff;

        return left.title.localeCompare(right.title);
    });
}

function getAverageMastery(items: Array<{ mastery: number }>): number {
    if (items.length === 0) return 0;
    const total = items.reduce((sum, item) => sum + item.mastery, 0);
    return Math.round(total / items.length);
}

export default function Library() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const navigationType = useNavigationType();
    const techniqueSettings = useSettingsStore((state) => state.modules.technique);
    const rhythmModeStats = useRhythmDojoStore((state) => state.modeStats);
    const getRhythmModeMastery = useRhythmDojoStore((state) => state.getModeMastery);
    const { totalCorrect, totalIncorrect, sessionHistory } = useProgressStore();
    const pinnedIds = usePinnedExercisesStore((state) => state.pinnedIds);
    const maxPins = usePinnedExercisesStore((state) => state.maxPins);
    const togglePinned = usePinnedExercisesStore((state) => state.togglePinned);
    const hasSessionHistory = sessionHistory.length > 0;
    const scrollContainerRef = useRef<HTMLElement | null>(null);
    const hasRestoredScrollRef = useRef(false);
    const [sectionsOpen, setSectionsOpen] = useState<TrainSectionsOpenState>(() => {
        const savedState = readTrainUiState();
        return normalizeSectionsOpen(savedState?.sectionsOpen, pinnedIds.length > 0);
    });
    const sectionsOpenRef = useRef(sectionsOpen);

    useEffect(() => {
        sectionsOpenRef.current = sectionsOpen;
        const currentScrollTop = scrollContainerRef.current?.scrollTop ?? readTrainUiState()?.scrollTop ?? 0;
        writeTrainUiState({
            sectionsOpen,
            scrollTop: Math.max(0, currentScrollTop),
        });
    }, [sectionsOpen]);

    useLayoutEffect(() => {
        if (typeof window === "undefined") return;

        const container = document.getElementById("app-main-scroll");
        if (!(container instanceof HTMLElement)) {
            hasRestoredScrollRef.current = true;
            return;
        }
        scrollContainerRef.current = container;

        const routeState = location.state as { restoreTrain?: boolean } | null;
        const shouldRestoreScroll = navigationType === "POP" || Boolean(routeState?.restoreTrain);
        const savedState = readTrainUiState();
        if (!shouldRestoreScroll || !savedState || savedState.scrollTop <= 0) {
            hasRestoredScrollRef.current = true;
            return;
        }

        const targetScrollTop = Math.max(0, savedState.scrollTop);
        const restoreScroll = () => {
            container.scrollTop = targetScrollTop;
            container.scrollTo({ top: targetScrollTop, left: 0, behavior: "auto" });
        };

        restoreScroll();
        const frameId = window.requestAnimationFrame(restoreScroll);
        const timeoutId = window.setTimeout(restoreScroll, 60);
        hasRestoredScrollRef.current = true;

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearTimeout(timeoutId);
        };
    }, [location.key, location.state, navigationType]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const container = scrollContainerRef.current ?? document.getElementById("app-main-scroll");
        if (!(container instanceof HTMLElement)) return;
        scrollContainerRef.current = container;

        const persistScroll = () => {
            if (!hasRestoredScrollRef.current) return;
            writeTrainUiState({
                sectionsOpen: sectionsOpenRef.current,
                scrollTop: Math.max(0, container.scrollTop),
            });
        };

        persistScroll();
        container.addEventListener("scroll", persistScroll, { passive: true });
        return () => container.removeEventListener("scroll", persistScroll);
    }, []);

    const handleSectionOpenChange = (section: TrainSectionKey, nextOpen: boolean) => {
        setSectionsOpen((previousState) => {
            if (previousState[section] === nextOpen) {
                return previousState;
            }

            return {
                ...previousState,
                [section]: nextOpen,
            };
        });
    };

    const overallAccuracy = totalCorrect + totalIncorrect > 0
        ? Math.round((totalCorrect / (totalCorrect + totalIncorrect)) * 100)
        : 0;

    const drillCards = useMemo<CatalogCard[]>(() => {
        const cards = DRILLS.map((drill, index) => ({
            id: drill.id,
            title: t(`practice.modes.${drill.id}`, drill.title),
            difficulty: drill.difficulty,
            priority: drill.priority,
            source: drill.source,
            mastery: Math.max(0, overallAccuracy - index * 8),
            isNew: !hasSessionHistory,
            minLevel: drill.minLevel,
            isLocked: false, // drill.minLevel ? drill.minLevel > userLevel : false,
        }));

        return sortCatalogCards(cards);
    }, [hasSessionHistory, overallAccuracy, t]);

    const techniqueCards = useMemo(() => {
        const bestBpm = techniqueSettings.bestBpm ?? {};
        const sessionsCompleted = techniqueSettings.sessionsCompleted ?? {};

        const cards = TECHNIQUE_EXERCISES.map((exercise) => {
            const exerciseBestBpm = bestBpm[exercise.id] ?? 0;
            const masteryTarget = getMasteryTargetBpm(exercise.id, exercise.difficulty);
            const mastery = exerciseBestBpm > 0
                ? Math.min(100, Math.round((exerciseBestBpm / masteryTarget) * 100))
                : 0;
            const sessionCount = sessionsCompleted[exercise.id] ?? 0;

            return {
                ...exercise,
                title: t(`technique.${exercise.id}.name`, exercise.title),
                mastery,
                isNew: sessionCount === 0 && mastery === 0,
            };
        });

        return sortCatalogCards(cards);
    }, [techniqueSettings.bestBpm, techniqueSettings.sessionsCompleted, t]);

    const rhythmCards = useMemo(() => {
        const cards = RHYTHM_EXERCISES.map((mode) => {
            const modeStats = rhythmModeStats[mode.id];
            const sessions = modeStats?.sessions ?? 0;
            const modeMastery = getRhythmModeMastery(mode.id);
            const translatedTitle = t(RHYTHM_MODE_TITLE_KEYS[mode.id], mode.title);
            const title = mode.status === "coming-soon" ? `${translatedTitle} (${t("library.soon")})` : translatedTitle;

            return {
                ...mode,
                title,
                mastery: modeMastery,
                isNew: sessions === 0,
            };
        });

        return sortCatalogCards(cards);
    }, [getRhythmModeMastery, rhythmModeStats, t]);

    const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
    const isPinLimitReached = pinnedIds.length >= maxPins;

    const pinnedCards = useMemo(() => {
        const drillById = new Map(drillCards.map((drill) => [drill.id as PinnedExerciseId, drill]));
        const techniqueById = new Map(techniqueCards.map((exercise) => [exercise.id as PinnedExerciseId, exercise]));
        const rhythmById = new Map(rhythmCards.map((mode) => [mode.id as PinnedExerciseId, mode]));

        return pinnedIds
            .map((id) => {
                const drill = drillById.get(id);
                if (drill) {
                    return {
                        id,
                        kind: "drill" as const,
                        title: drill.title,
                        difficulty: drill.difficulty,
                        mastery: drill.mastery,
                        isNew: drill.isNew,
                        source: drill.source,
                        minLevel: drill.minLevel,
                        isLocked: false, // (drill.minLevel && drill.minLevel > userLevel) ? true : false,
                    };
                }

                const technique = techniqueById.get(id);
                if (technique) {
                    return {
                        id,
                        kind: "technique" as const,
                        title: technique.title,
                        difficulty: technique.difficulty,
                        mastery: technique.mastery,
                        isNew: technique.isNew,
                    };
                }

                const rhythm = rhythmById.get(id);
                if (rhythm) {
                    return {
                        id,
                        kind: "rhythm" as const,
                        title: rhythm.title,
                        difficulty: rhythm.difficulty,
                        mastery: rhythm.mastery,
                        isNew: rhythm.isNew,
                        minLevel: rhythm.minLevel,
                        isLocked: false, // (rhythm.minLevel && rhythm.minLevel > userLevel) ? true : false,
                    };
                }

                return null;
            })
            .filter((card): card is NonNullable<typeof card> => Boolean(card));
    }, [drillCards, pinnedIds, rhythmCards, techniqueCards]);

    const drillSummary = useMemo(
        () => t('library.summary.modes', { count: drillCards.length, avg: getAverageMastery(drillCards) }),
        [drillCards, t]
    );
    const techniqueSummary = useMemo(
        () => t('library.summary.exercises', { count: techniqueCards.length, avg: getAverageMastery(techniqueCards) }),
        [techniqueCards, t]
    );
    const rhythmSummary = useMemo(
        () => t('library.summary.modes', { count: rhythmCards.length, avg: getAverageMastery(rhythmCards) }),
        [rhythmCards, t]
    );
    const pinnedSummary = useMemo(() => {
        const avg = getAverageMastery(pinnedCards);
        return t('library.summary.pinned', { count: pinnedCards.length, max: maxPins, avg });
    }, [maxPins, pinnedCards, t]);

    const openPracticeSetup = (mode: PracticeMode, source: string) => {
        navigate("/practice", {
            state: {
                openPreFlight: true,
                source,
                mode,
            },
        });
    };

    const openTechnique = (techniqueId: string, source: string) => {
        navigate(`/technique/${techniqueId}`, {
            state: {
                fromTrain: true,
                entrySource: source,
            },
        });
    };

    const openRhythm = (rhythmId: RhythmModeId, source: string) => {
        navigate(`/rhythm/${rhythmId}`, {
            state: {
                fromTrain: true,
                entrySource: source,
            },
        });
    };

    const openTheory = (toolId: string, source: string) => {
        navigate(`/theory/${toolId}`, {
            state: {
                entrySource: source,
            },
        });
    };

    const openEarTraining = (modeId: string, source: string) => {
        navigate(`/ear-training/${modeId}`, {
            state: {
                entrySource: source,
            },
        });
    };

    return (
        <div className="space-y-5 pb-8">
            <div>
                <h1 className="type-display">{t('library.title')}</h1>
                <p className="mt-1 text-muted-foreground">
                    {t('library.description')}
                </p>
            </div>

            <SectionCollapse
                title={t('library.pinned')}
                summary={pinnedSummary}
                open={sectionsOpen.pinned}
                onOpenChange={(nextOpen) => handleSectionOpenChange("pinned", nextOpen)}
            >
                {pinnedCards.length === 0 ? (
                    <EmptyState
                        title={t("library.noPinnedTitle")}
                        description={t("library.noPinnedDesc")}
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[390px]:gap-2.5 min-[412px]:gap-3 lg:grid-cols-3">
                        {pinnedCards.map((card) => (
                            <div key={`pinned-${card.id}`} className="relative">
                                <button
                                    type="button"
                                    className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-sm transition hover:bg-primary/20"
                                    onClick={() => togglePinned(card.id)}
                                    aria-label={t("library.unpinAria", { title: card.title })}
                                    title={t("library.unpin")}
                                >
                                    <Star className="h-3.5 w-3.5 fill-current" />
                                </button>
                                <ExerciseCard
                                    title={card.title}
                                    difficulty={card.difficulty}
                                    mastery={card.mastery}
                                    icon={card.kind === "drill" ? Target : card.kind === "technique" ? Guitar : Drum}
                                    variant="catalog"
                                    isNew={card.isNew}
                                    isLocked={card.isLocked}
                                    minLevel={card.minLevel}
                                    onClick={() =>
                                        card.kind === "drill"
                                            ? openPracticeSetup(card.id as PracticeMode, card.source)
                                            : card.kind === "technique"
                                                ? openTechnique(card.id, "train_pinned_technique")
                                                : openRhythm(card.id as RhythmModeId, "train_pinned_rhythm")
                                    }
                                />
                            </div>
                        ))}
                    </div>
                )}
            </SectionCollapse>

            <SectionCollapse
                title={t('library.drills')}
                summary={drillSummary}
                open={sectionsOpen.drills}
                onOpenChange={(nextOpen) => handleSectionOpenChange("drills", nextOpen)}
            >
                <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[390px]:gap-2.5 min-[412px]:gap-3 lg:grid-cols-3">
                    {drillCards.map((drill) => (
                        <div key={drill.id} className="relative">
                            <button
                                type="button"
                                className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => togglePinned(drill.id as PinnedExerciseId)}
                                disabled={!pinnedSet.has(drill.id as PinnedExerciseId) && isPinLimitReached}
                                aria-label={
                                    pinnedSet.has(drill.id as PinnedExerciseId)
                                        ? t("library.unpinAria", { title: drill.title })
                                        : t("library.pinAria", { title: drill.title })
                                }
                                title={
                                    !pinnedSet.has(drill.id as PinnedExerciseId) && isPinLimitReached
                                        ? t("library.pinLimitReached", { max: maxPins })
                                        : pinnedSet.has(drill.id as PinnedExerciseId)
                                            ? t("library.unpin")
                                            : t("library.pin")
                                }
                            >
                                <Star className={cn("h-3.5 w-3.5", pinnedSet.has(drill.id as PinnedExerciseId) && "fill-current text-primary")} />
                            </button>
                            <ExerciseCard
                                title={drill.title}
                                difficulty={drill.difficulty}
                                mastery={drill.mastery}
                                icon={Target}
                                variant="catalog"
                                isNew={drill.isNew}
                                isLocked={drill.isLocked}
                                minLevel={drill.minLevel}
                                onClick={() => openPracticeSetup(drill.id as PracticeMode, drill.source)}
                            />
                        </div>
                    ))}
                </div>
            </SectionCollapse>

            <SectionCollapse
                title={t('library.technique')}
                summary={techniqueSummary}
                open={sectionsOpen.technique}
                onOpenChange={(nextOpen) => handleSectionOpenChange("technique", nextOpen)}
            >
                <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[390px]:gap-2.5 min-[412px]:gap-3 lg:grid-cols-3">
                    {techniqueCards.map((exercise) => (
                        <div key={exercise.id} className="relative">
                            <button
                                type="button"
                                className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => togglePinned(exercise.id as PinnedExerciseId)}
                                disabled={!pinnedSet.has(exercise.id as PinnedExerciseId) && isPinLimitReached}
                                aria-label={
                                    pinnedSet.has(exercise.id as PinnedExerciseId)
                                        ? t("library.unpinAria", { title: exercise.title })
                                        : t("library.pinAria", { title: exercise.title })
                                }
                                title={
                                    !pinnedSet.has(exercise.id as PinnedExerciseId) && isPinLimitReached
                                        ? t("library.pinLimitReached", { max: maxPins })
                                        : pinnedSet.has(exercise.id as PinnedExerciseId)
                                            ? t("library.unpin")
                                            : t("library.pin")
                                }
                            >
                                <Star className={cn("h-3.5 w-3.5", pinnedSet.has(exercise.id as PinnedExerciseId) && "fill-current text-primary")} />
                            </button>
                            <ExerciseCard
                                title={exercise.title}
                                difficulty={exercise.difficulty}
                                mastery={exercise.mastery}
                                icon={Guitar}
                                variant="catalog"
                                isNew={exercise.isNew}
                                onClick={() => openTechnique(exercise.id, "train_technique_card")}
                            />
                        </div>
                    ))}
                </div>
            </SectionCollapse>

            <SectionCollapse
                title={t('library.theory')}
                summary={t("library.theorySummary", { count: 6 })}
                open={sectionsOpen.theory}
                onOpenChange={(nextOpen) => handleSectionOpenChange("theory", nextOpen)}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <ExerciseCard
                        title={t("theory.page.tools.scaleExplorer")}
                        difficulty="beginner"
                        mastery={0}
                        icon={Music2}
                        variant="catalog"
                        onClick={() => openTheory("scales", "train_theory_scales")}
                    />
                    <ExerciseCard
                        title={t("theory.page.tools.circleOfFifths")}
                        difficulty="intermediate"
                        mastery={0}
                        icon={Compass}
                        variant="catalog"
                        onClick={() => openTheory("circle", "train_theory_circle")}
                    />
                    <ExerciseCard
                        title={t("theory.page.tools.cagedSystem")}
                        difficulty="intermediate"
                        mastery={0}
                        icon={Guitar}
                        variant="catalog"
                        onClick={() => openTheory("caged", "train_theory_caged")}
                    />
                    <ExerciseCard
                        title={t("theory.page.tools.triads")}
                        difficulty="intermediate"
                        mastery={0}
                        icon={Guitar}
                        variant="catalog"
                        onClick={() => openTheory("triads", "train_theory_triads")}
                    />
                    <ExerciseCard
                        title={t("theory.page.tools.chordLibrary")}
                        difficulty="beginner"
                        mastery={0}
                        icon={Music2}
                        variant="catalog"
                        onClick={() => openTheory("chords", "train_theory_chords")}
                    />
                    <ExerciseCard
                        title={t("theory.page.tools.intervalTrainer")}
                        difficulty="intermediate"
                        mastery={0}
                        icon={Target}
                        variant="catalog"
                        onClick={() => openTheory("intervals", "train_theory_intervals")}
                    />
                </div>
            </SectionCollapse>

            <SectionCollapse
                title={t('library.ear')}
                summary={t("library.earSummary", { count: 4 })}
                open={sectionsOpen.ear}
                onOpenChange={(nextOpen) => handleSectionOpenChange("ear", nextOpen)}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <ExerciseCard
                        title={t("ear.page.modes.soundToFretboard")}
                        difficulty="beginner"
                        mastery={0}
                        icon={Ear}
                        variant="catalog"
                        onClick={() => openEarTraining("sound-to-fret", "train_ear_sound_to_fret")}
                    />
                    <ExerciseCard
                        title={t("ear.page.modes.intervalRecognition")}
                        difficulty="intermediate"
                        mastery={0}
                        icon={Ear}
                        variant="catalog"
                        onClick={() => openEarTraining("intervals", "train_ear_intervals")}
                    />
                    <ExerciseCard
                        title={t("ear.page.modes.chordQuality")}
                        difficulty="intermediate"
                        mastery={0}
                        icon={Ear}
                        variant="catalog"
                        onClick={() => openEarTraining("chord-quality", "train_ear_chord_quality")}
                    />
                    <ExerciseCard
                        title={t("ear.page.modes.functionalEar")}
                        difficulty="intermediate"
                        mastery={0}
                        icon={Ear}
                        variant="catalog"
                        onClick={() => openEarTraining("functional", "train_ear_functional")}
                    />
                </div>
            </SectionCollapse>

            <SectionCollapse
                title={t('library.rhythm')}
                summary={rhythmSummary}
                open={sectionsOpen.rhythm}
                onOpenChange={(nextOpen) => handleSectionOpenChange("rhythm", nextOpen)}
            >
                <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[390px]:gap-2.5 min-[412px]:gap-3 lg:grid-cols-3">
                    {rhythmCards.map((mode) => (
                        <div key={mode.id} className="relative">
                            <button
                                type="button"
                                className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => togglePinned(mode.id as PinnedExerciseId)}
                                disabled={!pinnedSet.has(mode.id as PinnedExerciseId) && isPinLimitReached}
                                aria-label={
                                    pinnedSet.has(mode.id as PinnedExerciseId)
                                        ? t("library.unpinAria", { title: mode.title })
                                        : t("library.pinAria", { title: mode.title })
                                }
                                title={
                                    !pinnedSet.has(mode.id as PinnedExerciseId) && isPinLimitReached
                                        ? t("library.pinLimitReached", { max: maxPins })
                                        : pinnedSet.has(mode.id as PinnedExerciseId)
                                            ? t("library.unpin")
                                            : t("library.pin")
                                }
                            >
                                <Star className={cn("h-3.5 w-3.5", pinnedSet.has(mode.id as PinnedExerciseId) && "fill-current text-primary")} />
                            </button>
                            <ExerciseCard
                                title={mode.title}
                                difficulty={mode.difficulty}
                                mastery={mode.mastery}
                                icon={Drum}
                                variant="catalog"
                                isNew={mode.isNew}
                                isLocked={false}
                                minLevel={mode.minLevel}
                                onClick={() => openRhythm(mode.id as RhythmModeId, "train_rhythm_card")}
                            />
                        </div>
                    ))}
                </div>
            </SectionCollapse>

            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{t('library.suggestedTitle')}</p>
                <p className="mt-1">{t('library.suggestedDesc1')}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Compass className="h-3.5 w-3.5" />
                    <span>{t('library.suggestedDesc2')}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{t('library.suggestedDesc3')}</span>
                </div>
            </div>
        </div>
    );
}

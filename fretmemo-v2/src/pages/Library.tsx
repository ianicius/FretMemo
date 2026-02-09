import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useProgressStore } from "@/stores/useProgressStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { usePinnedExercisesStore, type PinnedExerciseId } from "@/stores/usePinnedExercisesStore";
import { SectionCollapse } from "@/components/ui/section-collapse";
import { ExerciseCard } from "@/components/ui/exercise-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Compass, Ear, Guitar, Music2, Sparkles, Star, Target } from "lucide-react";

type TechniqueDifficulty = "beginner" | "intermediate" | "advanced";
type PracticeMode = "fretboardToNote" | "tabToNote" | "noteToTab" | "playNotes" | "playTab";
type TrainSectionKey = "pinned" | "drills" | "technique" | "theory" | "ear";
type TrainSectionsOpenState = Record<TrainSectionKey, boolean>;

type CatalogCard = {
    id: PracticeMode;
    title: string;
    difficulty: TechniqueDifficulty;
    priority: number;
    mastery: number;
    isNew: boolean;
    source: string;
};

interface TechniqueExerciseItem {
    id: string;
    title: string;
    difficulty: TechniqueDifficulty;
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
        title: "Note Names",
        difficulty: "beginner",
        priority: 2,
        source: "train-drills-play-note-names",
    },
    {
        id: "noteToTab",
        title: "Note → Tab",
        difficulty: "intermediate",
        priority: 3,
        source: "train-drills-note-to-tab",
    },
    {
        id: "tabToNote",
        title: "Tab → Note",
        difficulty: "intermediate",
        priority: 4,
        source: "train-drills-tab-to-note",
    },
    {
        id: "playTab",
        title: "Tab Sequence",
        difficulty: "advanced",
        priority: 5,
        source: "train-drills-play-tab-sequence",
    },
];

const TRAIN_UI_STATE_KEY = "fretmemo.train.ui";

const DEFAULT_SECTIONS_OPEN: TrainSectionsOpenState = {
    pinned: false,
    drills: true,
    technique: false,
    theory: false,
    ear: false,
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

export default function Library() {
    const navigate = useNavigate();
    const location = useLocation();
    const navigationType = useNavigationType();
    const techniqueSettings = useSettingsStore((state) => state.modules.technique);
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
            title: drill.title,
            difficulty: drill.difficulty,
            priority: drill.priority,
            source: drill.source,
            mastery: Math.max(0, overallAccuracy - index * 8),
            isNew: !hasSessionHistory,
        }));

        return sortCatalogCards(cards);
    }, [hasSessionHistory, overallAccuracy]);

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
                mastery,
                isNew: sessionCount === 0 && mastery === 0,
            };
        });

        return sortCatalogCards(cards);
    }, [techniqueSettings.bestBpm, techniqueSettings.sessionsCompleted]);

    const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
    const isPinLimitReached = pinnedIds.length >= maxPins;

    const pinnedCards = useMemo(() => {
        const drillById = new Map(drillCards.map((drill) => [drill.id as PinnedExerciseId, drill]));
        const techniqueById = new Map(techniqueCards.map((exercise) => [exercise.id as PinnedExerciseId, exercise]));

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

                return null;
            })
            .filter((card): card is NonNullable<typeof card> => Boolean(card));
    }, [drillCards, pinnedIds, techniqueCards]);

    const openPracticeSetup = (mode: PracticeMode, source: string) => {
        navigate("/practice", {
            state: {
                openPreFlight: true,
                source,
                mode,
            },
        });
    };

    return (
        <div className="space-y-5 pb-8">
            <div>
                <h1 className="type-display">Train</h1>
                <p className="mt-1 text-muted-foreground">
                    One catalog for fretboard drills, technique, theory, and ear training.
                </p>
            </div>

            <SectionCollapse
                title="Pinned"
                summary={`${pinnedCards.length}/${maxPins}`}
                open={sectionsOpen.pinned}
                onOpenChange={(nextOpen) => handleSectionOpenChange("pinned", nextOpen)}
            >
                {pinnedCards.length === 0 ? (
                    <EmptyState
                        title="No pinned exercises yet"
                        description="Pin your favorite drills with the star icon for quick access."
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[390px]:gap-2.5 min-[412px]:gap-3 lg:grid-cols-3">
                        {pinnedCards.map((card) => (
                            <div key={`pinned-${card.id}`} className="relative">
                                <button
                                    type="button"
                                    className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-sm transition hover:bg-primary/20"
                                    onClick={() => togglePinned(card.id)}
                                    aria-label={`Unpin ${card.title}`}
                                    title="Unpin"
                                >
                                    <Star className="h-3.5 w-3.5 fill-current" />
                                </button>
                                <ExerciseCard
                                    title={card.title}
                                    difficulty={card.difficulty}
                                    mastery={card.mastery}
                                    icon={card.kind === "drill" ? Target : Guitar}
                                    variant="catalog"
                                    isNew={card.isNew}
                                    onClick={() =>
                                        card.kind === "drill"
                                            ? openPracticeSetup(card.id as PracticeMode, card.source)
                                            : navigate(`/technique/${card.id}`, { state: { fromTrain: true } })
                                    }
                                />
                            </div>
                        ))}
                    </div>
                )}
            </SectionCollapse>

            <SectionCollapse
                title="Fretboard Drills"
                summary={`${drillCards.length} modes`}
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
                                aria-label={pinnedSet.has(drill.id as PinnedExerciseId) ? `Unpin ${drill.title}` : `Pin ${drill.title}`}
                                title={
                                    !pinnedSet.has(drill.id as PinnedExerciseId) && isPinLimitReached
                                        ? `Pin limit reached (${maxPins})`
                                        : pinnedSet.has(drill.id as PinnedExerciseId)
                                            ? "Unpin"
                                            : "Pin"
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
                                onClick={() => openPracticeSetup(drill.id as PracticeMode, drill.source)}
                            />
                        </div>
                    ))}
                </div>
            </SectionCollapse>

            <SectionCollapse
                title="Technique"
                summary={`${techniqueCards.length} exercises`}
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
                                aria-label={pinnedSet.has(exercise.id as PinnedExerciseId) ? `Unpin ${exercise.title}` : `Pin ${exercise.title}`}
                                title={
                                    !pinnedSet.has(exercise.id as PinnedExerciseId) && isPinLimitReached
                                        ? `Pin limit reached (${maxPins})`
                                        : pinnedSet.has(exercise.id as PinnedExerciseId)
                                            ? "Unpin"
                                            : "Pin"
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
                                onClick={() => navigate(`/technique/${exercise.id}`, { state: { fromTrain: true } })}
                            />
                        </div>
                    ))}
                </div>
            </SectionCollapse>

            <SectionCollapse
                title="Theory"
                summary="coming soon"
                open={sectionsOpen.theory}
                onOpenChange={(nextOpen) => handleSectionOpenChange("theory", nextOpen)}
            >
                <EmptyState
                    title="Theory Tools In Progress"
                    description="Scale explorer, chord maps, and fretboard theory visuals are on the roadmap."
                    icon={Music2}
                />
            </SectionCollapse>

            <SectionCollapse
                title="Ear Training"
                summary="coming soon"
                open={sectionsOpen.ear}
                onOpenChange={(nextOpen) => handleSectionOpenChange("ear", nextOpen)}
            >
                <EmptyState
                    title="Ear Training In Progress"
                    description="Interval and chord recognition modules will appear here as soon as they are ready."
                    icon={Ear}
                />
            </SectionCollapse>

            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Suggested next</p>
                <p className="mt-1">Continue with the mode that feels easiest today, then add one harder block.</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Compass className="h-3.5 w-3.5" />
                    <span>Use short, focused sessions for faster retention.</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Smart defaults are enabled in pre-session setup.</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Progress store for the Improv Training module (run improv-training-2026-11-13).
 *
 * zustand + persist, modeled on src/stores/useRhythmDojoStore.ts. One entry
 * per curriculum module: per-exercise run counters and the module completion
 * flag. Sequential unlocking lives in src/data/improv/curriculum.ts (pure
 * function over this state) — the store only persists the data.
 *
 * Run counters mean different things per engine (plan 1.1/1.3):
 * - quiz exercises: number of PASSED attempts (a run recording only when
 *   correct >= requiredCorrect); the exercise passes after 2 passed attempts
 *   (QUIZ_PASSED_ATTEMPTS) — one lucky run must not lock it in;
 * - drills: completed up+down runs; - backing loops: successful loops.
 *
 * Plan A2: loop passes also go to `verifiedRuns` (same run key) when the
 * microphone verified them; `exerciseRuns` keeps counting every pass, so the
 * completion rules are unchanged and the UI can flag unverified passes.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { calculateNextReview, type SpacedRepetitionEntry } from "@/lib/sm2";
import {
    CURRICULUM,
    getImprovModule,
    isModuleComplete,
    loopRunKey,
    type ImprovExercise,
} from "@/data/improv/curriculum";

export interface ImprovModuleProgress {
    /** Per-exercise counters (see the engine semantics in the header). */
    exerciseRuns: Record<string, number>;
    /** Mic-verified loop passes per run key (plan A2); absent = none. */
    verifiedRuns?: Record<string, number>;
    completed: boolean;
}

export interface ImprovStoreState {
    moduleState: Record<string, ImprovModuleProgress>;
    unlockAll: boolean;
    /** Entrance test (plan phase 6): modules with order ≤ this count are
     * unlocked regardless of the sequential gate; null = no test taken. */
    entranceUnlockCount: number | null;
    /** SM-2 entries per review generator (plan phase 6: review scheduling). */
    reviewSRS: Record<string, SpacedRepetitionEntry>;
    /** Plan F3: seconds played over backing loops, all modules together. */
    loopSeconds: number;
    addLoopSeconds: (seconds: number) => void;
    recordQuizResult: (moduleId: string, exerciseId: string, correct: number) => void;
    recordDrillRun: (moduleId: string, exerciseId: string) => void;
    /** `variantId` counts the pass for that variant (every variant must pass);
     * `verified` = the microphone confirmed the loop (plan A2). */
    recordLoopPass: (moduleId: string, exerciseId: string, variantId?: string, verified?: boolean) => void;
    /** practice-link: pass criteria live in useProgressStore; the component
     * calls this once they are all met (plan phase 2). */
    recordPracticePass: (moduleId: string, exerciseId: string) => void;
    /** Review session (plan phase 6): update the SM-2 entry for a generator
     * from the review run's quality (0-5). */
    updateReviewSR: (generatorId: string, quality: number) => void;
    setEntranceUnlockCount: (count: number | null) => void;
    resetModule: (moduleId: string) => void;
    resetProgress: () => void;
    setUnlockAll: (value: boolean) => void;
}

const STORAGE_KEY = "fretmemo-improv-v1";

export function emptyProgress(): ImprovModuleProgress {
    return { exerciseRuns: {}, verifiedRuns: {}, completed: false };
}

function createInitialModuleState(): Record<string, ImprovModuleProgress> {
    const state: Record<string, ImprovModuleProgress> = {};
    for (const module of CURRICULUM) {
        state[module.id] = emptyProgress();
    }
    return state;
}

function updateModule(
    previous: Record<string, ImprovModuleProgress>,
    moduleId: string,
    update: (progress: ImprovModuleProgress) => ImprovModuleProgress,
): Record<string, ImprovModuleProgress> {
    const module = getImprovModule(moduleId);
    if (!module) return previous;
    const current = previous[moduleId] ?? emptyProgress();
    const next = update({ ...current });
    // Single source of truth for the pass predicate (curriculum.ts).
    const completed = isModuleComplete(module, next);
    return {
        ...previous,
        [moduleId]: { ...next, completed },
    };
}

/**
 * Migration for pre-1.1 persisted state: the old shape kept a single
 * `quizBest` per module, which silently passed every quiz exercise of the
 * module. The value moves to the module's first quiz exercise as ONE passed
 * attempt when it met that exercise's threshold; otherwise it is dropped.
 */
function migrateLegacyModuleState(
    persisted: Record<string, Partial<ImprovModuleProgress> & { quizBest?: number; drillsDone?: string[]; loopPasses?: number }>,
): Record<string, ImprovModuleProgress> {
    const migrated: Record<string, ImprovModuleProgress> = createInitialModuleState();
    for (const [moduleId, legacy] of Object.entries(persisted)) {
        const exerciseRuns = { ...(legacy.exerciseRuns ?? {}) };
        const quizBest = typeof legacy.quizBest === "number" ? legacy.quizBest : 0;
        if (quizBest > 0) {
            const firstQuizExercise = getImprovModule(moduleId)?.exercises.find(
                (exercise: ImprovExercise) => exercise.engine === "choice-quiz",
            );
            if (firstQuizExercise && (exerciseRuns[firstQuizExercise.id] ?? 0) === 0) {
                const params = firstQuizExercise.params as { requiredCorrect: number };
                if (quizBest >= params.requiredCorrect) {
                    exerciseRuns[firstQuizExercise.id] = 1;
                }
            }
        }
        // Pre-A2 state has no verifiedRuns: earlier passes count as unverified.
        migrated[moduleId] = { exerciseRuns, verifiedRuns: { ...(legacy.verifiedRuns ?? {}) }, completed: Boolean(legacy.completed) };
    }
    return migrated;
}

export const useImprovStore = create<ImprovStoreState>()(
    persist(
        (set) => ({
            moduleState: createInitialModuleState(),
            unlockAll: false,
            entranceUnlockCount: null,
            reviewSRS: {},
            loopSeconds: 0,
            addLoopSeconds: (seconds) => {
                if (!(seconds > 0)) return;
                set((state) => ({ loopSeconds: state.loopSeconds + Math.round(seconds) }));
            },
            recordQuizResult: (moduleId, exerciseId, correct) => {
                set((state) => ({
                    moduleState: updateModule(state.moduleState, moduleId, (progress) => {
                        const exercise = getImprovModule(moduleId)?.exercises.find((item) => item.id === exerciseId);
                        if (!exercise) return progress;
                        const params = exercise.params as { requiredCorrect: number };
                        if (Math.max(0, Math.round(correct)) < params.requiredCorrect) return progress;
                        return {
                            ...progress,
                            exerciseRuns: {
                                ...progress.exerciseRuns,
                                [exerciseId]: (progress.exerciseRuns[exerciseId] ?? 0) + 1,
                            },
                        };
                    }),
                }));
            },
            recordDrillRun: (moduleId, exerciseId) => {
                set((state) => ({
                    moduleState: updateModule(state.moduleState, moduleId, (progress) => ({
                        ...progress,
                        exerciseRuns: {
                            ...progress.exerciseRuns,
                            [exerciseId]: (progress.exerciseRuns[exerciseId] ?? 0) + 1,
                        },
                    })),
                }));
            },
            recordLoopPass: (moduleId, exerciseId, variantId, verified = false) => {
                const runKey = loopRunKey(exerciseId, variantId);
                set((state) => ({
                    moduleState: updateModule(state.moduleState, moduleId, (progress) => {
                        const verifiedRuns = progress.verifiedRuns ?? {};
                        return {
                            ...progress,
                            exerciseRuns: {
                                ...progress.exerciseRuns,
                                [runKey]: (progress.exerciseRuns[runKey] ?? 0) + 1,
                            },
                            verifiedRuns: verified
                                ? { ...verifiedRuns, [runKey]: (verifiedRuns[runKey] ?? 0) + 1 }
                                : verifiedRuns,
                        };
                    }),
                }));
            },
            recordPracticePass: (moduleId, exerciseId) => {
                set((state) => ({
                    moduleState: updateModule(state.moduleState, moduleId, (progress) => ({
                        ...progress,
                        exerciseRuns: {
                            ...progress.exerciseRuns,
                            [exerciseId]: Math.max(progress.exerciseRuns[exerciseId] ?? 0, 1),
                        },
                    })),
                }));
            },
            updateReviewSR: (generatorId, quality) => {
                set((state) => {
                    const previous = state.reviewSRS[generatorId] ?? null;
                    // SM-2 quality scale: 5 = correct, 2 = failed after seeing
                    // the answer (mapped from the review run per question).
                    const next = calculateNextReview(quality, previous);
                    return { reviewSRS: { ...state.reviewSRS, [generatorId]: next } };
                });
            },
            setEntranceUnlockCount: (count) => {
                set({ entranceUnlockCount: count });
            },
            resetModule: (moduleId) => {
                set((state) => ({
                    moduleState: {
                        ...state.moduleState,
                        [moduleId]: emptyProgress(),
                    },
                }));
            },
            resetProgress: () => {
                set({ moduleState: createInitialModuleState() });
            },
            setUnlockAll: (value) => {
                set({ unlockAll: Boolean(value) });
            },
        }),
        {
            name: STORAGE_KEY,
            partialize: (state) => ({
                moduleState: state.moduleState,
                unlockAll: state.unlockAll,
                entranceUnlockCount: state.entranceUnlockCount,
                reviewSRS: state.reviewSRS,
                loopSeconds: state.loopSeconds,
            }),
            merge: (persistedState, currentState) => {
                const persisted = persistedState as
                    | { moduleState?: Record<string, Partial<ImprovModuleProgress> & { quizBest?: number; drillsDone?: string[]; loopPasses?: number }>; unlockAll?: boolean }
                    | undefined;
                return {
                    ...currentState,
                    ...persisted,
                    moduleState: migrateLegacyModuleState(persisted?.moduleState ?? {}),
                };
            },
        },
    ),
);

/** Selector helper: progress of one module (never undefined). */
export function selectModuleProgress(state: ImprovStoreState, moduleId: string): ImprovModuleProgress {
    return state.moduleState[moduleId] ?? emptyProgress();
}

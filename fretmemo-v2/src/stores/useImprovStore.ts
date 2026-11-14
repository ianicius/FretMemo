/**
 * Progress store for the Improv Training module (run improv-training-2026-11-13).
 *
 * zustand + persist, modeled on src/stores/useRhythmDojoStore.ts. One entry
 * per curriculum module: best quiz score, completed drill/loop exercises,
 * per-exercise run counters and the module completion flag. Sequential
 * unlocking lives in src/data/improv/curriculum.ts (pure function over this
 * state) — the store only persists the data.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
    CURRICULUM,
    getImprovModule,
    isModuleComplete,
} from "@/data/improv/curriculum";

export interface ImprovModuleProgress {
    /** Best correct-answer count from a single quiz run (any quiz exercise). */
    quizBest: number;
    /** Exercise ids whose pass threshold (drill runs / loop passes) is met. */
    drillsDone: string[];
    /** Total successful backing-loop passes ever recorded for the module. */
    loopPasses: number;
    /** Per-exercise counters: drill runs (E3) / loop passes (E4). */
    exerciseRuns: Record<string, number>;
    completed: boolean;
}

export interface ImprovStoreState {
    moduleState: Record<string, ImprovModuleProgress>;
    unlockAll: boolean;
    recordQuizResult: (moduleId: string, exerciseId: string, correct: number) => void;
    recordDrillRun: (moduleId: string, exerciseId: string) => void;
    recordLoopPass: (moduleId: string, exerciseId: string) => void;
    resetModule: (moduleId: string) => void;
    resetProgress: () => void;
    setUnlockAll: (value: boolean) => void;
}

const STORAGE_KEY = "fretmemo-improv-v1";

export function emptyProgress(): ImprovModuleProgress {
    return { quizBest: 0, drillsDone: [], loopPasses: 0, exerciseRuns: {}, completed: false };
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

export const useImprovStore = create<ImprovStoreState>()(
    persist(
        (set) => ({
            moduleState: createInitialModuleState(),
            unlockAll: false,
            recordQuizResult: (moduleId, exerciseId, correct) => {
                void exerciseId;
                set((state) => ({
                    moduleState: updateModule(state.moduleState, moduleId, (progress) => ({
                        ...progress,
                        quizBest: Math.max(progress.quizBest, Math.max(0, Math.round(correct))),
                    })),
                }));
            },
            recordDrillRun: (moduleId, exerciseId) => {
                set((state) => ({
                    moduleState: updateModule(state.moduleState, moduleId, (progress) => {
                        const runs = (progress.exerciseRuns[exerciseId] ?? 0) + 1;
                        const exerciseRuns = { ...progress.exerciseRuns, [exerciseId]: runs };
                        const module = getImprovModule(moduleId);
                        const exercise = module?.exercises.find((item) => item.id === exerciseId);
                        const required = exercise && exercise.engine === "diagram-drill"
                            ? (exercise.params as { requiredRuns: number }).requiredRuns
                            : 0;
                        const drillsDone = runs >= required && !progress.drillsDone.includes(exerciseId)
                            ? [...progress.drillsDone, exerciseId]
                            : progress.drillsDone;
                        return { ...progress, exerciseRuns, drillsDone };
                    }),
                }));
            },
            recordLoopPass: (moduleId, exerciseId) => {
                set((state) => ({
                    moduleState: updateModule(state.moduleState, moduleId, (progress) => {
                        const passes = (progress.exerciseRuns[exerciseId] ?? 0) + 1;
                        const exerciseRuns = { ...progress.exerciseRuns, [exerciseId]: passes };
                        const module = getImprovModule(moduleId);
                        const exercise = module?.exercises.find((item) => item.id === exerciseId);
                        const required = exercise && exercise.engine === "backing-improv"
                            ? (exercise.params as { requiredPasses: number }).requiredPasses
                            : 0;
                        const drillsDone = passes >= required && !progress.drillsDone.includes(exerciseId)
                            ? [...progress.drillsDone, exerciseId]
                            : progress.drillsDone;
                        return { ...progress, exerciseRuns, drillsDone, loopPasses: progress.loopPasses + 1 };
                    }),
                }));
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
            }),
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<ImprovStoreState> | undefined;
                return {
                    ...currentState,
                    ...persisted,
                    moduleState: {
                        ...createInitialModuleState(),
                        ...(persisted?.moduleState ?? {}),
                    },
                };
            },
        },
    ),
);

/** Selector helper: progress of one module (never undefined). */
export function selectModuleProgress(state: ImprovStoreState, moduleId: string): ImprovModuleProgress {
    return state.moduleState[moduleId] ?? emptyProgress();
}

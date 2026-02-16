import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RhythmModeId = "tap-beat" | "strum-patterns" | "rhythm-reading" | "groove-lab";

export interface RhythmModeStats {
    sessions: number;
    totalExpected: number;
    hits: number;
    misses: number;
    extras: number;
    totalOffsetMs: number;
    averageOffsetMs: number;
    bestScore: number;
    lastPracticed: string | null;
}

interface RhythmDojoStoreState {
    modeStats: Record<RhythmModeId, RhythmModeStats>;
    inputLatencyMs: number;
    recordRhythmSession: (payload: {
        mode: RhythmModeId;
        totalExpected: number;
        hits: number;
        misses: number;
        extras: number;
        avgOffsetMs: number;
        score: number;
    }) => void;
    setInputLatencyMs: (latencyMs: number) => void;
    getModeMastery: (mode: RhythmModeId) => number;
}

const DEFAULT_STATS: RhythmModeStats = {
    sessions: 0,
    totalExpected: 0,
    hits: 0,
    misses: 0,
    extras: 0,
    totalOffsetMs: 0,
    averageOffsetMs: 0,
    bestScore: 0,
    lastPracticed: null,
};

function createInitialModeStats(): Record<RhythmModeId, RhythmModeStats> {
    return {
        "tap-beat": { ...DEFAULT_STATS },
        "strum-patterns": { ...DEFAULT_STATS },
        "rhythm-reading": { ...DEFAULT_STATS },
        "groove-lab": { ...DEFAULT_STATS },
    };
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function clampInputLatency(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(250, Math.round(value)));
}

export const useRhythmDojoStore = create<RhythmDojoStoreState>()(
    persist(
        (set, get) => ({
            modeStats: createInitialModeStats(),
            inputLatencyMs: 0,
            recordRhythmSession: ({ mode, totalExpected, hits, misses, extras, avgOffsetMs, score }) => {
                set((state) => {
                    const previous = state.modeStats[mode] ?? { ...DEFAULT_STATS };
                    const nextSessions = previous.sessions + 1;
                    const nextTotalExpected = previous.totalExpected + Math.max(0, totalExpected);
                    const nextHits = previous.hits + Math.max(0, hits);
                    const nextMisses = previous.misses + Math.max(0, misses);
                    const nextExtras = previous.extras + Math.max(0, extras);
                    const nextTotalOffsetMs = previous.totalOffsetMs + Math.max(0, avgOffsetMs);
                    const nextAverageOffsetMs = nextSessions > 0
                        ? Math.round(nextTotalOffsetMs / nextSessions)
                        : 0;

                    return {
                        modeStats: {
                            ...state.modeStats,
                            [mode]: {
                                sessions: nextSessions,
                                totalExpected: nextTotalExpected,
                                hits: nextHits,
                                misses: nextMisses,
                                extras: nextExtras,
                                totalOffsetMs: nextTotalOffsetMs,
                                averageOffsetMs: nextAverageOffsetMs,
                                bestScore: Math.max(previous.bestScore, Math.max(0, Math.round(score))),
                                lastPracticed: new Date().toISOString(),
                            },
                        },
                    };
                });
            },
            setInputLatencyMs: (latencyMs) => {
                set({ inputLatencyMs: clampInputLatency(latencyMs) });
            },
            getModeMastery: (mode) => {
                const stats = get().modeStats[mode];
                if (!stats || stats.sessions === 0 || stats.totalExpected <= 0) return 0;

                const accuracy = clamp(stats.hits / Math.max(1, stats.totalExpected), 0, 1);
                const timing = clamp(1 - stats.averageOffsetMs / 120, 0, 1);
                return Math.round((accuracy * 0.75 + timing * 0.25) * 100);
            },
        }),
        {
            name: "fretmemo-rhythm-dojo-v1",
            partialize: (state) => ({
                modeStats: state.modeStats,
                inputLatencyMs: state.inputLatencyMs,
            }),
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<RhythmDojoStoreState> | undefined;
                const persistedLatency = persisted?.inputLatencyMs ?? currentState.inputLatencyMs;
                return {
                    ...currentState,
                    ...persisted,
                    modeStats: {
                        ...createInitialModeStats(),
                        ...(persisted?.modeStats ?? {}),
                    },
                    inputLatencyMs: clampInputLatency(persistedLatency),
                };
            },
        },
    ),
);

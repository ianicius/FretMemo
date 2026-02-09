import { create } from 'zustand';
import type { TabId, ExerciseType, SessionStats } from '../types';


interface AppState {
    currentTab: TabId;
    activeExercise: ExerciseType | null;
    isFocusMode: boolean;
    sessionStats: SessionStats;

    // Actions
    setTab: (tab: TabId) => void;
    startExercise: (exercise: ExerciseType) => void;
    endExercise: () => void;
    toggleFocusMode: (isActive: boolean) => void;
    updateSessionStats: (stats: Partial<SessionStats>) => void;
    resetSession: () => void;
}

const DEFAULT_SESSION: SessionStats = {
    startTime: 0,
    totalNotes: 0,
    correctNotes: 0,
    xpEarned: 0,
    streakGained: 0,
};

export const useAppStore = create<AppState>((set) => ({
    currentTab: 'home',
    activeExercise: null,
    isFocusMode: false,
    sessionStats: DEFAULT_SESSION,

    setTab: (tab) => set({ currentTab: tab }),

    startExercise: (exercise) => set({
        activeExercise: exercise,
        isFocusMode: true,
        sessionStats: { ...DEFAULT_SESSION, startTime: Date.now() }
    }),

    endExercise: () => set({
        activeExercise: null,
        isFocusMode: false
    }),

    toggleFocusMode: (isActive) => set({ isFocusMode: isActive }),

    updateSessionStats: (stats) => set((state) => ({
        sessionStats: { ...state.sessionStats, ...stats }
    })),

    resetSession: () => set({ sessionStats: DEFAULT_SESSION }),
}));


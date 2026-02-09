import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Position } from '@/types/fretboard';
import { getNoteAt, STANDARD_TUNING } from '@/lib/constants';
import { useSettingsStore } from './useSettingsStore';
import { normalizeTuning } from '@/lib/tuning';

export interface PositionStats {
    correct: number;
    total: number;
    lastPracticed: string | null;
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    unlockedAt: string | null;
    icon: string;
}

export interface SessionRecord {
    id: string;
    startedAt: string;
    endedAt: string;
    correct: number;
    incorrect: number;
    durationSeconds: number;
    accuracy: number;
}

type ImportMode = 'merge' | 'replace';

interface NormalizedProgressData {
    positionStats: Record<string, PositionStats>;
    heatMapEnabled: boolean;
    totalPracticeTime: number;
    streakDays: number;
    streakFreezes: number;
    lastFreezeDate: string | null;
    lastPracticeDate: string | null;
    totalCorrect: number;
    totalIncorrect: number;
    sessionHistory: SessionRecord[];
    achievements: Achievement[];
}

export interface ProgressImportResult {
    success: boolean;
    message: string;
}

interface ProgressState {
    // Heat Map Data
    positionStats: Record<string, PositionStats>; // key: "string-fret"
    heatMapEnabled: boolean;

    // Session Stats
    totalPracticeTime: number; // in minutes
    streakDays: number;
    streakFreezes: number;
    lastFreezeDate: string | null;
    lastPracticeDate: string | null;
    totalCorrect: number;
    totalIncorrect: number;
    sessionHistory: SessionRecord[];

    // Achievements
    achievements: Achievement[];

    // Actions
    recordAnswer: (position: Position, isCorrect: boolean) => void;
    toggleHeatMap: () => void;
    getPositionAccuracy: (stringIndex: number, fret: number) => number | null;
    getHeatMapClass: (accuracy: number | null) => string;
    updatePracticeTime: (minutes: number) => void;
    checkAndUpdateStreak: () => void;
    resetHeatMap: () => void;
    unlockAchievement: (id: string) => void;
    getAccuracyForFretboard: () => { position: Position; accuracy: number | null }[];
    recordSession: (session: {
        startedAt: number | null;
        correct: number;
        incorrect: number;
        durationSeconds: number;
    }) => void;
    importProgressData: (payload: unknown, mode?: ImportMode) => ProgressImportResult;
    resetProgressData: () => void;
}

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
    { id: 'first_note', name: 'First Steps', description: 'Correctly identify your first note', unlockedAt: null, icon: '🎯' },
    { id: 'streak_7', name: 'Week Warrior', description: 'Practice for 7 days in a row', unlockedAt: null, icon: '🔥' },
    { id: 'streak_30', name: 'Monthly Master', description: 'Practice for 30 days in a row', unlockedAt: null, icon: '📅' },
    { id: 'perfect_session', name: 'Perfect Session', description: 'Get 20 correct answers in a row', unlockedAt: null, icon: '✨' },
    { id: 'speed_demon', name: 'Speed Demon', description: 'Practice at 120 BPM or higher', unlockedAt: null, icon: '⚡' },
    { id: 'explorer', name: 'Fretboard Explorer', description: 'Practice on all 6 strings', unlockedAt: null, icon: '🎸' },
];

type ProgressSnapshot = Pick<
    ProgressState,
    | 'positionStats'
    | 'heatMapEnabled'
    | 'totalPracticeTime'
    | 'streakDays'
    | 'streakFreezes'
    | 'lastFreezeDate'
    | 'lastPracticeDate'
    | 'totalCorrect'
    | 'totalIncorrect'
    | 'sessionHistory'
    | 'achievements'
>;

function createDefaultAchievements(): Achievement[] {
    return DEFAULT_ACHIEVEMENTS.map((achievement) => ({ ...achievement }));
}

function createInitialProgressSnapshot(): ProgressSnapshot {
    return {
        positionStats: {},
        heatMapEnabled: false,
        totalPracticeTime: 0,
        streakDays: 0,
        streakFreezes: 1,
        lastFreezeDate: null,
        lastPracticeDate: null,
        totalCorrect: 0,
        totalIncorrect: 0,
        sessionHistory: [],
        achievements: createDefaultAchievements(),
    };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.max(0, Math.round(value));
}

function toIsoOrNull(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return null;
    return new Date(parsed).toISOString();
}

function pickLatestIso(a: string | null, b: string | null): string | null {
    if (!a) return b;
    if (!b) return a;
    return Date.parse(a) >= Date.parse(b) ? a : b;
}

function normalizePositionStats(raw: unknown): Record<string, PositionStats> {
    const source = asRecord(raw);
    if (!source) return {};

    const normalized: Record<string, PositionStats> = {};
    for (const [key, value] of Object.entries(source)) {
        if (!/^\d+-\d+$/.test(key)) continue;
        const item = asRecord(value);
        if (!item) continue;

        const correct = toNonNegativeInt(item.correct);
        const total = Math.max(toNonNegativeInt(item.total), correct);
        normalized[key] = {
            correct: Math.min(correct, total),
            total,
            lastPracticed: toIsoOrNull(item.lastPracticed),
        };
    }

    return normalized;
}

function normalizeSessionHistory(raw: unknown): SessionRecord[] {
    if (!Array.isArray(raw)) return [];

    const nowIso = new Date().toISOString();
    const normalized: SessionRecord[] = [];

    for (let index = 0; index < raw.length; index += 1) {
        const item = asRecord(raw[index]);
        if (!item) continue;

        const correct = toNonNegativeInt(item.correct);
        const incorrect = toNonNegativeInt(item.incorrect);
        const total = correct + incorrect;
        if (total <= 0) continue;

        const startedAt = toIsoOrNull(item.startedAt) ?? nowIso;
        const endedAt = toIsoOrNull(item.endedAt) ?? startedAt;
        const accuracyRaw =
            typeof item.accuracy === 'number' && Number.isFinite(item.accuracy)
                ? Math.round(item.accuracy)
                : Math.round((correct / total) * 100);

        normalized.push({
            id: typeof item.id === 'string' && item.id.trim()
                ? item.id
                : `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
            startedAt,
            endedAt,
            correct,
            incorrect,
            durationSeconds: toNonNegativeInt(item.durationSeconds),
            accuracy: Math.max(0, Math.min(100, accuracyRaw)),
        });
    }

    normalized.sort((a, b) => a.endedAt.localeCompare(b.endedAt));
    return normalized.slice(-200);
}

function normalizeAchievements(raw: unknown): Achievement[] {
    const map = new Map<string, Achievement>(
        DEFAULT_ACHIEVEMENTS.map((achievement) => [achievement.id, { ...achievement }])
    );

    if (Array.isArray(raw)) {
        for (const entry of raw) {
            const item = asRecord(entry);
            if (!item) continue;

            const id = typeof item.id === 'string' && item.id.trim() ? item.id : null;
            if (!id) continue;

            const previous = map.get(id);
            map.set(id, {
                id,
                name:
                    typeof item.name === 'string' && item.name.trim()
                        ? item.name
                        : (previous?.name ?? id),
                description:
                    typeof item.description === 'string'
                        ? item.description
                        : (previous?.description ?? ''),
                unlockedAt: toIsoOrNull(item.unlockedAt),
                icon:
                    typeof item.icon === 'string' && item.icon.trim()
                        ? item.icon
                        : (previous?.icon ?? '🏆'),
            });
        }
    }

    return Array.from(map.values());
}

function extractProgressSection(payload: unknown): Record<string, unknown> | null {
    const root = asRecord(payload);
    if (!root) return null;

    const nestedProgress = asRecord(root.progress);
    if (nestedProgress) return nestedProgress;

    const nestedState = asRecord(root.state);
    if (nestedState) return nestedState;

    return root;
}

function normalizeImportedProgress(payload: unknown): NormalizedProgressData | null {
    const source = extractProgressSection(payload);
    if (!source) return null;

    return {
        positionStats: normalizePositionStats(source.positionStats),
        heatMapEnabled: Boolean(source.heatMapEnabled),
        totalPracticeTime: toNonNegativeInt(source.totalPracticeTime),
        streakDays: toNonNegativeInt(source.streakDays),
        streakFreezes: toNonNegativeInt(source.streakFreezes, 1),
        lastFreezeDate: toIsoOrNull(source.lastFreezeDate),
        lastPracticeDate: toIsoOrNull(source.lastPracticeDate),
        totalCorrect: toNonNegativeInt(source.totalCorrect),
        totalIncorrect: toNonNegativeInt(source.totalIncorrect),
        sessionHistory: normalizeSessionHistory(source.sessionHistory),
        achievements: normalizeAchievements(source.achievements),
    };
}

function mergePositionStats(
    current: Record<string, PositionStats>,
    incoming: Record<string, PositionStats>
): Record<string, PositionStats> {
    const merged: Record<string, PositionStats> = { ...current };

    for (const [key, nextValue] of Object.entries(incoming)) {
        const prevValue = merged[key];
        if (!prevValue) {
            merged[key] = nextValue;
            continue;
        }

        merged[key] = {
            correct: prevValue.correct + nextValue.correct,
            total: prevValue.total + nextValue.total,
            lastPracticed: pickLatestIso(prevValue.lastPracticed, nextValue.lastPracticed),
        };
    }

    return merged;
}

function mergeSessionHistory(current: SessionRecord[], incoming: SessionRecord[]): SessionRecord[] {
    const byId = new Map<string, SessionRecord>();

    for (const session of [...current, ...incoming]) {
        const existing = byId.get(session.id);
        if (!existing || session.endedAt > existing.endedAt) {
            byId.set(session.id, session);
        }
    }

    return Array.from(byId.values())
        .sort((a, b) => a.endedAt.localeCompare(b.endedAt))
        .slice(-200);
}

function mergeAchievements(current: Achievement[], incoming: Achievement[]): Achievement[] {
    const merged = new Map<string, Achievement>(current.map((achievement) => [achievement.id, achievement]));

    for (const nextAchievement of incoming) {
        const existing = merged.get(nextAchievement.id);
        if (!existing) {
            merged.set(nextAchievement.id, nextAchievement);
            continue;
        }

        const unlockedAt = (() => {
            if (!existing.unlockedAt) return nextAchievement.unlockedAt;
            if (!nextAchievement.unlockedAt) return existing.unlockedAt;
            return Date.parse(existing.unlockedAt) <= Date.parse(nextAchievement.unlockedAt)
                ? existing.unlockedAt
                : nextAchievement.unlockedAt;
        })();

        merged.set(nextAchievement.id, {
            ...existing,
            name: nextAchievement.name || existing.name,
            description: nextAchievement.description || existing.description,
            icon: nextAchievement.icon || existing.icon,
            unlockedAt,
        });
    }

    return Array.from(merged.values());
}

export const useProgressStore = create<ProgressState>()(
    persist(
        (set, get) => ({
            ...createInitialProgressSnapshot(),

            recordAnswer: (position: Position, isCorrect: boolean) => {
                const key = `${position.stringIndex}-${position.fret}`;
                const current = get().positionStats[key] || { correct: 0, total: 0, lastPracticed: null };

                set((state) => ({
                    positionStats: {
                        ...state.positionStats,
                        [key]: {
                            correct: current.correct + (isCorrect ? 1 : 0),
                            total: current.total + 1,
                            lastPracticed: new Date().toISOString()
                        }
                    },
                    totalCorrect: state.totalCorrect + (isCorrect ? 1 : 0),
                    totalIncorrect: state.totalIncorrect + (isCorrect ? 0 : 1),
                }));

                // Check for achievements
                const newTotal = get().totalCorrect + (isCorrect ? 1 : 0);
                if (newTotal === 1) {
                    get().unlockAchievement('first_note');
                }
            },

            toggleHeatMap: () => {
                set((state) => ({ heatMapEnabled: !state.heatMapEnabled }));
            },

            getPositionAccuracy: (stringIndex: number, fret: number): number | null => {
                const key = `${stringIndex}-${fret}`;
                const stats = get().positionStats[key];
                if (!stats || stats.total === 0) return null;
                return stats.correct / stats.total;
            },

            getHeatMapClass: (accuracy: number | null): string => {
                if (accuracy === null) return '';
                if (accuracy >= 0.85) return 'heatmap-mastered';
                if (accuracy >= 0.60) return 'heatmap-learning';
                return 'heatmap-focus';
            },

            getAccuracyForFretboard: () => {
                const { positionStats } = get();
                const result: { position: Position; accuracy: number | null }[] = [];
                const tuning = normalizeTuning(useSettingsStore.getState().quick.tuning);

                // Generate all positions
                for (let string = 0; string < tuning.length; string++) {
                    for (let fret = 1; fret <= 12; fret++) {
                        const key = `${string}-${fret}`;
                        const stats = positionStats[key];
                        const accuracy = stats && stats.total > 0 ? stats.correct / stats.total : null;
                        const openNote = tuning[string] ?? STANDARD_TUNING[string];
                        const note = getNoteAt(openNote, fret);
                        result.push({
                            position: { stringIndex: string, fret, note },
                            accuracy
                        });
                    }
                }
                return result;
            },

            updatePracticeTime: (minutes: number) => {
                set((state) => ({
                    totalPracticeTime: state.totalPracticeTime + minutes
                }));
            },

            checkAndUpdateStreak: () => {
                // Use local date (YYYY-MM-DD) to avoid UTC timezone issues
                const today = new Date().toLocaleDateString('en-CA');
                const { lastPracticeDate, streakDays, streakFreezes, lastFreezeDate } = get();

                if (lastPracticeDate === today) return;
                let newStreak = 1;
                let newFreezes = streakFreezes;
                let freezeConsumed = false;

                if (lastPracticeDate) {
                    // Parse as local date, not UTC
                    const lastDay = lastPracticeDate.split('T')[0];
                    const lastDate = new Date(lastDay + 'T00:00:00');
                    const todayDate = new Date(today + 'T00:00:00');
                    const daysGap = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

                    if (daysGap <= 1) {
                        newStreak = streakDays + 1;
                    } else if (daysGap === 2 && streakFreezes > 0) {
                        newStreak = streakDays + 1;
                        newFreezes = streakFreezes - 1;
                        freezeConsumed = true;
                    }
                }

                // Check achievements
                if (newStreak === 7) {
                    get().unlockAchievement('streak_7');
                } else if (newStreak === 30) {
                    get().unlockAchievement('streak_30');
                }

                if (newStreak > 0 && newStreak % 7 === 0 && newStreak !== streakDays) {
                    newFreezes += 1;
                }

                set({
                    streakDays: newStreak,
                    streakFreezes: newFreezes,
                    lastFreezeDate: freezeConsumed ? today : lastFreezeDate,
                    lastPracticeDate: today
                });
            },

            resetHeatMap: () => {
                set({ positionStats: {} });
            },

            unlockAchievement: (id: string) => {
                set((state) => ({
                    achievements: state.achievements.map(a =>
                        a.id === id && !a.unlockedAt
                            ? { ...a, unlockedAt: new Date().toISOString() }
                            : a
                    )
                }));
            },

            recordSession: ({ startedAt, correct, incorrect, durationSeconds }) => {
                const totalAnswers = correct + incorrect;
                if (totalAnswers <= 0) return;

                const now = new Date().toISOString();
                const started = startedAt ? new Date(startedAt).toISOString() : now;
                const accuracy = Math.round((correct / totalAnswers) * 100);

                const session: SessionRecord = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    startedAt: started,
                    endedAt: now,
                    correct,
                    incorrect,
                    durationSeconds: Math.max(0, Math.round(durationSeconds)),
                    accuracy,
                };

                // Keep a bounded history for local storage size.
                set((state) => ({
                    sessionHistory: [...state.sessionHistory.slice(-199), session],
                }));
            },

            importProgressData: (payload, mode = 'merge') => {
                const normalized = normalizeImportedProgress(payload);
                if (!normalized) {
                    return {
                        success: false,
                        message: 'Invalid progress file format.',
                    };
                }

                if (mode === 'replace') {
                    set({
                        positionStats: normalized.positionStats,
                        heatMapEnabled: normalized.heatMapEnabled,
                        totalPracticeTime: normalized.totalPracticeTime,
                        streakDays: normalized.streakDays,
                        streakFreezes: normalized.streakFreezes,
                        lastFreezeDate: normalized.lastFreezeDate,
                        lastPracticeDate: normalized.lastPracticeDate,
                        totalCorrect: normalized.totalCorrect,
                        totalIncorrect: normalized.totalIncorrect,
                        sessionHistory: normalized.sessionHistory,
                        achievements: normalized.achievements,
                    });

                    return {
                        success: true,
                        message: 'Progress data imported successfully (replace mode).',
                    };
                }

                set((state) => ({
                    positionStats: mergePositionStats(state.positionStats, normalized.positionStats),
                    heatMapEnabled: state.heatMapEnabled || normalized.heatMapEnabled,
                    totalPracticeTime: state.totalPracticeTime + normalized.totalPracticeTime,
                    streakDays: Math.max(state.streakDays, normalized.streakDays),
                    streakFreezes: Math.max(state.streakFreezes, normalized.streakFreezes),
                    lastFreezeDate: pickLatestIso(state.lastFreezeDate, normalized.lastFreezeDate),
                    lastPracticeDate: pickLatestIso(state.lastPracticeDate, normalized.lastPracticeDate),
                    totalCorrect: state.totalCorrect + normalized.totalCorrect,
                    totalIncorrect: state.totalIncorrect + normalized.totalIncorrect,
                    sessionHistory: mergeSessionHistory(state.sessionHistory, normalized.sessionHistory),
                    achievements: mergeAchievements(state.achievements, normalized.achievements),
                }));

                return {
                    success: true,
                    message: 'Progress data imported successfully (merge mode).',
                };
            },

            resetProgressData: () => {
                set(createInitialProgressSnapshot());
            },
        }),
        {
            name: 'fretmemo-progress',
            partialize: (state) => ({
                positionStats: state.positionStats,
                heatMapEnabled: state.heatMapEnabled,
                totalPracticeTime: state.totalPracticeTime,
                streakDays: state.streakDays,
                streakFreezes: state.streakFreezes,
                lastFreezeDate: state.lastFreezeDate,
                lastPracticeDate: state.lastPracticeDate,
                totalCorrect: state.totalCorrect,
                totalIncorrect: state.totalIncorrect,
                sessionHistory: state.sessionHistory,
                achievements: state.achievements,
            }),
        }
    )
);

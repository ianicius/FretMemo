import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, QuickSettings, FullSettings, ModuleSettings, NoteNotationPreference } from '../types/settings';
import { STANDARD_TUNING } from '@/lib/constants';
import { getDefaultTuningForInstrument, inferInstrumentTypeFromTuning, normalizeInstrumentType, normalizeTuning } from '@/lib/tuning';


interface SettingsState extends AppSettings {
    // Actions
    updateQuickSettings: (settings: Partial<QuickSettings>) => void;
    updateFullSettings: (settings: Partial<FullSettings>) => void;
    updateModuleSettings: <M extends keyof ModuleSettings>(module: M, settings: Partial<ModuleSettings[M]>) => void;
    resetModuleSettings: <M extends keyof ModuleSettings>(module: M) => void;
    resetSettings: () => void;
}

const DEFAULT_MODULE_SETTINGS: ModuleSettings = {
    earTraining: {
        intervals: ['P1', 'P5', 'P8'],
        direction: 'ascending',
    },
    technique: {
        startingBpm: {},
        bestBpm: {},
        sessionsCompleted: {},
        lastPracticedAt: {},
    },
};

function cloneDefaultModules(): ModuleSettings {
    return {
        earTraining: {
            intervals: [...DEFAULT_MODULE_SETTINGS.earTraining.intervals],
            direction: DEFAULT_MODULE_SETTINGS.earTraining.direction,
        },
        technique: {
            startingBpm: {},
            bestBpm: {},
            sessionsCompleted: {},
            lastPracticedAt: {},
        },
    };
}

function normalizeNotationPreference(value: unknown): NoteNotationPreference {
    return value === 'flats' || value === 'random' ? value : 'sharps';
}

function createDefaultSettings(): AppSettings {
    return {
    quick: {
        tempo: 60,
        isMetronomeOn: false,
        tuning: [...STANDARD_TUNING],
        fretRange: { min: 0, max: 12 },
        practiceRootNote: 'C',
        practiceScaleType: 'major',
        practiceNoteSequence: 'random',
    },
    full: {
        learning: {
            spacedRepetition: true,
            difficultyMode: 'adaptive',
            showHints: true,
            autoAdvance: true,
        },
        gamification: {
            showXPNotes: true,
            showStreakWarnings: true,
            showAchievements: true,
        },
        instrument: {
            type: 'guitar6',
            leftHanded: false,
            showFretNumbers: true,
            notation: 'sharps',
        },
        audio: {
            volume: 0.8,
            instrumentSound: 'acoustic',
            pitchTolerance: 10,
        },
        display: {
            theme: 'dark', // Defaulting to dark as per modern UI trends
            defaultLayer: 'standard',
        },
    },
        modules: cloneDefaultModules(),
    };
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            ...createDefaultSettings(),

            updateQuickSettings: (settings) =>
                set((state) => {
                    const normalizedTuning = settings.tuning ? normalizeTuning(settings.tuning) : state.quick.tuning;
                    const inferredType = settings.tuning ? inferInstrumentTypeFromTuning(normalizedTuning) : state.full.instrument.type;

                    return {
                        quick: {
                            ...state.quick,
                            ...settings,
                            tuning: normalizedTuning,
                        },
                        full: settings.tuning
                            ? {
                                ...state.full,
                                instrument: {
                                    ...state.full.instrument,
                                    type: inferredType,
                                },
                            }
                            : state.full,
                    };
                }),

            updateFullSettings: (settings) =>
                set((state) => ({
                    full: { ...state.full, ...settings },
                })),

            updateModuleSettings: <M extends keyof ModuleSettings>(module: M, settings: Partial<ModuleSettings[M]>) =>
                set((state) => ({
                    modules: {
                        ...state.modules,
                        [module]: { ...(state.modules[module] as ModuleSettings[M]), ...settings },
                    },
                })),

            resetModuleSettings: <M extends keyof ModuleSettings>(module: M) =>
                set((state) => {
                    const defaultModules = cloneDefaultModules();
                    return {
                        modules: {
                            ...state.modules,
                            [module]: defaultModules[module],
                        },
                    };
                }),

            resetSettings: () => set(createDefaultSettings()),
        }),
        {
            name: 'fretmemo-settings-v2',
            merge: (persistedState, currentState) => {
                const persisted = (persistedState ?? {}) as Partial<SettingsState>;
                const persistedFull = (persisted.full ?? {}) as Partial<FullSettings>;
                const persistedModules = (persisted.modules ?? {}) as Partial<ModuleSettings>;
                const persistedTechnique = (persistedModules.technique ?? {}) as Partial<ModuleSettings['technique']>;
                const persistedInstrument = (persistedFull.instrument ?? {}) as Partial<FullSettings['instrument']>;
                const mergedQuickTuning = normalizeTuning(
                    (persisted.quick as Partial<QuickSettings> | undefined)?.tuning ?? currentState.quick.tuning
                );
                const mergedInstrumentType = normalizeInstrumentType(persistedInstrument.type ?? currentState.full.instrument.type);
                const resolvedInstrumentType =
                    getDefaultTuningForInstrument(mergedInstrumentType).length === mergedQuickTuning.length
                        ? mergedInstrumentType
                        : inferInstrumentTypeFromTuning(mergedQuickTuning);

                return {
                    ...currentState,
                    ...persisted,
                    quick: {
                        ...currentState.quick,
                        ...(persisted.quick ?? {}),
                        tuning: mergedQuickTuning,
                    },
                    full: {
                        ...currentState.full,
                        ...persistedFull,
                        learning: {
                            ...currentState.full.learning,
                            ...(persistedFull.learning ?? {}),
                        },
                        gamification: {
                            ...currentState.full.gamification,
                            ...(persistedFull.gamification ?? {}),
                        },
                        instrument: {
                            ...currentState.full.instrument,
                            ...(persistedFull.instrument ?? {}),
                            type: resolvedInstrumentType,
                            notation: normalizeNotationPreference(persistedInstrument.notation ?? currentState.full.instrument.notation),
                        },
                        audio: {
                            ...currentState.full.audio,
                            ...(persistedFull.audio ?? {}),
                        },
                        display: {
                            ...currentState.full.display,
                            ...(persistedFull.display ?? {}),
                        },
                    },
                    modules: {
                        ...currentState.modules,
                        ...persistedModules,
                        earTraining: {
                            ...currentState.modules.earTraining,
                            ...(persistedModules.earTraining ?? {}),
                        },
                        technique: {
                            ...currentState.modules.technique,
                            ...persistedTechnique,
                            startingBpm: {
                                ...currentState.modules.technique.startingBpm,
                                ...((persistedTechnique.startingBpm ?? {}) as Record<string, number>),
                            },
                            bestBpm: {
                                ...currentState.modules.technique.bestBpm,
                                ...((persistedTechnique.bestBpm ?? {}) as Record<string, number>),
                            },
                            sessionsCompleted: {
                                ...currentState.modules.technique.sessionsCompleted,
                                ...((persistedTechnique.sessionsCompleted ?? {}) as Record<string, number>),
                            },
                            lastPracticedAt: {
                                ...currentState.modules.technique.lastPracticedAt,
                                ...((persistedTechnique.lastPracticedAt ?? {}) as Record<string, string>),
                            },
                        },
                    },
                };
            },
        }
    )
);

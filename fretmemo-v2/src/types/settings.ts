import type { NoteName } from "@/types/fretboard";

export type PracticeScaleType = "major" | "minor" | "majorPentatonic" | "minorPentatonic";
export type InstrumentType = "guitar6" | "guitar7" | "guitar8" | "bass4" | "bass5" | "ukulele4";

export interface QuickSettings {
    tempo: number;
    isMetronomeOn: boolean;
    tuning: NoteName[]; // High E -> Low E
    fretRange: { min: number; max: number };
    practiceRootNote: NoteName;
    practiceScaleType: PracticeScaleType;
}

export interface FullSettings {
    learning: {
        spacedRepetition: boolean;
        difficultyMode: 'adaptive' | 'manual';
        showHints: boolean;
        autoAdvance: boolean;
    };
    gamification: {
        showXPNotes: boolean;
        showStreakWarnings: boolean;
        showAchievements: boolean;
    };
    instrument: {
        type: InstrumentType;
        leftHanded: boolean;
        showFretNumbers: boolean;
        notation: 'sharps' | 'flats';
    };
    audio: {
        volume: number; // 0-1
        instrumentSound: 'acoustic' | 'electric' | 'clean';
        pitchTolerance: number; // cents
    };
    display: {
        theme: 'light' | 'dark' | 'system';
        defaultLayer: 'standard' | 'heatmap' | 'scale' | 'intervals';
    };
}

export interface ModuleSettings {
    earTraining: {
        intervals: string[]; // e.g., ['m2', 'M3', 'P5']
        direction: 'ascending' | 'descending' | 'harmonic';
    };
    technique: {
        startingBpm: Record<string, number>; // exerciseId -> bpm
        bestBpm: Record<string, number>; // exerciseId -> best reached bpm
        sessionsCompleted: Record<string, number>; // exerciseId -> completed sessions
        lastPracticedAt: Record<string, string>; // exerciseId -> ISO timestamp
    };
}

export interface AppSettings {
    quick: QuickSettings;
    full: FullSettings;
    modules: ModuleSettings;
}

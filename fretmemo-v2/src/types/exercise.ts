

export type ExerciseCategory = 'spider' | 'permutation' | 'diagonal' | 'stringSkip' | 'legato' | 'linear';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface ExerciseMetadata {
    id: string;
    name: string;
    icon: string;
    description: string;
    difficulty: Difficulty;
    benefits: string[];
    category: ExerciseCategory;
}

export interface PermutationPattern {
    index: number;
    pattern: number[]; // e.g. [1, 2, 3, 4]
    tier: 1 | 2 | 3;
    name: string;
}

export interface ExerciseSettings {
    bpm: number;
    startFret?: number;
    endFret?: number;
    stringPattern?: number[];
    permutationIndex?: number;
    direction?: 'ascending' | 'descending';
    notesPerShift?: number; // for linear
    skipPattern?: string; // for stringSkip
}

export interface NoteEvent {
    stringIndex: number; // 0-5
    fret: number;
    finger?: number; // 1-4
    pickDirection?: 'down' | 'up';
    time?: number; // scheduling time
}

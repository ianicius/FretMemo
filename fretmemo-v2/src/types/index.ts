export * from './fretboard';
export * from './settings';
export * from './progress';
export * from './scores';

export type TabId = 'home' | 'practice' | 'sound' | 'challenges' | 'improv' | 'progress';

export interface ExerciseType {
    id: string;
    name: string;
    category: 'fretboard' | 'ear-training' | 'technique' | 'theory';
    description: string;
}

import type { ExerciseMetadata } from '@/types/exercise';

export const EXERCISES: Record<string, ExerciseMetadata> = {
    spiderWalk: {
        id: 'spiderWalk',
        name: 'Spider Walk',
        icon: '🕷️',
        description: 'Baseline synchronization exercise',
        difficulty: 'beginner',
        benefits: ['Synchronization', 'Adjacent string crossing', 'Finger placement'],
        category: 'spider'
    },
    permutation: {
        id: 'permutation',
        name: 'Permutation Trainer',
        icon: '🔀',
        description: '24 finger patterns for independence',
        difficulty: 'intermediate',
        benefits: ['Finger independence', 'Non-sequential movement', 'Coordination'],
        category: 'permutation'
    },
    diagonal: {
        id: 'diagonal',
        name: 'Diagonal Patterns',
        icon: '↗️',
        description: 'Shape shifting across strings',
        difficulty: 'intermediate',
        benefits: ['Shape shifting', 'Economy picking', 'Position awareness'],
        category: 'diagonal'
    },
    stringSkip: {
        id: 'stringSkip',
        name: 'String Skipping',
        icon: '⏭️',
        description: 'Non-adjacent string targeting',
        difficulty: 'intermediate',
        benefits: ['Pick accuracy', 'Targeting', 'Wide leaps'],
        category: 'stringSkip'
    },
    legato: {
        id: 'legato',
        name: 'Legato Builder',
        icon: '🎸',
        description: 'Hammer-ons and pull-offs',
        difficulty: 'intermediate',
        benefits: ['Left hand strength', 'Stamina', 'Tone consistency'],
        category: 'legato'
    },
    linear: {
        id: 'linear',
        name: 'Linear Shifter',
        icon: '↔️',
        description: 'Horizontal position shifting',
        difficulty: 'intermediate',
        benefits: ['Horizontal shifting', 'Arm movement', 'Position shifting'],
        category: 'linear'
    }
};

export const EXERCISE_LIST = Object.values(EXERCISES);

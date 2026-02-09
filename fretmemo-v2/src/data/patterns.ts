import type { PermutationPattern } from '@/types/exercise';

export const PERMUTATIONS: PermutationPattern[] = [
    { index: 0, pattern: [1, 2, 3, 4], tier: 1, name: 'Standard Spider' },
    { index: 1, pattern: [1, 2, 4, 3], tier: 2, name: '' },
    { index: 2, pattern: [1, 3, 2, 4], tier: 2, name: 'Diminished feel' },
    { index: 3, pattern: [1, 3, 4, 2], tier: 2, name: '' },
    { index: 4, pattern: [1, 4, 2, 3], tier: 2, name: '' },
    { index: 5, pattern: [1, 4, 3, 2], tier: 2, name: '' },
    { index: 6, pattern: [2, 1, 3, 4], tier: 2, name: '' },
    { index: 7, pattern: [2, 1, 4, 3], tier: 2, name: '' },
    { index: 8, pattern: [2, 3, 1, 4], tier: 3, name: '' },
    { index: 9, pattern: [2, 3, 4, 1], tier: 2, name: '' },
    { index: 10, pattern: [2, 4, 1, 3], tier: 2, name: '' },
    { index: 11, pattern: [2, 4, 3, 1], tier: 3, name: '' },
    { index: 12, pattern: [3, 1, 2, 4], tier: 3, name: 'Ring start - hard' },
    { index: 13, pattern: [3, 1, 4, 2], tier: 3, name: '' },
    { index: 14, pattern: [3, 2, 1, 4], tier: 3, name: '' },
    { index: 15, pattern: [3, 2, 4, 1], tier: 3, name: 'Tendon breaker' },
    { index: 16, pattern: [3, 4, 1, 2], tier: 3, name: '' },
    { index: 17, pattern: [3, 4, 2, 1], tier: 3, name: '' },
    { index: 18, pattern: [4, 1, 2, 3], tier: 3, name: 'Pinky start' },
    { index: 19, pattern: [4, 1, 3, 2], tier: 3, name: '' },
    { index: 20, pattern: [4, 2, 1, 3], tier: 3, name: '' },
    { index: 21, pattern: [4, 2, 3, 1], tier: 3, name: '' },
    { index: 22, pattern: [4, 3, 1, 2], tier: 3, name: '' },
    { index: 23, pattern: [4, 3, 2, 1], tier: 1, name: 'Reverse Spider' }
];

export const SKIP_PATTERNS = {
    single: { sequence: [5, 3, 4, 2, 3, 1, 2, 0], name: 'Single Skip' },
    octave: { sequence: [5, 3, 4, 2, 3, 1, 2, 0], pairs: [[5, 3], [4, 2], [3, 1], [2, 0]], name: 'Octave Skip' },
    double: { sequence: [5, 2, 4, 1, 3, 0], pairs: [[5, 2], [4, 1], [3, 0]], name: 'Double Skip' },
    wide: { sequence: [5, 0, 4, 1, 3, 2], pairs: [[5, 0], [4, 1], [3, 2]], name: 'Wide Skip' }
};

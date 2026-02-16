export type RhythmReadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type RhythmTokenKind = "note" | "rest";
export type RhythmTokenDifficulty = "beginner" | "intermediate" | "advanced";

export interface RhythmNotationToken {
    kind: RhythmTokenKind;
    units: number;
    accent?: boolean;
}

export interface RhythmReadingExercise {
    id: string;
    level: RhythmReadingLevel;
    title: string;
    description: string;
    difficulty: RhythmTokenDifficulty;
    timeSignatureTop: 3 | 4 | 6;
    subdivision: 2 | 3 | 4;
    tokens: RhythmNotationToken[];
}

function n(units: number, accent = false): RhythmNotationToken {
    return { kind: "note", units, accent };
}

function r(units: number): RhythmNotationToken {
    return { kind: "rest", units };
}

export const RHYTHM_READING_EXERCISES: RhythmReadingExercise[] = [
    {
        id: "rr-l1-quarters-a",
        level: 1,
        title: "Quarter Pulse A",
        description: "Steady quarter notes with one quarter rest.",
        difficulty: "beginner",
        timeSignatureTop: 4,
        subdivision: 4,
        tokens: [n(4, true), n(4), r(4), n(4)],
    },
    {
        id: "rr-l1-quarters-b",
        level: 1,
        title: "Quarter Pulse B",
        description: "Quarter-note starts with off-beat silence.",
        difficulty: "beginner",
        timeSignatureTop: 4,
        subdivision: 4,
        tokens: [r(4), n(4, true), n(4), n(4)],
    },
    {
        id: "rr-l2-eighths-a",
        level: 2,
        title: "Eighth Stream A",
        description: "Simple eighths with one missing attack.",
        difficulty: "beginner",
        timeSignatureTop: 4,
        subdivision: 4,
        tokens: [n(2, true), n(2), n(2), r(2), n(2), n(2), n(4)],
    },
    {
        id: "rr-l2-eighths-b",
        level: 2,
        title: "Eighth Stream B",
        description: "Quarter + eighth combinations and rests.",
        difficulty: "beginner",
        timeSignatureTop: 4,
        subdivision: 4,
        tokens: [n(4, true), n(2), n(2), r(2), n(2), n(4)],
    },
    {
        id: "rr-l3-sixteenth-a",
        level: 3,
        title: "Sixteenth Entry A",
        description: "Quarter and sixteenth placements in 4/4.",
        difficulty: "intermediate",
        timeSignatureTop: 4,
        subdivision: 4,
        tokens: [n(1, true), n(1), n(2), r(1), n(1), n(4), n(2), n(2), n(2)],
    },
    {
        id: "rr-l3-sixteenth-b",
        level: 3,
        title: "Sixteenth Entry B",
        description: "Mixed sixteenth and eighth starts.",
        difficulty: "intermediate",
        timeSignatureTop: 4,
        subdivision: 4,
        tokens: [n(2, true), r(1), n(1), n(2), n(4), r(2), n(2), n(2)],
    },
    {
        id: "rr-l4-dotted-a",
        level: 4,
        title: "Dotted Feel A",
        description: "Dotted eighth and quarter combinations.",
        difficulty: "intermediate",
        timeSignatureTop: 4,
        subdivision: 4,
        tokens: [n(3, true), n(1), n(4), n(3), r(1), n(4)],
    },
    {
        id: "rr-l4-dotted-b",
        level: 4,
        title: "Dotted Feel B",
        description: "Dotted rhythm with rests.",
        difficulty: "intermediate",
        timeSignatureTop: 4,
        subdivision: 4,
        tokens: [r(1), n(3, true), n(4), r(2), n(2), n(4)],
    },
    {
        id: "rr-l5-triplets-a",
        level: 5,
        title: "Triplet Flow A",
        description: "Quarter-note triplet grid in 4/4.",
        difficulty: "advanced",
        timeSignatureTop: 4,
        subdivision: 3,
        tokens: [n(1, true), n(1), n(1), n(2), r(1), n(1), n(1), n(1), n(2), n(1)],
    },
    {
        id: "rr-l5-triplets-b",
        level: 5,
        title: "Triplet Flow B",
        description: "Triplet starts with syncopated rests.",
        difficulty: "advanced",
        timeSignatureTop: 4,
        subdivision: 3,
        tokens: [r(1), n(1, true), n(1), n(3), r(1), n(2), n(1), n(1), n(1)],
    },
    {
        id: "rr-l6-compound-a",
        level: 6,
        title: "Compound 6/8 A",
        description: "6/8 pulse with eighth-note groupings.",
        difficulty: "advanced",
        timeSignatureTop: 6,
        subdivision: 2,
        tokens: [n(2, true), n(1), n(1), r(2), n(2), n(2), n(2)],
    },
    {
        id: "rr-l6-compound-b",
        level: 6,
        title: "Compound 6/8 B",
        description: "6/8 accents with internal rests.",
        difficulty: "advanced",
        timeSignatureTop: 6,
        subdivision: 2,
        tokens: [n(2, true), r(1), n(1), n(2), n(2), r(2), n(2)],
    },
];

export function getRhythmReadingExercisesByLevel(level: RhythmReadingLevel): RhythmReadingExercise[] {
    return RHYTHM_READING_EXERCISES.filter((exercise) => exercise.level === level);
}

export function getRhythmExerciseStepCount(exercise: RhythmReadingExercise): number {
    return exercise.timeSignatureTop * exercise.subdivision;
}

export function getRhythmExpectedOnsets(exercise: RhythmReadingExercise): number[] {
    const expected: number[] = [];
    let cursor = 0;
    for (const token of exercise.tokens) {
        if (token.units <= 0) continue;
        if (token.kind === "note") {
            expected.push(cursor);
        }
        cursor += token.units;
    }
    return expected;
}

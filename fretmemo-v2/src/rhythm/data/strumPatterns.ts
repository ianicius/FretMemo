import type { StrumDirection } from "@/rhythm/engine/InputEvaluator";

export type StrumStepSymbol = "D" | "U" | "M" | "R";
export type StrumPatternDifficulty = "beginner" | "intermediate" | "advanced";

export interface StrumPattern {
    id: string;
    title: string;
    genre: string;
    difficulty: StrumPatternDifficulty;
    subdivision: 2 | 4;
    slots: StrumStepSymbol[];
    description: string;
}

export interface ExpectedStrumStep {
    direction: StrumDirection;
    muted: boolean;
}

export const STRUM_PATTERNS: StrumPattern[] = [
    {
        id: "basic-down",
        title: "Basic Down",
        genre: "Universal",
        difficulty: "beginner",
        subdivision: 2,
        slots: ["D", "R", "D", "R", "D", "R", "D", "R"],
        description: "Solid quarter-note downstrokes.",
    },
    {
        id: "folk-strum",
        title: "Folk Strum",
        genre: "Folk / Country",
        difficulty: "beginner",
        subdivision: 2,
        slots: ["D", "R", "D", "U", "R", "U", "D", "U"],
        description: "Classic singer-songwriter groove.",
    },
    {
        id: "pop-rock",
        title: "Pop Rock",
        genre: "Pop / Rock",
        difficulty: "intermediate",
        subdivision: 2,
        slots: ["D", "R", "D", "U", "M", "U", "D", "U"],
        description: "Muted attack on beat 3 for drive.",
    },
    {
        id: "island",
        title: "Island Strum",
        genre: "Reggae / Ska",
        difficulty: "intermediate",
        subdivision: 2,
        slots: ["D", "U", "M", "U", "D", "R", "R", "U"],
        description: "Offbeat-forward feel with space.",
    },
    {
        id: "syncopated",
        title: "Syncopated",
        genre: "Funk / R&B",
        difficulty: "advanced",
        subdivision: 2,
        slots: ["D", "R", "M", "U", "R", "U", "D", "M"],
        description: "Tighter accents and syncopated pushes.",
    },
    {
        id: "sixteenth-flow",
        title: "16th Note Flow",
        genre: "Mixed",
        difficulty: "advanced",
        subdivision: 4,
        slots: ["D", "U", "R", "U", "D", "R", "U", "R", "D", "U", "R", "U", "D", "R", "U", "R"],
        description: "Continuous 16th-grid motion with rests.",
    },
];

export function getExpectedStepFromSymbol(symbol: StrumStepSymbol): ExpectedStrumStep | null {
    if (symbol === "R") return null;
    if (symbol === "U") {
        return {
            direction: "up",
            muted: false,
        };
    }
    if (symbol === "M") {
        return {
            direction: "down",
            muted: true,
        };
    }
    return {
        direction: "down",
        muted: false,
    };
}


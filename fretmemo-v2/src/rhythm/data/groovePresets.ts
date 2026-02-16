import type { StrumStepSymbol } from "@/rhythm/data/strumPatterns";

export type GrooveFeel = "straight" | "shuffle" | "compound";
export type GrooveDifficulty = "intermediate" | "advanced";

export interface GroovePreset {
    id: string;
    title: string;
    genre: string;
    description: string;
    difficulty: GrooveDifficulty;
    feel: GrooveFeel;
    timeSignatureTop: 4;
    subdivision: 2 | 3 | 4;
    slots: StrumStepSymbol[];
    drums: {
        kick: number[];
        snare: number[];
        hat: number[];
        accentHat?: number[];
    };
}

export const GROOVE_PRESETS: GroovePreset[] = [
    {
        id: "straight-8-rock",
        title: "Straight 8th Rock",
        genre: "Rock",
        description: "Solid backbeat with downbeat accents.",
        difficulty: "intermediate",
        feel: "straight",
        timeSignatureTop: 4,
        subdivision: 2,
        slots: ["D", "R", "D", "U", "D", "R", "D", "U"],
        drums: {
            kick: [0, 4],
            snare: [2, 6],
            hat: [0, 1, 2, 3, 4, 5, 6, 7],
            accentHat: [0, 4],
        },
    },
    {
        id: "shuffle-blues",
        title: "Shuffle Blues",
        genre: "Blues",
        description: "Triplet grid with shuffle pocket.",
        difficulty: "intermediate",
        feel: "shuffle",
        timeSignatureTop: 4,
        subdivision: 3,
        slots: ["D", "R", "U", "D", "R", "U", "D", "R", "U", "D", "R", "U"],
        drums: {
            kick: [0, 6, 9],
            snare: [3, 9],
            hat: [0, 2, 3, 5, 6, 8, 9, 11],
            accentHat: [0, 6],
        },
    },
    {
        id: "reggae-offbeat",
        title: "Reggae Offbeat",
        genre: "Reggae",
        description: "Lean on the offbeats and keep space.",
        difficulty: "intermediate",
        feel: "straight",
        timeSignatureTop: 4,
        subdivision: 2,
        slots: ["R", "U", "R", "U", "R", "U", "R", "U"],
        drums: {
            kick: [0, 4],
            snare: [2, 6],
            hat: [1, 3, 5, 7],
            accentHat: [1, 5],
        },
    },
    {
        id: "bossa-nova",
        title: "Bossa Nova",
        genre: "Latin",
        description: "Alternating bass pulse with light upstrokes.",
        difficulty: "advanced",
        feel: "straight",
        timeSignatureTop: 4,
        subdivision: 2,
        slots: ["D", "R", "U", "R", "D", "U", "R", "U"],
        drums: {
            kick: [0, 3, 4, 7],
            snare: [2, 6],
            hat: [0, 2, 4, 6],
            accentHat: [2, 6],
        },
    },
    {
        id: "ballad-12-8",
        title: "12/8 Ballad",
        genre: "Ballad",
        description: "Slow compound feel with triplet flow.",
        difficulty: "advanced",
        feel: "compound",
        timeSignatureTop: 4,
        subdivision: 3,
        slots: ["D", "R", "U", "D", "R", "U", "D", "R", "U", "D", "R", "U"],
        drums: {
            kick: [0, 6],
            snare: [3, 9],
            hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            accentHat: [0, 3, 6, 9],
        },
    },
    {
        id: "funk-16th",
        title: "Funk 16th",
        genre: "Funk",
        description: "Tight sixteenth-note grid with muted attacks.",
        difficulty: "advanced",
        feel: "straight",
        timeSignatureTop: 4,
        subdivision: 4,
        slots: ["D", "R", "U", "M", "R", "U", "D", "M", "D", "R", "U", "R", "D", "M", "U", "R"],
        drums: {
            kick: [0, 6, 8, 14],
            snare: [4, 12],
            hat: [0, 2, 4, 6, 8, 10, 12, 14],
            accentHat: [0, 8],
        },
    },
];

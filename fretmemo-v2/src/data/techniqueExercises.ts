export interface TechniqueExerciseDefinition {
    name: string;
    description: string;
    instructions: string[];
    defaultBpm: number;
}

export const TECHNIQUE_EXERCISES: Record<string, TechniqueExerciseDefinition> = {
    spider: {
        name: "Spider Walk",
        description: "Baseline synchronization exercise",
        instructions: [
            "Place fingers 1-2-3-4 on adjacent frets",
            "Play each note in sequence",
            "Move to the next string and repeat",
            "Focus on clean, even timing"
        ],
        defaultBpm: 60
    },
    permutation: {
        name: "Permutation Trainer",
        description: "24 finger patterns for independence",
        instructions: [
            "Choose a finger permutation pattern",
            "Play the pattern across all strings",
            "Maintain consistent timing",
            "Gradually increase speed"
        ],
        defaultBpm: 60
    },
    linear: {
        name: "Linear Shifter",
        description: "Horizontal position shifting",
        instructions: [
            "Play 4 notes on one string",
            "Shift up one fret, repeat",
            "Continue to the 12th fret",
            "Return descending"
        ],
        defaultBpm: 70
    },
    diagonal: {
        name: "Diagonal Patterns",
        description: "Shape shifting across strings",
        instructions: [
            "Play a 4-note pattern",
            "Move diagonally across the fretboard",
            "Maintain finger independence",
            "Focus on smooth transitions"
        ],
        defaultBpm: 65
    },
    stringskip: {
        name: "String Skipping",
        description: "Non-adjacent string targeting",
        instructions: [
            "Play on string 6, then skip to 4",
            "Continue the skip pattern",
            "Focus on picking accuracy",
            "Keep hand position stable"
        ],
        defaultBpm: 55
    },
    legato: {
        name: "Legato Builder",
        description: "Hammer-ons and pull-offs",
        instructions: [
            "Play first note with a pick",
            "Hammer-on the next note",
            "Pull-off back to first note",
            "Focus on even volume"
        ],
        defaultBpm: 80
    }
};

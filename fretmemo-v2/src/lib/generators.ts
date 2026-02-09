import type { ExerciseSettings, NoteEvent, ExerciseCategory } from "@/types/exercise";
import { PERMUTATIONS, SKIP_PATTERNS } from "@/data/patterns";

interface GeneratorConfig extends ExerciseSettings {
    category: ExerciseCategory;
    repetitions?: number;
}

export function generateSequence(config: GeneratorConfig): NoteEvent[] {
    const {
        category,
        startFret = 1,
        endFret = 12,
        stringPattern = [5, 4, 3, 2, 1, 0], // Default all strings low to high
        permutationIndex = 0,
        notesPerShift = 4,
        skipPattern = 'single',
        direction = 'ascending'
    } = config;

    const sequence: NoteEvent[] = [];
    const repetitions = config.repetitions || 1;

    for (let r = 0; r < repetitions; r++) {

        switch (category) {
            case 'spider':
            case 'permutation': {
                const pattern = PERMUTATIONS[permutationIndex]?.pattern || [1, 2, 3, 4];
                // Iterate through strings
                for (let s = 0; s < stringPattern.length; s++) {
                    const stringIdx = stringPattern[s];
                    // Iterate through fingers in pattern
                    for (let f = 0; f < pattern.length; f++) {
                        const finger = pattern[f];
                        const fret = startFret + finger - 1; // 1-based finger to 0-based offset
                        // Alternating picking logic (simplified)
                        const totalNoteIndex = (s * pattern.length) + f;
                        const pick = totalNoteIndex % 2 === 0 ? 'down' : 'up';

                        sequence.push({
                            stringIndex: stringIdx,
                            fret: fret,
                            finger: finger,
                            pickDirection: pick
                        });
                    }
                }
                break;
            }

            case 'linear': {
                let currentFret = startFret;
                let notesPlayed = 0;
                // Single string usually for linear, or specified pattern
                const targetString = stringPattern[0] ?? 5;

                while (currentFret <= endFret - 3) {
                    for (let i = 0; i < 4 && notesPlayed < notesPerShift; i++) {
                        sequence.push({
                            stringIndex: targetString,
                            fret: currentFret + i,
                            finger: i + 1,
                            pickDirection: notesPlayed % 2 === 0 ? 'down' : 'up'
                        });
                        notesPlayed++;
                    }
                    if (notesPlayed >= notesPerShift) {
                        currentFret++;
                        notesPlayed = 0;
                    }
                }
                break;
            }

            case 'diagonal': {
                for (let i = 0; i < stringPattern.length; i++) {
                    const stringIdx = stringPattern[i];
                    const fret = startFret + i; // Diagonal movement
                    sequence.push({
                        stringIndex: stringIdx,
                        fret: fret,
                        finger: i + 1, // 1, 2, 3, 4...
                        pickDirection: i % 2 === 0 ? 'down' : 'up'
                    });
                }
                break;
            }

            case 'stringSkip': {
                const patternDef = SKIP_PATTERNS[skipPattern as keyof typeof SKIP_PATTERNS];
                if (patternDef) {
                    patternDef.sequence.forEach((stringIdx, idx) => {
                        sequence.push({
                            stringIndex: stringIdx,
                            fret: startFret, // Fixed fret for skipping usually
                            finger: 1, // Usually index or alternating
                            pickDirection: idx % 2 === 0 ? 'down' : 'up'
                        });
                    });
                }
                break;
            }

            // Add other cases...
        }
    }

    if (direction === 'descending') {
        return sequence.reverse();
    }

    return sequence;
}

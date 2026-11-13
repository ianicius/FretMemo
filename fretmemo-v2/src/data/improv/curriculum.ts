/**
 * CANONICAL curriculum of the Improv Training module
 * (run improv-training-2026-11-13).
 *
 * The 22 learning elements and their order are a 1:1 transcription of
 * `gauntlet/improv-training/sources/video-source-map.md` (Brandon D'Eon,
 * "What To Learn For Guitar Improv (in Order)"). DO NOT reorder, add or
 * remove entries — the order test (curriculum.test.ts) and the visual judge
 * both guard this list.
 *
 * Each module carries: stable id, 1-based order, i18n keys (PL names +
 * theory) and ≥2 executable exercises mapped onto the four engines:
 * E1 fretboard-quiz, E2 choice-quiz, E3 diagram-drill, E4 backing-improv.
 */

import type { NoteName } from "@/types/fretboard";
import type { ScaleShapeId, TriadQuality } from "@/lib/improv/scaleShapes";
import type { ChoiceGeneratorId } from "@/lib/improv/questions";

/* ─────────── Engine parameter types ─────────── */

export type ImprovEngineType = "fretboard-quiz" | "choice-quiz" | "diagram-drill" | "backing-improv";

export type FretboardQuizDirection = "position-to-note" | "note-to-position" | "both";

/** Tonic for shapes/keys: sharp spellings plus the flat keys the curriculum needs. */
export type ImprovKey = NoteName | "Bb" | "Db" | "Eb" | "Gb" | "Ab";

export interface FretboardQuizParams {
    direction: FretboardQuizDirection;
    /** Guitar string indices, 0 = high E … 5 = low E. */
    stringIndices: number[];
    fretFrom: number;
    fretTo: number;
    pitchClasses: readonly NoteName[] | "all";
    questionCount: number;
    /** Pass threshold: requiredCorrect / questionCount. */
    requiredCorrect: number;
    answerOptions: number;
}

export interface ChoiceQuizParams {
    generatorId: ChoiceGeneratorId;
    questionCount: number;
    requiredCorrect: number;
    answerOptions: number;
    /** Optional direction pin; "mixed" randomizes per question. */
    direction?: string;
}

export interface DiagramShapeRef {
    shapeId: ScaleShapeId;
    defaultKey: ImprovKey;
    /** Keys selectable in the drill (defaults to [defaultKey]). */
    keys?: ImprovKey[];
    /** Only for shapeId "triad". */
    triadQuality?: TriadQuality;
}

export interface DiagramDrillParams {
    shapes: DiagramShapeRef[];
    fretFrom: number;
    fretTo: number;
    defaultBpm: number;
    /** Full up+down runs required to pass the drill. */
    requiredRuns: number;
}

export interface BackingLoopVariant {
    id: string;
    labelKey: string;
    progression: string[];
    goalKey: string;
}

export interface BackingLoopParams {
    progression: string[];
    goalKey: string;
    beatsPerChord: number;
    defaultBpm: number;
    minBpm: number;
    maxBpm: number;
    /** Successful full loops required to pass. */
    requiredPasses: number;
    /** Optional selectable variants (different progression and/or goal). */
    variants?: BackingLoopVariant[];
}

export type ImprovExerciseParams =
    | FretboardQuizParams
    | ChoiceQuizParams
    | DiagramDrillParams
    | BackingLoopParams;

export interface ImprovExercise {
    /** Stable id: "<moduleId>.<eN>" (used as the persist key). */
    id: string;
    engine: ImprovEngineType;
    nameKey: string;
    descKey: string;
    params: ImprovExerciseParams;
}

export interface ImprovModule {
    id: string;
    /** 1-based position in the canonical order (matches the video 1–22). */
    order: number;
    theoryKey: string;
    exercises: ImprovExercise[];
}

/* ─────────── Shared curriculum helpers ─────────── */

const PENTATONIC_KEYS: ImprovKey[] = ["C", "A", "D", "E", "G"];
const PENT_POSITION_KEYS: ImprovKey[] = ["G", "Bb", "C", "D", "F", "A", "E"];
const SCALE_KEYS: ImprovKey[] = ["A", "C", "D", "E", "G"];

function fretboardExercise(
    moduleId: string,
    suffix: string,
    direction: Exclude<FretboardQuizDirection, "both">,
    stringIndices: number[],
    questionCount: number,
): ImprovExercise {
    return {
        id: `${moduleId}.${suffix}`,
        engine: "fretboard-quiz",
        nameKey: `improv.ex.${moduleId}.${suffix}.name`,
        descKey: `improv.ex.${moduleId}.${suffix}.desc`,
        params: {
            direction,
            stringIndices,
            fretFrom: 0,
            fretTo: 12,
            pitchClasses: "all",
            questionCount,
            requiredCorrect: questionCount,
            answerOptions: 4,
        },
    };
}

function choiceExercise(
    moduleId: string,
    suffix: string,
    generatorId: ChoiceGeneratorId,
    questionCount: number,
    direction?: string,
): ImprovExercise {
    return {
        id: `${moduleId}.${suffix}`,
        engine: "choice-quiz",
        nameKey: `improv.ex.${moduleId}.${suffix}.name`,
        descKey: `improv.ex.${moduleId}.${suffix}.desc`,
        params: {
            generatorId,
            questionCount,
            requiredCorrect: 8,
            answerOptions: 4,
            direction,
        },
    };
}

function drillExercise(
    moduleId: string,
    suffix: string,
    shapes: DiagramShapeRef[],
    fretFrom: number,
    fretTo: number,
    defaultBpm: number,
    requiredRuns: number,
): ImprovExercise {
    return {
        id: `${moduleId}.${suffix}`,
        engine: "diagram-drill",
        nameKey: `improv.ex.${moduleId}.${suffix}.name`,
        descKey: `improv.ex.${moduleId}.${suffix}.desc`,
        params: { shapes, fretFrom, fretTo, defaultBpm, requiredRuns },
    };
}

function loopExercise(
    moduleId: string,
    suffix: string,
    params: BackingLoopParams,
): ImprovExercise {
    return {
        id: `${moduleId}.${suffix}`,
        engine: "backing-improv",
        nameKey: `improv.ex.${moduleId}.${suffix}.name`,
        descKey: `improv.ex.${moduleId}.${suffix}.desc`,
        params,
    };
}

/* ─────────── The 22 modules (canonical order — do not touch) ─────────── */

export const CURRICULUM: ImprovModule[] = [
    {
        id: "e-string-notes",
        order: 1,
        theoryKey: "improv.modules.e-string-notes.theory",
        exercises: [
            fretboardExercise("e-string-notes", "e1", "position-to-note", [5], 10),
            fretboardExercise("e-string-notes", "e2", "note-to-position", [5], 10),
        ],
    },
    {
        id: "key-signatures",
        order: 2,
        theoryKey: "improv.modules.key-signatures.theory",
        exercises: [
            choiceExercise("key-signatures", "e1", "keySig", 10, "key-to-count"),
            choiceExercise("key-signatures", "e2", "keySig", 10, "count-to-key"),
        ],
    },
    {
        id: "pentatonic-scale",
        order: 3,
        theoryKey: "improv.modules.pentatonic-scale.theory",
        exercises: [
            drillExercise(
                "pentatonic-scale",
                "e1",
                [{ shapeId: "min-pent", defaultKey: "A", keys: PENTATONIC_KEYS }],
                5,
                8,
                70,
                2,
            ),
            drillExercise(
                "pentatonic-scale",
                "e2",
                [{ shapeId: "min-pent", defaultKey: "E", keys: PENTATONIC_KEYS }],
                12,
                15,
                70,
                2,
            ),
        ],
    },
    {
        id: "major-scale",
        order: 4,
        theoryKey: "improv.modules.major-scale.theory",
        exercises: [
            drillExercise(
                "major-scale",
                "e1",
                [{ shapeId: "major", defaultKey: "A", keys: SCALE_KEYS }],
                2,
                6,
                60,
                2,
            ),
            drillExercise(
                "major-scale",
                "e2",
                [{ shapeId: "major", defaultKey: "C", keys: SCALE_KEYS }],
                7,
                11,
                60,
                2,
            ),
        ],
    },
    {
        id: "fretboard-notes",
        order: 5,
        theoryKey: "improv.modules.fretboard-notes.theory",
        exercises: [
            fretboardExercise("fretboard-notes", "e1", "position-to-note", [0, 1, 2, 3, 4, 5], 15),
            fretboardExercise("fretboard-notes", "e2", "note-to-position", [0, 1, 2, 3, 4, 5], 15),
        ],
    },
    {
        id: "pentatonic-positions",
        order: 6,
        theoryKey: "improv.modules.pentatonic-positions.theory",
        exercises: [
            drillExercise("pentatonic-positions", "e1", [{ shapeId: "min-pent", defaultKey: "G" }], 3, 6, 70, 1),
            drillExercise("pentatonic-positions", "e2", [{ shapeId: "maj-pent", defaultKey: "Bb" }], 5, 8, 70, 1),
            drillExercise("pentatonic-positions", "e3", [{ shapeId: "dorian-pent", defaultKey: "C" }], 7, 10, 70, 1),
            drillExercise("pentatonic-positions", "e4", [{ shapeId: "phrygian-pent", defaultKey: "D" }], 10, 13, 70, 1),
            drillExercise("pentatonic-positions", "e5", [{ shapeId: "mixo-pent", defaultKey: "F" }], 12, 15, 70, 1),
        ],
    },
    {
        id: "modes",
        order: 7,
        theoryKey: "improv.modules.modes.theory",
        exercises: [
            choiceExercise("modes", "e1", "modes", 10, "order-to-mode"),
            choiceExercise("modes", "e2", "modes", 10, "characteristic-to-mode"),
        ],
    },
    {
        id: "chord-construction",
        order: 8,
        theoryKey: "improv.modules.chord-construction.theory",
        exercises: [
            choiceExercise("chord-construction", "e1", "triadBuild", 10, "degree-to-type"),
            choiceExercise("chord-construction", "e2", "triadBuild", 10, "degree-to-triad"),
        ],
    },
    {
        id: "chord-scale-major",
        order: 9,
        theoryKey: "improv.modules.chord-scale-major.theory",
        exercises: [
            choiceExercise("chord-scale-major", "e1", "chordScaleMajor", 10, "chord-to-mode"),
            choiceExercise("chord-scale-major", "e2", "chordScaleMajor", 10, "mode-to-chord"),
        ],
    },
    {
        id: "triads",
        order: 10,
        theoryKey: "improv.modules.triads.theory",
        exercises: [
            drillExercise(
                "triads",
                "e1",
                [
                    { shapeId: "triad", defaultKey: "A", triadQuality: "min", keys: PENTATONIC_KEYS },
                    { shapeId: "triad", defaultKey: "C", triadQuality: "maj", keys: PENTATONIC_KEYS },
                ],
                0,
                12,
                70,
                2,
            ),
            choiceExercise("triads", "e2", "triadType", 10, "name-to-intervals"),
        ],
    },
    {
        id: "arpeggios",
        order: 11,
        theoryKey: "improv.modules.arpeggios.theory",
        exercises: [
            drillExercise(
                "arpeggios",
                "e1",
                [{ shapeId: "m7-arp", defaultKey: "C", keys: PENT_POSITION_KEYS }],
                0,
                12,
                70,
                1,
            ),
            drillExercise(
                "arpeggios",
                "e2",
                [{ shapeId: "dom7-arp", defaultKey: "G", keys: PENT_POSITION_KEYS }],
                0,
                12,
                70,
                1,
            ),
        ],
    },
    {
        id: "target-chord-tones",
        order: 12,
        theoryKey: "improv.modules.target-chord-tones.theory",
        exercises: [
            loopExercise("target-chord-tones", "e1", {
                progression: ["Am", "C", "Em", "D"],
                goalKey: "improv.goals.targetThird",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 3,
            }),
            loopExercise("target-chord-tones", "e2", {
                progression: ["Am", "C", "Em", "D"],
                goalKey: "improv.goals.targetFifth",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 3,
            }),
        ],
    },
    {
        id: "voice-leading",
        order: 13,
        theoryKey: "improv.modules.voice-leading.theory",
        exercises: [
            loopExercise("voice-leading", "e1", {
                progression: ["Gm", "Bbm"],
                goalKey: "improv.goals.voiceLeading",
                beatsPerChord: 4,
                defaultBpm: 70,
                minBpm: 40,
                maxBpm: 140,
                requiredPasses: 3,
            }),
            loopExercise("voice-leading", "e2", {
                progression: ["Gm", "Cm"],
                goalKey: "improv.goals.voiceLeading",
                beatsPerChord: 4,
                defaultBpm: 70,
                minBpm: 40,
                maxBpm: 140,
                requiredPasses: 3,
            }),
        ],
    },
    {
        id: "switching-keys",
        order: 14,
        theoryKey: "improv.modules.switching-keys.theory",
        exercises: [
            choiceExercise("switching-keys", "e1", "pivot", 10),
            loopExercise("switching-keys", "e2", {
                progression: ["Gmaj7", "Em7", "Am7", "D7", "Bmaj7", "G#m7", "C#m7", "F#7"],
                goalKey: "improv.goals.switchingKeys",
                beatsPerChord: 4,
                defaultBpm: 90,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "tritone-subs",
        order: 15,
        theoryKey: "improv.modules.tritone-subs.theory",
        exercises: [
            choiceExercise("tritone-subs", "e1", "tritone", 10),
            loopExercise("tritone-subs", "e2", {
                progression: ["Dm7", "G7", "Cmaj7"],
                goalKey: "improv.goals.tritoneNormal",
                beatsPerChord: 4,
                defaultBpm: 90,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
                variants: [
                    {
                        id: "normal",
                        labelKey: "improv.goals.variantNormal",
                        progression: ["Dm7", "G7", "Cmaj7"],
                        goalKey: "improv.goals.tritoneNormal",
                    },
                    {
                        id: "subv",
                        labelKey: "improv.goals.variantSubV",
                        progression: ["Dm7", "Ab7", "Cmaj7"],
                        goalKey: "improv.goals.tritoneSubV",
                    },
                ],
            }),
        ],
    },
    {
        id: "secondary-dominants",
        order: 16,
        theoryKey: "improv.modules.secondary-dominants.theory",
        exercises: [
            choiceExercise("secondary-dominants", "e1", "secondaryDom", 10),
            loopExercise("secondary-dominants", "e2", {
                progression: ["Cmaj7", "A7", "Dm7", "G7", "Cmaj7"],
                goalKey: "improv.goals.secondaryDominants",
                beatsPerChord: 4,
                defaultBpm: 90,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "borrowed-chords",
        order: 17,
        theoryKey: "improv.modules.borrowed-chords.theory",
        exercises: [
            choiceExercise("borrowed-chords", "e1", "borrowed", 10),
            loopExercise("borrowed-chords", "e2", {
                progression: ["Cmaj7", "Fm7", "Bb7", "Cmaj7"],
                goalKey: "improv.goals.borrowedBackdoor",
                beatsPerChord: 4,
                defaultBpm: 90,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "melodic-minor",
        order: 18,
        theoryKey: "improv.modules.melodic-minor.theory",
        exercises: [
            drillExercise(
                "melodic-minor",
                "e1",
                [{ shapeId: "melodic-minor", defaultKey: "A", keys: SCALE_KEYS }],
                3,
                7,
                60,
                2,
            ),
            drillExercise(
                "melodic-minor",
                "e2",
                [{ shapeId: "melodic-minor", defaultKey: "C", keys: SCALE_KEYS }],
                7,
                11,
                60,
                2,
            ),
        ],
    },
    {
        id: "chord-scale-melodic",
        order: 19,
        theoryKey: "improv.modules.chord-scale-melodic.theory",
        exercises: [
            choiceExercise("chord-scale-melodic", "e1", "chordScaleMelodic", 10, "chord-to-mode"),
            choiceExercise("chord-scale-melodic", "e2", "chordScaleMelodic", 10, "mode-to-chord"),
        ],
    },
    {
        id: "harmonic-minor",
        order: 20,
        theoryKey: "improv.modules.harmonic-minor.theory",
        exercises: [
            drillExercise(
                "harmonic-minor",
                "e1",
                [{ shapeId: "harmonic-minor", defaultKey: "C", keys: SCALE_KEYS }],
                5,
                9,
                60,
                2,
            ),
            drillExercise(
                "harmonic-minor",
                "e2",
                [{ shapeId: "harmonic-minor", defaultKey: "A", keys: SCALE_KEYS }],
                2,
                6,
                60,
                2,
            ),
        ],
    },
    {
        id: "chord-scale-harmonic",
        order: 21,
        theoryKey: "improv.modules.chord-scale-harmonic.theory",
        exercises: [
            choiceExercise("chord-scale-harmonic", "e1", "chordScaleHarmonic", 10, "chord-to-mode"),
            choiceExercise("chord-scale-harmonic", "e2", "chordScaleHarmonic", 10, "mode-to-chord"),
        ],
    },
    {
        id: "giant-steps",
        order: 22,
        theoryKey: "improv.modules.giant-steps.theory",
        exercises: [
            choiceExercise("giant-steps", "e1", "coltrane", 10),
            loopExercise("giant-steps", "e2", {
                progression: ["Bmaj7", "D7", "Gmaj7", "Bb7", "Ebmaj7", "F#7", "Bmaj7"],
                goalKey: "improv.goals.giantSteps",
                beatsPerChord: 4,
                defaultBpm: 120,
                minBpm: 60,
                maxBpm: 180,
                requiredPasses: 2,
            }),
        ],
    },
];

/** The canonical order as a flat id list (guarded by curriculum.test.ts). */
export const IMPROV_ORDER: string[] = CURRICULUM.map((module) => module.id);

export const IMPROV_MODULE_COUNT = 22;

export function getImprovModule(moduleId: string | undefined): ImprovModule | undefined {
    if (!moduleId) return undefined;
    return CURRICULUM.find((module) => module.id === moduleId);
}

export function getImprovExercise(moduleId: string, exerciseId: string): ImprovExercise | undefined {
    return getImprovModule(moduleId)?.exercises.find((exercise) => exercise.id === exerciseId);
}

/** True when the exercise's own pass threshold is met, given module progress. */
export function isExercisePassed(
    exercise: ImprovExercise,
    progress: { quizBest: number; drillsDone: string[]; exerciseRuns: Record<string, number> } | undefined,
): boolean {
    if (!progress) return false;
    switch (exercise.engine) {
        case "fretboard-quiz":
        case "choice-quiz": {
            const params = exercise.params as FretboardQuizParams | ChoiceQuizParams;
            return progress.quizBest >= params.requiredCorrect;
        }
        case "diagram-drill": {
            const params = exercise.params as DiagramDrillParams;
            return (progress.exerciseRuns[exercise.id] ?? 0) >= params.requiredRuns;
        }
        case "backing-improv": {
            const params = exercise.params as BackingLoopParams;
            return (progress.exerciseRuns[exercise.id] ?? 0) >= params.requiredPasses;
        }
        default:
            return false;
    }
}

/** A module is completed when every one of its exercises is passed. */
export function isModuleComplete(
    module: ImprovModule,
    progress: { quizBest: number; drillsDone: string[]; exerciseRuns: Record<string, number> } | undefined,
): boolean {
    return module.exercises.every((exercise) => isExercisePassed(exercise, progress));
}

/**
 * Sequential unlocking: module is available when it is the first one, when
 * the previous module in IMPROV_ORDER is completed, or when everything is
 * unlocked (`unlockAll`).
 */
export function isModuleUnlocked(
    moduleId: string,
    moduleState: Record<string, { quizBest: number; drillsDone: string[]; exerciseRuns: Record<string, number>; completed: boolean }> | undefined,
    unlockAll: boolean,
): boolean {
    if (unlockAll) return true;
    const index = IMPROV_ORDER.indexOf(moduleId);
    if (index <= 0) return true;
    const previousId = IMPROV_ORDER[index - 1] as string;
    const previousState = moduleState?.[previousId];
    if (!previousState) return false;
    if (previousState.completed) return true;
    const previousModule = getImprovModule(previousId);
    return previousModule ? isModuleComplete(previousModule, previousState) : false;
}

export function countCompletedModules(
    moduleState: Record<string, { quizBest: number; drillsDone: string[]; exerciseRuns: Record<string, number>; completed: boolean }> | undefined,
): number {
    return CURRICULUM.filter((module) => isModuleComplete(module, moduleState?.[module.id])).length;
}

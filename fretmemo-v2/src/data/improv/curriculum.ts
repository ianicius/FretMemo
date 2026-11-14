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
import type { ScaleShapeId } from "@/lib/improv/scaleShapes";
import type { ChoiceGeneratorId } from "@/lib/improv/questions";
import type { PracticeMode, ScaleType } from "@/stores/useGameStore";

/* ─────────── Engine parameter types ─────────── */

export type ImprovEngineType = "choice-quiz" | "diagram-drill" | "backing-improv" | "practice-link";

/** Tonic for shapes/keys: sharp spellings plus the flat keys the curriculum needs. */
export type ImprovKey = NoteName | "Bb" | "Db" | "Eb" | "Gb" | "Ab";

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
}

export interface DiagramDrillParams {
    shapes: DiagramShapeRef[];
    /**
     * Fret window RELATIVE to the tonic's fret on the low E string (plan
     * phase 2): switching keys slides the same shape. Negative offsets are
     * allowed (a box may start below the tonic).
     */
    offsetsFrom: number;
    offsetsTo: number;
    defaultBpm: number;
    /** Full up+down runs required to pass the drill. */
    requiredRuns: number;
}

export interface PracticeLinkParams {
    mode: PracticeMode;
    /** Guitar string indices, 0 = high E … 5 = low E. */
    enabledStrings: number[];
    offsetsFrom: number;
    offsetsTo: number;
    rootNote?: NoteName;
    scaleType?: ScaleType;
    /** Pass criteria (plan phase 2): every position in range has at least
     * `minAnswers` recorded answers with accuracy ≥ `minAccuracy`. */
    minAnswers: number;
    minAccuracy: number;
}

/**
 * One entry of a backing progression (plan phase 3): a plain string is a
 * chord lasting `beatsPerChord`; an object adds an optional i18n hint key
 * (shown under the chord in the prompter) and/or an optional beat count
 * (e.g. Am7 held for four bars in module 3).
 */
export type ProgressionEntry = { chord: string; hintKey?: string; beats?: number };

export interface BackingLoopVariant {
    id: string;
    labelKey: string;
    progression: Array<string | ProgressionEntry>;
    goalKey: string;
}

export interface BackingLoopParams {
    progression: Array<string | ProgressionEntry>;
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

/** Theory tool embedded in the module's theory card (plan phase 2). */
export interface TheoryEmbed {
    tool: "circle-of-fifths" | "scale-explorer" | "chord-library" | "triad-visualizer";
    root?: string;
    scaleType?: string;
}

export type ImprovExerciseParams =
    | ChoiceQuizParams
    | DiagramDrillParams
    | BackingLoopParams
    | PracticeLinkParams;

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
    /** Theory tool embedded below the theory text (plan phase 2). */
    embed?: TheoryEmbed;
    exercises: ImprovExercise[];
    /** Optional extras that do NOT gate module completion (plan: ear-training links). */
    supplementary?: Array<{ labelKey: string; href: string }>;
}

/* ─────────── Shared curriculum helpers ─────────── */

const PENTATONIC_KEYS: ImprovKey[] = ["C", "A", "D", "E", "G"];
const SCALE_KEYS: ImprovKey[] = ["A", "C", "D", "E", "G"];

function practiceLinkExercise(
    moduleId: string,
    suffix: string,
    mode: PracticeMode,
    enabledStrings: number[],
    offsetsFrom: number,
    offsetsTo: number,
    options?: { rootNote?: NoteName; scaleType?: ScaleType },
): ImprovExercise {
    return {
        id: `${moduleId}.${suffix}`,
        engine: "practice-link",
        nameKey: `improv.ex.${moduleId}.${suffix}.name`,
        descKey: `improv.ex.${moduleId}.${suffix}.desc`,
        params: {
            mode,
            enabledStrings,
            offsetsFrom,
            offsetsTo,
            rootNote: options?.rootNote,
            scaleType: options?.scaleType,
            minAnswers: 3,
            minAccuracy: 0.8,
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
    offsetsFrom: number,
    offsetsTo: number,
    defaultBpm: number,
    requiredRuns: number,
): ImprovExercise {
    return {
        id: `${moduleId}.${suffix}`,
        engine: "diagram-drill",
        nameKey: `improv.ex.${moduleId}.${suffix}.name`,
        descKey: `improv.ex.${moduleId}.${suffix}.desc`,
        params: { shapes, offsetsFrom, offsetsTo, defaultBpm, requiredRuns },
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
            practiceLinkExercise("e-string-notes", "e1", "fretboardToNote", [5], 0, 12),
            practiceLinkExercise("e-string-notes", "e2", "noteToTab", [5], 0, 12),
        ],
    },
    {
        id: "key-signatures",
        order: 2,
        theoryKey: "improv.modules.key-signatures.theory",
        embed: { tool: "circle-of-fifths" },
        exercises: [
            choiceExercise("key-signatures", "e1", "keySig", 10, "key-to-count"),
            choiceExercise("key-signatures", "e2", "keySig", 10, "count-to-key"),
        ],
    },
    {
        id: "pentatonic-scale",
        order: 3,
        theoryKey: "improv.modules.pentatonic-scale.theory",
        embed: { tool: "scale-explorer", root: "A", scaleType: "minor pentatonic" },
        supplementary: [{ labelKey: "improv.supplementary.earTraining", href: "/ear-training/intervals" }],
        exercises: [
            drillExercise(
                "pentatonic-scale",
                "e1",
                [{ shapeId: "min-pent", defaultKey: "A", keys: PENTATONIC_KEYS }],
                0,
                3,
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
            practiceLinkExercise("pentatonic-scale", "e3", "playNotes", [0, 1, 2, 3, 4, 5], 5, 8, {
                rootNote: "A",
                scaleType: "minorPentatonic",
            }),
            loopExercise("pentatonic-scale", "e4", {
                progression: [{ chord: "Am7", beats: 16 }, { chord: "Dm7", beats: 4 }, { chord: "Em7", beats: 4 }],
                goalKey: "improv.goals.pentatonicBox1",
                beatsPerChord: 4,
                defaultBpm: 70,
                minBpm: 50,
                maxBpm: 140,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "major-scale",
        order: 4,
        theoryKey: "improv.modules.major-scale.theory",
        embed: { tool: "scale-explorer", root: "C", scaleType: "major" },
        supplementary: [{ labelKey: "improv.supplementary.earTraining", href: "/ear-training/intervals" }],
        exercises: [
            drillExercise(
                "major-scale",
                "e1",
                [{ shapeId: "major", defaultKey: "A", keys: SCALE_KEYS }],
                -3,
                1,
                60,
                2,
            ),
            drillExercise(
                "major-scale",
                "e2",
                [{ shapeId: "major", defaultKey: "C", keys: SCALE_KEYS }],
                -1,
                3,
                60,
                2,
            ),
            practiceLinkExercise("major-scale", "e3", "playNotes", [0, 1, 2, 3, 4, 5], 8, 12, {
                rootNote: "C",
                scaleType: "major",
            }),
            loopExercise("major-scale", "e4", {
                progression: ["Cmaj7", "Am7", "Fmaj7", "G7"],
                goalKey: "improv.goals.majorC",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "fretboard-notes",
        order: 5,
        theoryKey: "improv.modules.fretboard-notes.theory",
        exercises: [
            practiceLinkExercise("fretboard-notes", "e1", "fretboardToNote", [0, 1, 2, 3, 4, 5], 0, 12),
            practiceLinkExercise("fretboard-notes", "e2", "noteToTab", [0, 1, 2, 3, 4, 5], 0, 12),
        ],
    },
    {
        id: "pentatonic-positions",
        order: 6,
        theoryKey: "improv.modules.pentatonic-positions.theory",
        embed: { tool: "scale-explorer", root: "G", scaleType: "minor pentatonic" },
        exercises: [
            // Five boxes of one pentatonic (G minor pent, tonic at fret 3):
            // each window is the next position, named in the video after the
            // degree it starts on (Bb major, C dorian, D phrygian, F mixo).
            drillExercise("pentatonic-positions", "e1", [{ shapeId: "min-pent", defaultKey: "G" }], 0, 3, 70, 1),
            drillExercise("pentatonic-positions", "e2", [{ shapeId: "min-pent", defaultKey: "G" }], 2, 5, 70, 1),
            drillExercise("pentatonic-positions", "e3", [{ shapeId: "min-pent", defaultKey: "G" }], 4, 8, 70, 1),
            drillExercise("pentatonic-positions", "e4", [{ shapeId: "min-pent", defaultKey: "G" }], 7, 10, 70, 1),
            drillExercise("pentatonic-positions", "e5", [{ shapeId: "min-pent", defaultKey: "G" }], 9, 12, 70, 1),
            loopExercise("pentatonic-positions", "e6", {
                progression: ["Gm7", "Cm7"],
                goalKey: "improv.goals.pentatonicBoxes",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "modes",
        order: 7,
        theoryKey: "improv.modules.modes.theory",
        embed: { tool: "scale-explorer", root: "D", scaleType: "dorian" },
        supplementary: [
            { labelKey: "improv.supplementary.earTraining", href: "/ear-training/functional" },
            { labelKey: "improv.supplementary.chordQuality", href: "/ear-training/chord-quality" },
        ],
        exercises: [
            choiceExercise("modes", "e1", "modes", 10, "order-to-mode"),
            choiceExercise("modes", "e2", "modes", 10, "characteristic-to-mode"),
            loopExercise("modes", "e3", {
                progression: ["Dm7", "G7"],
                goalKey: "improv.goals.modeCharacteristic",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
                variants: [
                    { id: "dorian", labelKey: "improv.goals.modeDorian",
                      progression: [{ chord: "Dm7", hintKey: "improv.hints.dorianDm7" }, "G7"],
                      goalKey: "improv.goals.modeCharacteristic" },
                    { id: "phrygian", labelKey: "improv.goals.modePhrygian",
                      progression: [{ chord: "Em7", hintKey: "improv.hints.phrygianEm" }, "Fmaj7"],
                      goalKey: "improv.goals.modeCharacteristic" },
                    { id: "lydian", labelKey: "improv.goals.modeLydian",
                      progression: [{ chord: "Fmaj7", hintKey: "improv.hints.lydianF" }, "G6"],
                      goalKey: "improv.goals.modeCharacteristic" },
                    { id: "mixolydian", labelKey: "improv.goals.modeMixolydian",
                      progression: [{ chord: "G7", hintKey: "improv.hints.mixolydianG" }, "Cmaj7"],
                      goalKey: "improv.goals.modeCharacteristic" },
                ],
            }),
        ],
    },
    {
        id: "chord-construction",
        order: 8,
        theoryKey: "improv.modules.chord-construction.theory",
        embed: { tool: "chord-library" },
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
            loopExercise("chord-scale-major", "e3", {
                progression: [
                    { chord: "Dm7", hintKey: "improv.hints.csDorian" },
                    { chord: "G7", hintKey: "improv.hints.csMixolydian" },
                    { chord: "Cmaj7", hintKey: "improv.hints.csIonian" },
                ],
                goalKey: "improv.goals.chordScaleCharacteristic",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "triads",
        order: 10,
        theoryKey: "improv.modules.triads.theory",
        embed: { tool: "triad-visualizer" },
        supplementary: [{ labelKey: "improv.supplementary.earTraining", href: "/ear-training/chord-quality" }],
        exercises: [
            loopExercise("triads", "e1", {
                progression: ["Am", "C", "Em", "D"],
                goalKey: "improv.goals.triads",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
            choiceExercise("triads", "e2", "triadType", 10, "name-to-intervals"),
        ],
    },
    {
        id: "arpeggios",
        order: 11,
        theoryKey: "improv.modules.arpeggios.theory",
        supplementary: [{ labelKey: "improv.supplementary.earTraining", href: "/ear-training/chord-quality" }],
        exercises: [
            drillExercise(
                "arpeggios",
                "e1",
                [{ shapeId: "m7-arp", defaultKey: "C" }],
                0,
                4,
                70,
                1,
            ),
            drillExercise(
                "arpeggios",
                "e2",
                [{ shapeId: "dom7-arp", defaultKey: "G" }],
                0,
                4,
                70,
                1,
            ),
            loopExercise("arpeggios", "e3", {
                progression: ["Dm7", "G7", "Cmaj7"],
                goalKey: "improv.goals.arpeggiosOnly",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "target-chord-tones",
        order: 12,
        theoryKey: "improv.modules.target-chord-tones.theory",
        exercises: [
            loopExercise("target-chord-tones", "e1", {
                progression: ["Am", "C", "Em", "D"],
                goalKey: "improv.goals.targetRoot",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
                variants: [
                    { id: "root", labelKey: "improv.goals.targetRootLabel",
                      progression: ["Am", "C", "Em", "D"], goalKey: "improv.goals.targetRoot" },
                    { id: "third", labelKey: "improv.goals.targetThirdLabel",
                      progression: ["Am", "C", "Em", "D"], goalKey: "improv.goals.targetThird" },
                    { id: "fifth", labelKey: "improv.goals.targetFifthLabel",
                      progression: ["Am", "C", "Em", "D"], goalKey: "improv.goals.targetFifth" },
                    { id: "seventh", labelKey: "improv.goals.targetSeventhLabel",
                      progression: ["Am7", "Cmaj7", "Em7", "D7"], goalKey: "improv.goals.targetSeventh" },
                ],
            }),
            loopExercise("target-chord-tones", "e2", {
                progression: ["Am", "C", "Em", "D"],
                goalKey: "improv.goals.targetAny",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "voice-leading",
        order: 13,
        theoryKey: "improv.modules.voice-leading.theory",
        exercises: [
            loopExercise("voice-leading", "e1", {
                progression: ["Gm", { chord: "Bbm", hintKey: "improv.hints.videoDb" }],
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
            loopExercise("voice-leading", "e3", {
                progression: ["Dm7", "G7", "Cmaj7"],
                goalKey: "improv.goals.voiceLeadingThirdsSevenths",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
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
                progression: [
                    { chord: "Cmaj7", hintKey: "improv.hints.keyC" },
                    { chord: "Am7", hintKey: "improv.hints.keyC" },
                    { chord: "Dm7", hintKey: "improv.hints.keyC" },
                    { chord: "G7", hintKey: "improv.hints.keyC" },
                    { chord: "Fmaj7", hintKey: "improv.hints.keyF" },
                    { chord: "Dm7", hintKey: "improv.hints.keyF" },
                    { chord: "Gm7", hintKey: "improv.hints.keyF" },
                    { chord: "C7", hintKey: "improv.hints.keyF" },
                ],
                goalKey: "improv.goals.switchingKeysEasy",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
            loopExercise("switching-keys", "e3", {
                progression: [
                    { chord: "Gmaj7", hintKey: "improv.hints.keyG" },
                    { chord: "Em7", hintKey: "improv.hints.keyG" },
                    { chord: "Am7", hintKey: "improv.hints.keyG" },
                    { chord: "D7", hintKey: "improv.hints.keyG" },
                    { chord: "Bmaj7", hintKey: "improv.hints.keyB" },
                    { chord: "G#m7", hintKey: "improv.hints.keyB" },
                    { chord: "C#m7", hintKey: "improv.hints.keyB" },
                    { chord: "F#7", hintKey: "improv.hints.keyB" },
                ],
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
                        progression: ["Dm7", "Db7", "Cmaj7"],
                        goalKey: "improv.goals.tritoneSubV",
                    },
                    {
                        id: "video",
                        labelKey: "improv.goals.variantVideo",
                        progression: ["Bm7", "Bb7", "Am7", "Ab7", "Gmaj7"],
                        goalKey: "improv.goals.tritoneVideo",
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
                variants: [
                    { id: "classic", labelKey: "improv.goals.secondaryClassic",
                      progression: ["Cmaj7", "A7", "Dm7", "G7", "Cmaj7"],
                      goalKey: "improv.goals.secondaryDominants" },
                    { id: "five-dominants", labelKey: "improv.goals.secondaryFiveLabel",
                      progression: ["Cmaj7", "E7", "Am7", "C7", "Fmaj7", "D7", "G7"],
                      goalKey: "improv.goals.secondaryDominants" },
                ],
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
                variants: [
                    { id: "diatonic-251", labelKey: "improv.goals.variantDiatonic251",
                      progression: ["Dm7", "G7", "Cmaj7"],
                      goalKey: "improv.goals.borrowedDiatonic" },
                    { id: "backdoor-251", labelKey: "improv.goals.variantBackdoor251",
                      progression: ["Fm7", "Bb7", "Cmaj7"],
                      goalKey: "improv.goals.borrowedBackdoor" },
                ],
            }),
        ],
    },
    {
        id: "melodic-minor",
        order: 18,
        theoryKey: "improv.modules.melodic-minor.theory",
        embed: { tool: "scale-explorer", root: "A", scaleType: "melodic minor" },
        supplementary: [{ labelKey: "improv.supplementary.earTraining", href: "/ear-training/intervals" }],
        exercises: [
            drillExercise(
                "melodic-minor",
                "e1",
                [{ shapeId: "melodic-minor", defaultKey: "A", keys: SCALE_KEYS }],
                -2,
                2,
                60,
                2,
            ),
            drillExercise(
                "melodic-minor",
                "e2",
                [{ shapeId: "melodic-minor", defaultKey: "C", keys: SCALE_KEYS }],
                -1,
                3,
                60,
                2,
            ),
            practiceLinkExercise("melodic-minor", "e3", "playNotes", [0, 1, 2, 3, 4, 5], 5, 9, {
                rootNote: "A",
                scaleType: "melodicMinor",
            }),
            loopExercise("melodic-minor", "e4", {
                progression: ["Am6", "Ammaj7"],
                goalKey: "improv.goals.melodicMinor67",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "chord-scale-melodic",
        order: 19,
        theoryKey: "improv.modules.chord-scale-melodic.theory",
        exercises: [
            choiceExercise("chord-scale-melodic", "e1", "chordScaleMelodic", 10, "chord-to-mode"),
            choiceExercise("chord-scale-melodic", "e2", "chordScaleMelodic", 10, "mode-to-chord"),
            loopExercise("chord-scale-melodic", "e3", {
                progression: [
                    { chord: "Dm7b5", hintKey: "improv.hints.mmLocrian2" },
                    { chord: "G7alt", hintKey: "improv.hints.mmAb" },
                    { chord: "Cmmaj7", hintKey: "improv.hints.mmC" },
                ],
                goalKey: "improv.goals.melodicMinorHints",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
                variants: [
                    { id: "minor-251", labelKey: "improv.goals.mmMinor251",
                      progression: [
                          { chord: "Dm7b5", hintKey: "improv.hints.mmLocrian2" },
                          { chord: "G7alt", hintKey: "improv.hints.mmAb" },
                          { chord: "Cmmaj7", hintKey: "improv.hints.mmC" },
                      ],
                      goalKey: "improv.goals.melodicMinorHints" },
                    { id: "d7-11-vamp", labelKey: "improv.goals.mmD711",
                      progression: [{ chord: "D7#11", hintKey: "improv.hints.mmDLydDom" }],
                      goalKey: "improv.goals.melodicMinorHints" },
                ],
            }),
        ],
    },
    {
        id: "harmonic-minor",
        order: 20,
        theoryKey: "improv.modules.harmonic-minor.theory",
        embed: { tool: "scale-explorer", root: "C", scaleType: "harmonic minor" },
        supplementary: [{ labelKey: "improv.supplementary.earTraining", href: "/ear-training/intervals" }],
        exercises: [
            drillExercise(
                "harmonic-minor",
                "e1",
                [{ shapeId: "harmonic-minor", defaultKey: "C", keys: SCALE_KEYS }],
                -3,
                1,
                60,
                2,
            ),
            drillExercise(
                "harmonic-minor",
                "e2",
                [{ shapeId: "harmonic-minor", defaultKey: "A", keys: SCALE_KEYS }],
                -3,
                1,
                60,
                2,
            ),
            practiceLinkExercise("harmonic-minor", "e3", "playNotes", [0, 1, 2, 3, 4, 5], 5, 9, {
                rootNote: "C",
                scaleType: "harmonicMinor",
            }),
            loopExercise("harmonic-minor", "e4", {
                progression: [
                    { chord: "Am", hintKey: "improv.hints.hmA" },
                    { chord: "E7", hintKey: "improv.hints.hmE7" },
                ],
                goalKey: "improv.goals.harmonicMinorGSharp",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "chord-scale-harmonic",
        order: 21,
        theoryKey: "improv.modules.chord-scale-harmonic.theory",
        exercises: [
            choiceExercise("chord-scale-harmonic", "e1", "chordScaleHarmonic", 10, "chord-to-mode"),
            choiceExercise("chord-scale-harmonic", "e2", "chordScaleHarmonic", 10, "mode-to-chord"),
            loopExercise("chord-scale-harmonic", "e3", {
                progression: [
                    { chord: "Bm7b5", hintKey: "improv.hints.hmLocrian" },
                    { chord: "E7", hintKey: "improv.hints.hmPhrygianDom" },
                    { chord: "Am", hintKey: "improv.hints.hmA" },
                ],
                goalKey: "improv.goals.harmonicMinorPhrygian",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
        ],
    },
    {
        id: "giant-steps",
        order: 22,
        theoryKey: "improv.modules.giant-steps.theory",
        exercises: [
            choiceExercise("giant-steps", "e1", "coltrane", 10),
            loopExercise("giant-steps", "e2", {
                progression: [
                    "Bmaj7", "D7", "Gmaj7", "Bb7", "Ebmaj7", "F#7", "Bmaj7", "Bmaj7",
                    "Bm7", "D7", "Gmaj7", "Bb7", "Ebmaj7", "F#7", "Bmaj7", "Bmaj7",
                ],
                goalKey: "improv.goals.giantStepsRoots",
                beatsPerChord: 2,
                defaultBpm: 60,
                minBpm: 40,
                maxBpm: 180,
                requiredPasses: 2,
                variants: [
                    { id: "roots", labelKey: "improv.goals.giantStepsRootsLabel",
                      progression: [
                          "Bmaj7", "D7", "Gmaj7", "Bb7", "Ebmaj7", "F#7", "Bmaj7", "Bmaj7",
                          "Bm7", "D7", "Gmaj7", "Bb7", "Ebmaj7", "F#7", "Bmaj7", "Bmaj7",
                      ],
                      goalKey: "improv.goals.giantStepsRoots" },
                    { id: "pattern-1235", labelKey: "improv.goals.giantStepsPatternLabel",
                      progression: [
                          "Bmaj7", "D7", "Gmaj7", "Bb7", "Ebmaj7", "F#7", "Bmaj7", "Bmaj7",
                          "Bm7", "D7", "Gmaj7", "Bb7", "Ebmaj7", "F#7", "Bmaj7", "Bmaj7",
                      ],
                      goalKey: "improv.goals.giantStepsPattern" },
                    { id: "arps", labelKey: "improv.goals.giantStepsArpsLabel",
                      progression: [
                          "Bmaj7", "D7", "Gmaj7", "Bb7", "Ebmaj7", "F#7", "Bmaj7", "Bmaj7",
                          "Bm7", "D7", "Gmaj7", "Bb7", "Ebmaj7", "F#7", "Bmaj7", "Bmaj7",
                      ],
                      goalKey: "improv.goals.giantStepsArps" },
                ],
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

/**
 * A quiz exercise counts as passed only after this many attempts that met
 * `requiredCorrect` (plan 1.3: one lucky run must not lock the exercise in).
 */
export const QUIZ_PASSED_ATTEMPTS = 2;

/** Progress shape shared by the store and the pass predicates. */
export interface ImprovProgressShape {
    exerciseRuns: Record<string, number>;
}

/** True when the exercise's own pass threshold is met, given module progress. */
export function isExercisePassed(
    exercise: ImprovExercise,
    progress: ImprovProgressShape | undefined,
): boolean {
    if (!progress) return false;
    switch (exercise.engine) {
        case "choice-quiz": {
            // exerciseRuns holds the number of PASSED attempts (plan 1.1/1.3).
            return (progress.exerciseRuns[exercise.id] ?? 0) >= QUIZ_PASSED_ATTEMPTS;
        }
        case "diagram-drill": {
            const params = exercise.params as DiagramDrillParams;
            return (progress.exerciseRuns[exercise.id] ?? 0) >= params.requiredRuns;
        }
        case "backing-improv": {
            const params = exercise.params as BackingLoopParams;
            return (progress.exerciseRuns[exercise.id] ?? 0) >= params.requiredPasses;
        }
        case "practice-link": {
            // Recorded once the useProgressStore criteria are met (plan phase 2).
            return (progress.exerciseRuns[exercise.id] ?? 0) >= 1;
        }
        default:
            return false;
    }
}

/** A module is completed when every one of its exercises is passed. */
export function isModuleComplete(
    module: ImprovModule,
    progress: ImprovProgressShape | undefined,
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
    moduleState: Record<string, ImprovProgressShape & { completed: boolean }> | undefined,
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
    moduleState: Record<string, ImprovProgressShape & { completed: boolean }> | undefined,
): number {
    return CURRICULUM.filter((module) => isModuleComplete(module, moduleState?.[module.id])).length;
}

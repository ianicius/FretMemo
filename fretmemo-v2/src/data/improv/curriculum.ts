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

export type ImprovEngineType = "choice-quiz" | "diagram-drill" | "backing-improv" | "practice-link" | "lick";

/** Tonic for shapes/keys: sharp spellings plus the flat keys the curriculum needs. */
export type ImprovKey = NoteName | "Bb" | "Db" | "Eb" | "Gb" | "Ab";

export interface ChoiceQuizParams {
    /** "mixed" (plan phase 6) draws a generator per question — used by the
     * review and placement quizzes, optionally restricted by
     * `allowedGenerators`. */
    generatorId: ChoiceGeneratorId | "mixed";
    allowedGenerators?: ChoiceGeneratorId[];
    /** "mixed" only: one question per allowed generator, in order. */
    sequential?: boolean;
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
    /** Plan C2/C3: view switch on a minor-pentatonic diagram (blues, hexatonic, bend notes). */
    pentatonicViews?: boolean;
    /** Plan C7: colour a mode as "pentatonic + two added notes". */
    pentatonicFill?: boolean;
    /** Extra practice that never gates module completion. */
    nonGating?: boolean;
    /** Plan C6: show the shape on this string only (0 = high E). */
    onlyString?: number;
    /** Plan C5: wide window with the repeating stack highlighted. */
    diagonal?: boolean;
    /** Plan C4: "build the box from a root" — rendered by BuildScaleDrill. */
    buildStarts?: BuildStart[];
}

/** One starting point of the build drill: a root, the finger on it and the box it leads to. */
export interface BuildStart {
    /** 0 = high E … 5 = low E. */
    stringIndex: number;
    fret: number;
    finger: "index" | "ring" | "pinky";
    /** Box window relative to the tonic anchor, as in `DiagramDrillParams`. */
    offsetsFrom: number;
    offsetsTo: number;
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
    /** Plan phase 5 fix: playNotes sessions never record positionStats, so
     * playNotes-based links are EXTRA practice — they never gate module
     * completion (unlike fretboardToNote/noteToTab links in modules 1/5). */
    nonGating?: boolean;
}

/**
 * One entry of a backing progression (plan phase 3): a plain string is a
 * chord lasting `beatsPerChord`; an object adds an optional i18n hint key
 * (shown under the chord in the prompter) and/or an optional beat count
 * (e.g. Am7 held for four bars in module 3).
 */
export type ProgressionEntry = { chord: string; hintKey?: string; beats?: number };

/** Mic-verification targets (plan phase 4): for each chord (matched by
 * symbol), pitch classes the player may hit in the first-beat window. */
export interface ChordMicTargets {
    chord: string;
    pitchClasses: string[];
}

export interface BackingLoopVariant {
    id: string;
    labelKey: string;
    progression: Array<string | ProgressionEntry>;
    goalKey: string;
    targets?: ChordMicTargets[];
    /** Key of the variant for the transposition selector (B2); see `BackingLoopParams.key`. */
    key?: string;
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
    /** Optional mic-verification targets (plan phase 4). */
    targets?: ChordMicTargets[];
    /**
     * Key the loop is written in ("C", "Am") — the origin of the transposition
     * selector (plan B2). Omitted = root of the first chord (+ "m" for a minor chord).
     */
    key?: string;
    /** Extra practice that never gates module completion (plan rule 3; B4 variants). */
    nonGating?: boolean;
}

/** Theory tool embedded in the module's theory card (plan phase 2). */
export interface TheoryEmbed {
    tool: "circle-of-fifths" | "scale-explorer" | "chord-library" | "triad-visualizer" | "caged";
    root?: string;
    scaleType?: string;
}

export type ImprovExerciseParams =
    | ChoiceQuizParams
    | DiagramDrillParams
    | BackingLoopParams
    | PracticeLinkParams
    | LickParams;

/** Plan D2: licks from `licks.ts`; each one needs `requiredRuns` "played it" marks. Extra practice. */
export interface LickParams {
    lickIds: string[];
    requiredRuns: number;
    nonGating: true;
}

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

/** Plan D3: a loop whose prompter says in which bar to play a lick and where to answer it. */
function lickLoop(goal: string, progression: ProgressionEntry[]): BackingLoopParams {
    return { ...EXTRA_LOOP, progression, goalKey: `improv.goals.${goal}` };
}

function lickExercise(moduleId: string, lickIds: string[]): ImprovExercise {
    return {
        id: `${moduleId}.licks`,
        engine: "lick",
        nameKey: `improv.ex.${moduleId}.licks.name`,
        descKey: `improv.ex.${moduleId}.licks.desc`,
        params: { lickIds, requiredRuns: 3, nonGating: true },
    };
}

function practiceLinkExercise(
    moduleId: string,
    suffix: string,
    mode: PracticeMode,
    enabledStrings: number[],
    offsetsFrom: number,
    offsetsTo: number,
    options?: { rootNote?: NoteName; scaleType?: ScaleType; nonGating?: boolean },
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
            nonGating: options?.nonGating,
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
    extra?: Partial<DiagramDrillParams>,
): ImprovExercise {
    return {
        id: `${moduleId}.${suffix}`,
        engine: "diagram-drill",
        nameKey: `improv.ex.${moduleId}.${suffix}.name`,
        descKey: `improv.ex.${moduleId}.${suffix}.desc`,
        params: { shapes, offsetsFrom, offsetsTo, defaultBpm, requiredRuns, ...extra },
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

/**
 * Plan C4: six roots G on the G, B and high E strings. The finger placed on
 * the root decides the box: index finger = the box runs up the neck, ring
 * finger or pinky = down. Together they rebuild the five boxes of module 6.
 */
export const BUILD_STARTS: BuildStart[] = [
    { stringIndex: 0, fret: 3, finger: "index", offsetsFrom: 0, offsetsTo: 3 },
    { stringIndex: 1, fret: 8, finger: "pinky", offsetsFrom: 2, offsetsTo: 5 },
    { stringIndex: 1, fret: 8, finger: "index", offsetsFrom: 4, offsetsTo: 8 },
    { stringIndex: 2, fret: 12, finger: "ring", offsetsFrom: 7, offsetsTo: 10 },
    { stringIndex: 2, fret: 12, finger: "index", offsetsFrom: 9, offsetsTo: 12 },
    { stringIndex: 0, fret: 15, finger: "pinky", offsetsFrom: 9, offsetsTo: 12 },
];

/** Shared tempo settings of the stage D extra loops. */
const EXTRA_LOOP = { beatsPerChord: 4, defaultBpm: 80, minBpm: 50, maxBpm: 160, requiredPasses: 2, nonGating: true } as const;

/** One goal per variant over the same progression. */
function goalVariants(progression: Array<string | ProgressionEntry>, ids: string[], targets?: ChordMicTargets[]): BackingLoopVariant[] {
    return ids.map((id) => ({ id, labelKey: `improv.goals.${id}Label`, progression, goalKey: `improv.goals.${id}`, targets }));
}

/**
 * Plan D6: a 12-bar blues played with the minor pentatonic, the major one,
 * and both in turn (major over the I chord, minor over IV and V).
 */
function bluesPentatonicLoop(one: string, four: string, five: string): BackingLoopParams {
    const form = [one, one, one, one, four, four, one, one, five, four, one, one];
    const mixed = form.map((chord) => ({ chord, hintKey: chord === one ? "improv.hints.bluesMajorPent" : "improv.hints.bluesMinorPent" }));
    return {
        ...EXTRA_LOOP,
        progression: form,
        goalKey: "improv.goals.bluesMinorPent",
        variants: [
            ...goalVariants(form, ["bluesMinorPent", "bluesMajorPent"]),
            ...goalVariants(mixed, ["bluesMixedPent"]),
        ],
    };
}

/** Plan D8: one root in the bass, a different mode per variant. */
const PEDAL_MODES: Array<{ id: string; chord: string; key: string }> = [
    { id: "Dorian", chord: "Dm7", key: "Dm" },
    { id: "Aeolian", chord: "Dm7", key: "Dm" },
    { id: "Phrygian", chord: "Dm7", key: "Dm" },
    { id: "Mixolydian", chord: "D7", key: "D" },
    { id: "Lydian", chord: "Dmaj7", key: "D" },
];

/** Per-bar hints of the phrasing variants (plan B4), one bar per chord. */
const PLAY_REST_HINTS = ["improv.hints.barPlay", "improv.hints.barRest", "improv.hints.barPlay", "improv.hints.barRest"];
const CALL_RESPONSE_HINTS = ["improv.hints.barQuestion1", "improv.hints.barQuestion2", "improv.hints.barAnswer1", "improv.hints.barAnswer2"];

/**
 * Phrasing loop (plan B4): the same four bars as "play a bar / rest a bar"
 * and as a 2+2-bar question–answer, cued by per-chord hints. Non-gating
 * extra practice (plan rule 3) so the modules do not get harder to pass.
 */
function phraseLoop(chords: [string, string, string, string]): BackingLoopParams {
    const withHints = (hints: string[]): ProgressionEntry[] =>
        chords.map((chord, index) => ({ chord, hintKey: hints[index] }));
    return {
        progression: withHints(PLAY_REST_HINTS),
        goalKey: "improv.goals.playRest",
        beatsPerChord: 4,
        defaultBpm: 80,
        minBpm: 50,
        maxBpm: 160,
        requiredPasses: 2,
        nonGating: true,
        variants: [
            { id: "play-rest", labelKey: "improv.goals.playRestLabel",
              progression: withHints(PLAY_REST_HINTS), goalKey: "improv.goals.playRest" },
            { id: "call-response", labelKey: "improv.goals.callResponseLabel",
              progression: withHints(CALL_RESPONSE_HINTS), goalKey: "improv.goals.callResponse" },
        ],
    };
}

/** "Giant Steps" changes, 16 bars of 4/4 (two beats for split bars). */
const GIANT_STEPS_FORM: ProgressionEntry[] = (
    [
        ["Bmaj7", 2], ["D7", 2], ["Gmaj7", 2], ["Bb7", 2], ["Ebmaj7", 4], ["Am7", 2], ["D7", 2],
        ["Gmaj7", 2], ["Bb7", 2], ["Ebmaj7", 2], ["F#7", 2], ["Bmaj7", 4], ["Fm7", 2], ["Bb7", 2],
        ["Ebmaj7", 4], ["Am7", 2], ["D7", 2], ["Gmaj7", 4], ["C#m7", 2], ["F#7", 2],
        ["Bmaj7", 4], ["Fm7", 2], ["Bb7", 2], ["Ebmaj7", 4], ["C#m7", 2], ["F#7", 2],
    ] as Array<[string, number]>
).map(([chord, beats]) => ({ chord, beats }));

/** Chords of the form: [symbol, root, chord tones] for the mic levels. */
const GIANT_STEPS_CHORDS: Array<[string, string, string[]]> = [
    ["Bmaj7", "B", ["B", "D#", "F#", "A#"]],
    ["D7", "D", ["D", "F#", "A", "C"]],
    ["Gmaj7", "G", ["G", "B", "D", "F#"]],
    ["Bb7", "Bb", ["Bb", "D", "F", "Ab"]],
    ["Ebmaj7", "Eb", ["Eb", "G", "Bb", "D"]],
    ["F#7", "F#", ["F#", "A#", "C#", "E"]],
    ["Am7", "A", ["A", "C", "E", "G"]],
    ["Fm7", "F", ["F", "Ab", "C", "Eb"]],
    ["C#m7", "C#", ["C#", "E", "G#", "B"]],
];

/* ─────────── The 22 modules (canonical order — do not touch) ─────────── */

export const CURRICULUM: ImprovModule[] = [
    {
        id: "e-string-notes",
        order: 1,
        theoryKey: "improv.modules.e-string-notes.theory",
        exercises: [
            practiceLinkExercise("e-string-notes", "e1", "fretboardToNote", [5], 0, 12),
            practiceLinkExercise("e-string-notes", "e2", "noteToTab", [5], 0, 12, { nonGating: true }),
        ],
    },
    {
        id: "key-signatures",
        order: 2,
        theoryKey: "improv.modules.key-signatures.theory",
        embed: { tool: "circle-of-fifths" },
        exercises: [
            choiceExercise("key-signatures", "e1", "keySig", 10),
            choiceExercise("key-signatures", "e2", "keySig", 10, "note-in-key"),
        ],
    },
    {
        id: "pentatonic-scale",
        order: 3,
        theoryKey: "improv.modules.pentatonic-scale.theory",
        embed: { tool: "scale-explorer", root: "A", scaleType: "minor pentatonic" },
        supplementary: [
            { labelKey: "improv.supplementary.earTraining", href: "/ear-training/intervals" },
            // Plan D5: the rhythm constraint points at the rhythm trainer.
            { labelKey: "improv.supplementary.rhythm", href: "/rhythm/tap-beat" },
        ],
        exercises: [
            drillExercise(
                "pentatonic-scale",
                "e1",
                [{ shapeId: "min-pent", defaultKey: "A", keys: PENTATONIC_KEYS }],
                0,
                3,
                70,
                2,
                { pentatonicViews: true },
            ),
            drillExercise(
                "pentatonic-scale",
                "e2",
                [{ shapeId: "min-pent", defaultKey: "A", keys: PENTATONIC_KEYS }],
                2,
                5,
                70,
                2,
                { pentatonicViews: true },
            ),
            practiceLinkExercise("pentatonic-scale", "e3", "playNotes", [0, 1, 2, 3, 4, 5], 5, 8, {
                rootNote: "A",
                scaleType: "minorPentatonic",
            nonGating: true,
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
            loopExercise("pentatonic-scale", "e5", {
                progression: ["A7", "A7", "A7", "A7", "D7", "D7", "A7", "A7", "E7", "D7", "A7", "A7"],
                goalKey: "improv.goals.bluesBox1",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
            loopExercise("pentatonic-scale", "e6", phraseLoop(["Am7", "Am7", "Dm7", "Em7"])),
            // Plan D5: constraints move the attention from note choice to rhythm and phrasing.
            loopExercise("pentatonic-scale", "e7", {
                ...EXTRA_LOOP,
                progression: ["Am7", "Am7", "Dm7", "Em7"],
                goalKey: "improv.goals.limitThreeNotes",
                variants: goalVariants(["Am7", "Am7", "Dm7", "Em7"], ["limitThreeNotes", "limitOneString", "limitRhythm"]),
            }),
            // Plan D6.
            loopExercise("pentatonic-scale", "e8", bluesPentatonicLoop("A7", "D7", "E7")),
            lickExercise("pentatonic-scale", ["pent3Descent", "pent3Answer", "pent3Blue"]),
            loopExercise("pentatonic-scale", "e9", lickLoop("lickLoop3", [
                { chord: "Am7", hintKey: "improv.hints.lickPent3Descent" },
                { chord: "Am7", hintKey: "improv.hints.lickOwn" },
                { chord: "Dm7", hintKey: "improv.hints.lickPent3Blue" },
                { chord: "Em7", hintKey: "improv.hints.lickOwn" },
            ])),
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
            nonGating: true,
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
            practiceLinkExercise("fretboard-notes", "e2", "noteToTab", [0, 1, 2, 3, 4, 5], 0, 12, { nonGating: true }),
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
            // Plan D6: the same blues in G, to be played across the boxes.
            loopExercise("pentatonic-positions", "e10", bluesPentatonicLoop("G7", "C7", "D7")),
            // Plan C4–C6: extras (non-gating), so a module passed before them stays passed.
            drillExercise("pentatonic-positions", "e9", [{ shapeId: "min-pent", defaultKey: "G" }], 0, 12, 70, 6, { buildStarts: BUILD_STARTS, nonGating: true }),
            drillExercise("pentatonic-positions", "e7", [{ shapeId: "min-pent", defaultKey: "G" }], 0, 8, 70, 1, { diagonal: true, nonGating: true }),
            drillExercise("pentatonic-positions", "e8", [{ shapeId: "min-pent", defaultKey: "G" }], -3, 9, 70, 1, { onlyString: 2, nonGating: true }),
            lickExercise("pentatonic-positions", ["pos6Climb", "pos6Slide"]),
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
            choiceExercise("modes", "e1", "modes", 10),
            choiceExercise("modes", "e2", "modes", 10, "tap-characteristic"),
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
                      progression: [{ chord: "G7", hintKey: "improv.hints.mixolydianG" }, { chord: "F", hintKey: "improv.hints.mixolydianF" }],
                      goalKey: "improv.goals.modeCharacteristic" },
                ],
            }),
            // Plan C7: each mode as a pentatonic from the same root plus two notes.
            // Extra (non-gating), so modules completed before it stay completed.
            drillExercise(
                "modes",
                "e4",
                [
                    { shapeId: "dorian", defaultKey: "A" },
                    { shapeId: "aeolian", defaultKey: "A" },
                    { shapeId: "phrygian", defaultKey: "A" },
                    { shapeId: "lydian", defaultKey: "C" },
                    { shapeId: "major", defaultKey: "C" },
                    { shapeId: "mixolydian", defaultKey: "C" },
                ],
                -1,
                3,
                70,
                1,
                { pentatonicFill: true, nonGating: true },
            ),
            // Plan D8: a mode is heard only against a fixed root.
            loopExercise("modes", "e6", {
                ...EXTRA_LOOP,
                progression: [{ chord: "Dm7", beats: 16, hintKey: "improv.hints.pedalDorian" }],
                goalKey: "improv.goals.pedalModes",
                variants: PEDAL_MODES.map((mode) => ({
                    id: mode.id.toLowerCase(),
                    labelKey: `improv.term.${mode.id}`,
                    progression: [{ chord: mode.chord, beats: 16, hintKey: `improv.hints.pedal${mode.id}` }],
                    goalKey: "improv.goals.pedalModes",
                    key: mode.key,
                })),
            }),
            // Plan C8: the same chord first with the pentatonic, then with the mode.
            loopExercise("modes", "e5", {
                progression: [
                    { chord: "Dm7", beats: 16, hintKey: "improv.hints.pentOnly" },
                    { chord: "Dm7", beats: 16, hintKey: "improv.hints.dorianFill" },
                ],
                goalKey: "improv.goals.pentThenMode",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
                nonGating: true,
            }),
        ],
    },
    {
        id: "chord-construction",
        order: 8,
        theoryKey: "improv.modules.chord-construction.theory",
        embed: { tool: "chord-library" },
        exercises: [
            choiceExercise("chord-construction", "e1", "triadBuild", 10),
            choiceExercise("chord-construction", "e2", "triadBuild", 10, "tap-chord-tone"),
        ],
    },
    {
        id: "chord-scale-major",
        order: 9,
        theoryKey: "improv.modules.chord-scale-major.theory",
        exercises: [
            choiceExercise("chord-scale-major", "e1", "chordScaleMajor", 10, "chord-to-mode"),
            choiceExercise("chord-scale-major", "e2", "chordScaleMajor", 10, "tap-characteristic"),
            loopExercise("chord-scale-major", "e3", {
                progression: [
                    { chord: "Dm7", hintKey: "improv.hints.csDorian" },
                    { chord: "G7", hintKey: "improv.hints.csMixolydian" },
                    { chord: "Cmaj7", hintKey: "improv.hints.csIonian" },
                ],
                goalKey: "improv.goals.chordScaleCharacteristic",
                key: "C",
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
        supplementary: [
            { labelKey: "improv.supplementary.earTraining", href: "/ear-training/chord-quality" },
            { labelKey: "improv.supplementary.caged", href: "/theory/caged" },
        ],
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
        // Plan C9: arpeggios sit inside the CAGED chord shapes.
        embed: { tool: "caged" },
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
            // Plan A5: the ii–V–I loop below needs the maj7 arpeggio; m7b5 is the
            // vii chord of C (and the ii of the minor ii–V).
            drillExercise(
                "arpeggios",
                "e4",
                [{ shapeId: "maj7-arp", defaultKey: "C" }],
                -1,
                3,
                70,
                1,
            ),
            drillExercise(
                "arpeggios",
                "e5",
                [{ shapeId: "m7b5-arp", defaultKey: "B" }],
                0,
                4,
                70,
                1,
            ),
            loopExercise("arpeggios", "e3", {
                progression: ["Dm7", "G7", "Cmaj7"],
                goalKey: "improv.goals.arpeggiosOnly",
                key: "C",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
            }),
            lickExercise("arpeggios", ["arp11Am7", "arp11Cmaj7", "arp11TwoFiveOne"]),
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
                      progression: ["Am", "C", "Em", "D"], goalKey: "improv.goals.targetRoot",
                      targets: [
                          { chord: "Am", pitchClasses: ["A"] },
                          { chord: "C", pitchClasses: ["C"] },
                          { chord: "Em", pitchClasses: ["E"] },
                          { chord: "D", pitchClasses: ["D"] },
                      ] },
                    { id: "third", labelKey: "improv.goals.targetThirdLabel",
                      progression: ["Am", "C", "Em", "D"], goalKey: "improv.goals.targetThird",
                      targets: [
                          { chord: "Am", pitchClasses: ["C"] },
                          { chord: "C", pitchClasses: ["E"] },
                          { chord: "Em", pitchClasses: ["G"] },
                          { chord: "D", pitchClasses: ["F#"] },
                      ] },
                    { id: "fifth", labelKey: "improv.goals.targetFifthLabel",
                      progression: ["Am", "C", "Em", "D"], goalKey: "improv.goals.targetFifth",
                      targets: [
                          { chord: "Am", pitchClasses: ["E"] },
                          { chord: "C", pitchClasses: ["G"] },
                          { chord: "Em", pitchClasses: ["B"] },
                          { chord: "D", pitchClasses: ["A"] },
                      ] },
                    { id: "seventh", labelKey: "improv.goals.targetSeventhLabel",
                      progression: ["Am7", "Cmaj7", "Em7", "D7"], goalKey: "improv.goals.targetSeventh",
                      targets: [
                          { chord: "Am7", pitchClasses: ["G"] },
                          { chord: "Cmaj7", pitchClasses: ["B"] },
                          { chord: "Em7", pitchClasses: ["D"] },
                          { chord: "D7", pitchClasses: ["C"] },
                      ] },
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
            loopExercise("target-chord-tones", "e3", {
                progression: ["A7", "A7", "A7", "A7", "D7", "D7", "A7", "A7", "E7", "D7", "A7", "A7"],
                goalKey: "improv.goals.bluesChordTones",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
                targets: [
                    { chord: "A7", pitchClasses: ["A", "C#", "E", "G"] },
                    { chord: "D7", pitchClasses: ["D", "F#", "A", "C"] },
                    { chord: "E7", pitchClasses: ["E", "G#", "B", "D"] },
                ],
            }),
            loopExercise("target-chord-tones", "e4", phraseLoop(["Am", "C", "Em", "D"])),
            // Plan D4: two more rungs of the ladder — approach notes; the mic still checks the landing.
            loopExercise("target-chord-tones", "e5", {
                ...EXTRA_LOOP,
                progression: ["Am", "C", "Em", "D"],
                goalKey: "improv.goals.approachBelow",
                variants: goalVariants(["Am", "C", "Em", "D"], ["approachBelow", "approachEnclosure"], [
                    { chord: "Am", pitchClasses: ["A"] },
                    { chord: "C", pitchClasses: ["C"] },
                    { chord: "Em", pitchClasses: ["E"] },
                    { chord: "D", pitchClasses: ["D"] },
                ]),
            }),
            lickExercise("target-chord-tones", ["tgt12Am", "tgt12C"]),
            loopExercise("target-chord-tones", "e6", lickLoop("lickLoop12", [
                { chord: "Am", hintKey: "improv.hints.lickTgt12Am" },
                { chord: "C", hintKey: "improv.hints.lickTgt12C" },
                { chord: "Em", hintKey: "improv.hints.lickOwn" },
                { chord: "D", hintKey: "improv.hints.lickOwn" },
            ])),
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
                key: "C",
                beatsPerChord: 4,
                defaultBpm: 80,
                minBpm: 50,
                maxBpm: 160,
                requiredPasses: 2,
                targets: [
                    { chord: "Dm7", pitchClasses: ["F", "C"] },
                    { chord: "G7", pitchClasses: ["B", "F"] },
                    { chord: "Cmaj7", pitchClasses: ["E", "B"] },
                ],
            }),
            // Plan D4: approach notes into the thirds of ii–V–I.
            loopExercise("voice-leading", "e4", {
                ...EXTRA_LOOP,
                progression: ["Dm7", "G7", "Cmaj7"],
                goalKey: "improv.goals.approachThirdBelow",
                key: "C",
                variants: goalVariants(["Dm7", "G7", "Cmaj7"], ["approachThirdBelow", "approachThirdEnclosure"], [
                    { chord: "Dm7", pitchClasses: ["F"] },
                    { chord: "G7", pitchClasses: ["B"] },
                    { chord: "Cmaj7", pitchClasses: ["E"] },
                ]).map((variant) => ({ ...variant, key: "C" })),
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
                key: "C",
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
                        key: "G",
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
                      goalKey: "improv.goals.secondaryDominants",
                      targets: [
                          { chord: "Cmaj7", pitchClasses: ["E"] },
                          { chord: "A7", pitchClasses: ["C#"] },
                          { chord: "Dm7", pitchClasses: ["F"] },
                          { chord: "G7", pitchClasses: ["B"] },
                      ] },
                    { id: "five-dominants", labelKey: "improv.goals.secondaryFiveLabel",
                      progression: ["Cmaj7", "E7", "Am7", "C7", "Fmaj7", "D7", "G7"],
                      goalKey: "improv.goals.secondaryDominants",
                      targets: [
                          { chord: "Cmaj7", pitchClasses: ["E"] },
                          { chord: "E7", pitchClasses: ["G#"] },
                          { chord: "Am7", pitchClasses: ["C"] },
                          { chord: "C7", pitchClasses: ["E"] },
                          { chord: "Fmaj7", pitchClasses: ["A"] },
                          { chord: "D7", pitchClasses: ["F#"] },
                          { chord: "G7", pitchClasses: ["B"] },
                      ] },
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
                key: "C",
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
                [{ shapeId: "melodic-minor", defaultKey: "A", keys: SCALE_KEYS }],
                2,
                6,
                60,
                2,
            ),
            practiceLinkExercise("melodic-minor", "e3", "playNotes", [0, 1, 2, 3, 4, 5], 5, 9, {
                rootNote: "A",
                scaleType: "melodicMinor",
            nonGating: true,
            }),
            loopExercise("melodic-minor", "e4", {
                progression: ["Am6", "Am(maj7)"],
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
            choiceExercise("chord-scale-melodic", "e1", "chordScaleMelodic", 10),
            choiceExercise("chord-scale-melodic", "e2", "chordScaleMelodic", 10, "in-context"),
            loopExercise("chord-scale-melodic", "e3", {
                progression: [
                    { chord: "Dm7b5", hintKey: "improv.hints.mmLocrian2" },
                    { chord: "G7alt", hintKey: "improv.hints.mmAb" },
                    { chord: "Cm(maj7)", hintKey: "improv.hints.mmC" },
                ],
                goalKey: "improv.goals.melodicMinorHints",
                key: "Cm",
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
                          { chord: "Cm(maj7)", hintKey: "improv.hints.mmC" },
                      ],
                      goalKey: "improv.goals.melodicMinorHints" },
                    { id: "d7-11-vamp", labelKey: "improv.goals.mmD711",
                      progression: [{ chord: "D7#11", hintKey: "improv.hints.mmDLydDom" }],
                      goalKey: "improv.goals.melodicMinorHints", key: "D" },
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
                [{ shapeId: "harmonic-minor", defaultKey: "C", keys: SCALE_KEYS }],
                2,
                6,
                60,
                2,
            ),
            practiceLinkExercise("harmonic-minor", "e3", "playNotes", [0, 1, 2, 3, 4, 5], 5, 9, {
                rootNote: "C",
                scaleType: "harmonicMinor",
            nonGating: true,
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
            choiceExercise("chord-scale-harmonic", "e1", "chordScaleHarmonic", 10),
            choiceExercise("chord-scale-harmonic", "e2", "chordScaleHarmonic", 10, "in-context"),
            loopExercise("chord-scale-harmonic", "e3", {
                progression: [
                    { chord: "Bm7b5", hintKey: "improv.hints.hmLocrian" },
                    { chord: "E7", hintKey: "improv.hints.hmPhrygianDom" },
                    { chord: "Am", hintKey: "improv.hints.hmA" },
                ],
                goalKey: "improv.goals.harmonicMinorPhrygian",
                key: "Am",
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
                progression: GIANT_STEPS_FORM,
                goalKey: "improv.goals.giantStepsRoots",
                beatsPerChord: 4,
                defaultBpm: 60,
                minBpm: 40,
                maxBpm: 180,
                requiredPasses: 1,
                variants: [
                    { id: "roots", labelKey: "improv.goals.giantStepsRootsLabel",
                      progression: GIANT_STEPS_FORM, goalKey: "improv.goals.giantStepsRoots",
                      targets: GIANT_STEPS_CHORDS.map(([chord, root]) => ({ chord, pitchClasses: [root] })) },
                    { id: "pattern-1235", labelKey: "improv.goals.giantStepsPatternLabel",
                      progression: GIANT_STEPS_FORM, goalKey: "improv.goals.giantStepsPattern" },
                    { id: "arps", labelKey: "improv.goals.giantStepsArpsLabel",
                      progression: GIANT_STEPS_FORM, goalKey: "improv.goals.giantStepsArps",
                      targets: GIANT_STEPS_CHORDS.map(([chord, , tones]) => ({ chord, pitchClasses: tones })) },
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

/**
 * Mic-verified loop pass (plan phase 4): a loop counts when at least 3 of
 * every 4 chord changes were hit (ratio rounded up), minimum one hit.
 */
export function micLoopPass(hits: number, chordCount: number): boolean {
    if (chordCount <= 0) return false;
    const required = Math.max(1, Math.ceil((chordCount * 3) / 4));
    return hits >= required;
}

/**
 * Positions the practice-link pass criterion covers (plan phase 2, refined
 * after the user report): fret 0 is EXCLUDED — practice sessions never ask
 * open strings (Practice clamps minFret to 1) and knowing the open string
 * is trivially implied by the string's name.
 */
export function practiceLinkPositions(params: PracticeLinkParams): Array<{ stringIndex: number; fret: number }> {
    const list: Array<{ stringIndex: number; fret: number }> = [];
    for (const stringIndex of params.enabledStrings) {
        for (let fret = Math.max(1, params.offsetsFrom); fret <= params.offsetsTo; fret += 1) {
            list.push({ stringIndex, fret });
        }
    }
    return list;
}

/** Run-counter key of a backing loop (per variant when the loop has variants). */
export function loopRunKey(exerciseId: string, variantId?: string): string {
    return variantId ? `${exerciseId}#${variantId}` : exerciseId;
}

/** Progress shape shared by the store and the pass predicates. */
export interface ImprovProgressShape {
    exerciseRuns: Record<string, number>;
    /**
     * Plan A2: the subset of loop passes (same run keys as `exerciseRuns`)
     * that the microphone verified. Self-marked passes count only in
     * `exerciseRuns`. Missing in state persisted before A2 (= none verified).
     */
    verifiedRuns?: Record<string, number>;
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
            // Variants are levels/contrasts the module teaches (12: root→7th
            // ladder, 15: G7 vs Db7…) — each one needs its own passes.
            if (params.variants && params.variants.length > 0) {
                return params.variants.every((variant) =>
                    (progress.exerciseRuns[loopRunKey(exercise.id, variant.id)] ?? 0) >= params.requiredPasses);
            }
            return (progress.exerciseRuns[exercise.id] ?? 0) >= params.requiredPasses;
        }
        case "practice-link": {
            // Recorded once the useProgressStore criteria are met (plan phase 2).
            return (progress.exerciseRuns[exercise.id] ?? 0) >= 1;
        }
        case "lick": {
            const params = exercise.params as LickParams;
            return params.lickIds.every((id) => (progress.exerciseRuns[loopRunKey(exercise.id, id)] ?? 0) >= params.requiredRuns);
        }
        default:
            return false;
    }
}

/**
 * Plan A2: true when the exercise's threshold is met by mic-verified passes
 * alone. A passed loop for which this is false was (at least partly) passed
 * with the self-mark button and shows the "unverified" badge.
 */
export function isExerciseVerified(
    exercise: ImprovExercise,
    progress: ImprovProgressShape | undefined,
): boolean {
    return isExercisePassed(exercise, { exerciseRuns: progress?.verifiedRuns ?? {} });
}

/** True for extra exercises that never gate module completion. */
export function isNonGating(exercise: ImprovExercise): boolean {
    return Boolean((exercise.params as { nonGating?: boolean }).nonGating);
}

/** A module is completed when every one of its exercises is passed. */
export function isModuleComplete(
    module: ImprovModule,
    progress: ImprovProgressShape | undefined,
): boolean {
    // Non-gating exercises (plan phase 5 fix: playNotes practice-links; B4
    // phrasing loops) are extra practice — they never block module completion.
    return module.exercises.every((exercise) => isNonGating(exercise) || isExercisePassed(exercise, progress));
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
    entranceUnlockCount?: number | null,
): boolean {
    if (unlockAll) return true;
    const index = IMPROV_ORDER.indexOf(moduleId);
    // Entrance test (plan phase 6): modules up to the first failed one are
    // unlocked by the result of the placement quiz.
    if (typeof entranceUnlockCount === "number" && index < entranceUnlockCount) return true;
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

/**
 * Plan F2: where the learner stands — the first unfinished module and its
 * first required exercise that is not passed yet. Null once everything is done.
 */
export function nextImprovExercise(
    moduleState: Record<string, ImprovProgressShape & { completed: boolean }> | undefined,
): { module: ImprovModule; exercise: ImprovExercise } | null {
    const module = CURRICULUM.find((item) => !isModuleComplete(item, moduleState?.[item.id]));
    const exercise = module?.exercises.find((item) => !isNonGating(item) && !isExercisePassed(item, moduleState?.[module.id]));
    return module && exercise ? { module, exercise } : null;
}

/** Two chords in one bar. */
const half = (chord: string): ProgressionEntry => ({ chord, beats: 2 });

/** ii–V–I in every key, each tonic a fourth above the previous one (two bars per key). */
const CYCLE_OF_FOURTHS: ProgressionEntry[] = [
    ["Dm7", "G7", "Cmaj7"], ["Gm7", "C7", "Fmaj7"], ["Cm7", "F7", "Bbmaj7"], ["Fm7", "Bb7", "Ebmaj7"],
    ["Bbm7", "Eb7", "Abmaj7"], ["Ebm7", "Ab7", "Dbmaj7"], ["Abm7", "Db7", "Gbmaj7"], ["C#m7", "F#7", "Bmaj7"],
    ["F#m7", "B7", "Emaj7"], ["Bm7", "E7", "Amaj7"], ["Em7", "A7", "Dmaj7"], ["Am7", "D7", "Gmaj7"],
].flatMap(([two, five, one]) => [half(two), half(five), { chord: one, beats: 4 }]);

const STANDARD_FORMS: Array<{ id: string; key: string; progression: Array<string | ProgressionEntry> }> = [
    { id: "stdJazzBlues", key: "F", progression: [
        "F7", "Bb7", "F7", half("Cm7"), half("F7"),
        "Bb7", "Bdim7", "F7", half("Am7"), half("D7"),
        "Gm7", "C7", half("F7"), half("D7"), half("Gm7"), half("C7"),
    ] },
    { id: "stdMinorBlues", key: "Cm", progression: ["Cm7", "Cm7", "Cm7", "Cm7", "Fm7", "Fm7", "Cm7", "Cm7", "Ab7", "G7", "Cm7", "G7"] },
    { id: "stdAutumn", key: "Gm", progression: ["Cm7", "F7", "Bbmaj7", "Ebmaj7", "Am7b5", "D7", "Gm6", "Gm6"] },
    { id: "stdRhythm", key: "Bb", progression: [
        "Bbmaj7", "G7", "Cm7", "F7", "Dm7", "G7", "Cm7", "F7",
        "Fm7", "Bb7", "Ebmaj7", "Ebm7", "Dm7", "G7", "Cm7", "F7",
    ].map(half) },
    { id: "stdCycle", key: "C", progression: CYCLE_OF_FOURTHS },
];

/** Progress of the standards loop is stored under this id, next to the modules. */
export const STANDARDS_ID = "standards";

/**
 * Plan E1: progressions from real tunes on the existing loop engine. Shown on
 * the roadmap below the modules; it gates nothing.
 */
export const STANDARDS: ImprovExercise = loopExercise(STANDARDS_ID, "e1", {
    beatsPerChord: 4,
    defaultBpm: 80,
    minBpm: 50,
    maxBpm: 200,
    requiredPasses: 2,
    progression: STANDARD_FORMS[0].progression,
    goalKey: `improv.goals.${STANDARD_FORMS[0].id}`,
    key: STANDARD_FORMS[0].key,
    variants: STANDARD_FORMS.map((form) => ({
        id: form.id,
        labelKey: `improv.goals.${form.id}Label`,
        progression: form.progression,
        goalKey: `improv.goals.${form.id}`,
        key: form.key,
    })),
});

type ModuleStateShape = Record<string, ImprovProgressShape & { completed: boolean }> | undefined;

/** Quiz generators of the completed modules: the pool of the mixed review quiz. */
export function passedQuizGenerators(moduleState: ModuleStateShape): ChoiceGeneratorId[] {
    const generators = new Set<ChoiceGeneratorId>();
    for (const module of CURRICULUM) {
        if (!isModuleComplete(module, moduleState?.[module.id])) continue;
        for (const exercise of module.exercises) {
            if (exercise.engine !== "choice-quiz") continue;
            const { generatorId } = exercise.params as ChoiceQuizParams;
            if (generatorId !== "mixed") generators.add(generatorId);
        }
    }
    return [...generators];
}

/** The mixed review quiz over the given generators (roadmap and session of the day). */
export function reviewQuiz(generators: ChoiceGeneratorId[]): ImprovExercise {
    return {
        id: "review.quiz",
        engine: "choice-quiz",
        nameKey: "improv.review.name",
        descKey: "improv.review.desc",
        params: { generatorId: "mixed", allowedGenerators: generators, questionCount: 10, requiredCorrect: 7, answerOptions: 4 },
    };
}

/** Review runs are recorded under this id (it is not a module, so nothing is stored). */
export const REVIEW_ID = "review";

/**
 * Plan F1: the session of the day — a review quiz, one diagram and one loop.
 * Diagram and loop come from the current module, or from the nearest module
 * that has one (earlier modules first). Before any module is complete the
 * quiz is the nearest module quiz instead of a review.
 */
export function dailySession(moduleState: ModuleStateShape): Array<{ moduleId: string; exercise: ImprovExercise }> {
    const current = nextImprovExercise(moduleState)?.module ?? CURRICULUM[CURRICULUM.length - 1];
    const distance = (module: ImprovModule) => (module.order <= current.order ? current.order - module.order : CURRICULUM.length + module.order);
    const nearest = [...CURRICULUM].sort((a, b) => distance(a) - distance(b));
    const pick = (engine: ImprovEngineType) => {
        for (const module of nearest) {
            const exercise = module.exercises.find((item) => item.engine === engine);
            if (exercise) return [{ moduleId: module.id, exercise }];
        }
        return [];
    };
    const passed = passedQuizGenerators(moduleState);
    return [
        ...(passed.length > 0 ? [{ moduleId: REVIEW_ID, exercise: reviewQuiz(passed) }] : pick("choice-quiz")),
        ...pick("diagram-drill"),
        ...pick("backing-improv"),
    ];
}

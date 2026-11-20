/**
 * Ear-training track: 12 modules in four stages — key and degrees, intervals,
 * chords, music (functions, progressions, playing by ear). The order and its
 * sources are in gauntlet/ear-training/sources/ear-plan.md and are guarded by
 * earCurriculum.test.ts.
 *
 * Pure data on the shared engines: the module quiz with sound
 * (lib/improv/earQuestions.ts) and the "play what you hear" drill.
 */

import { choiceExercise, type EchoDrillParams, type ImprovExercise, type ImprovModule } from "./curriculum";

const ALL_DEGREES: EchoDrillParams["degrees"] = ["1", "2", "3", "4", "5", "6", "7"];

function echoExercise(moduleId: string, suffix: string, params: Omit<EchoDrillParams, "requiredPhrases"> & Partial<Pick<EchoDrillParams, "requiredPhrases">>): ImprovExercise {
    return {
        id: `${moduleId}.${suffix}`,
        engine: "echo-drill",
        nameKey: `improv.ex.${moduleId}.${suffix}.name`,
        descKey: `improv.ex.${moduleId}.${suffix}.desc`,
        params: { requiredPhrases: 8, ...params },
    };
}

const FUNCTIONAL = { labelKey: "improv.supplementary.functionalEar", href: "/ear-training/functional" };
const INTERVALS = { labelKey: "improv.supplementary.intervalTrainer", href: "/ear-training/intervals" };
const CHORD_QUALITY = { labelKey: "improv.supplementary.chordQuality", href: "/ear-training/chord-quality" };

export const EAR_CURRICULUM: ImprovModule[] = [
    /* ─────────── Stage I: key and degrees ─────────── */
    {
        id: "ear-tonic",
        order: 1,
        theoryKey: "improv.modules.ear-tonic.theory",
        supplementary: [FUNCTIONAL],
        exercises: [
            choiceExercise("ear-tonic", "e1", "earDegree", 10, "major-135"),
            echoExercise("ear-tonic", "e2", { degrees: ["1", "3", "5"], mode: "major", length: 1, nonGating: true }),
        ],
    },
    {
        id: "ear-degrees",
        order: 2,
        theoryKey: "improv.modules.ear-degrees.theory",
        supplementary: [FUNCTIONAL],
        exercises: [
            choiceExercise("ear-degrees", "e1", "earDegree", 10, "major"),
            echoExercise("ear-degrees", "e2", { degrees: ALL_DEGREES, mode: "major", length: 1, nonGating: true }),
        ],
    },
    {
        id: "ear-minor",
        order: 3,
        theoryKey: "improv.modules.ear-minor.theory",
        exercises: [
            choiceExercise("ear-minor", "e1", "earDegree", 10, "minor"),
            echoExercise("ear-minor", "e2", { degrees: ALL_DEGREES, mode: "minor", length: 1, nonGating: true }),
        ],
    },

    /* ─────────── Stage II: intervals ─────────── */
    {
        id: "ear-intervals-up",
        order: 4,
        theoryKey: "improv.modules.ear-intervals-up.theory",
        supplementary: [INTERVALS],
        exercises: [choiceExercise("ear-intervals-up", "e1", "earInterval", 10, "easy-up")],
    },
    {
        id: "ear-intervals-all",
        order: 5,
        theoryKey: "improv.modules.ear-intervals-all.theory",
        supplementary: [INTERVALS],
        exercises: [
            choiceExercise("ear-intervals-all", "e1", "earInterval", 10, "all"),
            echoExercise("ear-intervals-all", "e2", { degrees: ALL_DEGREES, mode: "major", length: 2, nonGating: true }),
        ],
    },
    {
        id: "ear-intervals-harmonic",
        order: 6,
        theoryKey: "improv.modules.ear-intervals-harmonic.theory",
        exercises: [choiceExercise("ear-intervals-harmonic", "e1", "earInterval", 10, "harmonic")],
    },

    /* ─────────── Stage III: chords ─────────── */
    {
        id: "ear-triads",
        order: 7,
        theoryKey: "improv.modules.ear-triads.theory",
        supplementary: [CHORD_QUALITY],
        exercises: [choiceExercise("ear-triads", "e1", "earChord", 10, "triads")],
    },
    {
        id: "ear-sevenths",
        order: 8,
        theoryKey: "improv.modules.ear-sevenths.theory",
        supplementary: [CHORD_QUALITY],
        exercises: [choiceExercise("ear-sevenths", "e1", "earChord", 10, "sevenths")],
    },
    {
        id: "ear-inversions",
        order: 9,
        theoryKey: "improv.modules.ear-inversions.theory",
        supplementary: [{ labelKey: "improv.supplementary.triadsTrack", href: "/improv/voicings" }],
        exercises: [choiceExercise("ear-inversions", "e1", "earChord", 10, "inversions")],
    },

    /* ─────────── Stage IV: music ─────────── */
    {
        id: "ear-functions",
        order: 10,
        theoryKey: "improv.modules.ear-functions.theory",
        exercises: [choiceExercise("ear-functions", "e1", "earProgression", 10, "function")],
    },
    {
        id: "ear-progressions",
        order: 11,
        theoryKey: "improv.modules.ear-progressions.theory",
        exercises: [choiceExercise("ear-progressions", "e1", "earProgression", 10, "progression")],
    },
    {
        id: "ear-echo",
        order: 12,
        theoryKey: "improv.modules.ear-echo.theory",
        exercises: [
            echoExercise("ear-echo", "e1", { degrees: ["1", "2", "3", "4", "5"], mode: "major", length: 3 }),
            echoExercise("ear-echo", "e2", { degrees: ALL_DEGREES, mode: "major", length: 4 }),
            echoExercise("ear-echo", "e3", { degrees: ALL_DEGREES, mode: "minor", length: 3, nonGating: true }),
        ],
    },
];

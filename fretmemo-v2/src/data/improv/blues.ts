/**
 * Blues track: 14 modules in four stages — rhythm and form, the language of
 * the solo, colours, playing the changes. The order is a synthesis of several
 * methods (see gauntlet/blues-training/sources/blues-plan.md) and is guarded
 * by bluesCurriculum.test.ts.
 *
 * Pure data on the shared exercise engines; nothing here is blues-specific code.
 */

import {
    EXTRA_LOOP,
    STANDARD_FORMS,
    bluesPentatonicLoop,
    choiceExercise,
    drillExercise,
    goalVariants,
    lickExercise,
    lickLoop,
    loopExercise,
    phraseLoop,
    practiceLinkExercise,
    half,
    type BackingLoopParams,
    type BendSpec,
    type ChordMicTargets,
    type ImprovExercise,
    type ImprovModule,
    type ProgressionEntry,
} from "./curriculum";

/** 12-bar blues; `quick` goes to the IV chord in bar 2. */
export function twelveBar(one: string, four: string, five: string, quick = false): string[] {
    return [one, quick ? four : one, one, one, four, four, one, one, five, four, one, one];
}

const A_BLUES = twelveBar("A7", "D7", "E7");

/** Shared settings of the blues loops: a medium shuffle. */
const BLUES_LOOP = { beatsPerChord: 4, defaultBpm: 80, minBpm: 50, maxBpm: 160, requiredPasses: 2, style: "shuffle" } as const;

/** Mic targets over A7, D7 and E7, one list of pitch classes per chord. */
function targetsA(a: string[], d: string[], e: string[]): ChordMicTargets[] {
    return [{ chord: "A7", pitchClasses: a }, { chord: "D7", pitchClasses: d }, { chord: "E7", pitchClasses: e }];
}

const ROOTS = targetsA(["A"], ["D"], ["E"]);
const THIRDS = targetsA(["C#"], ["F#"], ["G#"]);
const SEVENTHS = targetsA(["G"], ["C"], ["D"]);

function bendExercise(moduleId: string, suffix: string, bends: BendSpec[], nonGating = false): ImprovExercise {
    return {
        id: `${moduleId}.${suffix}`,
        engine: "bend-drill",
        nameKey: `improv.ex.${moduleId}.${suffix}.name`,
        descKey: `improv.ex.${moduleId}.${suffix}.desc`,
        params: { bends, requiredReps: 5, nonGating },
    };
}

const loop = (params: Partial<BackingLoopParams> & Pick<BackingLoopParams, "progression" | "goalKey">): BackingLoopParams => ({ ...BLUES_LOOP, ...params });
const withHints = (chords: string[], hints: Array<string | undefined>): ProgressionEntry[] =>
    chords.map((chord, index) => ({ chord, hintKey: hints[index] }));

const Q1 = "improv.hints.barQuestion1";
const Q2 = "improv.hints.barQuestion2";
const A1 = "improv.hints.barAnswer1";
const A2 = "improv.hints.barAnswer2";
const REST = "improv.hints.barRest";
const OWN = "improv.hints.lickOwn";

/** Jazz blues in F, as in the standards loop. */
const JAZZ_BLUES = STANDARD_FORMS.find((form) => form.id === "stdJazzBlues")?.progression ?? [];

/** The forms of module 13; the same list feeds the free jam under the roadmap. */
const BLUES_FORMS: Array<{ id: string; progression: Array<string | ProgressionEntry>; key?: string; style?: BackingLoopParams["style"] }> = [
    { id: "formQuick", progression: twelveBar("A7", "D7", "E7", true) },
    { id: "formSlow", progression: twelveBar("A7", "D7", "E7", true), style: "slow12" },
    { id: "formMinor", key: "Am", progression: ["Am7", "Am7", "Am7", "Am7", "Dm7", "Dm7", "Am7", "Am7", "F7", "E7", "Am7", "E7"] },
    { id: "formEight", progression: ["A7", "E7", "D7", "D7", "A7", "E7", half("A7"), half("D7"), half("A7"), half("E7")] },
    { id: "formSixteen", progression: [...Array<string>(8).fill("A7"), "D7", "D7", "A7", "A7", "E7", "D7", "A7", "A7"] },
];

const formVariants = (forms: typeof BLUES_FORMS) => forms.map((form) => ({
    id: form.id,
    labelKey: `improv.goals.${form.id}Label`,
    progression: form.progression,
    goalKey: `improv.goals.${form.id}`,
    key: form.key,
    style: form.style,
}));

export const BLUES_CURRICULUM: ImprovModule[] = [
    /* ─────────── Stage I: rhythm and form ─────────── */
    {
        id: "blues-form",
        order: 1,
        theoryKey: "improv.modules.blues-form.theory",
        supplementary: [{ labelKey: "improv.supplementary.earTraining", href: "/ear-training/functional" }],
        exercises: [
            choiceExercise("blues-form", "e1", "bluesForm", 10),
            choiceExercise("blues-form", "e2", "bluesForm", 10, "degrees"),
            loopExercise("blues-form", "e3", loop({ progression: A_BLUES, goalKey: "improv.goals.bluesRoots", targets: ROOTS })),
            loopExercise("blues-form", "e4", loop({
                progression: twelveBar("A7", "D7", "E7", true), goalKey: "improv.goals.bluesRootsQuick", targets: ROOTS, nonGating: true,
            })),
        ],
    },
    {
        id: "blues-shuffle",
        order: 2,
        theoryKey: "improv.modules.blues-shuffle.theory",
        supplementary: [{ labelKey: "improv.supplementary.rhythm", href: "/rhythm/groove-lab" }],
        exercises: [
            lickExercise("blues-shuffle", ["bluesBoogie", "bluesBoogieSeventh"], false),
            loopExercise("blues-shuffle", "e1", loop({ progression: A_BLUES, goalKey: "improv.goals.bluesRiff" })),
        ],
    },
    {
        id: "blues-dominant-chords",
        order: 3,
        theoryKey: "improv.modules.blues-dominant-chords.theory",
        embed: { tool: "chord-library" },
        supplementary: [{ labelKey: "improv.supplementary.chordQuality", href: "/ear-training/chord-quality" }],
        exercises: [
            choiceExercise("blues-dominant-chords", "e1", "bluesTones", 10),
            drillExercise("blues-dominant-chords", "e2", [
                { shapeId: "dom7-arp", defaultKey: "A" },
                { shapeId: "dom7-arp", defaultKey: "D" },
                { shapeId: "dom7-arp", defaultKey: "E" },
            ], 0, 4, 60, 3),
            loopExercise("blues-dominant-chords", "e3", loop({ progression: A_BLUES, goalKey: "improv.goals.bluesComping", nonGating: true })),
        ],
    },

    /* ─────────── Stage II: the language of the solo ─────────── */
    {
        id: "blues-pentatonic",
        order: 4,
        theoryKey: "improv.modules.blues-pentatonic.theory",
        embed: { tool: "scale-explorer", root: "A", scaleType: "minor pentatonic" },
        exercises: [
            drillExercise("blues-pentatonic", "e1", [{ shapeId: "min-pent", defaultKey: "A", keys: ["A", "E", "G", "C", "D"] }], 0, 3, 70, 2, { pentatonicViews: true }),
            loopExercise("blues-pentatonic", "e2", loop({ progression: A_BLUES, goalKey: "improv.goals.bluesBox1" })),
            loopExercise("blues-pentatonic", "e3", loop({
                progression: A_BLUES,
                goalKey: "improv.goals.limitThreeNotes",
                nonGating: true,
                variants: goalVariants(A_BLUES, ["limitThreeNotes", "limitOneString", "limitRhythm"]),
            })),
            practiceLinkExercise("blues-pentatonic", "e4", "playNotes", [0, 1, 2, 3, 4, 5], 5, 8, {
                rootNote: "A", scaleType: "minorPentatonic", nonGating: true,
            }),
        ],
    },
    {
        id: "blues-bends",
        order: 5,
        theoryKey: "improv.modules.blues-bends.theory",
        exercises: [
            bendExercise("blues-bends", "e1", [{ id: "half-g7", string: 3, fret: 7, minCents: 80, maxCents: 120 }]),
            bendExercise("blues-bends", "e2", [
                { id: "whole-g7", string: 3, fret: 7, minCents: 180, maxCents: 220 },
                { id: "whole-b8", string: 2, fret: 8, minCents: 180, maxCents: 220 },
            ]),
            bendExercise("blues-bends", "e3", [{ id: "curl-g5", string: 3, fret: 5, minCents: 25, maxCents: 75 }]),
            lickExercise("blues-bends", ["bluesBendFifth", "bluesBendRoot", "bluesCurl"]),
        ],
    },
    {
        id: "blues-licks",
        order: 6,
        theoryKey: "improv.modules.blues-licks.theory",
        exercises: [
            lickExercise("blues-licks", ["bluesOpen", "bluesTriplet", "bluesBlueNote", "bluesSlide", "bluesAnswer", "bluesLow"], false),
            loopExercise("blues-licks", "e1", {
                ...lickLoop("bluesLickLoop", withHints(A_BLUES, [
                    "improv.hints.lickBluesOpen", OWN, OWN, OWN,
                    "improv.hints.lickBluesBlueNote", OWN, OWN, OWN,
                    "improv.hints.lickBluesAnswer", OWN, OWN, OWN,
                ])),
                nonGating: false,
                style: "shuffle",
            }),
        ],
    },
    {
        id: "blues-phrasing",
        order: 7,
        theoryKey: "improv.modules.blues-phrasing.theory",
        exercises: [
            loopExercise("blues-phrasing", "e1", loop({
                progression: withHints(A_BLUES, [Q1, Q2, REST, REST, Q1, Q2, REST, REST, A1, A2, REST, REST]),
                goalKey: "improv.goals.bluesAAB",
            })),
            loopExercise("blues-phrasing", "e2", { ...phraseLoop(["A7", "D7", "A7", "E7"]), nonGating: false, style: "shuffle" }),
            loopExercise("blues-phrasing", "e3", loop({ progression: A_BLUES, goalKey: "improv.goals.bluesMotif", nonGating: true })),
        ],
    },

    /* ─────────── Stage III: colours ─────────── */
    {
        id: "blues-major-minor",
        order: 8,
        theoryKey: "improv.modules.blues-major-minor.theory",
        embed: { tool: "scale-explorer", root: "A", scaleType: "major pentatonic" },
        exercises: [
            drillExercise("blues-major-minor", "e1", [{ shapeId: "maj-pent", defaultKey: "A", keys: ["A", "E", "G", "C", "D"] }], -3, 0, 70, 2),
            choiceExercise("blues-major-minor", "e2", "bluesScale", 10),
            loopExercise("blues-major-minor", "e3", { ...bluesPentatonicLoop("A7", "D7", "E7"), nonGating: false, requiredPasses: 1, style: "shuffle" }),
            drillExercise("blues-major-minor", "e4", [{ shapeId: "mix-blues", defaultKey: "A" }, { shapeId: "maj-blues", defaultKey: "A" }], -1, 3, 60, 1, { nonGating: true }),
        ],
    },
    {
        id: "blues-boxes",
        order: 9,
        theoryKey: "improv.modules.blues-boxes.theory",
        exercises: [
            drillExercise("blues-boxes", "e1", [{ shapeId: "bb-box", defaultKey: "A", keys: ["A", "G", "C", "D"] }], 5, 7, 70, 2, { onlyStrings: [0, 1, 2] }),
            drillExercise("blues-boxes", "e2", [{ shapeId: "min-pent", defaultKey: "A", keys: ["A", "G", "C", "D"] }], 2, 5, 70, 2, { onlyStrings: [0, 1, 2] }),
            loopExercise("blues-boxes", "e3", loop({
                progression: withHints(A_BLUES, [
                    "improv.hints.boxOne", "improv.hints.boxOne", "improv.hints.boxOne", "improv.hints.boxOne",
                    "improv.hints.boxTwo", "improv.hints.boxTwo", "improv.hints.boxTwo", "improv.hints.boxTwo",
                    "improv.hints.boxRoot", "improv.hints.boxRoot", "improv.hints.boxRoot", "improv.hints.boxRoot",
                ]),
                goalKey: "improv.goals.bluesBoxes",
            })),
            drillExercise("blues-boxes", "e4", [{ shapeId: "min-pent", defaultKey: "A" }], 0, 8, 70, 1, { diagonal: true, nonGating: true }),
            lickExercise("blues-boxes", ["bluesBoxCall", "bluesBoxSweet"]),
        ],
    },
    {
        id: "blues-turnarounds",
        order: 10,
        theoryKey: "improv.modules.blues-turnarounds.theory",
        exercises: [
            lickExercise("blues-turnarounds", ["bluesTurnDown", "bluesTurnUp"], false),
            loopExercise("blues-turnarounds", "e1", loop({
                progression: [
                    ...A_BLUES.slice(0, 10),
                    { chord: "A7", beats: 2, hintKey: "improv.hints.turnaround" }, half("D7"), half("A7"), half("E7"),
                ],
                goalKey: "improv.goals.bluesTurnaround",
            })),
        ],
    },

    /* ─────────── Stage IV: playing the changes ─────────── */
    {
        id: "blues-chord-tones",
        order: 11,
        theoryKey: "improv.modules.blues-chord-tones.theory",
        exercises: [
            loopExercise("blues-chord-tones", "e1", loop({
                progression: A_BLUES,
                goalKey: "improv.goals.bluesTargetRoot",
                requiredPasses: 1,
                variants: [
                    { id: "root", labelKey: "improv.goals.targetRootLabel", progression: A_BLUES, goalKey: "improv.goals.bluesTargetRoot", targets: ROOTS },
                    { id: "third", labelKey: "improv.goals.targetThirdLabel", progression: A_BLUES, goalKey: "improv.goals.bluesTargetThird", targets: THIRDS },
                    { id: "seventh", labelKey: "improv.goals.targetSeventhLabel", progression: A_BLUES, goalKey: "improv.goals.bluesTargetSeventh", targets: SEVENTHS },
                ],
            })),
            loopExercise("blues-chord-tones", "e2", loop({ progression: A_BLUES, goalKey: "improv.goals.bluesApproach", targets: THIRDS, nonGating: true })),
        ],
    },
    {
        id: "blues-guide-tones",
        order: 12,
        theoryKey: "improv.modules.blues-guide-tones.theory",
        embed: { tool: "scale-explorer", root: "A", scaleType: "mixolydian" },
        exercises: [
            drillExercise("blues-guide-tones", "e1", [
                { shapeId: "mixolydian", defaultKey: "A" },
                { shapeId: "mixolydian", defaultKey: "D" },
                { shapeId: "mixolydian", defaultKey: "E" },
            ], -1, 3, 60, 3),
            choiceExercise("blues-guide-tones", "e2", "bluesTones", 10, "guide-move"),
            loopExercise("blues-guide-tones", "e3", loop({
                progression: A_BLUES,
                goalKey: "improv.goals.bluesGuideTones",
                targets: targetsA(["C#", "G"], ["F#", "C"], ["G#", "D"]),
            })),
        ],
    },
    {
        id: "blues-forms",
        order: 13,
        theoryKey: "improv.modules.blues-forms.theory",
        exercises: [
            choiceExercise("blues-forms", "e1", "bluesForm", 10, "quick-change"),
            loopExercise("blues-forms", "e2", loop({
                progression: BLUES_FORMS[0].progression,
                goalKey: `improv.goals.${BLUES_FORMS[0].id}`,
                requiredPasses: 1,
                variants: formVariants(BLUES_FORMS),
            })),
        ],
    },
    {
        id: "blues-jazz-blues",
        order: 14,
        theoryKey: "improv.modules.blues-jazz-blues.theory",
        exercises: [
            drillExercise("blues-jazz-blues", "e1", [
                { shapeId: "dom7-arp", defaultKey: "F" },
                { shapeId: "m7-arp", defaultKey: "G" },
                { shapeId: "dom7-arp", defaultKey: "C" },
            ], 0, 4, 60, 3),
            loopExercise("blues-jazz-blues", "e2", loop({
                progression: JAZZ_BLUES,
                goalKey: "improv.goals.bluesJazzThirds",
                key: "F",
                style: "swing",
                defaultBpm: 100,
                maxBpm: 200,
                requiredPasses: 1,
                targets: [
                    { chord: "F7", pitchClasses: ["A"] }, { chord: "Bb7", pitchClasses: ["D"] }, { chord: "Cm7", pitchClasses: ["Eb"] },
                    { chord: "Bdim7", pitchClasses: ["D"] }, { chord: "Am7", pitchClasses: ["C"] }, { chord: "D7", pitchClasses: ["F#"] },
                    { chord: "Gm7", pitchClasses: ["Bb"] }, { chord: "C7", pitchClasses: ["E"] },
                ],
            })),
        ],
    },
];

/** Progress of the free jam is stored under this id, next to the modules. */
export const BLUES_JAM_ID = "blues-jam";

/** Every blues form on one loop, for playing without a goal to pass. It gates nothing. */
export const BLUES_JAM: ImprovExercise = loopExercise(BLUES_JAM_ID, "e1", {
    ...EXTRA_LOOP,
    style: "shuffle",
    maxBpm: 200,
    progression: A_BLUES,
    goalKey: "improv.goals.formStandard",
    variants: [
        { id: "formStandard", labelKey: "improv.goals.formStandardLabel", progression: A_BLUES, goalKey: "improv.goals.formStandard" },
        ...formVariants(BLUES_FORMS),
        { id: "stdJazzBlues", labelKey: "improv.goals.stdJazzBluesLabel", progression: JAZZ_BLUES, goalKey: "improv.goals.stdJazzBlues", key: "F", style: "swing" as const },
    ],
});

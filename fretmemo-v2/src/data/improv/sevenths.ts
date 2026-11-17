/**
 * Seventh chords and comping track: 12 modules in four stages — construction,
 * shell voicings, drop 2, comping. The order and its sources are in
 * gauntlet/sevenths-training/sources/sevenths-plan.md and are guarded by
 * seventhsCurriculum.test.ts.
 *
 * Pure data on the shared engines; voicing types come from lib/improv/voicings.
 */

import { DROP2_ORDERS, DROP3_ORDERS, GUIDE_TONE_ORDERS, SHELL_ROOT_3_7, SHELL_ROOT_7_3, type VoicingLayout } from "@/lib/improv/voicings";
import {
    STANDARD_FORMS,
    choiceExercise,
    drillExercise,
    loopExercise,
    type BackingLoopParams,
    type ImprovExercise,
    type ImprovModule,
    type VoicingDrillParams,
    type VoicingLoopOptions,
} from "./curriculum";

/** Four adjacent strings: 1-4 and 2-5; drop 3 skips a string: 6-4-3-2 and 5-3-2-1. */
const TOP4 = [3, 2, 1, 0];
const MIDDLE4 = [4, 3, 2, 1];
const DROP3_ON_6 = [5, 3, 2, 1];
const DROP3_ON_5 = [4, 2, 1, 0];

/** Shells: root on the sixth or the fifth string, with 7-3 or 3-7 above it. */
const SHELLS: Record<string, VoicingLayout> = {
    sixth73: { strings: [5, 3, 2], orders: SHELL_ROOT_7_3 },
    sixth37: { strings: [5, 4, 3], orders: SHELL_ROOT_3_7 },
    fifth73: { strings: [4, 2, 1], orders: SHELL_ROOT_7_3 },
    fifth37: { strings: [4, 3, 2], orders: SHELL_ROOT_3_7 },
};

/** A shell comping voicing: starts on the sixth string and may move to the fifth, wherever the hand stays put. */
const SHELL_COMPING: VoicingLoopOptions = {
    strings: SHELLS.sixth73.strings, orders: SHELLS.sixth73.orders, startFret: 4,
    layouts: [SHELLS.sixth37, SHELLS.fifth73, SHELLS.fifth37],
};
const DROP2_TOP: VoicingLoopOptions = { strings: TOP4, orders: DROP2_ORDERS, startFret: 6 };
const DROP2_MIDDLE: VoicingLoopOptions = { strings: MIDDLE4, orders: DROP2_ORDERS, startFret: 5 };
/** Drop 2 on either upper string set, whichever keeps the hand closer. */
const DROP2_BOTH: VoicingLoopOptions = { ...DROP2_TOP, layouts: [{ strings: MIDDLE4, orders: DROP2_ORDERS }] };
const GUIDE_TONES: VoicingLoopOptions = { strings: [3, 2], orders: GUIDE_TONE_ORDERS, startFret: 3 };

const SEVENTH_TYPES = (root: string) => [`${root}maj7`, `${root}7`, `${root}m7`, `${root}m7b5`];
const TWO_FIVE_ONE = ["Dm7", "G7", "Cmaj7", "Cmaj7"];

function voicingExercise(moduleId: string, suffix: string, params: Partial<VoicingDrillParams> & Pick<VoicingDrillParams, "mode" | "chords" | "stringSets">): ImprovExercise {
    return {
        id: `${moduleId}.${suffix}`,
        engine: "voicing-drill",
        nameKey: `improv.ex.${moduleId}.${suffix}.name`,
        descKey: `improv.ex.${moduleId}.${suffix}.desc`,
        params: { beatsPerChord: 4, defaultBpm: 60, requiredRuns: 2, ...params },
    };
}

const loop = (params: Partial<BackingLoopParams> & Pick<BackingLoopParams, "progression" | "goalKey">): BackingLoopParams => ({
    beatsPerChord: 4, defaultBpm: 80, minBpm: 50, maxBpm: 180, requiredPasses: 2, style: "swing", ...params,
});

const form = (id: string) => STANDARD_FORMS.find((item) => item.id === id) as (typeof STANDARD_FORMS)[number];

const STANDARD_VARIANTS = ["stdAutumn", "stdRhythm", "stdAllThings"].map((id) => ({
    id,
    labelKey: `improv.goals.${id}Label`,
    progression: form(id).progression,
    goalKey: "improv.goals.compStandards",
    key: form(id).key,
}));

export const SEVENTHS_CURRICULUM: ImprovModule[] = [
    /* ─────────── Stage I: construction ─────────── */
    {
        id: "seventh-types",
        order: 1,
        theoryKey: "improv.modules.seventh-types.theory",
        embed: { tool: "chord-library" },
        supplementary: [{ labelKey: "improv.supplementary.chordQuality", href: "/ear-training/chord-quality" }],
        exercises: [
            choiceExercise("seventh-types", "e1", "triadType", 10),
            choiceExercise("seventh-types", "e2", "bluesTones", 10, "seventh"),
        ],
    },
    {
        id: "seventh-diatonic",
        order: 2,
        theoryKey: "improv.modules.seventh-diatonic.theory",
        exercises: [
            choiceExercise("seventh-diatonic", "e1", "triadBuild", 10, "degree-to-seventh"),
            drillExercise("seventh-diatonic", "e2", [
                { shapeId: "maj7-arp", defaultKey: "C" },
                { shapeId: "m7-arp", defaultKey: "D" },
                { shapeId: "dom7-arp", defaultKey: "G" },
                { shapeId: "m7b5-arp", defaultKey: "B" },
            ], 0, 4, 60, 4),
        ],
    },

    /* ─────────── Stage II: shell voicings ─────────── */
    {
        id: "shells-sixth",
        order: 3,
        theoryKey: "improv.modules.shells-sixth.theory",
        exercises: [
            voicingExercise("shells-sixth", "e1", { mode: "inversions", chords: SEVENTH_TYPES("G"), stringSets: [SHELLS.sixth73.strings], orders: SHELLS.sixth73.orders }),
            voicingExercise("shells-sixth", "e2", { mode: "inversions", chords: SEVENTH_TYPES("G"), stringSets: [SHELLS.sixth37.strings], orders: SHELLS.sixth37.orders }),
        ],
    },
    {
        id: "shells-fifth",
        order: 4,
        theoryKey: "improv.modules.shells-fifth.theory",
        exercises: [
            voicingExercise("shells-fifth", "e1", { mode: "inversions", chords: SEVENTH_TYPES("C"), stringSets: [SHELLS.fifth73.strings], orders: SHELLS.fifth73.orders }),
            voicingExercise("shells-fifth", "e2", { mode: "inversions", chords: SEVENTH_TYPES("C"), stringSets: [SHELLS.fifth37.strings], orders: SHELLS.fifth37.orders }),
        ],
    },
    {
        id: "shells-251",
        order: 5,
        theoryKey: "improv.modules.shells-251.theory",
        exercises: [
            voicingExercise("shells-251", "e1", {
                mode: "path", chords: TWO_FIVE_ONE, stringSets: [SHELLS.sixth73.strings], orders: SHELLS.sixth73.orders,
                startFret: SHELL_COMPING.startFret, layouts: SHELL_COMPING.layouts,
            }),
            loopExercise("shells-251", "e2", loop({ progression: TWO_FIVE_ONE, goalKey: "improv.goals.shells251", key: "C", voicing: SHELL_COMPING })),
            loopExercise("shells-251", "e3", loop({
                progression: form("stdJazzBlues").progression, goalKey: "improv.goals.shellsBlues", key: "F", voicing: SHELL_COMPING, nonGating: true,
            })),
        ],
    },

    /* ─────────── Stage III: drop 2 ─────────── */
    {
        id: "drop2-top",
        order: 6,
        theoryKey: "improv.modules.drop2-top.theory",
        exercises: [
            voicingExercise("drop2-top", "e1", { mode: "inversions", chords: SEVENTH_TYPES("C"), stringSets: [TOP4], orders: DROP2_ORDERS }),
        ],
    },
    {
        id: "drop2-middle",
        order: 7,
        theoryKey: "improv.modules.drop2-middle.theory",
        exercises: [
            voicingExercise("drop2-middle", "e1", { mode: "inversions", chords: SEVENTH_TYPES("G"), stringSets: [MIDDLE4], orders: DROP2_ORDERS }),
        ],
    },
    {
        id: "drop2-251",
        order: 8,
        theoryKey: "improv.modules.drop2-251.theory",
        exercises: [
            voicingExercise("drop2-251", "e1", { mode: "path", chords: TWO_FIVE_ONE, stringSets: [TOP4, MIDDLE4], orders: DROP2_ORDERS, startFret: 6 }),
            loopExercise("drop2-251", "e2", loop({ progression: TWO_FIVE_ONE, goalKey: "improv.goals.drop2TwoFiveOne", key: "C", voicing: DROP2_TOP, topVoiceTargets: true })),
            loopExercise("drop2-251", "e3", loop({
                progression: TWO_FIVE_ONE, goalKey: "improv.goals.drop2TwoFiveOne", key: "C", voicing: DROP2_MIDDLE, topVoiceTargets: true, nonGating: true,
            })),
        ],
    },

    /* ─────────── Stage IV: comping ─────────── */
    {
        id: "drop3",
        order: 9,
        theoryKey: "improv.modules.drop3.theory",
        exercises: [
            voicingExercise("drop3", "e1", {
                mode: "inversions", chords: SEVENTH_TYPES("G"), stringSets: [DROP3_ON_6, DROP3_ON_5], orders: DROP3_ORDERS, maxSpan: 5,
            }),
        ],
    },
    {
        id: "guide-tones",
        order: 10,
        theoryKey: "improv.modules.guide-tones.theory",
        exercises: [
            loopExercise("guide-tones", "e1", loop({
                progression: form("stdJazzBlues").progression, goalKey: "improv.goals.guideTonesBlues", key: "F", requiredPasses: 1, voicing: GUIDE_TONES,
            })),
            loopExercise("guide-tones", "e2", loop({
                progression: form("stdCycle").progression, goalKey: "improv.goals.guideTonesCycle", key: "C", requiredPasses: 1, voicing: GUIDE_TONES, nonGating: true,
            })),
        ],
    },
    {
        id: "comping-rhythm",
        order: 11,
        theoryKey: "improv.modules.comping-rhythm.theory",
        exercises: [
            loopExercise("comping-rhythm", "e1", loop({
                progression: form("stdJazzBlues").progression, goalKey: "improv.goals.compFourToTheBar", key: "F", requiredPasses: 1, voicing: SHELL_COMPING,
            })),
            loopExercise("comping-rhythm", "e2", loop({
                progression: form("stdBlueBossa").progression, goalKey: "improv.goals.compBossa", key: "Cm", requiredPasses: 1, style: "bossa", voicing: DROP2_BOTH,
            })),
        ],
    },
    {
        id: "comping-standards",
        order: 12,
        theoryKey: "improv.modules.comping-standards.theory",
        exercises: [
            loopExercise("comping-standards", "e1", loop({
                progression: STANDARD_VARIANTS[0].progression,
                goalKey: "improv.goals.compStandards",
                key: STANDARD_VARIANTS[0].key,
                requiredPasses: 1,
                voicing: DROP2_BOTH,
                topVoiceTargets: true,
                variants: STANDARD_VARIANTS,
            })),
        ],
    },
];

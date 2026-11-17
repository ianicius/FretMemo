/**
 * Triads and voice leading track: 12 modules in four stages — construction,
 * the fretboard map, voice leading, use in a solo. The order and its sources
 * are in gauntlet/triads-training/sources/triads-plan.md and are guarded by
 * triadsCurriculum.test.ts.
 *
 * Pure data on the shared exercise engines.
 */

import { STRING_SETS } from "@/lib/improv/voicings";
import {
    choiceExercise,
    drillExercise,
    lickExercise,
    loopExercise,
    type BackingLoopParams,
    type ImprovExercise,
    type ImprovModule,
    type VoicingDrillParams,
} from "./curriculum";

const TOP = [...STRING_SETS.top];
const MIDDLE = [...STRING_SETS.middle];
const LOW_MIDDLE = [...STRING_SETS.lowMiddle];
const LOW = [...STRING_SETS.low];

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
    beatsPerChord: 4, defaultBpm: 70, minBpm: 40, maxBpm: 140, requiredPasses: 2, ...params,
});

/** I–V–vi–IV in G, the comping progression of the fretboard stage. */
const POP_G = ["G", "D", "Em", "C"];
const DIATONIC_C = ["C", "Dm", "Em", "F", "G", "Am", "Bdim", "C"];
const CYCLE_MAJOR = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "B", "E", "A", "D", "G"];
const CYCLE_MINOR = CYCLE_MAJOR.map((chord) => `${chord}m`);

const PROGRESSIONS = [
    { id: "vlPopAxis", key: "C", progression: ["C", "G", "Am", "F"] },
    { id: "vlTwoFiveOne", key: "C", progression: ["Dm", "G", "C", "C"] },
    { id: "vlAndalusian", key: "Am", progression: ["Am", "G", "F", "E"] },
];

const progressionVariants = PROGRESSIONS.map((item) => ({
    id: item.id,
    labelKey: `improv.goals.${item.id}Label`,
    progression: item.progression,
    goalKey: `improv.goals.${item.id}`,
    key: item.key,
}));

export const TRIADS_CURRICULUM: ImprovModule[] = [
    /* ─────────── Stage I: construction ─────────── */
    {
        id: "triad-types",
        order: 1,
        theoryKey: "improv.modules.triad-types.theory",
        embed: { tool: "triad-visualizer" },
        supplementary: [{ labelKey: "improv.supplementary.chordQuality", href: "/ear-training/chord-quality" }],
        exercises: [
            choiceExercise("triad-types", "e1", "triadType", 10),
            choiceExercise("triad-types", "e2", "triadBuild", 10, "tap-chord-tone"),
        ],
    },
    {
        id: "triad-inversions",
        order: 2,
        theoryKey: "improv.modules.triad-inversions.theory",
        embed: { tool: "triad-visualizer", root: "C" },
        exercises: [
            choiceExercise("triad-inversions", "e1", "triadInversion", 10),
            voicingExercise("triad-inversions", "e2", { mode: "inversions", chords: ["C"], stringSets: [TOP] }),
            voicingExercise("triad-inversions", "e3", { mode: "inversions", chords: ["Am"], stringSets: [TOP], nonGating: true }),
        ],
    },
    {
        id: "triad-diatonic",
        order: 3,
        theoryKey: "improv.modules.triad-diatonic.theory",
        exercises: [
            choiceExercise("triad-diatonic", "e1", "triadBuild", 10, "degree-to-triad"),
            voicingExercise("triad-diatonic", "e2", { mode: "path", chords: DIATONIC_C, stringSets: [TOP], startFret: 0 }),
            voicingExercise("triad-diatonic", "e3", { mode: "path", chords: DIATONIC_C, stringSets: [MIDDLE], startFret: 2, nonGating: true }),
        ],
    },

    /* ─────────── Stage II: the fretboard map ─────────── */
    {
        id: "triads-top",
        order: 4,
        theoryKey: "improv.modules.triads-top.theory",
        exercises: [
            voicingExercise("triads-top", "e1", { mode: "inversions", chords: ["C", "Cm"], stringSets: [TOP] }),
            loopExercise("triads-top", "e2", loop({ progression: POP_G, goalKey: "improv.goals.triadsComp", voicing: { strings: TOP, startFret: 7 } })),
            voicingExercise("triads-top", "e3", { mode: "inversions", chords: ["Cdim", "Caug"], stringSets: [TOP], requiredRuns: 1, nonGating: true }),
        ],
    },
    {
        id: "triads-middle",
        order: 5,
        theoryKey: "improv.modules.triads-middle.theory",
        exercises: [
            voicingExercise("triads-middle", "e1", { mode: "inversions", chords: ["G", "Gm"], stringSets: [MIDDLE] }),
            loopExercise("triads-middle", "e2", loop({ progression: POP_G, goalKey: "improv.goals.triadsComp", voicing: { strings: MIDDLE, startFret: 5 } })),
            voicingExercise("triads-middle", "e3", { mode: "inversions", chords: ["Gdim", "Gaug"], stringSets: [MIDDLE], requiredRuns: 1, nonGating: true }),
        ],
    },
    {
        id: "triads-low",
        order: 6,
        theoryKey: "improv.modules.triads-low.theory",
        exercises: [
            voicingExercise("triads-low", "e1", { mode: "inversions", chords: ["D", "Dm"], stringSets: [LOW_MIDDLE, LOW] }),
            loopExercise("triads-low", "e2", loop({ progression: POP_G, goalKey: "improv.goals.triadsComp", voicing: { strings: LOW_MIDDLE, startFret: 5 }, nonGating: true })),
            voicingExercise("triads-low", "e3", { mode: "inversions", chords: ["Ddim", "Daug"], stringSets: [LOW_MIDDLE, LOW], requiredRuns: 1, nonGating: true }),
        ],
    },
    {
        id: "triads-caged",
        order: 7,
        theoryKey: "improv.modules.triads-caged.theory",
        embed: { tool: "caged" },
        exercises: [
            voicingExercise("triads-caged", "e1", { mode: "inversions", chords: ["G"], stringSets: [TOP, MIDDLE, LOW_MIDDLE, LOW], requiredRuns: 4 }),
            loopExercise("triads-caged", "e2", loop({ progression: ["G", "C", "D", "G"], goalKey: "improv.goals.triadsOnePosition", voicing: { strings: MIDDLE, startFret: 4 } })),
        ],
    },

    /* ─────────── Stage III: voice leading ─────────── */
    {
        id: "vl-common-tones",
        order: 8,
        theoryKey: "improv.modules.vl-common-tones.theory",
        exercises: [
            choiceExercise("vl-common-tones", "e1", "voiceLeading", 10),
            voicingExercise("vl-common-tones", "e2", { mode: "path", chords: ["C", "F", "G", "C"], stringSets: [TOP, MIDDLE] }),
            voicingExercise("vl-common-tones", "e3", { mode: "path", chords: ["Am", "Dm", "E", "Am"], stringSets: [TOP, MIDDLE], nonGating: true }),
        ],
    },
    {
        id: "vl-progressions",
        order: 9,
        theoryKey: "improv.modules.vl-progressions.theory",
        exercises: [
            loopExercise("vl-progressions", "e1", loop({
                progression: PROGRESSIONS[0].progression,
                goalKey: `improv.goals.${PROGRESSIONS[0].id}`,
                key: "C",
                requiredPasses: 1,
                voicing: { strings: TOP, startFret: 5 },
                topVoiceTargets: true,
                variants: progressionVariants,
            })),
            loopExercise("vl-progressions", "e2", loop({
                progression: PROGRESSIONS[0].progression,
                goalKey: `improv.goals.${PROGRESSIONS[0].id}`,
                key: "C",
                requiredPasses: 1,
                voicing: { strings: MIDDLE, startFret: 5 },
                topVoiceTargets: true,
                variants: progressionVariants,
                nonGating: true,
            })),
        ],
    },
    {
        id: "vl-cycles",
        order: 10,
        theoryKey: "improv.modules.vl-cycles.theory",
        exercises: [
            voicingExercise("vl-cycles", "e1", { mode: "path", chords: CYCLE_MAJOR, stringSets: [TOP, MIDDLE], startFret: 1, requiredRuns: 1 }),
            loopExercise("vl-cycles", "e2", loop({
                progression: CYCLE_MAJOR, goalKey: "improv.goals.vlCycle", key: "C", requiredPasses: 1, voicing: { strings: TOP, startFret: 1 },
            })),
            voicingExercise("vl-cycles", "e3", { mode: "path", chords: CYCLE_MINOR, stringSets: [TOP, MIDDLE], startFret: 1, requiredRuns: 1, nonGating: true }),
        ],
    },

    /* ─────────── Stage IV: use in a solo ─────────── */
    {
        id: "triad-melody",
        order: 11,
        theoryKey: "improv.modules.triad-melody.theory",
        exercises: [
            lickExercise("triad-melody", ["triadArpC", "triadChanges"], false),
            loopExercise("triad-melody", "e1", loop({
                progression: ["C", "Am", "F", "G"],
                goalKey: "improv.goals.triadTonesOnly",
                key: "C",
                targets: [
                    { chord: "C", pitchClasses: ["C", "E", "G"] },
                    { chord: "Am", pitchClasses: ["A", "C", "E"] },
                    { chord: "F", pitchClasses: ["F", "A", "C"] },
                    { chord: "G", pitchClasses: ["G", "B", "D"] },
                ],
            })),
            loopExercise("triad-melody", "e2", loop({
                progression: ["C", "Am", "F", "G"], goalKey: "improv.goals.triadTopMelody", key: "C",
                voicing: { strings: TOP, startFret: 5 }, topVoiceTargets: true, nonGating: true,
            })),
        ],
    },
    {
        id: "triad-pairs",
        order: 12,
        theoryKey: "improv.modules.triad-pairs.theory",
        exercises: [
            drillExercise("triad-pairs", "e1", [{ shapeId: "triad-pair", defaultKey: "A", keys: ["A", "E", "D"] }], 0, 4, 60, 2),
            loopExercise("triad-pairs", "e2", loop({
                progression: [{ chord: "Am7", beats: 16, hintKey: "improv.hints.triadPairFG" }],
                goalKey: "improv.goals.triadPairs",
                key: "Am",
            })),
            lickExercise("triad-pairs", ["pairFG", "pairFGDown"]),
        ],
    },
];

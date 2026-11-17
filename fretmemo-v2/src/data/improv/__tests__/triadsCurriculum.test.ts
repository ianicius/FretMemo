import { describe, expect, it } from "vitest";
import { Chord, Note } from "tonal";
import { STANDARD_TUNING } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";
import { TRIADS_CURRICULUM } from "../triads";
import {
    isExercisePassed,
    isNonGating,
    type BackingLoopParams,
    type DiagramDrillParams,
    type ImprovExercise,
    type ProgressionEntry,
    type VoicingDrillParams,
} from "../curriculum";
import { getTrack } from "../tracks";
import { keyChoices, keyShiftInterval, loopKey, transposeChord } from "@/lib/improv/loopTools";
import { chordShape, chordVoicings, topVoiceTargets, voiceLeadPath, type ChordShape } from "@/lib/improv/voicings";
import { coversAllDegrees, tonicAnchorFret } from "@/lib/improv/scaleShapes";
import { generateChoiceQuiz } from "@/lib/improv/questions";
import { INVERSION_KEYS, commonTones, voiceMoves } from "@/lib/improv/triadQuestions";

/** Order of the triads track (gauntlet/triads-training/sources/triads-plan.md, section 3). */
const EXPECTED_ORDER = [
    "triad-types",
    "triad-inversions",
    "triad-diatonic",
    "triads-top",
    "triads-middle",
    "triads-low",
    "triads-caged",
    "vl-common-tones",
    "vl-progressions",
    "vl-cycles",
    "triad-melody",
    "triad-pairs",
];

const TUNING = STANDARD_TUNING as NoteName[];
const exercises = TRIADS_CURRICULUM.flatMap((module) => module.exercises);
const byEngine = (engine: ImprovExercise["engine"]) => exercises.filter((exercise) => exercise.engine === engine);
const chordsOf = (progression: Array<string | ProgressionEntry>) => progression.map((entry) => (typeof entry === "string" ? entry : entry.chord));
const shapes = (chords: string[]) => chords.map(chordShape).filter((shape): shape is ChordShape => shape !== null);

/** The chords of a progression moved into every key the selector offers. */
function inEveryKey(chords: string[], key?: string): string[][] {
    const original = loopKey(key, chords[0] ?? "C");
    return keyChoices(original).map((target) => chords.map((chord) => transposeChord(chord, keyShiftInterval(original, target))));
}

describe("triads curriculum", () => {
    it("has 12 modules in the planned order, each with a gating exercise, in its own track", () => {
        expect(TRIADS_CURRICULUM.map((module) => module.id)).toEqual(EXPECTED_ORDER);
        expect(getTrack("voicings")?.modules).toBe(TRIADS_CURRICULUM);
        const ids = exercises.map((exercise) => exercise.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const module of TRIADS_CURRICULUM) {
            expect(module.exercises.every((exercise) => exercise.id.startsWith(`${module.id}.`)), module.id).toBe(true);
            expect(module.exercises.some((exercise) => !isNonGating(exercise)), module.id).toBe(true);
        }
    });

    it("finds a voicing for every chord of every voicing drill, on every string set and in every key", () => {
        for (const exercise of byEngine("voicing-drill")) {
            const params = exercise.params as VoicingDrillParams;
            for (const chords of inEveryKey(params.chords, params.key)) {
                expect(shapes(chords), `${exercise.id} ${chords}`).toHaveLength(chords.length);
                for (const strings of params.stringSets) {
                    if (params.mode === "inversions") {
                        for (const shape of shapes(chords)) {
                            // The drill walks every inversion, so each one must exist.
                            const inversions = new Set(chordVoicings(shape, strings, TUNING).map((voicing) => voicing.inversion));
                            expect(inversions.size, `${exercise.id} ${chords} ${strings}`).toBe(3);
                        }
                    } else {
                        expect(voiceLeadPath(shapes(chords), strings, TUNING, { startFret: params.startFret }), `${exercise.id} ${chords[0]} ${strings}`)
                            .toHaveLength(chords.length);
                    }
                }
            }
        }
    });

    it("gives every voiced loop one voicing per chord and top-voice targets that are chord tones, in every key", () => {
        for (const exercise of byEngine("backing-improv")) {
            const params = exercise.params as BackingLoopParams;
            if (!params.voicing) continue;
            const progressions = [{ progression: params.progression, key: params.key }, ...(params.variants ?? [])];
            for (const { progression, key } of progressions) {
                for (const chords of inEveryKey(chordsOf(progression), key ?? params.key)) {
                    const path = voiceLeadPath(shapes(chords), params.voicing.strings, TUNING, { startFret: params.voicing.startFret });
                    expect(path, `${exercise.id} ${chords}`).toHaveLength(chords.length);
                    for (const target of topVoiceTargets(chords, path, TUNING)) {
                        const tones = Chord.get(target.chord).notes.map((note) => Note.chroma(note));
                        for (const pitchClass of target.pitchClasses) expect(tones, `${exercise.id} ${target.chord}`).toContain(Note.chroma(pitchClass));
                    }
                }
            }
        }
    });

    it("aims fixed microphone targets at chord tones", () => {
        for (const exercise of byEngine("backing-improv")) {
            for (const target of (exercise.params as BackingLoopParams).targets ?? []) {
                const tones = Chord.get(target.chord).notes.map((note) => Note.chroma(note));
                for (const pitchClass of target.pitchClasses) expect(tones, `${exercise.id} ${target.chord}`).toContain(Note.chroma(pitchClass));
            }
        }
    });

    it("shows every degree of the triad-pair scale in its window", () => {
        for (const exercise of byEngine("diagram-drill")) {
            const params = exercise.params as DiagramDrillParams;
            for (const shape of params.shapes) {
                for (const key of shape.keys ?? [shape.defaultKey]) {
                    const anchor = tonicAnchorFret(key);
                    expect(coversAllDegrees(shape.shapeId, key, { fretFrom: anchor + params.offsetsFrom, fretTo: anchor + params.offsetsTo }), `${exercise.id} ${key}`).toBe(true);
                }
            }
        }
    });

    it("passes a voicing drill after its required runs", () => {
        const drill = byEngine("voicing-drill")[0] as ImprovExercise;
        const required = (drill.params as VoicingDrillParams).requiredRuns;
        expect(isExercisePassed(drill, { exerciseRuns: { [drill.id]: required - 1 } })).toBe(false);
        expect(isExercisePassed(drill, { exerciseRuns: { [drill.id]: required } })).toBe(true);
    });
});

describe("triad quiz generators", () => {
    it("knows inversions, common tones and the shortest voice moves", () => {
        expect(commonTones("C", "Am")).toEqual(["C", "E"]);
        expect(commonTones("C", "Dm")).toEqual([]);
        expect(voiceMoves("C", "F")).toEqual(["C", "F", "A"]);
        // G B D → C: G stays, B goes up to C, D goes up to E.
        expect(voiceMoves("G", "C")).toEqual(["G", "C", "E"]);
    });

    it("asks questions with one correct answer among distinct options", () => {
        for (const generatorId of ["triadInversion", "voiceLeading"] as const) {
            for (const question of generateChoiceQuiz({ generatorId, questionCount: 80 }, `triads:${generatorId}`)) {
                expect(new Set(question.options).size, question.promptKey).toBe(question.options.length);
                expect(question.options.length, question.promptKey).toBeGreaterThanOrEqual(3);
                expect(question.correctIndex, question.promptKey).toBeGreaterThanOrEqual(0);
            }
        }
        // C with E in the bass is the first inversion.
        const question = generateChoiceQuiz({ generatorId: "triadInversion", questionCount: 200, direction: "bass-to-inversion" }, "c-e")
            .find((item) => item.promptValues.chord === "C" && item.promptValues.root === "E");
        expect(question?.options[question.correctIndex]).toBe(INVERSION_KEYS[1]);
    });
});

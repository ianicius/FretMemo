import { describe, expect, it } from "vitest";
import { Chord, Note } from "tonal";
import { STANDARD_TUNING } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";
import { SEVENTHS_CURRICULUM } from "../sevenths";
import { isNonGating, type BackingLoopParams, type DiagramDrillParams, type ImprovExercise, type ProgressionEntry, type VoicingDrillParams } from "../curriculum";
import { getTrack } from "../tracks";
import { keyChoices, keyShiftInterval, loopKey, transposeChord } from "@/lib/improv/loopTools";
import { chordShape, chordVoicings, topVoiceTargets, voiceLeadPath, type ChordShape } from "@/lib/improv/voicings";
import { coversAllDegrees, tonicAnchorFret } from "@/lib/improv/scaleShapes";

/** Order of the seventh-chords track (gauntlet/sevenths-training/sources/sevenths-plan.md, section 3). */
const EXPECTED_ORDER = [
    "seventh-types",
    "seventh-diatonic",
    "shells-sixth",
    "shells-fifth",
    "shells-251",
    "drop2-top",
    "drop2-middle",
    "drop2-251",
    "drop3",
    "guide-tones",
    "comping-rhythm",
    "comping-standards",
];

const TUNING = STANDARD_TUNING as NoteName[];
const exercises = SEVENTHS_CURRICULUM.flatMap((module) => module.exercises);
const byEngine = (engine: ImprovExercise["engine"]) => exercises.filter((exercise) => exercise.engine === engine);
const chordsOf = (progression: Array<string | ProgressionEntry>) => progression.map((entry) => (typeof entry === "string" ? entry : entry.chord));
const shapes = (chords: string[]) => chords.map(chordShape).filter((shape): shape is ChordShape => shape !== null);

function inEveryKey(chords: string[], key?: string): string[][] {
    const original = loopKey(key, chords[0] ?? "C");
    return keyChoices(original).map((target) => chords.map((chord) => transposeChord(chord, keyShiftInterval(original, target))));
}

describe("seventh chords curriculum", () => {
    it("has 12 modules in the planned order, each with a gating exercise, in its own track", () => {
        expect(SEVENTHS_CURRICULUM.map((module) => module.id)).toEqual(EXPECTED_ORDER);
        expect(getTrack("sevenths")?.modules).toBe(SEVENTHS_CURRICULUM);
        const ids = exercises.map((exercise) => exercise.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const module of SEVENTHS_CURRICULUM) {
            expect(module.exercises.every((exercise) => exercise.id.startsWith(`${module.id}.`)), module.id).toBe(true);
            expect(module.exercises.some((exercise) => !isNonGating(exercise)), module.id).toBe(true);
        }
    });

    it("finds every voicing a drill walks through, on every string set and in every key", () => {
        for (const exercise of byEngine("voicing-drill")) {
            const params = exercise.params as VoicingDrillParams;
            const options = { orders: params.orders, maxSpan: params.maxSpan };
            for (const chords of inEveryKey(params.chords, params.key)) {
                expect(shapes(chords), `${exercise.id} ${chords}`).toHaveLength(chords.length);
                for (const strings of params.stringSets) {
                    if (params.mode === "inversions") {
                        for (const shape of shapes(chords)) {
                            // Every voicing order (each drop inversion or shell layout) must be playable somewhere.
                            const found = new Set(chordVoicings(shape, strings, TUNING, options).map((voicing) => voicing.tones.join()));
                            expect(found.size, `${exercise.id} ${chords} ${strings}`).toBe(params.orders?.length ?? 3);
                        }
                    } else {
                        const path = voiceLeadPath(shapes(chords), strings, TUNING, { ...options, startFret: params.startFret, layouts: params.layouts });
                        expect(path, `${exercise.id} ${chords[0]} ${strings}`).toHaveLength(chords.length);
                    }
                }
            }
        }
    });

    it("voices every chord of every loop in every key, with top-voice targets on chord tones", () => {
        for (const exercise of byEngine("backing-improv")) {
            const params = exercise.params as BackingLoopParams;
            const voicing = params.voicing;
            expect(voicing, exercise.id).toBeTruthy();
            if (!voicing) continue;
            for (const { progression, key } of [{ progression: params.progression, key: params.key }, ...(params.variants ?? [])]) {
                for (const chords of inEveryKey(chordsOf(progression), key ?? params.key)) {
                    const path = voiceLeadPath(shapes(chords), voicing.strings, TUNING, voicing);
                    expect(path, `${exercise.id} ${chords.join(" ")}`).toHaveLength(chords.length);
                    if (!params.topVoiceTargets) continue;
                    for (const target of topVoiceTargets(chords, path, TUNING)) {
                        const tones = Chord.get(target.chord).notes.map((note) => Note.chroma(note));
                        for (const pitchClass of target.pitchClasses) expect(tones, `${exercise.id} ${target.chord}`).toContain(Note.chroma(pitchClass));
                    }
                }
            }
        }
    });

    it("shows every degree of the arpeggio shapes in their window", () => {
        for (const exercise of byEngine("diagram-drill")) {
            const params = exercise.params as DiagramDrillParams;
            for (const shape of params.shapes) {
                const anchor = tonicAnchorFret(shape.defaultKey);
                expect(coversAllDegrees(shape.shapeId, shape.defaultKey, { fretFrom: anchor + params.offsetsFrom, fretTo: anchor + params.offsetsTo }), `${exercise.id} ${shape.shapeId}`).toBe(true);
            }
        }
    });
});

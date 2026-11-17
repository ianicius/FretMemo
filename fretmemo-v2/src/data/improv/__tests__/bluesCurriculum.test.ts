import { describe, expect, it } from "vitest";
import { Chord, Note } from "tonal";
import { BLUES_CURRICULUM, BLUES_JAM, twelveBar } from "../blues";
import {
    isExercisePassed,
    isExerciseVerified,
    isModuleComplete,
    isModuleUnlocked,
    isNonGating,
    loopRunKey,
    nextImprovExercise,
    dailySession,
    type BackingLoopParams,
    type BendDrillParams,
    type DiagramDrillParams,
    type ImprovExercise,
    type ProgressionEntry,
} from "../curriculum";
import { ALL_MODULES, TRACKS, getModule, getTrack, isExtraProgressId, trackOfModule } from "../tracks";
import { SCALE_SHAPES, coversAllDegrees, getShapePositions, tonicAnchorFret } from "@/lib/improv/scaleShapes";
import { generateChoiceQuiz } from "@/lib/improv/questions";
import { TWELVE_BAR_DEGREES, bluesChord } from "@/lib/improv/bluesQuestions";
import { useImprovStore } from "@/stores/useImprovStore";

/** Order of the blues track (gauntlet/blues-training/sources/blues-plan.md, section 3). */
const EXPECTED_ORDER = [
    "blues-form",
    "blues-shuffle",
    "blues-dominant-chords",
    "blues-pentatonic",
    "blues-bends",
    "blues-licks",
    "blues-phrasing",
    "blues-major-minor",
    "blues-boxes",
    "blues-turnarounds",
    "blues-chord-tones",
    "blues-guide-tones",
    "blues-forms",
    "blues-jazz-blues",
];

const exercises = BLUES_CURRICULUM.flatMap((module) => module.exercises);
const loops = [...exercises, BLUES_JAM].filter((exercise) => exercise.engine === "backing-improv");
const beatsOf = (progression: Array<string | ProgressionEntry>, beatsPerChord: number) =>
    progression.reduce((sum, entry) => sum + (typeof entry === "string" ? beatsPerChord : entry.beats ?? beatsPerChord), 0);
const progressionsOf = (params: BackingLoopParams) => [params.progression, ...(params.variants ?? []).map((variant) => variant.progression)];

describe("track registry", () => {
    it("keeps module ids, progress ids and track ids apart", () => {
        const moduleIds = ALL_MODULES.map((module) => module.id);
        expect(new Set(moduleIds).size).toBe(moduleIds.length);
        for (const track of TRACKS) {
            // A track id is also a route under /improv/, next to the module ids and "session".
            expect(moduleIds).not.toContain(track.id);
            expect(track.id).not.toBe("session");
            expect(track.modules.map((module) => module.order)).toEqual(track.modules.map((_, index) => index + 1));
            expect(track.stages[0].from).toBe(1);
            expect(track.stages[track.stages.length - 1].to).toBe(track.modules.length);
            if (track.extra) {
                expect(moduleIds).not.toContain(track.extra.id);
                expect(isExtraProgressId(track.extra.id)).toBe(true);
            }
        }
        expect(getTrack("blues")?.path).toBe("/improv/blues");
        expect(getTrack("blues-form")).toBeUndefined();
        expect(trackOfModule("blues-bends").id).toBe("blues");
        expect(trackOfModule("modes").id).toBe("improv");
        expect(getModule("blues-form")?.order).toBe(1);
    });

    it("unlocks and counts modules inside their own track", () => {
        const modules = BLUES_CURRICULUM;
        expect(isModuleUnlocked("blues-form", {}, false, null, modules)).toBe(true);
        expect(isModuleUnlocked("blues-shuffle", {}, false, null, modules)).toBe(false);
        expect(isModuleUnlocked("blues-shuffle", { "blues-form": { exerciseRuns: {}, completed: true } }, false, null, modules)).toBe(true);
        // Finishing the improv track does not open the blues one.
        expect(isModuleUnlocked("blues-shuffle", { "giant-steps": { exerciseRuns: {}, completed: true } }, false, null, modules)).toBe(false);
        expect(nextImprovExercise({}, modules)?.exercise.id).toBe("blues-form.e1");
        expect(dailySession({}, modules).every((step) => step.moduleId.startsWith("blues-"))).toBe(true);
    });

    it("stores progress of a blues module and of the jam", () => {
        useImprovStore.getState().resetProgress();
        useImprovStore.getState().recordLoopPass("blues-form", "blues-form.e3", undefined, true);
        useImprovStore.getState().recordLoopPass("blues-jam", "blues-jam.e1", "formSlow");
        const state = useImprovStore.getState().moduleState;
        expect(state["blues-form"].exerciseRuns["blues-form.e3"]).toBe(1);
        expect(state["blues-jam"].exerciseRuns[loopRunKey("blues-jam.e1", "formSlow")]).toBe(1);
        useImprovStore.getState().resetProgress();
    });
});

describe("blues curriculum", () => {
    it("has 14 modules in the planned order, each with a gating exercise", () => {
        expect(BLUES_CURRICULUM.map((module) => module.id)).toEqual(EXPECTED_ORDER);
        const ids = exercises.map((exercise) => exercise.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const module of BLUES_CURRICULUM) {
            expect(module.exercises.every((exercise) => exercise.id.startsWith(`${module.id}.`)), module.id).toBe(true);
            expect(module.exercises.some((exercise) => !isNonGating(exercise)), module.id).toBe(true);
            expect(isModuleComplete(module, { exerciseRuns: {} }), module.id).toBe(false);
        }
        expect(isNonGating(BLUES_JAM)).toBe(true);
    });

    it("writes the 12-bar form the way the quiz teaches it", () => {
        const form = twelveBar("A7", "D7", "E7");
        expect(form).toEqual(TWELVE_BAR_DEGREES.map((degree) => bluesChord("A", degree)));
        expect(twelveBar("A7", "D7", "E7", true)[1]).toBe("D7");
    });

    it("keeps every loop in whole bars, with a blues style and known chords", () => {
        for (const exercise of loops) {
            const params = exercise.params as BackingLoopParams;
            expect(params.style, exercise.id).toBeTruthy();
            for (const progression of progressionsOf(params)) {
                expect(beatsOf(progression, params.beatsPerChord) % 4, exercise.id).toBe(0);
                for (const entry of progression) {
                    const chord = typeof entry === "string" ? entry : entry.chord;
                    expect(Chord.get(chord).notes.length, `${exercise.id} ${chord}`).toBeGreaterThan(2);
                }
            }
        }
        // The plain form and the quick change are 12 bars; the long form is 16.
        const forms = loops.find((exercise) => exercise.id === "blues-forms.e2")?.params as BackingLoopParams;
        const bars = Object.fromEntries((forms.variants ?? []).map((variant) => [variant.id, beatsOf(variant.progression, 4) / 4]));
        expect(bars).toEqual({ formQuick: 12, formSlow: 12, formMinor: 12, formEight: 8, formSixteen: 16 });
    });

    it("aims every microphone target at a tone of its chord, and covers every chord of the loop", () => {
        for (const exercise of loops) {
            const params = exercise.params as BackingLoopParams;
            const sets = [{ progression: params.progression, targets: params.targets }, ...(params.variants ?? [])];
            for (const { progression, targets } of sets) {
                if (!targets) continue;
                for (const target of targets) {
                    const tones = Chord.get(target.chord).notes.map((note) => Note.chroma(note));
                    for (const pitchClass of target.pitchClasses) {
                        expect(tones, `${exercise.id} ${target.chord} ${pitchClass}`).toContain(Note.chroma(pitchClass));
                    }
                }
                const chords = new Set(progression.map((entry) => (typeof entry === "string" ? entry : entry.chord)));
                expect([...chords].filter((chord) => !targets.some((target) => target.chord === chord)), exercise.id).toEqual([]);
            }
        }
    });

    it("shows every degree of a shape inside its fret window", () => {
        for (const exercise of exercises.filter((item) => item.engine === "diagram-drill")) {
            const params = exercise.params as DiagramDrillParams;
            for (const shape of params.shapes) {
                for (const key of shape.keys ?? [shape.defaultKey]) {
                    const anchor = tonicAnchorFret(key);
                    const window = { fretFrom: Math.max(0, anchor + params.offsetsFrom), fretTo: anchor + params.offsetsTo };
                    if (!params.onlyStrings) {
                        expect(coversAllDegrees(shape.shapeId, key, window), `${exercise.id} ${shape.shapeId} ${key}`).toBe(true);
                        continue;
                    }
                    const seen = new Set(getShapePositions(shape.shapeId, key, window)
                        .filter((position) => params.onlyStrings?.includes(position.stringIndex))
                        .map((position) => position.degreeIndex));
                    expect(seen.size, `${exercise.id} ${shape.shapeId} ${key}`).toBe(SCALE_SHAPES[shape.shapeId].semitones.length);
                }
            }
        }
    });

    it("passes a bend drill only when every bend has its repetitions, and tracks verification", () => {
        const drill = exercises.find((exercise) => exercise.id === "blues-bends.e2") as ImprovExercise;
        const params = drill.params as BendDrillParams;
        expect(params.bends).toHaveLength(2);
        for (const bend of exercises.filter((exercise) => exercise.engine === "bend-drill").flatMap((exercise) => (exercise.params as BendDrillParams).bends)) {
            expect(bend.minCents).toBeLessThan(bend.maxCents);
            expect(bend.minCents).toBeGreaterThan(15); // above the release threshold
        }
        const runs = (count: number, ids: string[]) => Object.fromEntries(ids.map((id) => [loopRunKey(drill.id, id), count]));
        const all = params.bends.map((bend) => bend.id);
        expect(isExercisePassed(drill, { exerciseRuns: runs(params.requiredReps, all.slice(0, 1)) })).toBe(false);
        expect(isExercisePassed(drill, { exerciseRuns: runs(params.requiredReps, all) })).toBe(true);
        expect(isExerciseVerified(drill, { exerciseRuns: runs(params.requiredReps, all), verifiedRuns: runs(1, all) })).toBe(false);
        expect(isExerciseVerified(drill, { exerciseRuns: runs(params.requiredReps, all), verifiedRuns: runs(params.requiredReps, all) })).toBe(true);
    });

    it("asks blues questions with one correct answer among distinct options", () => {
        for (const generatorId of ["bluesForm", "bluesTones", "bluesScale"] as const) {
            const questions = generateChoiceQuiz({ generatorId, questionCount: 60 }, `blues:${generatorId}`);
            for (const question of questions) {
                expect(new Set(question.options).size, question.promptKey).toBe(question.options.length);
                expect(question.options.length, question.promptKey).toBeGreaterThanOrEqual(3);
                expect(question.correctIndex, question.promptKey).toBeGreaterThanOrEqual(0);
                expect(question.options.join(" "), question.promptKey).not.toMatch(/##|bb|E#|B#|Cb|Fb/);
            }
        }
        // A blues in A: bar 5 is D7, the blue note is Eb, the third of A7 falls to C over D7.
        const pick = (generatorId: "bluesForm" | "bluesTones" | "bluesScale", direction: string, match: (values: Record<string, string | number>) => boolean) =>
            generateChoiceQuiz({ generatorId, questionCount: 80, direction }, "blues-a").find((question) => match(question.promptValues));
        const bar5 = pick("bluesForm", "bar-to-chord", (values) => values.key === "A" && values.bar === 5);
        expect(bar5?.options[bar5.correctIndex]).toBe("D7");
        const quick = pick("bluesForm", "quick-change", (values) => values.key === "A" && values.bar === 2);
        expect(quick?.options[quick.correctIndex]).toBe("D7");
        const blue = pick("bluesScale", "blue-note", (values) => values.key === "A");
        expect(blue?.options[blue.correctIndex]).toBe("Eb");
        const relative = pick("bluesScale", "relative-box", (values) => values.key === "A");
        expect(relative?.options[relative.correctIndex]).toBe("F#m");
        const guide = pick("bluesTones", "guide-move", (values) => values.key === "A");
        expect(guide?.options[guide.correctIndex]).toBe("C");
    });
});

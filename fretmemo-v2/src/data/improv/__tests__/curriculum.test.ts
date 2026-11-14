import { describe, expect, it } from "vitest";
import {
    CURRICULUM,
    IMPROV_MODULE_COUNT,
    IMPROV_ORDER,
    countCompletedModules,
    getImprovExercise,
    getImprovModule,
    isExercisePassed,
    isModuleComplete,
    isModuleUnlocked,
    type BackingLoopParams,
    type ChoiceQuizParams,
    type DiagramDrillParams,
    type FretboardQuizParams,
} from "../curriculum";
import { coversAllDegrees, getShapePositions, resolveChordSemitones } from "@/lib/improv/scaleShapes";
import { Note } from "tonal";

/** Canonical order transcribed 1:1 from gauntlet/improv-training/sources/video-source-map.md. */
const EXPECTED_ORDER = [
    "e-string-notes",
    "key-signatures",
    "pentatonic-scale",
    "major-scale",
    "fretboard-notes",
    "pentatonic-positions",
    "modes",
    "chord-construction",
    "chord-scale-major",
    "triads",
    "arpeggios",
    "target-chord-tones",
    "voice-leading",
    "switching-keys",
    "tritone-subs",
    "secondary-dominants",
    "borrowed-chords",
    "melodic-minor",
    "chord-scale-melodic",
    "harmonic-minor",
    "chord-scale-harmonic",
    "giant-steps",
];

describe("improv curriculum", () => {
    it("contains exactly 22 modules in the canonical video order", () => {
        expect(CURRICULUM).toHaveLength(IMPROV_MODULE_COUNT);
        expect(IMPROV_ORDER).toEqual(EXPECTED_ORDER);
        expect(CURRICULUM.map((module) => module.id)).toEqual(IMPROV_ORDER);
    });

    it("has unique module ids and 1-based consecutive order fields", () => {
        expect(new Set(IMPROV_ORDER).size).toBe(IMPROV_MODULE_COUNT);
        CURRICULUM.forEach((module, index) => {
            expect(module.order).toBe(index + 1);
        });
    });

    it("gives every module ≥2 exercises with a pass threshold and unique ids", () => {
        const exerciseIds = new Set<string>();
        for (const module of CURRICULUM) {
            expect(module.exercises.length).toBeGreaterThanOrEqual(2);
            expect(module.theoryKey).toBe(`improv.modules.${module.id}.theory`);
            for (const exercise of module.exercises) {
                expect(exerciseIds.has(exercise.id)).toBe(false);
                exerciseIds.add(exercise.id);
                expect(exercise.nameKey).toBe(`improv.ex.${exercise.id}.name`);
                expect(exercise.descKey).toBe(`improv.ex.${exercise.id}.desc`);
                switch (exercise.engine) {
                    case "fretboard-quiz":
                    case "choice-quiz": {
                        const params = exercise.params as FretboardQuizParams | ChoiceQuizParams;
                        expect(params.requiredCorrect).toBeGreaterThan(0);
                        break;
                    }
                    case "diagram-drill": {
                        const params = exercise.params as DiagramDrillParams;
                        expect(params.requiredRuns).toBeGreaterThan(0);
                        expect(params.shapes.length).toBeGreaterThan(0);
                        break;
                    }
                    case "backing-improv": {
                        const params = exercise.params as BackingLoopParams;
                        expect(params.requiredPasses).toBeGreaterThan(0);
                        expect(params.progression.length).toBeGreaterThan(0);
                        break;
                    }
                }
            }
        }
        expect(exerciseIds.size).toBeGreaterThanOrEqual(44);
    });

    it("renders every diagram drill's default key without missing degrees", () => {
        for (const module of CURRICULUM) {
            for (const exercise of module.exercises) {
                if (exercise.engine !== "diagram-drill") continue;
                const params = exercise.params as DiagramDrillParams;
                for (const shape of params.shapes) {
                    expect(
                        coversAllDegrees(shape.shapeId, shape.defaultKey, {
                            fretFrom: params.fretFrom,
                            fretTo: params.fretTo,
                            triadQuality: shape.triadQuality,
                        }),
                    ).toBe(true);
                }
            }
        }
    });

    it("renders diagram drills with the pitch classes of the shape's default key (tonal-verified)", () => {
        // XP-1 regression guard: flat defaultKeys ("Bb" in pentatonic-positions
        // e2) must not fall back to pitch class 0 — the rendered box has to
        // match the tonic, and root emphasis has to sit on that tonic only.
        for (const module of CURRICULUM) {
            for (const exercise of module.exercises) {
                if (exercise.engine !== "diagram-drill") continue;
                const params = exercise.params as DiagramDrillParams;
                for (const shape of params.shapes) {
                    const options = {
                        fretFrom: params.fretFrom,
                        fretTo: params.fretTo,
                        triadQuality: shape.triadQuality,
                    };
                    const rootPc = Note.chroma(shape.defaultKey) ?? 0;
                    const expectedPcs = resolveChordSemitones(shape.shapeId, shape.triadQuality)
                        .map((offset) => (rootPc + offset) % 12)
                        .sort((a, b) => a - b);
                    const positions = getShapePositions(shape.shapeId, shape.defaultKey, options);
                    const renderedPcs = [...new Set(positions.map((p) => Note.chroma(p.note) ?? 0))]
                        .sort((a, b) => a - b);
                    expect(renderedPcs).toEqual(expectedPcs);
                    const roots = positions.filter((p) => p.isRoot);
                    expect(roots.length).toBeGreaterThan(0);
                    expect(roots.every((p) => (Note.chroma(p.note) ?? 0) === rootPc)).toBe(true);
                    expect(positions.filter((p) => (Note.chroma(p.note) ?? 0) === rootPc)).toHaveLength(roots.length);
                }
            }
        }
    });

    it("covers all four engine types across the curriculum", () => {
        const engines = new Set(CURRICULUM.flatMap((module) => module.exercises.map((exercise) => exercise.engine)));
        expect([...engines].sort()).toEqual(["backing-improv", "choice-quiz", "diagram-drill", "fretboard-quiz"].sort());
    });

    it("unlocks modules sequentially and honors unlockAll", () => {
        const first = EXPECTED_ORDER[0] as string;
        const second = EXPECTED_ORDER[1] as string;
        expect(isModuleUnlocked(first, {}, false)).toBe(true);
        expect(isModuleUnlocked(second, {}, false)).toBe(false);
        expect(isModuleUnlocked(second, {}, true)).toBe(true);

        // Passing module 1 (both quizzes 10/10) unlocks module 2.
        const firstModule = getImprovModule(first) as NonNullable<ReturnType<typeof getImprovModule>>;
        const progress = {
            quizBest: 10,
            drillsDone: [] as string[],
            exerciseRuns: {} as Record<string, number>,
            completed: false,
        };
        expect(isModuleComplete(firstModule, progress)).toBe(true);
        expect(isModuleUnlocked(second, { [first]: progress }, false)).toBe(true);
    });

    it("completes a module only when every exercise passed (drill + loop counters)", () => {
        const loopModule = getImprovModule("target-chord-tones") as NonNullable<ReturnType<typeof getImprovModule>>;
        const e1 = getImprovExercise("target-chord-tones", "target-chord-tones.e1") as NonNullable<ReturnType<typeof getImprovExercise>>;
        const requiredPasses = (e1.params as BackingLoopParams).requiredPasses;

        const partial = { quizBest: 0, drillsDone: [] as string[], exerciseRuns: { "target-chord-tones.e1": requiredPasses - 1 }, completed: false };
        expect(isExercisePassed(e1, partial)).toBe(false);
        expect(isModuleComplete(loopModule, partial)).toBe(false);

        const full = {
            quizBest: 0,
            drillsDone: ["target-chord-tones.e1", "target-chord-tones.e2"],
            exerciseRuns: {
                "target-chord-tones.e1": requiredPasses,
                "target-chord-tones.e2": requiredPasses,
            },
            completed: false,
        };
        expect(isModuleComplete(loopModule, full)).toBe(true);
        expect(countCompletedModules({ "target-chord-tones": full })).toBe(1);
    });

    it("quiz modules complete on the requiredCorrect threshold", () => {
        const module = getImprovModule("key-signatures") as NonNullable<ReturnType<typeof getImprovModule>>;
        const failing = { quizBest: 7, drillsDone: [], exerciseRuns: {}, completed: false };
        const passing = { quizBest: 8, drillsDone: [], exerciseRuns: {}, completed: false };
        expect(isModuleComplete(module, failing)).toBe(false);
        expect(isModuleComplete(module, passing)).toBe(true);
    });
});

import { describe, expect, it } from "vitest";
import {
    CURRICULUM,
    IMPROV_MODULE_COUNT,
    IMPROV_ORDER,
    QUIZ_PASSED_ATTEMPTS,
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
import { tritoneSub } from "@/lib/improv/questions";
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

        // Passing module 1 (both quizzes with 2 passed attempts each) unlocks module 2.
        const firstModule = getImprovModule(first) as NonNullable<ReturnType<typeof getImprovModule>>;
        const progress = {
            exerciseRuns: {
                "e-string-notes.e1": QUIZ_PASSED_ATTEMPTS,
                "e-string-notes.e2": QUIZ_PASSED_ATTEMPTS,
            } as Record<string, number>,
            completed: false,
        };
        expect(isModuleComplete(firstModule, progress)).toBe(true);
        expect(isModuleUnlocked(second, { [first]: progress }, false)).toBe(true);
    });

    it("completes a module only when every exercise passed (drill + loop counters)", () => {
        const loopModule = getImprovModule("target-chord-tones") as NonNullable<ReturnType<typeof getImprovModule>>;
        const e1 = getImprovExercise("target-chord-tones", "target-chord-tones.e1") as NonNullable<ReturnType<typeof getImprovExercise>>;
        const requiredPasses = (e1.params as BackingLoopParams).requiredPasses;

        const partial = { exerciseRuns: { "target-chord-tones.e1": requiredPasses - 1 } as Record<string, number>, completed: false };
        expect(isExercisePassed(e1, partial)).toBe(false);
        expect(isModuleComplete(loopModule, partial)).toBe(false);

        const full = {
            exerciseRuns: {
                "target-chord-tones.e1": requiredPasses,
                "target-chord-tones.e2": requiredPasses,
            } as Record<string, number>,
            completed: false,
        };
        expect(isModuleComplete(loopModule, full)).toBe(true);
        expect(countCompletedModules({ "target-chord-tones": full })).toBe(1);
    });

    it("quiz exercises pass only after two passed attempts (plan 1.3)", () => {
        const module = getImprovModule("key-signatures") as NonNullable<ReturnType<typeof getImprovModule>>;
        const e1 = getImprovExercise("key-signatures", "key-signatures.e1") as NonNullable<ReturnType<typeof getImprovExercise>>;
        const oneAttempt = { exerciseRuns: { "key-signatures.e1": QUIZ_PASSED_ATTEMPTS - 1 } as Record<string, number>, completed: false };
        const twoAttempts = { exerciseRuns: { "key-signatures.e1": QUIZ_PASSED_ATTEMPTS } as Record<string, number>, completed: false };
        expect(isExercisePassed(e1, oneAttempt)).toBe(false);
        expect(isExercisePassed(e1, twoAttempts)).toBe(true);
        // One passed attempt alone must not complete the module.
        expect(isModuleComplete(module, oneAttempt)).toBe(false);
        // Both exercises, two passed attempts each → module complete.
        const bothExercisesTwice = {
            exerciseRuns: {
                "key-signatures.e1": QUIZ_PASSED_ATTEMPTS,
                "key-signatures.e2": QUIZ_PASSED_ATTEMPTS,
            } as Record<string, number>,
            completed: false,
        };
        expect(isModuleComplete(module, bothExercisesTwice)).toBe(true);
    });

    it("module 6 drills five boxes of one pentatonic: same five pitches, two notes per string (plan 0.2)", () => {
        const module = getImprovModule("pentatonic-positions") as NonNullable<ReturnType<typeof getImprovModule>>;
        const allowedPcs = new Set(["G", "Bb", "C", "D", "F"].map((note) => Note.chroma(note)));
        for (const exercise of module.exercises) {
            const params = exercise.params as DiagramDrillParams;
            for (const shape of params.shapes) {
                expect(shape.shapeId).toBe("min-pent");
                expect(shape.defaultKey).toBe("G");
                const positions = getShapePositions(shape.shapeId, shape.defaultKey, {
                    fretFrom: params.fretFrom,
                    fretTo: params.fretTo,
                });
                expect(positions.length).toBeGreaterThan(0);
                for (const position of positions) {
                    expect(allowedPcs.has(Note.chroma(position.note))).toBe(true);
                }
                const perString = new Map<number, number>();
                for (const position of positions) {
                    perString.set(position.stringIndex, (perString.get(position.stringIndex) ?? 0) + 1);
                }
                for (const count of perString.values()) {
                    expect(count).toBe(2);
                }
            }
        }
    });

    it("module 15 subV variant plays the tritone sub of G7 (plan 0.3)", () => {
        const module = getImprovModule("tritone-subs") as NonNullable<ReturnType<typeof getImprovModule>>;
        const e2 = module.exercises.find((exercise) => exercise.id === "tritone-subs.e2") as NonNullable<ReturnType<typeof getImprovExercise>>;
        const params = e2.params as BackingLoopParams;
        const subvVariant = params.variants?.find((variant) => variant.id === "subv");
        expect(subvVariant).toBeDefined();
        expect(subvVariant?.progression).toEqual(["Dm7", tritoneSub("G7"), "Cmaj7"]);
        expect(tritoneSub("G7")).toBe("Db7");
    });
});

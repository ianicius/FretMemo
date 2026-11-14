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
    practiceLinkPositions,
    type BackingLoopParams,
    type ChoiceQuizParams,
    type PracticeLinkParams,
    type DiagramDrillParams,
} from "../curriculum";
import { coversAllDegrees, getShapePositions, shapeSemitones, tonicAnchorFret } from "@/lib/improv/scaleShapes";
import { loopRunKey, micLoopPass } from "../curriculum";
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
                    case "choice-quiz": {
                        const params = exercise.params as ChoiceQuizParams;
                        expect(params.requiredCorrect).toBeGreaterThan(0);
                        break;
                    }
                    case "practice-link": {
                        const params = exercise.params as PracticeLinkParams;
                        expect(params.enabledStrings.length).toBeGreaterThan(0);
                        expect(params.minAnswers).toBeGreaterThan(0);
                        expect(params.minAccuracy).toBeGreaterThan(0);
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
                    const anchor = tonicAnchorFret(shape.defaultKey);
                    expect(
                        coversAllDegrees(shape.shapeId, shape.defaultKey, {
                            fretFrom: anchor + params.offsetsFrom,
                            fretTo: anchor + params.offsetsTo,
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
                    const anchor = tonicAnchorFret(shape.defaultKey);
                    const options = {
                        fretFrom: anchor + params.offsetsFrom,
                        fretTo: anchor + params.offsetsTo,
                    };
                    const rootPc = Note.chroma(shape.defaultKey) ?? 0;
                    const expectedPcs = shapeSemitones(shape.shapeId)
                        .map((offset: number) => (rootPc + offset) % 12)
                        .sort((a: number, b: number) => a - b);
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
        expect([...engines].sort()).toEqual(["backing-improv", "choice-quiz", "diagram-drill", "practice-link"].sort());
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

        // e1 has four ladder levels: each variant needs its own passes.
        const variants = (e1.params as BackingLoopParams).variants ?? [];
        expect(variants.map((variant) => variant.id)).toEqual(["root", "third", "fifth", "seventh"]);
        const onlyRoots = {
            exerciseRuns: {
                [loopRunKey(e1.id, "root")]: requiredPasses,
                "target-chord-tones.e2": requiredPasses,
                "target-chord-tones.e3": requiredPasses,
            } as Record<string, number>,
            completed: false,
        };
        expect(isExercisePassed(e1, onlyRoots)).toBe(false);
        const full = {
            exerciseRuns: {
                ...Object.fromEntries(variants.map((variant) => [loopRunKey(e1.id, variant.id), requiredPasses])),
                "target-chord-tones.e2": requiredPasses,
                "target-chord-tones.e3": requiredPasses,
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
            if (exercise.engine !== "diagram-drill") continue;
            const params = exercise.params as DiagramDrillParams;
            for (const shape of params.shapes) {
                expect(shape.shapeId).toBe("min-pent");
                expect(shape.defaultKey).toBe("G");
                const gAnchor = 3; // tonic G on the low E string
                const positions = getShapePositions(shape.shapeId, shape.defaultKey, {
                    fretFrom: gAnchor + params.offsetsFrom,
                    fretTo: gAnchor + params.offsetsTo,
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

    it("mic pass requires 3/4 hits and module 12 variants carry per-degree targets (plan phase 4)", () => {
        const module = getImprovModule("target-chord-tones") as NonNullable<ReturnType<typeof getImprovModule>>;
        const e1 = module.exercises.find((exercise) => exercise.id === "target-chord-tones.e1") as NonNullable<ReturnType<typeof getImprovExercise>>;
        const params = e1.params as BackingLoopParams;
        const third = params.variants?.find((variant) => variant.id === "third");
        const targetsByChord = new Map((third?.targets ?? []).map((entry) => [entry.chord, entry.pitchClasses]));
        // Thirds of Am–C–Em–D: C, E, G, F#.
        expect(targetsByChord.get("Am")).toEqual(["C"]);
        expect(targetsByChord.get("C")).toEqual(["E"]);
        expect(targetsByChord.get("Em")).toEqual(["G"]);
        expect(targetsByChord.get("D")).toEqual(["F#"]);
    });
});

describe("micLoopPass", () => {
    it("requires ceil(3/4) of the chord changes", () => {
        expect(micLoopPass(3, 4)).toBe(true);
        expect(micLoopPass(2, 4)).toBe(false);
        expect(micLoopPass(5, 7)).toBe(false); // ceil(21/4) = 6
        expect(micLoopPass(6, 7)).toBe(true);
        expect(micLoopPass(1, 1)).toBe(true);
    });
});

    it("practice-link criteria exclude open strings — module 1 is passable (user report)", () => {
        const module = getImprovModule("e-string-notes") as NonNullable<ReturnType<typeof getImprovModule>>;
        for (const exercise of module.exercises) {
            const params = exercise.params as PracticeLinkParams;
            const positions = practiceLinkPositions(params as PracticeLinkParams);
            expect(positions.length).toBeGreaterThan(0);
            // Fret 0 never appears: Practice clamps minFret to 1, so an open
            // string position could never be mastered.
            expect(positions.every((position) => position.fret >= 1)).toBe(true);
            expect(positions.every((position) => position.fret <= params.offsetsTo)).toBe(true);
            expect(positions.every((position) => params.enabledStrings.includes(position.stringIndex))).toBe(true);
        }
        // Module 5 (all strings, frets 0–12): 6 strings × frets 1–12 = 72.
        const m5 = getImprovModule("fretboard-notes") as NonNullable<ReturnType<typeof getImprovModule>>;
        for (const exercise of m5.exercises) {
            expect(practiceLinkPositions(exercise.params as PracticeLinkParams)).toHaveLength(72);
        }
    });

    it("non-gating practice-link (playNotes) never blocks module completion (plan 5 fix)", () => {
        const module = getImprovModule("pentatonic-scale") as NonNullable<ReturnType<typeof getImprovModule>>;
        const e3 = module.exercises.find((exercise) => exercise.id === "pentatonic-scale.e3") as NonNullable<ReturnType<typeof getImprovExercise>>;
        expect((e3.params as PracticeLinkParams).nonGating).toBe(true);
        // Only drills + loop gate the module: empty runs still complete it
        // once the gating exercises meet their thresholds.
        const gatingMet = {
            exerciseRuns: {
                "pentatonic-scale.e1": 2,
                "pentatonic-scale.e2": 2,
                "pentatonic-scale.e4": 2,
                "pentatonic-scale.e5": 2,
            } as Record<string, number>,
            completed: false,
        };
        expect(isModuleComplete(module, gatingMet)).toBe(true);
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

    it("drills of one module show different positions (audit: no duplicate diagrams)", () => {
        for (const module of CURRICULUM) {
            const windows = module.exercises
                .filter((exercise) => exercise.engine === "diagram-drill")
                .map((exercise) => {
                    const params = exercise.params as DiagramDrillParams;
                    return `${params.shapes.map((shape) => shape.shapeId).join()}:${params.offsetsFrom}:${params.offsetsTo}`;
                });
            expect(new Set(windows).size, module.id).toBe(windows.length);
        }
    });

    it("Giant Steps loop is the real 16-bar form (64 beats, Coltrane changes)", () => {
        const e2 = getImprovExercise("giant-steps", "giant-steps.e2") as NonNullable<ReturnType<typeof getImprovExercise>>;
        const params = e2.params as BackingLoopParams;
        const entries = params.progression.map((entry) => (typeof entry === "string" ? { chord: entry, beats: params.beatsPerChord } : entry));
        expect(entries.reduce((sum, entry) => sum + (entry.beats ?? params.beatsPerChord), 0)).toBe(64);
        expect(entries.slice(0, 4).map((entry) => entry.chord)).toEqual(["Bmaj7", "D7", "Gmaj7", "Bb7"]);
        expect(entries.some((entry) => entry.chord === "Bm7")).toBe(false);
        expect(params.variants?.map((variant) => variant.id)).toEqual(["roots", "pattern-1235", "arps"]);
    });

    it("noteToTab links in modules 1/5 are extra practice (same position stats as fretboardToNote)", () => {
        for (const [moduleId, id] of [["e-string-notes", "e-string-notes.e2"], ["fretboard-notes", "fretboard-notes.e2"]] as const) {
            const exercise = getImprovExercise(moduleId, id) as NonNullable<ReturnType<typeof getImprovExercise>>;
            expect((exercise.params as PracticeLinkParams).nonGating).toBe(true);
        }
    });

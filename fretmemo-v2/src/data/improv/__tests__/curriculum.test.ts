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
    isExerciseVerified,
    isModuleComplete,
    isModuleUnlocked,
    practiceLinkPositions,
    type BackingLoopParams,
    type ChoiceQuizParams,
    type PracticeLinkParams,
    type DiagramDrillParams,
    BUILD_STARTS,
} from "../curriculum";
import {
    MODE_PENTATONIC, PENTATONIC_ADDITIONS, coversAllDegrees, getShapePositions, shapeSemitones, stackPositionKeys, stringShapes, tonicAnchorFret,
    type ScaleShapeId,
} from "@/lib/improv/scaleShapes";
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
            // Plan C4–C6 extras are not single boxes.
            if (params.buildStarts || params.diagonal || params.onlyString !== undefined) continue;
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

    it("A2: a loop passed only with self-marked runs is passed but not verified; verified counters alone pass it", () => {
        const exercise = getImprovExercise("target-chord-tones", "target-chord-tones.e1") as NonNullable<ReturnType<typeof getImprovExercise>>;
        const params = exercise.params as BackingLoopParams;
        const allVariants = (count: number) => Object.fromEntries(
            (params.variants ?? []).map((variant) => [loopRunKey(exercise.id, variant.id), count]),
        );
        const selfMarked = { exerciseRuns: allVariants(params.requiredPasses), verifiedRuns: {} };
        expect(isExercisePassed(exercise, selfMarked)).toBe(true);
        expect(isExerciseVerified(exercise, selfMarked)).toBe(false);
        const micVerified = { exerciseRuns: allVariants(params.requiredPasses), verifiedRuns: allVariants(params.requiredPasses) };
        expect(isExerciseVerified(exercise, micVerified)).toBe(true);
        // Legacy state without verifiedRuns counts as unverified.
        expect(isExerciseVerified(exercise, { exerciseRuns: allVariants(params.requiredPasses) })).toBe(false);
    });

    it("A4: the module 7 mixolydian variant is G7–F (no C major tonic chord)", () => {
        const exercise = getImprovExercise("modes", "modes.e3") as NonNullable<ReturnType<typeof getImprovExercise>>;
        const variant = (exercise.params as BackingLoopParams).variants?.find((item) => item.id === "mixolydian");
        const chords = (variant?.progression ?? []).map((entry) => (typeof entry === "string" ? entry : entry.chord));
        expect(chords).toEqual(["G7", "F"]);
        expect(chords.some((chord) => /^C(maj7|6|M7)?$/.test(chord))).toBe(false);
    });

    it("A5: module 11 has four arpeggio drills (m7, 7, maj7, m7b5) with full six-string windows", () => {
        const module = getImprovModule("arpeggios") as NonNullable<ReturnType<typeof getImprovModule>>;
        const drills = module.exercises.filter((exercise) => exercise.engine === "diagram-drill");
        expect(drills).toHaveLength(4);
        const shapes = drills.map((exercise) => (exercise.params as DiagramDrillParams).shapes[0]?.shapeId);
        expect(shapes).toEqual(["m7-arp", "dom7-arp", "maj7-arp", "m7b5-arp"]);
        for (const exercise of drills) {
            const params = exercise.params as DiagramDrillParams;
            const shape = params.shapes[0] as NonNullable<DiagramDrillParams["shapes"][number]>;
            const anchor = tonicAnchorFret(shape.defaultKey);
            const options = { fretFrom: anchor + params.offsetsFrom, fretTo: anchor + params.offsetsTo };
            expect(coversAllDegrees(shape.shapeId, shape.defaultKey, options), exercise.id).toBe(true);
            const strings = new Set(getShapePositions(shape.shapeId, shape.defaultKey, options).map((p) => p.stringIndex));
            expect(strings.size, exercise.id).toBe(6);
        }
    });

    it("B4: modules 3 and 12 have non-gating play/rest and 2+2 question–answer variants with per-bar hints", () => {
        for (const [moduleId, exerciseId] of [["pentatonic-scale", "pentatonic-scale.e6"], ["target-chord-tones", "target-chord-tones.e4"]] as const) {
            const exercise = getImprovExercise(moduleId, exerciseId) as NonNullable<ReturnType<typeof getImprovExercise>>;
            expect(exercise.engine).toBe("backing-improv");
            const params = exercise.params as BackingLoopParams;
            expect(params.nonGating).toBe(true);
            expect(params.variants?.map((variant) => variant.id)).toEqual(["play-rest", "call-response"]);
            const hints = (id: string) => (params.variants?.find((variant) => variant.id === id)?.progression ?? [])
                .map((entry) => (typeof entry === "string" ? undefined : entry.hintKey));
            expect(hints("play-rest")).toEqual(["improv.hints.barPlay", "improv.hints.barRest", "improv.hints.barPlay", "improv.hints.barRest"]);
            expect(hints("call-response")).toEqual([
                "improv.hints.barQuestion1", "improv.hints.barQuestion2", "improv.hints.barAnswer1", "improv.hints.barAnswer2",
            ]);
            // Extra practice: the module completes without it.
            const module = getImprovModule(moduleId) as NonNullable<ReturnType<typeof getImprovModule>>;
            const runs: Record<string, number> = {};
            for (const other of module.exercises) {
                if (other.id === exerciseId) continue;
                runs[other.id] = 99;
                for (const variant of (other.params as BackingLoopParams).variants ?? []) runs[loopRunKey(other.id, variant.id)] = 99;
            }
            expect(isModuleComplete(module, { exerciseRuns: runs })).toBe(true);
        }
    });

    it("noteToTab links in modules 1/5 are extra practice (same position stats as fretboardToNote)", () => {
        for (const [moduleId, id] of [["e-string-notes", "e-string-notes.e2"], ["fretboard-notes", "fretboard-notes.e2"]] as const) {
            const exercise = getImprovExercise(moduleId, id) as NonNullable<ReturnType<typeof getImprovExercise>>;
            expect((exercise.params as PracticeLinkParams).nonGating).toBe(true);
        }
    });

describe("plan stage C: rectangle and stack, modes from the pentatonic", () => {
    it("C1: in every pentatonic box each string is a rectangle or a stack, two strings and three strings in turn", () => {
        const boxes = [...(getImprovModule("pentatonic-scale")?.exercises ?? []), ...(getImprovModule("pentatonic-positions")?.exercises ?? [])]
            .filter((exercise) => exercise.engine === "diagram-drill")
            .filter((exercise) => {
                const params = exercise.params as DiagramDrillParams;
                return !params.buildStarts && !params.diagonal && params.onlyString === undefined;
            });
        expect(boxes).toHaveLength(7);
        for (const exercise of boxes) {
            const params = exercise.params as DiagramDrillParams;
            const shape = params.shapes[0] as NonNullable<typeof params.shapes[number]>;
            const anchor = tonicAnchorFret(shape.defaultKey);
            const shapes = stringShapes(getShapePositions(shape.shapeId, shape.defaultKey, {
                fretFrom: anchor + params.offsetsFrom,
                fretTo: anchor + params.offsetsTo,
            }));
            // Low E → high E; the high E string repeats the low E string.
            const sequence = [5, 4, 3, 2, 1, 0].map((stringIndex) => shapes.get(stringIndex));
            expect(sequence.every(Boolean), exercise.id).toBe(true);
            expect(sequence[0]).toBe(sequence[5]);
            const fiveStrings = sequence.slice(0, 5).join(",");
            expect(`${fiveStrings},${fiveStrings}`, exercise.id).toContain("rect,rect,stack,stack,stack");
        }
    });

    it("C2: the blues and hexatonic views add a note the minor pentatonic does not have", () => {
        for (const addition of Object.values(PENTATONIC_ADDITIONS)) {
            expect(shapeSemitones("min-pent")).not.toContain(addition.semitone);
        }
        const e1 = getImprovExercise("pentatonic-scale", "pentatonic-scale.e1");
        expect((e1?.params as DiagramDrillParams).pentatonicViews).toBe(true);
    });

    it("C7: each mode is the pentatonic from the same root plus exactly two notes", () => {
        const modes = Object.entries(MODE_PENTATONIC) as Array<[ScaleShapeId, "min-pent" | "maj-pent"]>;
        expect(modes).toHaveLength(6);
        for (const [mode, pentatonic] of modes) {
            const modeNotes = shapeSemitones(mode);
            const base = shapeSemitones(pentatonic);
            expect(base.every((semitone) => modeNotes.includes(semitone)), mode).toBe(true);
            expect(modeNotes.filter((semitone) => !base.includes(semitone)), mode).toHaveLength(2);
        }
        const drill = getImprovExercise("modes", "modes.e4");
        const shapes = (drill?.params as DiagramDrillParams).shapes.map((shape) => shape.shapeId);
        expect([...shapes].sort()).toEqual(modes.map(([mode]) => mode).sort());
    });

    it("the stage C additions to module 7 are extras: a module passed before them stays passed", () => {
        for (const id of ["modes.e4", "modes.e5"]) {
            const exercise = getImprovExercise("modes", id) as NonNullable<ReturnType<typeof getImprovExercise>>;
            expect((exercise.params as { nonGating?: boolean }).nonGating, id).toBe(true);
        }
    });
});

describe("plan stage C: building, diagonal and one-string views (C4–C6)", () => {
    const module6 = () => getImprovModule("pentatonic-positions") as NonNullable<ReturnType<typeof getImprovModule>>;
    const drillParams = (id: string) => getImprovExercise("pentatonic-positions", id)?.params as DiagramDrillParams;

    it("C4: six start roots rebuild the five boxes of module 6, each root inside its own box", () => {
        const windows = (exerciseIds: string[]) => exerciseIds.map((id) => `${drillParams(id).offsetsFrom}:${drillParams(id).offsetsTo}`);
        const boxWindows = windows(["e1", "e2", "e3", "e4", "e5"].map((suffix) => `pentatonic-positions.${suffix}`));
        expect(BUILD_STARTS).toHaveLength(6);
        expect(new Set(BUILD_STARTS.map((start) => `${start.offsetsFrom}:${start.offsetsTo}`))).toEqual(new Set(boxWindows));
        const anchor = tonicAnchorFret("G");
        for (const start of BUILD_STARTS) {
            const box = getShapePositions("min-pent", "G", { fretFrom: anchor + start.offsetsFrom, fretTo: anchor + start.offsetsTo });
            const root = box.find((position) => position.stringIndex === start.stringIndex && position.fret === start.fret);
            expect(root?.isRoot, `${start.stringIndex}:${start.fret}`).toBe(true);
            expect(box).toHaveLength(12);
            // The finger tells the direction: index = the box runs up the neck from the root.
            const below = box.filter((position) => position.fret < start.fret).length;
            const above = box.filter((position) => position.fret > start.fret).length;
            expect(start.finger === "index" ? above > below : below > above, `${start.finger} ${start.fret}`).toBe(true);
        }
        expect(drillParams("pentatonic-positions.e9").buildStarts).toBe(BUILD_STARTS);
    });

    it("C5: the diagonal window holds three complete stacks", () => {
        const params = drillParams("pentatonic-positions.e7");
        const anchor = tonicAnchorFret("G");
        const keys = stackPositionKeys(getShapePositions("min-pent", "G", { fretFrom: anchor + params.offsetsFrom, fretTo: anchor + params.offsetsTo }));
        // Stacks start on the fourth (C): low E fret 8, A fret 3, G fret 5.
        for (const start of ["5:8", "4:3", "2:5"]) expect(keys.has(start), start).toBe(true);
        // 3 × 6 notes; the G-string C at fret 5 belongs to two stacks.
        expect(keys.size).toBe(17);
    });

    it("C6: the one-string view carries every degree of the pentatonic", () => {
        const params = drillParams("pentatonic-positions.e8");
        const anchor = tonicAnchorFret("G");
        const onString = getShapePositions("min-pent", "G", { fretFrom: anchor + params.offsetsFrom, fretTo: anchor + params.offsetsTo })
            .filter((position) => position.stringIndex === params.onlyString);
        expect(new Set(onString.map((position) => position.degreeIndex)).size).toBe(5);
        expect(onString.map((position) => position.fret)).toEqual([0, 3, 5, 7, 10, 12]);
    });

    it("the C4–C6 exercises are extras", () => {
        for (const suffix of ["e7", "e8", "e9"]) expect(drillParams(`pentatonic-positions.${suffix}`).nonGating, suffix).toBe(true);
        expect(module6().exercises).toHaveLength(9);
    });
});

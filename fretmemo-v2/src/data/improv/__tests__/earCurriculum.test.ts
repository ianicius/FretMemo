import { describe, expect, it } from "vitest";
import { EAR_CURRICULUM } from "../ear";
import { isNonGating, type ChoiceQuizParams, type EchoDrillParams } from "../curriculum";
import { getTrack } from "../tracks";
import { generateChoiceQuiz } from "@/lib/improv/questions";

/** Order of the ear track (gauntlet/ear-training/sources/ear-plan.md, section 3). */
const EXPECTED_ORDER = [
    "ear-tonic",
    "ear-degrees",
    "ear-minor",
    "ear-intervals-up",
    "ear-intervals-all",
    "ear-intervals-harmonic",
    "ear-triads",
    "ear-sevenths",
    "ear-inversions",
    "ear-functions",
    "ear-progressions",
    "ear-echo",
];

const exercises = EAR_CURRICULUM.flatMap((module) => module.exercises);

describe("ear training curriculum", () => {
    it("has 12 modules in the planned order, each with a gating exercise, in its own track", () => {
        expect(EAR_CURRICULUM.map((module) => module.id)).toEqual(EXPECTED_ORDER);
        expect(getTrack("ear")?.modules).toBe(EAR_CURRICULUM);
        const ids = exercises.map((exercise) => exercise.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const module of EAR_CURRICULUM) {
            expect(module.exercises.every((exercise) => exercise.id.startsWith(`${module.id}.`)), module.id).toBe(true);
            expect(module.exercises.some((exercise) => !isNonGating(exercise)), module.id).toBe(true);
        }
    });

    it("plays by ear as a gate only in the last module", () => {
        for (const module of EAR_CURRICULUM) {
            const gatingEcho = module.exercises.filter((exercise) => exercise.engine === "echo-drill" && !isNonGating(exercise));
            expect(gatingEcho.length > 0, module.id).toBe(module.id === "ear-echo");
        }
    });

    it("asks every quiz with a sound and its answer among the options", () => {
        for (const exercise of exercises.filter((item) => item.engine === "choice-quiz")) {
            const params = exercise.params as ChoiceQuizParams;
            for (const question of generateChoiceQuiz(params, exercise.id)) {
                expect(question.audio?.length, exercise.id).toBeGreaterThan(0);
                expect(question.options.length, exercise.id).toBeGreaterThanOrEqual(3);
                expect(question.options[question.correctIndex], exercise.id).toBeTruthy();
            }
        }
    });

    it("asks phrases that fit the allowed degrees", () => {
        for (const exercise of exercises.filter((item) => item.engine === "echo-drill")) {
            const params = exercise.params as EchoDrillParams;
            expect(params.length).toBeLessThanOrEqual(params.degrees.length > 1 ? 4 : 1);
            expect(params.requiredPhrases).toBeGreaterThan(0);
        }
    });
});

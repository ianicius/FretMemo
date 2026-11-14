/**
 * Store tests for plan phase 1: per-exercise quiz attempts (1.1), the
 * two-passed-attempts rule (1.3) and the legacy quizBest migration.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useImprovStore } from "../useImprovStore";
import { getImprovModule, isExercisePassed, QUIZ_PASSED_ATTEMPTS } from "@/data/improv/curriculum";

const QUIZ_MODULE = "key-signatures";

function resetStore() {
    useImprovStore.setState({
        moduleState: {
            [QUIZ_MODULE]: { exerciseRuns: {}, completed: false },
        },
        unlockAll: false,
    });
}

describe("useImprovStore (plan phase 1)", () => {
    beforeEach(() => {
        resetStore();
    });

    it("records a quiz attempt only when the run met requiredCorrect (plan 1.1)", () => {
        useImprovStore.getState().recordQuizResult(QUIZ_MODULE, `${QUIZ_MODULE}.e1`, 5);
        const below = useImprovStore.getState().moduleState[QUIZ_MODULE];
        expect(below.exerciseRuns[`${QUIZ_MODULE}.e1`]).toBeUndefined();

        useImprovStore.getState().recordQuizResult(QUIZ_MODULE, `${QUIZ_MODULE}.e1`, 8);
        const after = useImprovStore.getState().moduleState[QUIZ_MODULE];
        expect(after.exerciseRuns[`${QUIZ_MODULE}.e1`]).toBe(1);
    });

    it("passes the quiz exercise only after two passed attempts (plan 1.3)", () => {
        const e1 = getImprovModule(QUIZ_MODULE)?.exercises.find((exercise) => exercise.id === `${QUIZ_MODULE}.e1`);
        expect(e1).toBeDefined();

        useImprovStore.getState().recordQuizResult(QUIZ_MODULE, `${QUIZ_MODULE}.e1`, 8);
        const one = useImprovStore.getState();
        expect(isExercisePassed(e1!, one.moduleState[QUIZ_MODULE])).toBe(false);

        useImprovStore.getState().recordQuizResult(QUIZ_MODULE, `${QUIZ_MODULE}.e1`, 8);
        const two = useImprovStore.getState();
        expect(isExercisePassed(e1!, two.moduleState[QUIZ_MODULE])).toBe(true);
        expect(QUIZ_PASSED_ATTEMPTS).toBe(2);
    });

    it("migrates legacy quizBest to one passed attempt on the first quiz exercise", async () => {
        const legacy = {
            state: {
                moduleState: {
                    [QUIZ_MODULE]: { quizBest: 8, drillsDone: [], loopPasses: 0, exerciseRuns: {}, completed: true },
                    "e-string-notes": { quizBest: 10, drillsDone: [], loopPasses: 0, exerciseRuns: {}, completed: false },
                },
                unlockAll: true,
            },
            version: 0,
        };
        window.localStorage.setItem("fretmemo-improv-v1", JSON.stringify(legacy));
        await useImprovStore.persist.rehydrate();

        const state = useImprovStore.getState().moduleState;
        // The quiz module migrates quizBest to one passed attempt.
        expect(state[QUIZ_MODULE].exerciseRuns[`${QUIZ_MODULE}.e1`]).toBe(1);
        // Module 1 has no quiz exercise anymore (practice-link) — the legacy
        // value is dropped, the user re-earns the practice criteria.
        expect(state["e-string-notes"].exerciseRuns["e-string-notes.e1"]).toBeUndefined();
        expect("quizBest" in state[QUIZ_MODULE]).toBe(false);
    });
});

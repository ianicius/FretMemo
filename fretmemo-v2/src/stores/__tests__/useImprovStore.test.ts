/**
 * Store tests for plan phase 1: per-exercise quiz attempts (1.1), the
 * two-passed-attempts rule (1.3) and the legacy quizBest migration.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useImprovStore } from "../useImprovStore";
import { getImprovModule, isExercisePassed, QUIZ_PASSED_ATTEMPTS } from "@/data/improv/curriculum";

function resetStore() {
    useImprovStore.setState({
        moduleState: {
            "e-string-notes": { exerciseRuns: {}, completed: false },
            "key-signatures": { exerciseRuns: {}, completed: false },
        },
        unlockAll: false,
    });
}

describe("useImprovStore (plan phase 1)", () => {
    beforeEach(() => {
        resetStore();
    });

    it("records a quiz attempt only when the run met requiredCorrect (plan 1.1)", () => {
        useImprovStore.getState().recordQuizResult("e-string-notes", "e-string-notes.e1", 7);
        const below = useImprovStore.getState().moduleState["e-string-notes"];
        expect(below.exerciseRuns["e-string-notes.e1"]).toBeUndefined();

        useImprovStore.getState().recordQuizResult("e-string-notes", "e-string-notes.e1", 10);
        const after = useImprovStore.getState().moduleState["e-string-notes"];
        expect(after.exerciseRuns["e-string-notes.e1"]).toBe(1);
    });

    it("passes the quiz exercise only after two passed attempts (plan 1.3)", () => {
        const e1 = getImprovModule("e-string-notes")?.exercises.find((exercise) => exercise.id === "e-string-notes.e1");
        expect(e1).toBeDefined();

        useImprovStore.getState().recordQuizResult("e-string-notes", "e-string-notes.e1", 10);
        const one = useImprovStore.getState();
        expect(isExercisePassed(e1!, one.moduleState["e-string-notes"])).toBe(false);

        useImprovStore.getState().recordQuizResult("e-string-notes", "e-string-notes.e1", 10);
        const two = useImprovStore.getState();
        expect(isExercisePassed(e1!, two.moduleState["e-string-notes"])).toBe(true);
        expect(QUIZ_PASSED_ATTEMPTS).toBe(2);
    });

    it("migrates legacy quizBest to one passed attempt on the first quiz exercise", async () => {
        const legacy = {
            state: {
                moduleState: {
                    "e-string-notes": { quizBest: 10, drillsDone: [], loopPasses: 0, exerciseRuns: {}, completed: true },
                    "key-signatures": { quizBest: 4, drillsDone: [], loopPasses: 0, exerciseRuns: {}, completed: false },
                },
                unlockAll: true,
            },
            version: 0,
        };
        window.localStorage.setItem("fretmemo-improv-v1", JSON.stringify(legacy));
        await useImprovStore.persist.rehydrate();

        const state = useImprovStore.getState().moduleState;
        expect(state["e-string-notes"].exerciseRuns["e-string-notes.e1"]).toBe(1);
        expect(state["key-signatures"].exerciseRuns["key-signatures.e1"]).toBeUndefined();
        expect("quizBest" in state["e-string-notes"]).toBe(false);
    });
});

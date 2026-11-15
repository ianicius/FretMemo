/**
 * Store tests for plan phase 1: per-exercise quiz attempts (1.1), the
 * two-passed-attempts rule (1.3) and the legacy quizBest migration.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useImprovStore } from "../useImprovStore";
import { getImprovModule, isExercisePassed, isExerciseVerified, QUIZ_PASSED_ATTEMPTS } from "@/data/improv/curriculum";

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

describe("useImprovStore verified loop passes (plan A2)", () => {
    const LOOP_MODULE = "target-chord-tones";
    const LOOP_ID = `${LOOP_MODULE}.e1`;
    const VARIANTS = ["root", "third", "fifth", "seventh"];

    beforeEach(() => {
        useImprovStore.setState({
            moduleState: { [LOOP_MODULE]: { exerciseRuns: {}, verifiedRuns: {}, completed: false } },
            unlockAll: false,
        });
    });

    it("stores a self-marked pass as unverified and a mic pass as verified; both count in exerciseRuns", () => {
        const store = useImprovStore.getState();
        store.recordLoopPass(LOOP_MODULE, LOOP_ID, "root", false);
        store.recordLoopPass(LOOP_MODULE, LOOP_ID, "root", true);
        store.recordLoopPass(LOOP_MODULE, LOOP_ID, "third");
        const progress = useImprovStore.getState().moduleState[LOOP_MODULE];
        expect(progress.exerciseRuns[`${LOOP_ID}#root`]).toBe(2);
        expect(progress.exerciseRuns[`${LOOP_ID}#third`]).toBe(1);
        expect(progress.verifiedRuns?.[`${LOOP_ID}#root`]).toBe(1);
        expect(progress.verifiedRuns?.[`${LOOP_ID}#third`]).toBeUndefined();
    });

    it("an exercise passed only by self-marked loops is passed but unverified; mic passes verify it", () => {
        const exercise = getImprovModule(LOOP_MODULE)?.exercises.find((item) => item.id === LOOP_ID);
        expect(exercise).toBeDefined();
        for (const variant of VARIANTS) {
            useImprovStore.getState().recordLoopPass(LOOP_MODULE, LOOP_ID, variant, false);
            useImprovStore.getState().recordLoopPass(LOOP_MODULE, LOOP_ID, variant, false);
        }
        const selfMarked = useImprovStore.getState().moduleState[LOOP_MODULE];
        expect(isExercisePassed(exercise!, selfMarked)).toBe(true);
        expect(isExerciseVerified(exercise!, selfMarked)).toBe(false);

        for (const variant of VARIANTS) {
            useImprovStore.getState().recordLoopPass(LOOP_MODULE, LOOP_ID, variant, true);
            useImprovStore.getState().recordLoopPass(LOOP_MODULE, LOOP_ID, variant, true);
        }
        expect(isExerciseVerified(exercise!, useImprovStore.getState().moduleState[LOOP_MODULE])).toBe(true);
    });

    it("migrates persisted state without verifiedRuns (pre-A2) as unverified, keeping exerciseRuns", async () => {
        window.localStorage.setItem("fretmemo-improv-v1", JSON.stringify({
            state: {
                moduleState: { [LOOP_MODULE]: { exerciseRuns: { [`${LOOP_ID}#root`]: 2 }, completed: false } },
                unlockAll: false,
            },
            version: 0,
        }));
        await useImprovStore.persist.rehydrate();
        const progress = useImprovStore.getState().moduleState[LOOP_MODULE];
        expect(progress.exerciseRuns[`${LOOP_ID}#root`]).toBe(2);
        expect(progress.verifiedRuns).toEqual({});
    });
});

describe("useImprovStore loop time (plan F3)", () => {
    it("adds up whole seconds and ignores empty or negative spans", () => {
        useImprovStore.setState({ loopSeconds: 0 });
        const { addLoopSeconds } = useImprovStore.getState();
        addLoopSeconds(61.4);
        addLoopSeconds(0);
        addLoopSeconds(-5);
        addLoopSeconds(Number.NaN);
        addLoopSeconds(30);
        expect(useImprovStore.getState().loopSeconds).toBe(91);
    });
});

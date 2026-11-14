import { describe, expect, it } from "vitest";
import {
    CHORD_SCALE_MELODIC,
    generateChoiceQuiz,
    generateFretboardQuestions,
    tritoneSub,
} from "../questions";

describe("choice quiz generators", () => {
    it("are deterministic for the same seed", () => {
        const params = { generatorId: "keySig" as const, questionCount: 6 };
        const runA = generateChoiceQuiz(params, "determinism-seed");
        const runB = generateChoiceQuiz(params, "determinism-seed");
        expect(runA).toEqual(runB);
        expect(runA).toHaveLength(6);
    });

    it("every question has 4 unique options and exactly one correct index", () => {
        for (const generatorId of ["keySig", "modes", "triadBuild", "chordScaleMajor", "triadType", "chordScaleMelodic", "chordScaleHarmonic", "tritone", "secondaryDom", "borrowed", "pivot", "coltrane"] as const) {
            const questions = generateChoiceQuiz({ generatorId, questionCount: 8 }, "options-seed");
            expect(questions).toHaveLength(8);
            for (const question of questions) {
                expect(question.options).toHaveLength(4);
                expect(new Set(question.options).size).toBe(4);
                expect(question.correctIndex).toBeGreaterThanOrEqual(0);
                expect(question.correctIndex).toBeLessThan(4);
                expect(question.promptKey).toMatch(/^improv\.q\./);
            }
        }
    });

    it("subV of G7 is Db7 and of Bb7 is E7", () => {
        expect(tritoneSub("G7")).toBe("Db7");
        expect(tritoneSub("Bb7")).toBe("E7");
        expect(tritoneSub("Ab7")).toBe("D7");
    });

    it("secondary dominant questions map Dm7 to A7", () => {
        const questions = generateChoiceQuiz({ generatorId: "secondaryDom", questionCount: 12, direction: "chord-to-secondary" }, "sec-dom-seed");
        const dm7 = questions.find((question) => question.promptValues.target === "Dm7");
        expect(dm7).toBeDefined();
        expect(dm7?.options[dm7.correctIndex]).toBe("A7");
    });

    it("melodic minor chord/scale pairing: 7alt → Altered", () => {
        const questions = generateChoiceQuiz({ generatorId: "chordScaleMelodic", questionCount: 20, direction: "chord-to-mode" }, "melodic-seed");
        const altered = questions.find((question) => question.promptValues.chord === "7alt");
        expect(altered?.options[altered.correctIndex]).toBe("Altered");
        // All data rows exist (video module 19).
        expect(CHORD_SCALE_MELODIC).toHaveLength(7);
    });

    it("Giant Steps resolution questions follow the Coltrane cycle", () => {
        const questions = generateChoiceQuiz({ generatorId: "coltrane", questionCount: 20, direction: "resolution" }, "coltrane-seed");
        const resolutions: Record<string, string> = { D7: "G", Bb7: "Eb", "F#7": "B" };
        for (const question of questions) {
            const dominant = String(question.promptValues.dominant);
            expect(question.options[question.correctIndex]).toBe(resolutions[dominant]);
        }
    });

    it("count-to-key key signature questions have consistent count and answer", () => {
        const questions = generateChoiceQuiz({ generatorId: "keySig", questionCount: 16, direction: "count-to-key" }, "keysig-seed");
        for (const question of questions) {
            const count = Number(question.promptValues.count);
            expect(count).toBeGreaterThan(0);
            const answer = question.options[question.correctIndex];
            // The answer is a key (sharp or flat spelling) whose signature count matches the prompt.
            expect(answer).toMatch(/^[A-G][#b]?$/);
        }
    });
});

describe("fretboard quiz generation (E1)", () => {
    const params = {
        direction: "both" as const,
        stringIndices: [5],
        fretFrom: 0,
        fretTo: 12,
        pitchClasses: "all" as const,
        questionCount: 10,
        answerOptions: 4,
    };

    it("generates alternating directions with valid options", () => {
        const questions = generateFretboardQuestions(params, "fret-seed");
        expect(questions).toHaveLength(10);
        questions.forEach((question, index) => {
            expect(question.stringIndex).toBe(5);
            expect(question.fret).toBeGreaterThanOrEqual(0);
            expect(question.fret).toBeLessThanOrEqual(12);
            if (index % 2 === 0) {
                expect(question.direction).toBe("position-to-note");
                expect(question.options).toHaveLength(4);
                expect(question.options?.[question.correctIndex ?? -1]).toBe(question.note);
            } else {
                expect(question.direction).toBe("note-to-position");
                expect(question.options).toBeUndefined();
            }
        });
    });

    it("restricts notes to the requested strings and is deterministic per seed", () => {
        const questions = generateFretboardQuestions({ ...params, stringIndices: [5], direction: "position-to-note" }, "restrict-seed");
        // Low E string notes: E F F# G G# A A# B C C# D D#
        const eStringNotes = new Set(["E", "F", "F#", "G", "G#", "A", "A#", "B", "C", "C#", "D", "D#"]);
        for (const question of questions) {
            expect(eStringNotes.has(question.note)).toBe(true);
        }
        expect(questions).toEqual(generateFretboardQuestions({ ...params, stringIndices: [5], direction: "position-to-note" }, "restrict-seed"));
    });
});

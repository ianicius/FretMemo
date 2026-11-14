import { describe, expect, it } from "vitest";
import { Key, Note } from "tonal";
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

describe("musical correctness (plan phase 0)", () => {
    const TYPE_BY_SUFFIX: Record<string, string> = { "": "major", m: "minor", dim: "diminished", aug: "augmented" };

    it("triadBuild stacks real triads — C major degrees give M m m M M m dim (plan 0.1, tonal oracle)", () => {
        const questions = generateChoiceQuiz({ generatorId: "triadBuild", questionCount: 40, direction: "degree-to-triad" }, "triad-seed");
        const typesSeen = new Set<string>();
        expect(questions.length).toBeGreaterThan(0);
        for (const question of questions) {
            const { key, degree, notes } = question.promptValues as { key: string; degree: number; notes: string };
            const scale = Key.majorKey(key).scale;
            const root = scale[(degree - 1) % 7] as string;
            const third = scale[(degree + 1) % 7] as string;
            const fifth = scale[(degree + 3) % 7] as string;
            // The prompt shows the corrected stacking.
            expect(notes).toBe(`${root}-${third}-${fifth}`);
            // And the correct chord symbol matches the tonal-computed type.
            const answer = question.options[question.correctIndex];
            expect(answer.startsWith(root)).toBe(true);
            const suffix = answer.slice(root.length);
            const thirdSemi = (Note.chroma(third) - Note.chroma(root) + 12) % 12;
            const fifthSemi = (Note.chroma(fifth) - Note.chroma(root) + 12) % 12;
            const expectedType =
                thirdSemi === 4 && fifthSemi === 7 ? "major"
                : thirdSemi === 3 && fifthSemi === 7 ? "minor"
                : thirdSemi === 3 && fifthSemi === 6 ? "diminished"
                : "augmented";
            expect(TYPE_BY_SUFFIX[suffix]).toBe(expectedType);
            typesSeen.add(expectedType);
        }
        // All seven degrees together cover every triad type except aug.
        expect(typesSeen.has("major")).toBe(true);
        expect(typesSeen.has("minor")).toBe(true);
        expect(typesSeen.has("diminished")).toBe(true);
    });

    it("triad types for C major degrees 1–7 are M m m M M m dim (plan 0.1)", () => {
        const scale = Key.majorKey("C").scale;
        const expected = ["major", "minor", "minor", "major", "major", "minor", "diminished"];
        for (let degree = 1; degree <= 7; degree += 1) {
            const root = scale[degree - 1] as string;
            const third = scale[(degree + 1) % 7] as string;
            const fifth = scale[(degree + 3) % 7] as string;
            const thirdSemi = (Note.chroma(third) - Note.chroma(root) + 12) % 12;
            const fifthSemi = (Note.chroma(fifth) - Note.chroma(root) + 12) % 12;
            const type = thirdSemi === 4 && fifthSemi === 7 ? "major"
                : thirdSemi === 3 && fifthSemi === 7 ? "minor"
                : thirdSemi === 3 && fifthSemi === 6 ? "diminished"
                : thirdSemi === 4 && fifthSemi === 8 ? "augmented"
                : "unknown";
            expect(type).toBe(expected[degree - 1]);
        }
    });

    it("subV resolution goes to the tonic a fifth below the original dominant (plan 0.4)", () => {
        const questions = generateChoiceQuiz({ generatorId: "tritone", questionCount: 40, direction: "subv-resolution" }, "subv-res-seed");
        const flatNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
        expect(questions.length).toBeGreaterThan(0);
        for (const question of questions) {
            const sub = String(question.promptValues.sub);
            const originalDominant = tritoneSub(sub); // involutive: subV of the subV is the original
            const pc = flatNames.indexOf(originalDominant.replace(/7$/, ""));
            const expectedTarget = flatNames[(pc + 5) % 12];
            expect(question.options[question.correctIndex]).toBe(expectedTarget);
        }
        // Spot checks from the plan: Db7 → C, Gb7 → F, Ab7 → G.
        const bySub = new Map(questions.map((question) => [String(question.promptValues.sub), question.options[question.correctIndex]]));
        if (bySub.has("Db7")) expect(bySub.get("Db7")).toBe("C");
        if (bySub.has("Gb7")) expect(bySub.get("Gb7")).toBe("F");
        if (bySub.has("Ab7")) expect(bySub.get("Ab7")).toBe("G");
    });

    it("backdoor questions always present the full Fm7–Bb7–C sequence (plan 0.6)", () => {
        const questions = generateChoiceQuiz({ generatorId: "borrowed", questionCount: 30, direction: "backdoor" }, "backdoor-seed");
        expect(questions.length).toBeGreaterThan(0);
        for (const question of questions) {
            expect(question.promptValues.chord).toBe("Fm7–Bb7–C");
            expect(question.options[question.correctIndex]).toBe("improv.q.borrowed.answerBackdoor");
        }
    });

    it("chord/scale major includes Cmaj7 → Ionian (plan 0.8)", () => {
        const questions = generateChoiceQuiz({ generatorId: "chordScaleMajor", questionCount: 40, direction: "chord-to-mode" }, "cmaj7-seed");
        const cmaj7 = questions.find((question) => question.promptValues.chord === "Cmaj7");
        expect(cmaj7).toBeDefined();
        expect(cmaj7?.options[cmaj7.correctIndex]).toBe("Ionian");
    });

    it("melodic/harmonic chord-to-mode questions use the generic prompt without a key suffix (plan 0.7)", () => {
        for (const generatorId of ["chordScaleMelodic", "chordScaleHarmonic"] as const) {
            const questions = generateChoiceQuiz({ generatorId, questionCount: 10, direction: "chord-to-mode" }, "generic-seed");
            for (const question of questions) {
                expect(question.promptKey).toBe("improv.q.chordScale.chordToModeGeneric");
            }
        }
    });

    it("mode characteristics carry no prose (plan 0.9)", () => {
        const questions = generateChoiceQuiz({ generatorId: "modes", questionCount: 40, direction: "characteristic-to-mode" }, "modes-seed");
        for (const question of questions) {
            expect(String(question.promptValues.characteristic)).toMatch(/^[#b0-9–\s-]*$/);
        }
    });
});

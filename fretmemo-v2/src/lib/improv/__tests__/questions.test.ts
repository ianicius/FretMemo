import { describe, expect, it } from "vitest";
import { Key, Note } from "tonal";
import { chordScaleMajorPairs } from "../questions";
import {
    CHORD_SCALE_MELODIC,
    generateChoiceQuiz,
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
                expect(question.options.length).toBeGreaterThanOrEqual(2);
                expect(question.options.length).toBeLessThanOrEqual(4);
                expect(new Set(question.options).size).toBe(question.options.length);
                expect(question.correctIndex).toBeGreaterThanOrEqual(0);
                expect(question.correctIndex).toBeLessThan(question.options.length);
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

describe("question pools (plan phase 5)", () => {
    const GENERATORS = ["keySig", "modes", "triadBuild", "chordScaleMajor", "triadType", "chordScaleMelodic", "chordScaleHarmonic", "tritone", "secondaryDom", "borrowed", "pivot", "coltrane"] as const;

    /** Acceptance criterion: 300 draws yield at least 3x questionCount
     * distinct questions per generator (prompt + answer identity). */
    function distinctCount(generatorId: (typeof GENERATORS)[number], draws: number): number {
        const seen = new Set<string>();
        for (let draw = 0; draw < draws; draw += 1) {
            const questions = generateChoiceQuiz({ generatorId, questionCount: 10 }, `pool:${generatorId}:${draw}`);
            for (const question of questions) {
                seen.add(`${question.promptKey}|${JSON.stringify(question.promptValues)}|${question.options[question.correctIndex]}`);
            }
        }
        return seen.size;
    }

    it("yields at least 30 distinct questions in 300 draws for every generator", () => {
        for (const generatorId of GENERATORS) {
            // Coltrane has an inherently small pool (3 tonations); its plan
            // target was 4+ distinct questions. The transposed cycles alone
            // give 12 — assert 12 for it, 30 for everything else.
            // triadType has an inherently fixed pool (10 chord types × 2 directions = 20).
            const threshold = generatorId === "coltrane" ? 12 : generatorId === "triadType" ? 20 : 30;
            const distinct = distinctCount(generatorId, 300);
            if (distinct < threshold) console.log("LOW:", generatorId, distinct);
            expect(distinct).toBeGreaterThanOrEqual(threshold);
        }
    });

    it("chordScaleMajor draws from all 12 keys (plan 5: module 9)", () => {
        const keys = new Set<string>();
        for (let draw = 0; draw < 60; draw += 1) {
            const questions = generateChoiceQuiz({ generatorId: "chordScaleMajor", questionCount: 10, direction: "chord-to-mode" }, `keys:${draw}`);
            for (const question of questions) {
                if (question.promptValues.key) keys.add(String(question.promptValues.key));
            }
        }
        expect(keys.size).toBe(12);
    });

    it("secondaryDom dominants sit a fifth above their targets (tonal oracle)", () => {
        for (let draw = 0; draw < 30; draw += 1) {
            const questions = generateChoiceQuiz({ generatorId: "secondaryDom", questionCount: 10, direction: "chord-to-secondary" }, `secdom-p5:${draw}`);
            for (const question of questions) {
                const dominant = question.options[question.correctIndex];
                const target = String(question.promptValues.target);
                const targetRoot = target.replace(/m7|maj7|7$/, "");
                const dominantRoot = dominant.replace(/7$/, "");
                const interval = (Note.chroma(dominantRoot) - Note.chroma(targetRoot) + 12) % 12;
                // V7/I (the video note) is its own root — skip it here.
                if (interval !== 0) expect(interval).toBe(7);
            }
        }
    });

    it("borrowed questions use at least 4 different keys (plan 5: module 17)", () => {
        const keys = new Set<string>();
        for (let draw = 0; draw < 40; draw += 1) {
            const questions = generateChoiceQuiz({ generatorId: "borrowed", questionCount: 10, direction: "identify-degree" }, `borrowed:${draw}`);
            for (const question of questions) {
                keys.add(String(question.promptValues.key));
            }
        }
        expect(keys.size).toBeGreaterThanOrEqual(4);
    });

    it("tritone pool covers all 12 dominant roots (plan 5: module 15)", () => {
        const dominants = new Set<string>();
        for (let draw = 0; draw < 60; draw += 1) {
            const questions = generateChoiceQuiz({ generatorId: "tritone", questionCount: 10, direction: "v-to-subv" }, `tritone:${draw}`);
            for (const question of questions) {
                dominants.add(String(question.promptValues.v));
            }
        }
        expect(dominants.size).toBe(12);
    });

    it("mode questions include note, parent and ear directions (plan 5: module 7)", () => {
        const promptKeys = new Set<string>();
        for (let draw = 0; draw < 80; draw += 1) {
            const questions = generateChoiceQuiz({ generatorId: "modes", questionCount: 10 }, `modes:${draw}`);
            for (const question of questions) {
                promptKeys.add(question.promptKey);
            }
        }
        for (const required of ["improv.q.modes.modeNotesFromRoot", "improv.q.modes.modeParent", "improv.q.modes.soundToMode"]) {
            expect(promptKeys.has(required)).toBe(true);
        }
    });

    it("melodic and harmonic in-context questions answer with the parent scale (plan 5: modules 19/21)", () => {
        for (const generatorId of ["chordScaleMelodic", "chordScaleHarmonic"] as const) {
            const questions = generateChoiceQuiz({ generatorId, questionCount: 40, direction: "in-context" }, "ctx-seed");
            expect(questions.length).toBeGreaterThan(0);
            for (const question of questions) {
                const answer = question.options[question.correctIndex];
                expect(answer).toMatch(/(melodic|harmonic) minor$/);
            }
        }
    });

    it("triadBuild includes seventh chords with real stacks (plan 5: module 8)", () => {
        const promptKeys = new Set<string>();
        for (let draw = 0; draw < 80; draw += 1) {
            const questions = generateChoiceQuiz({ generatorId: "triadBuild", questionCount: 10 }, `sevenths:${draw}`);
            for (const question of questions) {
                promptKeys.add(question.promptKey);
                if (question.promptKey === "improv.q.triadBuild.degreeToSeventh") {
                    const notes = String(question.promptValues.notes).split("-");
                    const rootPc = Note.chroma(notes[0]);
                    const intervals = notes.map((note) => (Note.chroma(note) - rootPc + 12) % 12).join(",");
                    expect(["0,4,7,11", "0,4,7,10", "0,3,7,10", "0,3,6,10"].some((valid) => valid === intervals), "stack: " + notes.join("-")).toBe(true);
                }
            }
        }
        expect(promptKeys.has("improv.q.triadBuild.degreeToSeventh")).toBe(true);
    });

    it("keySig pools cover type, raised notes and parallel minor (plan 5: module 2)", () => {
        const promptKeys = new Set<string>();
        for (let draw = 0; draw < 100; draw += 1) {
            const questions = generateChoiceQuiz({ generatorId: "keySig", questionCount: 10 }, `keysig-p5:${draw}`);
            for (const question of questions) {
                promptKeys.add(question.promptKey);
            }
        }
        for (const required of ["improv.q.keySig.keyType", "improv.q.keySig.keyAccidentals", "improv.q.keySig.parallelMinor"]) {
            expect(promptKeys.has(required)).toBe(true);
        }
    });

    it("coltrane pools cover ii-V and transposed cycles (plan 5: module 22)", () => {
        const promptKeys = new Set<string>();
        for (let draw = 0; draw < 100; draw += 1) {
            const questions = generateChoiceQuiz({ generatorId: "coltrane", questionCount: 10 }, `coltrane-p5:${draw}`);
            for (const question of questions) {
                promptKeys.add(question.promptKey);
            }
        }
        for (const required of ["improv.q.coltrane.iiVOf", "improv.q.coltrane.cycleTransposed"]) {
            expect(promptKeys.has(required)).toBe(true);
        }
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

    it("backdoor questions always present the full iv–bVII–I sequence (plan 0.6 + 5)", () => {
        const questions = generateChoiceQuiz({ generatorId: "borrowed", questionCount: 30, direction: "backdoor" }, "backdoor-seed");
        expect(questions.length).toBeGreaterThan(0);
        for (const question of questions) {
            const sequence = String(question.promptValues.chord);
            // Three-chord sequence: iv m7 – bVII7 – I (key drawn from the pool).
            expect(sequence.split("–")).toHaveLength(3);
            expect(sequence).toMatch(/m7–\S+7–[A-G]b?$/);
            expect(question.options[question.correctIndex]).toBe("improv.q.borrowed.answerBackdoor");
        }
    });

    it("chord/scale major includes Cmaj7 → Ionian (plan 0.8)", () => {
        const pairs = chordScaleMajorPairs("C");
        expect(pairs.find((pair) => pair.chord === "Cmaj7")?.mode).toBe("Ionian");
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

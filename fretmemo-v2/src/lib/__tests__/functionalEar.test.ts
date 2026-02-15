import { describe, expect, it } from "vitest";
import {
    buildCadenceForKey,
    buildFunctionalQuestion,
    degreeToNoteName,
    degreeToSemitone,
    type FunctionalDegree,
} from "../functionalEar";

describe("functionalEar helpers", () => {
    it("maps degrees to major semitone offsets", () => {
        const map: Record<FunctionalDegree, number> = {
            "1": 0,
            "2": 2,
            "3": 4,
            "4": 5,
            "5": 7,
            "6": 9,
            "7": 11,
        };

        (Object.keys(map) as FunctionalDegree[]).forEach((degree) => {
            expect(degreeToSemitone(degree, "major")).toBe(map[degree]);
        });
    });

    it("resolves degree note names for a key", () => {
        expect(degreeToNoteName("C", "3", "major")).toBe("E");
        expect(degreeToNoteName("F#", "5", "major")).toBe("C#");
    });

    it("builds I-IV-V-I cadence for major key", () => {
        const cadence = buildCadenceForKey("C", "major", 3);
        expect(cadence).toHaveLength(4);
        expect(cadence[0]).toEqual(cadence[3]);
        expect(cadence[0]).toEqual([48, 52, 55]); // C major triad in octave 3
    });

    it("builds question with constrained options", () => {
        const question = buildFunctionalQuestion({
            keyRoot: "D",
            degrees: ["3"],
            mode: "major",
        });

        expect(question.keyRoot).toBe("D");
        expect(question.degree).toBe("3");
        expect(question.mode).toBe("major");
        expect(question.contextChords).toHaveLength(4);
    });
});


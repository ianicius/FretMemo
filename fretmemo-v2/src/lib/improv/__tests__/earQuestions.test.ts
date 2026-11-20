import { describe, expect, it } from "vitest";
import { Chord, Note } from "tonal";
import { EAR_INTERVALS } from "@/lib/earIntervals";
import { degreeToSemitone, type FunctionalDegree } from "@/lib/functionalEar";
import { createRng, generateChoiceQuiz, type ChoiceQuestion } from "../questions";
import { BASS_KEYS, earChordMidis, progressionChords } from "../earQuestions";
import { SEQUENCE_IDLE, advanceSequence, sequenceDone, type SequenceProgress } from "../noteSequence";
import { echoNoteNames, echoPhrase, echoSound } from "../echo";

const pc = (midi: number) => ((midi % 12) + 12) % 12;
const quiz = (generatorId: "earDegree" | "earInterval" | "earChord" | "earProgression", direction: string, seed = "s") =>
    generateChoiceQuiz({ generatorId, direction, questionCount: 40, answerOptions: 4 }, seed);
const answer = (question: ChoiceQuestion) => question.options[question.correctIndex] as string;
/** The last sounding step of the question. */
const lastMidis = (question: ChoiceQuestion) => [...(question.audio ?? [])].reverse().find((step) => step.midis.length > 0)?.midis ?? [];

describe("ear quiz generators", () => {
    it("asks the degree that sounds after the cadence, in major and in minor", () => {
        for (const direction of ["major-135", "major", "minor"]) {
            for (const question of quiz("earDegree", direction)) {
                const tonic = question.audio?.[0]?.midis[0] as number;
                const target = lastMidis(question)[0] as number;
                const degree = String(answer(question).replace("b", "")) as FunctionalDegree;
                expect(target - tonic, `${direction} ${answer(question)}`).toBe(degreeToSemitone(degree, direction === "minor" ? "minor" : "major"));
                expect(question.options).toContain(answer(question));
                expect(new Set(question.options).size).toBe(question.options.length);
            }
        }
        expect(new Set(quiz("earDegree", "major-135").map(answer))).toEqual(new Set(["1", "3", "5"]));
        // Minor: the cadence starts on a minor tonic triad.
        const [minor] = quiz("earDegree", "minor");
        const [root, third] = minor?.audio?.[0]?.midis ?? [];
        expect((third as number) - (root as number)).toBe(3);
    });

    it("plays the interval it asks about, up, down or together", () => {
        for (const direction of ["easy-up", "all", "harmonic"]) {
            for (const question of quiz("earInterval", direction)) {
                const interval = EAR_INTERVALS.find((item) => item.labelKey === answer(question));
                const midis = (question.audio ?? []).flatMap((step) => step.midis);
                expect(Math.abs((midis[1] as number) - (midis[0] as number))).toBe(interval?.semitones);
                if (direction === "easy-up") expect(midis[1] as number).toBeGreaterThan(midis[0] as number);
                if (direction === "harmonic") expect(question.audio).toHaveLength(1);
            }
        }
    });

    it("voices every chord quality and inversion on the guitar, with the asked bass", () => {
        const rng = createRng("voicings");
        for (const root of ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]) {
            for (const suffix of ["", "m", "dim", "aug", "maj7", "7", "m7", "m7b5"]) {
                for (let attempt = 0; attempt < 6; attempt += 1) {
                    const symbol = `${root}${suffix}`;
                    const midis = earChordMidis(symbol, rng);
                    expect(new Set(midis.map(pc)), symbol).toEqual(new Set(Chord.get(symbol).notes.map((note) => Note.chroma(note))));
                }
            }
            for (const inversion of [0, 1, 2]) {
                const midis = earChordMidis(root, rng, inversion);
                expect(pc(midis[0] as number)).toBe(Note.chroma(Chord.get(root).notes[inversion] as string));
            }
        }
        for (const question of quiz("earChord", "inversions")) {
            const inversion = BASS_KEYS.indexOf(answer(question) as (typeof BASS_KEYS)[number]);
            const chord = String(question.hintValues?.chord);
            expect(pc(question.audio?.[0]?.midis[0] as number)).toBe(Note.chroma(Chord.get(chord).notes[inversion] as string));
        }
        for (const direction of ["triads", "sevenths"]) {
            for (const question of quiz("earChord", direction)) expect(question.options).toContain(answer(question));
        }
    });

    it("plays diatonic chords over their root for functions and progressions", () => {
        expect(progressionChords("I–V–vi–IV", "G")).toEqual(["G", "D", "Em", "C"]);
        expect(progressionChords("ii–V–I–I", "Bb")).toEqual(["Cm", "F", "Bb", "Bb"]);
        for (const direction of ["function", "progression"]) {
            for (const question of quiz("earProgression", direction)) {
                const key = String(question.promptValues.key);
                const chords = progressionChords(answer(question), key);
                const steps = (question.audio ?? []).slice(-chords.length);
                steps.forEach((step, index) => {
                    // The lowest note is the chord's root; the rest are its tones.
                    const tones = Chord.get(chords[index] as string).notes.map((note) => Note.chroma(note));
                    expect(pc(step.midis[0] as number)).toBe(tones[0]);
                    for (const midi of step.midis) expect(tones).toContain(pc(midi));
                });
            }
        }
    });

    it("keeps the mode-recognition scale sound", () => {
        const [question] = generateChoiceQuiz({ generatorId: "modes", direction: "sound-to-mode", questionCount: 1, answerOptions: 4 }, "m");
        expect(question?.audio).toHaveLength(15);
        expect(question?.audio?.[0]?.midis).toEqual([60]);
        expect(question?.audio?.[7]?.midis).toEqual([72]);
    });
});

describe("note sequence", () => {
    const feed = (target: number[], heard: Array<number | null>) =>
        heard.reduce<SequenceProgress>((progress, note) => advanceSequence(target, progress, note), SEQUENCE_IDLE);

    it("follows the notes in order, merging repeated readings and silence", () => {
        const target = [0, 4, 7];
        expect(feed(target, [0, 0, null, 0, 4, 4, null, 7])).toEqual({ matched: 3, last: 7 });
        expect(sequenceDone(target, feed(target, [0, 4, 7]))).toBe(true);
    });

    it("restarts on a wrong note, counting it when it is the first note", () => {
        const target = [0, 2, 0, 4];
        expect(feed(target, [0, 2, 5]).matched).toBe(0);
        expect(feed(target, [0, 2, 4]).matched).toBe(0);
        expect(feed(target, [0, 5, 0]).matched).toBe(1);
        // The same pitch class later in the phrase is a new note after another one.
        expect(feed(target, [0, 2, 0, 4]).matched).toBe(4);
    });
});

describe("play what you hear", () => {
    it("builds stepwise phrases from the allowed degrees, never repeating a note in a row", () => {
        const rng = createRng("echo");
        for (let index = 0; index < 200; index += 1) {
            const phrase = echoPhrase(rng, { degrees: ["1", "2", "3", "4", "5"], mode: "major", length: 4 });
            expect(phrase.midis).toHaveLength(4);
            for (const degree of phrase.degrees) expect(["1", "2", "3", "4", "5"]).toContain(degree);
            phrase.midis.slice(1).forEach((midi, step) => expect(pc(midi)).not.toBe(pc(phrase.midis[step] as number)));
            const sound = echoSound(phrase);
            expect(sound.slice(-4).map((step) => step.midis[0])).toEqual(phrase.midis);
            expect(sound[0]?.midis[0]).toBe(phrase.tonic);
        }
        const minor = echoPhrase(createRng("minor"), { degrees: ["3"], mode: "minor", length: 1 });
        expect(minor.midis[0] as number - minor.tonic).toBe(3);
        expect(echoNoteNames({ tonic: 57, mode: "minor", degrees: ["1", "3", "7"], midis: [57, 60, 67] })).toEqual(["A", "C", "G"]);
    });
});

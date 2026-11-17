/**
 * Quiz generators for blues harmony: the 12-bar form, the tones of dominant
 * chords and the scales played over them. Registered in questions.ts like
 * every other generator, so any track can use them.
 */

import { Note } from "tonal";
import type { ChoiceQuestion, Rng } from "./questions";

/** Keys a guitarist meets the blues in. */
const BLUES_KEYS = ["A", "E", "D", "G", "C", "F", "Bb"];

/** Degree of each bar of the 12-bar blues; the quick change goes to IV in bar 2. */
export const TWELVE_BAR_DEGREES = ["I", "I", "I", "I", "IV", "IV", "I", "I", "V", "IV", "I", "I"] as const;
export const QUICK_CHANGE_DEGREES = ["I", "IV", "I", "I", "IV", "IV", "I", "I", "V", "IV", "I", "I"] as const;

const DEGREE_INTERVAL: Record<string, string> = { I: "1P", IV: "4P", V: "5P" };

/** Note a tonal interval above `root`, with a plain spelling (no E#, Fb or double accidentals). */
function up(root: string, interval: string): string {
    const moved = Note.transpose(root, interval);
    return Note.simplify(moved) || moved;
}

/** The dominant chord on a degree of the key: ("A", "IV") → "D7". */
export function bluesChord(key: string, degree: string): string {
    return `${up(key, DEGREE_INTERVAL[degree] ?? "1P")}7`;
}

function options(correct: string, distractors: string[], rng: Rng): { options: string[]; correctIndex: number } {
    const unique = [...new Set([correct, ...distractors])].slice(0, 4);
    const shuffled = rng.shuffle(unique);
    return { options: shuffled, correctIndex: shuffled.indexOf(correct) };
}

export function generateBluesForm(rng: Rng, direction: string): ChoiceQuestion {
    const key = rng.pick(BLUES_KEYS);
    const chords = `${bluesChord(key, "I")}–${bluesChord(key, "IV")}–${bluesChord(key, "V")}`;
    const hint = { hintKey: "improv.q.bluesForm.hintForm", hintValues: { key, chord: chords } };
    if (direction === "degrees") {
        const degree = rng.pick(["I", "IV", "V"]);
        const correct = bluesChord(key, degree);
        const others = ["I", "IV", "V"].filter((item) => item !== degree).map((item) => bluesChord(key, item));
        return {
            id: "bluesForm", promptKey: "improv.q.bluesForm.degreeToChord", promptValues: { key, degree },
            ...options(correct, [...others, `${up(key, "7m")}7`], rng), ...hint,
        };
    }
    if (direction === "bar-to-degree") {
        const bar = rng.int(12) + 1;
        const correct = TWELVE_BAR_DEGREES[bar - 1] as string;
        return {
            id: "bluesForm", promptKey: "improv.q.bluesForm.barToDegree", promptValues: { bar },
            ...options(correct, ["I", "IV", "V"].filter((item) => item !== correct), rng),
            hintKey: "improv.q.bluesForm.hintBars",
        };
    }
    const quick = direction === "quick-change";
    // The quick change differs only in bar 2, so that bar is asked most often.
    const bar = quick ? rng.pick([1, 2, 2, 2, 3, 5, 9, 10]) : rng.int(12) + 1;
    const degree = (quick ? QUICK_CHANGE_DEGREES : TWELVE_BAR_DEGREES)[bar - 1] as string;
    const correct = bluesChord(key, degree);
    const others = ["I", "IV", "V"].filter((item) => item !== degree).map((item) => bluesChord(key, item));
    return {
        id: "bluesForm",
        promptKey: quick ? "improv.q.bluesForm.quickBarToChord" : "improv.q.bluesForm.barToChord",
        promptValues: { key, bar },
        ...options(correct, [...others, `${up(key, "7m")}7`], rng),
        ...(quick ? { hintKey: "improv.q.bluesForm.hintQuick", hintValues: { chord: bluesChord(key, "IV") } } : hint),
    };
}

export function generateBluesTones(rng: Rng, direction: string): ChoiceQuestion {
    if (direction === "guide-move") {
        const key = rng.pick(BLUES_KEYS);
        const correct = up(key, "3m");
        return {
            id: "bluesTones", promptKey: "improv.q.bluesTones.guideMove",
            promptValues: { key, first: up(key, "3M"), chord: bluesChord(key, "IV") },
            ...options(correct, [up(key, "2M"), up(key, "4P"), up(key, "5P")], rng),
            hintKey: "improv.q.bluesTones.hintGuide",
            hintValues: { first: up(key, "3M"), target: correct, chord: bluesChord(key, "IV") },
        };
    }
    const root = rng.pick([...BLUES_KEYS, "B"]);
    const chord = `${root}7`;
    const seventh = direction === "seventh";
    const correct = up(root, seventh ? "7m" : "3M");
    const distractors = seventh ? [up(root, "7M"), up(root, "3M"), up(root, "6M")] : [up(root, "3m"), up(root, "7m"), up(root, "5P")];
    return {
        id: "bluesTones", promptKey: seventh ? "improv.q.bluesTones.seventh" : "improv.q.bluesTones.third",
        promptValues: { chord },
        ...options(correct, distractors, rng),
        hintKey: "improv.q.bluesTones.hintTones",
        hintValues: { chord, notes: [root, up(root, "3M"), up(root, "5P"), up(root, "7m")].join("-") },
    };
}

const MAJOR_PENT = ["1P", "2M", "3M", "5P", "6M"];
const MINOR_PENT = ["1P", "3m", "4P", "5P", "7m"];
const spell = (root: string, intervals: string[]) => intervals.map((interval) => up(root, interval)).join(" ");

export function generateBluesScale(rng: Rng, direction: string): ChoiceQuestion {
    const key = rng.pick(BLUES_KEYS);
    if (direction === "blue-note") {
        return {
            id: "bluesScale", promptKey: "improv.q.bluesScale.blueNote", promptValues: { key },
            ...options(up(key, "5d"), [up(key, "3m"), up(key, "7m"), up(key, "4P")], rng),
            hintKey: "improv.q.bluesScale.hintBlueNote", hintValues: { key, target: up(key, "5d") },
        };
    }
    if (direction === "clash") {
        return {
            id: "bluesScale", promptKey: "improv.q.bluesScale.clash", promptValues: { key, chord: `${key}7` },
            ...options(up(key, "3m"), [up(key, "4P"), up(key, "5P"), up(key, "7m")], rng),
            hintKey: "improv.q.bluesScale.hintClash", hintValues: { first: up(key, "3m"), target: up(key, "3M"), chord: `${key}7` },
        };
    }
    if (direction === "relative-box") {
        const correct = `${up(key, "6M")}m`;
        return {
            id: "bluesScale", promptKey: "improv.q.bluesScale.relativeBox", promptValues: { key },
            ...options(correct, [`${key}m`, `${up(key, "3m")}m`, `${up(key, "5P")}m`], rng),
            hintKey: "improv.q.bluesScale.hintRelative", hintValues: { key, target: correct },
        };
    }
    return {
        id: "bluesScale", promptKey: "improv.q.bluesScale.majorPentNotes", promptValues: { key },
        ...options(spell(key, MAJOR_PENT), [spell(key, MINOR_PENT), spell(up(key, "4P"), MAJOR_PENT), spell(up(key, "5P"), MINOR_PENT)], rng),
        hintKey: "improv.q.bluesScale.hintMajorPent",
    };
}

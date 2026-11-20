/**
 * "Play what you hear": short phrases in a key, heard after a cadence and
 * played back on the guitar. Pure generation; the microphone check is the
 * shared lib/improv/noteSequence.ts.
 */

import { Key } from "tonal";
import { degreeToSemitone, type FunctionalDegree, type FunctionalMode } from "@/lib/functionalEar";
import type { Rng } from "./questions";
import { keyName } from "./earQuestions";
import { cadence, tone, type SoundStep } from "./questionSound";

export interface EchoPhrase {
    /** Tonic MIDI note (C3–B3). */
    tonic: number;
    mode: FunctionalMode;
    degrees: FunctionalDegree[];
    midis: number[];
}

/** Share of moves to a neighbouring allowed degree; the rest leap. */
const STEP_SHARE = 0.75;

/**
 * A phrase of `length` notes from the allowed degrees: mostly stepwise, never
 * the same note twice in a row (the microphone hears a repeated note as one).
 */
export function echoPhrase(rng: Rng, options: { degrees: FunctionalDegree[]; mode: FunctionalMode; length: number }): EchoPhrase {
    const tonic = 48 + rng.int(12);
    const allowed = [...options.degrees].sort((a, b) => degreeToSemitone(a, options.mode) - degreeToSemitone(b, options.mode));
    let index = rng.int(allowed.length);
    const indexes = [index];
    while (indexes.length < options.length) {
        const neighbours = [index - 1, index + 1].filter((item) => item >= 0 && item < allowed.length);
        const others = allowed.map((_, item) => item).filter((item) => item !== index);
        index = rng.next() < STEP_SHARE ? rng.pick(neighbours) : rng.pick(others);
        indexes.push(index);
    }
    const degrees = indexes.map((item) => allowed[item] as FunctionalDegree);
    return { tonic, mode: options.mode, degrees, midis: degrees.map((degree) => tonic + degreeToSemitone(degree, options.mode)) };
}

/** The cadence, then the phrase. */
export function echoSound(phrase: EchoPhrase): SoundStep[] {
    return [...cadence(phrase.tonic, phrase.mode), ...phrase.midis.map((midi) => tone(midi, 0.8))];
}

export const pitchClassOf = (midi: number) => ((midi % 12) + 12) % 12;

/** Key name of the phrase, spelled like the ear quiz keys. */
export const echoKey = (phrase: EchoPhrase) => keyName(phrase.tonic, phrase.mode);

/** Note names of the phrase, spelled in its key ("E", "F#"…). */
export function echoNoteNames(phrase: EchoPhrase): string[] {
    const key = echoKey(phrase);
    const scale = phrase.mode === "minor" ? Key.minorKey(key).natural.scale : Key.majorKey(key).scale;
    return phrase.degrees.map((degree) => scale[Number(degree) - 1] as string);
}

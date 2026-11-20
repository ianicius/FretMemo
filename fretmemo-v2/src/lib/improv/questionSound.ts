/**
 * The sound of a question or an exercise prompt, as plain data: a list of steps,
 * each a note or a chord (MIDI numbers) and the time until the next step.
 * Generators build it (pure, testable); lib/improv/playSound.ts plays it.
 */

import { NOTES } from "@/lib/constants";
import { buildCadenceForKey, type FunctionalMode } from "@/lib/functionalEar";

export interface SoundStep {
    /** One number is a single note, several are a chord, none is a rest. */
    midis: number[];
    /** Seconds until the next step starts. */
    seconds: number;
}

export const tone = (midi: number, seconds = 0.9): SoundStep => ({ midis: [midi], seconds });
export const chord = (midis: number[], seconds = 0.85): SoundStep => ({ midis, seconds });
export const rest = (seconds: number): SoundStep => ({ midis: [], seconds });

/** I–IV–V–I (major) or i–iv–V–i (minor) on the tonic MIDI note, then a short breath. */
export function cadence(tonicMidi: number, mode: FunctionalMode = "major"): SoundStep[] {
    const keyRoot = NOTES[((tonicMidi % 12) + 12) % 12] as (typeof NOTES)[number];
    const octave = Math.floor(tonicMidi / 12) - 1;
    return [...buildCadenceForKey(keyRoot, mode, octave).map((midis) => chord(midis)), rest(0.35)];
}

/** Total length of a sound in seconds. */
export function soundSeconds(steps: readonly SoundStep[]): number {
    return steps.reduce((sum, step) => sum + step.seconds, 0);
}

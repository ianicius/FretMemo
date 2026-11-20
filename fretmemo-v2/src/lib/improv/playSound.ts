/** Plays a question sound (lib/improv/questionSound.ts) on the guitar voice. */

import { playChord, playTone } from "@/lib/audio";
import type { SoundStep } from "./questionSound";

/** Starts the sound and returns a function that cancels the steps not played yet. */
export function playSoundSteps(steps: readonly SoundStep[]): () => void {
    const timers: number[] = [];
    let at = 0;
    for (const step of steps) {
        const { midis } = step;
        // A note rings at least 0.7 s, so quick scale runs still sound legato.
        const duration = Math.max(0.7, step.seconds);
        if (midis.length > 0) {
            timers.push(window.setTimeout(() => {
                void (midis.length === 1 ? playTone(midis[0] as number, duration) : playChord(midis, duration));
            }, at * 1000));
        }
        at += step.seconds;
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
}

/**
 * Plan F4: drum styles under the improv backing loops. Each style is one bar
 * of 4/4; a hit sits at a beat position (0 ≤ at < 4), triplets as thirds.
 */
import { scheduleHat, scheduleKick, scheduleSnare } from "@/rhythm/engine/drumVoices";

export type DrumStyleId = "off" | "rock" | "swing" | "shuffle" | "bossa";
type Voice = "kick" | "snare" | "hat";
interface DrumHit { at: number; voice: Voice; accent?: boolean }

const T2 = 2 / 3;
const eighths = (accentBeats: boolean): DrumHit[] => [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((at) => ({ at, voice: "hat", accent: accentBeats && at % 1 === 0 }));

export const DRUM_STYLES: Record<DrumStyleId, DrumHit[]> = {
    off: [],
    rock: [
        ...eighths(true),
        { at: 0, voice: "kick", accent: true }, { at: 2, voice: "kick" }, { at: 2.5, voice: "kick" },
        { at: 1, voice: "snare", accent: true }, { at: 3, voice: "snare", accent: true },
    ],
    // Ride pattern "ding, ding-da-ding", hi-hat on 2 and 4, a light kick on 1.
    swing: [
        ...[0, 1, 1 + T2, 2, 3, 3 + T2].map((at) => ({ at, voice: "hat" as const, accent: at % 1 === 0 })),
        { at: 0, voice: "kick" },
    ],
    // Triplet shuffle: hat on the beat and on the last triplet, backbeat on 2 and 4.
    shuffle: [
        ...[0, 1, 2, 3].flatMap((beat) => [{ at: beat, voice: "hat" as const, accent: true }, { at: beat + T2, voice: "hat" as const }]),
        { at: 0, voice: "kick", accent: true }, { at: 2, voice: "kick" }, { at: 2 + T2, voice: "kick" },
        { at: 1, voice: "snare", accent: true }, { at: 3, voice: "snare", accent: true },
    ],
    // Bass drum "1, (2-and), 3, (4-and)", rim on a clave-like figure, straight eighths on the hat.
    bossa: [
        ...eighths(false),
        { at: 0, voice: "kick", accent: true }, { at: 1.5, voice: "kick" }, { at: 2, voice: "kick", accent: true }, { at: 3.5, voice: "kick" },
        { at: 0, voice: "snare" }, { at: 1.5, voice: "snare" }, { at: 3, voice: "snare" },
    ],
};

export const DRUM_STYLE_IDS = Object.keys(DRUM_STYLES) as DrumStyleId[];

/** Hits of one beat of the bar, `offset` in beats from that beat. */
export function drumHitsForBeat(style: DrumStyleId, beatInBar: number): Array<{ offset: number; voice: Voice; accent: boolean }> {
    return DRUM_STYLES[style]
        .filter((hit) => Math.floor(hit.at + 1e-9) === beatInBar)
        .map((hit) => ({ offset: hit.at - beatInBar, voice: hit.voice, accent: Boolean(hit.accent) }));
}

const VOICES = { kick: scheduleKick, snare: scheduleSnare, hat: scheduleHat };

/** Schedules the hits of one beat at its exact audio time. */
export function scheduleDrumBeat(context: AudioContext, style: DrumStyleId, beatInBar: number, time: number, beatSec: number): void {
    for (const hit of drumHitsForBeat(style, beatInBar)) VOICES[hit.voice](context, time + hit.offset * beatSec, hit.accent);
}

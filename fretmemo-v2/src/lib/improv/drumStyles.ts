/**
 * Plan F4: the backing band under the improv loops — drums, rhythm-guitar
 * comping and an optional bass line, one pattern per style. Each pattern is
 * one bar of 4/4; a hit sits at a beat position (0 ≤ at < 4), triplets as thirds.
 */
import { playChord } from "@/lib/audio";
import { getChordMidis, getChordPitchClasses, tonicMidi } from "@/lib/improv/chords";
import { scheduleBass, scheduleHat, scheduleKick, scheduleSnare } from "@/rhythm/engine/drumVoices";

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

/** Rhythm-guitar strums: length in beats, loudness 0..1, `up` for an upstroke. */
interface CompHit { at: number; len: number; vel: number; up?: boolean }
type BassDegree = "root" | "fifth" | "sixth";
interface BassHit { at: number; len: number; degree: BassDegree }

export const COMP_STYLES: Record<DrumStyleId, CompHit[]> = {
    off: [], // one ringing strum per chord, see scheduleBackingBeat
    rock: [
        { at: 0, len: 0.9, vel: 1 }, { at: 1, len: 0.45, vel: 0.75 }, { at: 1.5, len: 0.4, vel: 0.6, up: true },
        { at: 2, len: 0.9, vel: 0.95 }, { at: 3, len: 0.45, vel: 0.75 }, { at: 3.5, len: 0.4, vel: 0.6, up: true },
    ],
    // Charleston: a short chop on 1 and a longer one on the swung "and" of 2.
    swing: [{ at: 0, len: 0.6, vel: 0.9 }, { at: 1 + T2, len: 0.9, vel: 0.8 }],
    shuffle: [0, 1, 2, 3].flatMap((beat) => [
        { at: beat, len: 0.55, vel: beat % 2 ? 0.95 : 0.8 },
        { at: beat + T2, len: 0.3, vel: 0.55, up: true },
    ]),
    // First bar of the classic bossa figure: 1, the "and" of 2, 4.
    bossa: [{ at: 0, len: 0.45, vel: 0.8 }, { at: 1.5, len: 0.45, vel: 0.75 }, { at: 3, len: 0.45, vel: 0.8 }],
};

export const BASS_STYLES: Record<DrumStyleId, BassHit[]> = {
    off: [], // root on the chord's first and third beat, see scheduleBackingBeat
    rock: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((at) => ({ at, len: 0.45, degree: "root" as const })),
    swing: [{ at: 0, len: 1.8, degree: "root" }, { at: 2, len: 1.8, degree: "fifth" }],
    // Boogie figure: root, fifth, sixth (minor seventh over minor chords), fifth.
    shuffle: [{ at: 0, len: 0.9, degree: "root" }, { at: 1, len: 0.9, degree: "fifth" }, { at: 2, len: 0.9, degree: "sixth" }, { at: 3, len: 0.9, degree: "fifth" }],
    bossa: [{ at: 0, len: 1.4, degree: "root" }, { at: 1.5, len: 0.45, degree: "root" }, { at: 2, len: 1.4, degree: "fifth" }, { at: 3.5, len: 0.45, degree: "fifth" }],
};

/** Hits of one beat of the bar, `offset` in beats from that beat. */
function beatSlice<T extends { at: number }>(hits: T[], beatInBar: number): Array<T & { offset: number }> {
    return hits.filter((hit) => Math.floor(hit.at + 1e-9) === beatInBar).map((hit) => ({ ...hit, offset: hit.at - beatInBar }));
}

export function drumHitsForBeat(style: DrumStyleId, beatInBar: number): Array<{ offset: number; voice: Voice; accent: boolean }> {
    return beatSlice(DRUM_STYLES[style], beatInBar).map(({ offset, voice, accent }) => ({ offset, voice, accent: Boolean(accent) }));
}

export function compHitsForBeat(style: DrumStyleId, beatInBar: number) {
    return beatSlice(COMP_STYLES[style], beatInBar);
}

/** Bass hits of one beat; a hit that starts a chord always plays its root. */
export function bassHitsForBeat(style: DrumStyleId, beatInBar: number, chordStart: boolean) {
    return beatSlice(BASS_STYLES[style], beatInBar).map((hit) => (chordStart && hit.offset === 0 ? { ...hit, degree: "root" as const } : hit));
}

/** Semitones above the chord root for a bass degree. */
export function bassSemitones(degree: BassDegree, chord: string): number {
    if (degree === "root") return 0;
    if (degree === "fifth") return 7;
    const root = tonicMidi(chord, 0) % 12;
    const tones = getChordPitchClasses(chord);
    return tones.includes((root + 3) % 12) && !tones.includes((root + 4) % 12) ? 10 : 9;
}

const VOICES = { kick: scheduleKick, snare: scheduleSnare, hat: scheduleHat };

/** Schedules the hits of one beat at its exact audio time. */
export function scheduleDrumBeat(context: AudioContext, style: DrumStyleId, beatInBar: number, time: number, beatSec: number): void {
    for (const hit of drumHitsForBeat(style, beatInBar)) VOICES[hit.voice](context, time + hit.offset * beatSec, hit.accent);
}

const OFF_CHORD_SEC = 1.1;
const OFF_STAGGER_SEC = 0.055;
const STRUM_SEC = 0.014;
/** Random factor around 1: repeated hits differ slightly, like a player's. */
const spread = (amount: number) => 1 - amount + Math.random() * 2 * amount;

export interface BackingBeat { chord: string; beatInBar: number; beatInChord: number; time: number }

/** Schedules one beat of the backing band (drums, comping, optional bass) at its audio time. */
export function scheduleBackingBeat(context: AudioContext, style: DrumStyleId, beat: BackingBeat, beatSec: number, withBass: boolean): void {
    scheduleDrumBeat(context, style, beat.beatInBar, beat.time, beatSec);
    const chordMidis = getChordMidis(beat.chord, 48);
    const root = tonicMidi(beat.chord, 36);
    if (style === "off") {
        if (beat.beatInChord === 0) void playChord(chordMidis, OFF_CHORD_SEC, { when: beat.time, strumDelaySec: OFF_STAGGER_SEC });
        if (withBass && (beat.beatInChord === 0 || beat.beatInChord === 2)) scheduleBass(context, root, beat.time, beat.beatInChord === 0 ? 1.6 : 1.2);
        return;
    }
    for (const hit of compHitsForBeat(style, beat.beatInBar)) {
        void playChord(chordMidis, hit.len * beatSec, {
            when: beat.time + hit.offset * beatSec + (Math.random() - 0.5) * 0.012,
            velocity: hit.vel * spread(0.1),
            up: hit.up,
            strumDelaySec: STRUM_SEC * spread(0.25),
        });
    }
    if (!withBass) return;
    for (const hit of bassHitsForBeat(style, beat.beatInBar, beat.beatInChord === 0)) {
        scheduleBass(context, root + bassSemitones(hit.degree, beat.chord), beat.time + hit.offset * beatSec, hit.len * beatSec * 0.95, spread(0.1));
    }
}

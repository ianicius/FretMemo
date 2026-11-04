/**
 * Sampled guitar voice sources.
 *
 * Two sample sets back the engine chain; the active preset decides which one
 * answers (see `resolveSampleSetId` callers in `lib/audio.ts`):
 *
 * - `nylon`    — UIowa Electronic Music Studios Raimundo 118 classical
 *                guitar, chromatic E2–B5 (42 verified notes, mf). Used by the
 *                classic guitar preset (`amp: 'classic'`).
 * - `electric` — Karoryfer "Black and Green Guitars" Gretsch, naturals
 *                E3–D7 (28 notes). Used by every NAM amp preset.
 *
 * Loading is lazy per set and idempotent: the first playback call that needs
 * a set starts its fetch (always a user gesture, so autoplay policy is
 * respected). Every decoded note is peak-normalized to `SET_TARGET_PEAK`, so
 * both sets share one loudness. Until a set is decoded — and permanently if
 * its load fails — the additive synth in `lib/audio.ts` keeps answering: the
 * sampler can only upgrade the timbre, never break playback.
 *
 * Tuning: the electric set is played at concert pitch (±1-semitone
 * playbackRate shifts against the nearest sampled natural). The nylon set is
 * corrected per note through `NYLON_DETECTED_F0` (the 1961 recordings run up
 * to ~45 cents flat), falling back to semitone shifts for notes the set does
 * not contain (C6 and above shift down from B5).
 */

import { NYLON_DETECTED_F0 } from './nylonTuning';

export type SampleSetId = 'electric' | 'nylon';

/** Lowest/highest sampled notes of the electric (Karoryfer) set. */
export const SAMPLE_LOW_MIDI = 52; // E3
export const SAMPLE_HIGH_MIDI = 98; // D7

/** Sampled naturals of the electric set (upstream recorded no accidentals). */
export const SAMPLED_MIDIS: readonly number[] = (() => {
    const midis: number[] = [];
    for (let midi = SAMPLE_LOW_MIDI; midi <= SAMPLE_HIGH_MIDI; midi += 1) {
        const pitchClass = ((midi % 12) + 12) % 12;
        if ([0, 2, 4, 5, 7, 9, 11].includes(pitchClass)) {
            midis.push(midi);
        }
    }
    return midis;
})();

/** Every decoded note is peak-normalized to this level before caching. */
export const SET_TARGET_PEAK = 0.3;

/** Fade length applied at the very end of a sample to avoid a click. */
export const SAMPLE_TAIL_FADE_SEC = 0.12;

/**
 * Musical release: the additive synth decayed BY durationSec, so a requested
 * note ends at its duration + this short mute fade (not at the multi-second
 * natural end of the recording, which smeared notes together in fast
 * sequences).
 */
export const SAMPLE_RELEASE_SEC = 0.18;

/** Shortest ring before the release fade may start. */
export const SAMPLE_MIN_RING_SEC = 0.25;

const SET_DIRS: Record<SampleSetId, string> = {
    electric: 'samples/electric',
    nylon: 'samples/nylon',
};

interface SampleSetRuntime {
    buffers: Map<number, AudioBuffer> | null;
    loadPromise: Promise<void> | null;
}

const runtime: Record<SampleSetId, SampleSetRuntime> = {
    electric: { buffers: null, loadPromise: null },
    nylon: { buffers: null, loadPromise: null },
};

/** True once the given set is decoded and playSampleVoice will answer. */
export function isSamplerReady(setId: SampleSetId): boolean {
    return runtime[setId].buffers !== null;
}

function sampleUrl(setId: SampleSetId, midi: number): string {
    return `${import.meta.env.BASE_URL}sound/${SET_DIRS[setId]}/${midi}.mp3`;
}

function getSampledMidis(setId: SampleSetId): readonly number[] {
    return setId === 'electric' ? SAMPLED_MIDIS : NYLON_DETECTED_F0
        ? Object.keys(NYLON_DETECTED_F0).map(Number).sort((a, b) => a - b)
        : SAMPLED_MIDIS;
}

/** Nearest sampled neighbour of `midi` among the currently loaded notes. */
export function pickSampleMidi(setId: SampleSetId, midi: number): number | null {
    const buffers = runtime[setId].buffers;
    if (!buffers || buffers.size === 0) return null;
    const clamped = Math.round(midi);
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const sampled of buffers.keys()) {
        const distance = Math.abs(clamped - sampled);
        if (distance < bestDistance) {
            best = sampled;
            bestDistance = distance;
        }
    }
    return best;
}

/** playbackRate that turns the nearest sample into the requested pitch. */
export function computeSampleRate(setId: SampleSetId, midi: number): number {
    const sampleMidi = pickSampleMidi(setId, midi);
    if (sampleMidi === null) return 1;
    if (setId === 'nylon') {
        const detected = NYLON_DETECTED_F0[sampleMidi];
        if (detected) return 440 * 2 ** ((midi - 69) / 12) / detected;
    }
    return 2 ** ((midi - sampleMidi) / 12);
}

/** Fetch and decode every note of one set. Idempotent; retried on failure. */
export function loadSampler(ctx: BaseAudioContext, setId: SampleSetId): Promise<void> {
    const set = runtime[setId];
    if (set.loadPromise) return set.loadPromise;
    set.loadPromise = (async () => {
        const notes = getSampledMidis(setId);
        const entries: Array<[number, AudioBuffer]> = [];
        await Promise.all(
            notes.map(async (midi) => {
                try {
                    const response = await fetch(sampleUrl(setId, midi));
                    if (!response.ok) return;
                    const bytes = await response.arrayBuffer();
                    const buffer = await ctx.decodeAudioData(bytes);
                    entries.push([midi, normalizePeak(buffer, SET_TARGET_PEAK)]);
                } catch {
                    // One missing or corrupt note: the rest still loads.
                }
            }),
        );
        if (entries.length === 0) {
            set.loadPromise = null; // allow a later retry
            throw new Error(`sampler: no notes decoded for set ${setId}`);
        }
        set.buffers = new Map(entries);
    })();
    return set.loadPromise;
}

/** Fire-and-forget preload used by the playback entry points. */
export function ensureSamplerLoaded(ctx: BaseAudioContext, setId: SampleSetId): void {
    loadSampler(ctx, setId).catch(() => {
        // Silent: the additive synth keeps answering until a retry succeeds.
    });
}

/** @internal test hook: drop loaded buffers and pending loads (one or all). */
export function resetSampler(setId?: SampleSetId): void {
    const targets = setId ? [setId] : (Object.keys(runtime) as SampleSetId[]);
    for (const id of targets) {
        runtime[id].buffers = null;
        runtime[id].loadPromise = null;
    }
}

function normalizePeak(buffer: AudioBuffer, targetPeak: number): AudioBuffer {
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i += 1) {
            const abs = Math.abs(data[i]);
            if (abs > peak) peak = abs;
        }
    }
    if (peak > 0 && Math.abs(peak - targetPeak) > 0.005) {
        const scale = targetPeak / peak;
        for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < data.length; i += 1) {
                data[i] *= scale;
            }
        }
    }
    return buffer;
}

export interface SampleVoiceHandle {
    source: AudioBufferSourceNode;
    gain: GainNode;
}

/**
 * Play one sampled note into `destination`. Returns null when the requested
 * set is not ready (caller falls back to the synth). `gainScale` lets chords
 * keep their per-note balance (1/sqrt(n)). The note rings its natural decay
 * until `when + durationSec`, then a short mute fade releases it — the same
 * duration contract the additive synth had.
 */
export function playSampleVoice(
    ctx: BaseAudioContext,
    destination: AudioNode,
    midi: number,
    when: number,
    gainScale: number,
    durationSec: number,
    setId: SampleSetId,
): SampleVoiceHandle | null {
    const set = runtime[setId];
    if (!set.buffers) return null;
    const sampleMidi = pickSampleMidi(setId, midi);
    if (sampleMidi === null) return null;
    const buffer = set.buffers.get(sampleMidi);
    if (!buffer) return null;

    const rate = computeSampleRate(setId, midi);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;

    const gain = ctx.createGain();
    const naturalEnd = when + buffer.duration / rate;
    const releaseStart = Math.min(
        when + Math.max(durationSec, SAMPLE_MIN_RING_SEC),
        Math.max(when, naturalEnd - SAMPLE_RELEASE_SEC),
    );
    const stopAt = Math.min(releaseStart + SAMPLE_RELEASE_SEC, naturalEnd);
    gain.gain.setValueAtTime(SET_TARGET_PEAK * gainScale, when);
    gain.gain.setValueAtTime(SET_TARGET_PEAK * gainScale, releaseStart);
    gain.gain.linearRampToValueAtTime(0, stopAt);

    source.connect(gain);
    gain.connect(destination);
    source.start(when);
    source.stop(stopAt);

    return { source, gain };
}

/**
 * Sampled guitar voice source.
 *
 * Chromatic-range MP3 notes (one file per sampled semitone, E3–D7) from the
 * CC0-licensed Karoryfer "Black and Green Guitars" library replace the
 * additive synth as the dry guitar source feeding the engine chain. Only
 * natural notes were sampled upstream, so a requested note is mapped to the
 * nearest sampled neighbour and pitch-shifted by playbackRate — the same
 * ±1-semitone key-group convention soundfont players use. Outside the sampled
 * range the edge samples are shifted further (down to −12 semitones at E2).
 *
 * Loading is lazy and idempotent: the first playback call starts the fetch
 * (always a user gesture, so autoplay policy is respected), and until the
 * buffers are decoded the additive synth in `lib/audio.ts` keeps answering —
 * the sampler can only upgrade the timbre, never break playback. A failed
 * load resets itself so a later call retries.
 */

/** Lowest sampled note: E3. */
export const SAMPLE_LOW_MIDI = 52;
/** Highest sampled note: D7. */
export const SAMPLE_HIGH_MIDI = 98;

/**
 * Loudness trim: the raw mf samples peak at −16.8 dBFS; ×2.2 lands the pluck
 * transient near the additive synth's 0.35 peak the chain staging was tuned
 * for, so switching sources does not jump the level.
 */
export const SAMPLE_TRIM = 2.2;

/** Fade length applied at the very end of a sample to avoid a click. */
export const SAMPLE_TAIL_FADE_SEC = 0.12;

/** MIDI numbers that actually have a sample file (upstream sampled naturals only). */
export const SAMPLED_MIDIS: readonly number[] = (() => {
    const midis: number[] = [];
    for (let midi = SAMPLE_LOW_MIDI; midi <= SAMPLE_HIGH_MIDI; midi += 1) {
        // A semitone is sampled iff its pitch-class is one of the naturals
        // C D E F G A B — the Karoryfer set contains no accidentals.
        const pitchClass = ((midi % 12) + 12) % 12;
        if ([0, 2, 4, 5, 7, 9, 11].includes(pitchClass)) {
            midis.push(midi);
        }
    }
    return midis;
})();

let buffers: Map<number, AudioBuffer> | null = null;
let loadPromise: Promise<void> | null = null;

/** True once the sampled notes are decoded and playSampleVoice will answer. */
export function isSamplerReady(): boolean {
    return buffers !== null;
}

/** Nearest sampled neighbour of `midi` (pitch-class snapped, then clamped). */
export function pickSampleMidi(midi: number): number {
    const clamped = Math.min(Math.max(Math.round(midi), SAMPLE_LOW_MIDI), SAMPLE_HIGH_MIDI);
    let best = SAMPLED_MIDIS[0];
    let bestDistance = Math.abs(clamped - best);
    for (const sampled of SAMPLED_MIDIS) {
        const distance = Math.abs(clamped - sampled);
        if (distance < bestDistance) {
            best = sampled;
            bestDistance = distance;
        }
    }
    return best;
}

/** playbackRate that turns the nearest sample into the requested pitch. */
export function computeSampleRate(midi: number): number {
    return Math.pow(2, (midi - pickSampleMidi(midi)) / 12);
}

function getSampleUrl(midi: number): string {
    return `${import.meta.env.BASE_URL}sound/samples/${midi}.mp3`;
}

/**
 * Fetch and decode every sampled note. Idempotent; on failure the promise is
 * dropped so the next call retries.
 */
export function loadSampler(ctx: BaseAudioContext): Promise<void> {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
        const entries: Array<[number, AudioBuffer]> = [];
        await Promise.all(
            SAMPLED_MIDIS.map(async (midi) => {
                try {
                    const response = await fetch(getSampleUrl(midi));
                    if (!response.ok) return;
                    const bytes = await response.arrayBuffer();
                    entries.push([midi, await ctx.decodeAudioData(bytes)]);
                } catch {
                    // One missing or corrupt note: the rest still loads.
                }
            }),
        );
        if (entries.length === 0) {
            loadPromise = null; // allow a later retry
            throw new Error('sampler: no notes decoded');
        }
        buffers = new Map(entries);
    })();
    return loadPromise;
}

/** Fire-and-forget preload used by the playback entry points. */
export function ensureSamplerLoaded(ctx: BaseAudioContext): void {
    loadSampler(ctx).catch(() => {
        // Silent: the additive synth keeps answering until a retry succeeds.
    });
}

/** @internal test hook: drop the loaded buffers and any pending load. */
export function resetSampler(): void {
    buffers = null;
    loadPromise = null;
}

export interface SampleVoiceHandle {
    source: AudioBufferSourceNode;
    gain: GainNode;
}

/**
 * Play one sampled note into `destination`. Returns null when the sampler is
 * not ready (caller falls back to the synth). `gainScale` lets chords keep
 * their per-note balance (1/sqrt(n)) on top of the loudness trim.
 */
export function playSampleVoice(
    ctx: BaseAudioContext,
    destination: AudioNode,
    midi: number,
    when: number,
    gainScale = 1,
): SampleVoiceHandle | null {
    if (!buffers) return null;
    const sampleMidi = pickSampleMidi(midi);
    const buffer = buffers.get(sampleMidi);
    if (!buffer) return null;

    const rate = computeSampleRate(midi);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;

    const gain = ctx.createGain();
    const peak = SAMPLE_TRIM * gainScale;
    const naturalEnd = when + buffer.duration / rate;
    const fadeStart = Math.max(when, naturalEnd - SAMPLE_TAIL_FADE_SEC);
    gain.gain.setValueAtTime(peak, when);
    gain.gain.setValueAtTime(peak, fadeStart);
    gain.gain.linearRampToValueAtTime(0, naturalEnd);

    source.connect(gain);
    gain.connect(destination);
    source.start(when);
    source.stop(naturalEnd);

    return { source, gain };
}

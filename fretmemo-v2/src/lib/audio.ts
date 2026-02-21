/**
 * Guitar-like Web Audio synthesis.
 *
 * Uses additive synthesis with harmonic overtones, a
 * body-resonance bandpass filter, and a pluck-style
 * envelope to approximate a nylon-string classical guitar.
 *
 * No external samples — 100% Web Audio API.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

/** Convert MIDI note number to frequency (A4 = 440 Hz). */
export function midiToFrequency(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/* ─────────── Excitation noise burst ─────────── */

function createNoiseBurst(ctx: AudioContext, duration: number): AudioBufferSourceNode {
    const sampleRate = ctx.sampleRate;
    const length = Math.ceil(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
}

/* ─────────── Guitar voice ─────────── */

/**
 * Play a single guitar-like note at the given MIDI number.
 *
 * Uses 5 detuned harmonics with decreasing amplitude,
 * shaped by a pluck envelope (fast attack, natural decay),
 * and filtered through a resonant lowpass + body bandpass to
 * approximate nylon-string warmth.
 */
export function playTone(midi: number, durationSec = 1.2): Promise<void> {
    const ctx = getAudioContext();
    const freq = midiToFrequency(midi);
    const now = ctx.currentTime;

    // — Master output chain —
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.40, now);

    // Body resonance: bandpass centred around 200-400 Hz (classical guitar body)
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = "peaking";
    bodyFilter.frequency.setValueAtTime(280, now);
    bodyFilter.Q.setValueAtTime(1.2, now);
    bodyFilter.gain.setValueAtTime(6, now);

    // Brightness: lowpass to cut harsh upper harmonics
    const brightnessFilter = ctx.createBiquadFilter();
    brightnessFilter.type = "lowpass";
    // Lower notes → darker; higher notes → brighter
    const cutoff = Math.min(freq * 6, 6000);
    brightnessFilter.frequency.setValueAtTime(cutoff, now);
    brightnessFilter.Q.setValueAtTime(0.7, now);

    masterGain.connect(bodyFilter);
    bodyFilter.connect(brightnessFilter);
    brightnessFilter.connect(ctx.destination);

    // — Harmonics —
    const harmonics = [
        { ratio: 1, amp: 1.0 },      // fundamental
        { ratio: 2, amp: 0.45 },     // 2nd harmonic
        { ratio: 3, amp: 0.25 },     // 3rd
        { ratio: 4, amp: 0.12 },     // 4th
        { ratio: 5, amp: 0.06 },     // 5th
    ];

    for (const h of harmonics) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Use triangle for the fundamental (warm), sine for overtones
        osc.type = h.ratio === 1 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq * h.ratio, now);
        // Slight detune for organic feel
        osc.detune.setValueAtTime((Math.random() - 0.5) * 4, now);

        // Pluck envelope per harmonic: higher harmonics decay faster
        const peakAmp = h.amp * 0.35;
        const decayTime = durationSec / (1 + h.ratio * 0.35);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(peakAmp, now + 0.003);   // very fast attack (pluck)
        gain.gain.exponentialRampToValueAtTime(peakAmp * 0.3, now + 0.08);  // initial drop
        gain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);      // sustain tail

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + durationSec);
    }

    // — Noise burst for "pluck" attack —
    const noise = createNoiseBurst(ctx, 0.04);
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(freq * 2, now);
    noiseFilter.Q.setValueAtTime(2, now);

    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.05);

    return new Promise((resolve) => {
        setTimeout(resolve, durationSec * 1000);
    });
}

/**
 * Play multiple MIDI notes simultaneously (chord).
 * Slightly staggered for a natural strum effect.
 */
export interface PlayChordOptions {
    strumDelaySec?: number;
}

export function playChord(midis: number[], durationSec = 1.5, options: PlayChordOptions = {}): Promise<void> {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const strumDelay = Math.max(0, options.strumDelaySec ?? 0.025); // natural strum by default

    const promises = midis.map((midi, i) => {
        const freq = midiToFrequency(midi);
        const offset = i * strumDelay;
        const startAt = now + offset;

        // Master per-voice
        const voiceGain = ctx.createGain();
        const vol = 0.28 / Math.sqrt(midis.length);

        // Body filter
        const bodyFilter = ctx.createBiquadFilter();
        bodyFilter.type = "peaking";
        bodyFilter.frequency.setValueAtTime(280, startAt);
        bodyFilter.Q.setValueAtTime(1.0, startAt);
        bodyFilter.gain.setValueAtTime(4, startAt);

        const lpf = ctx.createBiquadFilter();
        lpf.type = "lowpass";
        lpf.frequency.setValueAtTime(Math.min(freq * 5, 5000), startAt);
        lpf.Q.setValueAtTime(0.6, startAt);

        voiceGain.connect(bodyFilter);
        bodyFilter.connect(lpf);
        lpf.connect(ctx.destination);

        // Harmonics
        const harmonics = [
            { ratio: 1, amp: 1.0 },
            { ratio: 2, amp: 0.35 },
            { ratio: 3, amp: 0.18 },
        ];

        for (const h of harmonics) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = h.ratio === 1 ? "triangle" : "sine";
            osc.frequency.setValueAtTime(freq * h.ratio, startAt);
            osc.detune.setValueAtTime((Math.random() - 0.5) * 5, startAt);

            const peakAmp = vol * h.amp;
            const decayTime = durationSec / (1 + h.ratio * 0.4);

            gain.gain.setValueAtTime(0, startAt);
            gain.gain.linearRampToValueAtTime(peakAmp, startAt + 0.004);
            gain.gain.exponentialRampToValueAtTime(peakAmp * 0.25, startAt + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, startAt + decayTime);

            osc.connect(gain);
            gain.connect(voiceGain);
            osc.start(startAt);
            osc.stop(startAt + durationSec);
        }

        return new Promise<void>((resolve) => {
            setTimeout(resolve, (offset + durationSec) * 1000);
        });
    });

    return Promise.all(promises).then(() => { });
}

/**
 * Play two notes sequentially (ascending interval).
 */
export async function playInterval(midi1: number, midi2: number, noteDuration = 0.8, gap = 0.12): Promise<void> {
    await playTone(midi1, noteDuration);
    await new Promise((r) => setTimeout(r, gap * 1000));
    await playTone(midi2, noteDuration);
}

export type IntervalPlaybackDirection = "ascending" | "descending" | "harmonic";

export interface IntervalPlaybackOptions {
    direction?: IntervalPlaybackDirection;
    noteDuration?: number;
    gap?: number;
}

export async function playIntervalPrompt(
    midi1: number,
    midi2: number,
    options: IntervalPlaybackOptions = {},
): Promise<void> {
    const direction = options.direction ?? "ascending";
    const noteDuration = options.noteDuration ?? 0.8;
    const gap = options.gap ?? 0.12;

    if (direction === "descending") {
        await playInterval(midi2, midi1, noteDuration, gap);
        return;
    }

    if (direction === "harmonic") {
        await playChord([midi1, midi2], noteDuration, { strumDelaySec: 0 });
        return;
    }

    await playInterval(midi1, midi2, noteDuration, gap);
}

export interface CadencePlaybackOptions {
    chordDurationSec?: number;
    chordGapSec?: number;
}

export interface FunctionalPromptOptions extends CadencePlaybackOptions {
    contextChords: number[][];
    targetMidi: number;
    targetDurationSec?: number;
    targetGapSec?: number;
    includeTarget?: boolean;
}

function sleepMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function playCadence(
    chords: number[][],
    options: CadencePlaybackOptions = {},
): Promise<void> {
    const chordDurationSec = options.chordDurationSec ?? 0.75;
    const chordGapSec = options.chordGapSec ?? 0.06;

    for (let i = 0; i < chords.length; i += 1) {
        const chord = chords[i];
        if (!chord || chord.length === 0) continue;
        await playChord(chord, chordDurationSec);
        if (i < chords.length - 1 && chordGapSec > 0) {
            await sleepMs(chordGapSec * 1000);
        }
    }
}

export async function playFunctionalPrompt(options: FunctionalPromptOptions): Promise<void> {
    const targetDurationSec = options.targetDurationSec ?? 1.0;
    const targetGapSec = options.targetGapSec ?? 0.12;
    const includeTarget = options.includeTarget ?? true;

    await playCadence(options.contextChords, options);
    if (!includeTarget) return;
    if (targetGapSec > 0) {
        await sleepMs(targetGapSec * 1000);
    }
    await playTone(options.targetMidi, targetDurationSec);
}

/**
 * Ensure audio context is ready (call on first user interaction).
 */
export function initAudio(): void {
    getAudioContext();
}

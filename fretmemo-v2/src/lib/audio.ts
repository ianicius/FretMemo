/**
 * Guitar-like Web Audio synthesis.
 *
 * The primary voice source is a sampled guitar (chromatic MP3 notes from the
 * CC0-licensed Karoryfer "Black and Green Guitars" library, see
 * `src/audio/sampler.ts`); the additive synth below is the fallback that
 * answers until the sample buffers are decoded (and permanently if loading
 * fails). Both terminate in the sound engine's voice bus (`src/audio/engine.ts`)
 * instead of `ctx.destination`: the bus feeds the preset chain (input gain →
 * amp stage → EQ → comp → delay → reverb → master gain). The historical
 * per-voice body/brightness filter pair lives in the engine's classic amp
 * stage (`buildClassicAmpStage`); count-in clicks stay on `ctx.destination`
 * directly (they are not guitar sound).
 */

import {
    getSoundEngineContext,
    getSoundEngineVoiceBus,
    initSoundEngine,
    soundEngine,
} from '@/audio/engine';
import { getPresetById } from '@/audio/presets';
import {
    ensureSamplerLoaded,
    isSamplerReady,
    playSampleVoice,
    type SampleSetId,
} from '@/audio/sampler';

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

/**
 * Which sample set answers for the active preset: the classic guitar preset
 * plays the nylon samples, every NAM amp preset plays the electric (Gretsch)
 * ones. Defaults to nylon (the default preset's voice).
 */
function resolveSampleSetId(): SampleSetId {
    try {
        const { presetId } = soundEngine.getState();
        const preset = presetId ? getPresetById(presetId) : null;
        return preset && preset.amp !== 'classic' ? 'electric' : 'nylon';
    } catch {
        return 'nylon';
    }
}

/* ─────────── Guitar voice ─────────── */

/**
 * Play a single guitar-like note at the given MIDI number.
 *
 * Primary source: a sampled guitar note (see `src/audio/sampler.ts`). Until
 * the sample buffers are decoded — and permanently if loading fails — the
 * 5-harmonic additive synth below answers. The voice is routed into the sound
 * engine's voice bus, where the preset chain (amp stage, EQ, effects, master
 * volume) shapes it further.
 */
export function playTone(midi: number, durationSec = 1.2): Promise<void> {
    const ctx = getSoundEngineContext();
    const freq = midiToFrequency(midi);
    const now = ctx.currentTime;

    // Voice hub: sums this voice's partials into the engine voice bus.
    // (The historical 0.40 per-voice master gain now lives once in the
    // engine, scaled by the volume setting — see VOICE_BUS_TRIM.)
    const voiceHub = ctx.createGain();
    voiceHub.gain.setValueAtTime(1, now);
    voiceHub.connect(getSoundEngineVoiceBus());

    // Sampling is lazy: the first playback call (always a user gesture)
    // starts the fetch; the synth answers until the buffers are ready.
    const sampleSet = resolveSampleSetId();
    ensureSamplerLoaded(ctx, sampleSet);

    if (isSamplerReady(sampleSet)) {
        playSampleVoice(ctx, voiceHub, midi, now, 1, durationSec, sampleSet);
        return new Promise((resolve) => setTimeout(resolve, durationSec * 1000));
    }

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
        gain.connect(voiceHub);
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
    noiseGain.connect(voiceHub);
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
    const ctx = getSoundEngineContext();
    const now = ctx.currentTime;
    const strumDelay = Math.max(0, options.strumDelaySec ?? 0.025);
    const voiceBus = getSoundEngineVoiceBus();

    const promises = midis.map((midi, i) => {
        const freq = midiToFrequency(midi);
        const offset = i * strumDelay;
        const startAt = now + offset;

        // Master per-voice
        const voiceGain = ctx.createGain();
        const vol = 0.28 / Math.sqrt(midis.length);
        voiceGain.connect(voiceBus);

        const sampleSet = resolveSampleSetId();
        ensureSamplerLoaded(ctx, sampleSet);

        if (isSamplerReady(sampleSet)) {
            // Sampled voice with the chord's per-note balance on top of the
            // sampler's per-note loudness normalization (SET_TARGET_PEAK).
            playSampleVoice(ctx, voiceGain, midi, startAt, 1 / Math.sqrt(midis.length), durationSec, sampleSet);
            return new Promise<void>((resolve) => {
                setTimeout(resolve, (offset + durationSec) * 1000);
            });
        }

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
 * Delegates to the sound engine's idempotent warm-up.
 */
export function initAudio(): void {
    initSoundEngine();
}

/**
 * Schedule one bar of metronome count-in clicks (accent on beat 1).
 *
 * Uses the same click voice as the practice metronome in `useGameStore`
 * (triangle, 1040 Hz accent / 760 Hz beat) so the count-in flows into the
 * session seamlessly. Clicks stay on `ctx.destination` — they are not
 * guitar sound and must not run through the preset chain. Safe when no
 * AudioContext exists (tests, blocked autoplay): the call degrades to a
 * no-op and visual count-in still runs.
 */
export function playCountInClicks(bpm: number, beats = 4): void {
    try {
        const audioContext = getSoundEngineContext();
        const beatSec = 60 / Math.max(1, bpm);
        // Small margin so the first click never lands on `currentTime`.
        const startAt = audioContext.currentTime + 0.08;
        for (let beat = 0; beat < beats; beat += 1) {
            const isAccent = beat === 0;
            const when = startAt + beatSec * beat;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.type = "triangle";
            oscillator.frequency.setValueAtTime(isAccent ? 1040 : 760, when);
            gainNode.gain.setValueAtTime(isAccent ? 0.14 : 0.08, when);
            gainNode.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
            oscillator.start(when);
            oscillator.stop(when + 0.05);
        }
    } catch {
        // Audio unavailable: visual count-in still runs.
    }
}

/**
 * Web Audio chain builders for the sound engine.
 *
 * Everything here is "pure-ish": each factory takes an AudioContext (or any
 * object exposing the standard node factories, which lets tests pass a stub)
 * plus plain params, wires up nodes and returns them. No module state, no
 * store access — the engine composes these builders.
 *
 * Stage order (see docs/sound-engine.md):
 *   voiceBus → inputGain → amp stage (classic pair | NAM node) →
 *   cabinet (filter curve | IR convolver | none) →
 *   EQ (low shelf → mid peak → high shelf) → compressor →
 *   chorus (parallel wet, only when on) → tremolo (only when on) →
 *   delay (parallel wet) → reverb (parallel wet) → outputGain
 */

import { isGateWorkletReady } from './gate';
import {
    CAB_NONE,
    DRIVE_CHARACTERS,
    IMPULSE_RESPONSES,
    driveCharacterOf,
    type ChainBlock,
    type ChainParams,
    type SoundPreset,
} from './presets';

/** Minimal node surface the builders rely on (also satisfied by test stubs). */
export interface ChainAudioNode {
    connect(destination: AudioNode | ChainAudioNode, output?: number, input?: number): unknown;
    disconnect(destination?: unknown): unknown;
}

/**
 * Connect through the loose node surface (works for real AudioNodes and for
 * the lightweight stubs used in unit tests).
 */
export function connectNodes(source: ChainAudioNode, destination: ChainAudioNode): void {
    source.connect(destination);
}

/** Disconnect, optionally targeting one destination only. */
export function disconnectNodes(source: ChainAudioNode, destination?: ChainAudioNode): void {
    if (destination === undefined) {
        source.disconnect();
    } else {
        source.disconnect(destination);
    }
}

export interface AssembledChain {
    /** Where voices (the voice bus) connect into. */
    input: ChainAudioNode;
    /** Connect this into the engine master gain. */
    output: ChainAudioNode;
    /** Disconnect every node this assembly created (not externally owned NAM nodes). */
    dispose(): void;
}

export interface ClassicAmpStage {
    /** Body resonance: peaking 280 Hz, Q 1.2, +6 dB. */
    bodyFilter: BiquadFilterNode;
    /** Brightness: lowpass, fixed ~4 kHz cutoff, Q 0.7. */
    brightnessFilter: BiquadFilterNode;
    input: BiquadFilterNode;
    output: BiquadFilterNode;
}

export interface EqStages {
    bass: BiquadFilterNode;
    mid: BiquadFilterNode;
    treble: BiquadFilterNode;
}

export interface DelayStages {
    delay: DelayNode;
    feedback: GainNode;
    wet: GainNode;
    dry: GainNode;
    input: GainNode;
    output: GainNode;
}

export interface ReverbStages {
    convolver: ConvolverNode;
    wet: GainNode;
    dry: GainNode;
    input: GainNode;
    output: GainNode;
}

export const CLASSIC_AMP_STAGE = {
    /** Body-resonance peaking filter (from the historical per-voice pair). */
    bodyFrequencyHz: 280,
    bodyQ: 1.2,
    bodyGainDb: 6,
    /**
     * Fixed brightness cutoff. The historical per-voice filter used
     * `min(freq * 6, 6000)`; since the sampled guitar source landed
     * (real recordings keep meaningful air up to ~8 kHz) the stage uses
     * one fixed cutoff that keeps the warmth without dulling the pluck.
     */
    brightnessCutoffHz: 8000,
    brightnessQ: 0.7,
} as const;

export const EQ_STAGE = {
    bassFrequencyHz: 200,
    midFrequencyHz: 1000,
    midQ: 0.9,
    trebleFrequencyHz: 3200,
} as const;

export const DRIVE_STAGE = {
    curveSampleCount: 1024,
    /** Steepness multiplier: amount 1 → tanh(60x) hard-ish clip. */
    maxSteepness: 60,
} as const;

export const COMPRESSOR_STAGE = {
    /** At amount 1: threshold −24 dB, ratio 12:1. Amount 0 is neutral. */
    maxThresholdDb: -24,
    maxRatio: 12,
    maxKneeDb: 30,
    attackSec: 0.003,
    releaseSec: 0.25,
} as const;

export const DELAY_STAGE = {
    delayTimeSec: 0.28,
    feedback: 0.35,
} as const;

export const CHORUS_STAGE = {
    baseDelaySec: 0.012,
    depthSec: 0.003,
    rateHz: 0.8,
} as const;

export const PHASER_STAGE = {
    stages: 4,
    centerHz: 900,
    /** Peak LFO deviation at depth 1. The center stays high enough that the sweep never crosses 0 Hz. */
    sweepHz: 700,
    feedback: 0.45,
} as const;

export const FLANGER_STAGE = {
    centerSec: 0.004,
    depthSec: 0.002,
    maxDelaySec: 0.02,
    feedback: 0.4,
} as const;

export const WAH_STAGE = {
    /** Heel position. The envelope adds up to sweepHz above this. */
    baseHz: 320,
    sweepHz: 2000,
    q: 6,
    /** Gain into the rectifier so a normal guitar peak opens the filter. */
    sense: 8,
    minResponseHz: 3,
    maxResponseHz: 16,
} as const;

export const REVERB_STAGE = {
    /** Synthetic impulse response: decaying white noise, no licensed IR. */
    durationSec: 1.6,
    /** Exponent shaping the decay tail (higher = faster fade-out). */
    decayPower: 2.5,
} as const;

/**
 * Neutral (bypass) waveshaper curve: y = x. Used when `drive` is 0 so the
 * shaper stays in the graph but changes nothing.
 */
export function createNeutralDriveCurve(sampleCount = DRIVE_STAGE.curveSampleCount): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i += 1) {
        const x = (i / (sampleCount - 1)) * 2 - 1;
        curve[i] = x;
    }
    return curve;
}

/**
 * Soft-clip curve `y = tanh(k·x) / tanh(k)`; steeper (louder, more compressed)
 * as amount grows. Amount 0 yields the neutral curve.
 */
export function createDriveCurve(amount: number, sampleCount = DRIVE_STAGE.curveSampleCount): Float32Array<ArrayBuffer> {
    if (!(amount > 0)) {
        return createNeutralDriveCurve(sampleCount);
    }
    const k = Math.min(Math.max(amount, 0), 1) * DRIVE_STAGE.maxSteepness;
    const denominator = Math.tanh(k);
    const curve = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i += 1) {
        const x = (i / (sampleCount - 1)) * 2 - 1;
        curve[i] = Math.tanh(k * x) / denominator;
    }
    return curve;
}

export function createInputGainNode(ctx: BaseAudioContext, params: ChainParams): GainNode {
    const node = ctx.createGain();
    node.gain.value = params.inputGain;
    return node;
}

export function createDriveWaveshaper(ctx: BaseAudioContext, amount: number): WaveShaperNode {
    const node = ctx.createWaveShaper();
    node.curve = createDriveCurve(amount);
    node.oversample = '2x';
    return node;
}

/**
 * Curve for a studio drive character. `soft` is `createDriveCurve`, so the
 * historical clip stays bit-identical. Amount 0 is the identity curve for
 * every character.
 */
export function createDriveCharacterCurve(
    character: (typeof DRIVE_CHARACTERS)[number],
    amount: number,
    sampleCount = DRIVE_STAGE.curveSampleCount,
): Float32Array<ArrayBuffer> {
    if (!(amount > 0) || character === 'soft') return createDriveCurve(amount, sampleCount);
    const drive = Math.min(Math.max(amount, 0), 1);
    const curve = new Float32Array(sampleCount);
    const at = (index: number) => (index / (sampleCount - 1)) * 2 - 1;
    if (character === 'screamer') {
        const k = drive * 18;
        const positive = Math.tanh(k);
        const negative = Math.tanh(k * 1.7);
        for (let i = 0; i < sampleCount; i += 1) {
            const x = at(i);
            curve[i] = x >= 0 ? Math.tanh(k * x) / positive : Math.tanh(k * 1.7 * x) / negative;
        }
        return curve;
    }
    if (character === 'transparent') {
        const shaped = createDriveCurve(drive * 0.28, sampleCount);
        const wet = 0.35 * drive;
        for (let i = 0; i < sampleCount; i += 1) {
            const x = at(i);
            curve[i] = x * (1 - wet) + shaped[i] * wet;
        }
        return curve;
    }
    if (character === 'hard') {
        const gain = 1 + drive * 12;
        for (let i = 0; i < sampleCount; i += 1) {
            const x = at(i) * gain;
            curve[i] = Math.max(-1, Math.min(1, x));
        }
        return curve;
    }
    const gain = 1 + drive * 36;
    const norm = Math.tanh(2.2);
    for (let i = 0; i < sampleCount; i += 1) {
        const clipped = Math.max(-1, Math.min(1, at(i) * gain));
        curve[i] = Math.tanh(clipped * 2.2) / norm;
    }
    return curve;
}

/**
 * Drive pedal. `soft` and amount 0 are a single waveshaper, matching the
 * historical block. The other characters add a small filter pair around it.
 */
export function createDriveCharacterStage(
    ctx: BaseAudioContext,
    amount: number,
    character: (typeof DRIVE_CHARACTERS)[number],
): { input: ChainAudioNode; output: ChainAudioNode; nodes: ChainAudioNode[] } {
    const shaper = ctx.createWaveShaper();
    shaper.curve = createDriveCharacterCurve(character, amount);
    shaper.oversample = '2x';
    if (!(amount > 0) || character === 'soft' || character === 'transparent') {
        return { input: shaper, output: shaper, nodes: [shaper] };
    }
    const pre = ctx.createBiquadFilter();
    const post = ctx.createBiquadFilter();
    if (character === 'screamer') {
        pre.type = 'peaking';
        pre.frequency.value = 720;
        pre.Q.value = 0.8;
        pre.gain.value = 7 * Math.min(Math.max(amount, 0), 1);
        post.type = 'lowpass';
        post.frequency.value = 5200;
        post.Q.value = 0.7;
    } else if (character === 'hard') {
        pre.type = 'highpass';
        pre.frequency.value = 180;
        pre.Q.value = 0.7;
        post.type = 'lowpass';
        post.frequency.value = 4500;
        post.Q.value = 0.7;
    } else {
        pre.type = 'highpass';
        pre.frequency.value = 90;
        pre.Q.value = 0.7;
        post.type = 'lowpass';
        post.frequency.value = 1400;
        post.Q.value = 0.7;
    }
    pre.connect(shaper);
    shaper.connect(post);
    return { input: pre, output: post, nodes: [pre, shaper, post] };
}

export function createEqNodes(ctx: BaseAudioContext, params: ChainParams): EqStages {
    const bass = ctx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = EQ_STAGE.bassFrequencyHz;
    bass.gain.value = params.bass;

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = EQ_STAGE.midFrequencyHz;
    mid.Q.value = EQ_STAGE.midQ;
    mid.gain.value = params.mid;

    const treble = ctx.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = EQ_STAGE.trebleFrequencyHz;
    treble.gain.value = params.treble;

    return { bass, mid, treble };
}

export function createCompressorNode(ctx: BaseAudioContext, amount: number): DynamicsCompressorNode {
    const clamped = Math.min(Math.max(amount, 0), 1);
    const node = ctx.createDynamicsCompressor();
    node.threshold.value = COMPRESSOR_STAGE.maxThresholdDb * clamped;
    node.ratio.value = 1 + (COMPRESSOR_STAGE.maxRatio - 1) * clamped;
    node.knee.value = COMPRESSOR_STAGE.maxKneeDb * clamped;
    node.attack.value = COMPRESSOR_STAGE.attackSec;
    node.release.value = COMPRESSOR_STAGE.releaseSec;
    return node;
}

/**
 * Parallel delay block: dry signal passes through untouched, a copy runs
 * through the delay line (with feedback) and a `mix` wet gain. Both sum at
 * `output`, so blocks compose serially (delay → reverb → …).
 */
export function createDelayNodes(
    ctx: BaseAudioContext,
    mix: number,
    timeSec: number = DELAY_STAGE.delayTimeSec,
    feedbackAmount: number = DELAY_STAGE.feedback,
): DelayStages {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = Math.min(Math.max(mix, 0), 1);

    const delay = ctx.createDelay(1);
    delay.delayTime.value = Math.min(Math.max(timeSec, 0), 1);
    const feedback = ctx.createGain();
    feedback.gain.value = Math.min(Math.max(feedbackAmount, 0), 0.9);

    input.connect(dry);
    dry.connect(output); // dry path
    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay); // feedback loop
    delay.connect(wet);
    wet.connect(output); // wet path

    return { delay, feedback, wet, dry, input, output };
}

/**
 * Synthetic reverb impulse response: stereo buffer of white noise with an
 * exponential-style decay. Generated at runtime — no sampled/licensed IR.
 */
export function createSyntheticImpulseResponse(ctx: BaseAudioContext, durationSec: number = REVERB_STAGE.durationSec): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * durationSec));
    const buffer = ctx.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i += 1) {
            const t = i / length;
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, REVERB_STAGE.decayPower);
        }
    }
    return buffer;
}

/**
 * Parallel reverb block (same structure as the delay block): dry passthrough
 * plus a convolver send with a `mix` wet gain, summed at `output`.
 */
export function createReverbNodes(ctx: BaseAudioContext, mix: number, impulse?: AudioBuffer): ReverbStages {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = Math.min(Math.max(mix, 0), 1);

    const convolver = ctx.createConvolver();
    convolver.buffer = impulse ?? createSyntheticImpulseResponse(ctx);

    input.connect(dry);
    dry.connect(output); // dry path
    input.connect(convolver);
    convolver.connect(wet);
    wet.connect(output); // wet path

    return { convolver, wet, dry, input, output };
}

/** LFO (sine) scaled to `amount`, already started; feeds an AudioParam. */
function createLfo(ctx: BaseAudioContext, rateHz: number, amount: number): { osc: OscillatorNode; depth: GainNode } {
    const osc = ctx.createOscillator();
    osc.frequency.value = rateHz;
    const depth = ctx.createGain();
    depth.gain.value = amount;
    osc.connect(depth);
    osc.start();
    return { osc, depth };
}

interface ModulationStage {
    input: AudioNode;
    output: AudioNode;
    nodes: AudioNode[];
    oscillators: OscillatorNode[];
}

/** Chorus: dry passthrough plus a slowly modulated ~12 ms delay copy at `mix`. */
export function createChorusNodes(ctx: BaseAudioContext, mix: number): ModulationStage {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = Math.min(Math.max(mix, 0), 1);
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = CHORUS_STAGE.baseDelaySec;
    const lfo = createLfo(ctx, CHORUS_STAGE.rateHz, CHORUS_STAGE.depthSec);
    lfo.depth.connect(delay.delayTime);
    input.connect(output); // dry path
    input.connect(delay);
    delay.connect(wet);
    wet.connect(output); // wet path
    return { input, output, nodes: [input, output, wet, delay, lfo.depth, lfo.osc], oscillators: [lfo.osc] };
}

/**
 * Phaser: dry signal plus four swept allpass stages. Depth sets the wet
 * level, the sweep width and the feedback. Rate is the LFO in hertz.
 */
export function createPhaserNodes(ctx: BaseAudioContext, depth: number, rateHz: number): ModulationStage {
    const amount = Math.min(Math.max(depth, 0), 1);
    const rate = Math.min(Math.max(rateHz, 0.05), 8);
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = amount;
    const feedback = ctx.createGain();
    feedback.gain.value = PHASER_STAGE.feedback * amount;
    const filters: BiquadFilterNode[] = [];
    for (let i = 0; i < PHASER_STAGE.stages; i += 1) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'allpass';
        filter.frequency.value = PHASER_STAGE.centerHz;
        filter.Q.value = 0.85;
        filters.push(filter);
    }
    const lfo = createLfo(ctx, rate, PHASER_STAGE.sweepHz * amount);
    for (const filter of filters) lfo.depth.connect(filter.frequency);
    input.connect(dry);
    dry.connect(output);
    input.connect(filters[0]);
    for (let i = 0; i < filters.length - 1; i += 1) filters[i].connect(filters[i + 1]);
    const last = filters[filters.length - 1];
    last.connect(wet);
    wet.connect(output);
    last.connect(feedback);
    feedback.connect(filters[0]);
    return {
        input,
        output,
        nodes: [input, output, dry, wet, feedback, lfo.depth, lfo.osc, ...filters],
        oscillators: [lfo.osc],
    };
}

/** Flanger: dry signal plus a short modulated delay with a little feedback. */
export function createFlangerNodes(ctx: BaseAudioContext, depth: number, rateHz: number): ModulationStage {
    const amount = Math.min(Math.max(depth, 0), 1);
    const rate = Math.min(Math.max(rateHz, 0.05), 8);
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = amount;
    const delay = ctx.createDelay(FLANGER_STAGE.maxDelaySec);
    delay.delayTime.value = FLANGER_STAGE.centerSec;
    const feedback = ctx.createGain();
    feedback.gain.value = FLANGER_STAGE.feedback * amount;
    const lfo = createLfo(ctx, rate, FLANGER_STAGE.depthSec * amount);
    lfo.depth.connect(delay.delayTime);
    input.connect(dry);
    dry.connect(output);
    input.connect(delay);
    delay.connect(wet);
    wet.connect(output);
    delay.connect(feedback);
    feedback.connect(delay);
    return {
        input,
        output,
        nodes: [input, output, dry, wet, delay, feedback, lfo.depth, lfo.osc],
        oscillators: [lfo.osc],
    };
}

function createEnvelopeCurve(sampleCount = 256): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i += 1) {
        const x = (i / (sampleCount - 1)) * 2 - 1;
        curve[i] = Math.min(1, Math.abs(x));
    }
    return curve;
}

/**
 * Wah: a resonant bandpass whose frequency follows the note. Depth crossfades
 * toward the filter and widens the sweep. Response is how fast the envelope moves.
 */
export function createWahNodes(ctx: BaseAudioContext, depth: number, response: number): ModulationStage {
    const amount = Math.min(Math.max(depth, 0), 1);
    const responseAmount = Math.min(Math.max(response, 0), 1);
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 1 - amount;
    const wet = ctx.createGain();
    wet.gain.value = amount;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = WAH_STAGE.baseHz;
    filter.Q.value = WAH_STAGE.q;
    const sense = ctx.createGain();
    sense.gain.value = WAH_STAGE.sense;
    const rectifier = ctx.createWaveShaper();
    rectifier.curve = createEnvelopeCurve();
    const followerHz = WAH_STAGE.minResponseHz
        + (WAH_STAGE.maxResponseHz - WAH_STAGE.minResponseHz) * responseAmount;
    const follower = ctx.createBiquadFilter();
    follower.type = 'lowpass';
    follower.frequency.value = followerHz;
    follower.Q.value = 0.7;
    const sweep = ctx.createGain();
    sweep.gain.value = WAH_STAGE.sweepHz * amount;
    input.connect(dry);
    dry.connect(output);
    input.connect(filter);
    filter.connect(wet);
    wet.connect(output);
    input.connect(sense);
    sense.connect(rectifier);
    rectifier.connect(follower);
    follower.connect(sweep);
    sweep.connect(filter.frequency);
    return {
        input,
        output,
        nodes: [input, output, dry, wet, filter, sense, rectifier, follower, sweep],
        oscillators: [],
    };
}

/** Tremolo: gain swings between `1 - depth` and 1 at `rateHz`. */
export function createTremoloNodes(ctx: BaseAudioContext, depth: number, rateHz: number): ModulationStage {
    const clamped = Math.min(Math.max(depth, 0), 1);
    const gain = ctx.createGain();
    gain.gain.value = 1 - clamped / 2;
    const lfo = createLfo(ctx, rateHz, clamped / 2);
    lfo.depth.connect(gain.gain);
    return { input: gain, output: gain, nodes: [gain, lfo.depth, lfo.osc], oscillators: [lfo.osc] };
}

/**
 * The "classic guitar" amp stage, reproducing the historical per-voice
 * body/brightness filter pair from `src/lib/audio.ts` as one engine-wide
 * stage (fixed 4 kHz brightness cutoff instead of the old per-note one).
 */
export function buildClassicAmpStage(ctx: BaseAudioContext): ClassicAmpStage {
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'peaking';
    bodyFilter.frequency.value = CLASSIC_AMP_STAGE.bodyFrequencyHz;
    bodyFilter.Q.value = CLASSIC_AMP_STAGE.bodyQ;
    bodyFilter.gain.value = CLASSIC_AMP_STAGE.bodyGainDb;

    const brightnessFilter = ctx.createBiquadFilter();
    brightnessFilter.type = 'lowpass';
    brightnessFilter.frequency.value = CLASSIC_AMP_STAGE.brightnessCutoffHz;
    brightnessFilter.Q.value = CLASSIC_AMP_STAGE.brightnessQ;

    bodyFilter.connect(brightnessFilter);
    return { bodyFilter, brightnessFilter, input: bodyFilter, output: brightnessFilter };
}

/**
 * Speaker-cabinet stand-in after a bundled NAM amp: those captures are
 * amp-only (`gear_type: "amp"`), and an amp heard without a cabinet sounds
 * fizzy. Rolls off the rumble below 80 Hz, adds speaker body around 200 Hz,
 * tames the 1.5–4 kHz edge (measured 2026-11-17: the JC capture put 81% of a
 * lick's energy there) and cuts the fizz above ~5 kHz.
 *
 * shortcut: a fixed filter curve, not a cabinet IR; convolve a licensed IR
 * once one is bundled.
 */
const CABINET_CURVE: ReadonlyArray<readonly [BiquadFilterType, number, number, number]> = [
    ['highpass', 80, 0.7, 0],
    ['peaking', 200, 1, 3],
    ['highshelf', 1500, 0.7, -6],
    ['lowpass', 4800, 0.9, 0],
    ['lowpass', 6500, 0.7, 0],
];

export function buildCabinetStage(ctx: BaseAudioContext): { input: BiquadFilterNode; output: BiquadFilterNode; nodes: BiquadFilterNode[] } {
    const nodes = CABINET_CURVE.map(([type, frequency, q, gainDb]) => {
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = q;
        filter.gain.value = gainDb;
        return filter;
    });
    nodes.slice(1).forEach((node, index) => nodes[index].connect(node));
    return { input: nodes[0], output: nodes[nodes.length - 1], nodes };
}

interface AssembleChainOptions {
    /**
     * Externally owned amp node (a NAM AudioWorkletNode). When provided it
     * replaces the classic amp stage. The chain never disposes it — the NAM
     * node pool owns its lifecycle.
     */
    ampNode?: ChainAudioNode;
    /** Per-block NAM nodes for a studio chain (`assembly: 'blocks'`). */
    ampNodes?: Record<string, ChainAudioNode>;
    /** Decoded cabinet IR for `preset.cab` (see irs.ts); absent → default cabinet handling. */
    cabBuffer?: AudioBuffer | null;
    /** Decoded cabinet IR per cab block id. */
    cabBuffers?: Record<string, AudioBuffer | null>;
    /** Decoded reverb IR for `preset.reverb`; absent → synthetic room of `reverbDecay`. */
    reverbBuffer?: AudioBuffer | null;
    /** Decoded reverb IR per reverb block id. */
    reverbBuffers?: Record<string, AudioBuffer | null>;
}

/**
 * Assemble the full chain for a preset. Returns `{ input, output, dispose }`.
 *
 * `dispose()` disconnects every node created here. NAM amp nodes are only
 * *targeted*-disconnected (their link into this chain) — they may still be
 * reused by other chains through the node pool.
 */
export function assembleChain(ctx: BaseAudioContext, preset: SoundPreset, options: AssembleChainOptions = {}): AssembledChain {
    if (preset.assembly === 'blocks' && preset.chain && preset.globals) {
        return assembleBlockChain(ctx, preset, options);
    }
    const created: Array<ChainAudioNode> = [];

    const track = <T extends ChainAudioNode>(node: T): T => {
        created.push(node);
        return node;
    };

    const inputGain = track(createInputGainNode(ctx, preset.params));

    // Amp stage: classic filter pair or an externally provided NAM node.
    let ampInput: ChainAudioNode;
    let ampOutput: ChainAudioNode;
    let classicStage: ClassicAmpStage | null = null;
    let ampLink: ChainAudioNode | null = null; // where the shared NAM node feeds this chain
    if (options.ampNode) {
        ampInput = options.ampNode;
        ampOutput = options.ampNode;
    } else {
        classicStage = buildClassicAmpStage(ctx);
        track(classicStage.bodyFilter);
        track(classicStage.brightnessFilter);
        ampInput = classicStage.input;
        ampOutput = classicStage.output;
    }

    // Cabinet: a chosen IR wins; otherwise bundled (amp-only) NAM captures get
    // the filter-curve stand-in. User-imported captures may already contain a
    // cabinet, so they stay as recorded unless the user picks an IR.
    let cabinet: { input: ChainAudioNode; output: ChainAudioNode } | null = null;
    if (options.cabBuffer) {
        const convolver = track(ctx.createConvolver());
        convolver.buffer = options.cabBuffer;
        const trim = track(ctx.createGain());
        trim.gain.value = Math.pow(10, (IMPULSE_RESPONSES[preset.cab ?? '']?.gainDb ?? 0) / 20);
        convolver.connect(trim);
        cabinet = { input: convolver, output: trim };
    } else if (options.ampNode && !preset.amp.startsWith('user-') && preset.cab !== CAB_NONE) {
        const curve = buildCabinetStage(ctx);
        curve.nodes.forEach(track);
        cabinet = curve;
    }
    if (cabinet) {
        ampOutput.connect(cabinet.input);
        if (options.ampNode) ampLink = cabinet.input;
        ampOutput = cabinet.output;
    }

    // Drive waveshaper (classic character control; neutral for NAM presets).
    const drive = track(createDriveWaveshaper(ctx, preset.params.drive));

    const eq = createEqNodes(ctx, preset.params);
    track(eq.bass);
    track(eq.mid);
    track(eq.treble);

    const compressor = track(createCompressorNode(ctx, preset.params.comp));

    // Modulation pedals join the graph only when switched on (no idle LFOs).
    const oscillators: OscillatorNode[] = [];
    const modulation: ModulationStage[] = [];
    if (preset.params.chorusMix > 0) {
        modulation.push(createChorusNodes(ctx, preset.params.chorusMix));
    }
    if (preset.params.tremoloDepth > 0) {
        modulation.push(createTremoloNodes(ctx, preset.params.tremoloDepth, preset.params.tremoloRate));
    }
    for (const stage of modulation) {
        stage.nodes.forEach(track);
        oscillators.push(...stage.oscillators);
    }

    const delay = createDelayNodes(ctx, preset.params.delayMix, preset.params.delayTime, preset.params.delayFeedback);
    track(delay.input);
    track(delay.dry);
    track(delay.delay);
    track(delay.feedback);
    track(delay.wet);
    track(delay.output);
    const reverb = createReverbNodes(
        ctx,
        preset.params.reverbMix,
        options.reverbBuffer ?? createSyntheticImpulseResponse(ctx, preset.params.reverbDecay),
    );
    track(reverb.input);
    track(reverb.dry);
    track(reverb.convolver);
    track(reverb.wet);
    track(reverb.output);

    const output = track(ctx.createGain());
    output.gain.value = preset.params.outputGain;

    // Wire the chain: input → drive → amp → cab → EQ → comp → [mod] → delay → reverb → output.
    const inputNode: ChainAudioNode = inputGain;
    const driveNode: ChainAudioNode = drive;
    const bassNode: ChainAudioNode = eq.bass;
    const midNode: ChainAudioNode = eq.mid;
    const trebleNode: ChainAudioNode = eq.treble;
    const compNode: ChainAudioNode = compressor;
    const delayOutNode: ChainAudioNode = delay.output;
    const reverbInNode: ChainAudioNode = reverb.input;
    const reverbOutNode: ChainAudioNode = reverb.output;
    const outputNode: ChainAudioNode = output;

    inputNode.connect(driveNode);
    driveNode.connect(ampInput);
    ampOutput.connect(bassNode);
    bassNode.connect(midNode);
    midNode.connect(trebleNode);
    trebleNode.connect(compNode);
    let modOut: ChainAudioNode = compNode;
    for (const stage of modulation) {
        modOut.connect(stage.input);
        modOut = stage.output;
    }
    modOut.connect(delay.input);
    delayOutNode.connect(reverbInNode);
    reverbOutNode.connect(outputNode);

    return {
        input: inputNode,
        output: outputNode,
        dispose() {
            for (const osc of oscillators) {
                try {
                    osc.stop();
                } catch {
                    // Never started (stub) / already stopped: ignore.
                }
            }
            for (const node of created) {
                try {
                    disconnectNodes(node);
                } catch {
                    // Stub nodes / already-disconnected nodes: ignore.
                }
            }
            if (options.ampNode) {
                // Detach only this chain's incoming link from the shared amp
                // node (the node itself stays usable via the NAM node pool).
                try {
                    disconnectNodes(options.ampNode, ampLink ?? bassNode);
                } catch {
                    // Targeted disconnect may be unsupported by stubs: ignore.
                }
            }
        },
    };
}

interface BlockStage {
    input: ChainAudioNode;
    output: ChainAudioNode;
}

function blockNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Gate node. A loaded worklet does the envelope; otherwise a unity gain keeps
 * the graph connected (the engine awaits `loadGateWorklet` before assemble).
 */
function createGateNode(ctx: BaseAudioContext, thresholdDb: number): ChainAudioNode {
    if (isGateWorkletReady(ctx) && typeof AudioWorkletNode !== 'undefined') {
        const node = new AudioWorkletNode(ctx as AudioContext, 'fretmemo-noise-gate');
        const threshold = node.parameters.get('threshold');
        if (threshold) threshold.value = thresholdDb;
        return node;
    }
    const gain = ctx.createGain();
    gain.gain.value = 1;
    return gain;
}

function buildEqStage(
    ctx: BaseAudioContext,
    preset: SoundPreset,
    track: <T extends ChainAudioNode>(node: T) => T,
): BlockStage {
    const eq = createEqNodes(ctx, preset.params);
    track(eq.bass);
    track(eq.mid);
    track(eq.treble);
    eq.bass.connect(eq.mid);
    eq.mid.connect(eq.treble);
    return { input: eq.bass, output: eq.treble };
}

function buildBlockStage(
    ctx: BaseAudioContext,
    block: ChainBlock,
    options: AssembleChainOptions,
    track: <T extends ChainAudioNode>(node: T) => T,
    oscillators: OscillatorNode[],
    externalAmps: ChainAudioNode[],
): BlockStage | null {
    if (!block.enabled) return null;
    switch (block.type) {
        case 'drive': {
            const stage = createDriveCharacterStage(
                ctx,
                blockNumber(block.params.amount, 0),
                driveCharacterOf(block.params.character),
            );
            stage.nodes.forEach(track);
            return { input: stage.input, output: stage.output };
        }
        case 'amp': {
            const model = typeof block.params.model === 'string' ? block.params.model : 'classic';
            const nam = model === 'classic' ? undefined : options.ampNodes?.[block.id];
            if (nam) {
                externalAmps.push(nam);
                return { input: nam, output: nam };
            }
            const classic = buildClassicAmpStage(ctx);
            track(classic.bodyFilter);
            track(classic.brightnessFilter);
            return { input: classic.input, output: classic.output };
        }
        case 'cab': {
            const mode = block.params.mode;
            if (mode === 'none') return null;
            if (mode === 'ir') {
                const buffer = options.cabBuffers?.[block.id];
                if (!buffer) return null;
                const irId = typeof block.params.irId === 'string' ? block.params.irId : '';
                const convolver = track(ctx.createConvolver());
                convolver.buffer = buffer;
                const trim = track(ctx.createGain());
                trim.gain.value = Math.pow(10, (IMPULSE_RESPONSES[irId]?.gainDb ?? 0) / 20);
                convolver.connect(trim);
                return { input: convolver, output: trim };
            }
            const curve = buildCabinetStage(ctx);
            curve.nodes.forEach(track);
            return { input: curve.input, output: curve.output };
        }
        case 'comp': {
            const node = track(createCompressorNode(ctx, blockNumber(block.params.amount, 0)));
            return { input: node, output: node };
        }
        case 'eq': {
            const eq = createEqNodes(ctx, {
                bass: blockNumber(block.params.bass, 2),
                mid: blockNumber(block.params.mid, -4),
                treble: blockNumber(block.params.treble, 3),
            } as ChainParams);
            track(eq.bass);
            track(eq.mid);
            track(eq.treble);
            eq.bass.connect(eq.mid);
            eq.mid.connect(eq.treble);
            return { input: eq.bass, output: eq.treble };
        }
        case 'chorus': {
            const chorus = createChorusNodes(ctx, blockNumber(block.params.mix, 0));
            chorus.nodes.forEach(track);
            oscillators.push(...chorus.oscillators);
            return { input: chorus.input, output: chorus.output };
        }
        case 'tremolo': {
            const tremolo = createTremoloNodes(
                ctx,
                blockNumber(block.params.depth, 0),
                blockNumber(block.params.rate, 5),
            );
            tremolo.nodes.forEach(track);
            oscillators.push(...tremolo.oscillators);
            return { input: tremolo.input, output: tremolo.output };
        }
        case 'phaser': {
            const phaser = createPhaserNodes(
                ctx,
                blockNumber(block.params.depth, 0),
                blockNumber(block.params.rate, 0.4),
            );
            phaser.nodes.forEach(track);
            oscillators.push(...phaser.oscillators);
            return { input: phaser.input, output: phaser.output };
        }
        case 'flanger': {
            const flanger = createFlangerNodes(
                ctx,
                blockNumber(block.params.depth, 0),
                blockNumber(block.params.rate, 0.25),
            );
            flanger.nodes.forEach(track);
            oscillators.push(...flanger.oscillators);
            return { input: flanger.input, output: flanger.output };
        }
        case 'wah': {
            const wah = createWahNodes(
                ctx,
                blockNumber(block.params.depth, 0.75),
                blockNumber(block.params.response, 0.55),
            );
            wah.nodes.forEach(track);
            return { input: wah.input, output: wah.output };
        }
        case 'delay': {
            const delay = createDelayNodes(
                ctx,
                blockNumber(block.params.mix, 0),
                blockNumber(block.params.time, DELAY_STAGE.delayTimeSec),
                blockNumber(block.params.feedback, DELAY_STAGE.feedback),
            );
            track(delay.input);
            track(delay.dry);
            track(delay.delay);
            track(delay.feedback);
            track(delay.wet);
            track(delay.output);
            return { input: delay.input, output: delay.output };
        }
        case 'reverb': {
            const irId = typeof block.params.irId === 'string' ? block.params.irId : '';
            const buffer = (irId ? options.reverbBuffers?.[block.id] : null)
                ?? createSyntheticImpulseResponse(ctx, blockNumber(block.params.decay, REVERB_STAGE.durationSec));
            const reverb = createReverbNodes(ctx, blockNumber(block.params.mix, 0), buffer);
            track(reverb.input);
            track(reverb.dry);
            track(reverb.convolver);
            track(reverb.wet);
            track(reverb.output);
            return { input: reverb.input, output: reverb.output };
        }
        default:
            return null;
    }
}

/**
 * Studio graph:
 *   input gain → gate (only when on) → blocks, with bass/mid/treble inserted
 *   at `toneStackIndex` → output gain.
 * A disabled block is omitted (the previous stage connects to the next).
 * An empty chain connects the input straight to the tone stack.
 */
function assembleBlockChain(ctx: BaseAudioContext, preset: SoundPreset, options: AssembleChainOptions): AssembledChain {
    const created: ChainAudioNode[] = [];
    const oscillators: OscillatorNode[] = [];
    const externalAmps: ChainAudioNode[] = [];
    const track = <T extends ChainAudioNode>(node: T): T => {
        created.push(node);
        return node;
    };

    const globals = preset.globals!;
    const blocks = preset.chain ?? [];
    // EQ readers still take ChainParams; mirror the global strip onto them.
    const eqPreset: SoundPreset = {
        ...preset,
        params: {
            ...preset.params,
            bass: globals.bass,
            mid: globals.mid,
            treble: globals.treble,
        },
    };

    const inputGain = track(ctx.createGain());
    inputGain.gain.value = globals.inputGain;
    const stages: BlockStage[] = [{ input: inputGain, output: inputGain }];

    if (globals.gateEnabled) {
        const gate = track(createGateNode(ctx, globals.gateThresholdDb));
        stages.push({ input: gate, output: gate });
    }

    const toneAt = Math.max(0, Math.min(Math.floor(globals.toneStackIndex), blocks.length));
    let eqInserted = false;
    const insertEq = () => {
        if (eqInserted) return;
        stages.push(buildEqStage(ctx, eqPreset, track));
        eqInserted = true;
    };

    for (let i = 0; i < blocks.length; i += 1) {
        if (i === toneAt) insertEq();
        const stage = buildBlockStage(ctx, blocks[i], options, track, oscillators, externalAmps);
        if (stage) stages.push(stage);
    }
    insertEq();

    const output = track(ctx.createGain());
    output.gain.value = globals.outputGain;
    stages.push({ input: output, output });

    // A NAM node is pooled and reused by the next rebuild. Remember only this
    // chain's outgoing edge so dispose does not unplug the live chain too.
    const ampLinks: Array<{ amp: ChainAudioNode; next: ChainAudioNode }> = [];
    for (let i = 0; i < stages.length - 1; i += 1) {
        const from = stages[i].output;
        const to = stages[i + 1].input;
        from.connect(to);
        if (externalAmps.includes(from)) ampLinks.push({ amp: from, next: to });
    }

    return {
        input: inputGain,
        output,
        dispose() {
            for (const osc of oscillators) {
                try {
                    osc.stop();
                } catch {
                    // Never started / already stopped.
                }
            }
            for (const link of ampLinks) {
                try {
                    disconnectNodes(link.amp, link.next);
                } catch {
                    // Targeted disconnect may be unsupported by stubs: ignore.
                }
            }
            for (const node of created) {
                try {
                    disconnectNodes(node);
                } catch {
                    // Already disconnected.
                }
            }
        },
    };
}

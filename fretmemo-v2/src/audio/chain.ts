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
 *   EQ (low shelf → mid peak → high shelf) → compressor →
 *   delay (parallel wet) → reverb (parallel wet) → outputGain
 */

import type { ChainParams, SoundPreset } from './presets';

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
export function createDelayNodes(ctx: BaseAudioContext, mix: number): DelayStages {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = Math.min(Math.max(mix, 0), 1);

    const delay = ctx.createDelay(1);
    delay.delayTime.value = DELAY_STAGE.delayTimeSec;
    const feedback = ctx.createGain();
    feedback.gain.value = DELAY_STAGE.feedback;

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
export function createSyntheticImpulseResponse(ctx: BaseAudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * REVERB_STAGE.durationSec));
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
export function createReverbNodes(ctx: BaseAudioContext, mix: number): ReverbStages {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = Math.min(Math.max(mix, 0), 1);

    const convolver = ctx.createConvolver();
    convolver.buffer = createSyntheticImpulseResponse(ctx);

    input.connect(dry);
    dry.connect(output); // dry path
    input.connect(convolver);
    convolver.connect(wet);
    wet.connect(output); // wet path

    return { convolver, wet, dry, input, output };
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

interface AssembleChainOptions {
    /**
     * Externally owned amp node (a NAM AudioWorkletNode). When provided it
     * replaces the classic amp stage. The chain never disposes it — the NAM
     * node pool owns its lifecycle.
     */
    ampNode?: ChainAudioNode;
}

/**
 * Assemble the full chain for a preset. Returns `{ input, output, dispose }`.
 *
 * `dispose()` disconnects every node created here. NAM amp nodes are only
 * *targeted*-disconnected (their link into this chain) — they may still be
 * reused by other chains through the node pool.
 */
export function assembleChain(ctx: BaseAudioContext, preset: SoundPreset, options: AssembleChainOptions = {}): AssembledChain {
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

    // Drive waveshaper (classic character control; neutral for NAM presets).
    const drive = track(createDriveWaveshaper(ctx, preset.params.drive));

    const eq = createEqNodes(ctx, preset.params);
    track(eq.bass);
    track(eq.mid);
    track(eq.treble);

    const compressor = track(createCompressorNode(ctx, preset.params.comp));
    const delay = createDelayNodes(ctx, preset.params.delayMix);
    track(delay.input);
    track(delay.dry);
    track(delay.delay);
    track(delay.feedback);
    track(delay.wet);
    track(delay.output);
    const reverb = createReverbNodes(ctx, preset.params.reverbMix);
    track(reverb.input);
    track(reverb.dry);
    track(reverb.convolver);
    track(reverb.wet);
    track(reverb.output);

    const output = track(ctx.createGain());
    output.gain.value = preset.params.outputGain;

    // Wire the chain: input → drive → amp → EQ → comp → delay → reverb → output.
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
    compNode.connect(delay.input);
    delayOutNode.connect(reverbInNode);
    reverbOutNode.connect(outputNode);

    return {
        input: inputNode,
        output: outputNode,
        dispose() {
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
                    disconnectNodes(options.ampNode, bassNode);
                } catch {
                    // Targeted disconnect may be unsupported by stubs: ignore.
                }
            }
        },
    };
}

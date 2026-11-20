import { describe, expect, it } from 'vitest';
import {
    CLASSIC_AMP_STAGE,
    COMPRESSOR_STAGE,
    DELAY_STAGE,
    EQ_STAGE,
    assembleChain,
    buildClassicAmpStage,
    createCompressorNode,
    createDelayNodes,
    createDriveCharacterCurve,
    createDriveCurve,
    createEqNodes,
    createInputGainNode,
    createNeutralDriveCurve,
    createReverbNodes,
    createSyntheticImpulseResponse,
    type ChainAudioNode,
} from '../chain';
import { getPresetById, type SoundPreset } from '../presets';
import {
    FakeAudioContext,
    FakeAudioNode,
    FakeConvolverNode,
    FakeDynamicsCompressorNode,
    FakeGainNode,
    FakeOscillatorNode,
} from './fixtures/audioStubs';

function classicPreset(): SoundPreset {
    return getPresetById('classic-acoustic')!;
}

function connectedDestinations(node: FakeAudioNode): unknown[] {
    return node.connections.map((c) => c.destination);
}

describe('drive waveshaper curves', () => {
    it('amount 0 produces the neutral identity curve', () => {
        const curve = createDriveCurve(0);
        const neutral = createNeutralDriveCurve();
        expect(curve).toEqual(neutral);
        expect(curve[0]).toBeCloseTo(-1);
        expect(curve[curve.length - 1]).toBeCloseTo(1);
        // Identity: every sample equals its input x.
        for (let i = 0; i < curve.length; i += 1) {
            const x = (i / (curve.length - 1)) * 2 - 1;
            expect(curve[i]).toBeCloseTo(x, 6);
        }
    });

    it('amount 1 produces a symmetric soft-clip curve with unity peaks', () => {
        const curve = createDriveCurve(1);
        expect(curve[0]).toBeCloseTo(-1);
        expect(curve[curve.length - 1]).toBeCloseTo(1);
        // Crosses zero near the midpoint.
        const mid = curve.length / 2;
        expect(curve[mid - 1]).toBeLessThan(0);
        expect(curve[mid]).toBeGreaterThan(0);
        // Slope at the origin is steeper than the neutral curve → louder.
        // (Normalise by the per-sample x step, dx = 2/(n-1).)
        const dx = 2 / (curve.length - 1);
        const slope = (curve[mid + 1] - curve[mid - 1]) / (2 * dx);
        expect(slope).toBeGreaterThan(1);
        // Symmetry.
        for (let i = 0; i < curve.length; i += 1) {
            expect(curve[i]).toBeCloseTo(-curve[curve.length - 1 - i], 5);
        }
    });

    it('keeps the neutral curve between 0 and 1 for fractional amounts', () => {
        const neutral = createNeutralDriveCurve();
        const soft = createDriveCurve(0.3);
        for (let i = 0; i < soft.length; i += 1) {
            // Gentle clipping: never below the identity on the positive side.
            if (neutral[i] > 0) {
                expect(soft[i]).toBeGreaterThanOrEqual(neutral[i] - 1e-6);
            } else {
                expect(soft[i]).toBeLessThanOrEqual(neutral[i] + 1e-6);
            }
        }
    });

    it('keeps the smooth character identical to the historical drive curve', () => {
        expect(Array.from(createDriveCharacterCurve('soft', 0.4))).toEqual(Array.from(createDriveCurve(0.4)));
        expect(Array.from(createDriveCharacterCurve('screamer', 0))).toEqual(Array.from(createDriveCurve(0)));
    });

    it('makes the screamer clip one polarity harder than the other', () => {
        const curve = createDriveCharacterCurve('screamer', 1);
        let asymmetry = 0;
        for (let i = 0; i < curve.length; i += 1) {
            asymmetry = Math.max(asymmetry, Math.abs(curve[i] + curve[curve.length - 1 - i]));
        }
        expect(asymmetry).toBeGreaterThan(0.05);
        expect(curve[0]).toBeCloseTo(-1, 5);
        expect(curve[curve.length - 1]).toBeCloseTo(1, 5);
    });

    it('holds the hard character on a wide, symmetric rail', () => {
        const hard = createDriveCharacterCurve('hard', 1);
        const atRail = hard.filter((value) => Math.abs(value) === 1).length;
        expect(atRail).toBeGreaterThan(hard.length / 2);
        for (let i = 0; i < hard.length; i += 1) {
            expect(hard[i]).toBeCloseTo(-hard[hard.length - 1 - i], 5);
        }
    });
});

describe('param → node mapping', () => {
    it('input gain mirrors the linear multiplier', () => {
        const ctx = new FakeAudioContext();
        const preset = { ...classicPreset(), params: { ...classicPreset().params, inputGain: 1.5 } };
        const node = createInputGainNode(ctx as unknown as BaseAudioContext, preset.params);
        expect((node as unknown as FakeGainNode).gain.value).toBe(1.5);
    });

    it('amount 0 compressor is neutral (no compression)', () => {
        const ctx = new FakeAudioContext();
        const node = createCompressorNode(ctx as unknown as BaseAudioContext, 0) as unknown as FakeDynamicsCompressorNode;
        expect(node.threshold.value).toBeCloseTo(0, 12);
        expect(node.ratio.value).toBe(1);
    });

    it('amount 1 compressor hits the configured firmest setting', () => {
        const ctx = new FakeAudioContext();
        const node = createCompressorNode(ctx as unknown as BaseAudioContext, 1) as unknown as FakeDynamicsCompressorNode;
        expect(node.threshold.value).toBe(COMPRESSOR_STAGE.maxThresholdDb);
        expect(node.ratio.value).toBe(COMPRESSOR_STAGE.maxRatio);
        expect(node.attack.value).toBe(COMPRESSOR_STAGE.attackSec);
        expect(node.release.value).toBe(COMPRESSOR_STAGE.releaseSec);
    });

    it('EQ bands map dB values onto shelf/peaking filters', () => {
        const ctx = new FakeAudioContext();
        const eq = createEqNodes(ctx as unknown as BaseAudioContext, {
            ...classicPreset().params,
            bass: -6,
            mid: 3,
            treble: 12,
        });
        expect(eq.bass.type).toBe('lowshelf');
        expect(eq.bass.frequency.value).toBe(EQ_STAGE.bassFrequencyHz);
        expect(eq.bass.gain.value).toBe(-6);
        expect(eq.mid.type).toBe('peaking');
        expect(eq.mid.gain.value).toBe(3);
        expect(eq.treble.type).toBe('highshelf');
        expect(eq.treble.gain.value).toBe(12);
    });

    it('delay block wires dry + wet with feedback, wet gain equals mix', () => {
        const ctx = new FakeAudioContext();
        const delay = createDelayNodes(ctx as unknown as BaseAudioContext, 0.4);
        expect(delay.wet.gain.value).toBe(0.4);
        expect(delay.dry.gain.value).toBe(1);
        expect(delay.delay.delayTime.value).toBe(DELAY_STAGE.delayTimeSec);
        expect(delay.feedback.gain.value).toBe(DELAY_STAGE.feedback);
        // input → dry → output (dry path)
        expect(connectedDestinations(delay.input as unknown as FakeAudioNode)).toContain(delay.dry);
        expect(connectedDestinations(delay.dry as unknown as FakeAudioNode)).toContain(delay.output);
        // input → delay → wet → output (wet path)
        expect(connectedDestinations(delay.input as unknown as FakeAudioNode)).toContain(delay.delay);
        expect(connectedDestinations(delay.delay as unknown as FakeAudioNode)).toContain(delay.wet);
        expect(connectedDestinations(delay.wet as unknown as FakeAudioNode)).toContain(delay.output);
        // feedback loop
        expect(connectedDestinations(delay.delay as unknown as FakeAudioNode)).toContain(delay.feedback);
        expect(connectedDestinations(delay.feedback as unknown as FakeAudioNode)).toContain(delay.delay);
    });

    it('reverb block wires dry + wet with a synthetic decaying IR', () => {
        const ctx = new FakeAudioContext();
        const reverb = createReverbNodes(ctx as unknown as BaseAudioContext, 0.25);
        expect(reverb.wet.gain.value).toBe(0.25);
        expect(reverb.dry.gain.value).toBe(1);

        const buffer = (reverb.convolver as unknown as FakeConvolverNode).buffer!;
        expect(buffer.numberOfChannels).toBe(2);
        expect(buffer.sampleRate).toBe(ctx.sampleRate);
        const data = buffer.getChannelData(0);
        // Starts audible, decays towards silence, no licensed content: noise.
        expect(Math.abs(data[0])).toBeGreaterThan(0);
        const tail = Math.abs(data[data.length - 1]);
        const head = Math.abs(data[0]);
        expect(tail).toBeLessThan(head * 0.01);
    });

    it('synthetic IR duration matches the reverb stage constant', () => {
        const ctx = new FakeAudioContext();
        const buffer = createSyntheticImpulseResponse(ctx as unknown as BaseAudioContext);
        expect(buffer.length).toBe(Math.floor(ctx.sampleRate * 1.6));
    });
});

describe('classic amp stage', () => {
    it('reproduces the body/brightness filter pair', () => {
        const ctx = new FakeAudioContext();
        const stage = buildClassicAmpStage(ctx as unknown as BaseAudioContext);
        expect(stage.bodyFilter.type).toBe('peaking');
        expect(stage.bodyFilter.frequency.value).toBe(CLASSIC_AMP_STAGE.bodyFrequencyHz);
        expect(stage.bodyFilter.Q.value).toBe(CLASSIC_AMP_STAGE.bodyQ);
        expect(stage.bodyFilter.gain.value).toBe(CLASSIC_AMP_STAGE.bodyGainDb);
        expect(stage.brightnessFilter.type).toBe('lowpass');
        expect(stage.brightnessFilter.frequency.value).toBe(CLASSIC_AMP_STAGE.brightnessCutoffHz);
        expect(connectedDestinations(stage.bodyFilter as unknown as FakeAudioNode)).toContain(stage.brightnessFilter);
    });
});

describe('assembleChain', () => {
    it('wires the documented stage order for a classic preset', () => {
        const ctx = new FakeAudioContext();
        const chain = assembleChain(ctx as unknown as BaseAudioContext, classicPreset());
        const log = ctx.connectLog as Array<[FakeAudioNode, unknown]>;

        const sourceOf = (pred: (node: FakeAudioNode) => boolean, dest: unknown): boolean =>
            log.some(([src, d]) => pred(src) && d === dest);

        // Walk: input → drive → bodyFilter → brightnessFilter → bass → mid
        //       → treble → comp → delay → reverb → output
        const nodes = ctx.createdNodes as FakeAudioNode[];

        const body = nodes.find((n) => (n as { type?: string }).type === 'peaking')!;
        const brightness = nodes.find((n) => (n as { type?: string }).type === 'lowpass')!;
        const bass = nodes.filter((n) => (n as { type?: string }).type === 'lowshelf')[0];
        const mid = nodes.filter((n) => (n as { type?: string }).type === 'peaking' && n !== body)[0];
        const treble = nodes.filter((n) => (n as { type?: string }).type === 'highshelf')[0];
        const comp = nodes.find((n) => n instanceof FakeDynamicsCompressorNode)!;
        const convolver = nodes.find((n) => n instanceof FakeConvolverNode)!;

        // input → drive (waveshaper)
        const shaper = nodes.find((n) => 'curve' in n)!;
        expect(sourceOf((n) => n === chain.input, shaper)).toBe(true);
        // drive → body
        expect(log.some(([src, dest]) => src === shaper && dest === body)).toBe(true);
        // body → brightness → bass
        expect(connectedDestinations(body)).toContain(brightness);
        expect(connectedDestinations(brightness)).toContain(bass);
        // EQ chain
        expect(connectedDestinations(bass)).toContain(mid);
        expect(connectedDestinations(mid)).toContain(treble);
        // treble → comp → (delay path) and reverb convolver in the wet path
        expect(connectedDestinations(treble)).toContain(comp);
        expect(convolver).toBeDefined();

        chain.dispose();
    });

    it('uses the provided amp node instead of the classic stage for NAM presets', () => {
        const ctx = new FakeAudioContext();
        const namPreset = getPresetById('nam-clean-jc')!;
        const ampNode = new FakeAudioNode();
        const chain = assembleChain(ctx as unknown as BaseAudioContext, namPreset, {
            ampNode: ampNode as unknown as ChainAudioNode,
        });
        const nodes = ctx.createdNodes as FakeAudioNode[];
        const types = nodes.map((n) => (n as { type?: string }).type);
        // Peaking filters: the EQ mid band and the cabinet body — no classic amp pair.
        expect(types.filter((t) => t === 'peaking')).toHaveLength(2);
        // The amp node feeds the cabinet stand-in, whose last filter feeds the EQ bass band.
        const bass = nodes.filter((n) => (n as { type?: string }).type === 'lowshelf')[0];
        const highpass = nodes.find((n) => (n as { type?: string }).type === 'highpass');
        const lowpasses = nodes.filter((n) => (n as { type?: string }).type === 'lowpass');
        expect(connectedDestinations(ampNode)).toContain(highpass);
        expect(lowpasses).toHaveLength(2);
        expect(connectedDestinations(lowpasses[1])).toContain(bass);
        chain.dispose();
    });

    it('applies the outputGain param to the chain output', () => {
        const ctx = new FakeAudioContext();
        const preset: SoundPreset = {
            ...classicPreset(),
            params: { ...classicPreset().params, outputGain: 1.75 },
        };
        const chain = assembleChain(ctx as unknown as BaseAudioContext, preset);
        expect((chain.output as FakeGainNode).gain.value).toBe(1.75);
        chain.dispose();
    });

    it('dispose disconnects every created node', () => {
        const ctx = new FakeAudioContext();
        const chain = assembleChain(ctx as unknown as BaseAudioContext, classicPreset());
        chain.dispose();
        // Buffers (the synthetic IR) are not nodes: only nodes must be
        // disconnected.
        const nodes = (ctx.createdNodes as FakeAudioNode[]).filter((n) => Array.isArray(n.disconnectCalls));
        const notDisconnected = nodes.filter((n) => n.disconnectCalls.length === 0);
        expect(notDisconnected).toEqual([]);
    });
});

describe('effect pedals and cabinet IRs', () => {
    const oscillatorsOf = (ctx: FakeAudioContext) =>
        (ctx.createdNodes as FakeAudioNode[]).filter((n) => n instanceof FakeOscillatorNode) as FakeOscillatorNode[];

    it('neutral presets build no modulation LFOs', () => {
        const ctx = new FakeAudioContext();
        assembleChain(ctx as unknown as BaseAudioContext, classicPreset()).dispose();
        expect(oscillatorsOf(ctx)).toHaveLength(0);
    });

    it('chorus + tremolo insert started LFOs that dispose stops', () => {
        const ctx = new FakeAudioContext();
        const preset: SoundPreset = {
            ...classicPreset(),
            params: { ...classicPreset().params, chorusMix: 0.5, tremoloDepth: 0.6, tremoloRate: 7 },
        };
        const chain = assembleChain(ctx as unknown as BaseAudioContext, preset);
        const oscillators = oscillatorsOf(ctx);
        expect(oscillators).toHaveLength(2);
        expect(oscillators.map((o) => o.frequency.value)).toContain(7);
        oscillators.forEach((o) => expect(o.start).toHaveBeenCalled());
        chain.dispose();
        oscillators.forEach((o) => expect(o.stop).toHaveBeenCalled());
    });

    it('delay time and feedback follow the params', () => {
        const ctx = new FakeAudioContext();
        const delay = createDelayNodes(ctx as unknown as BaseAudioContext, 0.4, 0.5, 0.6);
        expect((delay.delay as unknown as { delayTime: { value: number } }).delayTime.value).toBe(0.5);
        expect(delay.feedback.gain.value).toBe(0.6);
    });

    it('a cabinet IR replaces the filter-curve stand-in after a NAM amp', () => {
        const ctx = new FakeAudioContext();
        const ampNode = new FakeAudioNode();
        const cabBuffer = {} as AudioBuffer;
        assembleChain(ctx as unknown as BaseAudioContext, { ...getPresetById('nam-clean-jc')!, cab: 'cab-mesa-412' }, {
            ampNode: ampNode as unknown as ChainAudioNode,
            cabBuffer,
        });
        const nodes = ctx.createdNodes as FakeAudioNode[];
        const cab = nodes.find((n) => n instanceof FakeConvolverNode && n.buffer === cabBuffer);
        expect(connectedDestinations(ampNode)).toContain(cab);
        expect(nodes.some((n) => (n as { type?: string }).type === 'highpass')).toBe(false);
    });

    it("cab 'none' leaves a bundled NAM amp without any speaker stage", () => {
        const ctx = new FakeAudioContext();
        const ampNode = new FakeAudioNode();
        assembleChain(ctx as unknown as BaseAudioContext, { ...getPresetById('nam-clean-jc')!, cab: 'none' }, {
            ampNode: ampNode as unknown as ChainAudioNode,
        });
        const bass = (ctx.createdNodes as FakeAudioNode[]).find((n) => (n as { type?: string }).type === 'lowshelf');
        expect(connectedDestinations(ampNode)).toEqual([bass]);
    });
});

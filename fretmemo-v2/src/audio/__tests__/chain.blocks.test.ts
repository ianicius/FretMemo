import { describe, expect, it } from 'vitest';
import { assembleChain } from '../chain';
import { applyNoiseGate, rms } from '../gate';
import {
    createChainBlock,
    deriveLegacyStudio,
    emptyStudio,
    getPresetById,
    neutralChainParams,
    sampleSetForPreset,
    type ChainBlock,
    type ChainGlobals,
    type SoundPreset,
} from '../presets';
import { FakeAudioContext, FakeBiquadFilterNode, FakeDelayNode, FakeGainNode, FakeOscillatorNode, FakeWaveShaperNode } from './fixtures/audioStubs';

function studio(blocks: ChainBlock[], globals: ChainGlobals): SoundPreset {
    return {
        id: 'studio-test',
        kind: 'custom',
        amp: 'classic',
        params: neutralChainParams(),
        nameKey: 'studio',
        builtIn: false,
        assembly: 'blocks',
        chain: blocks,
        globals,
    };
}

describe('assembleChain block order', () => {
    it('connects an empty chain from the input straight into the tone stack', () => {
        const ctx = new FakeAudioContext();
        const blank = emptyStudio();
        const chain = assembleChain(ctx as unknown as BaseAudioContext, studio(blank.blocks, blank.globals));
        const input = chain.input as unknown as { connections: Array<{ destination: FakeBiquadFilterNode }> };
        const next = input.connections[0].destination;
        expect(next).toBeInstanceOf(FakeBiquadFilterNode);
        expect(next.frequency.value).toBe(200);
    });

    it('builds blocks in list order and gives duplicates their own nodes', () => {
        const ctx = new FakeAudioContext();
        const globals = { ...emptyStudio().globals, toneStackIndex: 2 };
        const chain = [
            { ...createChainBlock('delay', 'd1'), params: { mix: 0.2, time: 0.2, feedback: 0.2 } },
            { ...createChainBlock('delay', 'd2'), params: { mix: 0.4, time: 0.4, feedback: 0.3 } },
        ];
        assembleChain(ctx as unknown as BaseAudioContext, studio(chain, globals));
        const delays = ctx.createdNodes.filter((node) => node instanceof FakeDelayNode) as FakeDelayNode[];
        expect(delays).toHaveLength(2);
        expect(delays[0]).not.toBe(delays[1]);
        expect(delays[0].delayTime.value).toBeCloseTo(0.2);
        expect(delays[1].delayTime.value).toBeCloseTo(0.4);
    });

    it('omits a disabled block and keeps the others', () => {
        const ctx = new FakeAudioContext();
        const globals = { ...emptyStudio().globals, toneStackIndex: 3 };
        const blocks = [
            createChainBlock('delay', 'keep'),
            { ...createChainBlock('chorus', 'skip'), enabled: false },
            createChainBlock('delay', 'also'),
        ];
        assembleChain(ctx as unknown as BaseAudioContext, studio(blocks, globals));
        const delays = ctx.createdNodes.filter((node) => node instanceof FakeDelayNode);
        const lfos = ctx.createdNodes.filter((node) => node instanceof FakeOscillatorNode);
        expect(delays).toHaveLength(2);
        expect(lfos).toHaveLength(0);
    });

    it('places chorus before delay when the list says so, and the reverse when it does not', () => {
        const orderOf = (blocks: ChainBlock[]) => {
            const ctx = new FakeAudioContext();
            const globals = { ...emptyStudio().globals, toneStackIndex: blocks.length };
            assembleChain(ctx as unknown as BaseAudioContext, studio(blocks, globals));
            const nodes = ctx.createdNodes as Array<{ constructor: { name: string }; delayTime?: { value: number } }>;
            const delayBlock = nodes.findIndex(
                (node) => node.constructor.name === 'FakeDelayNode' && Math.abs((node.delayTime?.value ?? 0) - 0.28) < 0.001,
            );
            const lfo = nodes.findIndex((node) => node.constructor.name === 'FakeOscillatorNode');
            return { delayBlock, lfo };
        };
        const chorusThenDelay = orderOf([createChainBlock('chorus', 'c'), createChainBlock('delay', 'd')]);
        const delayThenChorus = orderOf([createChainBlock('delay', 'd'), createChainBlock('chorus', 'c')]);
        expect(chorusThenDelay.lfo).toBeGreaterThanOrEqual(0);
        expect(chorusThenDelay.lfo).toBeLessThan(chorusThenDelay.delayBlock);
        expect(delayThenChorus.delayBlock).toBeLessThan(delayThenChorus.lfo);
    });

    it('builds a phaser from four allpass stages and a flanger from a short delay', () => {
        const ctx = new FakeAudioContext();
        const globals = { ...emptyStudio().globals, toneStackIndex: 2 };
        assembleChain(ctx as unknown as BaseAudioContext, studio([
            createChainBlock('phaser', 'p'),
            createChainBlock('flanger', 'f'),
        ], globals));
        const allpass = ctx.createdNodes.filter(
            (node) => node instanceof FakeBiquadFilterNode && node.type === 'allpass',
        );
        expect(allpass).toHaveLength(4);
        const shortDelay = ctx.createdNodes.filter(
            (node) => node instanceof FakeDelayNode && node.delayTime.value < 0.02,
        );
        expect(shortDelay).toHaveLength(1);
        expect(ctx.createdNodes.filter((node) => node instanceof FakeOscillatorNode)).toHaveLength(2);
    });

    it('builds a wah from a resonant bandpass and an envelope follower', () => {
        const ctx = new FakeAudioContext();
        const globals = { ...emptyStudio().globals, toneStackIndex: 1 };
        assembleChain(ctx as unknown as BaseAudioContext, studio([
            createChainBlock('wah', 'w'),
        ], globals));
        const bandpass = ctx.createdNodes.filter(
            (node) => node instanceof FakeBiquadFilterNode && node.type === 'bandpass',
        );
        expect(bandpass).toHaveLength(1);
        expect(bandpass[0]).toMatchObject({ Q: { value: 6 }, frequency: { value: 320 } });
        expect(ctx.createdNodes.filter((node) => node instanceof FakeWaveShaperNode)).toHaveLength(1);
        expect(ctx.createdNodes.filter((node) => node instanceof FakeOscillatorNode)).toHaveLength(0);
    });

    it('adds a movable eq beside the global tone stack', () => {
        const ctx = new FakeAudioContext();
        const globals = { ...emptyStudio().globals, toneStackIndex: 1 };
        assembleChain(ctx as unknown as BaseAudioContext, studio([
            createChainBlock('eq', 'e'),
        ], globals));
        const lowshelf = ctx.createdNodes.filter(
            (node) => node instanceof FakeBiquadFilterNode && node.type === 'lowshelf',
        );
        expect(lowshelf).toHaveLength(2);
        const gains = lowshelf.map((node) => (node as FakeBiquadFilterNode).gain.value).sort((a, b) => a - b);
        expect(gains).toEqual([0, 2]);
    });

    it('keeps a single tone stack on an untouched built-in', () => {
        const ctx = new FakeAudioContext();
        assembleChain(ctx as unknown as BaseAudioContext, getPresetById('classic-acoustic')!);
        const lowshelf = ctx.createdNodes.filter(
            (node) => node instanceof FakeBiquadFilterNode && node.type === 'lowshelf',
        );
        expect(lowshelf).toHaveLength(1);
    });

    it('does not add a wah bandpass to an untouched built-in', () => {
        const ctx = new FakeAudioContext();
        assembleChain(ctx as unknown as BaseAudioContext, getPresetById('classic-acoustic')!);
        const bandpass = ctx.createdNodes.filter(
            (node) => node instanceof FakeBiquadFilterNode && node.type === 'bandpass',
        );
        expect(bandpass).toHaveLength(0);
    });

    it('does not add phaser stages to an untouched built-in', () => {
        const ctx = new FakeAudioContext();
        assembleChain(ctx as unknown as BaseAudioContext, getPresetById('classic-acoustic')!);
        const allpass = ctx.createdNodes.filter(
            (node) => node instanceof FakeBiquadFilterNode && node.type === 'allpass',
        );
        expect(allpass).toHaveLength(0);
    });

    it('leaves a shared amp node connected to the newer chain when the older one is disposed', () => {
        const ctx = new FakeAudioContext();
        const amp = new FakeGainNode();
        const globals = { ...emptyStudio().globals, toneStackIndex: 1 };
        const block = { ...createChainBlock('amp', 'a1'), params: { model: 'nam-lead-jcm' } };
        const preset = studio([block], globals);
        const options = { ampNodes: { a1: amp as unknown as AudioNode } };
        const first = assembleChain(ctx as unknown as BaseAudioContext, preset, options);
        const second = assembleChain(ctx as unknown as BaseAudioContext, preset, options);
        expect(amp.connections.filter((link) => link.destination instanceof FakeBiquadFilterNode)).toHaveLength(2);
        first.dispose();
        const remaining = amp.connections.filter((link) => link.destination instanceof FakeBiquadFilterNode);
        expect(remaining).toHaveLength(1);
        expect(second.output).toBeTruthy();
    });

    it('inserts the tone stack at toneStackIndex', () => {
        const ctx = new FakeAudioContext();
        const globals = { ...emptyStudio().globals, toneStackIndex: 0 };
        assembleChain(ctx as unknown as BaseAudioContext, studio([createChainBlock('delay', 'd')], globals));
        const names = ctx.createdNodes.map((node) => (node as object).constructor.name);
        expect(names.indexOf('FakeBiquadFilterNode')).toBeLessThan(names.indexOf('FakeDelayNode'));
    });
});

describe('legacy presets derived for the studio', () => {
    it('keeps the tone stack between the amp and the time effects', () => {
        const preset = getPresetById('nam-crunch-ac10')!;
        const model = deriveLegacyStudio(preset);
        expect(model.blocks.map((block) => block.type)).toEqual(['amp', 'cab', 'delay', 'reverb']);
        expect(model.globals.toneStackIndex).toBe(2);
        expect(model.globals.inputGain).toBe(preset.params.inputGain);
        expect(sampleSetForPreset(preset)).toBe('electric');
        expect(sampleSetForPreset(getPresetById('classic-acoustic'))).toBe('nylon');
    });

    it('uses the electric set when a studio amp block is not classic', () => {
        const globals = emptyStudio().globals;
        const nam = studio([{ ...createChainBlock('amp', 'a'), params: { model: 'nam-lead-jcm' } }], globals);
        const dry = studio([], globals);
        expect(sampleSetForPreset(nam)).toBe('electric');
        expect(sampleSetForPreset(dry)).toBe('nylon');
    });
});

describe('noise gate envelope', () => {
    it('attenuates a signal under the threshold and passes a loud tone', () => {
        const rate = 48000;
        const noise = new Float32Array(rate);
        for (let i = 0; i < noise.length; i += 1) noise[i] = (i % 2 === 0 ? 1 : -1) * 0.001;
        const gatedNoise = applyNoiseGate(noise, rate, -40);
        const noiseRms = rms(noise.subarray(rate / 2));
        const gatedRms = rms(gatedNoise.subarray(rate / 2));
        expect(20 * Math.log10(noiseRms / Math.max(gatedRms, 1e-12))).toBeGreaterThan(30);

        const tone = new Float32Array(rate);
        for (let i = 0; i < tone.length; i += 1) tone[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / rate);
        const gatedTone = applyNoiseGate(tone, rate, -40);
        const toneRms = rms(tone.subarray(rate / 2));
        const gatedToneRms = rms(gatedTone.subarray(rate / 2));
        const deltaDb = Math.abs(20 * Math.log10(gatedToneRms / toneRms));
        expect(deltaDb).toBeLessThan(1);
    });
});

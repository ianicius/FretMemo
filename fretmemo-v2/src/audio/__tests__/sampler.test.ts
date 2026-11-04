import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    FakeAudioBuffer,
    FakeAudioBufferSourceNode,
    FakeAudioContext,
    stubAudioContextGlobal,
} from './fixtures/audioStubs';
import {
    SAMPLE_HIGH_MIDI,
    SAMPLE_LOW_MIDI,
    SAMPLED_MIDIS,
    computeSampleRate,
    isSamplerReady,
    loadSampler,
    pickSampleMidi,
    playSampleVoice,
    resetSampler,
} from '../sampler';

describe('sampler mapping helpers', () => {
    it('snaps a requested note to the nearest sampled natural note', () => {
        // Sampled naturals around C4: C4=60, D4=62 (no C#4/D#4). Accidentals
        // snap DOWN to the lower natural (first-wins tie-break in the scan).
        expect(pickSampleMidi(60)).toBe(60);
        expect(pickSampleMidi(61)).toBe(60); // C#4 -> C4
        expect(pickSampleMidi(63)).toBe(62); // D#4 -> D4
        expect(pickSampleMidi(59)).toBe(59); // B3 sampled
    });

    it('clamps outside the sampled range', () => {
        expect(pickSampleMidi(40)).toBe(SAMPLE_LOW_MIDI); // E2 -> E3 sample
        expect(pickSampleMidi(120)).toBe(SAMPLE_HIGH_MIDI); // D7 is the top sample
        expect(pickSampleMidi(99)).toBe(SAMPLE_HIGH_MIDI);
    });

    it('computes the playback rate from the snapped sample', () => {
        expect(computeSampleRate(60)).toBeCloseTo(1); // exact sample
        expect(computeSampleRate(61)).toBeCloseTo(2 ** (1 / 12)); // C#4 from C4
        expect(computeSampleRate(40)).toBeCloseTo(2 ** (-12 / 12)); // E2 from E3
    });

    it('covers every natural note from E3 to D7', () => {
        expect(SAMPLE_LOW_MIDI).toBe(52);
        expect(SAMPLE_HIGH_MIDI).toBe(98);
        expect(SAMPLED_MIDIS).toHaveLength(28);
        // Every bundled note maps to an existing range value.
        for (const midi of SAMPLED_MIDIS) {
            expect(pickSampleMidi(midi)).toBe(midi);
        }
    });
});

describe('sampler loading and playback', () => {
    /** Fake context with a decodeAudioData spy, seen by the module as an AudioContext. */
    function makeContext(buffer: FakeAudioBuffer) {
        const fake = new FakeAudioContext();
        const decodeAudioData = vi.fn(async () => buffer);
        (fake as unknown as { decodeAudioData: unknown }).decodeAudioData = decodeAudioData;
        return { fake, decodeAudioData, ctx: fake as unknown as AudioContext };
    }

    function stubFetchSucceeding(): void {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8),
        })));
    }

    beforeEach(() => {
        resetSampler();
        stubAudioContextGlobal();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('loads all sampled notes and becomes ready', async () => {
        stubFetchSucceeding();
        const { decodeAudioData, ctx } = makeContext(new FakeAudioBuffer(1, 4410, 44100));

        await loadSampler(ctx);

        expect(isSamplerReady()).toBe(true);
        expect(decodeAudioData).toHaveBeenCalledTimes(SAMPLED_MIDIS.length);
    });

    it('stays not ready and allows a retry when every note fails to load', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
        const { fake, ctx } = makeContext(new FakeAudioBuffer(1, 4410, 44100));

        await expect(loadSampler(ctx)).rejects.toThrow();
        expect(isSamplerReady()).toBe(false);

        // A later call retries (the failed promise is dropped, not cached).
        stubFetchSucceeding();
        await loadSampler(ctx);
        expect(isSamplerReady()).toBe(true);
        expect(fake).not.toBeNull();
    });

    it('plays a sampled voice wired into the destination and releases after durationSec', async () => {
        stubFetchSucceeding();
        const { ctx } = makeContext(new FakeAudioBuffer(1, 44100 * 5, 44100)); // 5 s sample
        await loadSampler(ctx);

        const destination = ctx.createGain();
        const handle = playSampleVoice(ctx, destination as unknown as AudioNode, 60, 10, 1, 1.2);
        expect(handle).not.toBeNull();

        const source = handle!.source as unknown as FakeAudioBufferSourceNode;
        expect(source.buffer).not.toBeNull();
        expect(source.playbackRate.value).toBeCloseTo(1);
        expect(source.start).toHaveBeenCalledWith(10);
        // Released after durationSec + mute fade — NOT at the 5 s natural end.
        expect(source.stop).toHaveBeenCalledWith(10 + 1.2 + 0.18);

        // gain: trim at start, held until the release point, ramped to 0
        const automations = (handle!.gain as unknown as { gain: { automationCalls: Array<{ method: string; args: unknown[] }> } }).gain.automationCalls;
        expect(automations[0]).toEqual({ method: 'setValueAtTime', args: [2.2, 10] });
        expect(automations[1]).toEqual({ method: 'setValueAtTime', args: [2.2, 11.2] });
        const lastRamp = automations.at(-1)!;
        expect(lastRamp.method).toBe('linearRampToValueAtTime');
        expect(lastRamp.args[0]).toBe(0);
        expect(lastRamp.args[1]).toBeCloseTo(11.38);

        // wired source -> gain -> destination
        expect(source.connections).toContainEqual({ destination: handle!.gain, output: undefined, input: undefined });
        expect((handle!.gain as unknown as { connections: Array<{ destination: unknown }> }).connections).toContainEqual({ destination, output: undefined, input: undefined });
    });

    it('caps a long-duration request at the natural sample end', async () => {
        stubFetchSucceeding();
        const { ctx } = makeContext(new FakeAudioBuffer(1, 44100 * 5, 44100));
        await loadSampler(ctx);

        const destination = ctx.createGain();
        const handle = playSampleVoice(ctx, destination as unknown as AudioNode, 60, 0, 1, 20);
        expect(handle).not.toBeNull();
        const source = handle!.source as unknown as FakeAudioBufferSourceNode;
        // 5 s natural end: release starts at 5 − 0.18, stops at 5.
        expect(source.stop).toHaveBeenCalledWith(5);
        const automations = (handle!.gain as unknown as { gain: { automationCalls: Array<{ method: string; args: unknown[] }> } }).gain.automationCalls;
        expect(automations[1]).toEqual({ method: 'setValueAtTime', args: [2.2, 4.82] });
        expect(automations.at(-1)).toEqual({ method: 'linearRampToValueAtTime', args: [0, 5] });
    });

    it('returns null when the sampler is not ready (caller falls back to synth)', () => {
        const fake = new FakeAudioContext();
        const destination = fake.createGain();
        expect(playSampleVoice(fake as unknown as AudioContext, destination as unknown as AudioNode, 60, 0, 1, 1)).toBeNull();
    });

    it('pitch-shifts chords with per-note balance applied on top of the trim', async () => {
        stubFetchSucceeding();
        const { ctx } = makeContext(new FakeAudioBuffer(1, 44100 * 5, 44100));
        await loadSampler(ctx);

        const destination = ctx.createGain();
        const handle = playSampleVoice(ctx, destination as unknown as AudioNode, 40, 0, 0.5, 1.2);
        expect(handle).not.toBeNull();
        const source = handle!.source as unknown as FakeAudioBufferSourceNode;
        expect(source.playbackRate.value).toBeCloseTo(2 ** (-12 / 12));
        // trim × gainScale at the scheduled start (gain.value reads the ramp target).
        const automations = (handle!.gain as unknown as { gain: { automationCalls: Array<{ method: string; args: unknown[] }> } }).gain.automationCalls;
        expect(automations[0]).toEqual({ method: 'setValueAtTime', args: [2.2 * 0.5, 0] });
    });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    FakeAudioBuffer,
    FakeAudioBufferSourceNode,
    FakeAudioContext,
    stubAudioContextGlobal,
} from './fixtures/audioStubs';
import {
    computeSampleRate,
    isSamplerReady,
    loadSampler,
    playSampleVoice,
    resetSampler,
    SAMPLED_MIDIS,
    SAMPLE_HIGH_MIDI,
    SAMPLE_LOW_MIDI,
    SET_TARGET_PEAK,
    type SampleSetId,
} from '../sampler';
import { NYLON_DETECTED_F0 } from '../nylonTuning';

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

async function makeLoadedContext(sets: SampleSetId[]): Promise<AudioContext> {
    stubFetchSucceeding();
    const { ctx } = makeContext(new FakeAudioBuffer(1, 44100 * 5, 44100)); // 5 s
    await Promise.all(sets.map((set) => loadSampler(ctx, set)));
    return ctx;
}

beforeEach(() => {
    resetSampler();
    stubAudioContextGlobal();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('electric set constants', () => {
    it('covers every natural note from E3 to D7', () => {
        expect(SAMPLE_LOW_MIDI).toBe(52);
        expect(SAMPLE_HIGH_MIDI).toBe(98);
        expect(SAMPLED_MIDIS).toHaveLength(28);
        expect(SAMPLED_MIDIS).not.toContain(61); // C#4 not sampled upstream
        expect(SAMPLED_MIDIS).toContain(60);
        expect(SAMPLED_MIDIS).toContain(62);
    });
});

describe('nylon set tuning map', () => {
    it('covers the chromatic range E2..B5 that the pipeline verified', () => {
        const midis = Object.keys(NYLON_DETECTED_F0).map(Number).sort((a, b) => a - b);
        expect(midis[0]).toBe(40); // E2
        expect(midis[midis.length - 1]).toBe(83); // B5
        expect(midis).toContain(60); // C4
        expect(midis).not.toContain(77); // F5 missing upstream
    });
});

describe('sampler loading (per set)', () => {
    it('loads one set independently of the other', async () => {
        stubFetchSucceeding();
        const { ctx } = makeContext(new FakeAudioBuffer(1, 4410, 44100));

        await loadSampler(ctx, 'electric');
        expect(isSamplerReady('electric')).toBe(true);
        expect(isSamplerReady('nylon')).toBe(false);

        await loadSampler(ctx, 'nylon');
        expect(isSamplerReady('nylon')).toBe(true);
    });

    it('normalizes the decoded note to SET_TARGET_PEAK', async () => {
        stubFetchSucceeding();
        // raw peak 0.5 -> normalized to 0.3 (the SAME buffer object is decoded
        // for every note in this stub; normalize is idempotent after the first)
        const loud = new FakeAudioBuffer(1, 1000, 44100);
        loud.getChannelData(0)[100] = 0.5;
        const { ctx } = makeContext(loud);

        await loadSampler(ctx, 'electric');

        const peak = Math.max(...Array.from(loud.getChannelData(0)).map(Math.abs));
        expect(peak).toBeCloseTo(SET_TARGET_PEAK);
    });

    it('stays not ready and allows a retry when every note fails to load', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
        const { ctx } = makeContext(new FakeAudioBuffer(1, 4410, 44100));

        await expect(loadSampler(ctx, 'electric')).rejects.toThrow();
        expect(isSamplerReady('electric')).toBe(false);

        stubFetchSucceeding();
        await loadSampler(ctx, 'electric');
        expect(isSamplerReady('electric')).toBe(true);
    });
});

describe('playSampleVoice (electric)', () => {
    it('releases after durationSec (not the 5 s natural end)', async () => {
        const ctx = await makeLoadedContext(['electric']);
        const destination = ctx.createGain();

        const handle = playSampleVoice(ctx, destination as unknown as AudioNode, 60, 10, 1, 1.2, 'electric');
        expect(handle).not.toBeNull();
        const source = handle!.source as unknown as FakeAudioBufferSourceNode;
        expect(source.start).toHaveBeenCalledWith(10);
        expect(source.stop).toHaveBeenCalledWith(10 + 1.2 + 0.18);
        const automations = (handle!.gain as unknown as { gain: { automationCalls: Array<{ method: string; args: unknown[] }> } }).gain.automationCalls;
        expect(automations.at(-1)!.method).toBe('linearRampToValueAtTime');
        expect(automations.at(-1)!.args[0]).toBe(0);
        expect(automations.at(-1)!.args[1]).toBeCloseTo(11.38);
    });

    it('pitches E2 by shifting the E3 sample down an octave', async () => {
        const ctx = await makeLoadedContext(['electric']);
        const handle = playSampleVoice(ctx, ctx.createGain() as unknown as AudioNode, 40, 0, 1, 1.2, 'electric');
        const source = handle!.source as unknown as FakeAudioBufferSourceNode;
        expect(source.playbackRate.value).toBeCloseTo(2 ** (-12 / 12));
    });

    it('returns null when the electric set is not ready (synth fallback)', () => {
        const fake = new FakeAudioContext();
        const destination = fake.createGain();
        expect(
            playSampleVoice(fake as unknown as AudioContext, destination as unknown as AudioNode, 60, 0, 1, 1, 'electric'),
        ).toBeNull();
    });
});

describe('playSampleVoice (nylon)', () => {
    it('pitch-corrects via the detected tuning map', async () => {
        const ctx = await makeLoadedContext(['nylon']);
        const handle = playSampleVoice(ctx, ctx.createGain() as unknown as AudioNode, 72, 0, 1, 1.2, 'nylon');
        const source = handle!.source as unknown as FakeAudioBufferSourceNode;
        const expected = (440 * 2 ** ((72 - 69) / 12)) / NYLON_DETECTED_F0[72];
        expect(source.playbackRate.value).toBeCloseTo(expected);
    });

    it('falls back to semitone shifts for notes outside the set', async () => {
        const ctx = await makeLoadedContext(['nylon']);
        // F5 (77) is not in the nylon set: nearest is E5 (76, detected f0)
        const handle = playSampleVoice(ctx, ctx.createGain() as unknown as AudioNode, 77, 0, 1, 1.2, 'nylon');
        const source = handle!.source as unknown as FakeAudioBufferSourceNode;
        const expected = (440 * 2 ** ((77 - 69) / 12)) / NYLON_DETECTED_F0[76];
        expect(source.playbackRate.value).toBeCloseTo(expected);
    });
});

describe('computeSampleRate', () => {
    it('nylon: exact note uses target/detected ratio', async () => {
        await makeLoadedContext(['nylon']);
        const detected = NYLON_DETECTED_F0[60]; // C4
        const rate = computeSampleRate('nylon', 60);
        expect(detected).toBeGreaterThan(0);
        expect(rate).toBeCloseTo((440 * 2 ** ((60 - 69) / 12)) / detected);
    });

    it('returns 1 when the set is not loaded yet', () => {
        resetSampler('nylon');
        expect(computeSampleRate('nylon', 60)).toBe(1);
    });
});

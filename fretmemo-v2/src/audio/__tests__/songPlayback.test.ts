import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    FakeAudioBuffer,
    FakeAudioBufferSourceNode,
    FakeAudioContext,
    stubAudioContextGlobal,
} from './fixtures/audioStubs';
import { renderSongToBuffer, SongPlayback, SONG_SAMPLE_RATE } from '../songPlayback';
import type { SongExportOptions } from '../songPlayback';

function makeExportApi(chunks: Array<{ samples: Float32Array; currentTime: number; endTime: number } | undefined>) {
    const render = vi.fn();
    for (const chunk of chunks) {
        render.mockResolvedValueOnce(chunk);
    }
    const destroy = vi.fn();
    const exportAudio = vi.fn(async (_options: SongExportOptions) => ({ render, destroy }));
    return { api: { exportAudio } as never, render, destroy, exportAudio };
}

describe('renderSongToBuffer', () => {
    beforeEach(() => {
        stubAudioContextGlobal();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('assembles stereo-INTERLEAVED chunks into a 2-channel buffer and reports progress', async () => {
        const ctx = new FakeAudioContext();
        // 3 frames per chunk, interleaved L,R: L=0.1/0.3/0.5, R=0.2/0.4/0.6
        const { api, render, destroy } = makeExportApi([
            { samples: Float32Array.from([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]), currentTime: 500, endTime: 2000 },
            { samples: Float32Array.from([0.7, 0.8]), currentTime: 2000, endTime: 2000 },
        ]);
        const onProgress = vi.fn();

        const buffer = await renderSongToBuffer(ctx as unknown as AudioContext, api, onProgress);

        expect(buffer.numberOfChannels).toBe(2);
        expect(buffer.length).toBe(4); // (3 + 1) frames
        expect(buffer.sampleRate).toBe(SONG_SAMPLE_RATE);
        const left = Array.from(buffer.getChannelData(0));
        const right = Array.from(buffer.getChannelData(1));
        expect(left.map((x) => +x.toFixed(6))).toEqual([0.1, 0.3, 0.5, 0.7]);
        expect(right.map((x) => +x.toFixed(6))).toEqual([0.2, 0.4, 0.6, 0.8]);
        expect(onProgress).toHaveBeenCalledTimes(2);
        expect(render).toHaveBeenCalledWith(500);
        expect(destroy).toHaveBeenCalled();
    });

    it('throws and still destroys the exporter when nothing renders', async () => {
        const ctx = new FakeAudioContext();
        const { api, destroy } = makeExportApi([undefined]);

        await expect(renderSongToBuffer(ctx as unknown as AudioContext, api)).rejects.toThrow(
            /no audio rendered/,
        );
        expect(destroy).toHaveBeenCalled();
    });

    it('passes complete export options (alphaTab reads trackVolume unconditionally)', async () => {
        const ctx = new FakeAudioContext();
        const { api, exportAudio } = makeExportApi([
            { samples: new Float32Array(10), currentTime: 10, endTime: 10 },
        ]);

        await renderSongToBuffer(ctx as unknown as AudioContext, api);

        expect(exportAudio).toHaveBeenCalledTimes(1);
        const options = exportAudio.mock.calls[0][0] as SongExportOptions;
        expect(options.sampleRate).toBe(44100);
        expect(options.trackVolume).toBeInstanceOf(Map);
        expect(options.trackTranspositionPitches).toBeInstanceOf(Map);
        expect(options.metronomeVolume).toBe(0);
        expect(options.useSyncPoints).toBe(false);
    });

    it('rejects with a timeout error when the exporter never settles', async () => {
        const ctx = new FakeAudioContext();
        const exportAudio = vi.fn(() => new Promise(() => { /* never settles */ }));
        const api = { exportAudio } as never;

        await expect(
            renderSongToBuffer(ctx as unknown as AudioContext, api, undefined, 30),
        ).rejects.toThrow(/timed out/);
    });
});

describe('SongPlayback transport', () => {
    beforeEach(() => {
        stubAudioContextGlobal();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    function makePlayback(hooks = {}) {
        const ctx = new FakeAudioContext();
        const buffer = new FakeAudioBuffer(1, 44100 * 10, 44100); // 10 s
        const destination = ctx.createGain();
        const playback = new SongPlayback(
            ctx as unknown as AudioContext,
            destination as unknown as AudioNode,
            buffer as unknown as AudioBuffer,
            hooks,
        );
        return { ctx, destination, playback };
    }

    it('routes playback into the destination and tracks position', () => {
        const onPosition = vi.fn();
        const { ctx, destination, playback } = makePlayback({ onPosition });

        playback.play(2000);
        expect(playback.playing).toBe(true);
        const source = ctx.createdNodes.find(
            (node) => node instanceof FakeAudioBufferSourceNode,
        ) as FakeAudioBufferSourceNode;
        expect(source.buffer).not.toBeNull();
        expect(source.start).toHaveBeenCalledWith(0, 2);
        expect(source.connections).toContainEqual({
            destination,
            output: undefined,
            input: undefined,
        });
        // the ticker fired once synchronously: 2000 ms offset, ctx clock at 0
        expect(onPosition).toHaveBeenCalledWith(2000);
    });

    it('pause freezes the clock; resume continues from the offset', () => {
        const { ctx, playback } = makePlayback();
        playback.play(0);
        ctx.currentTime = 2.5; // simulate 2.5 s of playback
        playback.pause();
        expect(playback.playing).toBe(false);
        expect(playback.currentTimeMs).toBeCloseTo(2500);

        playback.play();
        expect(playback.playing).toBe(true);
        ctx.currentTime = 3;
        expect(playback.currentTimeMs).toBeCloseTo(3000);
    });

    it('stop resets to zero and reports the reset position', () => {
        const onPosition = vi.fn();
        const { playback } = makePlayback({ onPosition });
        playback.play(3000);
        playback.stop();
        expect(playback.playing).toBe(false);
        expect(playback.currentTimeMs).toBe(0);
        expect(onPosition).toHaveBeenLastCalledWith(0);
    });

    it('seek keeps playing state when the song was running', () => {
        const { playback } = makePlayback();
        playback.play(0);
        playback.seek(5000);
        expect(playback.playing).toBe(true);
        expect(playback.currentTimeMs).toBe(5000);
    });

    it('dispose stops everything without leaving timers behind', () => {
        const { playback } = makePlayback();
        playback.play(0);
        playback.dispose();
        expect(playback.playing).toBe(false);
        expect(playback.state).toBe('stopped');
    });
});

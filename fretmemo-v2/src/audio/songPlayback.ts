/**
 * Whole-song playback through the guitar sound engine.
 *
 * alphaTab renders the loaded score offline (`AlphaTabApi.exportAudio`) to
 * PCM chunks using its own soundfont synth; this module assembles the chunks
 * into an `AudioBuffer` and plays the song through the engine voice bus, so
 * the active preset (classic guitar or a NAM amp) colors the mix. alphaTab's
 * own synth stays silent — the caller keeps it paused and drives its cursors
 * via `api.timePosition` from the playback clock (`onPosition` hook).
 *
 * Structurally typed against alphaTab: no static import of the library, so
 * this module never pulls alphaTab into the audio bundle.
 */

import { getSoundEngineContext, getSoundEngineVoiceBus } from './engine';

export const SONG_SAMPLE_RATE = 44100;
/** Hard cap for the offline render loop (~50 min at 500 ms chunks). */
const MAX_RENDER_ITERATIONS = 6000;

export interface SongExportChunk {
    samples: Float32Array;
    currentTime: number;
    endTime: number;
}

export interface SongAudioExporter {
    render(milliseconds: number): Promise<SongExportChunk | undefined>;
    destroy(): void;
}

export interface SongExportOptions {
    sampleRate: number;
    masterVolume?: number;
    metronomeVolume?: number;
    useSyncPoints?: boolean;
    trackVolume?: Map<number, number>;
    trackTranspositionPitches?: Map<number, number>;
}

export interface SongExportApi {
    exportAudio(options: SongExportOptions): Promise<SongAudioExporter>;
}

export interface SongRenderProgress {
    renderedMs: number;
    totalMs: number;
}

/** Guards against a wedged worker exporter (initialize/render never settling). */
export const SONG_EXPORT_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, what: string, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(
            () => reject(new Error(`songPlayback: ${what} timed out after ${timeoutMs} ms`)),
            timeoutMs,
        );
        promise.then(
            (value) => {
                window.clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                window.clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/**
 * Render the currently loaded score to a mono AudioBuffer (offline, through
 * alphaTab's soundfont synth). The soundfont must already be loaded on the
 * API's player for the output to contain audio. The full export options are
 * provided here because alphaTab reads `trackVolume`/`trackTranspositionPitches`
 * unconditionally — a bare `{ sampleRate }` object throws a TypeError.
 */
export async function renderSongToBuffer(
    ctx: BaseAudioContext,
    api: SongExportApi,
    onProgress?: (progress: SongRenderProgress) => void,
    timeoutMs = SONG_EXPORT_TIMEOUT_MS,
): Promise<AudioBuffer> {
    const options: SongExportOptions = {
        sampleRate: SONG_SAMPLE_RATE,
        masterVolume: 1,
        metronomeVolume: 0,
        useSyncPoints: false, // exact sheet timing, not backing-track alignment
        trackVolume: new Map(),
        trackTranspositionPitches: new Map(),
    };
    const exporter = await withTimeout(api.exportAudio(options), 'export start', timeoutMs);
    try {
        const chunks: SongExportChunk[] = [];
        let totalMs = 0;
        for (let i = 0; i < MAX_RENDER_ITERATIONS; i += 1) {
            const chunk = await withTimeout(exporter.render(500), 'render chunk', timeoutMs);
            if (!chunk) break;
            chunks.push(chunk);
            totalMs = Math.max(totalMs, chunk.endTime);
            onProgress?.({ renderedMs: chunk.currentTime, totalMs: chunk.endTime });
            if (chunk.currentTime >= chunk.endTime) break;
        }
        if (chunks.length === 0) {
            throw new Error('songPlayback: no audio rendered — is the soundfont loaded?');
        }
        const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.samples.length, 0);
        const buffer = ctx.createBuffer(1, totalSamples, SONG_SAMPLE_RATE);
        const data = buffer.getChannelData(0);
        let offset = 0;
        for (const chunk of chunks) {
            data.set(chunk.samples, offset);
            offset += chunk.samples.length;
        }
        return buffer;
    } finally {
        exporter.destroy();
    }
}

export type SongPlaybackState = 'stopped' | 'playing' | 'paused';

export interface SongPlaybackHooks {
    /** ~every 120 ms while playing (and once on stop/seek). */
    onPosition?: (timeMs: number) => void;
    onEnded?: () => void;
}

/**
 * Buffer transport for the rendered song. `durationMs`/`currentTimeMs` are
 * in milliseconds; playback routes into the engine voice bus.
 */
export class SongPlayback {
    private ctx: AudioContext;
    private destination: AudioNode;
    private buffer: AudioBuffer;
    private hooks: SongPlaybackHooks;
    private source: AudioBufferSourceNode | null = null;
    private startedAtCtxTime = 0;
    private offsetSec = 0;
    private ticker: number | null = null;

    playing = false;

    constructor(ctx: AudioContext, destination: AudioNode, buffer: AudioBuffer, hooks: SongPlaybackHooks = {}) {
        this.ctx = ctx;
        this.destination = destination;
        this.buffer = buffer;
        this.hooks = hooks;
    }

    get durationMs(): number {
        return this.buffer.duration * 1000;
    }

    get state(): SongPlaybackState {
        return this.playing ? 'playing' : this.offsetSec > 0 ? 'paused' : 'stopped';
    }

    get currentTimeMs(): number {
        if (!this.playing) return this.offsetSec * 1000;
        return (this.ctx.currentTime - this.startedAtCtxTime + this.offsetSec) * 1000;
    }

    play(offsetMs?: number): void {
        this.stopSource();
        if (typeof offsetMs === 'number') {
            this.offsetSec = Math.max(0, Math.min(offsetMs / 1000, this.buffer.duration - 0.01));
        }
        if (this.offsetSec >= this.buffer.duration - 0.01) {
            this.offsetSec = 0; // replay from the top when finished
        }
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffer;
        source.connect(this.destination);
        source.onended = () => {
            if (this.source === source && this.playing) {
                this.playing = false;
                this.offsetSec = this.buffer.duration;
                this.stopTicker();
                this.hooks.onPosition?.(this.currentTimeMs);
                this.hooks.onEnded?.();
            }
        };
        source.start(0, this.offsetSec);
        this.source = source;
        this.startedAtCtxTime = this.ctx.currentTime;
        this.playing = true;
        this.startTicker();
    }

    pause(): void {
        if (!this.playing) return;
        const positionMs = this.currentTimeMs;
        this.stopSource();
        this.playing = false;
        this.offsetSec = positionMs / 1000;
        this.stopTicker();
        this.hooks.onPosition?.(positionMs);
    }

    stop(): void {
        this.stopSource();
        this.playing = false;
        this.offsetSec = 0;
        this.stopTicker();
        this.hooks.onPosition?.(0);
    }

    seek(timeMs: number): void {
        const wasPlaying = this.playing;
        this.stopSource();
        this.playing = false;
        this.offsetSec = Math.max(0, Math.min(timeMs / 1000, this.buffer.duration - 0.01));
        this.stopTicker();
        if (wasPlaying) {
            this.play();
        } else {
            this.hooks.onPosition?.(this.currentTimeMs);
        }
    }

    dispose(): void {
        this.stopSource();
        this.playing = false;
        this.stopTicker();
    }

    private stopSource(): void {
        if (this.source) {
            this.source.onended = null;
            try {
                this.source.stop();
            } catch {
                // stop() before start() is fine to ignore
            }
            this.source.disconnect();
            this.source = null;
        }
    }

    private startTicker(): void {
        const tick = () => {
            if (!this.playing) return;
            this.hooks.onPosition?.(this.currentTimeMs);
        };
        tick();
        this.ticker = window.setInterval(tick, 120);
    }

    private stopTicker(): void {
        if (this.ticker !== null) {
            window.clearInterval(this.ticker);
            this.ticker = null;
        }
    }
}

/** Convenience: engine-owned context for render + playback. */
export function getSongEngineContext(): AudioContext {
    return getSoundEngineContext();
}

/** Convenience: engine voice bus destination for playback. */
export function getSongDestination(): AudioNode {
    return getSoundEngineVoiceBus();
}

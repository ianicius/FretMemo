/**
 * Multi-buffer transport for per-track "Your Songs" playback (roadmap:
 * per-track rendering). One AudioBufferSourceNode per rendered track, all
 * started at the same context time so the buffers stay phase-aligned; each
 * source routes into its own destination (a per-track preset chain or the
 * shared playback master).
 *
 * Mirrors `SongPlayback` semantics (state, currentTimeMs, ~120 ms position
 * ticker, hooks) so ScoreViewer can swap between the two transparently.
 */
import type { ChainAudioNode } from "@/audio/chain";

export type MultiTrackPlaybackState = 'stopped' | 'playing' | 'paused';

export interface MultiTrackPlaybackHooks {
    /** ~every 120 ms while playing (and once on stop/seek). */
    onPosition?: (timeMs: number) => void;
    onEnded?: () => void;
}

export interface MultiTrackSource {
    buffer: AudioBuffer;
    /** Where this track's audio routes (a per-track chain input or master). */
    destination: AudioNode | ChainAudioNode;
}

/** Loop window in milliseconds; playback wraps endMs -> startMs. */
export interface MultiTrackLoopWindow {
    startMs: number;
    endMs: number;
}

const POSITION_TICKER_MS = 120;

export class MultiTrackPlayback {
    private ctx: AudioContext;
    private sources: MultiTrackSource[];
    private hooks: MultiTrackPlaybackHooks;
    private bufferSources: AudioBufferSourceNode[] = [];
    private startedAtCtxTime = 0;
    private offsetSec = 0;
    private ticker: number | null = null;
    private loop: MultiTrackLoopWindow | null = null;
    playing = false;
    private endedFired = false;

    constructor(ctx: AudioContext, sources: MultiTrackSource[], hooks: MultiTrackPlaybackHooks = {}) {
        if (sources.length === 0) {
            throw new Error("MultiTrackPlayback requires at least one source");
        }
        this.ctx = ctx;
        this.sources = sources;
        this.hooks = hooks;
    }

    get durationMs(): number {
        return Math.max(...this.sources.map((source) => source.buffer.duration)) * 1000;
    }

    /**
     * Sets (or clears) the loop window. While playing, a position already
     * past the new end wraps to the start immediately.
     */
    setLoop(loop: MultiTrackLoopWindow | null): void {
        if (loop !== null) {
            if (
                !Number.isFinite(loop.startMs) || !Number.isFinite(loop.endMs) ||
                loop.startMs < 0 || loop.endMs <= loop.startMs
            ) {
                throw new Error(`Invalid loop window: ${loop.startMs}-${loop.endMs}`);
            }
        }
        this.loop = loop;
        if (this.playing && loop && this.currentTimeMs >= loop.endMs) {
            this.seek(loop.startMs);
        }
    }

    get state(): MultiTrackPlaybackState {
        return this.playing ? 'playing' : this.offsetSec > 0 ? 'paused' : 'stopped';
    }

    get currentTimeMs(): number {
        if (!this.playing) return this.offsetSec * 1000;
        return Math.max(0, (this.ctx.currentTime - this.startedAtCtxTime + this.offsetSec) * 1000);
    }

    play(): void {
        if (this.playing) return;
        this.startSources(this.offsetSec);
        this.playing = true;
        this.endedFired = false;
        this.startTicker();
    }

    pause(): void {
        if (!this.playing) return;
        this.offsetSec = this.currentTimeMs / 1000;
        this.stopSources();
        this.playing = false;
        this.stopTicker();
        this.hooks.onPosition?.(this.offsetSec * 1000);
    }

    stop(): void {
        this.stopSources();
        this.playing = false;
        this.offsetSec = 0;
        this.stopTicker();
        this.hooks.onPosition?.(0);
    }

    seek(timeMs: number): void {
        const wasPlaying = this.playing;
        this.stopSources();
        this.offsetSec = Math.max(0, Math.min(timeMs / 1000, this.durationSec));
        this.playing = false;
        this.stopTicker();
        this.hooks.onPosition?.(this.offsetSec * 1000);
        if (wasPlaying) {
            this.play();
        }
    }

    dispose(): void {
        this.stopSources();
        this.playing = false;
        this.stopTicker();
    }

    private get durationSec(): number {
        return this.durationMs / 1000;
    }

    private startSources(offsetSec: number): void {
        this.stopSources();
        const when = this.ctx.currentTime + 0.05;
        this.bufferSources = this.sources.map((source) => {
            const node = this.ctx.createBufferSource();
            node.buffer = source.buffer;
            node.connect(source.destination as AudioNode);
            node.start(when, offsetSec);
            return node;
        });
        this.startedAtCtxTime = when;
    }

    private stopSources(): void {
        for (const node of this.bufferSources) {
            try {
                node.stop();
            } catch {
                // Already stopped — harmless.
            }
            node.disconnect();
        }
        this.bufferSources = [];
    }

    private startTicker(): void {
        this.stopTicker();
        this.ticker = window.setInterval(() => this.onTick(), POSITION_TICKER_MS);
    }

    private stopTicker(): void {
        if (this.ticker !== null) {
            window.clearInterval(this.ticker);
            this.ticker = null;
        }
    }

    private onTick(): void {
        const timeMs = this.currentTimeMs;
        // Loop wrap (R-04): restart inside the window instead of ending.
        // Granularity follows the ticker (~120 ms overshoot past endMs).
        if (this.loop && this.playing && timeMs >= this.loop.endMs) {
            this.seek(this.loop.startMs);
            this.hooks.onPosition?.(this.loop.startMs);
            return;
        }
        this.hooks.onPosition?.(timeMs);
        if (timeMs >= this.durationMs && !this.endedFired) {
            this.endedFired = true;
            this.stop();
            this.hooks.onEnded?.();
        }
    }
}

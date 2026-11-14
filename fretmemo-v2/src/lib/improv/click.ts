/**
 * Minimal metronome clicker for the improv guided-practice engines
 * (run improv-training-2026-11-13).
 *
 * Lookahead scheduler on setInterval that fires short triangle clicks
 * directly into `ctx.destination` — same policy as `playCountInClicks`
 * (src/lib/audio.ts): clicks are not guitar sound and must bypass the
 * preset chain. 4/4, accent on beat 1. Degrades to a no-op when no
 * AudioContext is available (tests, blocked autoplay).
 */

import { getSoundEngineContext } from "@/audio/engine";

export interface MetronomeClickerOptions {
    lookaheadMs?: number;
    scheduleAheadSec?: number;
    startOffsetSec?: number;
    /**
     * Fired once per scheduled click (1-based count). Scheduled up to
     * `scheduleAheadSec` early — good enough for gating a UI button, not a
     * sample-accurate clock.
     */
    onBeat?: (beat: number) => void;
}

export class MetronomeClicker {
    private bpm: number;
    private readonly lookaheadMs: number;
    private readonly scheduleAheadSec: number;
    private readonly startOffsetSec: number;
    private readonly onBeat: ((beat: number) => void) | null;
    private intervalHandle: ReturnType<typeof setInterval> | null = null;
    private nextClickTime = 0;
    private beatCounter = 0;

    constructor(bpm: number, options: MetronomeClickerOptions = {}) {
        this.bpm = bpm;
        this.lookaheadMs = options.lookaheadMs ?? 25;
        this.scheduleAheadSec = options.scheduleAheadSec ?? 0.12;
        this.startOffsetSec = options.startOffsetSec ?? 0.1;
        this.onBeat = options.onBeat ?? null;
    }

    get running(): boolean {
        return this.intervalHandle !== null;
    }

    setBpm(bpm: number): void {
        this.bpm = Math.max(30, Math.min(300, Math.round(bpm)));
    }

    start(): void {
        this.stop();
        try {
            const ctx = getSoundEngineContext();
            this.beatCounter = 0;
            this.nextClickTime = ctx.currentTime + this.startOffsetSec;
            this.intervalHandle = setInterval(() => this.tick(), this.lookaheadMs);
            this.tick();
        } catch {
            this.intervalHandle = null;
        }
    }

    stop(): void {
        if (this.intervalHandle !== null) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }

    private tick(): void {
        try {
            const ctx = getSoundEngineContext();
            const beatSec = 60 / Math.max(30, this.bpm);
            while (this.intervalHandle !== null && this.nextClickTime < ctx.currentTime + this.scheduleAheadSec) {
                const beatInBar = this.beatCounter % 4;
                this.scheduleClick(ctx, this.nextClickTime, beatInBar === 0);
                this.beatCounter += 1;
                this.onBeat?.(this.beatCounter);
                this.nextClickTime += beatSec;
            }
        } catch {
            // Audio unavailable — visual practice still works.
        }
    }

    private scheduleClick(ctx: AudioContext, when: number, accent: boolean): void {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(accent ? 1040 : 760, when);
        gain.gain.setValueAtTime(accent ? 0.14 : 0.08, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
        oscillator.start(when);
        oscillator.stop(when + 0.05);
    }
}

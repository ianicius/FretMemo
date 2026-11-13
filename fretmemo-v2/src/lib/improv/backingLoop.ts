/**
 * Chord-loop scheduler for the E4 backing-improv engine
 * (run improv-training-2026-11-13).
 *
 * Lookahead scheduler in the spirit of src/rhythm/engine/MetronomeScheduler,
 * but self-contained (injectable clock → unit-testable with a fake clock) and
 * chord-driven: the progression is a list of chords, each lasting N beats.
 *
 * Two callback layers:
 * - `onBeatSchedule` fires during the lookahead pass with the exact audio
 *   time — callers schedule Web Audio nodes (metronome click) there;
 * - `onChordChange` / `onBeat` / `onLoopEnd` also receive `delayMs` (time
 *   minus clock now) so UI updates and `playTone`-based audio (which has no
 *   `when` parameter) can be deferred with setTimeout.
 */

export interface LoopClock {
    /** Current time in seconds (AudioContext.currentTime semantics). */
    now(): number;
}

export interface BackingLoopEntry {
    chord: string;
    beats: number;
}

export interface ChordChangeInfo {
    chordIndex: number;
    chord: string;
    loopIndex: number;
    /** Absolute audio time of the chord start (seconds). */
    time: number;
    delayMs: number;
}

export interface BackingBeatInfo {
    loopIndex: number;
    chordIndex: number;
    chord: string;
    beatInChord: number;
    beatInLoop: number;
    time: number;
    delayMs: number;
    isChordStart: boolean;
}

export interface BackingLoopSchedulerOptions {
    clock: LoopClock;
    progression: BackingLoopEntry[];
    bpm: number;
    lookaheadMs?: number;
    scheduleAheadSec?: number;
    startOffsetSec?: number;
    onChordChange?: (info: ChordChangeInfo) => void;
    onBeatSchedule?: (info: BackingBeatInfo) => void;
    onBeat?: (info: BackingBeatInfo) => void;
    onLoopEnd?: (loopIndex: number) => void;
}

interface ChordBoundary {
    chordIndex: number;
    startBeat: number;
    beats: number;
}

function computeBoundaries(progression: BackingLoopEntry[]): { boundaries: ChordBoundary[]; totalBeats: number } {
    const boundaries: ChordBoundary[] = [];
    let cursor = 0;
    progression.forEach((entry, chordIndex) => {
        const beats = Math.max(1, Math.round(entry.beats));
        boundaries.push({ chordIndex, startBeat: cursor, beats });
        cursor += beats;
    });
    return { boundaries, totalBeats: cursor };
}

export class BackingLoopScheduler {
    private readonly clock: LoopClock;
    private readonly lookaheadMs: number;
    private readonly scheduleAheadSec: number;
    private readonly startOffsetSec: number;
    private readonly onChordChange?: (info: ChordChangeInfo) => void;
    private readonly onBeatSchedule?: (info: BackingBeatInfo) => void;
    private readonly onBeat?: (info: BackingBeatInfo) => void;
    private readonly onLoopEnd?: (loopIndex: number) => void;

    private progression: BackingLoopEntry[];
    private bpm: number;
    private intervalHandle: ReturnType<typeof setInterval> | null = null;
    private nextBeatTime = 0;
    private beatCounter = 0;

    constructor(options: BackingLoopSchedulerOptions) {
        this.clock = options.clock;
        this.progression = options.progression;
        this.bpm = options.bpm;
        this.lookaheadMs = options.lookaheadMs ?? 25;
        this.scheduleAheadSec = options.scheduleAheadSec ?? 0.12;
        this.startOffsetSec = options.startOffsetSec ?? 0.12;
        this.onChordChange = options.onChordChange;
        this.onBeatSchedule = options.onBeatSchedule;
        this.onBeat = options.onBeat;
        this.onLoopEnd = options.onLoopEnd;
    }

    get running(): boolean {
        return this.intervalHandle !== null;
    }

    setProgression(progression: BackingLoopEntry[]): void {
        this.progression = progression;
    }

    setBpm(bpm: number): void {
        this.bpm = Math.max(30, Math.min(300, Math.round(bpm)));
    }

    start(): void {
        this.stop();
        this.beatCounter = 0;
        this.nextBeatTime = this.clock.now() + this.startOffsetSec;
        this.intervalHandle = setInterval(() => this.tick(), this.lookaheadMs);
        this.tick();
    }

    stop(): void {
        if (this.intervalHandle !== null) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }

    private get beatDurationSec(): number {
        return 60 / Math.max(30, this.bpm);
    }

    private tick(): void {
        const { boundaries, totalBeats } = computeBoundaries(this.progression);
        if (totalBeats <= 0) return;

        while (this.intervalHandle !== null && this.nextBeatTime < this.clock.now() + this.scheduleAheadSec) {
            const beatInLoop = this.beatCounter % totalBeats;
            const loopIndex = Math.floor(this.beatCounter / totalBeats);
            let boundary = boundaries[boundaries.length - 1] as ChordBoundary;
            for (const candidate of boundaries) {
                if (beatInLoop >= candidate.startBeat && beatInLoop < candidate.startBeat + candidate.beats) {
                    boundary = candidate;
                    break;
                }
            }
            const beatInChord = beatInLoop - boundary.startBeat;
            const isChordStart = beatInChord === 0;
            const chord = this.progression[boundary.chordIndex]?.chord ?? "";
            const info: BackingBeatInfo = {
                loopIndex,
                chordIndex: boundary.chordIndex,
                chord,
                beatInChord,
                beatInLoop,
                time: this.nextBeatTime,
                delayMs: Math.max(0, Math.round((this.nextBeatTime - this.clock.now()) * 1000)),
                isChordStart,
            };

            if (isChordStart) {
                this.onChordChange?.({
                    chordIndex: boundary.chordIndex,
                    chord,
                    loopIndex,
                    time: this.nextBeatTime,
                    delayMs: info.delayMs,
                });
            }
            this.onBeatSchedule?.(info);
            this.onBeat?.(info);
            if (beatInLoop === totalBeats - 1) {
                this.onLoopEnd?.(loopIndex);
            }

            this.beatCounter += 1;
            this.nextBeatTime += this.beatDurationSec;
        }
    }
}

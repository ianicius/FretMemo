import type { RhythmClock } from "./RhythmClock";

export interface ScheduledStep {
    index: number;
    barIndex: number;
    barStepIndex: number;
    beatIndex: number;
    isBeatStart: boolean;
    isBarStart: boolean;
    time: number;
}

export interface MetronomeSchedulerOptions {
    clock: RhythmClock;
    bpm: number;
    timeSignatureTop: number;
    subdivision: number;
    clickEnabled?: boolean;
    clickEveryStep?: boolean;
    lookaheadMs?: number;
    scheduleAheadSec?: number;
    onStep?: (step: ScheduledStep) => void;
}

export class MetronomeScheduler {
    private readonly clock: RhythmClock;
    private readonly clickEnabled: boolean;
    private readonly clickEveryStep: boolean;
    private readonly lookaheadMs: number;
    private readonly scheduleAheadSec: number;
    private readonly onStep?: (step: ScheduledStep) => void;

    private bpm: number;
    private timeSignatureTop: number;
    private subdivision: number;

    private intervalHandle: ReturnType<typeof setInterval> | null = null;
    private running = false;
    private nextStepTime = 0;
    private stepIndex = 0;

    constructor(options: MetronomeSchedulerOptions) {
        this.clock = options.clock;
        this.bpm = options.bpm;
        this.timeSignatureTop = options.timeSignatureTop;
        this.subdivision = options.subdivision;
        this.clickEnabled = options.clickEnabled ?? true;
        this.clickEveryStep = options.clickEveryStep ?? false;
        this.lookaheadMs = options.lookaheadMs ?? 25;
        this.scheduleAheadSec = options.scheduleAheadSec ?? 0.1;
        this.onStep = options.onStep;
    }

    private get stepDurationSec(): number {
        return 60 / this.bpm / this.subdivision;
    }

    private get stepsPerBar(): number {
        return this.timeSignatureTop * this.subdivision;
    }

    setTempo(bpm: number): void {
        this.bpm = Math.max(30, Math.min(240, Math.round(bpm)));
    }

    stop(): void {
        if (this.intervalHandle !== null) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
        this.running = false;
    }

    start(startAtSec?: number): void {
        this.stop();
        this.running = true;
        this.stepIndex = 0;
        this.nextStepTime = startAtSec ?? this.clock.now() + 0.08;
        this.intervalHandle = setInterval(() => this.tick(), this.lookaheadMs);
        this.tick();
    }

    private tick(): void {
        if (!this.running) return;

        const now = this.clock.now();
        while (this.nextStepTime < now + this.scheduleAheadSec) {
            const step = this.createStep(this.stepIndex, this.nextStepTime);
            if (this.clickEnabled && (this.clickEveryStep || step.isBeatStart)) {
                this.scheduleClick(step);
            }
            this.onStep?.(step);
            this.stepIndex += 1;
            this.nextStepTime += this.stepDurationSec;
        }
    }

    private createStep(index: number, time: number): ScheduledStep {
        const barStepIndex = index % this.stepsPerBar;
        const barIndex = Math.floor(index / this.stepsPerBar);
        const beatIndex = Math.floor(barStepIndex / this.subdivision);
        const isBeatStart = barStepIndex % this.subdivision === 0;
        const isBarStart = barStepIndex === 0;

        return {
            index,
            barIndex,
            barStepIndex,
            beatIndex,
            isBeatStart,
            isBarStart,
            time,
        };
    }

    private scheduleClick(step: ScheduledStep): void {
        const context = this.clock.getContext();
        const osc = context.createOscillator();
        const gain = context.createGain();

        const isOffbeat = !step.isBeatStart;
        const frequency = step.isBarStart ? 1320 : step.isBeatStart ? 980 : 760;
        const baseVolume = step.isBarStart ? 0.2 : step.isBeatStart ? 0.12 : 0.07;
        const volume = isOffbeat ? baseVolume * 0.7 : baseVolume;

        osc.type = "square";
        osc.frequency.setValueAtTime(frequency, step.time);

        gain.gain.setValueAtTime(0.0001, step.time);
        gain.gain.exponentialRampToValueAtTime(volume, step.time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, step.time + 0.04);

        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(step.time);
        osc.stop(step.time + 0.045);
    }
}


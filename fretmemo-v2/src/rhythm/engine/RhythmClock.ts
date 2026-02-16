export class RhythmClock {
    private ctx: AudioContext | null = null;

    getContext(): AudioContext {
        if (!this.ctx) {
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === "suspended") {
            void this.ctx.resume();
        }
        return this.ctx;
    }

    async warmUp(): Promise<void> {
        const context = this.getContext();
        if (context.state === "suspended") {
            await context.resume();
        }
    }

    now(): number {
        return this.getContext().currentTime;
    }

    toDelayMs(targetTimeSec: number): number {
        return Math.max(0, (targetTimeSec - this.now()) * 1000);
    }
}


import { describe, expect, it, vi, afterEach } from "vitest";
import { MetronomeScheduler } from "../MetronomeScheduler";
import type { RhythmClock } from "../RhythmClock";

interface FakeClock {
    current: number;
    now: () => number;
    getContext: () => AudioContext;
    toDelayMs: (targetTimeSec: number) => number;
    warmUp: () => Promise<void>;
}

function createFakeClock(): FakeClock {
    return {
        current: 0,
        now() {
            return this.current;
        },
        getContext() {
            throw new Error("AudioContext should not be used in this test");
        },
        toDelayMs(targetTimeSec: number) {
            return Math.max(0, (targetTimeSec - this.current) * 1000);
        },
        warmUp: async () => { },
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe("MetronomeScheduler", () => {
    it("stops scheduling after maxSteps", () => {
        vi.useFakeTimers();
        const clock = createFakeClock();
        const observed: number[] = [];

        const scheduler = new MetronomeScheduler({
            clock: clock as unknown as RhythmClock,
            bpm: 60,
            timeSignatureTop: 4,
            subdivision: 1,
            clickEnabled: false,
            maxSteps: 4,
            onStep: (step) => {
                observed.push(step.index);
            },
        });

        scheduler.start(0);

        for (let second = 1; second <= 10; second += 1) {
            clock.current = second;
            vi.advanceTimersByTime(30);
        }

        expect(observed).toEqual([0, 1, 2, 3]);
    });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackingLoopScheduler, type BackingBeatInfo, type ChordChangeInfo, type LoopClock } from "../backingLoop";

class FakeClock implements LoopClock {
    time = 0;
    now(): number {
        return this.time;
    }
}

describe("BackingLoopScheduler", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    function createScheduler(clock: FakeClock, progression = [{ chord: "Am", beats: 2 }, { chord: "C", beats: 2 }]) {
        const chordChanges: ChordChangeInfo[] = [];
        const scheduled: BackingBeatInfo[] = [];
        const fired: BackingBeatInfo[] = [];
        const loopEnds: number[] = [];
        const scheduler = new BackingLoopScheduler({
            clock,
            progression,
            bpm: 60,
            scheduleAheadSec: 0.12,
            startOffsetSec: 0.1,
            lookaheadMs: 25,
            onChordChange: (info) => chordChanges.push(info),
            onBeatSchedule: (info) => scheduled.push(info),
            onBeat: (info) => fired.push(info),
            onLoopEnd: (loopIndex) => loopEnds.push(loopIndex),
        });
        return { scheduler, chordChanges, scheduled, fired, loopEnds };
    }

    it("schedules chord changes in progression order with correct beat counts", () => {
        const clock = new FakeClock();
        const { scheduler, chordChanges, scheduled, fired } = createScheduler(clock);

        scheduler.start();
        // First tick schedules beat 0 (chord start) inside the lookahead window.
        expect(chordChanges).toHaveLength(1);
        expect(chordChanges[0]?.chord).toBe("Am");
        expect(chordChanges[0]?.time).toBeCloseTo(0.1, 5);

        // bpm 60 → 1 s per beat; walk the clock beat by beat.
        for (const step of [1.05, 2.05, 3.05]) {
            clock.time = step;
            vi.advanceTimersByTime(25);
        }

        expect(chordChanges.map((info) => info.chord)).toEqual(["Am", "C"]);
        expect(chordChanges[1]?.time).toBeCloseTo(2.1, 5);
        // Four distinct beats scheduled and fired (2 per chord).
        expect([...new Set(scheduled.map((info) => info.beatInLoop))].sort()).toEqual([0, 1, 2, 3]);
        expect(fired).toHaveLength(scheduled.length);
        expect(scheduled.filter((info) => info.isChordStart)).toHaveLength(2);
        scheduler.stop();
    });

    it("fires onLoopEnd after the full progression and wraps to the next loop", () => {
        const clock = new FakeClock();
        const { scheduler, loopEnds, chordChanges } = createScheduler(clock);

        scheduler.start();
        for (let step = 0; step < 10; step += 1) {
            clock.time += 1.05;
            vi.advanceTimersByTime(25);
        }
        // Loop of 4 beats: ends after beats 3 and 7 (loop 0 and 1).
        expect(loopEnds).toEqual([0, 1]);
        expect(chordChanges[2]?.chord).toBe("Am");
        expect(chordChanges[2]?.loopIndex).toBe(1);
        scheduler.stop();
    });

    it("applies setBpm to the spacing of later beats", () => {
        const clock = new FakeClock();
        const { scheduler, scheduled } = createScheduler(clock);
        const times: number[] = [];

        scheduler.setBpm(120); // 0.5 s per beat for the first beats
        scheduler.start();
        scheduler.setBpm(60); // next beats are 1 s apart instead of 0.5 s
        clock.time = 2.05;
        vi.advanceTimersByTime(25);

        for (const info of scheduled) {
            if (!times.some((time) => Math.abs(time - info.time) < 1e-9)) times.push(info.time);
        }
        times.sort((a, b) => a - b);
        expect(times[0]).toBeCloseTo(0.1, 5); // start (bpm 120)
        expect(times[1]).toBeCloseTo(0.6, 5); // old tempo interval
        expect(times[2]).toBeCloseTo(1.6, 5); // new tempo interval (1 s)
        scheduler.stop();
    });

    it("stops scheduling after stop()", () => {
        const clock = new FakeClock();
        const { scheduler, chordChanges } = createScheduler(clock);

        scheduler.start();
        scheduler.stop();
        const count = chordChanges.length;
        clock.time += 5;
        vi.advanceTimersByTime(100);
        expect(chordChanges.length).toBe(count);
        expect(scheduler.running).toBe(false);
    });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    FakeAudioBuffer,
    FakeAudioBufferSourceNode,
    FakeAudioContext,
    FakeGainNode,
    stubAudioContextGlobal,
} from "./fixtures/audioStubs";
import { MultiTrackPlayback } from "../multiTrackPlayback";

function makeBuffer(seconds: number): AudioBuffer {
    return new FakeAudioBuffer(2, Math.round(seconds * 44100), 44100) as unknown as AudioBuffer;
}

function makeStubs(): { ctx: FakeAudioContext; destination: FakeGainNode } {
    const ctx = new FakeAudioContext();
    const destination = new FakeGainNode();
    return { ctx, destination };
}

function sourcesOf(ctx: FakeAudioContext): FakeAudioBufferSourceNode[] {
    return ctx.createdNodes.filter(
        (node): node is FakeAudioBufferSourceNode => node instanceof FakeAudioBufferSourceNode,
    );
}

let playback: MultiTrackPlayback | null = null;

beforeEach(() => {
    stubAudioContextGlobal();
    vi.useFakeTimers();
    playback = null;
});

describe("MultiTrackPlayback", () => {
    it("creates one source per buffer routed through per-track destinations", () => {
        const { ctx, destination } = makeStubs();
        const trackDestination = new FakeGainNode();
        playback = new MultiTrackPlayback(
            ctx as unknown as AudioContext,
            [
                { buffer: makeBuffer(4), destination: trackDestination as unknown as AudioNode },
                { buffer: makeBuffer(4), destination: destination as unknown as AudioNode },
            ],
        );
        playback.play();

        const sources = sourcesOf(ctx);
        expect(sources).toHaveLength(2);
        // Each source connects to its assigned destination node.
        const routedTo = sources.map(
            (source) =>
                ctx.connectLog.find(([from]) => from === source)?.[1],
        );
        expect(routedTo[0]).toBe(trackDestination);
        expect(routedTo[1]).toBe(destination);
    });

    it("keeps all sources time-aligned across pause and resume", () => {
        const { ctx, destination } = makeStubs();
        playback = new MultiTrackPlayback(
            ctx as unknown as AudioContext,
            [
                { buffer: makeBuffer(10), destination: destination as unknown as AudioNode },
                { buffer: makeBuffer(10), destination: destination as unknown as AudioNode },
            ],
        );
        playback.play();
        vi.advanceTimersByTime(1000);
        ctx.currentTime += 1;
        const atPause = playback.currentTimeMs;
        expect(atPause).toBeGreaterThanOrEqual(900);
        playback.pause();
        playback.play();
        ctx.currentTime += 0.5;
        vi.advanceTimersByTime(500);
        expect(playback.currentTimeMs).toBeGreaterThanOrEqual(atPause + 400);
    });

    it("stops all sources and resets position", () => {
        const { ctx, destination } = makeStubs();
        playback = new MultiTrackPlayback(
            ctx as unknown as AudioContext,
            [{ buffer: makeBuffer(10), destination: destination as unknown as AudioNode }],
        );
        playback.play();
        vi.advanceTimersByTime(500);
        playback.stop();
        expect(playback.state).toBe("stopped");
        expect(playback.currentTimeMs).toBe(0);
        expect(sourcesOf(ctx).every((source) => source.stop.mock.calls.length > 0)).toBe(true);
    });

    it("seeks by stopping sources and restarting at the offset", () => {
        const { ctx, destination } = makeStubs();
        playback = new MultiTrackPlayback(
            ctx as unknown as AudioContext,
            [{ buffer: makeBuffer(10), destination: destination as unknown as AudioNode }],
        );
        playback.play();
        vi.advanceTimersByTime(500);
        const countBeforeSeek = sourcesOf(ctx).length;
        playback.seek(3000);
        expect(playback.currentTimeMs).toBeGreaterThanOrEqual(2900);
        expect(sourcesOf(ctx).length).toBeGreaterThan(countBeforeSeek);
    });

    it("fires onEnded once when the longest buffer finishes", () => {
        const { ctx, destination } = makeStubs();
        const onEnded = vi.fn();
        playback = new MultiTrackPlayback(
            ctx as unknown as AudioContext,
            [
                { buffer: makeBuffer(1), destination: destination as unknown as AudioNode },
                { buffer: makeBuffer(3), destination: destination as unknown as AudioNode },
            ],
            { onEnded },
        );
        playback.play();
        ctx.currentTime += 3.1;
        vi.advanceTimersByTime(3500);
        expect(onEnded).toHaveBeenCalledTimes(1);
        expect(playback.state).toBe("stopped");
    });

    it("reports duration as the longest buffer", () => {
        const { ctx, destination } = makeStubs();
        playback = new MultiTrackPlayback(
            ctx as unknown as AudioContext,
            [
                { buffer: makeBuffer(2), destination: destination as unknown as AudioNode },
                { buffer: makeBuffer(6), destination: destination as unknown as AudioNode },
            ],
        );
        expect(playback.durationMs).toBe(6000);
    });

    it("supports seek before the first play (paused offset)", () => {
        const { ctx, destination } = makeStubs();
        playback = new MultiTrackPlayback(
            ctx as unknown as AudioContext,
            [{ buffer: makeBuffer(10), destination: destination as unknown as AudioNode }],
        );
        playback.seek(2000);
        expect(playback.state).toBe("paused");
        playback.play();
        ctx.currentTime += 0.3;
        vi.advanceTimersByTime(300);
        expect(playback.currentTimeMs).toBeGreaterThanOrEqual(2200);
    });
});

describe("MultiTrackPlayback — loop window (R-04)", () => {
    it("wraps playback back to the loop start past endMs and keeps playing", () => {
        const { ctx, destination } = makeStubs();
        const positions: number[] = [];
        playback = new MultiTrackPlayback(
            ctx as unknown as AudioContext,
            [{ buffer: makeBuffer(30), destination: destination as unknown as AudioNode }],
            { onPosition: (ms) => positions.push(ms) },
        );
        playback.setLoop({ startMs: 2000, endMs: 5000 });
        playback.play();
        // Advance 5.4 s past start: position passes endMs (5000) -> wrap to 2000.
        vi.advanceTimersByTime(5400);
        ctx.currentTime += 5.4;
        vi.advanceTimersByTime(200); // let the ticker observe the wrap
        expect(playback.state).toBe("playing");
        const after = playback.currentTimeMs;
        // Inside the window again (50 ms source lead-in tolerated — the
        // position dips ~50 ms below startMs right after the wrap restart).
        expect(after).toBeGreaterThanOrEqual(1800);
        expect(after).toBeLessThan(5000);
        expect(playback.currentTimeMs).toBeLessThan(20000); // never near song end
    });

    it("setLoop while playing past the new end wraps immediately", () => {
        const { ctx, destination } = makeStubs();
        playback = new MultiTrackPlayback(
            ctx as unknown as AudioContext,
            [{ buffer: makeBuffer(30), destination: destination as unknown as AudioNode }],
        );
        playback.play();
        vi.advanceTimersByTime(8000);
        ctx.currentTime += 8;
        expect(playback.currentTimeMs).toBeGreaterThanOrEqual(7500);
        playback.setLoop({ startMs: 1000, endMs: 4000 });
        expect(playback.currentTimeMs).toBeLessThan(4000);
        expect(playback.state).toBe("playing");
    });

    it("rejects an invalid loop window", () => {
        const { ctx, destination } = makeStubs();
        const player = new MultiTrackPlayback(
            ctx as unknown as AudioContext,
            [{ buffer: makeBuffer(5), destination: destination as unknown as AudioNode }],
        );
        expect(() => player.setLoop({ startMs: 3000, endMs: 1000 })).toThrow();
        expect(() => player.setLoop({ startMs: -1, endMs: 1000 })).toThrow();
    });
});

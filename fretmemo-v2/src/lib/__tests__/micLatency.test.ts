import { describe, expect, it } from "vitest";
import { computeMicLatencyMs, RmsOnsetDetector } from "../micLatency";

describe("computeMicLatencyMs", () => {
    it("returns the median onset offset for an odd hit count", () => {
        const clicks = [0, 0.6667, 1.3333, 2.0, 2.6667];
        const onsets = clicks.map((c) => c + 0.05);
        const result = computeMicLatencyMs(onsets, clicks);
        expect(result).not.toBeNull();
        expect(result!.offsetMs).toBe(50);
        expect(result!.rawOffsetMs).toBe(50);
        expect(result!.hitCount).toBe(5);
        expect(result!.rejectedCount).toBe(0);
    });

    it("averages the two middle offsets for an even hit count", () => {
        const clicks = [0, 0.6667, 1.3333, 2.0];
        const onsets = [0.04, 0.7067, 1.3933, 2.06]; // offsets 40, 40, 60, 60
        const result = computeMicLatencyMs(onsets, clicks);
        expect(result!.offsetMs).toBe(50);
    });

    it("rejects onsets that match no click within the window", () => {
        const clicks = [0, 0.6667, 1.3333, 2.0];
        const onsets = [0.05, 0.72, 1.38, 2.05, 3.9]; // 3.9 is beyond the window
        const result = computeMicLatencyMs(onsets, clicks);
        expect(result!.hitCount).toBe(4);
        expect(result!.rejectedCount).toBe(1);
    });

    it("rejects offsets beyond maxLatencyMs and clamps the median", () => {
        const clicks = [0, 0.6667, 1.3333, 2.0, 2.6667];
        const onsets = [...clicks.map((c) => c + 0.05), 0.32 + 0.6667]; // one 320ms offset
        const result = computeMicLatencyMs(onsets, clicks, { maxLatencyMs: 250 });
        expect(result!.hitCount).toBe(5);
        expect(result!.rejectedCount).toBe(1);
        expect(result!.rawOffsetMs).toBe(50);
        expect(result!.offsetMs).toBe(50);
    });

    it("clamps a negative median to zero without losing the raw value", () => {
        const clicks = [1.0, 1.6667, 2.3333];
        const onsets = clicks.map((c) => c - 0.03); // playing ahead of the click
        const result = computeMicLatencyMs(onsets, clicks, { minHits: 3 });
        expect(result!.rawOffsetMs).toBe(-30);
        expect(result!.offsetMs).toBe(0);
    });

    it("returns null when fewer than minHits onsets match", () => {
        const clicks = [0, 0.6667, 1.3333, 2.0];
        const result = computeMicLatencyMs([0.05, 0.72, 1.38], clicks);
        expect(result).toBeNull();
    });
});

describe("RmsOnsetDetector", () => {
    it("fires once on a loud transient after silence, then refracts", () => {
        const detector = new RmsOnsetDetector();
        expect(detector.feed(0.01, 0.0)).toBeNull(); // silence
        expect(detector.feed(0.01, 0.02)).toBeNull();
        expect(detector.feed(0.3, 0.04)).toBe(0.04); // onset!
        expect(detector.feed(0.35, 0.06)).toBeNull(); // still ringing, refractory
        expect(detector.feed(0.28, 0.1)).toBeNull(); // refractory window
        expect(detector.feed(0.01, 0.2)).toBeNull(); // released and re-armed (still silent)
        expect(detector.feed(0.3, 0.22)).toBe(0.22); // new onset after release
    });

    it("does not fire on a sustained loud signal without a quiet gap", () => {
        const detector = new RmsOnsetDetector();
        expect(detector.feed(0.3, 0.0)).toBe(0.0);
        for (let i = 1; i <= 10; i += 1) {
            expect(detector.feed(0.3, i * 0.02)).toBeNull();
        }
    });
});

describe("calibration scenario (synthetic)", () => {
    it("recovers ~120ms of latency from noisy strums against 90 BPM clicks", () => {
        const beat = 60 / 90; // 0.6667 s
        const clicks = Array.from({ length: 12 }, (_, i) => i * beat);
        const latency = 0.12;
        const noise = [-0.012, 0.008, -0.004, 0.015, -0.009, 0.003];
        const onsets = clicks.slice(0, 6).map((c, i) => c + latency + noise[i]);

        const result = computeMicLatencyMs(onsets, clicks);
        expect(result).not.toBeNull();
        expect(Math.abs(result!.rawOffsetMs - 120)).toBeLessThanOrEqual(10);
        expect(result!.hitCount).toBe(6);
    });
});

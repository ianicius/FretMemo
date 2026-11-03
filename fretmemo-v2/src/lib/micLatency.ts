/**
 * Mic input latency calibration math (roadmap R-10).
 *
 * Pure logic only — no AudioContext/DOM here. The calibration UI schedules
 * clicks on one AudioContext timeline, watches an analyser for sound onsets
 * on the same timeline, then hands the two timestamp lists to
 * `computeMicLatencyMs`. The median onset-minus-click offset is the latency
 * compensation the rhythm evaluator applies to judged taps.
 */

export interface MicLatencyResult {
    /** Median offset, clamped to [0, maxLatencyMs] and rounded. */
    offsetMs: number;
    /** Median offset before clamping (negative = playing ahead of the beat). */
    rawOffsetMs: number;
    /** Onsets matched to a click within the match window and latency cap. */
    hitCount: number;
    /** Onsets that matched no click or exceeded the latency cap. */
    rejectedCount: number;
}

export interface MicLatencyOptions {
    /** Max distance between an onset and its nearest click (seconds). */
    matchWindowSec?: number;
    /** Offsets beyond this many milliseconds are treated as rejected. */
    maxLatencyMs?: number;
    /** Minimum matched hits required to produce a result. */
    minHits?: number;
}

const DEFAULTS = {
    matchWindowSec: 0.4,
    maxLatencyMs: 250,
    minHits: 4,
} as const;

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
        return sorted[middle];
    }
    return (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Matches onsets to their nearest click, keeps offsets within the latency
 * cap, and returns the clamped median. `null` when there are too few hits
 * for a trustworthy measurement.
 */
export function computeMicLatencyMs(
    onsetTimesSec: number[],
    clickTimesSec: number[],
    options?: MicLatencyOptions,
): MicLatencyResult | null {
    const { matchWindowSec, maxLatencyMs, minHits } = { ...DEFAULTS, ...options };
    if (clickTimesSec.length === 0 || onsetTimesSec.length === 0) {
        return null;
    }

    const offsetsMs: number[] = [];
    let rejectedCount = 0;
    for (const onset of onsetTimesSec) {
        const nearest = nearestClick(onset, clickTimesSec);
        const nearestDeltaSec = Math.abs(onset - nearest);
        if (nearestDeltaSec > matchWindowSec) {
            rejectedCount += 1;
            continue;
        }
        const offsetMs = (onset - nearest) * 1000;
        if (Math.abs(offsetMs) > maxLatencyMs) {
            rejectedCount += 1;
            continue;
        }
        offsetsMs.push(offsetMs);
    }

    if (offsetsMs.length < minHits) {
        return null;
    }

    const rawOffsetMs = Math.round(median(offsetsMs));
    const offsetMs = Math.max(0, Math.min(maxLatencyMs, rawOffsetMs));
    return {
        offsetMs,
        rawOffsetMs,
        hitCount: offsetsMs.length,
        rejectedCount,
    };
}

function nearestClick(onset: number, clicks: number[]): number {
    let nearest = clicks[0];
    let best = Number.POSITIVE_INFINITY;
    for (const click of clicks) {
        const delta = Math.abs(onset - click);
        if (delta < best) {
            best = delta;
            nearest = click;
        }
    }
    return nearest;
}

export interface RmsOnsetDetectorOptions {
    /** Absolute RMS level above which a transient counts as an onset. */
    threshold?: number;
    /** Seconds during which no second onset can fire after the first. */
    refractorySec?: number;
    /** RMS level below which the detector re-arms (end of the transient). */
    releaseLevel?: number;
}

const DETECTOR_DEFAULTS = {
    threshold: 0.05,
    refractorySec: 0.15,
    releaseLevel: 0.02,
} as const;

/**
 * Tiny state machine over per-frame RMS values: silence → loud transient
 * fires one onset (with its AudioContext timestamp), stays deaf through the
 * ring-out, and re-arms once the signal drops back below the release level.
 */
export class RmsOnsetDetector {
    private readonly threshold: number;
    private readonly refractorySec: number;
    private readonly releaseLevel: number;
    private armed = true;
    private lastOnsetSec: number | null = null;

    constructor(options?: RmsOnsetDetectorOptions) {
        this.threshold = options?.threshold ?? DETECTOR_DEFAULTS.threshold;
        this.refractorySec = options?.refractorySec ?? DETECTOR_DEFAULTS.refractorySec;
        this.releaseLevel = options?.releaseLevel ?? DETECTOR_DEFAULTS.releaseLevel;
    }

    /** Returns the onset timestamp when this frame starts a new onset. */
    feed(rms: number, timeSec: number): number | null {
        if (this.armed) {
            if (rms >= this.threshold) {
                this.armed = false;
                this.lastOnsetSec = timeSec;
                return timeSec;
            }
            return null;
        }
        const refractoryPassed =
            this.lastOnsetSec === null || timeSec - this.lastOnsetSec >= this.refractorySec;
        if (rms < this.releaseLevel && refractoryPassed) {
            this.armed = true;
        }
        return null;
    }

    reset(): void {
        this.armed = true;
        this.lastOnsetSec = null;
    }
}

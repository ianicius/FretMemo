export type TimingRating = "perfect" | "good" | "ok" | "miss";
export type StrumDirection = "down" | "up" | "tap";

export interface TimingWindowsMs {
    perfect: number;
    good: number;
    ok: number;
}

export interface TapEvaluation {
    offsetMs: number;
    absOffsetMs: number;
    rating: TimingRating;
    isHit: boolean;
    directionCorrect: boolean;
}

export interface RhythmSessionSummary {
    totalExpected: number;
    hits: number;
    misses: number;
    extras: number;
    accuracy: number;
    avgOffsetMs: number;
    stdOffsetMs: number;
    score: number;
    perfectCount: number;
    goodCount: number;
    okCount: number;
}

export const TIMING_WINDOWS_STANDARD: TimingWindowsMs = {
    perfect: 20,
    good: 50,
    ok: 100,
};

export const TIMING_WINDOWS_RELAXED: TimingWindowsMs = {
    perfect: 30,
    good: 80,
    ok: 140,
};

export const DEFAULT_MATCH_WINDOW_SEC = 0.22;

const DEFAULT_WINDOWS: TimingWindowsMs = TIMING_WINDOWS_RELAXED;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function getTimingRating(absOffsetMs: number, windows: TimingWindowsMs): TimingRating {
    if (absOffsetMs <= windows.perfect) return "perfect";
    if (absOffsetMs <= windows.good) return "good";
    if (absOffsetMs <= windows.ok) return "ok";
    return "miss";
}

export function evaluateTapTiming(
    tapTimeSec: number,
    expectedTimeSec: number,
    directionCorrect = true,
    windows: TimingWindowsMs = DEFAULT_WINDOWS,
): TapEvaluation {
    const offsetMs = (tapTimeSec - expectedTimeSec) * 1000;
    const absOffsetMs = Math.abs(offsetMs);
    const timingRating = getTimingRating(absOffsetMs, windows);
    const isHit = directionCorrect && timingRating !== "miss";

    return {
        offsetMs,
        absOffsetMs,
        rating: timingRating,
        isHit,
        directionCorrect,
    };
}

export function applyInputLatencyCompensation(
    tapTimeSec: number,
    inputLatencyMs: number,
): number {
    const safeMs = Number.isFinite(inputLatencyMs)
        ? Math.max(0, Math.min(300, Math.round(inputLatencyMs)))
        : 0;
    return tapTimeSec - safeMs / 1000;
}

export function summarizeEvaluations(
    evaluations: TapEvaluation[],
    totalExpected: number,
    extras: number,
): RhythmSessionSummary {
    const countedHits = evaluations.filter((item) => item.isHit);
    const hits = countedHits.length;
    const misses = Math.max(0, totalExpected - hits);
    const rated = countedHits.map((item) => item.absOffsetMs);
    const avgOffsetMs = rated.length > 0
        ? rated.reduce((sum, value) => sum + value, 0) / rated.length
        : 0;
    const stdOffsetMs = rated.length > 0
        ? Math.sqrt(
            rated.reduce((sum, value) => {
                const diff = value - avgOffsetMs;
                return sum + diff * diff;
            }, 0) / rated.length,
        )
        : 0;

    const perfectCount = evaluations.filter((item) => item.isHit && item.rating === "perfect").length;
    const goodCount = evaluations.filter((item) => item.isHit && item.rating === "good").length;
    const okCount = evaluations.filter((item) => item.isHit && item.rating === "ok").length;
    const accuracy = totalExpected > 0 ? Math.round((hits / totalExpected) * 100) : 0;

    const normalizedTiming = clamp(1 - avgOffsetMs / 120, 0, 1);
    const normalizedConsistency = clamp(1 - stdOffsetMs / 120, 0, 1);
    const normalizedAccuracy = clamp(accuracy / 100, 0, 1);
    const score = Math.round(
        (normalizedAccuracy * 0.7 + normalizedTiming * 0.2 + normalizedConsistency * 0.1) * 100,
    );

    return {
        totalExpected,
        hits,
        misses,
        extras,
        accuracy,
        avgOffsetMs: Math.round(avgOffsetMs),
        stdOffsetMs: Math.round(stdOffsetMs),
        score,
        perfectCount,
        goodCount,
        okCount,
    };
}

/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Based on the SuperMemo SM-2 algorithm used in Anki.
 * Pure functions — no side effects, no store dependencies.
 *
 * @see https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
 */

export interface SpacedRepetitionEntry {
    /** SM-2 ease factor (minimum 1.3, default 2.5) */
    easeFactor: number;
    /** Current interval in days */
    interval: number;
    /** Number of consecutive correct repetitions */
    repetitions: number;
    /** ISO date string for next scheduled review */
    nextReviewDate: string;
    /** Last quality grade (0-5) */
    lastQuality: number;
}

export interface SM2Result {
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReviewDate: string;
    lastQuality: number;
}

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

/**
 * Calculate the next review schedule based on the SM-2 algorithm.
 *
 * @param quality - Answer quality (0-5): 0-2 = incorrect, 3-5 = correct with varying ease
 *   - 5: Perfect response
 *   - 4: Correct after slight hesitation
 *   - 3: Correct with serious difficulty
 *   - 2: Incorrect, but was close / easy to recall after seeing answer
 *   - 1: Incorrect, remembered vaguely
 *   - 0: Complete blackout
 * @param entry - Current SR entry (or null for first review)
 * @param todayISO - Current date as ISO string (YYYY-MM-DD). Defaults to local date.
 */
export function calculateNextReview(
    quality: number,
    entry: SpacedRepetitionEntry | null,
    todayISO?: string,
): SM2Result {
    const q = Math.max(0, Math.min(5, Math.round(quality)));
    const today = todayISO ?? getLocalDateISO();

    const prevEase = entry?.easeFactor ?? DEFAULT_EASE_FACTOR;
    const prevInterval = entry?.interval ?? 0;
    const prevReps = entry?.repetitions ?? 0;

    if (q < 3) {
        // Incorrect — reset to beginning
        return {
            easeFactor: prevEase,
            interval: 1,
            repetitions: 0,
            nextReviewDate: addDays(today, 1),
            lastQuality: q,
        };
    }

    // Correct — advance through the schedule
    let newInterval: number;
    if (prevReps === 0) {
        newInterval = 1;
    } else if (prevReps === 1) {
        newInterval = 6;
    } else {
        newInterval = Math.round(prevInterval * prevEase);
    }

    // Update ease factor
    const newEase = Math.max(
        MIN_EASE_FACTOR,
        prevEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
    );

    return {
        easeFactor: newEase,
        interval: newInterval,
        repetitions: prevReps + 1,
        nextReviewDate: addDays(today, newInterval),
        lastQuality: q,
    };
}

/**
 * Map answer correctness + response time to SM-2 quality grade (0-5).
 *
 * @param correct - Whether the answer was correct
 * @param responseTimeMs - Time taken to answer in milliseconds
 * @param timeoutMs - Maximum allowed time (e.g. metronome cycle length)
 */
export function gradeAnswer(
    correct: boolean,
    responseTimeMs: number,
    timeoutMs: number = 10_000,
): number {
    if (!correct) {
        // Differentiate between close/far misses
        return responseTimeMs < timeoutMs * 0.5 ? 2 : 1;
    }

    // Correct: grade by speed
    const ratio = responseTimeMs / timeoutMs;
    if (ratio < 0.25) return 5; // Instant
    if (ratio < 0.50) return 4; // Quick
    return 3;                    // Slow but correct
}

/**
 * Create a fresh SM-2 entry for a position that has never been reviewed.
 */
export function createDefaultEntry(): SpacedRepetitionEntry {
    return {
        easeFactor: DEFAULT_EASE_FACTOR,
        interval: 0,
        repetitions: 0,
        nextReviewDate: getLocalDateISO(),
        lastQuality: 0,
    };
}

/**
 * Check if a position is due for review.
 */
export function isDueForReview(entry: SpacedRepetitionEntry, todayISO?: string): boolean {
    const today = todayISO ?? getLocalDateISO();
    return entry.nextReviewDate <= today;
}

/**
 * Get local date as YYYY-MM-DD string (timezone-aware).
 */
export function getLocalDateISO(date: Date = new Date()): string {
    return date.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD
}

/**
 * Add days to an ISO date string.
 */
function addDays(isoDate: string, days: number): string {
    const d = new Date(isoDate + 'T12:00:00'); // Noon to avoid DST edge cases
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-CA');
}

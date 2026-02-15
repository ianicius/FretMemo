import { describe, it, expect } from 'vitest';
import {
    calculateNextReview,
    gradeAnswer,
    createDefaultEntry,
    isDueForReview,
    getLocalDateISO,
    type SpacedRepetitionEntry,
} from '../sm2';

describe('SM-2 Algorithm', () => {
    const TODAY = '2026-02-11';

    describe('calculateNextReview', () => {
        it('resets on incorrect answer (quality < 3)', () => {
            const entry: SpacedRepetitionEntry = {
                easeFactor: 2.5,
                interval: 6,
                repetitions: 3,
                nextReviewDate: '2026-02-10',
                lastQuality: 4,
            };

            const result = calculateNextReview(2, entry, TODAY);
            expect(result.repetitions).toBe(0);
            expect(result.interval).toBe(1);
            // Ease factor is preserved on failure
            expect(result.easeFactor).toBe(2.5);
            expect(result.nextReviewDate).toBe('2026-02-12');
        });

        it('sets interval to 1 on first correct response', () => {
            const result = calculateNextReview(4, null, TODAY);
            expect(result.repetitions).toBe(1);
            expect(result.interval).toBe(1);
            expect(result.nextReviewDate).toBe('2026-02-12');
        });

        it('sets interval to 6 on second correct response', () => {
            const entry: SpacedRepetitionEntry = {
                easeFactor: 2.5,
                interval: 1,
                repetitions: 1,
                nextReviewDate: TODAY,
                lastQuality: 4,
            };

            const result = calculateNextReview(4, entry, TODAY);
            expect(result.repetitions).toBe(2);
            expect(result.interval).toBe(6);
        });

        it('multiplies interval by ease factor on subsequent correct responses', () => {
            const entry: SpacedRepetitionEntry = {
                easeFactor: 2.5,
                interval: 6,
                repetitions: 2,
                nextReviewDate: TODAY,
                lastQuality: 4,
            };

            const result = calculateNextReview(4, entry, TODAY);
            expect(result.repetitions).toBe(3);
            expect(result.interval).toBe(15); // round(6 * 2.5) = 15
        });

        it('never drops ease factor below 1.3', () => {
            const entry: SpacedRepetitionEntry = {
                easeFactor: 1.3,
                interval: 6,
                repetitions: 2,
                nextReviewDate: TODAY,
                lastQuality: 3,
            };

            const result = calculateNextReview(3, entry, TODAY);
            expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
        });

        it('increases ease factor on quality 5', () => {
            const entry: SpacedRepetitionEntry = {
                easeFactor: 2.5,
                interval: 6,
                repetitions: 2,
                nextReviewDate: TODAY,
                lastQuality: 5,
            };

            const result = calculateNextReview(5, entry, TODAY);
            expect(result.easeFactor).toBeGreaterThan(2.5);
        });

        it('decreases ease factor on quality 3', () => {
            const entry: SpacedRepetitionEntry = {
                easeFactor: 2.5,
                interval: 6,
                repetitions: 2,
                nextReviewDate: TODAY,
                lastQuality: 4,
            };

            const result = calculateNextReview(3, entry, TODAY);
            expect(result.easeFactor).toBeLessThan(2.5);
        });

        it('clamps quality to 0-5 range', () => {
            const result = calculateNextReview(10, null, TODAY);
            expect(result.lastQuality).toBe(5);

            const result2 = calculateNextReview(-3, null, TODAY);
            expect(result2.lastQuality).toBe(0);
        });
    });

    describe('gradeAnswer', () => {
        it('returns 5 for instant correct answer', () => {
            expect(gradeAnswer(true, 500, 10_000)).toBe(5);
        });

        it('returns 4 for quick correct answer', () => {
            expect(gradeAnswer(true, 3000, 10_000)).toBe(4);
        });

        it('returns 3 for slow correct answer', () => {
            expect(gradeAnswer(true, 8000, 10_000)).toBe(3);
        });

        it('returns 2 for fast incorrect answer (close miss)', () => {
            expect(gradeAnswer(false, 2000, 10_000)).toBe(2);
        });

        it('returns 1 for slow incorrect answer', () => {
            expect(gradeAnswer(false, 8000, 10_000)).toBe(1);
        });
    });

    describe('createDefaultEntry', () => {
        it('returns initial values', () => {
            const entry = createDefaultEntry();
            expect(entry.easeFactor).toBe(2.5);
            expect(entry.interval).toBe(0);
            expect(entry.repetitions).toBe(0);
            expect(entry.lastQuality).toBe(0);
        });
    });

    describe('isDueForReview', () => {
        it('returns true when review date is today', () => {
            const entry: SpacedRepetitionEntry = {
                easeFactor: 2.5,
                interval: 1,
                repetitions: 1,
                nextReviewDate: TODAY,
                lastQuality: 4,
            };
            expect(isDueForReview(entry, TODAY)).toBe(true);
        });

        it('returns true when review date is in the past', () => {
            const entry: SpacedRepetitionEntry = {
                easeFactor: 2.5,
                interval: 1,
                repetitions: 1,
                nextReviewDate: '2026-02-05',
                lastQuality: 4,
            };
            expect(isDueForReview(entry, TODAY)).toBe(true);
        });

        it('returns false when review date is in the future', () => {
            const entry: SpacedRepetitionEntry = {
                easeFactor: 2.5,
                interval: 6,
                repetitions: 2,
                nextReviewDate: '2026-02-20',
                lastQuality: 4,
            };
            expect(isDueForReview(entry, TODAY)).toBe(false);
        });
    });

    describe('getLocalDateISO', () => {
        it('returns YYYY-MM-DD format', () => {
            const result = getLocalDateISO(new Date(2026, 1, 11)); // Feb 11, 2026
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(result).toBe('2026-02-11');
        });
    });
});

/**
 * Follows a note sequence played into the microphone, by pitch class (any
 * octave counts). Pure state machine fed with every detector reading, so any
 * engine that checks "play these notes in this order" can share it.
 */

export interface SequenceProgress {
    /** Notes of the target already played in order. */
    matched: number;
    /** Last pitch class heard (silence keeps it), so a held or re-picked note counts once. */
    last: number | null;
}

export const SEQUENCE_IDLE: SequenceProgress = { matched: 0, last: null };

/**
 * The progress after one detector reading (a pitch class, or null for silence).
 * A wrong note resets the attempt; a wrong note that starts the sequence counts
 * as its first note, so the learner can simply start again.
 */
export function advanceSequence(target: readonly number[], progress: SequenceProgress, heard: number | null): SequenceProgress {
    if (heard === null || heard === progress.last) return progress;
    if (progress.matched < target.length && target[progress.matched] === heard) return { matched: progress.matched + 1, last: heard };
    return { matched: target[0] === heard ? 1 : 0, last: heard };
}

/** True once every note of the target was played in order. */
export const sequenceDone = (target: readonly number[], progress: SequenceProgress) => progress.matched >= target.length;

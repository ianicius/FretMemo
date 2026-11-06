/**
 * Left-hand fingering heuristic (roadmap R-03) for guitar positions.
 *
 * Models the fretting hand as a movable "position" — the fret under the
 * index finger — with a span of four frets (index..pinky). A fretted note
 * inside the window gets the finger its offset implies; a note outside
 * forces a position shift, chosen as the closest valid window that covers
 * the note. Open strings never move the hand and carry no finger.
 *
 * Pure functions over plain positions — no store or alphaTab imports — so
 * the queue generator and the highway UI can both use it cheaply.
 */

/** Frets covered by the four fretting fingers (index..pinky). */
export const HAND_SPAN = 4;

export type Finger = 1 | 2 | 3 | 4;

/** Minimal position shape needed for fingering decisions. */
export interface FretPosition {
    stringIndex: number;
    fret: number;
}

export interface FingeringStep {
    /** 1=index … 4=pinky; null when the note is open or out of window. */
    finger: Finger | null;
    /** Fret under the index finger for this note; null on open strings. */
    handPositionFret: number | null;
}

/** Finger for `fret` given the hand at `position` (index fret); null if open/out of window. */
export function fingerForFret(fret: number, position: number): Finger | null {
    if (fret === 0) return null;
    const offset = fret - position;
    if (offset < 0 || offset >= HAND_SPAN) return null;
    return (offset + 1) as Finger;
}

/**
 * Hand position covering `fret`, closest to the current `position`.
 * Shifting up lands the pinky on the note (position = fret - span + 1);
 * shifting down lands the index on it (position = fret). Position 1 is the
 * lowest playable window; open strings never move the hand.
 */
export function handPositionFor(fret: number, position: number): number {
    if (fret === 0) return position;
    if (fret >= position && fret <= position + (HAND_SPAN - 1)) return position;
    if (fret > position) return Math.max(1, fret - (HAND_SPAN - 1));
    return fret;
}

/**
 * Walks a sequence of positions and assigns a finger plus the active hand
 * position to each. Greedy position tracking: shift only when a note falls
 * outside the current window, and shift as little as possible.
 */
export function assignFingerings(
    positions: FretPosition[],
    initialHandPositionFret?: number | null,
): FingeringStep[] {
    const steps: FingeringStep[] = [];
    let position = initialHandPositionFret ?? null;
    for (const { fret } of positions) {
        if (fret === 0) {
            steps.push({ finger: null, handPositionFret: position });
            continue;
        }
        if (position === null || fret < position || fret > position + (HAND_SPAN - 1)) {
            position = handPositionFor(fret, position ?? fret);
        }
        steps.push({
            finger: fingerForFret(fret, position),
            handPositionFret: position,
        });
    }
    return steps;
}

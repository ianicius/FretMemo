/**
 * Per-bar hit statistics (R-08 extension: "which bars do I drop notes in").
 *
 * During song playback with the microphone enabled, every beat that carries
 * notes is scored against the detected pitch (hit = the detected pitch class
 * matches any expected note). Aggregation, ratio computation and the
 * "weakest window" search are pure here so the practice loop — see the
 * weak bars, loop them — stays testable.
 */

export interface BarStats {
    hits: number;
    attempts: number;
}

export type BarStatsMap = Record<number, BarStats>;

const PITCH_CLASSES = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

/** Pitch-class name (C..B) for a midi number. */
export function midiToPitchClass(midi: number): string {
    return PITCH_CLASSES[((midi % 12) + 12) % 12];
}

/** Returns a NEW map with the beat result folded in (immutable style). */
export function recordBeatResult(
    stats: BarStatsMap,
    barIndex: number,
    hit: boolean,
): BarStatsMap {
    const current = stats[barIndex] ?? { hits: 0, attempts: 0 };
    return {
        ...stats,
        [barIndex]: {
            hits: current.hits + (hit ? 1 : 0),
            attempts: current.attempts + 1,
        },
    };
}

/** Hit ratio per bar index (null = never attempted). */
export function barHitRatios(stats: BarStatsMap, barCount: number): Array<number | null> {
    const ratios: Array<number | null> = [];
    for (let index = 0; index < barCount; index += 1) {
        const entry = stats[index];
        ratios.push(entry && entry.attempts > 0 ? entry.hits / entry.attempts : null);
    }
    return ratios;
}

/**
 * Finds the contiguous `windowSize`-bar window with the LOWEST average hit
 * ratio among bars that have data; windows touching a no-data bar are
 * skipped (looping silence is pointless). Ties resolve to the earliest
 * window. Returns null when no attempted bars exist at all.
 */
export function weakestBarWindow(
    ratios: Array<number | null>,
    barCount: number,
    windowSize: number,
): { start: number; end: number } | null {
    const size = Math.min(Math.max(1, windowSize), barCount);
    let best: { start: number; end: number } | null = null;
    let bestAverage = Number.POSITIVE_INFINITY;
    for (let start = 0; start + size <= barCount; start += 1) {
        let sum = 0;
        let valid = true;
        for (let index = start; index < start + size; index += 1) {
            const ratio = ratios[index];
            if (ratio === null || !Number.isFinite(ratio)) {
                valid = false;
                break;
            }
            sum += ratio;
        }
        if (!valid) continue;
        const average = sum / size;
        if (average < bestAverage) {
            bestAverage = average;
            best = { start, end: start + size - 1 };
        }
    }
    return best;
}

/** Duck-typed slice of the alphaTab score needed for marker building. */
interface BeatMarkerScoreLike {
    masterBars: Array<{ start: number }>;
    tracks: Array<{
        staves: Array<{
            bars: Array<{
                voices: Array<{
                    beats: Array<{
                        playbackDuration: number;
                        isEmpty: boolean;
                        notes: Array<{ realValue: number }>;
                    }>;
                }>;
            }>;
        }>;
    }>;
}

export interface BeatMarker {
    barIndex: number;
    beatIndex: number;
    /** Tick position of the beat start (masterBar.start + intra-bar offset). */
    startTick: number;
    /** Expected pitch classes — a hit is any of them. */
    pitchClasses: string[];
}

/**
 * Scored-beat markers for one track: every non-empty beat of the primary
 * voice with its tick position and expected pitches. Empty/rest beats are
 * skipped — nothing to play, nothing to score.
 */
export function buildBeatMarkers(score: BeatMarkerScoreLike, trackIndex: number): BeatMarker[] {
    const markers: BeatMarker[] = [];
    const track = score.tracks[trackIndex];
    if (!track) return markers;
    track.staves.forEach((staff) => {
        staff.bars.forEach((bar, barIndex) => {
            const barStartTick = score.masterBars[barIndex]?.start ?? 0;
            const primaryVoice = bar.voices[0];
            if (!primaryVoice) return;
            let offsetTick = 0;
            primaryVoice.beats.forEach((beat, beatIndex) => {
                const pitchClasses = beat.isEmpty
                    ? []
                    : beat.notes
                          .filter((note) => Number.isFinite(note.realValue))
                          .map((note) => midiToPitchClass(note.realValue));
                if (pitchClasses.length > 0) {
                    markers.push({
                        barIndex,
                        beatIndex,
                        startTick: barStartTick + offsetTick,
                        pitchClasses,
                    });
                }
                offsetTick += beat.playbackDuration;
            });
        });
    });
    return markers;
}

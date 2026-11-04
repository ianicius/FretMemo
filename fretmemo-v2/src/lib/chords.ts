/**
 * Chord prompter data (roadmap R-05).
 *
 * Builds a per-master-bar chord timeline from an alphaTab track:
 * 1. annotated chords from the file (Staff.chords lookup via Beat.chordId);
 * 2. best-effort derivation from the bar's midi notes via tonal's
 *    `Chord.detect` — an approximation, clearly labeled in the result.
 *
 * Input shapes are structural (duck-typed) so tests can fake the model
 * without importing alphaTab classes.
 */
import { Chord, Note } from "tonal";

export type ChordTimelineEntry = {
    name: string;
    source: "annotation" | "derived";
};

export interface PrompterNote {
    /** Absolute midi note number (alphaTab `Note.realValue`). */
    realValue: number;
}

export interface PrompterBeat {
    chordId: string | null;
    chord: { name: string } | null;
    notes: PrompterNote[];
}

export interface PrompterBar {
    voices: Array<{ beats: PrompterBeat[] }>;
}

export interface PrompterStaff {
    bars: PrompterBar[];
    chords: Record<string, { name: string }> | null;
}

export interface PrompterTrack {
    staves: PrompterStaff[];
}

/** Derives a chord symbol from a bar's midi notes, or null when unsure. */
export function deriveChordFromBar(notes: PrompterNote[]): string | null {
    const pitchClasses = new Set<string>();
    for (const note of notes) {
        if (typeof note.realValue !== "number" || !Number.isFinite(note.realValue)) {
            continue;
        }
        const pc = Note.fromMidi(note.realValue);
        if (pc) {
            pitchClasses.add(Note.pitchClass(pc));
        }
    }
    if (pitchClasses.size < 3) {
        return null;
    }
    const candidates = Chord.detect(Array.from(pitchClasses));
    if (candidates.length === 0) {
        return null;
    }
    // tonal spells the plain major triad as "CM" — display it as "C".
    return candidates[0].replace(/^([A-G][#b]*)M$/, "$1");
}

/**
 * Builds the chord timeline indexed by master bar.
 * Returns `null` when the track yields no chords at all (the prompter hides).
 */
export function buildChordTimeline(
    track: PrompterTrack,
    masterBarCount: number,
): ChordTimelineEntry[] | null {
    const staff = track.staves[0];
    if (!staff || masterBarCount <= 0) {
        return null;
    }

    const timeline: Array<ChordTimelineEntry | null> = [];
    let found = false;
    for (let barIndex = 0; barIndex < masterBarCount; barIndex += 1) {
        const bar = staff.bars[barIndex];
        let entry: ChordTimelineEntry | null = null;
        if (bar) {
            entry = chordForBar(bar, staff.chords);
        }
        if (entry !== null) {
            found = true;
        }
        timeline.push(entry);
    }

    return found ? timeline : null;
}

function chordForBar(bar: PrompterBar, chords: PrompterStaff["chords"]): ChordTimelineEntry | null {
    const beats = bar.voices.flatMap((voice) => voice.beats);

    // 1) Annotated chord from the file.
    for (const beat of beats) {
        if (beat.chordId && beat.chord?.name) {
            return { name: beat.chord.name, source: "annotation" };
        }
        if (chords && beat.chordId && chords[beat.chordId]?.name) {
            return { name: chords[beat.chordId].name, source: "annotation" };
        }
    }

    // 2) Best-effort derivation from the bar's notes.
    const derived = deriveChordFromBar(beats.flatMap((beat) => beat.notes));
    return derived === null ? null : { name: derived, source: "derived" };
}

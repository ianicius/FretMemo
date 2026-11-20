/**
 * Ear-training quiz generators: scale degrees after a cadence, intervals,
 * chord qualities and inversions, chord functions and progressions.
 * Every question carries its sound (lib/improv/questionSound.ts); chords are
 * real guitar voicings from lib/improv/voicings.ts, not piano stacks.
 * Registered in questions.ts like every other generator, so any track can use them.
 */

import { Chord, Key } from "tonal";
import { NOTES, STANDARD_TUNING } from "@/lib/constants";
import { EAR_INTERVALS } from "@/lib/earIntervals";
import { degreeToSemitone, type FunctionalDegree, type FunctionalMode } from "@/lib/functionalEar";
import type { NoteName } from "@/types/fretboard";
import type { ChoiceQuestion, Rng } from "./questions";
import { cadence, chord, rest, tone, type SoundStep } from "./questionSound";
import { DROP2_ORDERS, STRING_SETS, chordShape, chordVoicings, voiceLeadPath, voicingMidis, type ChordShape, type Voicing } from "./voicings";

const TUNING = STANDARD_TUNING as NoteName[];
/** Key names by pitch class, spelled the usual way for each mode. */
const MAJOR_KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const DEGREES: FunctionalDegree[] = ["1", "2", "3", "4", "5", "6", "7"];
/** Natural minor degrees as musicians name them against major. */
const MINOR_LABELS: Record<FunctionalDegree, string> = { 1: "1", 2: "2", 3: "b3", 4: "4", 5: "5", 6: "b6", 7: "b7" };

/** The correct answer and up to three distractors, shuffled (generateChoiceQuiz keeps the first four). */
function options(correct: string, pool: readonly string[], rng: Rng): { options: string[]; correctIndex: number } {
    const shuffled = rng.shuffle([correct, ...rng.shuffle(pool.filter((item) => item !== correct)).slice(0, 3)]);
    return { options: shuffled, correctIndex: shuffled.indexOf(correct) };
}

/** Name of the key whose tonic is this MIDI note. */
export function keyName(tonicMidi: number, mode: FunctionalMode = "major"): string {
    return (mode === "minor" ? MINOR_KEYS : MAJOR_KEYS)[((tonicMidi % 12) + 12) % 12] as string;
}

const noteOf = (midi: number) => NOTES[((midi % 12) + 12) % 12] as string;

/** Tonic between C3 and B3: cadences and targets stay in the guitar's middle register. */
const pickTonic = (rng: Rng) => 48 + rng.int(12);

/* ─────────── Scale degrees ─────────── */

export function generateEarDegree(rng: Rng, direction: string): ChoiceQuestion {
    const mode: FunctionalMode = direction === "minor" ? "minor" : "major";
    const pool = direction === "major-135" ? (["1", "3", "5"] as FunctionalDegree[]) : DEGREES;
    const degree = rng.pick(pool);
    const tonic = pickTonic(rng);
    const key = keyName(tonic, mode);
    const scale = mode === "minor" ? Key.minorKey(key).natural.scale : Key.majorKey(key).scale;
    const label = (item: FunctionalDegree) => (mode === "minor" ? MINOR_LABELS[item] : item);
    return {
        id: "earDegree",
        promptKey: mode === "minor" ? "improv.q.earDegree.promptMinor" : "improv.q.earDegree.promptMajor",
        promptValues: { key },
        ...options(label(degree), pool.map(label), rng),
        audio: [...cadence(tonic, mode), tone(tonic + degreeToSemitone(degree, mode), 1.4)],
        hintKey: "improv.q.earDegree.hint",
        hintValues: { note: scale[Number(degree) - 1] as string, degree: label(degree) },
    };
}

/* ─────────── Intervals ─────────── */

const EASY_INTERVALS = ["m3", "M3", "P4", "P5", "P8"];

export function generateEarInterval(rng: Rng, direction: string): ChoiceQuestion {
    const pool = EAR_INTERVALS.filter((interval) => interval.semitones > 0 && (direction !== "easy-up" || EASY_INTERVALS.includes(interval.name)));
    const interval = rng.pick(pool);
    const down = direction === "all" && rng.int(2) === 1;
    const harmonic = direction === "harmonic";
    // Both notes stay between C3 and C5.
    const low = 48 + rng.int(25 - interval.semitones);
    const [first, second] = down ? [low + interval.semitones, low] : [low, low + interval.semitones];
    const audio: SoundStep[] = harmonic ? [chord([first, second], 1.6)] : [tone(first, 0.9), tone(second, 1.4)];
    return {
        id: "earInterval",
        promptKey: harmonic ? "improv.q.earInterval.promptHarmonic" : down ? "improv.q.earInterval.promptDown" : "improv.q.earInterval.promptUp",
        promptValues: {},
        ...options(interval.labelKey, pool.map((item) => item.labelKey), rng),
        audio,
        hintKey: "improv.q.earInterval.hint",
        hintValues: { first: noteOf(first), second: noteOf(second) },
    };
}

/* ─────────── Chords ─────────── */

/** Answer labels (shared with the triadType quiz) and the chord symbol suffix they stand for. */
const TRIAD_TYPES: Array<[string, string]> = [["major (M)", ""], ["minor (m)", "m"], ["diminished (dim)", "dim"], ["augmented (aug)", "aug"]];
const SEVENTH_TYPES: Array<[string, string]> = [["maj7", "maj7"], ["7 (dominant)", "7"], ["m7", "m7"], ["m7b5 (half-dim)", "m7b5"]];
export const BASS_KEYS = ["improv.q.earChord.bassRoot", "improv.q.earChord.bassThird", "improv.q.earChord.bassFifth"] as const;

/**
 * A guitar voicing of the chord: a closed triad on a random string set or a
 * drop 2 seventh on strings 1-4 or 2-5, optionally in the given inversion.
 */
export function earChordMidis(symbol: string, rng: Rng, inversion?: number): number[] {
    const shape = chordShape(symbol) as ChordShape;
    const seventh = shape.intervals.length === 4;
    const strings = seventh ? rng.pick([[3, 2, 1, 0], [4, 3, 2, 1]]) : rng.pick(Object.values(STRING_SETS));
    const voicings = chordVoicings(shape, strings, TUNING, seventh ? { orders: DROP2_ORDERS } : {})
        .filter((voicing) => inversion === undefined || voicing.inversion === inversion);
    return voicingMidis(rng.pick(voicings), TUNING);
}

export function generateEarChord(rng: Rng, direction: string): ChoiceQuestion {
    const root = rng.pick(MAJOR_KEYS);
    if (direction === "inversions") {
        const symbol = `${root}${rng.pick(["", "m"])}`;
        const inversion = rng.int(3);
        const midis = earChordMidis(symbol, rng, inversion);
        return {
            id: "earChord",
            promptKey: "improv.q.earChord.promptBass",
            promptValues: {},
            ...options(BASS_KEYS[inversion] as string, BASS_KEYS, rng),
            // Strummed, then from the bass up, then the bass alone against the top.
            audio: [chord(midis, 1.6), ...midis.map((midi) => tone(midi, 0.5)), rest(0.3), chord(midis, 1.6)],
            hintKey: "improv.q.earChord.hintBass",
            // Spelled from the chord (Ebm has Bb in the bass, not A#).
            hintValues: { chord: symbol, root: Chord.get(symbol).notes[inversion] as string },
        };
    }
    const types = direction === "sevenths" ? SEVENTH_TYPES : TRIAD_TYPES;
    const [label, suffix] = rng.pick(types);
    const symbol = `${root}${suffix}`;
    const midis = earChordMidis(symbol, rng);
    return {
        id: "earChord",
        promptKey: "improv.q.earChord.promptQuality",
        promptValues: {},
        ...options(label, types.map(([item]) => item), rng),
        audio: [chord(midis, 1.6), ...midis.map((midi) => tone(midi, 0.5)), rest(0.3), chord(midis, 1.6)],
        hintKey: "improv.q.earChord.hint",
        hintValues: { chord: symbol },
    };
}

/* ─────────── Functions and progressions ─────────── */

const ROMANS = ["I", "ii", "iii", "IV", "V", "vi"];
export const EAR_PROGRESSIONS = ["I–V–vi–IV", "I–vi–IV–V", "I–IV–V–I", "vi–IV–I–V", "I–IV–vi–V", "ii–V–I–I", "I–iii–IV–V"];

/** Diatonic triads of a progression in the key: "I–V–vi–IV" in G → G D Em C. */
export function progressionChords(progression: string, key: string): string[] {
    const triads = Key.majorKey(key).triads;
    return progression.split("–").map((roman) => triads[ROMANS.indexOf(roman)] as string);
}

/** Each chord as a voice-led triad on the middle strings over its root in the bass (E2–D#3). */
function progressionSound(chords: string[], seconds: number): SoundStep[] {
    const shapes = chords.map((symbol) => chordShape(symbol) as ChordShape);
    const path = voiceLeadPath(shapes, STRING_SETS.middle, TUNING, { startFret: 5 });
    return shapes.map((shape, index) => chord([40 + ((shape.rootPc - 4 + 12) % 12), ...voicingMidis(path[index] as Voicing, TUNING)], seconds));
}

export function generateEarProgression(rng: Rng, direction: string): ChoiceQuestion {
    const tonic = pickTonic(rng);
    const key = keyName(tonic);
    if (direction === "progression") {
        const progression = rng.pick(EAR_PROGRESSIONS);
        const chords = progressionChords(progression, key);
        return {
            id: "earProgression",
            promptKey: "improv.q.earProgression.promptProgression",
            promptValues: { key },
            ...options(progression, EAR_PROGRESSIONS, rng),
            audio: [...cadence(tonic), rest(0.4), ...progressionSound(chords, 1.3)],
            hintKey: "improv.q.earProgression.hint",
            hintValues: { key, chord: chords.join("–") },
        };
    }
    const roman = rng.pick(ROMANS);
    const chords = progressionChords(roman, key);
    return {
        id: "earProgression",
        promptKey: "improv.q.earProgression.promptFunction",
        promptValues: { key },
        ...options(roman, ROMANS, rng),
        audio: [...cadence(tonic), rest(0.4), ...progressionSound(chords, 1.8)],
        hintKey: "improv.q.earProgression.hint",
        hintValues: { key, chord: chords.join("–") },
    };
}

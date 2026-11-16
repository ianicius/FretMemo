/**
 * Plan E4: which scale to improvise with over each chord of a loaded song.
 * The song's major key is estimated from its chords; a chord that belongs to
 * that key gets its mode by degree (IV → Lydian, vi → Aeolian…), any other
 * chord a default for its quality (m7 → Dorian, 7 → Mixolydian…).
 *
 * shortcut: minor-key songs read as their relative major (i → Aeolian) and
 * altered dominants get plain Mixolydian; refine when users ask for it.
 */
import { Chord, Key, Note } from "tonal";

type Family = "major" | "minor" | "dominant" | "halfDim" | "dim" | "aug" | "minorMajor";

const DEFAULT_MODE: Record<Family, string> = {
    major: "Ionian",
    minor: "Dorian",
    dominant: "Mixolydian",
    halfDim: "Locrian",
    dim: "Diminished",
    aug: "Whole Tone",
    minorMajor: "Melodic Minor",
};

/** Degree families of a major key and the mode of each degree. */
const DEGREES: Array<{ families: Family[]; mode: string }> = [
    { families: ["major"], mode: "Ionian" },
    { families: ["minor"], mode: "Dorian" },
    { families: ["minor"], mode: "Phrygian" },
    { families: ["major"], mode: "Lydian" },
    { families: ["dominant", "major"], mode: "Mixolydian" },
    { families: ["minor"], mode: "Aeolian" },
    { families: ["halfDim", "dim"], mode: "Locrian" },
];

function parse(name: string): { root: string; family: Family } | null {
    const chord = Chord.get(name.split("/")[0] ?? name);
    if (chord.empty || !chord.tonic) return null;
    const has = (interval: string) => chord.intervals.includes(interval);
    let family: Family;
    if (has("3M") && has("5A")) family = "aug";
    else if (has("3m") && has("5d")) family = has("7m") ? "halfDim" : "dim";
    else if (has("3m")) family = has("7M") ? "minorMajor" : "minor";
    else if (has("7m")) family = "dominant"; // 7 and 7sus
    else family = "major";
    return { root: chord.tonic, family };
}

export interface SongScales {
    /** Estimated major key ("G"), or null when no key covers half of the chords. */
    key: string | null;
    /** Root and mode for a chord name, or null when the chord cannot be read. */
    scaleFor: (chord: string) => { root: string; mode: string } | null;
}

export function songScales(chords: string[]): SongScales {
    const parsed = chords.map(parse).filter((item): item is NonNullable<ReturnType<typeof parse>> => item !== null);
    const degreeOf = (key: string, item: { root: string; family: Family }) => {
        const scale = Key.majorKey(key).scale as string[];
        const index = scale.findIndex((note) => Note.chroma(note) === Note.chroma(item.root));
        return index >= 0 && DEGREES[index].families.includes(item.family) ? index : -1;
    };
    let key: string | null = null;
    let best = 0;
    for (const candidate of ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"]) {
        const score = parsed.filter((item) => degreeOf(candidate, item) >= 0).length;
        if (score > best) {
            best = score;
            key = candidate;
        }
    }
    if (best * 2 < parsed.length || best === 0) key = null;

    return {
        key,
        scaleFor: (name) => {
            const item = parse(name);
            if (!item) return null;
            const degree = key ? degreeOf(key, item) : -1;
            return { root: item.root, mode: degree >= 0 ? DEGREES[degree].mode : DEFAULT_MODE[item.family] };
        },
    };
}

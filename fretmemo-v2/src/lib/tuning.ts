import { NOTES, STANDARD_TUNING } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";
import type { InstrumentType } from "@/types/settings";

export interface TuningPreset {
    id: string;
    label: string;
    instrument: InstrumentType;
    tuning: NoteName[]; // High E -> Low E
}

const FLAT_TO_SHARP: Record<string, NoteName> = {
    Db: "C#",
    Eb: "D#",
    Gb: "F#",
    Ab: "G#",
    Bb: "A#",
};

const MIN_STRINGS = 4;
const MAX_STRINGS = 8;

export const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
    guitar6: "Guitar (6)",
    guitar7: "Guitar (7)",
    guitar8: "Guitar (8)",
    bass4: "Bass (4)",
    bass5: "Bass (5)",
    ukulele4: "Ukulele (4)",
};

export const TUNING_PRESETS: TuningPreset[] = [
    { id: "standard", instrument: "guitar6", label: "Standard (E-A-D-G-B-E)", tuning: ["E", "B", "G", "D", "A", "E"] },
    { id: "drop-d", instrument: "guitar6", label: "Drop D (D-A-D-G-B-E)", tuning: ["E", "B", "G", "D", "A", "D"] },
    { id: "dadgad", instrument: "guitar6", label: "DADGAD", tuning: ["D", "A", "G", "D", "A", "D"] },
    { id: "open-g", instrument: "guitar6", label: "Open G", tuning: ["D", "B", "G", "D", "G", "D"] },
    { id: "open-d", instrument: "guitar6", label: "Open D", tuning: ["D", "A", "F#", "D", "A", "D"] },
    { id: "double-drop-d", instrument: "guitar6", label: "Double Drop D", tuning: ["D", "B", "G", "D", "A", "D"] },
    { id: "e-flat", instrument: "guitar6", label: "Half Step Down (Eb)", tuning: ["D#", "A#", "F#", "C#", "G#", "D#"] },

    { id: "standard-7", instrument: "guitar7", label: "Standard 7 (B-E-A-D-G-B-E)", tuning: ["E", "B", "G", "D", "A", "E", "B"] },
    { id: "drop-a-7", instrument: "guitar7", label: "Drop A 7 (A-E-A-D-G-B-E)", tuning: ["E", "B", "G", "D", "A", "E", "A"] },

    { id: "standard-8", instrument: "guitar8", label: "Standard 8 (F#-B-E-A-D-G-B-E)", tuning: ["E", "B", "G", "D", "A", "E", "B", "F#"] },

    { id: "bass-standard-4", instrument: "bass4", label: "Bass Standard (E-A-D-G)", tuning: ["G", "D", "A", "E"] },
    { id: "bass-drop-d-4", instrument: "bass4", label: "Bass Drop D (D-A-D-G)", tuning: ["G", "D", "A", "D"] },

    { id: "bass-standard-5", instrument: "bass5", label: "Bass Standard 5 (B-E-A-D-G)", tuning: ["G", "D", "A", "E", "B"] },

    { id: "ukulele-standard", instrument: "ukulele4", label: "Ukulele Standard (G-C-E-A)", tuning: ["A", "E", "C", "G"] },
];

const DEFAULT_PRESET_BY_INSTRUMENT: Record<InstrumentType, string> = {
    guitar6: "standard",
    guitar7: "standard-7",
    guitar8: "standard-8",
    bass4: "bass-standard-4",
    bass5: "bass-standard-5",
    ukulele4: "ukulele-standard",
};

function toNoteName(value: unknown): NoteName | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const mapped = FLAT_TO_SHARP[trimmed] ?? trimmed;
    return NOTES.includes(mapped as NoteName) ? (mapped as NoteName) : null;
}

export function isSameTuning(a: NoteName[], b: NoteName[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

export function normalizeTuning(value: unknown): NoteName[] {
    if (!Array.isArray(value)) return [...STANDARD_TUNING];

    const converted = value.map(toNoteName);
    if (converted.some((note) => note === null)) {
        return [...STANDARD_TUNING];
    }

    const tuning = converted as NoteName[];
    if (tuning.length < MIN_STRINGS || tuning.length > MAX_STRINGS) {
        return [...STANDARD_TUNING];
    }

    // Legacy orientation fallback (low -> high).
    const maybeReversed = [...tuning].reverse();
    if (
        !isSameTuning(tuning, STANDARD_TUNING) &&
        TUNING_PRESETS.some((preset) => isSameTuning(maybeReversed, preset.tuning))
    ) {
        return maybeReversed;
    }

    return tuning;
}

export function normalizeInstrumentType(value: unknown): InstrumentType {
    if (typeof value !== "string") return "guitar6";
    if (value === "guitar" || value === "guitar6") return "guitar6";
    if (value === "bass" || value === "bass4") return "bass4";
    if (value === "ukulele" || value === "ukulele4") return "ukulele4";
    if (value === "guitar7" || value === "guitar8" || value === "bass5") return value;
    return "guitar6";
}

export function getTuningPresetsForInstrument(instrument: InstrumentType): TuningPreset[] {
    return TUNING_PRESETS.filter((preset) => preset.instrument === instrument);
}

export function getDefaultTuningForInstrument(instrument: InstrumentType): NoteName[] {
    const normalized = normalizeInstrumentType(instrument);
    const presetId = DEFAULT_PRESET_BY_INSTRUMENT[normalized];
    return getTuningByPresetId(presetId);
}

export function inferInstrumentTypeFromTuning(tuning: NoteName[]): InstrumentType {
    const preset = TUNING_PRESETS.find((item) => isSameTuning(item.tuning, tuning));
    if (preset) return preset.instrument;

    if (tuning.length === 4) return "bass4";
    if (tuning.length === 5) return "bass5";
    if (tuning.length === 7) return "guitar7";
    if (tuning.length === 8) return "guitar8";
    return "guitar6";
}

export function getTuningPresetId(tuning: NoteName[]): string {
    const found = TUNING_PRESETS.find((preset) => isSameTuning(preset.tuning, tuning));
    return found?.id ?? "custom";
}

export function getTuningByPresetId(presetId: string): NoteName[] {
    const found = TUNING_PRESETS.find((preset) => preset.id === presetId);
    return found ? [...found.tuning] : [...STANDARD_TUNING];
}

export function getStringLabels(tuning: NoteName[]): string[] {
    return tuning.map((note, index) => {
        if (index === 0) return `High ${note}`;
        if (index === tuning.length - 1) return `Low ${note}`;
        return note;
    });
}

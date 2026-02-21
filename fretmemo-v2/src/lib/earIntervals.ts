export interface EarIntervalDefinition {
    semitones: number;
    name: string;
    labelKey: string;
    aliases?: string[];
}

export const EAR_INTERVALS: EarIntervalDefinition[] = [
    { semitones: 0, name: "P1", labelKey: "ear.intervals.labels.P1" },
    { semitones: 1, name: "m2", labelKey: "ear.intervals.labels.m2" },
    { semitones: 2, name: "M2", labelKey: "ear.intervals.labels.M2" },
    { semitones: 3, name: "m3", labelKey: "ear.intervals.labels.m3" },
    { semitones: 4, name: "M3", labelKey: "ear.intervals.labels.M3" },
    { semitones: 5, name: "P4", labelKey: "ear.intervals.labels.P4" },
    { semitones: 6, name: "A4", labelKey: "ear.intervals.labels.A4", aliases: ["TT"] },
    { semitones: 7, name: "P5", labelKey: "ear.intervals.labels.P5" },
    { semitones: 8, name: "m6", labelKey: "ear.intervals.labels.m6" },
    { semitones: 9, name: "M6", labelKey: "ear.intervals.labels.M6" },
    { semitones: 10, name: "m7", labelKey: "ear.intervals.labels.m7" },
    { semitones: 11, name: "M7", labelKey: "ear.intervals.labels.M7" },
    { semitones: 12, name: "P8", labelKey: "ear.intervals.labels.P8" },
];

const INTERVAL_BY_TOKEN = new Map<string, EarIntervalDefinition>();
for (const interval of EAR_INTERVALS) {
    INTERVAL_BY_TOKEN.set(interval.name.toUpperCase(), interval);
    for (const alias of interval.aliases ?? []) {
        INTERVAL_BY_TOKEN.set(alias.toUpperCase(), interval);
    }
}

export function resolveEarInterval(token: string): EarIntervalDefinition | null {
    if (!token) return null;
    return INTERVAL_BY_TOKEN.get(token.trim().toUpperCase()) ?? null;
}

export function getEarIntervalsFromTokens(tokens: string[]): EarIntervalDefinition[] {
    const normalized = new Set(
        tokens
            .map(resolveEarInterval)
            .filter((interval): interval is EarIntervalDefinition => interval !== null)
            .map((interval) => interval.name),
    );

    if (normalized.size === 0) return [...EAR_INTERVALS];
    return EAR_INTERVALS.filter((interval) => normalized.has(interval.name));
}

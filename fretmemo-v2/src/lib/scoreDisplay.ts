import type { ScoreSummary } from "@/types/scores";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * One-line, localized descriptor of a score (format · tracks · tempo · date),
 * shared by the Library list and the score viewer header.
 */
export function formatScoreMetaLine(
    summary: ScoreSummary,
    translate: Translate,
    language: string,
): string {
    return [
        summary.format.toUpperCase(),
        translate("scores.tracksLabel", { count: summary.trackCount }),
        summary.tempoBpm !== null
            ? translate("scores.tempoLabel", { bpm: summary.tempoBpm })
            : null,
        new Date(summary.addedAt).toLocaleDateString(language),
    ]
        .filter((part): part is string => part !== null)
        .join(" · ");
}

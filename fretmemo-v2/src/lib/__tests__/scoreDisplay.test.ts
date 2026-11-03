import { describe, expect, it } from "vitest";
import { formatScoreMetaLine } from "../scoreDisplay";
import type { ScoreSummary } from "@/types/scores";

const summary: ScoreSummary = {
    id: "s1",
    name: "song.gp5",
    addedAt: Date.UTC(2026, 0, 15),
    sizeBytes: 1024,
    format: "gp5",
    title: "Song",
    trackCount: 3,
    tempoBpm: 112,
};

const translate = (key: string, options?: Record<string, unknown>) => {
    const withCount = String(options?.count ?? options?.bpm ?? "");
    const plural =
        Number(options?.count) === 1
            ? "_one"
            : Number(options?.count) >= 2 && Number(options?.count) <= 4
              ? "_few"
              : Number(options?.count)
                ? "_other"
                : "";
    const table: Record<string, string> = {
        "scores.tracksLabel_one": "{{count}} track",
        "scores.tracksLabel_few": "{{count}} tracks",
        "scores.tracksLabel_other": "{{count}} tracks",
        "scores.tempoLabel": "{{bpm}} BPM",
    };
    const template = table[key + plural] ?? table[key] ?? key;
    return template.replace("{{count}}", withCount).replace("{{bpm}}", withCount);
};

describe("formatScoreMetaLine", () => {
    it("joins format, tracks, tempo and localized date", () => {
        const line = formatScoreMetaLine(summary, translate, "en");
        expect(line).toContain("GP5");
        expect(line).toContain("3 tracks");
        expect(line).toContain("112 BPM");
        expect(line.split(" · ")).toHaveLength(4);
    });

    it("omits tempo when the file has none", () => {
        const line = formatScoreMetaLine({ ...summary, tempoBpm: null }, translate, "en");
        expect(line).not.toContain("BPM");
        expect(line.split(" · ")).toHaveLength(3);
    });
});

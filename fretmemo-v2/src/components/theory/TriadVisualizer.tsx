import { useMemo, useState } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { normalizeTuning } from "@/lib/tuning";
import { getNoteAt, NOTES } from "@/lib/constants";
import { formatPitchClass, type NoteDisplayMode } from "@/lib/noteNotation";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { Select } from "@/components/ui/select";
import type { NoteStatus, NoteName } from "@/types/fretboard";
import { useTranslation } from "react-i18next";

/* ── constants ── */

const ROOTS = NOTES;

const QUALITIES = [
    { id: "major", labelKey: "theory.triads.qualityMajor", intervals: [0, 4, 7] },
    { id: "minor", labelKey: "theory.triads.qualityMinor", intervals: [0, 3, 7] },
] as const;

const TONE_LABELS = ["R", "3", "5"];
const TONE_LABELS_MINOR = ["R", "♭3", "5"];

type StringGroup = { id: "top" | "middle" | "bottom"; label: string; strings: [number, number, number] };
type StringGroupId = StringGroup["id"];
type StringGroupLabels = Record<StringGroupId, string>;

/** Fixed guitar triad groups, returned as lowest→highest pitch indices. */
function buildStringGroups(
    tuning: NoteName[],
    notation: NoteDisplayMode,
    groupLabels: StringGroupLabels,
): StringGroup[] {
    const groups: StringGroup[] = [];
    const defs: Array<{ id: StringGroupId; strings: [number, number, number] }> = [
        { id: "top", strings: [2, 1, 0] },
        { id: "middle", strings: [3, 2, 1] },
        { id: "bottom", strings: [4, 3, 2] },
    ];

    for (const def of defs) {
        if (def.strings.some((stringIdx) => stringIdx >= tuning.length)) continue;
        const [low, mid, high] = def.strings;
        groups.push({
            id: def.id,
            label: `${groupLabels[def.id]} (${formatPitchClass(tuning[low], notation)}-${formatPitchClass(tuning[mid], notation)}-${formatPitchClass(tuning[high], notation)})`,
            strings: def.strings,
        });
    }

    return groups;
}

const INVERSION_NAMES = ["theory.triads.invRoot", "theory.triads.invFirst", "theory.triads.invSecond"];
const INVERSION_COLORS = ["#ef4444", "#3b82f6", "#22c55e"]; // red, blue, green

/**
 * For a given root, quality, and string group, compute all playable
 * triad shapes (3 inversions × octave repeats) up to maxFret.
 */
function computeShapes(
    rootIdx: number,
    intervals: readonly number[],
    strings: [number, number, number], // lowest→highest pitch
    tuning: NoteName[],
    maxFret: number,
) {
    // Inversions: which chord-tone index sits on each string (lo, mid, hi)
    const inversions = [
        [0, 1, 2], // root position: R-3-5 (bottom to top)
        [1, 2, 0], // 1st inversion: 3-5-R
        [2, 0, 1], // 2nd inversion: 5-R-3
    ];

    const shapes: {
        inversion: number;
        frets: [number, number, number];
        tones: [number, number, number];
    }[] = [];

    const seen = new Set<string>();

    for (let inv = 0; inv < 3; inv++) {
        const tones = inversions[inv];

        // Base fret (0–11) for each string
        const baseFrets = strings.map((s, i) => {
            const openIdx = NOTES.indexOf(tuning[s]);
            const targetIdx = (rootIdx + intervals[tones[i]]) % 12;
            return (targetIdx - openIdx + 12) % 12;
        });

        // Try all octave combos (add 0 or 12 to each) — 8 combos
        for (let mask = 0; mask < 8; mask++) {
            const frets = baseFrets.map((bf, i) =>
                bf + ((mask >> i) & 1) * 12,
            ) as [number, number, number];

            if (frets.some(f => f < 0 || f > maxFret)) continue;

            const span = Math.max(...frets) - Math.min(...frets);
            if (span > 5) continue;

            const key = `${inv}-${frets.join(",")}`;
            if (seen.has(key)) continue;
            seen.add(key);

            shapes.push({
                inversion: inv,
                frets,
                tones: tones as [number, number, number],
            });
        }
    }

    return shapes;
}

/* ── component ── */

export default function TriadVisualizer() {
    const { t } = useTranslation();
    const [root, setRoot] = useState<NoteName>("C");
    const [qualityIdx, setQualityIdx] = useState(0);
    const quality = QUALITIES[qualityIdx];
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const notation = useSettingsStore((state) => state.full.instrument.notation);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);
    const maxFret = 15;

    const stringGroupLabels = useMemo<StringGroupLabels>(() => ({
        top: t("theory.triads.groupTop"),
        middle: t("theory.triads.groupMiddle"),
        bottom: t("theory.triads.groupBottom"),
    }), [t]);
    const stringGroups = useMemo(
        () => buildStringGroups(tuning, notation, stringGroupLabels),
        [tuning, notation, stringGroupLabels],
    );
    const [activeGroupIds, setActiveGroupIds] = useState<Set<string>>(
        () => new Set(["top", "middle", "bottom"]),
    );
    const [activeInversions, setActiveInversions] = useState<Set<number>>(
        new Set([0, 1, 2]),
    );

    const rootIdx = NOTES.indexOf(root);
    const toneLabels = quality.id === "minor" ? TONE_LABELS_MINOR : TONE_LABELS;

    const activeNotes: NoteStatus[] = useMemo(() => {
        const result: NoteStatus[] = [];

        for (const group of stringGroups) {
            if (!activeGroupIds.has(group.id)) continue;

            const shapes = computeShapes(
                rootIdx, quality.intervals,
                group.strings, tuning, maxFret,
            );

            for (const shape of shapes) {
                if (!activeInversions.has(shape.inversion)) continue;

                for (let i = 0; i < 3; i++) {
                    const s = group.strings[i];
                    const f = shape.frets[i];
                    const note = getNoteAt(tuning[s], f);
                    const toneIdx = shape.tones[i];

                    result.push({
                        position: { stringIndex: s, fret: f, note },
                        status: "active",
                        label: toneLabels[toneIdx],
                        color: INVERSION_COLORS[shape.inversion],
                        emphasis: toneIdx === 0 ? "strong" : "normal",
                    });
                }
            }
        }

        return result;
    }, [stringGroups, activeGroupIds, rootIdx, quality, tuning, maxFret, activeInversions, toneLabels]);

    const toggleGroup = (id: string) =>
        setActiveGroupIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const toggleInversion = (inv: number) =>
        setActiveInversions(prev => {
            const next = new Set(prev);
            if (next.has(inv) && next.size > 1) next.delete(inv);
            else next.add(inv);
            return next;
        });

    return (
        <div className="space-y-5">
            {stringGroups.length === 0 && (
                <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    {t("theory.triads.needsFiveStrings")}
                </div>
            )}

            {/* ── Controls ── */}
            <div className="flex flex-wrap items-end gap-3">
                {/* Root */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("theory.triads.root")}</label>
                    <Select
                        value={root}
                        onChange={e => setRoot(e.target.value as NoteName)}
                        className="w-20 rounded-lg py-2 font-bold"
                    >
                        {ROOTS.map(r => <option key={r} value={r}>{formatPitchClass(r, notation)}</option>)}
                    </Select>
                </div>

                {/* Quality */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("theory.triads.quality")}</label>
                    <div className="flex gap-1.5">
                        {QUALITIES.map((q, i) => (
                            <button
                                key={q.id}
                                onClick={() => setQualityIdx(i)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${qualityIdx === i
                                        ? "bg-primary/10 border-primary text-primary"
                                        : "bg-card border-border text-muted-foreground"
                                    }`}
                            >
                                {t(q.labelKey)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── String groups ── */}
            <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("theory.triads.stringGroups")}</label>
                <div className="flex flex-wrap gap-1.5">
                    {stringGroups.map(g => (
                        <button
                            key={g.id}
                            onClick={() => toggleGroup(g.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${activeGroupIds.has(g.id)
                                    ? "bg-primary/10 border-primary text-primary"
                                    : "bg-card border-border text-muted-foreground opacity-50"
                                }`}
                        >
                            {g.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Inversions ── */}
            <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("theory.triads.inversions")}</label>
                <div className="flex flex-wrap gap-1.5">
                    {INVERSION_NAMES.map((name, i) => (
                        <button
                            key={name}
                            onClick={() => toggleInversion(i)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${activeInversions.has(i)
                                    ? "border-transparent text-white"
                                    : "bg-card border-border text-muted-foreground opacity-50"
                                }`}
                            style={activeInversions.has(i) ? { backgroundColor: INVERSION_COLORS[i] } : undefined}
                        >
                            {t(name)}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Fretboard ── */}
            <Fretboard
                tuning={tuning}
                frets={maxFret}
                activeNotes={activeNotes}
                showFretNumbers
            />

            {/* ── Legend ── */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">{t("theory.triads.legendTitle")}</p>
                <p>{t("theory.triads.legendBody")}</p>
                <div className="flex flex-wrap gap-3 mt-1">
                    {INVERSION_NAMES.map((name, i) => (
                        <span key={name} className="inline-flex items-center gap-1.5 text-xs font-bold">
                            <span
                                className="w-3 h-3 rounded-full inline-block"
                                style={{ backgroundColor: INVERSION_COLORS[i] }}
                            />
                            {t(name)}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

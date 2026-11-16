import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ChordTimelineEntry } from "@/lib/chords";
import { songScales } from "@/lib/improv/chordScales";
import { localizeAnswer, localizeToken } from "@/lib/improv/display";

const UPCOMING_COUNT = 3;

interface ChordPrompterProps {
    /** Per-master-bar chord timeline from `buildChordTimeline`. */
    timeline: Array<ChordTimelineEntry | null> | null;
    /** Master-bar index under the playback cursor, or null before playback. */
    currentBar: number | null;
}

/**
 * Chord prompter strip: the chord under the playback cursor (large, announced
 * politely) with a scale to improvise over it (plan E4), plus the next few
 * chords. For chord-less songs it explains why there is no prompter.
 */
export function ChordPrompter({ timeline, currentBar }: ChordPrompterProps) {
    const { t } = useTranslation();

    const scales = useMemo(
        () => (timeline ? songScales(timeline.flatMap((entry) => (entry ? [entry.name] : []))) : null),
        [timeline],
    );

    const view = useMemo(() => {
        if (!timeline || currentBar === null || currentBar < 0) {
            return null;
        }
        const current = timeline[currentBar] ?? null;
        const upcoming: Array<{ name: string; bar: number }> = [];
        for (let bar = currentBar + 1; bar < timeline.length && upcoming.length < UPCOMING_COUNT; bar += 1) {
            const entry = timeline[bar];
            if (entry) {
                upcoming.push({ name: entry.name, bar });
            }
        }
        if (current === null && upcoming.length === 0) {
            return null;
        }
        return { current, upcoming };
    }, [timeline, currentBar]);

    if (timeline === null) {
        return <p className="text-xs text-muted-foreground">{t("scores.prompter.unavailable")}</p>;
    }
    if (view === null) {
        return null;
    }
    const scale = view.current ? scales?.scaleFor(view.current.name) : null;

    return (
        <div className="space-y-2 rounded-lg border border-border/50 p-3">
            {scales?.key && (
                <p className="text-xs text-muted-foreground">{t("scores.prompter.key", { key: localizeToken(scales.key) })}</p>
            )}
            <div className="flex items-end gap-3">
                <div className="min-w-20">
                    <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                        {t("scores.prompter.current")}
                    </p>
                    <p
                        role="status"
                        aria-label={t("scores.prompter.currentChordAria")}
                        className="text-3xl font-bold leading-tight"
                    >
                        {view.current ? view.current.name : "—"}
                    </p>
                    {scale && (
                        <p className="text-xs text-muted-foreground">
                            {t("scores.prompter.scale", { root: localizeToken(scale.root), mode: localizeAnswer(scale.mode) })}
                        </p>
                    )}
                </div>
                {view.upcoming.length > 0 && (
                    <div className="ml-auto flex items-end gap-2">
                        <p className="self-center pb-1 text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                            {t("scores.prompter.next")}
                        </p>
                        {view.upcoming.map((chord) => (
                            <div
                                key={chord.bar}
                                className="rounded-md border border-border/50 bg-card/60 px-2.5 py-1.5 text-center"
                            >
                                <p className="text-sm font-semibold">{chord.name}</p>
                                <p className="font-mono text-[10px] text-muted-foreground">
                                    {chord.bar + 1}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

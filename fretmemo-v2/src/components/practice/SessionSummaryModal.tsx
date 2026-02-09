import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MasteryBar } from "@/components/ui/mastery-bar";
import { useProgressStore } from "@/stores/useProgressStore";
import { ArrowUpRight, Coffee, HandHeart, RotateCcw, Trophy, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXTERNAL_LINKS } from "@/lib/externalLinks";

interface SessionSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRestart: () => void;
    onFocusWeakSpots: () => void;
    stats: {
        score: number;
        correct: number;
        incorrect: number;
        maxStreak: number;
        duration: number;
        previousAccuracy: number | null;
        isFirstSession: boolean;
        personalBest: boolean;
    } | null;
    xpEarned: number;
}

type SummaryState =
    | "first_session"
    | "zero_accuracy"
    | "low_accuracy"
    | "decent_but_down"
    | "improved"
    | "personal_best";

function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function SessionSummaryModal({
    isOpen,
    onClose,
    onRestart,
    onFocusWeakSpots,
    stats,
    xpEarned,
}: SessionSummaryModalProps) {
    const positionStats = useProgressStore((state) => state.positionStats);

    if (!stats) return null;

    const total = stats.correct + stats.incorrect;
    const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
    const delta = stats.previousAccuracy === null ? null : accuracy - stats.previousAccuracy;
    const displayXp = xpEarned > 0 ? xpEarned : 5;

    const weakestEntry = Object.entries(positionStats)
        .filter(([, entry]) => entry.total >= 3)
        .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))[0];

    const weakSpotText = weakestEntry
        ? (() => {
            const [key, entry] = weakestEntry;
            const [stringIndex, fret] = key.split("-").map(Number);
            const weakAccuracy = Math.round((entry.correct / entry.total) * 100);
            return `Focus string ${stringIndex + 1}, fret ${fret} (${weakAccuracy}% accuracy).`;
        })()
        : "Try a focused drill on one string range.";

    const summaryState: SummaryState = (() => {
        if (stats.isFirstSession) return "first_session";
        if (accuracy === 0) return "zero_accuracy";
        if (stats.personalBest) return "personal_best";
        if (delta !== null && delta >= 0) return "improved";
        if (accuracy < 50) return "low_accuracy";
        return "decent_but_down";
    })();

    const summaryMessage = (() => {
        if (summaryState === "first_session") {
            return "First session complete. Every note attempt builds your fretboard map.";
        }
        if (summaryState === "zero_accuracy") {
            return `You practiced for ${formatDuration(stats.duration)} and attempted ${total} notes. ${weakSpotText}`;
        }
        if (summaryState === "low_accuracy") {
            return `${stats.incorrect} notes to review this run. ${weakSpotText}`;
        }
        if (summaryState === "decent_but_down") {
            return "Slightly below your previous session. A focused follow-up should recover momentum.";
        }
        if (summaryState === "personal_best") {
            return "New personal best. Keep this pace and lock it in.";
        }
        return "Solid improvement from your previous session.";
    })();

    const supportMessage = (() => {
        if (summaryState === "personal_best") {
            return "Personal best energy. If FretMemo helped you get here, a coffee tip helps fund the next drill and polish pass. No pressure.";
        }
        if (summaryState === "first_session") {
            return "If this felt helpful, buying me a coffee helps me keep shipping drills, fixes, and articles. No pressure.";
        }
        return "If this session was helpful, buying me a coffee helps fund new drills, fixes, and polish. No pressure.";
    })();

    const statRows = [
        stats.correct > 0 ? { label: "Correct", value: `${stats.correct}` } : null,
        stats.incorrect > 0 ? { label: "Notes to review", value: `${stats.incorrect}` } : null,
        stats.maxStreak > 0 ? { label: "Best streak", value: `${stats.maxStreak}` } : null,
        stats.score > 0 ? { label: "Score", value: `${stats.score}` } : null,
        { label: "You practiced", value: formatDuration(stats.duration) },
        { label: "XP earned", value: `+${displayXp}` },
    ].filter((row): row is { label: string; value: string } => Boolean(row));

    const showCompactMessageOnly = summaryState === "first_session" || summaryState === "zero_accuracy";
    const showFocusPrimary = summaryState === "zero_accuracy" || summaryState === "low_accuracy";
    const showFocusAction = summaryState !== "first_session" && summaryState !== "personal_best";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-center gap-2 text-center">
                        <Trophy className="h-6 w-6 text-primary" />
                        Session Complete
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {!showCompactMessageOnly && (
                        <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Accuracy</div>
                            <div className="mt-1 text-4xl font-black text-foreground">{accuracy}%</div>
                            {delta !== null && (
                                <div
                                    className={cn(
                                        "mt-1 inline-flex items-center gap-1 text-sm font-medium",
                                        delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                    )}
                                >
                                    <ArrowUpRight className={cn("h-4 w-4", delta < 0 && "rotate-90")} />
                                    {delta >= 0 ? "+" : ""}{delta}% vs previous session
                                </div>
                            )}
                            <div className="mt-3">
                                <MasteryBar value={accuracy} showLabel={false} />
                            </div>
                            {summaryState === "personal_best" && (
                                <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">New personal best</p>
                            )}
                        </div>
                    )}

                    <div className="rounded-xl border border-border bg-card p-3 text-sm">
                        <div className="font-medium text-card-foreground">{summaryMessage}</div>
                        {showCompactMessageOnly && (
                            <div className="mt-2 text-muted-foreground">The fretboard has 72 positions. Short, focused reps compound quickly.</div>
                        )}
                        <div className="mt-2 text-xs font-medium text-muted-foreground">Participation bonus: +{displayXp} XP</div>

                        <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                            <div className="flex items-start gap-2">
                                <HandHeart className="mt-0.5 h-4 w-4 text-primary" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-card-foreground">Enjoying FretMemo?</div>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{supportMessage}</p>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <Button asChild className="control-btn--primary w-full sm:w-auto">
                                    <a href={EXTERNAL_LINKS.buyMeCoffee} target="_blank" rel="noreferrer noopener">
                                        <Coffee className="mr-2 h-4 w-4" />
                                        Buy me a coffee
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {!showCompactMessageOnly && (
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                            {statRows.map((row) => (
                                <SummaryLine key={row.label} label={row.label} value={row.value} />
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    {showFocusPrimary && showFocusAction && (
                        <Button
                            className="w-full sm:w-auto control-btn--primary"
                            variant="default"
                            onClick={onFocusWeakSpots}
                        >
                            <Wand2 className="mr-2 h-4 w-4" />
                            Focus Weak Spots
                        </Button>
                    )}
                    <Button
                        className={cn("w-full sm:w-auto", !showFocusPrimary && "control-btn--primary")}
                        variant={showFocusPrimary ? "outline" : "default"}
                        onClick={onRestart}
                    >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Practice Again
                    </Button>
                    {!showFocusPrimary && showFocusAction && (
                        <Button
                            className="w-full sm:w-auto"
                            variant="outline"
                            onClick={onFocusWeakSpots}
                        >
                            <Wand2 className="mr-2 h-4 w-4" />
                            Focus Weak Spots
                        </Button>
                    )}
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                        <X className="mr-2 h-4 w-4" />
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono font-semibold text-foreground">{value}</span>
        </div>
    );
}

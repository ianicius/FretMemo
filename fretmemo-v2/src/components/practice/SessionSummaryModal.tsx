import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MasteryBar } from "@/components/ui/mastery-bar";
import { useProgressStore } from "@/stores/useProgressStore";
import { ArrowUpRight, Coffee, HandHeart, RotateCcw, Trophy, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXTERNAL_LINKS } from "@/lib/externalLinks";
import { useTranslation } from "react-i18next";

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
    const { t } = useTranslation();
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
            return t("practice.sessionSummary.weakSpot", {
                string: stringIndex + 1,
                fret,
                accuracy: weakAccuracy,
            });
        })()
        : t("practice.sessionSummary.weakSpotFallback");

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
            return t("practice.sessionSummary.summary.firstSession");
        }
        if (summaryState === "zero_accuracy") {
            return t("practice.sessionSummary.summary.zeroAccuracy", {
                duration: formatDuration(stats.duration),
                total,
                weakSpot: weakSpotText,
            });
        }
        if (summaryState === "low_accuracy") {
            return t("practice.sessionSummary.summary.lowAccuracy", {
                incorrect: stats.incorrect,
                weakSpot: weakSpotText,
            });
        }
        if (summaryState === "decent_but_down") {
            return t("practice.sessionSummary.summary.decentButDown");
        }
        if (summaryState === "personal_best") {
            return t("practice.sessionSummary.summary.personalBest");
        }
        return t("practice.sessionSummary.summary.improved");
    })();

    const supportMessage = (() => {
        if (summaryState === "personal_best") {
            return t("practice.sessionSummary.support.personalBest");
        }
        if (summaryState === "first_session") {
            return t("practice.sessionSummary.support.firstSession");
        }
        return t("practice.sessionSummary.support.default");
    })();

    const statRows = [
        stats.correct > 0 ? { label: t("practice.sessionSummary.stats.correct"), value: `${stats.correct}` } : null,
        stats.incorrect > 0 ? { label: t("practice.sessionSummary.stats.review"), value: `${stats.incorrect}` } : null,
        stats.maxStreak > 0 ? { label: t("practice.sessionSummary.stats.bestStreak"), value: `${stats.maxStreak}` } : null,
        stats.score > 0 ? { label: t("practice.sessionSummary.stats.score"), value: `${stats.score}` } : null,
        { label: t("practice.sessionSummary.stats.timePracticed"), value: formatDuration(stats.duration) },
        { label: t("practice.sessionSummary.stats.xpEarned"), value: `+${displayXp}` },
    ].filter((row): row is { label: string; value: string } => Boolean(row));

    const showCompactMessageOnly = summaryState === "first_session" || summaryState === "zero_accuracy";
    const showFocusPrimary = summaryState === "zero_accuracy" || summaryState === "low_accuracy";
    const showFocusAction = summaryState !== "first_session" && summaryState !== "personal_best";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="safe-area-bottom top-[max(0.5rem,env(safe-area-inset-top))] max-h-[calc(100dvh-1rem)] translate-y-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom),3.5rem)] sm:top-[50%] sm:max-w-xl sm:translate-y-[-50%] sm:pb-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-center gap-2 text-center">
                        <Trophy className="h-6 w-6 text-primary" />
                        {t("practice.sessionSummary.title")}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {!showCompactMessageOnly && (
                        <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("practice.sessionSummary.accuracy")}</div>
                            <div className="mt-1 text-4xl font-black text-foreground">{accuracy}%</div>
                            {delta !== null && (
                                <div
                                    className={cn(
                                        "mt-1 inline-flex items-center gap-1 text-sm font-medium",
                                        delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                    )}
                                >
                                    <ArrowUpRight className={cn("h-4 w-4", delta < 0 && "rotate-90")} />
                                    {t("practice.sessionSummary.deltaVsPrevious", {
                                        delta: `${delta >= 0 ? "+" : ""}${delta}`,
                                    })}
                                </div>
                            )}
                            <div className="mt-3">
                                <MasteryBar value={accuracy} showLabel={false} />
                            </div>
                            {summaryState === "personal_best" && (
                                <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                    {t("practice.sessionSummary.personalBest")}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="rounded-xl border border-border bg-card p-3 text-sm">
                        <div className="font-medium text-card-foreground">{summaryMessage}</div>
                        {showCompactMessageOnly && (
                            <div className="mt-2 text-muted-foreground">{t("practice.sessionSummary.compactHint")}</div>
                        )}
                        <div className="mt-2 text-xs font-medium text-muted-foreground">
                            {t("practice.sessionSummary.participationBonus", { xp: displayXp })}
                        </div>

                        <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                            <div className="flex items-start gap-2">
                                <HandHeart className="mt-0.5 h-4 w-4 text-primary" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-card-foreground">
                                        {t("practice.sessionSummary.supportTitle")}
                                    </div>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{supportMessage}</p>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <Button asChild className="control-btn--primary w-full sm:w-auto">
                                    <a href={EXTERNAL_LINKS.buyMeCoffee} target="_blank" rel="noreferrer noopener">
                                        <Coffee className="mr-2 h-4 w-4" />
                                        {t("practice.sessionSummary.buyCoffee")}
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
                            {t("practice.sessionSummary.focusWeakSpots")}
                        </Button>
                    )}
                    <Button
                        className={cn("w-full sm:w-auto", !showFocusPrimary && "control-btn--primary")}
                        variant={showFocusPrimary ? "outline" : "default"}
                        onClick={onRestart}
                    >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {t("practice.sessionSummary.practiceAgain")}
                    </Button>
                    {!showFocusPrimary && showFocusAction && (
                        <Button
                            className="w-full sm:w-auto"
                            variant="outline"
                            onClick={onFocusWeakSpots}
                        >
                            <Wand2 className="mr-2 h-4 w-4" />
                            {t("practice.sessionSummary.focusWeakSpots")}
                        </Button>
                    )}
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                        <X className="mr-2 h-4 w-4" />
                        {t("practice.sessionSummary.done")}
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

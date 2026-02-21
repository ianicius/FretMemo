import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pause, Play, Square, Timer, Target, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FocusModeHUDProps {
    isPlaying: boolean;
    score: number;
    streak: number;
    correct: number;
    incorrect: number;
    bpm: number;
    modeLabel: string;
    sessionStartTime: number | null;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    isPaused?: boolean;
    progressCurrent?: number;
    progressTarget?: number;
    onHeightChange?: (height: number) => void;
    showTempo?: boolean;
    isLandscape?: boolean;
}

export function FocusModeHUD({
    isPlaying,
    score,
    streak,
    correct,
    incorrect,
    bpm,
    modeLabel,
    sessionStartTime,
    onPause,
    onResume,
    onStop,
    isPaused = false,
    progressCurrent,
    progressTarget,
    onHeightChange,
    showTempo = true,
    isLandscape = false,
}: FocusModeHUDProps) {
    const { t } = useTranslation();
    const [elapsedTime, setElapsedTime] = useState(0);
    const hudRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isPlaying || !sessionStartTime || isPaused) {
            return;
        }

        const interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - sessionStartTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [isPlaying, sessionStartTime, isPaused]);

    useEffect(() => {
        if (!onHeightChange) return;
        const node = hudRef.current;
        if (!node) return;

        const reportHeight = () => {
            const height = Math.ceil(node.getBoundingClientRect().height);
            onHeightChange(height);
        };

        reportHeight();

        if (typeof ResizeObserver === "undefined") {
            window.requestAnimationFrame(reportHeight);
            return;
        }

        const observer = new ResizeObserver(reportHeight);
        observer.observe(node);
        return () => observer.disconnect();
    }, [onHeightChange]);

    const total = correct + incorrect;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const progressValue = progressTarget && progressTarget > 0
        ? Math.min(100, Math.round(((progressCurrent ?? total) / progressTarget) * 100))
        : null;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    if (isPaused) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="w-full max-w-sm space-y-5 rounded-xl border border-border/60 bg-card/95 p-6 text-center shadow-xl">
                    <div className="space-y-1">
                        <p className="text-lg font-semibold">{t("practice.focusHud.sessionPausedTitle")}</p>
                        <p className="text-sm text-muted-foreground">{t("practice.focusHud.sessionPausedDescription")}</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        <Button size="sm" onClick={onResume} className="control-btn--primary">
                            <Play className="mr-2 h-4 w-4" />
                            {t("practice.focusHud.resume")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={onStop} className="border-destructive text-destructive hover:bg-destructive/10">
                            <Square className="mr-2 h-4 w-4 fill-current" />
                            {t("practice.focusHud.endSession")}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Landscape compact: single-line inline HUD
    if (isLandscape) {
        return (
            <div ref={hudRef} className="fixed left-0 right-0 top-0 z-50 px-2 py-1">
                <div className="mx-auto max-w-none">
                    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/90 px-2 py-1 shadow-sm backdrop-blur-md">
                        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            {modeLabel}
                        </p>
                        <div className="flex items-center gap-1 text-xs">
                            <Timer className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono font-medium">{formatTime(elapsedTime)}</span>
                        </div>
                        <div
                            className={cn(
                                "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                                accuracy >= 75 && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                                accuracy >= 50 && accuracy < 75 && "border-amber-500/40 bg-amber-500/10 text-amber-300",
                                accuracy < 50 && "border-rose-500/40 bg-rose-500/10 text-rose-400"
                            )}
                        >
                            {accuracy}%
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Target className="h-3 w-3" />
                            <span className="font-mono">{correct}/{total}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Zap className="h-3 w-3" />
                            <span className="font-mono">{streak}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                            {t("practice.focusHud.score")} <span className="font-mono font-semibold text-foreground">{score}</span>
                        </span>
                        {progressValue !== null && (
                            <div className="flex-1 mx-1">
                                <div className="h-1 overflow-hidden rounded-full bg-muted/50">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all duration-300"
                                        style={{ width: `${progressValue}%` }}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onPause}>
                                <Pause className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={onStop}
                            >
                                <Square className="h-3 w-3 fill-current" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Portrait / desktop: standard HUD
    return (
        <div ref={hudRef} className="fixed left-0 right-0 top-0 z-50 px-4 py-3">
            <div className="mx-auto max-w-3xl">
                <div className="space-y-2 rounded-xl border border-border/60 bg-card/92 px-3 py-2 shadow-md backdrop-blur-md">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {modeLabel}
                            </p>
                            <div className="flex items-center gap-1.5 text-sm">
                                <Timer className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono font-medium">{formatTime(elapsedTime)}</span>
                                {showTempo ? (
                                    <span className="ml-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                                        {bpm} BPM
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <div
                                className={cn(
                                    "rounded-full border px-2 py-0.5 text-xs font-semibold",
                                    accuracy >= 75 && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                                    accuracy >= 50 && accuracy < 75 && "border-amber-500/40 bg-amber-500/10 text-amber-300",
                                    accuracy < 50 && "border-rose-500/40 bg-rose-500/10 text-rose-400"
                                )}
                            >
                                {accuracy}%
                            </div>
                            <div className="hidden items-center gap-1 rounded-full border border-border/50 bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground sm:flex">
                                <Target className="h-3.5 w-3.5" />
                                <span className="font-mono">{correct}/{total}</span>
                            </div>
                            <div className="hidden items-center gap-1 rounded-full border border-border/50 bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground md:flex">
                                <Zap className="h-3.5 w-3.5" />
                                <span className="font-mono">{streak}</span>
                            </div>
                            <div className="hidden items-center gap-1 rounded-full border border-border/50 bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground md:flex">
                                <span>{t("practice.focusHud.score")}</span>
                                <span className="font-mono font-semibold text-foreground">{score}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPause}>
                                <Pause className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={onStop}
                            >
                                <Square className="h-4 w-4 fill-current" />
                            </Button>
                        </div>
                    </div>
                    {progressValue !== null ? (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{t("practice.focusHud.sessionProgress")}</span>
                                <span className="font-mono">{progressCurrent ?? total}/{progressTarget}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
                                <div
                                    className="h-full rounded-full bg-primary transition-all duration-300"
                                    style={{ width: `${progressValue}%` }}
                                />
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

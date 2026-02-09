import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pause, Play, Square, Timer, Target, Zap } from "lucide-react";

interface FocusModeHUDProps {
    isPlaying: boolean;
    score: number;
    streak: number;
    correct: number;
    incorrect: number;
    bpm: number;
    noteDuration: number;
    modeLabel: string;
    sessionStartTime: number | null;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    isPaused?: boolean;
    progressCurrent?: number;
    progressTarget?: number;
    onHeightChange?: (height: number) => void;
}

export function FocusModeHUD({
    isPlaying,
    score,
    streak,
    correct,
    incorrect,
    bpm,
    noteDuration,
    modeLabel,
    sessionStartTime,
    onPause,
    onResume,
    onStop,
    isPaused = false,
    progressCurrent,
    progressTarget,
    onHeightChange,
}: FocusModeHUDProps) {
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

    // Pause overlay
    if (isPaused) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="text-center space-y-6">
                    <div className="text-6xl font-black text-muted-foreground/50">PAUSED</div>
                    <div className="flex gap-4 justify-center">
                        <Button size="lg" onClick={onResume} className="control-btn--primary">
                            <Play className="w-5 h-5 mr-2" />
                            Resume
                        </Button>
                        <Button size="lg" variant="outline" onClick={onStop} className="border-destructive text-destructive hover:bg-destructive/10">
                            <Square className="w-5 h-5 mr-2 fill-current" />
                            End Session
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Top Floating Bar */}
            <div ref={hudRef} className="fixed top-0 left-0 right-0 z-50 px-4 py-3">
                <div className="max-w-3xl mx-auto">
                    <div className="space-y-2 rounded-2xl border border-border/50 bg-card/90 px-4 py-2 shadow-lg backdrop-blur-md">
                        <div className="flex items-center justify-between gap-2">
                        {/* Left: Mode & Time */}
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:block text-xs font-medium text-muted-foreground">
                                {modeLabel}
                            </div>
                            <div className="h-4 w-px bg-border hidden sm:block" />
                            <div className="flex items-center gap-1.5 text-sm">
                                <Timer className="w-4 h-4 text-muted-foreground" />
                                <span className="font-mono font-medium">{formatTime(elapsedTime)}</span>
                            </div>
                        </div>

                        {/* Center: Stats */}
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">Score</span>
                                <span className="text-sm font-bold">{score}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Target className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm font-bold">{correct}</span>
                                <span className="text-xs text-muted-foreground">/</span>
                                <span className="text-sm text-muted-foreground">{total}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className={cn(
                                    "text-xs font-bold",
                                    accuracy >= 75 ? "text-emerald-500" :
                                        accuracy >= 50 ? "text-amber-500" : "text-rose-500"
                                )}>
                                    {accuracy}%
                                </span>
                            </div>
                        </div>

                        {/* Right: Controls */}
                        <div className="flex items-center gap-2">
                            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                                <Zap className="w-3.5 h-3.5" />
                                <span>{streak}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={onPause}
                            >
                                <Pause className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={onStop}
                            >
                                <Square className="w-4 h-4 fill-current" />
                            </Button>
                        </div>
                    </div>
                        {progressValue !== null && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>Session progress</span>
                                    <span className="font-mono">{progressCurrent ?? total}/{progressTarget}</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all duration-300"
                                        style={{ width: `${progressValue}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Metronome Bar (if BPM is set) */}
            <div className="fixed bottom-4 left-0 right-0 z-50 px-4">
                <div className="max-w-md mx-auto">
                    <div className="flex items-center justify-center gap-3 bg-card/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-0.5">
                                {[...Array(8)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "w-1 h-4 rounded-full transition-all duration-150",
                                            i % 4 === 0 ? "bg-primary" : "bg-primary/40"
                                        )}
                                        style={{
                                            animation: isPlaying ? `pulse ${60 / bpm}s ease-in-out infinite` : "none",
                                            animationDelay: `${i * (60 / bpm / 8)}s`
                                        }}
                                    />
                                ))}
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                                {bpm} BPM • {noteDuration} beat{noteDuration > 1 ? "s" : ""}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS for pulse animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; transform: scaleY(0.8); }
                    50% { opacity: 1; transform: scaleY(1); }
                }
            `}</style>
        </>
    );
}

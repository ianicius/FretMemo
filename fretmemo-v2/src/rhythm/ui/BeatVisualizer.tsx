import { cn } from "@/lib/utils";

interface BeatVisualizerProps {
    beatsPerBar: number;
    currentBeat: number | null;
    isRunning: boolean;
}

export function BeatVisualizer({ beatsPerBar, currentBeat, isRunning }: BeatVisualizerProps) {
    return (
        <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
                {Array.from({ length: beatsPerBar }, (_, index) => {
                    const isActive = currentBeat === index;
                    const isBarStart = index === 0;
                    return (
                        <div
                            key={`beat-${index}`}
                            className={cn(
                                "flex h-11 flex-1 items-center justify-center rounded-lg border text-sm font-bold transition",
                                isBarStart
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "border-border bg-muted/20 text-muted-foreground",
                                isRunning && isActive && "scale-105 border-amber-500 bg-amber-500/20 text-amber-700 dark:text-amber-300",
                            )}
                        >
                            {index + 1}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


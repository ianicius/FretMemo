import { cn } from "@/lib/utils";
import type { StrumStepSymbol } from "@/rhythm/data/strumPatterns";

interface PatternGridProps {
    slots: StrumStepSymbol[];
    playheadStep: number | null;
}

function slotClass(symbol: StrumStepSymbol): string {
    if (symbol === "D") return "border-amber-500/50 bg-amber-500/20 text-amber-700 dark:text-amber-300";
    if (symbol === "U") return "border-orange-500/50 bg-orange-500/20 text-orange-700 dark:text-orange-300";
    if (symbol === "M") return "border-slate-500/50 bg-slate-500/20 text-slate-700 dark:text-slate-300";
    return "border-border bg-muted/20 text-muted-foreground";
}

function slotLabel(symbol: StrumStepSymbol): string {
    if (symbol === "D") return "D↓";
    if (symbol === "U") return "U↑";
    if (symbol === "M") return "✕";
    return "·";
}

export function PatternGrid({ slots, playheadStep }: PatternGridProps) {
    const columns = slots.length <= 8 ? "grid-cols-8" : "grid-cols-8 sm:grid-cols-16";

    return (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Pattern Grid</p>
            <div className={cn("grid gap-1", columns)}>
                {slots.map((symbol, index) => {
                    const isActive = playheadStep === index;
                    return (
                        <div
                            key={`slot-${index}`}
                            className={cn(
                                "h-10 rounded-md border text-[11px] font-bold flex items-center justify-center transition",
                                slotClass(symbol),
                                isActive && "ring-2 ring-primary scale-105",
                            )}
                        >
                            {slotLabel(symbol)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


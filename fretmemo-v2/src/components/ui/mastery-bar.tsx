import { cn } from "@/lib/utils";

interface MasteryBarProps {
    value: number;
    className?: string;
    showLabel?: boolean;
}

function clamp(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function getToneClass(value: number): string {
    if (value >= 85) return "bg-emerald-500";
    if (value >= 40) return "bg-amber-400";
    if (value > 0) return "bg-rose-400";
    return "bg-muted-foreground/35";
}

export function MasteryBar({ value, className, showLabel = true }: MasteryBarProps) {
    const safeValue = clamp(value);

    return (
        <div className={cn("space-y-1", className)}>
            <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Mastery progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={safeValue}
                aria-valuetext={showLabel ? `${safeValue}% mastery` : `${safeValue}%`}
            >
                <div
                    className={cn("h-full rounded-full transition-all duration-500", getToneClass(safeValue))}
                    style={{ width: `${safeValue}%` }}
                />
            </div>
            {showLabel && (
                <div className="text-xs font-medium text-muted-foreground">{safeValue}% mastery</div>
            )}
        </div>
    );
}

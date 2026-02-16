import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LatencyCompensationControlProps {
    value: number;
    onChange: (nextMs: number) => void;
    className?: string;
}

function clampLatency(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(250, Math.round(value)));
}

export function LatencyCompensationControl({
    value,
    onChange,
    className,
}: LatencyCompensationControlProps) {
    const safeValue = clampLatency(value);

    return (
        <div className={cn("space-y-2 rounded-md border border-border bg-muted/20 p-3", className)}>
            <div className="flex items-center justify-between">
                <Label htmlFor="rhythm-latency-range">Input Latency Compensation</Label>
                <span className="text-xs font-semibold text-foreground">{safeValue} ms</span>
            </div>
            <input
                id="rhythm-latency-range"
                type="range"
                min={0}
                max={250}
                step={5}
                value={safeValue}
                onChange={(event) => onChange(clampLatency(Number(event.target.value)))}
                className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">
                Increase this if your taps are consistently marked late despite feeling on-beat.
            </p>
        </div>
    );
}

export default LatencyCompensationControl;

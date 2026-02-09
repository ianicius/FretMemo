import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface AccuracyChartPoint {
    date: string;
    accuracy: number;
    total: number;
}

interface AccuracyChartProps {
    data?: AccuracyChartPoint[];
    className?: string;
}

export function AccuracyChart({ data, className }: AccuracyChartProps) {
    const gradientId = useId().replace(/:/g, "");
    const chartData = useMemo(() => {
        if (!data) return [];
        return data
            .filter((point) => Number.isFinite(point.accuracy) && Number.isFinite(point.total))
            .map((point) => ({
                ...point,
                accuracy: Math.max(0, Math.min(100, Math.round(point.accuracy))),
                total: Math.max(0, Math.round(point.total)),
            }));
    }, [data]);

    if (chartData.length === 0) {
        const previewPoints = [58, 66, 63, 71, 77].map((accuracy, index) => ({
            x: 12 + index * 18,
            y: 44 - (accuracy / 100) * 30,
        }));
        const previewPath = previewPoints.reduce((path, point, index) => {
            if (index === 0) return `M ${point.x} ${point.y}`;
            return `${path} L ${point.x} ${point.y}`;
        }, "");

        return (
            <div className={cn("rounded-xl border border-dashed border-border p-5", className)}>
                <div className="relative h-28 rounded-lg bg-muted/30 p-3">
                    <svg viewBox="0 0 100 50" className="h-full w-full" preserveAspectRatio="none">
                        <path
                            d={`${previewPath} L 84 46 L 12 46 Z`}
                            fill="hsl(var(--primary))"
                            opacity="0.08"
                        />
                        <path
                            d={previewPath}
                            fill="none"
                            stroke="hsl(var(--primary))"
                            strokeWidth="1.5"
                            strokeDasharray="2 2"
                            opacity="0.45"
                        />
                        {previewPoints.map((point, index) => (
                            <circle key={index} cx={point.x} cy={point.y} r="1.4" fill="hsl(var(--primary))" opacity="0.45" />
                        ))}
                    </svg>
                </div>
                <div className="mt-3 text-sm font-medium">Your accuracy trend appears here after 3+ sessions</div>
                <div className="mt-1 text-xs text-muted-foreground">
                    Keep practicing consistently to unlock real progress insights.
                </div>
            </div>
        );
    }

    const maxAccuracy = Math.max(...chartData.map(d => d.accuracy));
    const minAccuracy = Math.min(...chartData.map(d => d.accuracy));
    const avgAccuracy = Math.round(chartData.reduce((sum, d) => sum + d.accuracy, 0) / chartData.length);

    // Calculate trend
    let trend: "up" | "down" | "flat" = "flat";
    if (chartData.length > 1) {
        const first = chartData[0].accuracy;
        const last = chartData[chartData.length - 1].accuracy;
        if (last - first > 2) trend = "up";
        else if (first - last > 2) trend = "down";
    }

    // Create SVG path for smooth line
    const width = 100;
    const height = 50;
    const padding = 5;

    const points = chartData.map((d, i) => {
        const x = chartData.length === 1
            ? width / 2
            : (i / (chartData.length - 1)) * (width - padding * 2) + padding;
        const y = height - padding - ((d.accuracy / 100) * (height - padding * 2));
        return { x, y, accuracy: d.accuracy };
    });

    const pathD = points.reduce((path, point, i) => {
        if (i === 0) return `M ${point.x} ${point.y}`;
        const prev = points[i - 1];
        const cp1x = prev.x + (point.x - prev.x) / 3;
        const cp1y = prev.y;
        const cp2x = prev.x + (2 * (point.x - prev.x)) / 3;
        const cp2y = point.y;
        return `${path} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
    }, "");

    const areaD = points.length > 1
        ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
        : "";
    const labelStride = chartData.length > 8 ? Math.ceil(chartData.length / 8) : 1;

    return (
        <div className={cn("space-y-4", className)}>
            {/* Stats Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="text-2xl font-bold">{avgAccuracy}%</div>
                        <div className="text-xs text-muted-foreground">Average accuracy</div>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                        {trend === "up" ? (
                            <>
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                <span className="text-emerald-500 font-medium">Improving</span>
                            </>
                        ) : trend === "down" ? (
                            <>
                                <TrendingDown className="w-4 h-4 text-rose-500" />
                                <span className="text-rose-500 font-medium">Declining</span>
                            </>
                        ) : (
                            <>
                                <Minus className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground font-medium">Stable</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                    <div>High: {maxAccuracy}%</div>
                    <div>Low: {minAccuracy}%</div>
                </div>
            </div>

            {/* Chart */}
            <div className="relative h-32 bg-muted/30 rounded-xl p-4 overflow-hidden">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full"
                    preserveAspectRatio="none"
                >
                    {/* Gradient definition */}
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
                        </linearGradient>
                    </defs>

                    {/* Area fill */}
                    {points.length > 1 && (
                        <path
                            d={areaD}
                            fill={`url(#${gradientId})`}
                        />
                    )}

                    {/* Line */}
                    {points.length > 1 && (
                        <path
                            d={pathD}
                            fill="none"
                            stroke="hsl(var(--primary))"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                    )}

                    {/* Data points */}
                    {points.map((point, i) => (
                        <circle
                            key={i}
                            cx={point.x}
                            cy={point.y}
                            r="1.5"
                            fill="hsl(var(--primary))"
                            className="hover:r-3 transition-all"
                        />
                    ))}
                </svg>

                {/* Y-axis labels */}
                <div className="absolute left-2 top-2 bottom-8 flex flex-col justify-between text-[10px] text-muted-foreground">
                    <span>100%</span>
                    <span>50%</span>
                    <span>0%</span>
                </div>
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between px-4 text-xs text-muted-foreground">
                {chartData.map((d, i) => (
                    <span
                        key={i}
                        className={(i % labelStride === 0 || i === chartData.length - 1) ? "" : "invisible"}
                    >
                        {d.date}
                    </span>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 rounded-full bg-primary" />
                    <span>Accuracy trend</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-primary/20" />
                    <span>Confidence zone</span>
                </div>
            </div>
        </div>
    );
}

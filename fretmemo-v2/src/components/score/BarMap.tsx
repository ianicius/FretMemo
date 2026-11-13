import { useTranslation } from "react-i18next";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface BarMapProps {
    /** Hit ratio per bar (null = never attempted). */
    ratios: Array<number | null>;
    onLoopWeak: () => void;
    onReset?: () => void;
}

function ratioClass(ratio: number | null): string {
    if (ratio === null) return "bg-muted/60 text-muted-foreground";
    if (ratio >= 0.8) return "bg-emerald-500/80 text-emerald-950";
    if (ratio >= 0.5) return "bg-amber-500/80 text-amber-950";
    return "bg-rose-500/80 text-rose-950";
}

/**
 * Per-bar accuracy strip (R-08 extension): one cell per bar colored by the
 * mic-scored hit ratio, with a one-click "loop weak bars" action.
 */
export function BarMap({ ratios, onLoopWeak, onReset }: BarMapProps) {
    const { t } = useTranslation();
    const hasData = ratios.some((ratio) => ratio !== null);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">
                    {t("scores.playback.barAccuracy")}
                </Label>
                {onReset && hasData && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={onReset}
                        aria-label={t("scores.playback.resetBars")}
                    >
                        {t("scores.playback.resetBars")}
                    </Button>
                )}
                <div className="ml-auto">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!hasData}
                        onClick={onLoopWeak}
                    >
                        <Target className="h-4 w-4" />
                        {t("scores.playback.loopWeak")}
                    </Button>
                </div>
            </div>
            <div className="flex flex-wrap gap-1" aria-hidden="true">
                {ratios.map((ratio, index) => (
                    <div
                        key={index}
                        data-testid="bar-map-cell"
                        data-ratio={ratio === null ? "none" : Math.round(ratio * 100)}
                        title={
                            ratio === null
                                ? t("scores.playback.barNoData", { n: index + 1 })
                                : t("scores.playback.barRatio", {
                                      n: index + 1,
                                      percent: Math.round(ratio * 100),
                                  })
                        }
                        className={cn(
                            "flex h-7 min-w-9 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-bold",
                            ratioClass(ratio),
                        )}
                    >
                        {index + 1}
                    </div>
                ))}
            </div>
        </div>
    );
}

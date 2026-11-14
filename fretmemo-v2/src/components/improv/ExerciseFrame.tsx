/**
 * Shared frame + helpers for the improv exercise engines
 * (run improv-training-2026-11-13). Every engine renders inside
 * `ExerciseFrame` so the module view keeps one consistent layout:
 * name + description, engine badge, pass-threshold badge and the
 * "passed" check once the threshold is met in the store.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ENGINE_LABEL_KEYS } from "@/lib/improv/display";
import type { ImprovEngineType } from "@/data/improv/curriculum";

interface ExerciseFrameProps {
    engine: ImprovEngineType;
    name: string;
    description: string;
    thresholdLabel: string;
    passed: boolean;
    children: ReactNode;
}

export function ExerciseFrame({ engine, name, description, thresholdLabel, passed, children }: ExerciseFrameProps) {
    const { t } = useTranslation();


    return (
        <Card className={cn(passed && "border-emerald-500/40")}>
            <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        {t(ENGINE_LABEL_KEYS[engine])}
                    </Badge>
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-[10px]",
                            passed
                                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                                : "text-muted-foreground",
                        )}
                    >
                        {thresholdLabel}
                    </Badge>
                    {passed && (
                        <Badge className="border-transparent bg-emerald-500 text-emerald-50">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {t("improv.status.passed")}
                        </Badge>
                    )}
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">{children}</CardContent>
        </Card>
    );
}

/** Simple progress/score strip shared by the quiz engines. */
export function ScoreStrip({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold text-foreground">{value}</span>
        </div>
    );
}

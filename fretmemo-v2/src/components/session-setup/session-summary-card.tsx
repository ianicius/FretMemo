import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface SessionSummaryMetric {
    label: string;
    value: ReactNode;
}

interface SessionSummaryAction {
    label: string;
    onClick: () => void;
}

interface SessionSummaryCardProps {
    title?: string;
    description?: ReactNode;
    metrics: ReadonlyArray<SessionSummaryMetric>;
    notice?: ReactNode;
    noticeClassName?: string;
    primaryAction: SessionSummaryAction;
    secondaryAction?: SessionSummaryAction;
    className?: string;
}

export function SessionSummaryCard({
    title = "Session Summary",
    description,
    metrics,
    notice,
    noticeClassName,
    primaryAction,
    secondaryAction,
    className,
}: SessionSummaryCardProps) {
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description ? <CardDescription>{description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {metrics.map((metric) => (
                    <div key={metric.label} className="rounded-md border border-border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                        <p className="text-lg font-bold">{metric.value}</p>
                    </div>
                ))}
                {notice ? (
                    <div className={cn("col-span-2 rounded-md border border-border bg-muted/20 p-2 text-xs sm:col-span-4", noticeClassName)}>
                        {notice}
                    </div>
                ) : null}
                <div className="col-span-2 pt-2 sm:col-span-4">
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={primaryAction.onClick} className="w-full sm:w-auto">
                            {primaryAction.label}
                        </Button>
                        {secondaryAction ? (
                            <Button variant="outline" onClick={secondaryAction.onClick} className="w-full sm:w-auto">
                                {secondaryAction.label}
                            </Button>
                        ) : null}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

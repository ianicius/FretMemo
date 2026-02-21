import { cn } from "@/lib/utils";
import type { RhythmNotationToken } from "@/rhythm/data/rhythmExercises";
import { useTranslation } from "react-i18next";

interface RhythmNotationProps {
    tokens: RhythmNotationToken[];
    timeSignatureTop: number;
    subdivision: number;
    playheadStep: number | null;
    showLegend?: boolean;
}

interface TokenSegment {
    token: RhythmNotationToken;
    start: number;
    end: number;
}

export function RhythmNotation({
    tokens,
    timeSignatureTop,
    subdivision,
    playheadStep,
    showLegend = false,
}: RhythmNotationProps) {
    const { t } = useTranslation();
    const totalUnits = timeSignatureTop * subdivision;
    const hasPlayhead = typeof playheadStep === "number" && playheadStep >= 0;
    const width = 1000;
    const height = 170;
    const padX = 28;
    const noteY = 90;
    const laneTop = 50;
    const laneBottom = 130;
    const usableWidth = width - padX * 2;
    const unitWidth = usableWidth / Math.max(1, totalUnits);

    const segments: TokenSegment[] = [];
    let cursor = 0;
    for (const token of tokens) {
        const safeUnits = Math.max(1, token.units);
        segments.push({
            token,
            start: cursor,
            end: cursor + safeUnits,
        });
        cursor += safeUnits;
    }

    const xForUnit = (unit: number): number =>
        padX + Math.max(0, Math.min(totalUnits, unit)) * unitWidth;

    const playheadX = hasPlayhead
        ? xForUnit((playheadStep as number) + 0.5)
        : null;

    return (
        <div className="space-y-3 rounded-xl border border-border bg-gradient-to-br from-amber-100/30 via-card to-orange-100/20 p-3 dark:from-amber-900/20 dark:via-card dark:to-orange-950/15">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("rhythm.ui.rhythmNotation.title")}</p>
                <p className="text-xs text-muted-foreground">
                    {t("rhythm.ui.rhythmNotation.meta", { signature: `${timeSignatureTop}/4`, subdivision })}
                </p>
            </div>

            <div
                className="grid gap-1 text-[10px] text-muted-foreground"
                style={{ gridTemplateColumns: `repeat(${timeSignatureTop}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: timeSignatureTop }, (_, index) => (
                    <div
                        key={`beat-label-${index}`}
                        className={cn(
                            "rounded border px-1 py-0.5 text-center",
                            index === 0
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border/60 bg-muted/20",
                        )}
                    >
                        {index + 1}
                    </div>
                ))}
            </div>

            <div className="relative overflow-hidden rounded-lg border border-border/70 bg-background/70">
                <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
                    <rect x="0" y="0" width={width} height={height} fill="transparent" />

                    {Array.from({ length: totalUnits + 1 }, (_, index) => {
                        const x = xForUnit(index);
                        const isBeatLine = index % subdivision === 0;
                        return (
                            <line
                                key={`grid-${index}`}
                                x1={x}
                                y1={laneTop}
                                x2={x}
                                y2={laneBottom}
                                stroke={isBeatLine ? "hsl(var(--border))" : "hsl(var(--border) / 0.45)"}
                                strokeWidth={isBeatLine ? 1.5 : 1}
                            />
                        );
                    })}

                    <line x1={padX} y1={noteY + 12} x2={width - padX} y2={noteY + 12} stroke="hsl(var(--border) / 0.7)" strokeWidth={1} />
                    <line x1={padX} y1={noteY - 10} x2={width - padX} y2={noteY - 10} stroke="hsl(var(--border) / 0.5)" strokeWidth={1} />

                    {segments.map((segment, index) => {
                        const startX = xForUnit(segment.start);
                        const endX = xForUnit(segment.end);
                        const centerX = Math.min(endX - 8, startX + 10);
                        const tokenDuration = segment.end - segment.start;

                        if (segment.token.kind === "rest") {
                            return (
                                <g key={`rest-${index}`}>
                                    <rect
                                        x={startX + 3}
                                        y={noteY - 7}
                                        width={Math.max(6, endX - startX - 6)}
                                        height={14}
                                        rx={3}
                                        fill="hsl(var(--muted) / 0.35)"
                                        stroke="hsl(var(--border))"
                                        strokeWidth={1}
                                        strokeDasharray="3 2"
                                    />
                                </g>
                            );
                        }

                        const needsStem = tokenDuration <= subdivision;
                        const needsFlag = tokenDuration < subdivision;
                        const isDotted = subdivision === 4 && tokenDuration === 3;
                        const sustainX = Math.max(centerX + 9, endX - 2);

                        return (
                            <g key={`note-${index}`}>
                                <line
                                    x1={centerX + 8}
                                    y1={noteY}
                                    x2={sustainX}
                                    y2={noteY}
                                    stroke="hsl(var(--primary) / 0.7)"
                                    strokeWidth={3}
                                    strokeLinecap="round"
                                />
                                <ellipse
                                    cx={centerX}
                                    cy={noteY}
                                    rx={8}
                                    ry={6}
                                    fill="hsl(var(--primary))"
                                />
                                {needsStem && (
                                    <line
                                        x1={centerX + 7}
                                        y1={noteY}
                                        x2={centerX + 7}
                                        y2={noteY - 26}
                                        stroke="hsl(var(--foreground))"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                    />
                                )}
                                {needsFlag && (
                                    <line
                                        x1={centerX + 7}
                                        y1={noteY - 26}
                                        x2={centerX + 16}
                                        y2={noteY - 20}
                                        stroke="hsl(var(--foreground))"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                    />
                                )}
                                {isDotted && (
                                    <circle
                                        cx={centerX + 15}
                                        cy={noteY}
                                        r={2.2}
                                        fill="hsl(var(--foreground))"
                                    />
                                )}
                                {segment.token.accent && (
                                    <polygon
                                        points={`${centerX - 6},${noteY - 34} ${centerX + 6},${noteY - 34} ${centerX},${noteY - 40}`}
                                        fill="hsl(var(--primary))"
                                    />
                                )}
                            </g>
                        );
                    })}

                    {playheadX !== null && (
                        <line
                            x1={playheadX}
                            y1={laneTop - 6}
                            x2={playheadX}
                            y2={laneBottom + 8}
                            stroke="hsl(var(--primary))"
                            strokeWidth={2.5}
                        />
                    )}
                </svg>
            </div>

            {showLegend && (
                <div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-3">
                    <div className="rounded border border-border/60 bg-muted/20 px-2 py-1">{t("rhythm.ui.rhythmNotation.legend.tapNotesOnly")}</div>
                    <div className="rounded border border-border/60 bg-muted/20 px-2 py-1">{t("rhythm.ui.rhythmNotation.legend.noRests")}</div>
                    <div className="rounded border border-border/60 bg-muted/20 px-2 py-1">{t("rhythm.ui.rhythmNotation.legend.accents")}</div>
                </div>
            )}
        </div>
    );
}

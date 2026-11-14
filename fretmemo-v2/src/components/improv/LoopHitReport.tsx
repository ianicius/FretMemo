/**
 * Plan B3: after a loop played with mic verification, one chip per chord of
 * the progression — hit (green, check) or missed (muted, cross).
 */

import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { localizeToken } from "@/lib/improv/display";
import type { ChordHitResult } from "@/lib/improv/loopTools";

export function LoopHitReport({ results }: { results: ChordHitResult[] }) {
    const { t } = useTranslation();
    const hits = results.filter((result) => result.hit).length;
    return (
        <div className="space-y-1.5" aria-live="polite">
            <p className="text-xs text-muted-foreground">
                {t("improv.loop.reportTitle", { done: hits, total: results.length })}
            </p>
            <ul className="flex flex-wrap gap-1.5">
                {results.map((result, index) => (
                    <li
                        key={`${result.chord}-${index}`}
                        className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                            result.hit
                                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "border-border bg-muted/40 text-muted-foreground",
                        )}
                    >
                        {result.hit
                            ? <Check className="h-3 w-3" aria-hidden="true" />
                            : <X className="h-3 w-3" aria-hidden="true" />}
                        {localizeToken(result.chord)}
                        <span className="sr-only">{result.hit ? t("improv.loop.reportHit") : t("improv.loop.reportMiss")}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

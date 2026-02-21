import type { TapEvaluation } from "@/rhythm/engine/InputEvaluator";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface TimingFeedbackProps {
    evaluation: TapEvaluation | null;
}

function feedbackClass(rating: TapEvaluation["rating"]): string {
    if (rating === "perfect") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    if (rating === "good") return "border-lime-500/40 bg-lime-500/10 text-lime-700 dark:text-lime-300";
    if (rating === "ok") return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    return "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

function feedbackLabel(evaluation: TapEvaluation, t: (key: string, options?: Record<string, unknown>) => string): string {
    const sign = evaluation.offsetMs > 0 ? "+" : "";
    const roundedOffset = `${sign}${Math.round(evaluation.offsetMs)}`;
    if (evaluation.rating === "miss") {
        return t("rhythm.ui.timingFeedback.miss", { offset: roundedOffset });
    }
    const rating = t(`rhythm.ui.timingFeedback.rating.${evaluation.rating}`);
    return t("rhythm.ui.timingFeedback.value", { rating, offset: roundedOffset });
}

export function TimingFeedback({ evaluation }: TimingFeedbackProps) {
    const { t } = useTranslation();

    if (!evaluation) {
        return (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {t("rhythm.ui.timingFeedback.waiting")}
            </div>
        );
    }

    return (
        <div className={cn("rounded-lg border px-3 py-2 text-xs font-semibold", feedbackClass(evaluation.rating))}>
            {feedbackLabel(evaluation, t)}
            {!evaluation.directionCorrect && ` · ${t("rhythm.ui.timingFeedback.wrongDirection")}`}
        </div>
    );
}

/**
 * practice-link engine (plan phase 2).
 *
 * A thin exercise type: opens /practice with route state that Practice.tsx
 * already understands (mode + constraints), so modules 1 and 5 reuse the
 * SM2 repeats, heat map and mic flow instead of a bespoke quiz. The pass
 * criterion is read from useProgressStore.positionStats: every position in
 * the fret window has at least `minAnswers` recorded answers with accuracy
 * ≥ `minAccuracy`. When every position qualifies, the user records the pass
 * (exerciseRuns = 1) and ExerciseFrame awards the XP.
 *
 * The fret window in `PracticeLinkParams` is absolute (frets on the neck).
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { STANDARD_TUNING, getNoteAt } from "@/lib/constants";
import type { NoteStatus } from "@/types/fretboard";
import { trackEvent } from "@/lib/analytics";
import { isExercisePassed, practiceLinkPositions, type ImprovExercise, type PracticeLinkParams } from "@/data/improv/curriculum";
import { selectModuleProgress, useImprovStore } from "@/stores/useImprovStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { ExerciseFrame, ScoreStrip } from "./ExerciseFrame";

interface PracticeLinkExerciseProps {
    moduleId: string;
    exercise: ImprovExercise;
}

export function PracticeLinkExercise({ moduleId, exercise }: PracticeLinkExerciseProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const params = exercise.params as PracticeLinkParams;
    const recordPracticePass = useImprovStore((state) => state.recordPracticePass);
    const progress = useImprovStore((state) => selectModuleProgress(state, moduleId));
    const passed = isExercisePassed(exercise, progress);
    const positionStats = useProgressStore((state) => state.positionStats);

    // Open strings (fret 0) are excluded: practice sessions never ask them
    // and knowing the open string is implied by the string's name (user
    // report — the old 0-based window made module 1 impossible to pass).
    const positions = useMemo(
        () => practiceLinkPositions(params),
        [params],
    );

    const isPositionQualified = (stringIndex: number, fret: number): boolean => {
        const stats = positionStats[`${stringIndex}-${fret}`];
        return Boolean(stats) && stats.total >= params.minAnswers && stats.correct / stats.total >= params.minAccuracy;
    };

    const satisfied = useMemo(
        () => positions.filter((position) => isPositionQualified(position.stringIndex, position.fret)).length,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [positionStats, positions, params.minAnswers, params.minAccuracy],
    );

    const coverage = positions.length > 0 ? Math.round((satisfied / positions.length) * 100) : 0;
    const criteriaMet = positions.length > 0 && satisfied === positions.length;

    const activeNotes = useMemo((): NoteStatus[] => {
        return positions.map((position) => ({
            position: {
                stringIndex: position.stringIndex,
                fret: position.fret,
                note: getNoteAt(STANDARD_TUNING[position.stringIndex] ?? "C", position.fret),
            },
            status: isPositionQualified(position.stringIndex, position.fret) ? "correct" : "active",
            emphasis: "normal" as const,
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [positionStats, positions, params.minAccuracy, params.minAnswers]);

    const openPractice = () => {
        trackEvent("improv_practice_link_opened", { module_id: moduleId, exercise_id: exercise.id, mode: params.mode });
        const enabledStrings = [0, 1, 2, 3, 4, 5].map((index) => params.enabledStrings.includes(index));
        navigate("/practice", {
            state: {
                mode: params.mode,
                source: `improv_${moduleId}`,
                constraints: {
                    fretRange: { min: params.offsetsFrom, max: params.offsetsTo },
                    enabledStrings,
                    rootNote: params.rootNote,
                    scaleType: params.scaleType,
                },
            },
        });
    };

    const thresholdLabel = t("improv.practiceLink.threshold", {
        minAnswers: params.minAnswers,
        minAccuracy: Math.round(params.minAccuracy * 100),
    });

    return (
        <ExerciseFrame
            engine={exercise.engine}
            name={t(exercise.nameKey)}
            description={t(exercise.descKey)}
            thresholdLabel={thresholdLabel}
            passed={passed}
        >
            <ScoreStrip
                label={t("improv.practiceLink.coverage")}
                value={t("improv.practiceLink.coverageValue", { done: satisfied, total: positions.length })}
            />
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${coverage}%` }} />
            </div>
            <Fretboard frets={12} activeNotes={activeNotes} fitContainer className="rounded-lg border border-border bg-card/60" />
            <p className="text-xs text-muted-foreground">{t("improv.practiceLink.hint")}</p>
            <Button type="button" size="sm" onClick={openPractice}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("improv.practiceLink.open", { mode: t(`practice.modes.${params.mode}`) })}
            </Button>
            {criteriaMet && !passed && (
                <Button type="button" size="sm" variant="outline" onClick={() => recordPracticePass(moduleId, exercise.id)}>
                    {t("improv.practiceLink.recordPass")}
                </Button>
            )}
        </ExerciseFrame>
    );
}

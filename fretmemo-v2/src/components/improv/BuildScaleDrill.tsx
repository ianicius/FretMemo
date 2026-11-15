/**
 * "Build the box from a root" (plan C4): one root and the finger on it are
 * given; the player taps the remaining notes of the pentatonic box. A box
 * found with at most MAX_MISTAKES wrong taps counts as one drill run.
 *
 * shortcut: answers are tapped only, add microphone input when the play-notes
 * detector is reused here.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { STANDARD_TUNING } from "@/lib/constants";
import { normalizeTuning } from "@/lib/tuning";
import type { NoteStatus, Position } from "@/types/fretboard";
import { SCALE_SHAPES, getShapePositions, isStandardTuning, tonicAnchorFret } from "@/lib/improv/scaleShapes";
import { isExercisePassed, type BuildStart, type DiagramDrillParams, type ImprovExercise } from "@/data/improv/curriculum";
import { selectModuleProgress, useImprovStore } from "@/stores/useImprovStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { ExerciseFrame } from "./ExerciseFrame";
import { IMPROV_FRETBOARD_ROWS, localizeToken } from "@/lib/improv/display";

const MAX_MISTAKES = 2;
const keyOf = (position: { stringIndex: number; fret: number }) => `${position.stringIndex}:${position.fret}`;

interface BuildScaleDrillProps {
    moduleId: string;
    exercise: ImprovExercise;
}

export function BuildScaleDrill({ moduleId, exercise }: BuildScaleDrillProps) {
    const { t } = useTranslation();
    const params = exercise.params as DiagramDrillParams;
    const starts = params.buildStarts ?? [];
    const shape = params.shapes[0] as NonNullable<typeof params.shapes[number]>;
    const recordDrillRun = useImprovStore((state) => state.recordDrillRun);
    const progress = useImprovStore((state) => selectModuleProgress(state, moduleId));
    const runs = progress.exerciseRuns[exercise.id] ?? 0;
    const passed = isExercisePassed(exercise, progress);
    const leftHanded = useSettingsStore((state) => state.full.instrument.leftHanded);
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const standardTuning = useMemo(() => isStandardTuning(normalizeTuning(quickTuning)), [quickTuning]);

    const [startIndex, setStartIndex] = useState(0);
    const [found, setFound] = useState<string[]>([]);
    const [mistakes, setMistakes] = useState(0);
    const [wrong, setWrong] = useState<Position | null>(null);

    const start = starts[startIndex % starts.length] as BuildStart;
    const anchor = tonicAnchorFret(shape.defaultKey);
    // The start roots are written for standard tuning, so the board always shows it.
    const box = useMemo(
        () => getShapePositions(shape.shapeId, shape.defaultKey, { fretFrom: anchor + start.offsetsFrom, fretTo: anchor + start.offsetsTo }),
        [anchor, shape.defaultKey, shape.shapeId, start.offsetsFrom, start.offsetsTo],
    );
    const rootKey = keyOf(start);
    const targets = box.filter((position) => keyOf(position) !== rootKey);
    const done = found.length === targets.length;
    const clean = mistakes <= MAX_MISTAKES;

    const reset = (nextIndex: number) => {
        setStartIndex(nextIndex);
        setFound([]);
        setMistakes(0);
        setWrong(null);
    };

    const handleTap = (position: Position) => {
        const key = keyOf(position);
        if (done || key === rootKey || found.includes(key)) return;
        if (!targets.some((target) => keyOf(target) === key)) {
            setMistakes(mistakes + 1);
            setWrong(position);
            return;
        }
        setWrong(null);
        setFound([...found, key]);
        if (found.length + 1 === targets.length && clean) recordDrillRun(moduleId, exercise.id);
    };

    const degrees = SCALE_SHAPES[shape.shapeId].degrees;
    const activeNotes: NoteStatus[] = box
        .filter((position) => keyOf(position) === rootKey || found.includes(keyOf(position)))
        .map((position) => ({
            position: { stringIndex: position.stringIndex, fret: position.fret, note: position.note },
            status: keyOf(position) === rootKey ? "active" : "correct",
            label: degrees[position.degreeIndex],
            emphasis: keyOf(position) === rootKey ? "strong" : "normal",
        }));
    if (wrong) activeNotes.push({ position: wrong, status: "incorrect" });

    return (
        <ExerciseFrame
            engine={exercise.engine}
            engineLabel={t("improv.build.badge")}
            name={t(exercise.nameKey)}
            description={t(exercise.descKey)}
            thresholdLabel={t("improv.build.threshold", { count: params.requiredRuns })}
            passed={passed}
        >
            <p className="text-sm font-medium">
                {t("improv.build.prompt", {
                    note: localizeToken(shape.defaultKey),
                    string: start.stringIndex + 1,
                    fret: start.fret,
                    finger: t(`improv.build.finger.${start.finger}`),
                })}
            </p>
            <p className="text-xs text-muted-foreground">{t("improv.build.tip")}</p>

            <Fretboard
                frets={Math.max(12, anchor + 12)}
                activeNotes={activeNotes}
                tuning={STANDARD_TUNING}
                leftHanded={leftHanded}
                fitContainer
                onNoteClick={handleTap}
                className={`rounded-lg border border-border bg-card/60 ${IMPROV_FRETBOARD_ROWS}`}
            />
            {!standardTuning && <p className="text-xs text-muted-foreground">{t("improv.build.standardTuning")}</p>}

            <p className="text-xs text-muted-foreground" aria-live="polite">
                {t("improv.build.progress", { found: found.length, total: targets.length, mistakes })}
                {done && ` ${t(clean ? "improv.build.doneClean" : "improv.build.doneMessy", { max: MAX_MISTAKES })}`}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                    {t("improv.build.runs", { done: Math.min(runs, params.requiredRuns), required: params.requiredRuns })}
                </p>
                <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => reset(startIndex)}>
                        {t("improv.build.retry")}
                    </Button>
                    <Button type="button" size="sm" disabled={!done} onClick={() => reset(startIndex + 1)}>
                        {t("improv.build.next")}
                    </Button>
                </div>
            </div>
        </ExerciseFrame>
    );
}

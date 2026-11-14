/**
 * E3 diagram-drill engine (run improv-training-2026-11-13).
 *
 * Guided practice without a microphone: the shape (scale / triad / arp) is
 * drawn on the Fretboard with degree labels (root emphasized), a metronome
 * click (adjustable BPM, start/stop) keeps time, the root sounds when the
 * metronome starts, and the user marks a completed up+down run themselves.
 * Reaching `requiredRuns` records the drill as passed in the improv store.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { STANDARD_TUNING, getNoteAt } from "@/lib/constants";
import type { NoteStatus } from "@/types/fretboard";
import { SCALE_SHAPES, getShapePositions } from "@/lib/improv/scaleShapes";
import { tonicMidi } from "@/lib/improv/chords";
import { MetronomeClicker } from "@/lib/improv/click";
import { playTone } from "@/lib/audio";
import { isExercisePassed, type DiagramDrillParams, type ImprovExercise } from "@/data/improv/curriculum";
import { selectModuleProgress, useImprovStore } from "@/stores/useImprovStore";
import { ExerciseFrame } from "./ExerciseFrame";
import { localizeToken } from "@/lib/improv/display";

interface DiagramDrillProps {
    moduleId: string;
    exercise: ImprovExercise;
}

export function DiagramDrill({ moduleId, exercise }: DiagramDrillProps) {
    const { t } = useTranslation();
    const params = exercise.params as DiagramDrillParams;
    const recordDrillRun = useImprovStore((state) => state.recordDrillRun);
    const progress = useImprovStore((state) => selectModuleProgress(state, moduleId));
    const runs = progress.exerciseRuns[exercise.id] ?? 0;
    const passed = isExercisePassed(exercise, progress);

    const [shapeIndex, setShapeIndex] = useState(0);
    const shape = params.shapes[Math.min(shapeIndex, params.shapes.length - 1)] as NonNullable<typeof params.shapes[number]>;
    const [key, setKey] = useState<string>(shape.defaultKey);
    const [bpm, setBpm] = useState(params.defaultBpm);
    const [playing, setPlaying] = useState(false);
    const [metronomeBeats, setMetronomeBeats] = useState(0);
    const clickerRef = useRef<MetronomeClicker | null>(null);

    useEffect(() => {
        return () => {
            clickerRef.current?.stop();
            clickerRef.current = null;
        };
    }, []);

    const positions = useMemo(
        () => getShapePositions(shape.shapeId, key, {
            tuning: STANDARD_TUNING,
            fretFrom: params.fretFrom,
            fretTo: params.fretTo,
            triadQuality: shape.triadQuality,
        }),
        [key, params.fretFrom, params.fretTo, shape.shapeId, shape.triadQuality],
    );

    // Plan 1.2: a run counts only after the metronome has clicked through the
    // full up+down path — as many beats as the shape has notes, times two.
    const runBeats = positions.length * 2;
    const runEarned = playing && metronomeBeats >= runBeats;

    const activeNotes = useMemo((): NoteStatus[] => {
        const degrees = SCALE_SHAPES[shape.shapeId].degrees;
        return positions.map((position) => ({
            position: {
                stringIndex: position.stringIndex,
                fret: position.fret,
                note: getNoteAt(STANDARD_TUNING[position.stringIndex] ?? "C", position.fret),
            },
            status: "active" as const,
            label: degrees[position.degreeIndex] ?? undefined,
            emphasis: position.isRoot ? ("strong" as const) : ("normal" as const),
        }));
    }, [positions, shape.shapeId]);

    const handleStart = () => {
        clickerRef.current = new MetronomeClicker(bpm, {
            onBeat: (beat) => setMetronomeBeats(beat),
        });
        setMetronomeBeats(0);
        clickerRef.current.start();
        setPlaying(true);
        void playTone(tonicMidi(key, 48), 1.4);
    };

    const handleStop = () => {
        clickerRef.current?.stop();
        clickerRef.current = null;
        setPlaying(false);
        setMetronomeBeats(0);
    };

    const handleBpmChange = (value: number) => {
        setBpm(value);
        clickerRef.current?.setBpm(value);
    };

    const handleRunDone = () => {
        if (!runEarned) return;
        recordDrillRun(moduleId, exercise.id);
        setMetronomeBeats(0);
    };

    const thresholdLabel = t("improv.drill.threshold", { count: params.requiredRuns });

    return (
        <ExerciseFrame
            engine={exercise.engine}
            name={t(exercise.nameKey)}
            description={t(exercise.descKey)}
            thresholdLabel={thresholdLabel}
            passed={passed}
        >
            <div className="flex flex-wrap items-end gap-3">
                {params.shapes.length > 1 && (
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("improv.drill.shape")}</Label>
                        <Select
                            value={String(shapeIndex)}
                            onChange={(event) => {
                                const nextIndex = Number(event.target.value);
                                setShapeIndex(nextIndex);
                                const nextShape = params.shapes[nextIndex];
                                if (nextShape) setKey(nextShape.defaultKey);
                            }}
                            className="h-9 w-44 text-xs"
                        >
                            {params.shapes.map((item, itemIndex) => (
                                <option key={`${item.shapeId}-${item.triadQuality ?? ""}-${item.defaultKey}`} value={itemIndex}>
                                    {t(`improv.shapes.${item.shapeId}`)} · {localizeToken(item.triadQuality === "min" && item.shapeId === "triad" ? `${item.defaultKey}m` : item.defaultKey)}
                                </option>
                            ))}
                        </Select>
                    </div>
                )}
                {shape.keys && shape.keys.length > 1 && (
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("improv.drill.key")}</Label>
                        <Select
                            value={key}
                            onChange={(event) => setKey(event.target.value)}
                            className="h-9 w-24 text-xs"
                        >
                            {shape.keys.map((item) => (
                                <option key={item} value={item}>{localizeToken(item)}</option>
                            ))}
                        </Select>
                    </div>
                )}
                <div className="min-w-40 flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("improv.drill.bpm", { bpm })}</Label>
                    <Slider
                        value={[bpm]}
                        min={40}
                        max={200}
                        step={5}
                        onValueChange={(values) => handleBpmChange(values[0] ?? params.defaultBpm)}
                    />
                </div>
                <Button type="button" size="sm" variant={playing ? "secondary" : "default"} onClick={playing ? handleStop : handleStart}>
                    {playing ? t("improv.drill.stop") : t("improv.drill.start")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void playTone(tonicMidi(key, 48), 1.4)}>
                    {t("improv.drill.playRoot")}
                </Button>
            </div>

            <Fretboard
                frets={params.fretTo}
                activeNotes={activeNotes}
                fitContainer
                className="rounded-lg border border-border bg-card/60"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                    {t("improv.drill.runs", { done: Math.min(runs, params.requiredRuns), required: params.requiredRuns })}
                </p>
                <Button
                    type="button"
                    size="sm"
                    variant={passed ? "secondary" : "default"}
                    onClick={handleRunDone}
                    disabled={!runEarned}
                    title={runEarned ? undefined : t("improv.drill.runNeedsMetronome", { beats: runBeats })}
                >
                    {t("improv.drill.runButton")}
                </Button>
            </div>
        </ExerciseFrame>
    );
}

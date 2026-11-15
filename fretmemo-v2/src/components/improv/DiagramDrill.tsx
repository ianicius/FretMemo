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
import { getNoteAt } from "@/lib/constants";
import { normalizeTuning } from "@/lib/tuning";
import type { NoteStatus } from "@/types/fretboard";
import {
    BEND_DEGREES, MODE_PENTATONIC, PENTATONIC_ADDITIONS, SCALE_SHAPES,
    getPitchPositions, getShapePositions, isStandardTuning, stringShapes, tonicAnchorFret,
} from "@/lib/improv/scaleShapes";
import { tonicMidi } from "@/lib/improv/chords";
import { MetronomeClicker } from "@/lib/improv/click";
import { playTone } from "@/lib/audio";
import { isExercisePassed, type DiagramDrillParams, type ImprovExercise } from "@/data/improv/curriculum";
import { selectModuleProgress, useImprovStore } from "@/stores/useImprovStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { ExerciseFrame } from "./ExerciseFrame";
import { IMPROV_FRETBOARD_ROWS, localizeToken } from "@/lib/improv/display";

/** Dot colours of the diagram views (the root keeps the app's amber). */
const COLOR = { rect: "#38bdf8", stack: "#a78bfa", added: "#fb7185", pent: "#38bdf8" } as const;
type PentatonicView = "pent" | "blues" | "hex" | "bends";

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
    // Plan A3: follow the user's instrument settings (as ScaleExplorer does).
    const leftHanded = useSettingsStore((state) => state.full.instrument.leftHanded);
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);

    const [shapeIndex, setShapeIndex] = useState(0);
    const shape = params.shapes[Math.min(shapeIndex, params.shapes.length - 1)] as NonNullable<typeof params.shapes[number]>;
    const [key, setKey] = useState<string>(shape.defaultKey);
    const [bpm, setBpm] = useState(params.defaultBpm);
    const [view, setView] = useState<PentatonicView>("pent");
    const [playing, setPlaying] = useState(false);
    const [metronomeBeats, setMetronomeBeats] = useState(0);
    const clickerRef = useRef<MetronomeClicker | null>(null);

    useEffect(() => {
        return () => {
            clickerRef.current?.stop();
            clickerRef.current = null;
        };
    }, []);

    // Plan phase 2: the window is relative to the tonic, so a key switch
    // slides the same shape instead of jumping to a different fret range.
    const windowFrom = Math.max(0, tonicAnchorFret(key) + params.offsetsFrom);
    const windowTo = tonicAnchorFret(key) + params.offsetsTo;

    const positions = useMemo(
        () => getShapePositions(shape.shapeId, key, {
            tuning,
            fretFrom: windowFrom,
            fretTo: windowTo,
        }),
        [key, windowFrom, windowTo, shape.shapeId, tuning],
    );

    // Plan C2: the blues / hexatonic view adds one note to the pentatonic.
    const addition = params.pentatonicViews && (view === "blues" || view === "hex") ? PENTATONIC_ADDITIONS[view] : null;
    const addedPositions = useMemo(
        () => (addition ? getPitchPositions(key, addition.semitone, { tuning, fretFrom: windowFrom, fretTo: windowTo }) : []),
        [addition, key, tuning, windowFrom, windowTo],
    );
    const isPentatonic = shape.shapeId === "min-pent" || shape.shapeId === "maj-pent";
    const basePentatonic = params.pentatonicFill ? MODE_PENTATONIC[shape.shapeId] : undefined;

    // Plan 1.2: a run counts only after the metronome has clicked through the
    // full up+down path — as many beats as the shape has notes, times two.
    const runBeats = (positions.length + addedPositions.length) * 2;
    const runEarned = playing && metronomeBeats >= runBeats;

    const activeNotes = useMemo((): NoteStatus[] => {
        const definition = SCALE_SHAPES[shape.shapeId];
        // Plan C1: rectangle and stack strings of a pentatonic box.
        const shapes = isPentatonic ? stringShapes(positions) : null;
        const pentatonicOffsets = basePentatonic ? SCALE_SHAPES[basePentatonic].semitones : null;
        const colorOf = (position: (typeof positions)[number]): string | undefined => {
            if (position.isRoot) return undefined;
            if (pentatonicOffsets) return pentatonicOffsets.includes(definition.semitones[position.degreeIndex] ?? -1) ? COLOR.pent : COLOR.added;
            const kind = shapes?.get(position.stringIndex);
            return kind ? COLOR[kind] : undefined;
        };
        const base = positions.map((position): NoteStatus => {
            const degree = definition.degrees[position.degreeIndex];
            const color = colorOf(position);
            return {
                position: {
                    stringIndex: position.stringIndex,
                    fret: position.fret,
                    note: getNoteAt(tuning[position.stringIndex] ?? "C", position.fret),
                },
                // A coloured dot is drawn through the idle style; the root stays amber.
                status: color ? "idle" : "active",
                color,
                label: degree && view === "bends" && BEND_DEGREES.includes(degree) ? `${degree}↑` : degree,
                emphasis: position.isRoot ? "strong" : "normal",
            };
        });
        const added = addedPositions.map((position): NoteStatus => ({
            position,
            status: "idle",
            color: COLOR.added,
            label: addition?.degree,
        }));
        return [...base, ...added];
    }, [positions, addedPositions, addition, basePentatonic, isPentatonic, shape.shapeId, tuning, view]);

    const legend: Array<{ color: string; label: string }> = basePentatonic
        ? [{ color: COLOR.pent, label: t(`improv.shapes.${basePentatonic}`) }, { color: COLOR.added, label: t("improv.drill.legendAdded") }]
        : isPentatonic
            ? [
                { color: COLOR.rect, label: t("improv.drill.legendRect") },
                { color: COLOR.stack, label: t("improv.drill.legendStack") },
                ...(addition ? [{ color: COLOR.added, label: t("improv.drill.legendAdded") }] : []),
            ]
            : [];

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
                                <option key={`${item.shapeId}-${item.defaultKey}`} value={itemIndex}>
                                    {t(`improv.shapes.${item.shapeId}`)} · {localizeToken(item.defaultKey)}
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
                {params.pentatonicViews && (
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("improv.drill.view")}</Label>
                        <Select value={view} onChange={(event) => setView(event.target.value as PentatonicView)} className="h-9 w-44 text-xs">
                            <option value="pent">{t("improv.drill.viewPent")}</option>
                            <option value="blues">{t("improv.drill.viewBlues")}</option>
                            <option value="hex">{t("improv.drill.viewHex")}</option>
                            <option value="bends">{t("improv.drill.viewBends")}</option>
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
                frets={Math.max(12, windowTo + 1)}
                activeNotes={activeNotes}
                tuning={tuning}
                leftHanded={leftHanded}
                fitContainer
                className={`rounded-lg border border-border bg-card/60 ${IMPROV_FRETBOARD_ROWS}`}
            />
            {legend.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
                        {t("improv.drill.legendRoot")}
                    </span>
                    {legend.map((item) => (
                        <span key={item.label} className="flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.label}
                        </span>
                    ))}
                    {view === "bends" && <span>{t("improv.drill.legendBend")}</span>}
                </p>
            )}
            {!isStandardTuning(tuning) && (
                <p className="text-xs text-muted-foreground">{t("improv.drill.tuningNotice")}</p>
            )}

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

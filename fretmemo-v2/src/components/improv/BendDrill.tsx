/**
 * Bend trainer: the fretboard shows the note to fret, the microphone measures
 * how far above it the string is bent, and a bend held inside the target
 * range counts as one repetition (logic in src/lib/improv/bend.ts).
 *
 * Without a microphone the learner marks repetitions themselves; those passes
 * are stored as unverified, like self-marked backing loops.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { STANDARD_TUNING, getNoteAt } from "@/lib/constants";
import { playTone } from "@/lib/audio";
import { BEND_HOLD_MS, BEND_IDLE, centsAbove, frettedMidi, stepBend, type BendProgress } from "@/lib/improv/bend";
import { IMPROV_FRETBOARD_ROWS, localizeToken } from "@/lib/improv/display";
import { isExercisePassed, isExerciseVerified, isNonGating, loopRunKey, type BendDrillParams, type ImprovExercise } from "@/data/improv/curriculum";
import { selectModuleProgress, useImprovStore } from "@/stores/useImprovStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { usePitchDetector } from "@/services/pitch";
import { cn } from "@/lib/utils";
import { Note } from "tonal";
import { ExerciseFrame } from "./ExerciseFrame";

/** The meter spans a little past a whole-step bend. */
const METER_MAX_CENTS = 260;
const meterPercent = (cents: number) => `${Math.max(0, Math.min(100, (cents / METER_MAX_CENTS) * 100))}%`;

interface BendDrillProps {
    moduleId: string;
    exercise: ImprovExercise;
}

export function BendDrill({ moduleId, exercise }: BendDrillProps) {
    const { t } = useTranslation();
    const params = exercise.params as BendDrillParams;
    const recordLoopPass = useImprovStore((state) => state.recordLoopPass);
    const progress = useImprovStore((state) => selectModuleProgress(state, moduleId));
    const leftHanded = useSettingsStore((state) => state.full.instrument.leftHanded);
    const passed = isExercisePassed(exercise, progress);

    const [bendId, setBendId] = useState(params.bends[0].id);
    const bend = params.bends.find((item) => item.id === bendId) ?? params.bends[0];
    const baseMidi = frettedMidi(bend.string, bend.fret);
    const reps = progress.exerciseRuns[loopRunKey(exercise.id, bend.id)] ?? 0;

    const [micOn, setMicOn] = useState(false);
    // Every frame: the meter follows the pitch while it moves between two notes.
    const detector = usePitchDetector(micOn, { stableFrames: 1 });
    const cents = micOn && detector.frequency !== null ? centsAbove(detector.frequency, baseMidi) : null;
    // Pitches far from this string's note (another string ringing) do not move the meter.
    const heard = cents !== null && cents > -80 && cents < METER_MAX_CENTS + 100 ? cents : null;

    const stateRef = useRef<BendProgress>(BEND_IDLE);
    const lastFrameRef = useRef<number | null>(null);
    const inRange = heard !== null && heard >= bend.minCents && heard <= bend.maxCents;
    useEffect(() => {
        const now = performance.now();
        const dtMs = lastFrameRef.current === null ? 0 : Math.min(100, now - lastFrameRef.current);
        lastFrameRef.current = now;
        const next = stepBend(stateRef.current, heard, dtMs, bend);
        stateRef.current = next.state;
        if (next.counted) recordLoopPass(moduleId, exercise.id, bend.id, true);
        // The detector publishes a new frequency on every analysed frame.
    }, [bend, detector.frequency, exercise.id, heard, moduleId, recordLoopPass]);

    const semitones = Math.round((bend.minCents + bend.maxCents) / 200);
    const kind = bend.maxCents < 80 ? "curl" : semitones === 1 ? "half" : "whole";
    const sharpName = getNoteAt(STANDARD_TUNING[bend.string - 1], bend.fret + semitones);
    // A half-step bend raises the note by a minor second, so its target is spelled as a flat (D → Eb).
    const targetName = kind === "half" && sharpName.includes("#") ? Note.enharmonic(sharpName) : sharpName;

    return (
        <ExerciseFrame
            engine={exercise.engine}
            name={t(exercise.nameKey)}
            description={t(exercise.descKey)}
            thresholdLabel={t("improv.bend.threshold", { required: params.requiredReps })}
            passed={passed}
            unverified={passed && !isExerciseVerified(exercise, progress)}
        >
            {isNonGating(exercise) && (
                <Badge variant="secondary" className="w-fit text-[10px]">{t("improv.practiceLink.extra")}</Badge>
            )}
            {params.bends.length > 1 && (
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("improv.bend.choose")}</Label>
                    <Select
                        value={bend.id}
                        onChange={(event) => {
                            stateRef.current = BEND_IDLE;
                            setBendId(event.target.value);
                        }}
                        className="h-9 w-64 max-w-full text-xs"
                        aria-label={t("improv.bend.choose")}
                    >
                        {params.bends.map((item) => (
                            <option key={item.id} value={item.id}>
                                {t("improv.bend.option", { string: item.string, fret: item.fret })}
                            </option>
                        ))}
                    </Select>
                </div>
            )}

            <p className="text-sm">
                {t(`improv.bend.prompt.${kind}`, {
                    string: bend.string,
                    fret: bend.fret,
                    note: localizeToken(getNoteAt(STANDARD_TUNING[bend.string - 1], bend.fret)),
                    target: localizeToken(targetName),
                })}
            </p>

            <Fretboard
                frets={12}
                activeNotes={[{
                    position: { stringIndex: bend.string - 1, fret: bend.fret, note: getNoteAt(STANDARD_TUNING[bend.string - 1], bend.fret) },
                    status: inRange ? "correct" : "active",
                    label: "↑",
                    emphasis: "strong",
                }]}
                tuning={STANDARD_TUNING}
                leftHanded={leftHanded}
                fitContainer
                className={`rounded-lg border border-border bg-card/60 ${IMPROV_FRETBOARD_ROWS}`}
            />

            <div className="space-y-1">
                <div
                    className="relative h-6 overflow-hidden rounded-md border border-border bg-muted/40"
                    role="meter"
                    aria-label={t("improv.bend.meter")}
                    aria-valuemin={0}
                    aria-valuemax={METER_MAX_CENTS}
                    aria-valuenow={heard === null ? 0 : Math.round(heard)}
                >
                    <div
                        className="absolute inset-y-0 bg-emerald-500/25"
                        style={{ left: meterPercent(bend.minCents), width: meterPercent(bend.maxCents - bend.minCents) }}
                    />
                    {heard !== null && (
                        <div
                            className={cn("absolute inset-y-0 w-1 -translate-x-1/2", inRange ? "bg-emerald-500" : "bg-primary")}
                            style={{ left: meterPercent(heard) }}
                        />
                    )}
                </div>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                    {!micOn
                        ? t("improv.bend.micOffHint")
                        : detector.error
                            ? t("improv.loop.micError")
                            : heard === null
                                ? t("improv.bend.waiting")
                                : t("improv.bend.cents", { cents: Math.round(heard), min: bend.minCents, max: bend.maxCents })}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button type="button" size="sm" variant={micOn ? "secondary" : "default"} onClick={() => setMicOn((previous) => !previous)}>
                    {micOn ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                    {micOn ? t("improv.loop.micDisable") : t("improv.loop.micEnable")}
                </Button>
                {kind !== "curl" && (
                    <Button type="button" size="sm" variant="outline" onClick={() => void playTone(baseMidi + semitones, 1.4)}>
                        {t("improv.bend.playTarget")}
                    </Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => recordLoopPass(moduleId, exercise.id, bend.id, false)}>
                    {t("improv.bend.selfMark")}
                </Button>
                <Badge variant="outline" className="text-xs">
                    {t("improv.bend.reps", { done: Math.min(reps, params.requiredReps), required: params.requiredReps })}
                </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t("improv.bend.holdHint", { seconds: BEND_HOLD_MS / 1000 })}</p>
        </ExerciseFrame>
    );
}

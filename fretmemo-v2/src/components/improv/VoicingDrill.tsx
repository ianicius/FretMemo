/**
 * Voicing drill: chord voicings on one string set, one per bar with the
 * metronome. "inversions" walks every voicing of one chord up the neck,
 * "path" plays a progression with each chord voice-led from the previous one
 * (logic in src/lib/improv/voicings.ts). The board shows the current voicing,
 * which notes stay for the next chord and which way the others move, and the
 * next voicing faded. A run counts after the metronome went through every
 * voicing, like the diagram drill.
 */

import { useEffect, useMemo, useRef, useState } from "react";
// Voicings and board notes are plain expressions: the React compiler memoizes them.
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { getNoteAt } from "@/lib/constants";
import { normalizeTuning } from "@/lib/tuning";
import { playChord } from "@/lib/audio";
import { MetronomeClicker } from "@/lib/improv/click";
import { keyChoices, keyPitchClass, keyShiftInterval, loopKey, transposeChord } from "@/lib/improv/loopTools";
import { chordShape, chordVoicings, degreeLabel, voiceLeadPath, voicingMidis, voicingMoves, type ChordShape, type Voicing } from "@/lib/improv/voicings";
import { IMPROV_FRETBOARD_ROWS, localizeToken } from "@/lib/improv/display";
import { isExercisePassed, isNonGating, type ImprovExercise, type VoicingDrillParams } from "@/data/improv/curriculum";
import { selectModuleProgress, useImprovStore } from "@/stores/useImprovStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { NoteName, NoteStatus } from "@/types/fretboard";
import { ExerciseFrame } from "./ExerciseFrame";

interface VoicingDrillProps {
    moduleId: string;
    exercise: ImprovExercise;
}

interface Step {
    chord: string;
    shape: ChordShape;
    voicing: Voicing;
}

/** The voicings the drill walks through, for the chosen chord, string set and key. */
function buildSteps(params: VoicingDrillParams, chords: string[], chordIndex: number, strings: number[], tuning: NoteName[]): Step[] {
    const parsed = chords.flatMap((chord) => {
        const shape = chordShape(chord);
        return shape ? [{ chord, shape }] : [];
    });
    if (params.mode === "inversions") {
        const picked = parsed[Math.min(chordIndex, parsed.length - 1)];
        return picked ? chordVoicings(picked.shape, strings, tuning, { orders: params.orders, maxSpan: params.maxSpan }).map((voicing) => ({ ...picked, voicing })) : [];
    }
    const path = voiceLeadPath(parsed.map((item) => item.shape), strings, tuning, {
        startFret: params.startFret, orders: params.orders, maxSpan: params.maxSpan, layouts: params.layouts,
    });
    return path.map((voicing, index) => ({ ...(parsed[index] as { chord: string; shape: ChordShape }), voicing }));
}

/** "Strings 1-2-3 (G-B-E)": string numbers from the high E, notes from the lowest string. */
function stringSetLabel(strings: number[], tuning: NoteName[], t: (key: string, values: Record<string, string>) => string): string {
    const numbers = [...strings].map((string) => string + 1).sort((a, b) => a - b).join("-");
    const notes = strings.map((string) => localizeToken(tuning[string] ?? "")).join("-");
    return t("improv.voicing.stringSetLabel", { numbers, notes });
}

export function VoicingDrill({ moduleId, exercise }: VoicingDrillProps) {
    const { t } = useTranslation();
    const params = exercise.params as VoicingDrillParams;
    const recordDrillRun = useImprovStore((state) => state.recordDrillRun);
    const progress = useImprovStore((state) => selectModuleProgress(state, moduleId));
    const runs = progress.exerciseRuns[exercise.id] ?? 0;
    const passed = isExercisePassed(exercise, progress);
    const leftHanded = useSettingsStore((state) => state.full.instrument.leftHanded);
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);

    const originalKey = loopKey(params.key, params.chords[0] ?? "C");
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const activeKey = selectedKey ?? originalKey;
    const shiftInterval = keyShiftInterval(originalKey, activeKey);
    const [chordIndex, setChordIndex] = useState(0);
    const [setIndex, setSetIndex] = useState(0);
    const strings = params.stringSets[setIndex] ?? params.stringSets[0] ?? [];

    const chords = params.chords.map((chord) => transposeChord(chord, shiftInterval));
    const steps = buildSteps(params, chords, chordIndex, strings, tuning);

    const [manualStep, setManualStep] = useState(0);
    const [bpm, setBpm] = useState(params.defaultBpm);
    const [playing, setPlaying] = useState(false);
    const [beats, setBeats] = useState(0);
    const [runStartBeat, setRunStartBeat] = useState(0);
    const clickerRef = useRef<MetronomeClicker | null>(null);
    // The metronome callback reads the latest voicings and tempo without restarting.
    const stepsRef = useRef(steps);
    const bpmRef = useRef(bpm);
    useEffect(() => { stepsRef.current = steps; }, [steps]);
    useEffect(() => { bpmRef.current = bpm; }, [bpm]);
    useEffect(() => () => {
        clickerRef.current?.stop();
        clickerRef.current = null;
    }, []);

    const sound = (step: Step | undefined) => {
        if (!step) return;
        try {
            void playChord(voicingMidis(step.voicing, tuning), (60 / bpmRef.current) * params.beatsPerChord * 0.9, { strumDelaySec: 0.03 });
        } catch {
            // Audio unavailable — the board still shows the voicing.
        }
    };

    const stop = () => {
        clickerRef.current?.stop();
        clickerRef.current = null;
        setPlaying(false);
        setBeats(0);
        setRunStartBeat(0);
    };

    /** A new chord, string set or key restarts the walk. */
    const reset = () => {
        stop();
        setManualStep(0);
    };

    const start = () => {
        stop();
        clickerRef.current = new MetronomeClicker(bpm, {
            onBeat: (beat) => {
                setBeats(beat);
                if ((beat - 1) % params.beatsPerChord !== 0) return;
                const all = stepsRef.current;
                sound(all[Math.floor((beat - 1) / params.beatsPerChord) % Math.max(1, all.length)]);
            },
        });
        clickerRef.current.start();
        setPlaying(true);
    };

    const stepCount = steps.length;
    const stepIndex = playing && beats > 0
        ? Math.floor((beats - 1) / params.beatsPerChord) % Math.max(1, stepCount)
        : Math.min(manualStep, Math.max(0, stepCount - 1));
    const current = steps[stepIndex];
    const next = stepCount > 1 ? steps[(stepIndex + 1) % stepCount] : undefined;
    const runBeats = stepCount * params.beatsPerChord;
    const runEarned = playing && stepCount > 0 && beats - runStartBeat >= runBeats;

    const activeNotes = ((): NoteStatus[] => {
        if (!current) return [];
        const moves = next ? voicingMoves(current.voicing, next.voicing, tuning) : current.voicing.frets.map(() => 0);
        const notes: NoteStatus[] = current.voicing.frets.map((fret, index) => {
            const stringIndex = current.voicing.strings[index] as number;
            const move = moves[index] ?? 0;
            const tone = current.voicing.tones[index] as number;
            return {
                position: { stringIndex, fret, note: getNoteAt(tuning[stringIndex] ?? "E", fret) },
                // A note that stays for the next chord is green; the others carry the direction they move.
                status: next && move === 0 ? "correct" : "active",
                label: `${degreeLabel(current.shape, tone)}${move > 0 ? "↑" : move < 0 ? "↓" : ""}`,
                emphasis: tone === 0 ? "strong" : "normal",
            };
        });
        if (next) {
            next.voicing.frets.forEach((fret, index) => {
                if ((moves[index] ?? 0) === 0) return;
                const stringIndex = next.voicing.strings[index] as number;
                notes.push({
                    position: { stringIndex, fret, note: getNoteAt(tuning[stringIndex] ?? "E", fret) },
                    status: "idle",
                    opacity: 0.4,
                    label: degreeLabel(next.shape, next.voicing.tones[index] as number),
                });
            });
        }
        return notes;
    })();

    const keyOptions = keyChoices(originalKey);
    const originalPc = keyPitchClass(originalKey);

    return (
        <ExerciseFrame
            engine={exercise.engine}
            name={t(exercise.nameKey)}
            description={t(exercise.descKey)}
            thresholdLabel={t("improv.voicing.threshold", { required: params.requiredRuns })}
            passed={passed}
        >
            {isNonGating(exercise) && (
                <Badge variant="secondary" className="w-fit text-[10px]">{t("improv.practiceLink.extra")}</Badge>
            )}
            <div className="flex flex-wrap items-end gap-3">
                {params.mode === "inversions" && chords.length > 1 && (
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("improv.voicing.chord")}</Label>
                        <Select
                            value={String(chordIndex)}
                            onChange={(event) => { reset(); setChordIndex(Number(event.target.value)); }}
                            className="h-9 w-28 text-xs"
                            aria-label={t("improv.voicing.chord")}
                        >
                            {chords.map((chord, index) => <option key={chord} value={index}>{localizeToken(chord)}</option>)}
                        </Select>
                    </div>
                )}
                {params.stringSets.length > 1 && (
                    <div className="min-w-0 space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("improv.voicing.strings")}</Label>
                        <Select
                            value={String(setIndex)}
                            onChange={(event) => { reset(); setSetIndex(Number(event.target.value)); }}
                            className="h-9 w-56 max-w-full text-xs"
                            aria-label={t("improv.voicing.strings")}
                        >
                            {params.stringSets.map((set, index) => (
                                <option key={set.join("-")} value={index}>{stringSetLabel(set, tuning, t)}</option>
                            ))}
                        </Select>
                    </div>
                )}
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("improv.loop.key")}</Label>
                    <Select
                        value={String(keyPitchClass(activeKey))}
                        onChange={(event) => {
                            const pc = Number(event.target.value);
                            reset();
                            setSelectedKey(pc === originalPc ? null : keyOptions[pc] ?? null);
                        }}
                        className="h-9 w-36 text-xs"
                        aria-label={t("improv.loop.key")}
                    >
                        {keyOptions.map((option, pc) => (
                            <option key={option} value={pc}>
                                {pc === originalPc ? t("improv.loop.keyOriginal", { key: localizeToken(originalKey) }) : localizeToken(option)}
                            </option>
                        ))}
                    </Select>
                </div>
            </div>
            {/* A path that may move to other string sets has no single set to name. */}
            {params.stringSets.length === 1 && !params.layouts && (
                <p className="text-xs text-muted-foreground">{stringSetLabel(strings, tuning, t)}</p>
            )}

            {current ? (
                <>
                    <div className="grid grid-cols-[auto_auto] items-baseline justify-center gap-x-6 rounded-lg border border-border bg-card/60 px-4 py-4">
                        <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">{t("improv.loop.current")}</p>
                        <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">{t("improv.loop.next")}</p>
                        <p className="mt-1 text-center text-4xl font-bold tabular-nums text-primary">{localizeToken(current.chord)}</p>
                        <p className="mt-1 text-center text-xl font-semibold text-foreground opacity-70">{next ? localizeToken(next.chord) : "—"}</p>
                        <p className="col-span-2 mt-1 text-center text-sm text-muted-foreground">
                            {/* Shells and guide tones leave chord tones out, so they have no inversion name. */}
                            {current.voicing.tones.length === current.shape.intervals.length && <>{t(`improv.voicing.inversion.${current.voicing.inversion}`)}{" · "}</>}
                            {t("improv.voicing.step", { current: stepIndex + 1, total: stepCount })}
                        </p>
                    </div>
                    <Fretboard
                        frets={15}
                        activeNotes={activeNotes}
                        tuning={tuning}
                        leftHanded={leftHanded}
                        fitContainer
                        className={`rounded-lg border border-border bg-card/60 ${IMPROV_FRETBOARD_ROWS}`}
                    />
                    <p className="text-xs text-muted-foreground">{t("improv.voicing.legend")}</p>
                </>
            ) : (
                <p className="text-sm text-muted-foreground">{t("improv.voicing.empty")}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={playing || stepCount < 2}
                    onClick={() => { const target = (stepIndex - 1 + stepCount) % stepCount; setManualStep(target); sound(steps[target]); }}
                    aria-label={t("improv.voicing.prev")}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={playing || stepCount < 2}
                    onClick={() => { const target = (stepIndex + 1) % stepCount; setManualStep(target); sound(steps[target]); }}
                    aria-label={t("improv.voicing.next")}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!current} onClick={() => sound(current)}>
                    <Volume2 className="mr-2 h-4 w-4" />
                    {t("improv.voicing.playChord")}
                </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-40 flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("improv.loop.bpm", { bpm })}</Label>
                    <Slider
                        value={[bpm]}
                        min={40}
                        max={160}
                        step={5}
                        onValueChange={(values) => {
                            const value = values[0] ?? params.defaultBpm;
                            setBpm(value);
                            clickerRef.current?.setBpm(value);
                        }}
                    />
                </div>
                <Button type="button" size="sm" variant={playing ? "secondary" : "default"} disabled={stepCount === 0} onClick={playing ? stop : start}>
                    {playing ? t("improv.drill.stop") : t("improv.drill.start")}
                </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                    {t("improv.voicing.runs", { done: Math.min(runs, params.requiredRuns), required: params.requiredRuns })}
                </p>
                <Button
                    type="button"
                    size="sm"
                    variant={passed ? "secondary" : "default"}
                    disabled={!runEarned}
                    title={runEarned ? undefined : t("improv.voicing.runNeedsMetronome", { steps: stepCount })}
                    onClick={() => {
                        if (!runEarned) return;
                        recordDrillRun(moduleId, exercise.id);
                        setRunStartBeat(beats);
                    }}
                >
                    {t("improv.voicing.runButton")}
                </Button>
            </div>
        </ExerciseFrame>
    );
}

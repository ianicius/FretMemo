/**
 * E4 backing-improv engine (run improv-training-2026-11-13).
 *
 * Loops a chord progression as block chords (chord tones staggered a few
 * dozen ms through `playTone`), driven by the lookahead scheduler in
 * src/lib/improv/backingLoop.ts. The prompter shows the CURRENT chord big
 * and the NEXT chord small, the exercise goal is always visible, and after
 * each full pass of the progression the user marks the loop as successful.
 * `requiredPasses` successful loops record the exercise as passed.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { getSoundEngineContext } from "@/audio/engine";
import { playTone } from "@/lib/audio";
import { getChordMidis } from "@/lib/improv/chords";
import { BackingLoopScheduler, type BackingLoopEntry } from "@/lib/improv/backingLoop";
import type { BackingLoopParams, ImprovExercise } from "@/data/improv/curriculum";
import { useImprovStore } from "@/stores/useImprovStore";
import { cn } from "@/lib/utils";
import { ExerciseFrame } from "./ExerciseFrame";
import { localizeToken } from "@/lib/improv/display";

interface BackingLoopExerciseProps {
    moduleId: string;
    exercise: ImprovExercise;
}

const CHORD_TONE_STAGGER_MS = 55;

function playBlockChord(chord: string) {
    const midis = getChordMidis(chord, 48);
    midis.forEach((midi, index) => {
        window.setTimeout(() => {
            void playTone(midi, 1.1);
        }, index * CHORD_TONE_STAGGER_MS);
    });
}

export function BackingLoopExercise({ moduleId, exercise }: BackingLoopExerciseProps) {
    const { t } = useTranslation();
    const params = exercise.params as BackingLoopParams;
    const recordLoopPass = useImprovStore((state) => state.recordLoopPass);
    const passes = useImprovStore((state) => state.moduleState[moduleId]?.exerciseRuns[exercise.id] ?? 0);
    const passed = passes >= params.requiredPasses;

    const [variantId, setVariantId] = useState<string>(params.variants?.[0]?.id ?? "");
    const variant = useMemo(
        () => params.variants?.find((item) => item.id === variantId) ?? null,
        [params.variants, variantId],
    );
    const progression = variant?.progression ?? params.progression;
    const goalKey = variant?.goalKey ?? params.goalKey;

    const [bpm, setBpm] = useState(params.defaultBpm);
    const [playing, setPlaying] = useState(false);
    const [currentChordIndex, setCurrentChordIndex] = useState(0);
    const [loopsCompleted, setLoopsCompleted] = useState(0);
    const [markedLoop, setMarkedLoop] = useState(0);
    const [beatsIntoChord, setBeatsIntoChord] = useState(0);

    const schedulerRef = useRef<BackingLoopScheduler | null>(null);
    const timersRef = useRef<number[]>([]);

    const clearTimers = () => {
        for (const id of timersRef.current) window.clearTimeout(id);
        timersRef.current = [];
    };

    useEffect(() => () => {
        schedulerRef.current?.stop();
        schedulerRef.current = null;
        clearTimers();
    }, []);

    const handleStart = () => {
        schedulerRef.current?.stop();
        clearTimers();
        try {
            getSoundEngineContext();
        } catch {
            // Audio unavailable — the visual prompter still runs.
        }
        setCurrentChordIndex(0);
        setBeatsIntoChord(0);
        setPlaying(true);

        const entries: BackingLoopEntry[] = progression.map((chord) => ({ chord, beats: params.beatsPerChord }));
        const scheduler = new BackingLoopScheduler({
            clock: { now: () => getSoundEngineContext().currentTime },
            progression: entries,
            bpm,
            onChordChange: (info) => {
                const timer = window.setTimeout(() => {
                    setCurrentChordIndex(info.chordIndex);
                    setBeatsIntoChord(0);
                    playBlockChord(info.chord);
                }, info.delayMs);
                timersRef.current.push(timer);
            },
            onBeat: (info) => {
                const timer = window.setTimeout(() => {
                    setBeatsIntoChord(info.beatInChord + 1);
                }, info.delayMs);
                timersRef.current.push(timer);
            },
            onLoopEnd: () => {
                const timer = window.setTimeout(() => {
                    setLoopsCompleted((previous) => previous + 1);
                }, 200);
                timersRef.current.push(timer);
            },
        });
        schedulerRef.current = scheduler;
        scheduler.start();
    };

    const handleStop = () => {
        schedulerRef.current?.stop();
        schedulerRef.current = null;
        clearTimers();
        setPlaying(false);
        setBeatsIntoChord(0);
    };

    const handleBpmChange = (value: number) => {
        setBpm(value);
        schedulerRef.current?.setBpm(value);
    };

    const handleMarkPass = () => {
        if (loopsCompleted <= markedLoop) return;
        setMarkedLoop(loopsCompleted);
        recordLoopPass(moduleId, exercise.id);
    };

    const currentChord = progression[currentChordIndex] ?? progression[0] ?? "";
    const nextChord = progression[(currentChordIndex + 1) % progression.length] ?? "";
    const passAvailable = loopsCompleted > markedLoop;
    const thresholdLabel = t("improv.loop.threshold", { required: params.requiredPasses });

    return (
        <ExerciseFrame
            engine={exercise.engine}
            name={t(exercise.nameKey)}
            description={t(exercise.descKey)}
            thresholdLabel={thresholdLabel}
            passed={passed}
        >
            {params.variants && params.variants.length > 1 && (
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("improv.loop.variant")}</Label>
                    <Select
                        value={variant?.id ?? ""}
                        onChange={(event) => {
                            handleStop();
                            setVariantId(event.target.value);
                            setMarkedLoop(0);
                            setLoopsCompleted(0);
                        }}
                        className="h-9 w-56 text-xs"
                    >
                        {params.variants.map((item) => (
                            <option key={item.id} value={item.id}>{t(item.labelKey)}</option>
                        ))}
                    </Select>
                </div>
            )}

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("improv.loop.goal")}</p>
                <p className="mt-1 text-sm font-medium text-foreground">{t(goalKey)}</p>
            </div>

            <div className="grid grid-cols-[auto_auto] items-baseline justify-center gap-x-6 rounded-lg border border-border bg-card/60 px-4 py-5">
                <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">{t("improv.loop.current")}</p>
                <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">{t("improv.loop.next")}</p>
                <p className="mt-1 text-center text-4xl font-bold tabular-nums text-primary">{localizeToken(currentChord)}</p>
                <p className="mt-1 text-center text-xl font-semibold text-foreground opacity-70">{localizeToken(nextChord)}</p>
                <div className="mt-2 flex justify-center gap-1" aria-hidden="true">
                    {Array.from({ length: params.beatsPerChord }).map((_, beat) => (
                        <span
                            key={beat}
                            className={cn(
                                "h-1.5 w-4 rounded-full transition-colors",
                                playing && beat < beatsIntoChord ? "bg-primary" : "bg-muted-foreground",
                            )}
                        />
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-40 flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("improv.loop.bpm", { bpm })}</Label>
                    <Slider
                        value={[bpm]}
                        min={params.minBpm}
                        max={params.maxBpm}
                        step={5}
                        onValueChange={(values) => handleBpmChange(values[0] ?? params.defaultBpm)}
                    />
                </div>
                <Button type="button" size="sm" variant={playing ? "secondary" : "default"} onClick={playing ? handleStop : handleStart}>
                    {playing ? t("improv.loop.stop") : t("improv.loop.start")}
                </Button>
                <Badge variant="outline" className="text-xs">
                    {t("improv.loop.passes", { done: Math.min(passes, params.requiredPasses), required: params.requiredPasses })}
                </Badge>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{t("improv.loop.markAfterLoop")}</p>
                <Button
                    type="button"
                    size="sm"
                    disabled={!passAvailable}
                    onClick={handleMarkPass}
                >
                    {t("improv.loop.passButton")}
                </Button>
            </div>
        </ExerciseFrame>
    );
}

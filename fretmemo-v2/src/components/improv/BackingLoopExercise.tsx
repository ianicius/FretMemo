/**
 * E4 backing-improv engine (run improv-training-2026-11-13).
 *
 * Loops a chord progression as block chords (chord tones strummed a few
 * dozen ms apart through `playChord`), driven by the lookahead scheduler in
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
import { AudioLines, Mic, MicOff } from "lucide-react";
import { getSoundEngineContext } from "@/audio/engine";
import { playChord, playTone } from "@/lib/audio";
import { getChordMidis, tonicMidi } from "@/lib/improv/chords";
import { BackingLoopScheduler, type BackingLoopEntry } from "@/lib/improv/backingLoop";
import { micLoopPass, type BackingLoopParams, type ImprovExercise, type ProgressionEntry } from "@/data/improv/curriculum";
import { useImprovStore } from "@/stores/useImprovStore";
import { useRhythmDojoStore } from "@/stores/useRhythmDojoStore";
import { usePitchDetector } from "@/services/pitch";
import { Note } from "tonal";
import { cn } from "@/lib/utils";
import { ExerciseFrame } from "./ExerciseFrame";
import { localizeToken } from "@/lib/improv/display";

interface BackingLoopExerciseProps {
    moduleId: string;
    exercise: ImprovExercise;
}

const CHORD_DURATION_SEC = 1.1;
const CHORD_TONE_STAGGER_SEC = 0.055;

interface NormalizedEntry {
    chord: string;
    beats: number;
    hintKey?: string;
}

/** Normalizes `string | ProgressionEntry` entries and applies per-entry beats. */
function normalizeEntries(
    progression: Array<string | ProgressionEntry>,
    defaultBeats: number,
): NormalizedEntry[] {
    return progression.map((entry) => {
        if (typeof entry === "string") return { chord: entry, beats: defaultBeats };
        return { chord: entry.chord, beats: entry.beats ?? defaultBeats, hintKey: entry.hintKey };
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
    const rawProgression = variant?.progression ?? params.progression;
    const goalKey = variant?.goalKey ?? params.goalKey;
    const targets = variant?.targets ?? params.targets;
    const entries = useMemo(
        () => normalizeEntries(rawProgression, params.beatsPerChord),
        [rawProgression, params.beatsPerChord],
    );
    const progression = entries.map((entry) => entry.chord);
    const hintKeys = entries.map((entry) => entry.hintKey);

    const [bpm, setBpm] = useState(params.defaultBpm);
    const [playing, setPlaying] = useState(false);
    const [currentChordIndex, setCurrentChordIndex] = useState(0);
    const [loopsCompleted, setLoopsCompleted] = useState(0);
    const [markedLoop, setMarkedLoop] = useState(0);
    const [beatsIntoChord, setBeatsIntoChord] = useState(0);

    // Mic verification (plan phase 4): optional toggle; when on and the
    // exercise defines targets, the first-beat window of every chord change
    // is checked against the allowed pitch classes. ≥3/4 hits auto-records
    // the loop; without a mic the self-mark button works as before.
    const [micOn, setMicOn] = useState(false);
    const [bassOn, setBassOn] = useState(false);
    const detector = usePitchDetector(micOn);
    const inputLatencyMs = useRhythmDojoStore((state) => state.inputLatencyMs);
    const [chordHit, setChordHit] = useState(false);
    const [loopHits, setLoopHits] = useState(0);
    const hitsRef = useRef(0);
    const hitThisChordRef = useRef(false);

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
        hitsRef.current = 0;
        hitThisChordRef.current = false;
        setLoopHits(0);
        setPlaying(true);

        const loopEntries: BackingLoopEntry[] = entries.map((entry) => ({ chord: entry.chord, beats: entry.beats }));
        const scheduler = new BackingLoopScheduler({
            clock: { now: () => getSoundEngineContext().currentTime },
            progression: loopEntries,
            bpm,
            onChordChange: (info) => {
                const timer = window.setTimeout(() => {
                    setCurrentChordIndex(info.chordIndex);
                    setBeatsIntoChord(0);
                    hitThisChordRef.current = false;
                    setChordHit(false);
                    try {
                        void playChord(getChordMidis(info.chord, 48), CHORD_DURATION_SEC, {
                            strumDelaySec: CHORD_TONE_STAGGER_SEC,
                        });
                        // Plan phase 6: optional bass root on the chord start.
                        if (bassOn) void playTone(tonicMidi(info.chord, 36), 1.6);
                    } catch {
                        // Audio unavailable — the visual prompter still runs.
                    }
                }, info.delayMs);
                timersRef.current.push(timer);
            },
            onBeat: (info) => {
                const timer = window.setTimeout(() => {
                    setBeatsIntoChord(info.beatInChord + 1);
                    if (info.beatInChord === 1) {
                        // End of the first-beat window — evaluate the mic hit,
                        // shifted by the measured input latency (plan phase 4).
                        const evalTimer = window.setTimeout(() => evaluateMicHit(info.chordIndex), Math.max(0, inputLatencyMs));
                        timersRef.current.push(evalTimer);
                    }
                    // Plan phase 6: bass root on the back half of the chord.
                    if (bassOn && info.beatInChord === 2) {
                        try {
                            void playTone(tonicMidi(info.chord, 36), 1.2);
                        } catch {
                            // Audio unavailable.
                        }
                    }
                }, info.delayMs);
                timersRef.current.push(timer);
            },
            onLoopEnd: () => {
                const timer = window.setTimeout(() => {
                    setLoopsCompleted((previous) => previous + 1);
                    // Mic-verified pass: ≥3/4 chord changes hit (plan phase 4).
                    if (micOn && targets && micLoopPass(hitsRef.current, entries.length)) {
                        recordLoopPass(moduleId, exercise.id);
                        setMarkedLoop((previous) => previous + 1);
                    }
                    hitsRef.current = 0;
                    setLoopHits(0);
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
        hitsRef.current = 0;
        hitThisChordRef.current = false;
        setLoopHits(0);
    };

    const handleBpmChange = (value: number) => {
        setBpm(value);
        schedulerRef.current?.setBpm(value);
    };

    // Mirror the detector's stable note into a ref so scheduler callbacks
    // (timer closures) can read the latest detection.
    const detectedNoteRef = useRef<string | null>(null);
    useEffect(() => {
        detectedNoteRef.current = detector.note;
    }, [detector.note]);

    /** Mic hit check at the end of the first beat: the detected pitch class
     * must belong to the current chord's target set (plan phase 4). */
    const evaluateMicHit = (chordIndex: number) => {
        if (!micOn || !targets || hitThisChordRef.current) return;
        const currentChord = entries[chordIndex]?.chord;
        const targetsForChord = targets.find((entry) => entry.chord === currentChord);
        const detected = detectedNoteRef.current;
        if (!currentChord || !targetsForChord || !detected) return;
        const detectedPc = Note.chroma(detected);
        if (targetsForChord.pitchClasses.some((pitchClass) => Note.chroma(pitchClass) === detectedPc)) {
            hitThisChordRef.current = true;
            hitsRef.current += 1;
            setChordHit(true);
            setLoopHits(hitsRef.current);
        }
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
                <p
                    className={cn(
                        "mt-1 text-center text-4xl font-bold tabular-nums",
                        micOn && targets && chordHit ? "text-emerald-500 dark:text-emerald-300" : "text-primary",
                    )}
                >
                    {localizeToken(currentChord)}
                </p>
                <p className="mt-1 text-center text-xl font-semibold text-foreground opacity-70">{localizeToken(nextChord)}</p>
                <p className="col-span-2 mt-1 min-h-[1.25rem] text-center text-xs text-muted-foreground">
                    {hintKeys[currentChordIndex] ? t(hintKeys[currentChordIndex] as string) : ""}
                </p>
                <div className="col-span-2 flex justify-center gap-1" aria-hidden="true">
                    {Array.from({ length: entries[currentChordIndex]?.beats ?? params.beatsPerChord }).map((_, beat) => (
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

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant={bassOn ? "secondary" : "outline"}
                    onClick={() => setBassOn((previous) => !previous)}
                >
                    <AudioLines className="mr-2 h-4 w-4" />
                    {t("improv.loop.bass")}
                </Button>
            </div>
            {targets && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant={micOn ? "secondary" : "outline"}
                        onClick={() => {
                            setMicOn((previous) => !previous);
                            if (micOn) {
                                setChordHit(false);
                            }
                        }}
                    >
                        {micOn ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                        {micOn ? t("improv.loop.micDisable") : t("improv.loop.micEnable")}
                    </Button>
                    {micOn && (
                        <Badge variant="outline" className="text-xs">
                            {t("improv.loop.micHits", { done: loopHits, total: entries.length })}
                        </Badge>
                    )}
                </div>
            )}
            {micOn && (
                <p className="text-xs text-muted-foreground">
                    {detector.error
                        ? t("improv.loop.micError")
                        : t("improv.loop.micWindowHint")}
                </p>
            )}
            {micOn && detector.error === null && detector.note !== null && (
                <p className="text-xs text-muted-foreground" aria-live="polite">
                    {t("improv.loop.micDetected", { note: localizeToken(detector.note) })}
                </p>
            )}

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

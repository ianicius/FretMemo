/**
 * E4 backing-improv engine (run improv-training-2026-11-13).
 *
 * Loops a chord progression as block chords (chord tones strummed a few
 * dozen ms apart through `playChord`), driven by the lookahead scheduler in
 * src/lib/improv/backingLoop.ts. The prompter shows the CURRENT chord big
 * and the NEXT chord small, the exercise goal is always visible, and after
 * each full pass of the progression the user marks the loop as successful.
 * `requiredPasses` successful loops record the exercise as passed.
 *
 * Plan stage B: a toggleable fretboard under the prompter shows the current
 * chord's tones (B1), a key selector transposes chords and mic targets (B2),
 * a per-chord hit report follows every mic-checked loop (B3) and an optional
 * tempo ramp adds 5 BPM every two successful loops (B5). Mic-verified passes
 * are recorded as verified (A2).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { AudioLines, Mic, MicOff } from "lucide-react";
import { getSoundEngineContext } from "@/audio/engine";
import { playChord, playTone } from "@/lib/audio";
import { getChordMidis, getChordTonePositions, tonicMidi } from "@/lib/improv/chords";
import { BackingLoopScheduler, type BackingLoopEntry } from "@/lib/improv/backingLoop";
import { DRUM_STYLE_IDS, scheduleDrumBeat, type DrumStyleId } from "@/lib/improv/drumStyles";
import {
    keyChoices,
    keyPitchClass,
    keyShiftInterval,
    loopChordReport,
    loopKey,
    rampBpmAfterPass,
    transposeProgression,
    transposeTargets,
    type ChordHitResult,
} from "@/lib/improv/loopTools";
import {
    isExercisePassed,
    isExerciseVerified,
    isNonGating,
    loopRunKey,
    micLoopPass,
    type BackingLoopParams,
    type ImprovExercise,
    type ProgressionEntry,
} from "@/data/improv/curriculum";
import { selectModuleProgress, useImprovStore } from "@/stores/useImprovStore";
import { useRhythmDojoStore } from "@/stores/useRhythmDojoStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { normalizeTuning } from "@/lib/tuning";
import type { NoteStatus } from "@/types/fretboard";
import { usePitchDetector } from "@/services/pitch";
import { Note } from "tonal";
import { cn } from "@/lib/utils";
import { ExerciseFrame } from "./ExerciseFrame";
import { LoopHitReport } from "./LoopHitReport";
import { barCue, IMPROV_FRETBOARD_ROWS, localizeToken, type BarCue } from "@/lib/improv/display";

/** Static (not animated) label pill of a phrasing-loop bar; same size for every cue so bars do not shift the layout. */
const BAR_CUE_PILL: Record<BarCue, string> = {
    play: "bg-primary/15 text-primary",
    rest: "bg-foreground text-background",
    call: "bg-primary/15 text-primary",
    answer: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

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

/** Monotonic clock for the play-time counter; read only from the Start/Stop handlers. */
const clockSeconds = () => performance.now() / 1000;

/** Plan F3: time over the backing counts from Start to Stop, and to leaving the page mid-loop. */
function flushPlayTime(startedAt: { current: number | null }) {
    if (startedAt.current === null) return;
    useImprovStore.getState().addLoopSeconds(clockSeconds() - startedAt.current);
    startedAt.current = null;
}

export function BackingLoopExercise({ moduleId, exercise }: BackingLoopExerciseProps) {
    const { t } = useTranslation();
    const params = exercise.params as BackingLoopParams;
    const recordLoopPass = useImprovStore((state) => state.recordLoopPass);
    const progress = useImprovStore((state) => selectModuleProgress(state, moduleId));
    const passed = isExercisePassed(exercise, progress);
    const unverified = passed && !isExerciseVerified(exercise, progress);
    const leftHanded = useSettingsStore((state) => state.full.instrument.leftHanded);
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);

    const [variantId, setVariantId] = useState<string>(params.variants?.[0]?.id ?? "");
    const variant = useMemo(
        () => params.variants?.find((item) => item.id === variantId) ?? null,
        [params.variants, variantId],
    );
    // Passes are counted per variant; the exercise needs every variant.
    const runKey = loopRunKey(exercise.id, variant?.id);
    const passes = progress.exerciseRuns[runKey] ?? 0;
    const sourceProgression = variant?.progression ?? params.progression;
    const goalKey = variant?.goalKey ?? params.goalKey;
    const sourceTargets = variant?.targets ?? params.targets;

    // B2: transposition — chords and mic targets move by the same interval;
    // goal/hint texts stay written for the original key (notice below).
    const firstEntry = sourceProgression[0];
    const originalKey = loopKey(
        variant?.key ?? params.key,
        typeof firstEntry === "string" ? firstEntry : firstEntry?.chord ?? "C",
    );
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const activeKey = selectedKey ?? originalKey;
    const shiftInterval = keyShiftInterval(originalKey, activeKey);
    const transposed = shiftInterval !== "1P";
    const targets = transposeTargets(sourceTargets, shiftInterval);
    const entries = normalizeEntries(transposeProgression(sourceProgression, shiftInterval), params.beatsPerChord);
    const progression = entries.map((entry) => entry.chord);
    const hintKeys = entries.map((entry) => entry.hintKey);

    const [bpm, setBpm] = useState(params.defaultBpm);
    const bpmRef = useRef(bpm);
    useEffect(() => { bpmRef.current = bpm; }, [bpm]);
    const [showFretboard, setShowFretboard] = useState(true);
    // B5: optional ramp; counts successful loops since start / toggle on.
    const [rampOn, setRampOn] = useState(false);
    const rampOnRef = useRef(rampOn);
    useEffect(() => { rampOnRef.current = rampOn; }, [rampOn]);
    const sessionPassesRef = useRef(0);
    // B3: per-chord result of the last mic-checked loop.
    const [lastReport, setLastReport] = useState<ChordHitResult[] | null>(null);
    const [playing, setPlaying] = useState(false);
    const startedAtRef = useRef<number | null>(null);
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
    // Scheduler callbacks are created at start: refs let mic/bass toggles
    // take effect mid-loop instead of after a restart.
    const micOnRef = useRef(micOn);
    const bassOnRef = useRef(bassOn);
    const drumStyle = useImprovStore((state) => state.drumStyle);
    const setDrumStyle = useImprovStore((state) => state.setDrumStyle);
    const drumStyleRef = useRef(drumStyle);
    useEffect(() => { drumStyleRef.current = drumStyle; }, [drumStyle]);
    useEffect(() => { micOnRef.current = micOn; }, [micOn]);
    useEffect(() => { bassOnRef.current = bassOn; }, [bassOn]);
    const [loopHits, setLoopHits] = useState(0);
    const hitsRef = useRef(0);
    const hitThisChordRef = useRef(false);
    const hitFlagsRef = useRef<boolean[]>([]);

    const schedulerRef = useRef<BackingLoopScheduler | null>(null);
    const timersRef = useRef<number[]>([]);

    const clearTimers = () => {
        for (const id of timersRef.current) window.clearTimeout(id);
        timersRef.current = [];
    };

    useEffect(() => () => {
        flushPlayTime(startedAtRef);
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
        hitFlagsRef.current = [];
        sessionPassesRef.current = 0;
        setLoopHits(0);
        setLastReport(null);
        setPlaying(true);

        const loopEntries: BackingLoopEntry[] = entries.map((entry) => ({ chord: entry.chord, beats: entry.beats }));
        const scheduler = new BackingLoopScheduler({
            clock: { now: () => getSoundEngineContext().currentTime },
            progression: loopEntries,
            bpm,
            onBeatSchedule: (info) => {
                if (drumStyleRef.current === "off") return;
                try {
                    scheduleDrumBeat(getSoundEngineContext(), drumStyleRef.current, info.beatInLoop % 4, info.time, 60 / bpmRef.current);
                } catch {
                    // Audio unavailable — the visual prompter still runs.
                }
            },
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
                        if (bassOnRef.current) void playTone(tonicMidi(info.chord, 36), 1.6);
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
                    if (bassOnRef.current && info.beatInChord === 2) {
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
                    if (micOnRef.current && targets) {
                        setLastReport(loopChordReport(entries.map((entry) => entry.chord), hitFlagsRef.current));
                        // Mic-verified pass: ≥3/4 chord changes hit (plan phase 4), stored as verified (A2).
                        if (micLoopPass(hitsRef.current, entries.length)) {
                            recordLoopPass(moduleId, exercise.id, variant?.id, true);
                            setMarkedLoop((previous) => previous + 1);
                            applyRamp();
                        }
                    }
                    hitsRef.current = 0;
                    hitFlagsRef.current = [];
                    setLoopHits(0);
                }, 200);
                timersRef.current.push(timer);
            },
        });
        schedulerRef.current = scheduler;
        scheduler.start();
        startedAtRef.current = clockSeconds();
    };

    const handleStop = () => {
        flushPlayTime(startedAtRef);
        schedulerRef.current?.stop();
        schedulerRef.current = null;
        clearTimers();
        setPlaying(false);
        setBeatsIntoChord(0);
        hitsRef.current = 0;
        hitThisChordRef.current = false;
        hitFlagsRef.current = [];
        setLoopHits(0);
    };

    const handleBpmChange = (value: number) => {
        bpmRef.current = value;
        setBpm(value);
        schedulerRef.current?.setBpm(value);
    };

    /** B5: after a successful loop, +5 BPM on every second pass (capped at maxBpm). */
    const applyRamp = () => {
        sessionPassesRef.current += 1;
        if (!rampOnRef.current) return;
        const next = rampBpmAfterPass(bpmRef.current, sessionPassesRef.current, params.maxBpm);
        if (next !== bpmRef.current) handleBpmChange(next);
    };

    /** Variant/key switches restart the loop and its per-session counters. */
    const resetSession = () => {
        handleStop();
        setMarkedLoop(0);
        setLoopsCompleted(0);
        setLastReport(null);
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
        if (!micOnRef.current || !targets || hitThisChordRef.current) return;
        const currentChord = entries[chordIndex]?.chord;
        const targetsForChord = targets.find((entry) => entry.chord === currentChord);
        const detected = detectedNoteRef.current;
        if (!currentChord || !targetsForChord || !detected) return;
        const detectedPc = Note.chroma(detected);
        if (targetsForChord.pitchClasses.some((pitchClass) => Note.chroma(pitchClass) === detectedPc)) {
            hitThisChordRef.current = true;
            hitFlagsRef.current[chordIndex] = true;
            hitsRef.current += 1;
            setChordHit(true);
            setLoopHits(hitsRef.current);
        }
    };

    const handleMarkPass = () => {
        if (loopsCompleted <= markedLoop) return;
        setMarkedLoop(loopsCompleted);
        // Self-marked = unverified (A2).
        recordLoopPass(moduleId, exercise.id, variant?.id, false);
        applyRamp();
    };

    const currentChord = progression[currentChordIndex] ?? progression[0] ?? "";
    const currentTargets = targets?.find((entry) => entry.chord === currentChord)?.pitchClasses;
    // B1: chord tones of the current chord (root emphasized, mic targets green).
    const chordToneNotes: NoteStatus[] = getChordTonePositions(currentChord, { tuning, fretFrom: 1, fretTo: 12, targets: currentTargets })
        .map((position) => ({
            position: { stringIndex: position.stringIndex, fret: position.fret, note: position.note },
            status: position.isTarget ? "correct" : "active",
            label: position.label,
            emphasis: position.isRoot ? "strong" : "normal",
        }));
    const keyOptions = keyChoices(originalKey);
    const originalPc = keyPitchClass(originalKey);
    const nextChord = progression[(currentChordIndex + 1) % progression.length] ?? "";
    const currentHintKey = hintKeys[currentChordIndex];
    const cue = barCue(currentHintKey);
    const resting = cue === "rest";
    const passAvailable = loopsCompleted > markedLoop;
    const thresholdLabel = t("improv.loop.threshold", { required: params.requiredPasses });

    return (
        <ExerciseFrame
            engine={exercise.engine}
            name={t(exercise.nameKey)}
            description={t(exercise.descKey)}
            thresholdLabel={thresholdLabel}
            passed={passed}
            unverified={unverified}
        >
            {isNonGating(exercise) && (
                <Badge variant="secondary" className="w-fit text-[10px]">{t("improv.practiceLink.extra")}</Badge>
            )}
            <div className="flex flex-wrap items-end gap-3">
                {params.variants && params.variants.length > 1 && (
                    <div className="min-w-0 space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("improv.loop.variant")}</Label>
                        <Select
                            value={variant?.id ?? ""}
                            onChange={(event) => {
                                resetSession();
                                setVariantId(event.target.value);
                                setSelectedKey(null);
                            }}
                            className="h-9 w-56 max-w-full text-xs"
                        >
                            {params.variants.map((item) => (
                                <option key={item.id} value={item.id}>{t(item.labelKey)}</option>
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
                            resetSession();
                            setSelectedKey(pc === originalPc ? null : keyOptions[pc] ?? null);
                        }}
                        className="h-9 w-36 text-xs"
                        aria-label={t("improv.loop.key")}
                    >
                        {keyOptions.map((option, pc) => (
                            <option key={option} value={pc}>
                                {pc === originalPc
                                    ? t("improv.loop.keyOriginal", { key: localizeToken(originalKey) })
                                    : localizeToken(option)}
                            </option>
                        ))}
                    </Select>
                </div>
            </div>
            {params.variants && params.variants.length > 1 && (
                <p className="text-xs text-muted-foreground">{t("improv.loop.allVariants")}</p>
            )}

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("improv.loop.goal")}</p>
                <p className="mt-1 text-sm font-medium text-foreground">{t(goalKey)}</p>
                {transposed && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                        {t("improv.loop.transposedNotice", { key: localizeToken(originalKey) })}
                    </p>
                )}
            </div>

            <div
                data-bar-cue={cue ?? undefined}
                className={cn(
                    "grid grid-cols-[auto_auto] items-baseline justify-center gap-x-6 rounded-lg border border-border bg-card/60 px-4 py-5",
                    resting && "border-dashed border-muted-foreground bg-muted/60",
                )}
            >
                <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">{t("improv.loop.current")}</p>
                <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">{t("improv.loop.next")}</p>
                <p
                    className={cn(
                        "mt-1 text-center text-4xl font-bold tabular-nums",
                        // Rest bar: chord stays readable (the player listens and plans) but loses the amber "play" colour.
                        resting ? "text-muted-foreground" : micOn && targets && chordHit ? "text-emerald-500 dark:text-emerald-300" : "text-primary",
                    )}
                >
                    {localizeToken(currentChord)}
                </p>
                <p className="mt-1 text-center text-xl font-semibold text-foreground opacity-70">{localizeToken(nextChord)}</p>
                {cue ? (
                    <p className="col-span-2 my-2 text-center">
                        <span className={cn("inline-block rounded-full px-3 py-0.5 text-lg font-bold uppercase tracking-wide", BAR_CUE_PILL[cue])}>
                            {t(currentHintKey as string)}
                        </span>
                    </p>
                ) : (
                    <p className="col-span-2 mt-1 min-h-[1.25rem] text-center text-xs text-muted-foreground">
                        {currentHintKey ? t(currentHintKey) : ""}
                    </p>
                )}
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

            {showFretboard && (
                <div className={cn("space-y-1", resting && "opacity-40")}>
                    <Fretboard
                        frets={12}
                        activeNotes={chordToneNotes}
                        tuning={tuning}
                        leftHanded={leftHanded}
                        fitContainer
                        className={`rounded-lg border border-border bg-card/60 ${IMPROV_FRETBOARD_ROWS}`}
                    />
                    <p className="text-xs text-muted-foreground">
                        {t("improv.loop.fretboardLegend")}
                        {currentTargets ? ` ${t("improv.loop.fretboardLegendTargets")}` : ""}
                    </p>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Button
                    type="button"
                    size="sm"
                    variant={bassOn ? "secondary" : "outline"}
                    onClick={() => setBassOn((previous) => !previous)}
                >
                    <AudioLines className="mr-2 h-4 w-4" />
                    {t("improv.loop.bass")}
                </Button>
                <Select
                    value={drumStyle}
                    onChange={(event) => setDrumStyle(event.target.value as DrumStyleId)}
                    className="h-9 w-40 text-xs"
                    aria-label={t("improv.loop.drums")}
                >
                    {DRUM_STYLE_IDS.map((style) => (
                        <option key={style} value={style}>{t(`improv.loop.drumStyle.${style}`)}</option>
                    ))}
                </Select>
                <div className="flex items-center gap-2">
                    <Switch
                        id={`${exercise.id}-fretboard`}
                        checked={showFretboard}
                        onCheckedChange={setShowFretboard}
                    />
                    <Label htmlFor={`${exercise.id}-fretboard`} className="text-xs">{t("improv.loop.fretboardToggle")}</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        id={`${exercise.id}-ramp`}
                        checked={rampOn}
                        onCheckedChange={(value) => {
                            setRampOn(value);
                            sessionPassesRef.current = 0;
                        }}
                    />
                    <Label htmlFor={`${exercise.id}-ramp`} className="text-xs">{t("improv.loop.rampToggle")}</Label>
                </div>
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
            {lastReport && <LoopHitReport results={lastReport} />}

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

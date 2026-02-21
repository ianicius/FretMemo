import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SessionModeToggle } from "@/components/session-setup/session-mode-toggle";
import { SessionStartActions } from "@/components/session-setup/session-start-actions";
import { SessionStopButton } from "@/components/session-setup/session-stop-button";
import { SessionSummaryCard } from "@/components/session-setup/session-summary-card";
import { TempoNumberField } from "@/components/session-setup/tempo-number-field";
import { GROOVE_PRESETS, type GroovePreset } from "@/rhythm/data/groovePresets";
import { getExpectedStepFromSymbol } from "@/rhythm/data/strumPatterns";
import { RhythmClock } from "@/rhythm/engine/RhythmClock";
import { MetronomeScheduler, type ScheduledStep } from "@/rhythm/engine/MetronomeScheduler";
import type { StrumDirection, TapEvaluation } from "@/rhythm/engine/InputEvaluator";
import {
    DEFAULT_MATCH_WINDOW_SEC,
    TIMING_WINDOWS_RELAXED,
    applyInputLatencyCompensation,
    evaluateTapTiming,
    summarizeEvaluations,
    type RhythmSessionSummary,
} from "@/rhythm/engine/InputEvaluator";
import { LatencyCompensationControl } from "@/rhythm/ui/LatencyCompensationControl";
import { PatternGrid } from "@/rhythm/ui/PatternGrid";
import { TapZone } from "@/rhythm/ui/TapZone";
import { TimingFeedback } from "@/rhythm/ui/TimingFeedback";
import { trackEvent } from "@/lib/analytics";
import { useProgressStore } from "@/stores/useProgressStore";
import { useRhythmDojoStore } from "@/stores/useRhythmDojoStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface GrooveLabSettings {
    bpm: number;
    bars: number;
    presetId: string;
    clickEnabled: boolean;
    echoMode: boolean;
}

interface ExpectedGrooveStep {
    id: number;
    time: number;
    direction: StrumDirection;
    muted: boolean;
    matched: boolean;
}

interface GrooveSessionSummary extends RhythmSessionSummary {
    directionAccuracy: number;
}

type SessionStatus = "idle" | "running" | "finished";
type GroovePhase = "listen" | "play";
type SessionMode = "scored" | "practice";

const MATCH_WINDOW_SEC = DEFAULT_MATCH_WINDOW_SEC;

const DEFAULT_SETTINGS: GrooveLabSettings = {
    bpm: 88,
    bars: 8,
    presetId: "straight-8-rock",
    clickEnabled: true,
    echoMode: false,
};

function scheduleKick(context: AudioContext, time: number, accent = false): void {
    const osc = context.createOscillator();
    const gain = context.createGain();

    const peak = accent ? 0.25 : 0.18;
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + 0.08);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(time);
    osc.stop(time + 0.11);
}

function scheduleHat(context: AudioContext, time: number, accent = false): void {
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(accent ? 5200 : 4300, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.08 : 0.05, time + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(time);
    osc.stop(time + 0.035);
}

function createNoiseSource(context: AudioContext, durationSec: number): AudioBufferSourceNode {
    const length = Math.max(1, Math.round(context.sampleRate * durationSec));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
        data[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    return source;
}

function scheduleSnare(context: AudioContext, time: number, accent = false): void {
    const toneOsc = context.createOscillator();
    const toneGain = context.createGain();
    toneOsc.type = "triangle";
    toneOsc.frequency.setValueAtTime(210, time);
    toneOsc.frequency.exponentialRampToValueAtTime(140, time + 0.05);

    toneGain.gain.setValueAtTime(0.0001, time);
    toneGain.gain.exponentialRampToValueAtTime(accent ? 0.14 : 0.11, time + 0.002);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);

    toneOsc.connect(toneGain);
    toneGain.connect(context.destination);
    toneOsc.start(time);
    toneOsc.stop(time + 0.1);

    const noise = createNoiseSource(context, 0.045);
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(2100, time);
    noiseFilter.Q.setValueAtTime(0.7, time);

    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.12, time + 0.0015);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(context.destination);
    noise.start(time);
    noise.stop(time + 0.055);
}

function scheduleGrooveDrums(clock: RhythmClock, preset: GroovePreset, step: ScheduledStep): void {
    const context = clock.getContext();
    const slotIndex = step.barStepIndex % preset.slots.length;
    const accentHat = preset.drums.accentHat?.includes(slotIndex) ?? false;
    const strongKick = step.isBarStart || accentHat;

    if (preset.drums.kick.includes(slotIndex)) {
        scheduleKick(context, step.time, strongKick);
    }
    if (preset.drums.snare.includes(slotIndex)) {
        scheduleSnare(context, step.time, accentHat);
    }
    if (preset.drums.hat.includes(slotIndex)) {
        scheduleHat(context, step.time, accentHat);
    }
}

export function GrooveLabMode() {
    const { t } = useTranslation();
    const clockRef = useRef(new RhythmClock());
    const schedulerRef = useRef<MetronomeScheduler | null>(null);
    const expectedStepsRef = useRef<ExpectedGrooveStep[]>([]);
    const evaluationsRef = useRef<TapEvaluation[]>([]);
    const extrasRef = useRef(0);
    const finishTimerRef = useRef<number | null>(null);
    const scheduleTokenRef = useRef(0);
    const startedAtRef = useRef<number | null>(null);
    const statusRef = useRef<SessionStatus>("idle");
    const phaseRef = useRef<GroovePhase>("play");
    const sessionModeRef = useRef<SessionMode>("scored");
    const finalizeRef = useRef<() => void>(() => { });

    const checkAndUpdateStreak = useProgressStore((state) => state.checkAndUpdateStreak);
    const recordSession = useProgressStore((state) => state.recordSession);
    const updatePracticeTime = useProgressStore((state) => state.updatePracticeTime);
    const recordRhythmSession = useRhythmDojoStore((state) => state.recordRhythmSession);
    const inputLatencyMs = useRhythmDojoStore((state) => state.inputLatencyMs);
    const setInputLatencyMs = useRhythmDojoStore((state) => state.setInputLatencyMs);

    const [settings, setSettings] = useState<GrooveLabSettings>(DEFAULT_SETTINGS);
    const [status, setStatus] = useState<SessionStatus>("idle");
    const [sessionMode, setSessionMode] = useState<SessionMode>("scored");
    const [phase, setPhase] = useState<GroovePhase>("play");
    const [currentBar, setCurrentBar] = useState(1);
    const [playheadStep, setPlayheadStep] = useState<number | null>(null);
    const [lastEvaluation, setLastEvaluation] = useState<TapEvaluation | null>(null);
    const [summary, setSummary] = useState<GrooveSessionSummary | null>(null);

    const activePreset = useMemo<GroovePreset>(
        () => GROOVE_PRESETS.find((preset) => preset.id === settings.presetId) ?? GROOVE_PRESETS[0],
        [settings.presetId],
    );
    const activePresetTitle = t(`rhythm.grooveLab.presets.${activePreset.id}.title`, activePreset.title);
    const activePresetGenre = t(`rhythm.grooveLab.presets.${activePreset.id}.genre`, activePreset.genre);
    const activePresetDescription = t(
        `rhythm.grooveLab.presets.${activePreset.id}.description`,
        activePreset.description,
    );
    const activePresetFeel = t(`rhythm.grooveLab.feels.${activePreset.feel}`, activePreset.feel);
    const responseStartBar = useMemo(
        () => (settings.echoMode ? Math.max(1, Math.floor(settings.bars / 2)) : 0),
        [settings.bars, settings.echoMode],
    );
    const responseBars = useMemo(
        () => (settings.echoMode ? Math.max(1, settings.bars - responseStartBar) : settings.bars),
        [responseStartBar, settings.bars, settings.echoMode],
    );
    const totalSteps = useMemo(
        () => settings.bars * activePreset.slots.length,
        [activePreset.slots.length, settings.bars],
    );
    const expectedPerBar = useMemo(
        () => activePreset.slots.filter((slot) => slot !== "R").length,
        [activePreset.slots],
    );
    const totalExpected = useMemo(
        () => responseBars * expectedPerBar,
        [expectedPerBar, responseBars],
    );

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);

    useEffect(() => {
        sessionModeRef.current = sessionMode;
    }, [sessionMode]);

    const stopScheduler = useCallback(() => {
        scheduleTokenRef.current += 1;
        if (finishTimerRef.current !== null) {
            window.clearTimeout(finishTimerRef.current);
            finishTimerRef.current = null;
        }
        schedulerRef.current?.stop();
        schedulerRef.current = null;
    }, []);

    const finalizeSession = useCallback(() => {
        if (sessionModeRef.current !== "scored") return;
        if (statusRef.current !== "running") return;
        stopScheduler();

        const summaryResult = summarizeEvaluations(evaluationsRef.current, totalExpected, extrasRef.current);
        const directionCorrectCount = evaluationsRef.current.filter((evaluation) => evaluation.directionCorrect).length;
        const directionAccuracy = evaluationsRef.current.length > 0
            ? Math.round((directionCorrectCount / evaluationsRef.current.length) * 100)
            : 0;

        setSummary({
            ...summaryResult,
            directionAccuracy,
        });
        setStatus("finished");
        statusRef.current = "finished";
        setPlayheadStep(null);

        recordRhythmSession({
            mode: "groove-lab",
            totalExpected: summaryResult.totalExpected,
            hits: summaryResult.hits,
            misses: summaryResult.misses,
            extras: summaryResult.extras,
            avgOffsetMs: summaryResult.avgOffsetMs,
            score: summaryResult.score,
        });

        const durationSeconds = startedAtRef.current
            ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
            : 0;
        const incorrect = summaryResult.misses + summaryResult.extras;
        recordSession({
            startedAt: startedAtRef.current,
            correct: summaryResult.hits,
            incorrect,
            durationSeconds,
        });

        if (durationSeconds > 0) {
            const minutes = Math.floor(durationSeconds / 60);
            if (minutes > 0) {
                updatePracticeTime(minutes);
            }
        }

        trackEvent("fm_v2_rhythm_session_ended", {
            mode: "groove-lab",
            preset_id: activePreset.id,
            feel: activePreset.feel,
            tempo: settings.bpm,
            bars: settings.bars,
            echo_mode: settings.echoMode,
            response_bars: responseBars,
            total_expected: summaryResult.totalExpected,
            hits: summaryResult.hits,
            misses: summaryResult.misses,
            extras: summaryResult.extras,
            avg_offset_ms: summaryResult.avgOffsetMs,
            direction_accuracy: directionAccuracy,
            score: summaryResult.score,
            duration_seconds: durationSeconds,
            input_latency_ms: inputLatencyMs,
            session_mode: "scored",
        });
    }, [
        activePreset.feel,
        activePreset.id,
        inputLatencyMs,
        recordRhythmSession,
        recordSession,
        responseBars,
        settings.bars,
        settings.bpm,
        settings.echoMode,
        stopScheduler,
        totalExpected,
        updatePracticeTime,
    ]);

    useEffect(() => {
        finalizeRef.current = finalizeSession;
    }, [finalizeSession]);

    const startSessionWithMode = useCallback(async (mode: SessionMode) => {
        await clockRef.current.warmUp();
        checkAndUpdateStreak();

        stopScheduler();
        expectedStepsRef.current = [];
        evaluationsRef.current = [];
        extrasRef.current = 0;
        startedAtRef.current = Date.now();
        const scheduleToken = scheduleTokenRef.current;

        setSummary(null);
        setLastEvaluation(null);
        setPlayheadStep(null);
        setSessionMode(mode);
        sessionModeRef.current = mode;
        setStatus("running");
        statusRef.current = "running";
        const initialPhase: GroovePhase = settings.echoMode ? "listen" : "play";
        setPhase(initialPhase);
        phaseRef.current = initialPhase;
        setCurrentBar(1);

        const scheduler = new MetronomeScheduler({
            clock: clockRef.current,
            bpm: settings.bpm,
            timeSignatureTop: activePreset.timeSignatureTop,
            subdivision: activePreset.subdivision,
            maxSteps: mode === "scored" ? totalSteps : undefined,
            clickEnabled: settings.clickEnabled,
            onStep: (step) => {
                const effectiveBarIndex = mode === "practice"
                    ? step.barIndex % settings.bars
                    : step.barIndex;
                const slotIndex = step.barStepIndex % activePreset.slots.length;
                const isResponseBar = effectiveBarIndex >= responseStartBar;
                const shouldPlayBacking = !settings.echoMode || !isResponseBar;

                if (shouldPlayBacking) {
                    scheduleGrooveDrums(clockRef.current, activePreset, step);
                }

                if (mode === "scored" && isResponseBar) {
                    const symbol = activePreset.slots[slotIndex];
                    const expected = getExpectedStepFromSymbol(symbol);
                    if (expected) {
                        expectedStepsRef.current.push({
                            id: step.index,
                            time: step.time,
                            direction: expected.direction,
                            muted: expected.muted,
                            matched: false,
                        });
                    }
                }

                const delayMs = clockRef.current.toDelayMs(step.time);
                window.setTimeout(() => {
                    if (scheduleTokenRef.current !== scheduleToken) return;
                    setPlayheadStep(slotIndex);
                    setCurrentBar(effectiveBarIndex + 1);
                    const nextPhase: GroovePhase = isResponseBar ? "play" : "listen";
                    setPhase(nextPhase);
                    phaseRef.current = nextPhase;
                }, delayMs);
            },
        });

        schedulerRef.current = scheduler;
        scheduler.start();

        if (mode === "scored") {
            const stepDurationSec = 60 / settings.bpm / activePreset.subdivision;
            const durationMs = Math.ceil(totalSteps * stepDurationSec * 1000 + 360);
            finishTimerRef.current = window.setTimeout(() => {
                finalizeRef.current();
            }, durationMs);
        }

        trackEvent("fm_v2_rhythm_session_started", {
            mode: "groove-lab",
            preset_id: activePreset.id,
            feel: activePreset.feel,
            tempo: settings.bpm,
            bars: settings.bars,
            echo_mode: settings.echoMode,
            response_bars: responseBars,
            click_enabled: settings.clickEnabled,
            subdivision: activePreset.subdivision,
            total_expected: mode === "scored" ? totalExpected : 0,
            input_latency_ms: inputLatencyMs,
            session_mode: mode,
        });
    }, [
        activePreset,
        checkAndUpdateStreak,
        inputLatencyMs,
        responseBars,
        responseStartBar,
        settings.bars,
        settings.bpm,
        settings.clickEnabled,
        settings.echoMode,
        stopScheduler,
        totalExpected,
        totalSteps,
    ]);

    const handleTap = useCallback((direction: StrumDirection) => {
        if (sessionModeRef.current !== "scored") return;
        if (statusRef.current !== "running") return;
        if (phaseRef.current !== "play") return;

        const rawTapTime = clockRef.current.now();
        const tapTime = applyInputLatencyCompensation(rawTapTime, inputLatencyMs);
        const nearestStep = expectedStepsRef.current
            .filter((step) => !step.matched)
            .map((step) => ({
                step,
                offsetSec: tapTime - step.time,
                absOffsetSec: Math.abs(tapTime - step.time),
            }))
            .sort((left, right) => left.absOffsetSec - right.absOffsetSec)[0];

        const candidate = nearestStep && nearestStep.absOffsetSec <= MATCH_WINDOW_SEC
            ? nearestStep
            : null;

        if (!candidate) {
            extrasRef.current += 1;
            const offsetMs = nearestStep ? nearestStep.offsetSec * 1000 : 0;
            const extraEvaluation: TapEvaluation = {
                offsetMs,
                absOffsetMs: Math.abs(offsetMs),
                rating: "miss",
                isHit: false,
                directionCorrect: true,
            };
            setLastEvaluation(extraEvaluation);
            return;
        }

        candidate.step.matched = true;
        const directionCorrect = direction !== "tap" && direction === candidate.step.direction;
        const evaluation = evaluateTapTiming(
            tapTime,
            candidate.step.time,
            directionCorrect,
            TIMING_WINDOWS_RELAXED,
        );
        evaluationsRef.current.push(evaluation);
        setLastEvaluation(evaluation);
    }, [inputLatencyMs]);

    const stopPracticeSession = useCallback(() => {
        if (statusRef.current !== "running" || sessionModeRef.current !== "practice") return;
        stopScheduler();

        const durationSeconds = startedAtRef.current
            ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
            : 0;
        if (durationSeconds > 0) {
            const minutes = Math.floor(durationSeconds / 60);
            if (minutes > 0) {
                updatePracticeTime(minutes);
            }
        }

        setPlayheadStep(null);
        setLastEvaluation(null);
        setSummary(null);
        setStatus("idle");
        statusRef.current = "idle";
        const nextPhase: GroovePhase = settings.echoMode ? "listen" : "play";
        setPhase(nextPhase);
        phaseRef.current = nextPhase;
        setCurrentBar(1);

        trackEvent("fm_v2_rhythm_session_ended", {
            mode: "groove-lab",
            preset_id: activePreset.id,
            feel: activePreset.feel,
            tempo: settings.bpm,
            bars: settings.bars,
            echo_mode: settings.echoMode,
            response_bars: responseBars,
            total_expected: 0,
            hits: 0,
            misses: 0,
            extras: 0,
            avg_offset_ms: 0,
            direction_accuracy: 0,
            score: 0,
            duration_seconds: durationSeconds,
            input_latency_ms: inputLatencyMs,
            session_mode: "practice",
        });
    }, [
        activePreset.feel,
        activePreset.id,
        inputLatencyMs,
        responseBars,
        settings.bars,
        settings.bpm,
        settings.echoMode,
        stopScheduler,
        updatePracticeTime,
    ]);

    useEffect(() => {
        return () => {
            stopScheduler();
        };
    }, [stopScheduler]);

    if (status === "idle") {
        return (
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>{t("rhythm.grooveLab.title")}</CardTitle>
                        <CardDescription>
                            {t("rhythm.grooveLab.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField id="groove-lab-preset" label={t("rhythm.grooveLab.presetLabel")}>
                                <Select
                                    value={settings.presetId}
                                    onChange={(event) =>
                                        setSettings((previous) => ({
                                            ...previous,
                                            presetId: event.target.value,
                                        }))
                                    }
                                >
                                    {GROOVE_PRESETS.map((preset) => (
                                        <option key={preset.id} value={preset.id}>
                                            {t(`rhythm.grooveLab.presets.${preset.id}.title`, preset.title)} (
                                            {t(`rhythm.grooveLab.feels.${preset.feel}`, preset.feel)})
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                            <TempoNumberField
                                id="groove-lab-bpm"
                                value={settings.bpm}
                                min={60}
                                max={170}
                                onChange={(nextBpm) =>
                                    setSettings((previous) => ({
                                        ...previous,
                                        bpm: Math.max(60, Math.min(170, Math.round(nextBpm))),
                                    }))
                                }
                            />
                            <FormField id="groove-lab-bars" label={t("rhythm.common.barsLabel")}>
                                <Select
                                    value={settings.bars}
                                    onChange={(event) =>
                                        setSettings((previous) => ({
                                            ...previous,
                                            bars: Math.max(4, Math.min(16, Number(event.target.value))),
                                        }))
                                    }
                                >
                                    <option value={4}>4</option>
                                    <option value={8}>8</option>
                                    <option value={12}>12</option>
                                    <option value={16}>16</option>
                                </Select>
                            </FormField>
                            <FormField id="groove-lab-click" label={t("rhythm.grooveLab.metronomeClickLabel")}>
                                <Select
                                    value={settings.clickEnabled ? "on" : "off"}
                                    onChange={(event) =>
                                        setSettings((previous) => ({
                                            ...previous,
                                            clickEnabled: event.target.value === "on",
                                        }))
                                    }
                                >
                                    <option value="on">{t("rhythm.common.on")}</option>
                                    <option value="off">{t("rhythm.common.off")}</option>
                                </Select>
                            </FormField>
                        </div>

                        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground">{activePresetTitle} · {activePresetGenre}</p>
                            <p>{activePresetDescription}</p>
                        </div>

                        <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
                            <div>
                                <Label htmlFor="groove-lab-echo">{t("rhythm.grooveLab.echoModeLabel")}</Label>
                                <p className="text-xs text-muted-foreground">
                                    {t("rhythm.grooveLab.echoModeDesc")}
                                </p>
                            </div>
                            <Switch
                                id="groove-lab-echo"
                                checked={settings.echoMode}
                                onCheckedChange={(checked) =>
                                    setSettings((previous) => ({
                                        ...previous,
                                        echoMode: checked,
                                    }))
                                }
                            />
                        </div>

                        <LatencyCompensationControl
                            value={inputLatencyMs}
                            onChange={setInputLatencyMs}
                        />

                        <PatternGrid slots={activePreset.slots} playheadStep={null} />

                        <SessionModeToggle
                            value={sessionMode}
                            onChange={setSessionMode}
                            options={[
                                {
                                    value: "scored",
                                    label: t("rhythm.common.scored"),
                                    description: t("rhythm.grooveLab.sessionScoredDesc"),
                                },
                                {
                                    value: "practice",
                                    label: t("rhythm.common.practice"),
                                    description: t("rhythm.grooveLab.sessionPracticeDesc"),
                                },
                            ]}
                        />
                        <SessionStartActions
                            primaryLabel={sessionMode === "scored" ? t("rhythm.common.startScored") : t("rhythm.common.practiceWithGuitar")}
                            onPrimary={() => void startSessionWithMode(sessionMode)}
                        />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <div className="space-y-0.5">
                    <p className="font-semibold text-primary">{activePresetTitle}</p>
                    <p className="text-xs text-muted-foreground">
                        {t("rhythm.grooveLab.headerMeta", {
                            genre: activePresetGenre,
                            feel: activePresetFeel,
                            bpm: settings.bpm,
                        })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline">
                        {t("rhythm.grooveLab.barCounter", { current: Math.min(settings.bars, currentBar), total: settings.bars })}
                    </Badge>
                    {sessionMode === "practice" && <Badge variant="outline">{t("rhythm.common.practice")}</Badge>}
                    {settings.echoMode && (
                        <Badge
                            variant="outline"
                            className={cn(
                                phase === "listen"
                                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                            )}
                        >
                            {phase === "listen" ? t("rhythm.grooveLab.phaseListen") : t("rhythm.grooveLab.phaseReplay")}
                        </Badge>
                    )}
                </div>
            </div>

            <PatternGrid slots={activePreset.slots} playheadStep={playheadStep} />

            {settings.echoMode && phase === "listen" && (
                <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                    {t("rhythm.grooveLab.listenPhaseHint")}
                </div>
            )}

            {sessionMode === "scored" ? (
                <>
                    <TapZone
                        disabled={status !== "running" || phase !== "play"}
                        showDirectionButtons
                        onTap={handleTap}
                    />
                    <TimingFeedback evaluation={lastEvaluation} />
                </>
            ) : (
                <div className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                    {t("rhythm.grooveLab.practiceHint")}
                </div>
            )}

            {summary && (
                <SessionSummaryCard
                    description={t("rhythm.grooveLab.summaryDescription", {
                        score: summary.score,
                        accuracy: summary.accuracy,
                        direction: summary.directionAccuracy,
                    })}
                    metrics={[
                        { label: t("rhythm.common.metrics.hits"), value: summary.hits },
                        { label: t("rhythm.common.metrics.misses"), value: summary.misses },
                        { label: t("rhythm.common.metrics.extras"), value: summary.extras },
                        { label: t("rhythm.common.metrics.avgOffset"), value: `${summary.avgOffsetMs}ms` },
                        { label: t("rhythm.common.metrics.direction"), value: `${summary.directionAccuracy}%` },
                    ]}
                    primaryAction={{
                        label: t("rhythm.common.retry"),
                        onClick: () => void startSessionWithMode("scored"),
                    }}
                    secondaryAction={{
                        label: t("rhythm.common.editSettings"),
                        onClick: () => {
                            setStatus("idle");
                            statusRef.current = "idle";
                        },
                    }}
                />
            )}

            {status === "running" && (
                <SessionStopButton
                    onStop={sessionMode === "scored" ? finalizeSession : stopPracticeSession}
                    label={sessionMode === "scored" ? t("rhythm.common.stop") : t("rhythm.common.stopPractice")}
                />
            )}
        </div>
    );
}

export default GrooveLabMode;

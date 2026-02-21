import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { LatencyCompensationControl } from "@/rhythm/ui/LatencyCompensationControl";
import { RhythmClock } from "@/rhythm/engine/RhythmClock";
import { MetronomeScheduler } from "@/rhythm/engine/MetronomeScheduler";
import type { TapEvaluation } from "@/rhythm/engine/InputEvaluator";
import {
    DEFAULT_MATCH_WINDOW_SEC,
    TIMING_WINDOWS_RELAXED,
    applyInputLatencyCompensation,
    evaluateTapTiming,
    summarizeEvaluations,
    type RhythmSessionSummary,
} from "@/rhythm/engine/InputEvaluator";
import {
    getRhythmExerciseStepCount,
    getRhythmExpectedOnsets,
    getRhythmReadingExercisesByLevel,
    type RhythmReadingExercise,
    type RhythmReadingLevel,
} from "@/rhythm/data/rhythmExercises";
import { RhythmNotation } from "@/rhythm/ui/RhythmNotation";
import { TapZone } from "@/rhythm/ui/TapZone";
import { TimingFeedback } from "@/rhythm/ui/TimingFeedback";
import { useRhythmDojoStore } from "@/stores/useRhythmDojoStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { trackEvent } from "@/lib/analytics";
import { useTranslation } from "react-i18next";

interface RhythmReadingSettings {
    level: RhythmReadingLevel;
    exerciseId: string;
    bpm: number;
    bars: number;
    clickEnabled: boolean;
    adaptiveTempo: boolean;
}

interface ExpectedHit {
    id: number;
    time: number;
    matched: boolean;
}

type SessionStatus = "idle" | "running" | "finished";
type SessionMode = "scored" | "practice";

const LEVEL_OPTIONS: RhythmReadingLevel[] = [1, 2, 3, 4, 5, 6];
const DEFAULT_LEVEL: RhythmReadingLevel = 1;

function getInitialExercise(level: RhythmReadingLevel): RhythmReadingExercise {
    const exercises = getRhythmReadingExercisesByLevel(level);
    if (exercises.length > 0) return exercises[0];
    return getRhythmReadingExercisesByLevel(DEFAULT_LEVEL)[0];
}

const DEFAULT_SETTINGS: RhythmReadingSettings = {
    level: DEFAULT_LEVEL,
    exerciseId: getInitialExercise(DEFAULT_LEVEL).id,
    bpm: 76,
    bars: 8,
    clickEnabled: true,
    adaptiveTempo: true,
};

const TEMPO_MIN = 50;
const TEMPO_MAX = 180;
const ADAPT_UP_STEP = 4;
const ADAPT_DOWN_STEP = 4;
const MATCH_WINDOW_SEC = DEFAULT_MATCH_WINDOW_SEC;

interface AdaptiveTempoResult {
    nextBpm: number;
    changed: boolean;
    trend: "up" | "down" | "hold";
}

function clampTempo(value: number): number {
    return Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(value)));
}

function buildAdaptiveTempoResult(
    bpm: number,
    summary: RhythmSessionSummary,
    adaptiveTempo: boolean,
): AdaptiveTempoResult | null {
    if (!adaptiveTempo) return null;

    const shouldIncrease = summary.score >= 90 && summary.accuracy >= 88;
    const shouldDecrease = summary.score <= 60 || summary.accuracy <= 65;
    let nextBpm = bpm;
    let trend: AdaptiveTempoResult["trend"] = "hold";

    if (shouldIncrease) {
        nextBpm = clampTempo(bpm + ADAPT_UP_STEP);
        trend = nextBpm > bpm ? "up" : "hold";
    } else if (shouldDecrease) {
        nextBpm = clampTempo(bpm - ADAPT_DOWN_STEP);
        trend = nextBpm < bpm ? "down" : "hold";
    }

    const changed = nextBpm !== bpm;
    return {
        nextBpm,
        changed,
        trend,
    };
}

export function RhythmReadingMode() {
    const { t } = useTranslation();
    const clockRef = useRef(new RhythmClock());
    const schedulerRef = useRef<MetronomeScheduler | null>(null);
    const expectedHitsRef = useRef<ExpectedHit[]>([]);
    const evaluationsRef = useRef<TapEvaluation[]>([]);
    const extrasRef = useRef(0);
    const finishTimerRef = useRef<number | null>(null);
    const scheduleTokenRef = useRef(0);
    const startedAtRef = useRef<number | null>(null);
    const statusRef = useRef<SessionStatus>("idle");
    const sessionModeRef = useRef<SessionMode>("scored");
    const finalizeRef = useRef<() => void>(() => { });

    const checkAndUpdateStreak = useProgressStore((state) => state.checkAndUpdateStreak);
    const recordSession = useProgressStore((state) => state.recordSession);
    const updatePracticeTime = useProgressStore((state) => state.updatePracticeTime);
    const recordRhythmSession = useRhythmDojoStore((state) => state.recordRhythmSession);
    const inputLatencyMs = useRhythmDojoStore((state) => state.inputLatencyMs);
    const setInputLatencyMs = useRhythmDojoStore((state) => state.setInputLatencyMs);

    const [settings, setSettings] = useState<RhythmReadingSettings>(DEFAULT_SETTINGS);
    const [status, setStatus] = useState<SessionStatus>("idle");
    const [sessionMode, setSessionMode] = useState<SessionMode>("scored");
    const [playheadStep, setPlayheadStep] = useState<number | null>(null);
    const [lastEvaluation, setLastEvaluation] = useState<TapEvaluation | null>(null);
    const [summary, setSummary] = useState<RhythmSessionSummary | null>(null);
    const [adaptiveTempoMessage, setAdaptiveTempoMessage] = useState<string | null>(null);

    const levelExercises = useMemo(
        () => getRhythmReadingExercisesByLevel(settings.level),
        [settings.level],
    );
    const activeExercise = useMemo(() => {
        const byId = levelExercises.find((exercise) => exercise.id === settings.exerciseId);
        return byId ?? levelExercises[0] ?? getInitialExercise(DEFAULT_LEVEL);
    }, [levelExercises, settings.exerciseId]);
    const activeExerciseTitle = t(`rhythm.rhythmReading.exercises.${activeExercise.id}.title`, activeExercise.title);
    const activeExerciseDescription = t(
        `rhythm.rhythmReading.exercises.${activeExercise.id}.description`,
        activeExercise.description,
    );
    const expectedOnsets = useMemo(
        () => getRhythmExpectedOnsets(activeExercise),
        [activeExercise],
    );
    const expectedSet = useMemo(() => new Set(expectedOnsets), [expectedOnsets]);
    const stepsPerBar = useMemo(() => getRhythmExerciseStepCount(activeExercise), [activeExercise]);
    const totalExpected = useMemo(
        () => settings.bars * expectedOnsets.length,
        [expectedOnsets.length, settings.bars],
    );
    const totalSteps = useMemo(
        () => settings.bars * stepsPerBar,
        [settings.bars, stepsPerBar],
    );

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

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
        const adaptiveTempoResult = buildAdaptiveTempoResult(
            settings.bpm,
            summaryResult,
            settings.adaptiveTempo,
        );
        setSummary(summaryResult);
        const adaptiveTempoCopy = adaptiveTempoResult
            ? adaptiveTempoResult.trend === "up"
                ? t("rhythm.rhythmReading.adaptiveTempoUp", {
                    delta: adaptiveTempoResult.nextBpm - settings.bpm,
                    next: adaptiveTempoResult.nextBpm,
                })
                : adaptiveTempoResult.trend === "down"
                    ? t("rhythm.rhythmReading.adaptiveTempoDown", {
                        delta: settings.bpm - adaptiveTempoResult.nextBpm,
                        next: adaptiveTempoResult.nextBpm,
                    })
                    : t("rhythm.rhythmReading.adaptiveTempoHold", { bpm: settings.bpm })
            : null;
        setAdaptiveTempoMessage(adaptiveTempoCopy);
        setStatus("finished");
        statusRef.current = "finished";
        setPlayheadStep(null);

        if (adaptiveTempoResult?.changed) {
            setSettings((prev) => ({
                ...prev,
                bpm: adaptiveTempoResult.nextBpm,
            }));
        }

        recordRhythmSession({
            mode: "rhythm-reading",
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
            mode: "rhythm-reading",
            level: settings.level,
            exercise_id: activeExercise.id,
            tempo: settings.bpm,
            bars: settings.bars,
            time_signature: `${activeExercise.timeSignatureTop}/4`,
            subdivision: activeExercise.subdivision,
            total_expected: summaryResult.totalExpected,
            hits: summaryResult.hits,
            misses: summaryResult.misses,
            extras: summaryResult.extras,
            avg_offset_ms: summaryResult.avgOffsetMs,
            score: summaryResult.score,
            duration_seconds: durationSeconds,
            adaptive_tempo_enabled: settings.adaptiveTempo,
            adaptive_tempo_trend: adaptiveTempoResult?.trend ?? "off",
            next_tempo: adaptiveTempoResult?.nextBpm ?? settings.bpm,
            input_latency_ms: inputLatencyMs,
            session_mode: "scored",
        });
    }, [
        activeExercise.id,
        activeExercise.subdivision,
        activeExercise.timeSignatureTop,
        inputLatencyMs,
        recordRhythmSession,
        recordSession,
        settings.bars,
        settings.bpm,
        settings.adaptiveTempo,
        settings.level,
        t,
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
        expectedHitsRef.current = [];
        evaluationsRef.current = [];
        extrasRef.current = 0;
        startedAtRef.current = Date.now();
        const scheduleToken = scheduleTokenRef.current;

        setSummary(null);
        setLastEvaluation(null);
        setPlayheadStep(null);
        setAdaptiveTempoMessage(null);
        setSessionMode(mode);
        sessionModeRef.current = mode;
        setStatus("running");
        statusRef.current = "running";

        const scheduler = new MetronomeScheduler({
            clock: clockRef.current,
            bpm: settings.bpm,
            timeSignatureTop: activeExercise.timeSignatureTop,
            subdivision: activeExercise.subdivision,
            maxSteps: mode === "scored" ? totalSteps : undefined,
            clickEnabled: settings.clickEnabled,
            onStep: (step) => {
                const barStep = step.barStepIndex;
                if (mode === "scored" && expectedSet.has(barStep)) {
                    expectedHitsRef.current.push({
                        id: step.index,
                        time: step.time,
                        matched: false,
                    });
                }

                const delayMs = clockRef.current.toDelayMs(step.time);
                window.setTimeout(() => {
                    if (scheduleTokenRef.current !== scheduleToken) return;
                    setPlayheadStep(barStep);
                }, delayMs);
            },
        });

        schedulerRef.current = scheduler;
        scheduler.start();

        if (mode === "scored") {
            const stepDurationSec = 60 / settings.bpm / activeExercise.subdivision;
            const durationMs = Math.ceil(totalSteps * stepDurationSec * 1000 + 350);
            finishTimerRef.current = window.setTimeout(() => {
                finalizeRef.current();
            }, durationMs);
        }

        trackEvent("fm_v2_rhythm_session_started", {
            mode: "rhythm-reading",
            level: settings.level,
            exercise_id: activeExercise.id,
            tempo: settings.bpm,
            bars: settings.bars,
            click_enabled: settings.clickEnabled,
            time_signature: `${activeExercise.timeSignatureTop}/4`,
            subdivision: activeExercise.subdivision,
            total_expected: mode === "scored" ? totalExpected : 0,
            adaptive_tempo_enabled: settings.adaptiveTempo,
            input_latency_ms: inputLatencyMs,
            session_mode: mode,
        });
    }, [
        activeExercise.id,
        activeExercise.subdivision,
        activeExercise.timeSignatureTop,
        checkAndUpdateStreak,
        expectedSet,
        inputLatencyMs,
        settings.bars,
        settings.bpm,
        settings.adaptiveTempo,
        settings.clickEnabled,
        settings.level,
        stopScheduler,
        totalExpected,
        totalSteps,
    ]);

    const handleTap = useCallback(() => {
        if (sessionModeRef.current !== "scored") return;
        if (statusRef.current !== "running") return;

        const rawTapTime = clockRef.current.now();
        const tapTime = applyInputLatencyCompensation(rawTapTime, inputLatencyMs);
        const nearestHit = expectedHitsRef.current
            .filter((hit) => !hit.matched)
            .map((hit) => ({
                hit,
                offsetSec: tapTime - hit.time,
                absOffsetSec: Math.abs(tapTime - hit.time),
            }))
            .sort((left, right) => left.absOffsetSec - right.absOffsetSec)[0];

        const candidate = nearestHit && nearestHit.absOffsetSec <= MATCH_WINDOW_SEC
            ? nearestHit
            : null;

        if (!candidate) {
            extrasRef.current += 1;
            const offsetMs = nearestHit ? nearestHit.offsetSec * 1000 : 0;
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

        candidate.hit.matched = true;
        const evaluation = evaluateTapTiming(tapTime, candidate.hit.time, true, TIMING_WINDOWS_RELAXED);
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
        setAdaptiveTempoMessage(null);
        setStatus("idle");
        statusRef.current = "idle";

        trackEvent("fm_v2_rhythm_session_ended", {
            mode: "rhythm-reading",
            level: settings.level,
            exercise_id: activeExercise.id,
            tempo: settings.bpm,
            bars: settings.bars,
            time_signature: `${activeExercise.timeSignatureTop}/4`,
            subdivision: activeExercise.subdivision,
            total_expected: 0,
            hits: 0,
            misses: 0,
            extras: 0,
            avg_offset_ms: 0,
            score: 0,
            duration_seconds: durationSeconds,
            adaptive_tempo_enabled: settings.adaptiveTempo,
            adaptive_tempo_trend: "off",
            next_tempo: settings.bpm,
            input_latency_ms: inputLatencyMs,
            session_mode: "practice",
        });
    }, [
        activeExercise.id,
        activeExercise.subdivision,
        activeExercise.timeSignatureTop,
        inputLatencyMs,
        settings.adaptiveTempo,
        settings.bars,
        settings.bpm,
        settings.level,
        stopScheduler,
        updatePracticeTime,
    ]);

    useEffect(() => {
        return () => {
            stopScheduler();
        };
    }, [stopScheduler]);

    const randomizeExercise = () => {
        if (levelExercises.length <= 1) return;
        const others = levelExercises.filter((exercise) => exercise.id !== activeExercise.id);
        if (others.length === 0) return;
        const random = others[Math.floor(Math.random() * others.length)];
        setSettings((prev) => ({ ...prev, exerciseId: random.id }));
    };

    const goToSetup = () => {
        setSummary(null);
        setLastEvaluation(null);
        setPlayheadStep(null);
        setStatus("idle");
        statusRef.current = "idle";
    };

    if (status === "idle") {
        return (
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle>{t("rhythm.rhythmReading.title")}</CardTitle>
                            <Badge variant="outline" className="capitalize">
                                {t(`common.difficulty.${activeExercise.difficulty}`, activeExercise.difficulty)}
                            </Badge>
                        </div>
                        <CardDescription>
                            {t("rhythm.rhythmReading.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                            <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
                                <p className="text-muted-foreground">{t("rhythm.rhythmReading.exerciseLabel")}</p>
                                <p className="font-semibold text-foreground">{activeExerciseTitle}</p>
                            </div>
                            <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
                                <p className="text-muted-foreground">{t("rhythm.rhythmReading.timeLabel")}</p>
                                <p className="font-semibold text-foreground">{activeExercise.timeSignatureTop}/4</p>
                            </div>
                            <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
                                <p className="text-muted-foreground">{t("rhythm.rhythmReading.expectedTapsLabel")}</p>
                                <p className="font-semibold text-foreground">{t("rhythm.rhythmReading.expectedPerBar", { count: expectedOnsets.length })}</p>
                            </div>
                            <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
                                <p className="text-muted-foreground">{t("rhythm.rhythmReading.gridLabel")}</p>
                                <p className="font-semibold text-foreground">{t("rhythm.rhythmReading.gridSubdivisions", { count: activeExercise.subdivision })}</p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField id="rhythm-reading-level" label={t("rhythm.rhythmReading.levelLabel")}>
                                <Select
                                    value={settings.level}
                                    onChange={(event) => {
                                        const nextLevel = Number(event.target.value) as RhythmReadingLevel;
                                        const firstExercise = getInitialExercise(nextLevel);
                                        setSettings((prev) => ({
                                            ...prev,
                                            level: nextLevel,
                                            exerciseId: firstExercise.id,
                                        }));
                                    }}
                                >
                                    {LEVEL_OPTIONS.map((level) => (
                                        <option key={`rr-level-${level}`} value={level}>
                                            {t("rhythm.rhythmReading.levelValue", { level })}
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                            <FormField id="rhythm-reading-exercise" label={t("rhythm.rhythmReading.exerciseSelectLabel")}>
                                <Select
                                    value={activeExercise.id}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            exerciseId: event.target.value,
                                        }))
                                    }
                                >
                                    {levelExercises.map((exercise) => (
                                        <option key={exercise.id} value={exercise.id}>
                                            {t(`rhythm.rhythmReading.exercises.${exercise.id}.title`, exercise.title)}
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                            <TempoNumberField
                                id="rhythm-reading-bpm"
                                value={settings.bpm}
                                min={TEMPO_MIN}
                                max={TEMPO_MAX}
                                onChange={(nextBpm) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        bpm: clampTempo(nextBpm),
                                    }))
                                }
                            />
                            <FormField id="rhythm-reading-bars" label={t("rhythm.common.barsLabel")}>
                                <Select
                                    value={settings.bars}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
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
                            <FormField id="rhythm-reading-click" label={t("rhythm.common.audioClickLabel")} className="sm:col-span-2">
                                <Select
                                    value={settings.clickEnabled ? "on" : "off"}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            clickEnabled: event.target.value === "on",
                                        }))
                                    }
                                >
                                    <option value="on">{t("rhythm.common.on")}</option>
                                    <option value="off">{t("rhythm.common.off")}</option>
                                </Select>
                            </FormField>
                            <div className="space-y-2 sm:col-span-2">
                                <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
                                    <div>
                                        <Label htmlFor="rhythm-reading-adaptive">{t("rhythm.rhythmReading.adaptiveTempoLabel")}</Label>
                                        <p className="text-xs text-muted-foreground">
                                            {t("rhythm.rhythmReading.adaptiveTempoDesc")}
                                        </p>
                                    </div>
                                    <Switch
                                        id="rhythm-reading-adaptive"
                                        checked={settings.adaptiveTempo}
                                        onCheckedChange={(checked) =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                adaptiveTempo: checked,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <LatencyCompensationControl
                                    value={inputLatencyMs}
                                    onChange={setInputLatencyMs}
                                />
                            </div>
                        </div>

                        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            {activeExerciseDescription}
                        </div>

                        <RhythmNotation
                            tokens={activeExercise.tokens}
                            timeSignatureTop={activeExercise.timeSignatureTop}
                            subdivision={activeExercise.subdivision}
                            playheadStep={null}
                            showLegend
                        />

                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={randomizeExercise}>
                                {t("rhythm.rhythmReading.randomExercise")}
                            </Button>
                        </div>
                        <SessionModeToggle
                            value={sessionMode}
                            onChange={setSessionMode}
                            options={[
                                {
                                    value: "scored",
                                    label: t("rhythm.common.scored"),
                                    description: t("rhythm.rhythmReading.sessionScoredDesc"),
                                },
                                {
                                    value: "practice",
                                    label: t("rhythm.common.practice"),
                                    description: t("rhythm.rhythmReading.sessionPracticeDesc"),
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
                    <p className="font-semibold text-primary">{activeExerciseTitle}</p>
                    <p className="text-xs text-muted-foreground">
                        {t("rhythm.rhythmReading.headerMeta", {
                            signature: `${activeExercise.timeSignatureTop}/4`,
                            grid: activeExercise.subdivision,
                            taps: expectedOnsets.length,
                        })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline">{t("rhythm.rhythmReading.levelCompact", { level: settings.level })}</Badge>
                    <Badge variant="outline">{t("rhythm.common.bpm", { value: settings.bpm })}</Badge>
                    <Badge variant="outline">{t("rhythm.rhythmReading.barsCompact", { bars: settings.bars })}</Badge>
                    {sessionMode === "practice" && <Badge variant="outline">{t("rhythm.common.practice")}</Badge>}
                </div>
            </div>

            <RhythmNotation
                tokens={activeExercise.tokens}
                timeSignatureTop={activeExercise.timeSignatureTop}
                subdivision={activeExercise.subdivision}
                playheadStep={playheadStep}
            />

            {sessionMode === "scored" ? (
                <>
                    <TapZone disabled={status !== "running"} onTap={() => handleTap()} />
                    <TimingFeedback evaluation={lastEvaluation} />
                </>
            ) : (
                <div className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                    {t("rhythm.rhythmReading.practiceHint")}
                </div>
            )}

            {summary && (
                <SessionSummaryCard
                    description={t("rhythm.rhythmReading.summaryDescription", { score: summary.score, accuracy: summary.accuracy })}
                    metrics={[
                        { label: t("rhythm.common.metrics.hits"), value: summary.hits },
                        { label: t("rhythm.common.metrics.misses"), value: summary.misses },
                        { label: t("rhythm.common.metrics.extras"), value: summary.extras },
                        { label: t("rhythm.common.metrics.avgOffset"), value: `${summary.avgOffsetMs}ms` },
                    ]}
                    notice={adaptiveTempoMessage}
                    noticeClassName={adaptiveTempoMessage ? "border-primary/30 bg-primary/10 font-medium text-primary" : undefined}
                    primaryAction={{
                        label: t("rhythm.common.retry"),
                        onClick: () => void startSessionWithMode("scored"),
                    }}
                    secondaryAction={{
                        label: t("rhythm.common.editSettings"),
                        onClick: goToSetup,
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

export default RhythmReadingMode;

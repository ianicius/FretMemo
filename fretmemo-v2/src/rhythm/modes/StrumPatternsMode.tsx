import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { LatencyCompensationControl } from "@/rhythm/ui/LatencyCompensationControl";
import { PatternGrid } from "@/rhythm/ui/PatternGrid";
import { TapZone } from "@/rhythm/ui/TapZone";
import { TimingFeedback } from "@/rhythm/ui/TimingFeedback";
import { SessionModeToggle } from "@/components/session-setup/session-mode-toggle";
import { SessionStartActions } from "@/components/session-setup/session-start-actions";
import { SessionStopButton } from "@/components/session-setup/session-stop-button";
import { SessionSummaryCard } from "@/components/session-setup/session-summary-card";
import { TempoNumberField } from "@/components/session-setup/tempo-number-field";
import { RhythmClock } from "@/rhythm/engine/RhythmClock";
import { MetronomeScheduler } from "@/rhythm/engine/MetronomeScheduler";
import type { StrumDirection, TapEvaluation } from "@/rhythm/engine/InputEvaluator";
import {
    DEFAULT_MATCH_WINDOW_SEC,
    TIMING_WINDOWS_RELAXED,
    applyInputLatencyCompensation,
    evaluateTapTiming,
    summarizeEvaluations,
    type RhythmSessionSummary,
} from "@/rhythm/engine/InputEvaluator";
import type { StrumPattern } from "@/rhythm/data/strumPatterns";
import { getExpectedStepFromSymbol, STRUM_PATTERNS } from "@/rhythm/data/strumPatterns";
import { useRhythmDojoStore } from "@/stores/useRhythmDojoStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { trackEvent } from "@/lib/analytics";
import { useTranslation } from "react-i18next";

interface StrumPatternSettings {
    bpm: number;
    bars: number;
    patternId: string;
    clickEnabled: boolean;
}

interface ExpectedStrumStep {
    id: number;
    time: number;
    direction: StrumDirection;
    muted: boolean;
    matched: boolean;
}

interface StrumSessionSummary extends RhythmSessionSummary {
    directionAccuracy: number;
}

type SessionStatus = "idle" | "running" | "finished";
type SessionMode = "scored" | "practice";

const DEFAULT_SETTINGS: StrumPatternSettings = {
    bpm: 84,
    bars: 8,
    patternId: "folk-strum",
    clickEnabled: true,
};

const MATCH_WINDOW_SEC = DEFAULT_MATCH_WINDOW_SEC;

export function StrumPatternsMode() {
    const { t } = useTranslation();
    const clockRef = useRef(new RhythmClock());
    const schedulerRef = useRef<MetronomeScheduler | null>(null);
    const expectedStepsRef = useRef<ExpectedStrumStep[]>([]);
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

    const [settings, setSettings] = useState<StrumPatternSettings>(DEFAULT_SETTINGS);
    const [status, setStatus] = useState<SessionStatus>("idle");
    const [sessionMode, setSessionMode] = useState<SessionMode>("scored");
    const [playheadStep, setPlayheadStep] = useState<number | null>(null);
    const [lastEvaluation, setLastEvaluation] = useState<TapEvaluation | null>(null);
    const [summary, setSummary] = useState<StrumSessionSummary | null>(null);

    const activePattern = useMemo<StrumPattern>(
        () => STRUM_PATTERNS.find((pattern) => pattern.id === settings.patternId) ?? STRUM_PATTERNS[0],
        [settings.patternId],
    );
    const activePatternTitle = t(`rhythm.strumPatterns.patterns.${activePattern.id}.title`, activePattern.title);
    const activePatternGenre = t(`rhythm.strumPatterns.patterns.${activePattern.id}.genre`, activePattern.genre);
    const activePatternDescription = t(
        `rhythm.strumPatterns.patterns.${activePattern.id}.description`,
        activePattern.description,
    );
    const totalSteps = useMemo(
        () => settings.bars * activePattern.slots.length,
        [activePattern.slots.length, settings.bars],
    );
    const totalExpected = useMemo(
        () => settings.bars * activePattern.slots.filter((slot) => slot !== "R").length,
        [activePattern.slots, settings.bars],
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
        const directionCorrectCount = evaluationsRef.current.filter((item) => item.directionCorrect).length;
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
            mode: "strum-patterns",
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
            mode: "strum-patterns",
            pattern_id: activePattern.id,
            tempo: settings.bpm,
            bars: settings.bars,
            subdivision: activePattern.subdivision,
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
        activePattern.id,
        activePattern.subdivision,
        inputLatencyMs,
        recordRhythmSession,
        recordSession,
        settings.bars,
        settings.bpm,
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

        const scheduler = new MetronomeScheduler({
            clock: clockRef.current,
            bpm: settings.bpm,
            timeSignatureTop: 4,
            subdivision: activePattern.subdivision,
            maxSteps: mode === "scored" ? totalSteps : undefined,
            clickEnabled: settings.clickEnabled,
            onStep: (step) => {
                const slotIndex = step.barStepIndex % activePattern.slots.length;
                if (mode === "scored") {
                    const symbol = activePattern.slots[slotIndex];
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
                }, delayMs);
            },
        });

        schedulerRef.current = scheduler;
        scheduler.start();

        if (mode === "scored") {
            const stepDurationSec = 60 / settings.bpm / activePattern.subdivision;
            const durationMs = Math.ceil(totalSteps * stepDurationSec * 1000 + 350);
            finishTimerRef.current = window.setTimeout(() => {
                finalizeRef.current();
            }, durationMs);
        }

        trackEvent("fm_v2_rhythm_session_started", {
            mode: "strum-patterns",
            pattern_id: activePattern.id,
            tempo: settings.bpm,
            bars: settings.bars,
            subdivision: activePattern.subdivision,
            click_enabled: settings.clickEnabled,
            total_expected: mode === "scored" ? totalExpected : 0,
            input_latency_ms: inputLatencyMs,
            session_mode: mode,
        });
    }, [
        activePattern.id,
        activePattern.slots,
        activePattern.subdivision,
        checkAndUpdateStreak,
        inputLatencyMs,
        settings.bars,
        settings.bpm,
        settings.clickEnabled,
        stopScheduler,
        totalExpected,
        totalSteps,
    ]);

    const handleTap = useCallback((direction: StrumDirection) => {
        if (sessionModeRef.current !== "scored") return;
        if (statusRef.current !== "running") return;

        const rawTapTime = clockRef.current.now();
        const tapTime = applyInputLatencyCompensation(rawTapTime, inputLatencyMs);
        const nearestStep = expectedStepsRef.current
            .filter((expected) => !expected.matched)
            .map((expected) => ({
                expected,
                offsetSec: tapTime - expected.time,
                absOffsetSec: Math.abs(tapTime - expected.time),
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

        candidate.expected.matched = true;
        const directionCorrect = direction !== "tap" && direction === candidate.expected.direction;
        const evaluation = evaluateTapTiming(
            tapTime,
            candidate.expected.time,
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

        trackEvent("fm_v2_rhythm_session_ended", {
            mode: "strum-patterns",
            pattern_id: activePattern.id,
            tempo: settings.bpm,
            bars: settings.bars,
            subdivision: activePattern.subdivision,
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
        activePattern.id,
        activePattern.subdivision,
        inputLatencyMs,
        settings.bars,
        settings.bpm,
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
                        <CardTitle>{t("rhythm.strumPatterns.title")}</CardTitle>
                        <CardDescription>
                            {t("rhythm.strumPatterns.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField id="strum-pattern-id" label={t("rhythm.strumPatterns.patternLabel")}>
                                <Select
                                    value={settings.patternId}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            patternId: event.target.value,
                                        }))
                                    }
                                >
                                    {STRUM_PATTERNS.map((pattern) => (
                                        <option key={pattern.id} value={pattern.id}>
                                            {t(`rhythm.strumPatterns.patterns.${pattern.id}.title`, pattern.title)} (
                                            {t(`common.difficulty.${pattern.difficulty}`, pattern.difficulty)})
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                            <TempoNumberField
                                id="strum-pattern-bpm"
                                value={settings.bpm}
                                min={50}
                                max={180}
                                onChange={(nextBpm) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        bpm: Math.max(50, Math.min(180, Math.round(nextBpm))),
                                    }))
                                }
                            />
                            <FormField id="strum-pattern-bars" label={t("rhythm.common.barsLabel")}>
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
                            <FormField id="strum-pattern-click" label={t("rhythm.common.audioClickLabel")}>
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
                        </div>

                        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            {activePatternGenre} · {activePatternDescription}
                        </div>

                        <LatencyCompensationControl
                            value={inputLatencyMs}
                            onChange={setInputLatencyMs}
                        />

                        <SessionModeToggle
                            value={sessionMode}
                            onChange={setSessionMode}
                            options={[
                                {
                                    value: "scored",
                                    label: t("rhythm.common.scored"),
                                    description: t("rhythm.strumPatterns.sessionScoredDesc"),
                                },
                                {
                                    value: "practice",
                                    label: t("rhythm.common.practice"),
                                    description: t("rhythm.strumPatterns.sessionPracticeDesc"),
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
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <span className="font-semibold text-primary">
                    {activePatternTitle} · {t("rhythm.common.bpm", { value: settings.bpm })}
                </span>
                <span className="text-muted-foreground">
                    {t("rhythm.strumPatterns.barsGrid", {
                        bars: settings.bars,
                        grid: activePattern.subdivision === 4 ? t("rhythm.strumPatterns.grid16") : t("rhythm.strumPatterns.grid8"),
                    })}
                </span>
            </div>

            <PatternGrid slots={activePattern.slots} playheadStep={playheadStep} />

            {sessionMode === "scored" ? (
                <>
                    <TapZone
                        disabled={status !== "running"}
                        showDirectionButtons
                        onTap={handleTap}
                    />
                    <TimingFeedback evaluation={lastEvaluation} />
                </>
            ) : (
                <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {t("rhythm.strumPatterns.practiceHint")}
                </div>
            )}

            {sessionMode === "scored" && summary && (
                <SessionSummaryCard
                    description={t("rhythm.strumPatterns.summaryDescription", {
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
                        label: t("rhythm.common.newSession"),
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

export default StrumPatternsMode;

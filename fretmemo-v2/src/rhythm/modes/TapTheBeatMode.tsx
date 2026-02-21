import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { BeatVisualizer } from "@/rhythm/ui/BeatVisualizer";
import { LatencyCompensationControl } from "@/rhythm/ui/LatencyCompensationControl";
import { TapZone } from "@/rhythm/ui/TapZone";
import { TimingFeedback } from "@/rhythm/ui/TimingFeedback";
import { SessionModeToggle } from "@/components/session-setup/session-mode-toggle";
import { SessionStartActions } from "@/components/session-setup/session-start-actions";
import { SessionStopButton } from "@/components/session-setup/session-stop-button";
import { SessionSummaryCard } from "@/components/session-setup/session-summary-card";
import { TempoNumberField } from "@/components/session-setup/tempo-number-field";
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
import { useRhythmDojoStore } from "@/stores/useRhythmDojoStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { trackEvent } from "@/lib/analytics";
import { useTranslation } from "react-i18next";

interface TapTheBeatSettings {
    bpm: number;
    timeSignatureTop: 4 | 3 | 6;
    bars: number;
}

interface ExpectedBeat {
    id: number;
    time: number;
    matched: boolean;
}

type SessionStatus = "idle" | "running" | "finished";
type SessionMode = "scored" | "practice";

const DEFAULT_SETTINGS: TapTheBeatSettings = {
    bpm: 80,
    timeSignatureTop: 4,
    bars: 8,
};

const MATCH_WINDOW_SEC = DEFAULT_MATCH_WINDOW_SEC;

export function TapTheBeatMode() {
    const { t } = useTranslation();
    const clockRef = useRef(new RhythmClock());
    const schedulerRef = useRef<MetronomeScheduler | null>(null);
    const expectedBeatsRef = useRef<ExpectedBeat[]>([]);
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

    const [settings, setSettings] = useState<TapTheBeatSettings>(DEFAULT_SETTINGS);
    const [status, setStatus] = useState<SessionStatus>("idle");
    const [sessionMode, setSessionMode] = useState<SessionMode>("scored");
    const [currentBeat, setCurrentBeat] = useState<number | null>(null);
    const [lastEvaluation, setLastEvaluation] = useState<TapEvaluation | null>(null);
    const [summary, setSummary] = useState<RhythmSessionSummary | null>(null);

    const totalExpected = useMemo(
        () => settings.timeSignatureTop * settings.bars,
        [settings.timeSignatureTop, settings.bars],
    );
    const timeSignatureBottom = settings.timeSignatureTop === 6 ? 8 : 4;
    const timeSignatureLabel = `${settings.timeSignatureTop}/${timeSignatureBottom}`;

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
        setSummary(summaryResult);
        setStatus("finished");
        statusRef.current = "finished";
        setCurrentBeat(null);

        recordRhythmSession({
            mode: "tap-beat",
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
            mode: "tap-beat",
            tempo: settings.bpm,
            time_signature: timeSignatureLabel,
            bars: settings.bars,
            total_expected: summaryResult.totalExpected,
            hits: summaryResult.hits,
            misses: summaryResult.misses,
            extras: summaryResult.extras,
            avg_offset_ms: summaryResult.avgOffsetMs,
            score: summaryResult.score,
            duration_seconds: durationSeconds,
            input_latency_ms: inputLatencyMs,
            session_mode: "scored",
        });
    }, [
        inputLatencyMs,
        recordRhythmSession,
        recordSession,
        settings.bpm,
        settings.bars,
        timeSignatureLabel,
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
        expectedBeatsRef.current = [];
        evaluationsRef.current = [];
        extrasRef.current = 0;
        startedAtRef.current = Date.now();
        const scheduleToken = scheduleTokenRef.current;

        setSummary(null);
        setLastEvaluation(null);
        setCurrentBeat(null);
        setSessionMode(mode);
        sessionModeRef.current = mode;
        setStatus("running");
        statusRef.current = "running";

        const scheduler = new MetronomeScheduler({
            clock: clockRef.current,
            bpm: settings.bpm,
            timeSignatureTop: settings.timeSignatureTop,
            subdivision: 1,
            maxSteps: mode === "scored" ? totalExpected : undefined,
            clickEnabled: true,
            clickEveryStep: true,
            onStep: (step) => {
                if (mode === "scored") {
                    expectedBeatsRef.current.push({
                        id: step.index,
                        time: step.time,
                        matched: false,
                    });
                }

                const delayMs = clockRef.current.toDelayMs(step.time);
                window.setTimeout(() => {
                    if (scheduleTokenRef.current !== scheduleToken) return;
                    setCurrentBeat(step.beatIndex);
                }, delayMs);
            },
        });

        schedulerRef.current = scheduler;
        scheduler.start();

        if (mode === "scored") {
            const durationMs = Math.ceil(totalExpected * (60 / settings.bpm) * 1000 + 350);
            finishTimerRef.current = window.setTimeout(() => {
                finalizeRef.current();
            }, durationMs);
        }

        trackEvent("fm_v2_rhythm_session_started", {
            mode: "tap-beat",
            tempo: settings.bpm,
            time_signature: timeSignatureLabel,
            bars: settings.bars,
            total_expected: mode === "scored" ? totalExpected : 0,
            input_latency_ms: inputLatencyMs,
            session_mode: mode,
        });
    }, [
        checkAndUpdateStreak,
        inputLatencyMs,
        settings.bpm,
        settings.bars,
        settings.timeSignatureTop,
        timeSignatureLabel,
        stopScheduler,
        totalExpected,
    ]);

    const handleTap = useCallback(() => {
        if (sessionModeRef.current !== "scored") return;
        if (statusRef.current !== "running") return;

        const rawTapTime = clockRef.current.now();
        const tapTime = applyInputLatencyCompensation(rawTapTime, inputLatencyMs);
        const nearestBeat = expectedBeatsRef.current
            .filter((beat) => !beat.matched)
            .map((beat) => ({
                beat,
                offsetSec: tapTime - beat.time,
                absOffsetSec: Math.abs(tapTime - beat.time),
            }))
            .sort((left, right) => left.absOffsetSec - right.absOffsetSec)[0];

        const candidate = nearestBeat && nearestBeat.absOffsetSec <= MATCH_WINDOW_SEC
            ? nearestBeat
            : null;

        if (!candidate) {
            extrasRef.current += 1;
            const offsetMs = nearestBeat ? nearestBeat.offsetSec * 1000 : 0;
            const extraEval: TapEvaluation = {
                offsetMs,
                absOffsetMs: Math.abs(offsetMs),
                rating: "miss",
                isHit: false,
                directionCorrect: true,
            };
            setLastEvaluation(extraEval);
            return;
        }

        candidate.beat.matched = true;
        const evaluation = evaluateTapTiming(tapTime, candidate.beat.time, true, TIMING_WINDOWS_RELAXED);
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

        setCurrentBeat(null);
        setLastEvaluation(null);
        setSummary(null);
        setStatus("idle");
        statusRef.current = "idle";

        trackEvent("fm_v2_rhythm_session_ended", {
            mode: "tap-beat",
            tempo: settings.bpm,
            time_signature: timeSignatureLabel,
            bars: settings.bars,
            total_expected: 0,
            hits: 0,
            misses: 0,
            extras: 0,
            avg_offset_ms: 0,
            score: 0,
            duration_seconds: durationSeconds,
            input_latency_ms: inputLatencyMs,
            session_mode: "practice",
        });
    }, [inputLatencyMs, settings.bpm, settings.bars, timeSignatureLabel, stopScheduler, updatePracticeTime]);

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
                        <CardTitle>{t("rhythm.tapBeat.title")}</CardTitle>
                        <CardDescription>
                            {t("rhythm.tapBeat.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <TempoNumberField
                                id="tap-beat-bpm"
                                value={settings.bpm}
                                min={40}
                                max={200}
                                onChange={(nextBpm) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        bpm: Math.max(40, Math.min(200, Math.round(nextBpm))),
                                    }))
                                }
                            />
                            <FormField id="tap-beat-time-signature" label={t("rhythm.tapBeat.timeSignatureLabel")}>
                                <Select
                                    value={settings.timeSignatureTop}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            timeSignatureTop: Number(event.target.value) as TapTheBeatSettings["timeSignatureTop"],
                                        }))
                                    }
                                >
                                    <option value={4}>4/4</option>
                                    <option value={3}>3/4</option>
                                    <option value={6}>{t("rhythm.tapBeat.sixEightPulse")}</option>
                                </Select>
                            </FormField>
                            <FormField id="tap-beat-bars" label={t("rhythm.common.barsLabel")}>
                                <Select
                                    value={settings.bars}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            bars: Math.max(2, Math.min(16, Number(event.target.value))),
                                        }))
                                    }
                                >
                                    <option value={4}>4</option>
                                    <option value={8}>8</option>
                                    <option value={12}>12</option>
                                    <option value={16}>16</option>
                                </Select>
                            </FormField>
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
                                    description: t("rhythm.tapBeat.sessionScoredDesc"),
                                },
                                {
                                    value: "practice",
                                    label: t("rhythm.common.practice"),
                                    description: t("rhythm.tapBeat.sessionPracticeDesc"),
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
                <span className="font-semibold text-primary">{t("rhythm.common.tempoBpm", { bpm: settings.bpm })}</span>
                <span className="text-muted-foreground">
                    {t("rhythm.tapBeat.signatureBars", { signature: timeSignatureLabel, bars: settings.bars })}
                </span>
            </div>

            <BeatVisualizer
                beatsPerBar={settings.timeSignatureTop}
                currentBeat={currentBeat}
                isRunning={status === "running"}
            />

            {sessionMode === "scored" ? (
                <>
                    <TapZone
                        disabled={status !== "running"}
                        onTap={() => handleTap()}
                    />
                    <TimingFeedback evaluation={lastEvaluation} />
                </>
            ) : (
                <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {t("rhythm.tapBeat.practiceHint")}
                </div>
            )}

            {sessionMode === "scored" && summary && (
                <SessionSummaryCard
                    description={t("rhythm.tapBeat.summaryDescription", { score: summary.score, accuracy: summary.accuracy })}
                    metrics={[
                        { label: t("rhythm.common.metrics.hits"), value: summary.hits },
                        { label: t("rhythm.common.metrics.misses"), value: summary.misses },
                        { label: t("rhythm.common.metrics.extras"), value: summary.extras },
                        { label: t("rhythm.common.metrics.avgOffset"), value: `${summary.avgOffsetMs}ms` },
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

export default TapTheBeatMode;

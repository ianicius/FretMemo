import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BeatVisualizer } from "@/rhythm/ui/BeatVisualizer";
import { LatencyCompensationControl } from "@/rhythm/ui/LatencyCompensationControl";
import { TapZone } from "@/rhythm/ui/TapZone";
import { TimingFeedback } from "@/rhythm/ui/TimingFeedback";
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
    const clockRef = useRef(new RhythmClock());
    const schedulerRef = useRef<MetronomeScheduler | null>(null);
    const expectedBeatsRef = useRef<ExpectedBeat[]>([]);
    const evaluationsRef = useRef<TapEvaluation[]>([]);
    const extrasRef = useRef(0);
    const finishTimerRef = useRef<number | null>(null);
    const startedAtRef = useRef<number | null>(null);
    const statusRef = useRef<SessionStatus>("idle");
    const sessionModeRef = useRef<SessionMode>("scored");

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

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    useEffect(() => {
        sessionModeRef.current = sessionMode;
    }, [sessionMode]);

    const stopScheduler = useCallback(() => {
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
            time_signature: `${settings.timeSignatureTop}/4`,
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
        settings.timeSignatureTop,
        stopScheduler,
        totalExpected,
        updatePracticeTime,
    ]);

    const startSessionWithMode = useCallback(async (mode: SessionMode) => {
        await clockRef.current.warmUp();
        checkAndUpdateStreak();

        stopScheduler();
        expectedBeatsRef.current = [];
        evaluationsRef.current = [];
        extrasRef.current = 0;
        startedAtRef.current = Date.now();

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
            clickEnabled: true,
            clickEveryStep: true,
            onStep: (step) => {
                if (mode === "scored") {
                    if (step.index >= totalExpected) return;
                    expectedBeatsRef.current.push({
                        id: step.index,
                        time: step.time,
                        matched: false,
                    });
                }

                const delayMs = clockRef.current.toDelayMs(step.time);
                window.setTimeout(() => {
                    setCurrentBeat(step.beatIndex);
                }, delayMs);
            },
        });

        schedulerRef.current = scheduler;
        scheduler.start();

        if (mode === "scored") {
            const durationMs = Math.ceil(totalExpected * (60 / settings.bpm) * 1000 + 350);
            finishTimerRef.current = window.setTimeout(() => {
                finalizeSession();
            }, durationMs);
        }

        trackEvent("fm_v2_rhythm_session_started", {
            mode: "tap-beat",
            tempo: settings.bpm,
            time_signature: `${settings.timeSignatureTop}/4`,
            bars: settings.bars,
            total_expected: mode === "scored" ? totalExpected : 0,
            input_latency_ms: inputLatencyMs,
            session_mode: mode,
        });
    }, [
        checkAndUpdateStreak,
        finalizeSession,
        inputLatencyMs,
        settings.bpm,
        settings.bars,
        settings.timeSignatureTop,
        stopScheduler,
        totalExpected,
    ]);

    const handleTap = useCallback(() => {
        if (sessionModeRef.current !== "scored") return;
        if (statusRef.current !== "running") return;

        const rawTapTime = clockRef.current.now();
        const tapTime = applyInputLatencyCompensation(rawTapTime, inputLatencyMs);
        const candidate = expectedBeatsRef.current
            .filter((beat) => !beat.matched)
            .map((beat) => ({
                beat,
                absOffsetSec: Math.abs(tapTime - beat.time),
            }))
            .filter((item) => item.absOffsetSec <= MATCH_WINDOW_SEC)
            .sort((left, right) => left.absOffsetSec - right.absOffsetSec)[0];

        if (!candidate) {
            extrasRef.current += 1;
            const extraEval: TapEvaluation = {
                offsetMs: MATCH_WINDOW_SEC * 1000,
                absOffsetMs: MATCH_WINDOW_SEC * 1000,
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
            time_signature: `${settings.timeSignatureTop}/4`,
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
    }, [inputLatencyMs, settings.bpm, settings.bars, settings.timeSignatureTop, stopScheduler, updatePracticeTime]);

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
                        <CardTitle>Tap the Beat</CardTitle>
                        <CardDescription>
                            Keep steady time against the click. Train pulse before complexity.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="tap-beat-bpm">Tempo</Label>
                                <input
                                    id="tap-beat-bpm"
                                    type="number"
                                    min={40}
                                    max={200}
                                    value={settings.bpm}
                                    onChange={(event) => {
                                        const value = Number(event.target.value);
                                        if (Number.isNaN(value)) return;
                                        setSettings((prev) => ({
                                            ...prev,
                                            bpm: Math.max(40, Math.min(200, Math.round(value))),
                                        }));
                                    }}
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="tap-beat-time-signature">Time Signature</Label>
                                <select
                                    id="tap-beat-time-signature"
                                    value={settings.timeSignatureTop}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            timeSignatureTop: Number(event.target.value) as TapTheBeatSettings["timeSignatureTop"],
                                        }))
                                    }
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value={4}>4/4</option>
                                    <option value={3}>3/4</option>
                                    <option value={6}>6/8 (pulse)</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="tap-beat-bars">Bars</Label>
                                <select
                                    id="tap-beat-bars"
                                    value={settings.bars}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            bars: Math.max(2, Math.min(16, Number(event.target.value))),
                                        }))
                                    }
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value={4}>4</option>
                                    <option value={8}>8</option>
                                    <option value={12}>12</option>
                                    <option value={16}>16</option>
                                </select>
                            </div>
                        </div>

                        <LatencyCompensationControl
                            value={inputLatencyMs}
                            onChange={setInputLatencyMs}
                        />

                        <div className="flex flex-wrap gap-2">
                            <Button onClick={() => void startSessionWithMode("scored")} className="w-full sm:w-auto">
                                Start Scored Session
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => void startSessionWithMode("practice")}
                                className="w-full sm:w-auto"
                            >
                                Practice with Guitar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <span className="font-semibold text-primary">Tempo {settings.bpm} BPM</span>
                <span className="text-muted-foreground">
                    {settings.timeSignatureTop}/4 · {settings.bars} bars
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
                    Practice mode active: play with your guitar and stop manually when done.
                </div>
            )}

            {sessionMode === "scored" && summary && (
                <Card>
                    <CardHeader>
                        <CardTitle>Session Summary</CardTitle>
                        <CardDescription>
                            Score {summary.score} · Accuracy {summary.accuracy}%
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div className="rounded-md border border-border bg-muted/20 p-2">
                            <p className="text-xs text-muted-foreground">Hits</p>
                            <p className="text-lg font-bold">{summary.hits}</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-2">
                            <p className="text-xs text-muted-foreground">Misses</p>
                            <p className="text-lg font-bold">{summary.misses}</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-2">
                            <p className="text-xs text-muted-foreground">Extras</p>
                            <p className="text-lg font-bold">{summary.extras}</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-2">
                            <p className="text-xs text-muted-foreground">Avg offset</p>
                            <p className="text-lg font-bold">{summary.avgOffsetMs}ms</p>
                        </div>
                        <div className="col-span-2 sm:col-span-4 pt-2">
                            <Button
                                onClick={() => {
                                    setStatus("idle");
                                    statusRef.current = "idle";
                                }}
                                className="w-full sm:w-auto"
                            >
                                New Session
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {status === "running" && (
                <Button
                    variant="outline"
                    onClick={sessionMode === "scored" ? finalizeSession : stopPracticeSession}
                    className="w-full sm:w-auto"
                >
                    Stop
                </Button>
            )}
        </div>
    );
}

export default TapTheBeatMode;

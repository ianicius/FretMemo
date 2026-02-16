import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
    message: string;
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
    const message = trend === "up"
        ? `Adaptive tempo: +${nextBpm - bpm} BPM (next session ${nextBpm}).`
        : trend === "down"
            ? `Adaptive tempo: -${bpm - nextBpm} BPM for cleaner timing (next session ${nextBpm}).`
            : `Adaptive tempo kept ${bpm} BPM for the next run.`;

    return {
        nextBpm,
        changed,
        trend,
        message,
    };
}

export function RhythmReadingMode() {
    const clockRef = useRef(new RhythmClock());
    const schedulerRef = useRef<MetronomeScheduler | null>(null);
    const expectedHitsRef = useRef<ExpectedHit[]>([]);
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
        setAdaptiveTempoMessage(adaptiveTempoResult?.message ?? null);
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
        stopScheduler,
        totalExpected,
        updatePracticeTime,
    ]);

    const startSessionWithMode = useCallback(async (mode: SessionMode) => {
        await clockRef.current.warmUp();
        checkAndUpdateStreak();

        stopScheduler();
        expectedHitsRef.current = [];
        evaluationsRef.current = [];
        extrasRef.current = 0;
        startedAtRef.current = Date.now();

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
            clickEnabled: settings.clickEnabled,
            onStep: (step) => {
                if (mode === "scored" && step.index >= totalSteps) return;

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
                finalizeSession();
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
        finalizeSession,
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
        const candidate = expectedHitsRef.current
            .filter((hit) => !hit.matched)
            .map((hit) => ({
                hit,
                absOffsetSec: Math.abs(tapTime - hit.time),
            }))
            .filter((item) => item.absOffsetSec <= MATCH_WINDOW_SEC)
            .sort((left, right) => left.absOffsetSec - right.absOffsetSec)[0];

        if (!candidate) {
            extrasRef.current += 1;
            const extraEvaluation: TapEvaluation = {
                offsetMs: MATCH_WINDOW_SEC * 1000,
                absOffsetMs: MATCH_WINDOW_SEC * 1000,
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
                            <CardTitle>Rhythm Reading</CardTitle>
                            <Badge variant="outline" className="capitalize">
                                {activeExercise.difficulty}
                            </Badge>
                        </div>
                        <CardDescription>
                            Read the notation lane and tap only on note starts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                            <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
                                <p className="text-muted-foreground">Exercise</p>
                                <p className="font-semibold text-foreground">{activeExercise.title}</p>
                            </div>
                            <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
                                <p className="text-muted-foreground">Time</p>
                                <p className="font-semibold text-foreground">{activeExercise.timeSignatureTop}/4</p>
                            </div>
                            <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
                                <p className="text-muted-foreground">Expected taps</p>
                                <p className="font-semibold text-foreground">{expectedOnsets.length} / bar</p>
                            </div>
                            <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
                                <p className="text-muted-foreground">Grid</p>
                                <p className="font-semibold text-foreground">{activeExercise.subdivision} subdivisions</p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="rhythm-reading-level">Level</Label>
                                <select
                                    id="rhythm-reading-level"
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
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    {LEVEL_OPTIONS.map((level) => (
                                        <option key={`rr-level-${level}`} value={level}>
                                            Level {level}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="rhythm-reading-exercise">Exercise</Label>
                                <select
                                    id="rhythm-reading-exercise"
                                    value={activeExercise.id}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            exerciseId: event.target.value,
                                        }))
                                    }
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    {levelExercises.map((exercise) => (
                                        <option key={exercise.id} value={exercise.id}>
                                            {exercise.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="rhythm-reading-bpm">Tempo</Label>
                                <input
                                    id="rhythm-reading-bpm"
                                    type="number"
                                    min={TEMPO_MIN}
                                    max={TEMPO_MAX}
                                    value={settings.bpm}
                                    onChange={(event) => {
                                        const value = Number(event.target.value);
                                        if (Number.isNaN(value)) return;
                                        setSettings((prev) => ({
                                            ...prev,
                                            bpm: clampTempo(value),
                                        }));
                                    }}
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="rhythm-reading-bars">Bars</Label>
                                <select
                                    id="rhythm-reading-bars"
                                    value={settings.bars}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            bars: Math.max(4, Math.min(16, Number(event.target.value))),
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
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="rhythm-reading-click">Audio Click</Label>
                                <select
                                    id="rhythm-reading-click"
                                    value={settings.clickEnabled ? "on" : "off"}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            clickEnabled: event.target.value === "on",
                                        }))
                                    }
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="on">On</option>
                                    <option value="off">Off</option>
                                </select>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
                                    <div>
                                        <Label htmlFor="rhythm-reading-adaptive">Adaptive Tempo</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Auto-adjust BPM after each session based on score.
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
                            {activeExercise.description}
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
                                Random Exercise
                            </Button>
                            <Button type="button" onClick={() => void startSessionWithMode("scored")}>
                                Start Scored Session
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void startSessionWithMode("practice")}
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
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <div className="space-y-0.5">
                    <p className="font-semibold text-primary">{activeExercise.title}</p>
                    <p className="text-xs text-muted-foreground">
                        {activeExercise.timeSignatureTop}/4 · {activeExercise.subdivision} grid · {expectedOnsets.length} taps/bar
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline">L{settings.level}</Badge>
                    <Badge variant="outline">{settings.bpm} BPM</Badge>
                    <Badge variant="outline">{settings.bars} bars</Badge>
                    {sessionMode === "practice" && <Badge variant="outline">Practice</Badge>}
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
                    Practice mode: play this rhythm on guitar. The app keeps the groove running until you stop manually.
                </div>
            )}

            {summary && (
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
                        {adaptiveTempoMessage && (
                            <div className="col-span-2 rounded-md border border-primary/30 bg-primary/10 p-2 text-xs font-medium text-primary sm:col-span-4">
                                {adaptiveTempoMessage}
                            </div>
                        )}
                        <div className="col-span-2 pt-2 sm:col-span-4">
                            <div className="flex flex-wrap gap-2">
                                <Button onClick={() => void startSessionWithMode("scored")} className="w-full sm:w-auto">
                                    Retry
                                </Button>
                                <Button variant="outline" onClick={goToSetup} className="w-full sm:w-auto">
                                    Edit Settings
                                </Button>
                            </div>
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
                    {sessionMode === "scored" ? "Stop" : "Stop Practice"}
                </Button>
            )}
        </div>
    );
}

export default RhythmReadingMode;

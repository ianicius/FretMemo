import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, CheckCircle2, Mic, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RhythmClock } from "@/rhythm/engine/RhythmClock";
import { MetronomeScheduler } from "@/rhythm/engine/MetronomeScheduler";
import { computeMicLatencyMs, RmsOnsetDetector } from "@/lib/micLatency";
import { trackEvent } from "@/lib/analytics";
import { useRhythmDojoStore } from "@/stores/useRhythmDojoStore";
import { cn } from "@/lib/utils";

type Phase = "idle" | "measuring" | "result" | "error";

const BPM = 90;
const TOTAL_BEATS = 12;
const TARGET_HITS = 6;
const MIN_HITS = 4;
const MEASURE_WINDOW_SEC = 2; // extra time after the last click

/**
 * Guided mic latency measurement: the user plays (or claps) along with a
 * short click track; sound onsets are timestamped on the same AudioContext
 * timeline as the clicks, and the median offset becomes the input latency
 * compensation (stored in the rhythm-dojo store, shared with its slider).
 */
export function MicLatencyCalibration() {
    const { t } = useTranslation();
    const inputLatencyMs = useRhythmDojoStore((state) => state.inputLatencyMs);
    const setInputLatencyMs = useRhythmDojoStore((state) => state.setInputLatencyMs);

    const [phase, setPhase] = useState<Phase>("idle");
    const [hitCount, setHitCount] = useState(0);
    const [measuredMs, setMeasuredMs] = useState<number | null>(null);
    const [applied, setApplied] = useState(false);
    const [errorKey, setErrorKey] = useState<string | null>(null);

    const clockRef = useRef<RhythmClock | null>(null);
    const schedulerRef = useRef<MetronomeScheduler | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const abortRef = useRef(false);
    const frameRef = useRef(0);

    const teardown = useCallback(() => {
        abortRef.current = true;
        window.cancelAnimationFrame(frameRef.current);
        schedulerRef.current?.stop();
        schedulerRef.current = null;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        sourceRef.current?.disconnect();
        sourceRef.current = null;
        // AudioContexts are capped per document (~6 in Chrome) — a wizard that
        // can re-run must not accumulate them.
        clockRef.current?.close();
        clockRef.current = null;
    }, []);

    useEffect(() => teardown, [teardown]);

    const finish = useCallback(
        (onsets: number[], clicks: number[]) => {
            teardown();
            const result = computeMicLatencyMs(onsets, clicks, {
                minHits: MIN_HITS,
                maxLatencyMs: 250,
            });
            if (result === null) {
                setErrorKey("settingsPage.audio.latency.tooFewHits");
                setPhase("error");
            } else {
                setMeasuredMs(result.offsetMs);
                setApplied(false);
                setPhase("result");
            }
        },
        [teardown],
    );

    const startCalibration = useCallback(async () => {
        abortRef.current = false;
        setErrorKey(null);
        setMeasuredMs(null);
        setApplied(false);
        setHitCount(0);
        setPhase("measuring");

        let clock: RhythmClock;
        try {
            clock = new RhythmClock();
            await clock.warmUp();
        } catch {
            setErrorKey("settingsPage.audio.latency.noMic");
            setPhase("error");
            return;
        }
        if (abortRef.current) {
            teardown();
            return;
        }
        clockRef.current = clock;
        const ctx = clock.getContext();

        let stream: MediaStream;
        try {
            // The permission prompt can hang forever (dismissed overlay, kiosk
            // modes); time the capture request out so the wizard stays usable.
            let cancelTimeout = () => {};
            const captureTimeout = new Promise<never>((_, reject) => {
                const timerId = window.setTimeout(
                    () => reject(new Error("getUserMedia timeout")),
                    12_000,
                );
                cancelTimeout = () => window.clearTimeout(timerId);
            });
            const capturePromise = navigator.mediaDevices.getUserMedia({
                audio: {
                    autoGainControl: false,
                    echoCancellation: false,
                    noiseSuppression: false,
                },
            });
            // If the prompt resolves after the timeout won the race, nobody
            // owns the stream — stop it immediately instead of leaving the
            // microphone live until page unload.
            capturePromise.then(
                (lateStream) => {
                    if (abortRef.current) {
                        lateStream.getTracks().forEach((track) => track.stop());
                    }
                },
                () => {},
            );
            try {
                stream = await Promise.race([capturePromise, captureTimeout]);
            } finally {
                cancelTimeout();
            }
        } catch {
            teardown();
            setErrorKey("settingsPage.audio.latency.noMic");
            setPhase("error");
            return;
        }
        if (abortRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
        }
        streamRef.current = stream;

        try {
            const source = ctx.createMediaStreamSource(stream);
            sourceRef.current = source;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            const buffer = new Float32Array(analyser.fftSize);

            const detector = new RmsOnsetDetector();
            const onsets: number[] = [];
            const clickTimes: number[] = [];
            let windowEndSec = 0;

            const scheduler = new MetronomeScheduler({
                clock,
                bpm: BPM,
                timeSignatureTop: 4,
                subdivision: 1,
                maxSteps: TOTAL_BEATS,
                clickEnabled: true,
                clickEveryStep: true,
                onStep: (step) => {
                    clickTimes.push(step.time);
                    if (step.index === TOTAL_BEATS - 1) {
                        windowEndSec = step.time + MEASURE_WINDOW_SEC;
                    }
                },
            });
            schedulerRef.current = scheduler;
            scheduler.start();

            const tick = () => {
                if (abortRef.current) return;
                analyser.getFloatTimeDomainData(buffer);
                let sumSquares = 0;
                for (let i = 0; i < buffer.length; i += 1) {
                    sumSquares += buffer[i] * buffer[i];
                }
                const rms = Math.sqrt(sumSquares / buffer.length);
                const onset = detector.feed(rms, clock.now());
                if (onset !== null) {
                    onsets.push(onset);
                    setHitCount(onsets.length);
                }
                const nowSec = clock.now();
                if (onsets.length >= TARGET_HITS || (windowEndSec > 0 && nowSec > windowEndSec)) {
                    finish(onsets, clickTimes);
                    return;
                }
                frameRef.current = window.requestAnimationFrame(tick);
            };
            frameRef.current = window.requestAnimationFrame(tick);
        } catch {
            teardown();
            setErrorKey("settingsPage.audio.latency.noMic");
            setPhase("error");
        }
    }, [finish, teardown]);

    const applyResult = useCallback(() => {
        if (measuredMs !== null) {
            setInputLatencyMs(measuredMs);
            trackEvent("fm_v2_latency_calibrated", { latency_ms: measuredMs });
            setApplied(true);
        }
    }, [measuredMs, setInputLatencyMs]);

    return (
        <div className="space-y-3 rounded-lg border border-border/50 p-3">
            <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t("settingsPage.audio.latency.title")}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {t("settingsPage.audio.latency.current", { ms: inputLatencyMs })}
                </span>
            </div>
            <p className="text-xs text-muted-foreground">{t("settingsPage.audio.latency.hint")}</p>

            {phase === "idle" && (
                <Button type="button" variant="outline" size="sm" onClick={() => void startCalibration()}>
                    <Activity className="h-4 w-4" />
                    {t("settingsPage.audio.latency.calibrate")}
                </Button>
            )}

            {phase === "measuring" && (
                <div className="space-y-1.5">
                    <p className="text-sm">{t("settingsPage.audio.latency.listening")}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                        {t("settingsPage.audio.latency.measuringProgress", {
                            hit: hitCount,
                            target: TARGET_HITS,
                        })}
                    </p>
                </div>
            )}

            {phase === "result" && measuredMs !== null && (
                <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        {t("settingsPage.audio.latency.measuredMs", { ms: measuredMs })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={applyResult}>
                            {t("settingsPage.audio.latency.apply")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => void startCalibration()}>
                            <RotateCcw className="h-4 w-4" />
                            {t("settingsPage.audio.latency.retry")}
                        </Button>
                    </div>
                    {applied && (
                        <p className={cn("text-xs text-emerald-600 dark:text-emerald-400")}>
                            {t("settingsPage.audio.latency.applied")}
                        </p>
                    )}
                </div>
            )}

            {phase === "error" && errorKey !== null && (
                <div className="space-y-2">
                    <p className="text-sm text-destructive" role="alert">
                        {t(errorKey)}
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => void startCalibration()}>
                        <RotateCcw className="h-4 w-4" />
                        {t("settingsPage.audio.latency.retry")}
                    </Button>
                </div>
            )}
        </div>
    );
}

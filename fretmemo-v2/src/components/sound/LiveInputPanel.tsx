/**
 * Live input panel: microphone monitoring through the active sound chain.
 *
 * Wraps the `liveInput` controller (src/audio/liveInput.ts) in the page's
 * collapsible-section visual language:
 * - enable/disable starts/stops the capture (browser prompts on enable),
 * - status line + input level meter (AnalyserNode rAF loop, no re-renders —
 *   the fill width is written straight to the DOM node),
 * - headphones/feedback warning while monitoring is on,
 * - emergency mute (graph-level disconnect: instant, capture stays alive),
 * - handled error states for denied/missing microphone with actionable copy.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Headphones, Loader2, Mic, MicOff, TriangleAlert, VolumeX } from "lucide-react";
import { liveInput } from "@/audio/liveInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCollapse } from "@/components/ui/section-collapse";
import { useTranslation } from "react-i18next";

export function LiveInputPanel() {
    const { t } = useTranslation();
    const state = useSyncExternalStore(liveInput.subscribe, liveInput.getState);
    const [open, setOpen] = useState(false);
    const meterFillRef = useRef<HTMLDivElement | null>(null);

    // Level meter: one rAF loop while live input is on. Peak deviation from
    // the byte-domain midpoint (128) drives the fill width; writing it to
    // the DOM node keeps the 60 fps updates out of React's render loop.
    useEffect(() => {
        if (state.status !== "on") return;
        const analyser = liveInput.getAnalyser();
        if (!analyser) return;
        const buffer = new Uint8Array(analyser.fftSize);
        let frame = 0;
        const tick = () => {
            analyser.getByteTimeDomainData(buffer);
            let peak = 0;
            for (let i = 0; i < buffer.length; i += 1) {
                const deviation = Math.abs(buffer[i] - 128);
                if (deviation > peak) peak = deviation;
            }
            const fill = meterFillRef.current;
            if (fill) {
                fill.style.width = `${Math.min(100, Math.round((peak / 128) * 100))}%`;
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [state.status]);

    const handleToggle = useCallback(() => {
        if (state.status === "on" || state.status === "starting") {
            liveInput.stop();
        } else {
            void liveInput.start();
        }
    }, [state.status]);

    const handleMuteToggle = useCallback(() => {
        liveInput.toggleMuted();
    }, []);

    const isLive = state.status === "on";
    const isStarting = state.status === "starting";
    const statusText = t(`sound.live.status.${state.status}`);

    return (
        <SectionCollapse
            title={t("sound.live.title")}
            summary={t("sound.live.summary")}
            open={open}
            onOpenChange={setOpen}
            className="[&>button:hover]:bg-muted/50"
        >
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("sound.live.description")}</p>

                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-medium">{statusText}</p>
                        {state.muted && <Badge variant="secondary">{t("sound.live.muted")}</Badge>}
                    </div>
                    <Button
                        type="button"
                        variant={isLive ? "outline" : "default"}
                        size="sm"
                        disabled={isStarting}
                        onClick={handleToggle}
                    >
                        {isStarting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                {t("sound.live.starting")}
                            </>
                        ) : isLive ? (
                            <>
                                <MicOff className="h-4 w-4" aria-hidden="true" />
                                {t("sound.live.disable")}
                            </>
                        ) : (
                            <>
                                <Mic className="h-4 w-4" aria-hidden="true" />
                                {t("sound.live.enable")}
                            </>
                        )}
                    </Button>
                </div>

                {state.status === "off" && (
                    <p className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Headphones className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{t("sound.live.hint")}</span>
                    </p>
                )}

                {(isLive || isStarting) && (
                    <div className="space-y-1.5">
                        <Label text={t("sound.live.level")} />
                        <div
                            className="h-2 overflow-hidden rounded-full bg-muted"
                            role="meter"
                            aria-label={t("sound.live.level")}
                        >
                            <div
                                ref={meterFillRef}
                                className="h-full w-0 rounded-full bg-primary transition-[width] duration-75"
                                data-testid="live-input-meter-fill"
                            />
                        </div>
                    </div>
                )}

                {isLive && (
                    <>
                        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            <Headphones className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{t("sound.live.warning")}</span>
                        </p>
                        <Button
                            type="button"
                            variant={state.muted ? "secondary" : "destructive"}
                            className="w-full"
                            onClick={handleMuteToggle}
                        >
                            {state.muted ? (
                                <>
                                    <Mic className="h-4 w-4" aria-hidden="true" />
                                    {t("sound.live.unmute")}
                                </>
                            ) : (
                                <>
                                    <VolumeX className="h-4 w-4" aria-hidden="true" />
                                    {t("sound.live.mute")}
                                </>
                            )}
                        </Button>
                    </>
                )}

                {state.status === "error" && (
                    <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                        <div className="flex items-start gap-2">
                            <TriangleAlert
                                className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                                aria-hidden="true"
                            />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-destructive">
                                    {t(`sound.live.errors.${state.errorKind ?? "unknown"}.title`)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t(`sound.live.errors.${state.errorKind ?? "unknown"}.description`)}
                                </p>
                            </div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={handleToggle}>
                            {t("sound.live.retry")}
                        </Button>
                    </div>
                )}
            </div>
        </SectionCollapse>
    );
}

/** Small visible label above the level meter (keeps JSX above lean). */
function Label({ text }: { text: string }) {
    return <p className="text-xs font-medium text-muted-foreground">{text}</p>;
}

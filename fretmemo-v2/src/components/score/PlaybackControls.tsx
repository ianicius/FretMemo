import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5];

function formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface PlaybackControlsProps {
    playing: boolean;
    ready: boolean;
    playerError: boolean;
    soundfontProgress: number | null;
    positionMs: number;
    durationMs: number;
    speed: number;
    volume: number;
    metronomeOn: boolean;
    /** Guitar mode: transport runs through the engine (no speed/metronome). */
    guitarMode?: boolean;
    /** 0..1 while the guitar-mode render is running; null when idle. */
    guitarRenderProgress?: number | null;
    onPlayToggle: () => void;
    onStop: () => void;
    onSpeedChange: (speed: number) => void;
    onVolumeChange: (volume: number) => void;
    onMetronomeToggle: () => void;
    onRetry: () => void;
}

/** Transport bar for song playback in the score viewer (pure presentation). */
export function PlaybackControls({
    playing,
    ready,
    playerError,
    soundfontProgress,
    positionMs,
    durationMs,
    speed,
    volume,
    metronomeOn,
    guitarMode = false,
    guitarRenderProgress = null,
    onPlayToggle,
    onStop,
    onSpeedChange,
    onVolumeChange,
    onMetronomeToggle,
    onRetry,
}: PlaybackControlsProps) {
    const { t } = useTranslation();

    if (playerError) {
        return (
            <div className="space-y-2 rounded-lg border border-destructive/50 p-3" role="alert">
                <p className="text-sm text-destructive">
                    {t("scores.playback.playerError")}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                    <RotateCcw className="h-4 w-4" />
                    {t("scores.playback.retry")}
                </Button>
            </div>
        );
    }

    if (!ready) {
        const percent =
            soundfontProgress === null
                ? null
                : Math.round(soundfontProgress * 100);
        return (
            <div className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                    {t("scores.playback.loadingSoundfont")}
                    {percent !== null ? ` ${percent}%` : ""}
                </span>
            </div>
        );
    }

    const progressPercent =
        durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;

    return (
        <div className="space-y-2.5 rounded-lg border border-border/50 p-3">
            <div className="flex flex-wrap items-center gap-2.5">
                <Button
                    type="button"
                    size="sm"
                    onClick={onPlayToggle}
                    disabled={guitarRenderProgress !== null}
                    aria-label={playing ? t("scores.playback.pause") : t("scores.playback.play")}
                >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {playing ? t("scores.playback.pause") : t("scores.playback.play")}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onStop}
                    disabled={guitarRenderProgress !== null}
                    aria-label={t("scores.playback.stop")}
                >
                    <Square className="h-4 w-4" />
                    {t("scores.playback.stop")}
                </Button>
                <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                    <span>{formatTime(positionMs)}</span>
                    <span>/</span>
                    <span>{formatTime(durationMs)}</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <input
                        type="range"
                        aria-label={t("scores.playback.volume")}
                        min={0}
                        max={1}
                        step={0.05}
                        value={volume}
                        onChange={(event) => onVolumeChange(Number(event.target.value))}
                        className="h-1.5 w-24 accent-primary"
                    />
                    {!guitarMode && (
                        <div className="flex items-center gap-1.5">
                            <Switch
                                checked={metronomeOn}
                                aria-label={t("scores.playback.metronome")}
                                onCheckedChange={onMetronomeToggle}
                            />
                            <Label className="text-xs text-muted-foreground">
                                {t("scores.playback.metronome")}
                            </Label>
                        </div>
                    )}
                </div>
            </div>

            {guitarRenderProgress !== null && (
                <div className="flex items-center gap-2 rounded-md border border-border/50 px-2.5 py-1.5">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-xs text-muted-foreground">
                        {t("scores.playback.renderingGuitar")}{" "}
                        {Math.round(guitarRenderProgress * 100)}%
                    </span>
                </div>
            )}

            <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={t("scores.playback.playbackPosition")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progressPercent)}
            >
                <div
                    className={cn("h-full rounded-full bg-primary transition-all")}
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {!guitarMode && (
                <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground" htmlFor="playback-speed">
                        {t("scores.playback.speed")}
                    </Label>
                    <Select
                        id="playback-speed"
                        className="h-8 w-auto"
                        value={speed}
                        onChange={(event) => onSpeedChange(Number(event.target.value))}
                    >
                        {SPEED_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}×
                            </option>
                        ))}
                    </Select>
                </div>
            )}
        </div>
    );
}

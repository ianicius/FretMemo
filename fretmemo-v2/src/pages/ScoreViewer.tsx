import { useEffect, useRef, useState } from "react";
import {
    Navigate,
    useLocation,
    useNavigate,
    useSearchParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileWarning, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PlaybackControls } from "@/components/score/PlaybackControls";
import { cn } from "@/lib/utils";
import { trackFeatureOpened } from "@/lib/analytics";
import { formatScoreMetaLine } from "@/lib/scoreDisplay";
import { getScoreBytes, listScoreMeta } from "@/lib/scoreStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import {
    getSongDestination,
    getSongEngineContext,
    renderSongToBuffer,
    SongPlayback,
} from "@/audio/songPlayback";
import type { ScoreSummary } from "@/types/scores";
// Type-only import: erased at build time, keeps alphaTab out of the entry chunk.
import type { AlphaTabApi, model } from "@coderline/alphatab";

type AlphaTabScore = model.Score;

type ViewerStatus = "loading" | "ready" | "error" | "not-found";

const SOUNDFONT_URL = `${import.meta.env.BASE_URL}soundfont/MuseScore_General_Lite.sf3`;
/** alphatab.synth.PlayerState.Playing — inlined to avoid a top-level runtime import. */
const PLAYER_STATE_PLAYING = 1;

/**
 * Renders an imported Guitar Pro score as interactive tablature (SVG) via
 * alphaTab. The library is loaded dynamically so it never enters the initial
 * bundle; rendering happens on the main thread (`useWorkers: false`) because
 * playback (and its soundfont decision) is out of scope until R-02.
 */
export default function ScoreViewer() {
    const [searchParams] = useSearchParams();
    const id = searchParams.get("id");
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    const containerRef = useRef<HTMLDivElement | null>(null);
    const apiRef = useRef<AlphaTabApi | null>(null);
    const scoreRef = useRef<AlphaTabScore | null>(null);
    const trackedRef = useRef(false);

    const [meta, setMeta] = useState<ScoreSummary | null>(null);
    const [status, setStatus] = useState<ViewerStatus>("loading");
    const [trackNames, setTrackNames] = useState<string[]>([]);
    const [trackIndex, setTrackIndex] = useState(0);

    // Playback state (fed by AlphaTabApi events).
    const [playerReady, setPlayerReady] = useState(false);
    const [playerError, setPlayerError] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [positionMs, setPositionMs] = useState(0);
    const [durationMs, setDurationMs] = useState(0);
    const [soundfontProgress, setSoundfontProgress] = useState<number | null>(null);
    const [speed, setSpeed] = useState(1);
    const [volume, setVolume] = useState(0.8);
    const [metronomeOn, setMetronomeOn] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const displayTheme = useSettingsStore((state) => state.full.display.theme);
    const playerStateRef = useRef(1); // alphatab.synth.PlayerState.Playing, refreshed on import

    // Guitar-sound playback: the score is rendered offline (exportAudio) and
    // played through the engine chain, so the active preset colors the song.
    const songPlaybackRef = useRef<SongPlayback | null>(null);
    const songBufferRef = useRef<AudioBuffer | null>(null);
    const [guitarMode, setGuitarMode] = useState(false);
    const [guitarRendering, setGuitarRendering] = useState(false);
    const [guitarRenderProgress, setGuitarRenderProgress] = useState<number | null>(null);

    const entrySource =
        (location.state as { source?: string } | null)?.source ?? null;

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        let api: AlphaTabApi | null = null;
        trackedRef.current = false;
        setStatus("loading");
        setMeta(null);
        setTrackNames([]);
        setTrackIndex(0);
        setPlayerReady(false);
        setPlayerError(false);
        setPlaying(false);
        setPositionMs(0);
        setSoundfontProgress(null);
        scoreRef.current = null;
        songPlaybackRef.current?.dispose();
        songPlaybackRef.current = null;
        songBufferRef.current = null;
        setGuitarMode(false);
        setGuitarRendering(false);
        setGuitarRenderProgress(null);

        (async () => {
            try {
                const bytes = await getScoreBytes(id);
                if (cancelled) return;
                if (!bytes) {
                    setStatus("not-found");
                    return;
                }

                const [alphatab, metas] = await Promise.all([
                    import("@coderline/alphatab"),
                    listScoreMeta(),
                ]);
                if (cancelled || !containerRef.current) return;

                const score = alphatab.importer.ScoreLoader.loadScoreFromBytes(
                    new Uint8Array(bytes),
                );
                const settings = new alphatab.Settings();
                settings.core.engine = "svg";
                settings.core.fontDirectory = `${import.meta.env.BASE_URL}font/bravura/`;
                settings.core.useWorkers = false;
                // Guitar-first default: always show standard notation plus
                // tablature, regardless of what the file declares.
                settings.display.staveProfile = alphatab.StaveProfile.ScoreTab;
                // alphaTab draws glyphs black by default — invisible on the
                // dark theme's near-black background. Re-color the notation
                // to match the app palette when the document is dark.
                const isDarkTheme = document.documentElement.classList.contains("dark");
                if (isDarkTheme) {
                    const resourceColor = (hex: string) =>
                        alphatab.model.Color.fromJson(hex)!;
                    settings.display.resources.mainGlyphColor = resourceColor("#e5e7eb");
                    settings.display.resources.secondaryGlyphColor = resourceColor("#9ca3af");
                    settings.display.resources.staffLineColor = resourceColor("#6b7280");
                    settings.display.resources.barSeparatorColor = resourceColor("#6b7280");
                    settings.display.resources.barNumberColor = resourceColor("#9ca3af");
                    settings.display.resources.scoreInfoColor = resourceColor("#e5e7eb");
                }
                settings.player.playerMode = alphatab.PlayerMode.EnabledSynthesizer;
                settings.player.soundFont = SOUNDFONT_URL;

                const storedMeta = metas.find((item) => item.id === id) ?? null;

                api = new alphatab.AlphaTabApi(containerRef.current, settings);
                apiRef.current = api;
                scoreRef.current = score;

                api.playerReady.on(() => {
                    if (!cancelled) setPlayerReady(true);
                });
                api.playerStateChanged.on((args) => {
                    if (!cancelled) setPlaying(args.state === PLAYER_STATE_PLAYING);
                });
                // A failed 38 MB soundfont download would otherwise leave the
                // transport spinning forever — surface it with a retry.
                api.error.on(() => {
                    if (!cancelled) setPlayerError(true);
                });
                api.player!.soundFontLoadFailed.on(() => {
                    if (!cancelled) setPlayerError(true);
                });
                api.playerPositionChanged.on((args) => {
                    if (cancelled) return;
                    setPositionMs(args.currentTime);
                    setDurationMs(args.endTime);
                });
                api.soundFontLoad.on((progress) => {
                    if (!cancelled && progress.total > 0) {
                        setSoundfontProgress(progress.loaded / progress.total);
                    }
                });
                api.playerFinished.on(() => {
                    if (!cancelled) setPlaying(false);
                });

                const names = score.tracks.map((track, index) =>
                    track.name.length > 0 ? track.name : `Track ${index + 1}`,
                );
                const percussionIndex = score.tracks.findIndex(
                    (track) => !track.isPercussion,
                );
                const initialIndex = percussionIndex >= 0 ? percussionIndex : 0;

                setMeta(
                    storedMeta ?? {
                        id,
                        name: "",
                        addedAt: Date.now(),
                        sizeBytes: bytes.byteLength,
                        format: "gp",
                        title: score.title || id,
                        trackCount: score.tracks.length,
                        tempoBpm: score.tempo > 0 ? score.tempo : null,
                    },
                );
                setTrackNames(names);
                setTrackIndex(initialIndex);
                api.renderScore(score, [initialIndex]);
                api.playbackSpeed = speed;
                api.masterVolume = volume;
                api.metronomeVolume = metronomeOn ? 0.5 : 0;
                playerStateRef.current =
                    (alphatab.synth?.PlayerState?.Playing as number | undefined) ??
                    PLAYER_STATE_PLAYING;
                setStatus("ready");

                if (!trackedRef.current) {
                    trackedRef.current = true;
                    trackFeatureOpened("scores", id, entrySource);
                }
            } catch {
                if (!cancelled) {
                    setStatus("error");
                }
            }
        })();

        return () => {
            cancelled = true;
            api?.destroy();
            apiRef.current = null;
            scoreRef.current = null;
            songPlaybackRef.current?.dispose();
            songPlaybackRef.current = null;
            songBufferRef.current = null;
        };
    }, [id, entrySource, reloadKey, displayTheme]);

    const handleTrackChange = (index: number) => {
        setTrackIndex(index);
        if (apiRef.current && scoreRef.current) {
            apiRef.current.renderScore(scoreRef.current, [index]);
        }
        if (guitarMode) {
            // The rendered mix reflects the previous track selection — drop it;
            // the next play press re-renders with the new selection.
            songPlaybackRef.current?.dispose();
            songPlaybackRef.current = null;
            songBufferRef.current = null;
            setPlaying(false);
            setGuitarRenderProgress(null);
        }
    };

    const startGuitarRender = async () => {
        const api = apiRef.current;
        if (!api || guitarRendering) return;
        setGuitarRendering(true);
        setGuitarRenderProgress(0);
        try {
            const ctx = getSongEngineContext();
            const buffer = await renderSongToBuffer(ctx, api, (progress) => {
                setGuitarRenderProgress(
                    progress.totalMs > 0 ? progress.renderedMs / progress.totalMs : 0,
                );
            });
            songBufferRef.current = buffer;
            songPlaybackRef.current?.dispose();
            songPlaybackRef.current = new SongPlayback(ctx, getSongDestination(), buffer, {
                onPosition: (ms) => {
                    setPositionMs(ms);
                    // alphaTab stays paused; its cursors follow our clock.
                    if (apiRef.current) apiRef.current.timePosition = ms;
                },
                onEnded: () => setPlaying(false),
            });
            setDurationMs(buffer.duration * 1000);
            songPlaybackRef.current.play(0);
            setPlaying(true);
        } catch {
            // Render failed (e.g. soundfont not loaded) — fall back to the
            // soundfont transport instead of leaving a dead toggle on.
            setGuitarMode(false);
        } finally {
            setGuitarRendering(false);
            setGuitarRenderProgress(null);
        }
    };

    const handleGuitarModeToggle = () => {
        const next = !guitarMode;
        if (next) {
            apiRef.current?.pause(); // keep alphaTab's synth silent under our transport
            if (songBufferRef.current && songPlaybackRef.current) {
                songPlaybackRef.current.play();
                setPlaying(true);
            } else {
                void startGuitarRender();
            }
        } else {
            songPlaybackRef.current?.pause();
            setPlaying(false);
        }
        setGuitarMode(next);
    };

    const handlePlayToggle = () => {
        const api = apiRef.current;
        if (!api) return;
        if (guitarMode) {
            const playback = songPlaybackRef.current;
            if (!playback) {
                void startGuitarRender();
                return;
            }
            if (playback.playing) {
                playback.pause();
                setPlaying(false);
            } else {
                playback.play();
                setPlaying(true);
            }
            return;
        }
        if (api.playerState === playerStateRef.current) {
            api.pause();
        } else {
            void api.play();
        }
    };

    const handleStop = () => {
        if (guitarMode) {
            songPlaybackRef.current?.stop();
            setPlaying(false);
            setPositionMs(0);
            if (apiRef.current) apiRef.current.timePosition = 0;
            return;
        }
        apiRef.current?.stop();
        setPlaying(false);
        setPositionMs(0);
    };

    const handleSpeedChange = (next: number) => {
        setSpeed(next);
        if (apiRef.current) apiRef.current.playbackSpeed = next;
    };

    const handleVolumeChange = (next: number) => {
        setVolume(next);
        if (guitarMode) {
            // Guitar mode plays through the engine — its master volume is the
            // app-wide audio setting.
            const settings = useSettingsStore.getState();
            settings.updateFullSettings({ audio: { ...settings.full.audio, volume: next } });
            return;
        }
        if (apiRef.current) apiRef.current.masterVolume = next;
    };

    const handleMetronomeToggle = () => {
        const next = !metronomeOn;
        setMetronomeOn(next);
        if (apiRef.current) apiRef.current.metronomeVolume = next ? 0.5 : 0;
    };

    if (!id) {
        return <Navigate to="/train" replace />;
    }

    return (
        <div className="space-y-4 pb-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/train")}
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t("scores.back")}
                </Button>
            </div>

            <div>
                <h1 className="type-display truncate">
                    {meta?.title ?? t("library.scores")}
                </h1>
                {meta && (
                <p className="mt-1 text-xs text-muted-foreground">
                    {formatScoreMetaLine(meta, t, i18n.language)}
                </p>
                )}
            </div>

            {status === "ready" && (
                <>
                    <div className="flex items-center justify-end gap-2">
                        <Switch
                            id="guitar-mode"
                            checked={guitarMode}
                            onCheckedChange={handleGuitarModeToggle}
                            disabled={guitarRendering}
                        />
                        <Label
                            htmlFor="guitar-mode"
                            className="cursor-pointer text-xs text-muted-foreground"
                        >
                            {t("scores.playback.guitarMode")}
                        </Label>
                    </div>
                    <PlaybackControls
                        playing={playing}
                        ready={playerReady}
                        playerError={playerError}
                        soundfontProgress={soundfontProgress}
                        positionMs={positionMs}
                        durationMs={durationMs}
                        speed={speed}
                        volume={volume}
                        metronomeOn={metronomeOn}
                        guitarMode={guitarMode}
                        guitarRenderProgress={guitarRendering ? guitarRenderProgress : null}
                        onPlayToggle={handlePlayToggle}
                        onStop={handleStop}
                        onSpeedChange={handleSpeedChange}
                        onVolumeChange={handleVolumeChange}
                        onMetronomeToggle={handleMetronomeToggle}
                        onRetry={() => setReloadKey((key) => key + 1)}
                    />
                </>
            )}

            {status === "ready" && trackNames.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <label
                        className="text-xs text-muted-foreground"
                        htmlFor="score-track-select"
                    >
                        {t("scores.trackLabel")}
                    </label>
                    <Select
                        id="score-track-select"
                        className="h-9 w-auto"
                        value={trackIndex}
                        onChange={(event) =>
                            handleTrackChange(Number(event.target.value))
                        }
                    >
                        {trackNames.map((name, index) => (
                            <option key={`${index}-${name}`} value={index}>
                                {name}
                            </option>
                        ))}
                    </Select>
                </div>
            )}

            {status === "loading" && (
                <div className="flex items-center gap-2 py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">{t("scores.loading")}</span>
                </div>
            )}

            {(status === "not-found" || status === "error") && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-6 text-center">
                    <FileWarning className="mx-auto h-8 w-8 text-destructive" />
                    <h2 className="mt-2 text-base font-semibold">
                        {status === "not-found"
                            ? t("scores.notFoundTitle")
                            : t("scores.loadErrorTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {status === "not-found"
                            ? t("scores.notFoundDesc")
                            : t("scores.loadErrorDesc")}
                    </p>
                </div>
            )}

            {/* alphaTab attaches to and renders into this element. */}
            <div
                ref={containerRef}
                className={cn(
                    "overflow-x-auto rounded-lg border border-border/60 bg-card/40 p-3",
                    status !== "ready" && "hidden",
                )}
            />
        </div>
    );
}

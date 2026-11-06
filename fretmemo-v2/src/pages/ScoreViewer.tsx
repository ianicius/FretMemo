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
import { buildChordTimeline, type ChordTimelineEntry, type PrompterTrack } from "@/lib/chords";
import { ChordPrompter } from "@/components/score/ChordPrompter";
import { useSettingsStore } from "@/stores/useSettingsStore";
import {
    getSongEngineContext,
    renderSongToBuffer,
} from "@/audio/songPlayback";
import { MultiTrackPlayback } from "@/audio/multiTrackPlayback";
import { assemblePerTrackGraph, type AssembledTrackGraph } from "@/audio/perTrackGraph";
import { masterGainValue } from "@/audio/engine";
import { loadNamNode } from "@/audio/nam";
import { getBuiltinPresets, getPresetById, type SoundPreset } from "@/audio/presets";
import { toEnginePreset, useSoundStore } from "@/stores/useSoundStore";
import {
    getTrackConfigs,
    setTrackConfigs,
    sanitizeTrackConfigs,
    type ValidTrackConfig,
} from "@/lib/trackConfigs";
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
    const [volume, setVolume] = useState(() => useSettingsStore.getState().full.audio.volume);
    const [metronomeOn, setMetronomeOn] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const displayTheme = useSettingsStore((state) => state.full.display.theme);
    const [chordTimeline, setChordTimeline] = useState<Array<ChordTimelineEntry | null> | null>(null);
    const [currentBar, setCurrentBar] = useState<number | null>(null);
    const playerStateRef = useRef(1); // alphatab.synth.PlayerState.Playing, refreshed on import

    // Guitar-sound playback: the score is rendered offline (exportAudio) and
    // played through the engine chain, so the active preset colors the song.
    const multiPlaybackRef = useRef<MultiTrackPlayback | null>(null);
    const playbackGraphRef = useRef<AssembledTrackGraph | null>(null);
    const [trackConfigs, setTrackConfigsState] = useState<ValidTrackConfig[]>([]);
    const [namPoolWarning, setNamPoolWarning] = useState(false);
    const [guitarMode, setGuitarMode] = useState(false);
    const [guitarRendering, setGuitarRendering] = useState(false);
    const [guitarRenderProgress, setGuitarRenderProgress] = useState<number | null>(null);
    const [guitarError, setGuitarError] = useState(false);

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
        disposePlayback();
        setTrackConfigsState([]);
        setNamPoolWarning(false);
        setGuitarMode(false);
        setGuitarRendering(false);
        setGuitarRenderProgress(null);

        (async () => {
            try {
                console.log("DBG bytes");
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

                console.log("DBG pre-configs");
                const storedMeta = metas.find((item) => item.id === id) ?? null;
                setTrackConfigsState(
                    sanitizeTrackConfigs(await getTrackConfigs(id), score.tracks.length),
                );

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
                    if (!cancelled) {
                        setPlaying(false);
                        setCurrentBar(null);
                    }
                });
                api.playedBeatChanged.on((beat) => {
                    if (!cancelled) setCurrentBar(beat.voice.bar.index);
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
                setChordTimeline(
                    // alphaTab's Track satisfies the PrompterTrack duck type
                    buildChordTimeline(api.tracks[0] as unknown as PrompterTrack, score.masterBars.length),
                );
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
            } catch (e) {
                console.log("DBG CAUGHT:", String(e));
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
            disposePlayback();
        };
    }, [id, entrySource, reloadKey, displayTheme]);

    const handleTrackChange = (index: number) => {
        setTrackIndex(index);
        if (apiRef.current && scoreRef.current) {
            apiRef.current.renderScore(scoreRef.current, [index]);
            setChordTimeline(
                buildChordTimeline(apiRef.current.tracks[0] as unknown as PrompterTrack, scoreRef.current.masterBars.length),
            );
        }
        if (guitarMode) {
            // The rendered mix reflects the previous track selection — drop it;
            // the next play press re-renders with the new selection.
            disposePlayback();
            setPlaying(false);
            setGuitarRenderProgress(null);
        }
    };

    /** Disposes the playback transport, per-track chains and master gain. */
    const disposePlayback = () => {
        multiPlaybackRef.current?.dispose();
        multiPlaybackRef.current = null;
        playbackGraphRef.current?.dispose();
        playbackGraphRef.current = null;
    };

    /** Cleans up transport + chains but keeps the master gain alive. */
    const disposeTransportOnly = () => {
        multiPlaybackRef.current?.dispose();
        multiPlaybackRef.current = null;
    };

    const resolvePresetById = (id: string): SoundPreset | null => {
        const custom = useSoundStore
            .getState()
            .customPresets.find((preset) => preset.id === id);
        if (custom) {
            return toEnginePreset(custom);
        }
        return getPresetById(id) ?? null;
    };

    const startGuitarRender = async () => {
        const api = apiRef.current;
        const score = scoreRef.current;
        if (!api || !score || guitarRendering) return;
        setGuitarError(false);
        setNamPoolWarning(false);
        setGuitarRendering(true);
        setGuitarRenderProgress(0);
        const ctx = getSongEngineContext();
        try {
            // Per-track rendering: every track (drums included) renders to its
            // own buffer through the soundfont synth, then plays back through
            // its assigned voice — a preset chain or the direct soundfont.
            const tracks = score.tracks.map((track, index) => ({ track, index }));
            const total = tracks.length;

            // NAM pool caps concurrent resident models — more than 3 distinct
            // NAM presets per song would thrash the LRU and kill chains.
            const namPresetIds = new Set(
                trackConfigs
                    .filter((config) => config.kind === "preset" && config.presetId)
                    .map((config) => resolvePresetById(config.presetId!))
                    .filter((preset): preset is SoundPreset => preset?.kind === "nam")
                    .map((preset) => preset.amp),
            );
            const allowedNamAmps = new Set<string>();
            let namOverflow = false;
            for (const amp of namPresetIds) {
                if (allowedNamAmps.size < 3) {
                    allowedNamAmps.add(amp);
                } else {
                    namOverflow = true;
                }
            }
            setNamPoolWarning(namOverflow);

            const outputs: Array<{
                trackIndex: number;
                buffer: AudioBuffer;
                plan: { kind: "preset"; preset: SoundPreset; ampNode?: AudioNode } | { kind: "direct" };
                muted: boolean;
            }> = [];
            for (const { index } of tracks) {
                const config = trackConfigs.find((entry) => entry.trackIndex === index);
                const muted = config?.muted === true;
                if (muted) {
                    // Muted = silence: skip the render entirely.
                    outputs.push({ trackIndex: index, buffer: ctx.createBuffer(2, 1, ctx.sampleRate), plan: { kind: "direct" }, muted: true });
                    continue;
                }
                api.renderScore(score, [index]);
                const buffer = await renderSongToBuffer(ctx, api, (progress) => {
                    const trackFraction =
                        progress.totalMs > 0 ? progress.renderedMs / progress.totalMs : 1;
                    setGuitarRenderProgress((index + trackFraction) / total);
                });
                let plan: { kind: "preset"; preset: SoundPreset; ampNode?: AudioNode } | { kind: "direct" } =
                    { kind: "direct" };
                if (config?.kind === "preset" && config.presetId) {
                    const preset = resolvePresetById(config.presetId);
                    if (preset) {
                        let ampNode: AudioNode | undefined;
                        let effective = preset;
                        if (preset.kind === "nam") {
                            if (allowedNamAmps.has(preset.amp)) {
                                const load = await loadNamNode(ctx, preset.amp);
                                if (load.ok) {
                                    ampNode = load.node;
                                } else {
                                    namOverflow = true;
                                }
                            } else {
                                namOverflow = true;
                            }
                        }
                        if (!ampNode && effective.kind === "nam") {
                            // NAM unavailable (pool cap or load failure) — fall
                            // back to the built-in classic chain, never silent.
                            effective = getPresetById("classic-acoustic") ?? effective;
                        }
                        plan = { kind: "preset", preset: effective, ampNode };
                    }
                }
                outputs.push({ trackIndex: index, buffer, plan, muted: false });
            }

            // Assemble the playback graph and restore the view render.
            const graph = assemblePerTrackGraph(ctx, outputs, volume);
            playbackGraphRef.current = graph;
            api.renderScore(score, [trackIndex]);

            disposeTransportOnly();
            multiPlaybackRef.current = new MultiTrackPlayback(ctx, graph.sources, {
                onPosition: (ms) => {
                    setPositionMs(ms);
                    if (apiRef.current) apiRef.current.timePosition = ms;
                },
                onEnded: () => setPlaying(false),
            });
            setDurationMs(multiPlaybackRef.current.durationMs);
            multiPlaybackRef.current.play();
            setPlaying(true);
        } catch {
            // Render failed (bad options, wedged worker, soundfont missing) —
            // surface it instead of silently reverting the toggle.
            disposePlayback();
            setGuitarMode(false);
            setGuitarError(true);
        } finally {
            setGuitarRendering(false);
            setGuitarRenderProgress(null);
        }
    };

    const handleGuitarModeToggle = () => {
        const next = !guitarMode;
        if (next) {
            apiRef.current?.pause(); // keep alphaTab's synth silent under our transport
            if (multiPlaybackRef.current) {
                multiPlaybackRef.current.play();
                setPlaying(true);
            } else {
                void startGuitarRender();
            }
        } else {
            multiPlaybackRef.current?.pause();
            setPlaying(false);
            // back to the soundfont transport: restore the single-track view
            if (apiRef.current && scoreRef.current) {
                apiRef.current.renderScore(scoreRef.current, [trackIndex]);
            }
        }
        setGuitarMode(next);
    };

    const handlePlayToggle = () => {
        const api = apiRef.current;
        if (!api) return;
        if (guitarMode) {
            const playback = multiPlaybackRef.current;
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
            multiPlaybackRef.current?.stop();
            setPlaying(false);
            setPositionMs(0);
            if (apiRef.current) apiRef.current.timePosition = 0;
            return;
        }
        apiRef.current?.stop();
        setPlaying(false);
        setPositionMs(0);
        setCurrentBar(null);
    };

    const customPresetOptions = useSoundStore((state) => state.customPresets);

    /** Updates one track's voice config, persists it and drops the stale mix. */
    const updateTrackConfig = (index: number, next: ValidTrackConfig) => {
        const others = trackConfigs.filter((entry) => entry.trackIndex !== index);
        const updated = [...others, next].sort((a, b) => a.trackIndex - b.trackIndex);
        setTrackConfigsState(updated);
        if (id) {
            void setTrackConfigs(id, updated);
        }
        if (guitarMode) {
            // The rendered mix reflects the old assignment — drop it; the next
            // play press re-renders per the new assignment.
            disposeTransportOnly();
            setPlaying(false);
        }
    };

    const handleTrackVoiceChange = (
        index: number,
        voice: { kind: "direct" } | { kind: "preset"; presetId: string },
    ) => {
        const previous = trackConfigs.find((entry) => entry.trackIndex === index);
        updateTrackConfig(index, {
            trackIndex: index,
            kind: voice.kind,
            presetId: voice.kind === "preset" ? voice.presetId : undefined,
            muted: previous?.muted ?? false,
        });
    };

    const handleTrackMuteChange = (index: number, muted: boolean) => {
        const previous = trackConfigs.find((entry) => entry.trackIndex === index);
        updateTrackConfig(index, {
            trackIndex: index,
            kind: previous?.kind ?? "direct",
            presetId: previous?.presetId,
            muted,
        });
    };

    const handleSpeedChange = (next: number) => {
        setSpeed(next);
        if (apiRef.current) apiRef.current.playbackSpeed = next;
    };

    const handleVolumeChange = (next: number) => {
        setVolume(next);
        if (guitarMode) {
            // Guitar mode plays through per-track chains into our own master
            // gain — mirror the app-wide audio setting there.
            const settings = useSettingsStore.getState();
            settings.updateFullSettings({ audio: { ...settings.full.audio, volume: next } });
            if (playbackGraphRef.current) {
                playbackGraphRef.current.master.gain.value = masterGainValue(next);
            }
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
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
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
                        {guitarError && (
                            <p className="text-xs text-destructive" role="alert">
                                {t("scores.playback.guitarError")}
                            </p>
                        )}
                    </div>
                    {guitarMode && (
                        <div className="space-y-2 rounded-lg border border-border/50 p-3">
                            <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
                                {t("scores.tracks.title")}
                            </p>
                            {namPoolWarning && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    {t("scores.tracks.namLimit")}
                                </p>
                            )}
                            {scoreRef.current?.tracks.map((track, index) => {
                                const config = trackConfigs.find(
                                    (entry) => entry.trackIndex === index,
                                );
                                const muted = config?.muted === true;
                                const isDrums = track.isPercussion;
                                return (
                                    <div
                                        key={`${index}-${track.name}`}
                                        className="flex flex-wrap items-center justify-between gap-2"
                                    >
                                        <div className="flex min-w-40 flex-col">
                                            <span className="truncate text-sm font-medium">
                                                {track.name.length > 0
                                                    ? track.name
                                                    : `Track ${index + 1}`}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {isDrums
                                                    ? t("scores.tracks.drums")
                                                    : null}
                                            </span>
                                        </div>
                                        {isDrums ? (
                                            <span className="text-xs text-muted-foreground">
                                                {t("scores.tracks.directOption")}
                                            </span>
                                        ) : (
                                            <Select
                                                aria-label={t("scores.tracks.presetLabel")}
                                                className="h-8 w-auto"
                                                value={config?.kind === "preset" ? config.presetId : "direct"}
                                                onChange={(event) =>
                                                    handleTrackVoiceChange(
                                                        index,
                                                        event.target.value === "direct"
                                                            ? { kind: "direct" }
                                                            : { kind: "preset", presetId: event.target.value },
                                                    )
                                                }
                                            >
                                                <option value="direct">
                                                    {t("scores.tracks.directOption")}
                                                </option>
                                                {getBuiltinPresets().map((preset) => (
                                                    <option key={preset.id} value={preset.id}>
                                                        {t(preset.nameKey)}
                                                    </option>
                                                ))}
                                                {customPresetOptions.map((preset) => (
                                                    <option key={preset.id} value={preset.id}>
                                                        {t(preset.nameKey)}
                                                    </option>
                                                ))}
                                            </Select>
                                        )}
                                        <Switch
                                            checked={!muted}
                                            aria-label={t("scores.tracks.muteAria", {
                                                name: track.name || `Track ${index + 1}`,
                                            })}
                                            onCheckedChange={(checked) =>
                                                handleTrackMuteChange(index, !checked)
                                            }
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
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

            {status === "ready" && (
                <ChordPrompter timeline={chordTimeline} currentBar={currentBar} />
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

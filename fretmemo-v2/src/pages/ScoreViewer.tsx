import { useEffect, useRef, useState } from "react";
import {
    Navigate,
    useLocation,
    useNavigate,
    useSearchParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, FileWarning, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PlaybackControls } from "@/components/score/PlaybackControls";
import { cn } from "@/lib/utils";
import { trackFeatureOpened } from "@/lib/analytics";
import { formatScoreMetaLine } from "@/lib/scoreDisplay";
import { getScoreBytes, listScoreMeta, updateScoreBytes } from "@/lib/scoreStore";
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
import { TabEditorPanel } from "@/components/score/TabEditorPanel";
import {
    addNoteToString,
    beatSummary,
    clearBeat,
    removeNoteFromString,
    setBeatDuration,
    setNoteFret,
} from "@/lib/tabEditor";
import { restoreScoreSnapshot, snapshotScoreAsync } from "@/lib/tabEditorUndo";
import { audioBufferToWavBlob } from "@/lib/audioExport";
import { barRangeTicks, barRangeToMsWindow, msToTicks } from "@/lib/barLoop";
import { sha256Hex, type SongProgress } from "@/lib/songProgress";
import {
    getSongProgress,
    setSongProgress,
    copySongProgress,
} from "@/lib/scoreStore";
import {
    appendEmptyBar,
    duplicateBarAt,
    removeBarAt,
    setScoreTempo,
    setTimeSignatureAt,
} from "@/lib/tabEditorBars";
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
import type { AlphaTabApi, Settings, model } from "@coderline/alphatab";

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
    const settingsRef = useRef<Settings | null>(null);
    /** Creates real alphaTab model.Note instances (captured after dynamic import). */
    const noteFactoryRef = useRef<(() => model.Note) | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editorDirty, setEditorDirty] = useState(false);
    const [editorSaving, setEditorSaving] = useState(false);
    const [editorSaveError, setEditorSaveError] = useState(false);
    const [beatVersion, setBeatVersion] = useState(0);
    const editBeatRef = useRef<model.Beat | null>(null);
    const editBeatLocationRef = useRef<{ barIndex: number; voiceIndex: number; beatIndex: number } | null>(null);
    const editorStringCount = useSettingsStore((state) => state.quick.tuning.length);
    const undoStackRef = useRef<string[]>([]);
    const redoStackRef = useRef<string[]>([]);
    const editModeRef = useRef(false);
    const [trackConfigs, setTrackConfigsState] = useState<ValidTrackConfig[]>([]);
    const [namPoolWarning, setNamPoolWarning] = useState(false);
    const [guitarMode, setGuitarMode] = useState(false);
    const [guitarRendering, setGuitarRendering] = useState(false);
    const [exportingAudio, setExportingAudio] = useState(false);
    const [exportAudioError, setExportAudioError] = useState(false);
    // R-04 loop: repeat a bar-range fragment (soundfont via alphaTab's
    // native playbackRange, guitar mode via the MultiTrackPlayback window).
    const [loopEnabled, setLoopEnabled] = useState(false);
    const [loopStartBar, setLoopStartBar] = useState(0);
    const [loopEndBar, setLoopEndBar] = useState(3);
    const loopEnabledRef = useRef(false);
    const loopStartBarRef = useRef(0);
    const loopEndBarRef = useRef(3);
    // R-08: practice progress keyed by the score-bytes hash — restores the
    // loop, practice tempo and (as an explicit chip) the last position.
    const scoreHashRef = useRef<string | null>(null);
    const positionMsRef = useRef(0);
    const [resumeAtMs, setResumeAtMs] = useState<number | null>(null);
    // The load-effect closure captures the pre-restore speed — the restored
    // practice tempo must reach api.playbackSpeed through a ref.
    const restoredSpeedRef = useRef<number | null>(null);
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
        setGuitarError(false);
        // Reset editor state — snapshots belong to the previous score.
        editModeRef.current = false;
        setEditMode(false);
        editBeatRef.current = null;
        editBeatLocationRef.current = null;
        undoStackRef.current = [];
        redoStackRef.current = [];
        setEditorDirty(false);
        setEditorSaveError(false);
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

                // R-08: progress travels with the file CONTENT — hash the
                // bytes and restore this song's practice state if it exists.
                const contentHash = await sha256Hex(new Uint8Array(bytes));
                if (cancelled) return;
                scoreHashRef.current = contentHash;
                const progress = (await getSongProgress(contentHash)) as SongProgress | null;
                if (!cancelled && progress) {
                    if (typeof progress.speed === "number" && progress.speed >= 0.5 && progress.speed <= 1.5) {
                        restoredSpeedRef.current = progress.speed;
                        setSpeed(progress.speed);
                    }
                    if (typeof progress.loopEnabled === "boolean") {
                        loopEnabledRef.current = progress.loopEnabled;
                        setLoopEnabled(progress.loopEnabled);
                    }
                    if (Number.isInteger(progress.loopStartBar)) {
                        loopStartBarRef.current = progress.loopStartBar!;
                        setLoopStartBar(progress.loopStartBar!);
                    }
                    if (Number.isInteger(progress.loopEndBar)) {
                        loopEndBarRef.current = progress.loopEndBar!;
                        setLoopEndBar(progress.loopEndBar!);
                    }
                    if (typeof progress.lastPositionMs === "number" && progress.lastPositionMs > 3000) {
                        setResumeAtMs(progress.lastPositionMs);
                    }
                }

                const [alphatab, metas] = await Promise.all([
                    import("@coderline/alphatab"),
                    listScoreMeta(),
                ]);
                if (cancelled || !containerRef.current) return;
                // Editor note factory — the model requires real class
                // instances (score.finish calls note.chain(); see
                // addNoteToString in lib/tabEditor.ts).
                noteFactoryRef.current = () => new alphatab.model.Note();

                const score = alphatab.importer.ScoreLoader.loadScoreFromBytes(
                    new Uint8Array(bytes),
                );
                const settings = new alphatab.Settings();
                if (!cancelled) settingsRef.current = settings;
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
                    if (!cancelled) {
                        setPlayerReady(true);
                        // Re-apply a persisted loop window on the fresh player.
                        applySoundfontLoop();
                    }
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
                    positionMsRef.current = args.currentTime;
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
                    if (!cancelled) {
                        setCurrentBar(beat.voice.bar.index);
                        if (editModeRef.current) {
                            editBeatRef.current = beat;
                            editBeatLocationRef.current = {
                                barIndex: beat.voice.bar.index,
                                voiceIndex: beat.voice.index,
                                beatIndex: beat.index,
                            };
                            setBeatVersion((v) => v + 1);
                        }
                    }
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
                api.playbackSpeed = restoredSpeedRef.current ?? speed;
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
                    positionMsRef.current = ms;
                    setPositionMs(ms);
                    if (apiRef.current) apiRef.current.timePosition = ms;
                },
                onEnded: () => setPlaying(false),
            });
            setDurationMs(multiPlaybackRef.current.durationMs);
            applyGuitarLoop();
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
                flushSongProgress();
            } else {
                playback.play();
                setPlaying(true);
            }
            return;
        }
        if (api.playerState === playerStateRef.current) {
            api.pause();
            flushSongProgress();
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
        flushSongProgress(next);
    };

    // ─── Tab editor (R-07) ───────────────────────────────────────────────

    const editorBusyRef = useRef(false);

    /** Re-resolves the editable beat by position after a score replacement. */
    const reresolveEditBeat = (restored: model.Score) => {
        const loc = editBeatLocationRef.current;
        if (!loc) {
            editBeatRef.current = null;
            return;
        }
        const staff = restored.tracks[0]?.staves[0];
        const voice = staff?.bars[loc.barIndex]?.voices[loc.voiceIndex];
        editBeatRef.current = voice?.beats[loc.beatIndex] ?? null;
    };

    /** Applies an edit: snapshot for undo, mutate, finish, re-render, refresh MIDI. */
    const applyEdit = (mutate: (beat: model.Beat) => void) => {
        const api = apiRef.current;
        const score = scoreRef.current;
        const settings = settingsRef.current;
        const beat = editBeatRef.current;
        if (!api || !score || !settings || !beat || editorBusyRef.current) return;
        editorBusyRef.current = true;
        void snapshotScoreAsync(score)
            .then((snapshot) => {
                undoStackRef.current = [...undoStackRef.current.slice(-49), snapshot];
                redoStackRef.current = [];
                setEditorDirty(true);
                mutate(beat);
                score.finish(settings);
                api.renderScore(score, [trackIndex]);
                api.loadMidiForScore();
                setBeatVersion((v) => v + 1);
            })
            .catch((error) => console.error("Tab edit failed:", error))
            .finally(() => {
                editorBusyRef.current = false;
            });
    };

    const handleEditFretChange = (stringIndex: number, fret: number | null) => {
        const beat = editBeatRef.current;
        if (!beat) return;
        applyEdit(() => {
            if (fret === null) {
                removeNoteFromString(beat, stringIndex + 1);
            } else {
                const existing = beat.getNoteOnString(stringIndex + 1);
                if (existing) {
                    setNoteFret(beat, stringIndex + 1, fret);
                } else {
                    addNoteToString(beat, stringIndex + 1, fret, () => {
                        const factory = noteFactoryRef.current;
                        if (!factory) throw new Error("alphaTab not loaded");
                        return factory();
                    });
                }
            }
        });
    };

    const handleEditDurationChange = (duration: number) => {
        const beat = editBeatRef.current;
        if (!beat) return;
        applyEdit(() => setBeatDuration(beat, duration, beat.dots));
    };

    const handleEditRest = () => {
        const beat = editBeatRef.current;
        if (!beat) return;
        applyEdit(() => clearBeat(beat));
    };

    /** Score-level edit (bar ops, tempo): snapshot → mutate → finish → refresh. */
    const applyScoreEdit = (
        mutate: (score: model.Score) => number | void | Promise<number | void>,
        nextBarIndex?: (
            result: number | undefined,
            currentBarIndex: number,
            barCount: number,
        ) => number,
    ) => {
        const api = apiRef.current;
        const score = scoreRef.current;
        const settings = settingsRef.current;
        if (!api || !score || !settings || editorBusyRef.current) return;
        editorBusyRef.current = true;
        void snapshotScoreAsync(score)
            .then(async (snapshot) => {
                undoStackRef.current = [...undoStackRef.current.slice(-49), snapshot];
                redoStackRef.current = [];
                setEditorDirty(true);
                const result = (await mutate(score)) as number | undefined;
                score.finish(settings);
                api.renderScore(score, [trackIndex]);
                api.loadMidiForScore();
                const barIndex = editBeatLocationRef.current?.barIndex;
                if (barIndex !== undefined) {
                    const next = nextBarIndex
                        ? nextBarIndex(result, barIndex, score.masterBars.length)
                        : barIndex;
                    editBeatLocationRef.current = {
                        ...editBeatLocationRef.current!,
                        barIndex: Math.max(0, Math.min(next, score.masterBars.length - 1)),
                    };
                }
                reresolveEditBeat(score);
                setBeatVersion((v) => v + 1);
            })
            .catch((error) => console.error("Tab bar edit failed:", error))
            .finally(() => {
                editorBusyRef.current = false;
            });
    };

    const handleAppendBar = () => {
        const score = scoreRef.current;
        if (!score) return;
        applyScoreEdit(
            (target) => appendEmptyBar(target),
            (result, _current, barCount) => (typeof result === "number" ? result : barCount - 1),
        );
    };

    const handleDuplicateBar = () => {
        const score = scoreRef.current;
        const barIndex = editBeatLocationRef.current?.barIndex;
        if (!score || barIndex === undefined) return;
        applyScoreEdit(
            (target) => duplicateBarAt(target, barIndex),
            (result, current) => (typeof result === "number" ? result : current + 1),
        );
    };

    const handleRemoveBar = () => {
        const score = scoreRef.current;
        const barIndex = editBeatLocationRef.current?.barIndex;
        if (!score || barIndex === undefined) return;
        applyScoreEdit(
            (target) => {
                removeBarAt(target, barIndex);
            },
            (_result, currentBarIndex) => currentBarIndex,
        );
    };

    const handleTempoChange = (bpm: number) => {
        const score = scoreRef.current;
        if (!score) return;
        applyScoreEdit((target) => {
            setScoreTempo(target, bpm);
        });
    };

    const handleTimeSignatureChange = (numerator: number, denominator: number) => {
        const score = scoreRef.current;
        const barIndex = editBeatLocationRef.current?.barIndex;
        if (!score || barIndex === undefined) return;
        applyScoreEdit((target) => {
            setTimeSignatureAt(target, barIndex, numerator, denominator);
        });
    };

    /** Downloads the CURRENT editor state (unsaved changes included) as .gp. */
    const handleEditorDownload = async () => {
        const score = scoreRef.current;
        if (!score) return;
        try {
            const alphatab = await import("@coderline/alphatab");
            const bytes = new alphatab.exporter.Gp7Exporter().export(score);
            // The exporter allocates an exact-size buffer (same assumption as
            // the save path) — the cast satisfies TS 5.9 ArrayBuffer generics.
            const blob = new Blob([bytes.buffer as ArrayBuffer], {
                type: "application/octet-stream",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${meta?.title || "score"}.gp`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch {
            setEditorSaveError(true);
        }
    };

    /** Renders the FULL song mix and downloads it as a 16-bit PCM WAV. */
    const handleExportAudio = async () => {
        const api = apiRef.current;
        const score = scoreRef.current;
        if (!api || !score || exportingAudio || guitarMode || guitarRendering) return;
        setExportAudioError(false);
        setExportingAudio(true);
        try {
            api.pause();
            setPlaying(false);
            const ctx = getSongEngineContext();
            // Full mix: every track, drums included — the arrangement the
            // soundfont player plays by default. No chains involved, so the
            // guitar-mode NAM pool rules do not apply here.
            api.renderScore(score, score.tracks.map((_, index) => index));
            const buffer = await renderSongToBuffer(ctx, api);
            // Restore the single-track view render.
            api.renderScore(score, [trackIndex]);
            const blob = audioBufferToWavBlob(buffer);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${meta?.title || "song"}.wav`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch {
            setExportAudioError(true);
        } finally {
            setExportingAudio(false);
        }
    };

    /** Soundfont transport loop: alphaTab's native range + loop flag. */
    const applySoundfontLoop = () => {
        const api = apiRef.current;
        const score = scoreRef.current;
        if (!api || !score || guitarMode) return;
        if (!loopEnabledRef.current) {
            api.playbackRange = null;
            api.isLooping = false;
            return;
        }
        api.isLooping = true;
        api.playbackRange = barRangeTicks(score, loopStartBarRef.current, loopEndBarRef.current);
    };

    /** Guitar transport loop: the MultiTrackPlayback ms window. */
    const applyGuitarLoop = () => {
        const playback = multiPlaybackRef.current;
        const score = scoreRef.current;
        if (!playback || !score) return;
        playback.setLoop(
            loopEnabledRef.current
                ? barRangeToMsWindow(score, loopStartBarRef.current, loopEndBarRef.current)
                : null,
        );
    };

    const handleLoopToggle = (next: boolean) => {
        loopEnabledRef.current = next;
        setLoopEnabled(next);
        if (next && loopEndBarRef.current < loopStartBarRef.current) {
            // First enable: default a 4-bar window (or up to the last bar).
            const last = Math.max(0, (scoreRef.current?.masterBars.length ?? 1) - 1);
            const end = Math.min(loopStartBarRef.current + 3, last);
            loopEndBarRef.current = end;
            setLoopEndBar(end);
        }
        applySoundfontLoop();
        applyGuitarLoop();
        flushSongProgress();
    };

    const handleLoopRangeChange = (which: "start" | "end", barIndex: number) => {
        const barCount = scoreRef.current?.masterBars.length ?? 0;
        const clamped = Math.max(0, Math.min(barIndex, barCount - 1));
        let start = loopStartBarRef.current;
        let end = loopEndBarRef.current;
        if (which === "start") {
            start = clamped;
            if (end < start) end = start;
        } else {
            end = Math.max(clamped, start);
        }
        loopStartBarRef.current = start;
        loopEndBarRef.current = end;
        setLoopStartBar(start);
        setLoopEndBar(end);
        applySoundfontLoop();
        applyGuitarLoop();
        flushSongProgress();
    };

    /** Persists the practice state under the score-content hash (R-08). */
    const flushSongProgress = (speedOverride?: number) => {
        const hash = scoreHashRef.current;
        if (!hash) return;
        void setSongProgress({
            hash,
            lastPositionMs: Math.round(positionMsRef.current),
            speed: speedOverride ?? speed,
            loopEnabled: loopEnabledRef.current,
            loopStartBar: loopStartBarRef.current,
            loopEndBar: loopEndBarRef.current,
            updatedAt: Date.now(),
        });
    };

    // Flush on leaving the page — the position lives in a ref, so the
    // closure stays valid without re-subscribing.
    useEffect(() => {
        const onPageHide = () => flushSongProgress();
        window.addEventListener("pagehide", onPageHide);
        return () => window.removeEventListener("pagehide", onPageHide);
    }, []);

    /** Resume chip: seeks both transports to the saved position. */
    const handleResumeClick = () => {
        const target = resumeAtMs;
        if (target == null) return;
        setResumeAtMs(null);
        const api = apiRef.current;
        const score = scoreRef.current;
        if (multiPlaybackRef.current) {
            multiPlaybackRef.current.seek(target);
        } else if (api && score) {
            api.tickPosition = msToTicks(score, target);
            positionMsRef.current = target;
            setPositionMs(target);
        }
        flushSongProgress();
    };

    const restoreEditorScore = async (snapshot: string) => {
        const api = apiRef.current;
        const settings = settingsRef.current;
        if (!api || !settings) return null;
        const restored = (await restoreScoreSnapshot(snapshot)) as model.Score;
        scoreRef.current = restored;
        restored.finish(settings);
        api.renderScore(restored, [trackIndex]);
        api.loadMidiForScore();
        // Re-resolve the editable beat by position in the restored model.
        reresolveEditBeat(restored);
        setEditorDirty(true);
        setBeatVersion((v) => v + 1);
        return restored;
    };

    const handleEditorUndo = async () => {
        const api = apiRef.current;
        const score = scoreRef.current;
        const stack = undoStackRef.current;
        const snapshot = stack[stack.length - 1];
        if (!api || !score || !snapshot || editorBusyRef.current) return;
        editorBusyRef.current = true;
        try {
            undoStackRef.current = stack.slice(0, -1);
            redoStackRef.current = [...redoStackRef.current, await snapshotScoreAsync(score)];
            await restoreEditorScore(snapshot);
        } catch (error) {
            console.error("Editor undo failed:", error);
        } finally {
            editorBusyRef.current = false;
        }
    };

    const handleEditorRedo = async () => {
        const api = apiRef.current;
        const score = scoreRef.current;
        const stack = redoStackRef.current;
        const snapshot = stack[stack.length - 1];
        if (!api || !score || !snapshot || editorBusyRef.current) return;
        editorBusyRef.current = true;
        try {
            redoStackRef.current = stack.slice(0, -1);
            undoStackRef.current = [...undoStackRef.current, await snapshotScoreAsync(score)];
            await restoreEditorScore(snapshot);
        } catch (error) {
            console.error("Editor redo failed:", error);
        } finally {
            editorBusyRef.current = false;
        }
    };

    const handleEditorSave = async () => {
        const score = scoreRef.current;
        if (!score || !id || editorSaving) return;
        setEditorSaving(true);
        setEditorSaveError(false);
        try {
            const alphatab = await import("@coderline/alphatab");
            const bytes = new alphatab.exporter.Gp7Exporter().export(score);
            await updateScoreBytes(id, bytes.buffer as ArrayBuffer);
            // The bytes changed — the content hash moves and the practice
            // progress must follow the song, not the old snapshot.
            try {
                const newHash = await sha256Hex(new Uint8Array(bytes));
                if (scoreHashRef.current) {
                    await copySongProgress(scoreHashRef.current, newHash);
                }
                scoreHashRef.current = newHash;
            } catch {
                // Hashing is best-effort; the save itself already succeeded.
            }
            setEditorDirty(false);
            // The guitar-mode mix reflects the pre-edit score — drop it.
            disposePlayback();
            setGuitarMode(false);
        } catch {
            setEditorSaveError(true);
        } finally {
            setEditorSaving(false);
        }
    };

    const handleEditModeToggle = () => {
        const next = !editMode;
        editModeRef.current = next;
        setEditMode(next);
        if (next) {
            apiRef.current?.pause();
            setPlaying(false);
            // Default the editable beat to the first beat of the rendered
            // track until the cursor moves during playback.
            if (!editBeatRef.current) {
                const firstBeat =
                    apiRef.current?.tracks[trackIndex]?.staves[0]?.bars[0]?.voices[0]?.beats[0];
                if (firstBeat) {
                    editBeatRef.current = firstBeat;
                    editBeatLocationRef.current = { barIndex: 0, voiceIndex: 0, beatIndex: 0 };
                    setBeatVersion((v) => v + 1);
                }
            }
            trackFeatureOpened("score_editor", id, null);
        }
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

    // Loop range options (1-based bar numbers for the user, 0-based values).
    const barCount = scoreRef.current?.masterBars.length ?? 0;
    const barOptions = Array.from({ length: barCount }, (_, index) => (
        <option key={index} value={index}>
            {index + 1}
        </option>
    ));

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
                    <div className="flex flex-wrap items-center gap-2">
                        {resumeAtMs !== null && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleResumeClick}
                            >
                                {t("scores.playback.resumeFrom", {
                                    time: `${Math.floor(resumeAtMs / 60000)}:${String(
                                        Math.floor(resumeAtMs / 1000) % 60,
                                    ).padStart(2, "0")}`,
                                })}
                            </Button>
                        )}
                        <Switch
                            id="loop-toggle"
                            checked={loopEnabled}
                            onCheckedChange={handleLoopToggle}
                            disabled={guitarRendering || exportingAudio}
                        />
                        <Label
                            htmlFor="loop-toggle"
                            className="cursor-pointer text-xs text-muted-foreground"
                        >
                            {t("scores.playback.loop")}
                        </Label>
                        {loopEnabled && (
                            <>
                                <Label className="ml-2 text-xs text-muted-foreground">
                                    {t("scores.playback.loopFrom")}
                                </Label>
                                <Select
                                    aria-label={t("scores.playback.loopFrom")}
                                    className="h-8 w-auto"
                                    value={loopStartBar}
                                    onChange={(event) =>
                                        handleLoopRangeChange("start", Number(event.target.value))
                                    }
                                >
                                    {barOptions}
                                </Select>
                                <Label className="text-xs text-muted-foreground">
                                    {t("scores.playback.loopTo")}
                                </Label>
                                <Select
                                    aria-label={t("scores.playback.loopTo")}
                                    className="h-8 w-auto"
                                    value={loopEndBar}
                                    onChange={(event) =>
                                        handleLoopRangeChange("end", Number(event.target.value))
                                    }
                                >
                                    {barOptions}
                                </Select>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleExportAudio()}
                            disabled={exportingAudio || guitarMode || guitarRendering}
                        >
                            {exportingAudio ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            {exportingAudio
                                ? t("scores.playback.exporting")
                                : t("scores.playback.exportAudio")}
                        </Button>
                        {exportAudioError && (
                            <p className="text-xs text-destructive" role="alert">
                                {t("scores.playback.exportAudioError")}
                            </p>
                        )}
                    </div>
                </>
            )}

            {status === "ready" && (
                <>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                            <Switch
                                id="edit-mode"
                                checked={editMode}
                                onCheckedChange={handleEditModeToggle}
                                disabled={guitarMode || guitarRendering}
                            />
                            <Label
                                htmlFor="edit-mode"
                                className="cursor-pointer text-xs text-muted-foreground"
                            >
                                {t("scores.editor.editMode")}
                            </Label>
                        </div>
                    </div>
                    {editMode && editorSaveError && (
                        <p className="text-xs text-destructive" role="alert">
                            {t("scores.editor.saveError")}
                        </p>
                    )}
                    {editMode && (
                        <TabEditorPanel
                            beatVersion={beatVersion}
                            summary={
                                editBeatRef.current
                                    ? beatSummary(editBeatRef.current, editorStringCount)
                                    : null
                            }
                            stringCount={editorStringCount}
                            duration={editBeatRef.current?.duration ?? 4}
                            barCount={scoreRef.current?.masterBars.length ?? 0}
                            barIndex={editBeatLocationRef.current?.barIndex ?? null}
                            tempo={scoreRef.current ? scoreRef.current.tempo : null}
                            timeSignature={(() => {
                                const score = scoreRef.current;
                                const barIndex = editBeatLocationRef.current?.barIndex;
                                if (!score || barIndex === undefined) return null;
                                const masterBar = score.masterBars[barIndex];
                                if (!masterBar) return null;
                                return {
                                    numerator: masterBar.timeSignatureNumerator,
                                    denominator: masterBar.timeSignatureDenominator,
                                };
                            })()}
                            dirty={editorDirty}
                            canUndo={undoStackRef.current.length > 0}
                            canRedo={redoStackRef.current.length > 0}
                            onFretChange={handleEditFretChange}
                            onDurationChange={handleEditDurationChange}
                            onRest={handleEditRest}
                            onAppendBar={handleAppendBar}
                            onDuplicateBar={handleDuplicateBar}
                            onRemoveBar={handleRemoveBar}
                            onTempoChange={handleTempoChange}
                            onTimeSignatureChange={handleTimeSignatureChange}
                            onUndo={() => void handleEditorUndo()}
                            onRedo={() => void handleEditorRedo()}
                            onSave={() => void handleEditorSave()}
                            onDownload={() => void handleEditorDownload()}
                        />
                    )}
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

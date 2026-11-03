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
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { trackFeatureOpened } from "@/lib/analytics";
import { formatScoreMetaLine } from "@/lib/scoreDisplay";
import { getScoreBytes, listScoreMeta } from "@/lib/scoreStore";
import type { ScoreSummary } from "@/types/scores";
// Type-only import: erased at build time, keeps alphaTab out of the entry chunk.
import type { AlphaTabApi, model } from "@coderline/alphatab";

type AlphaTabScore = model.Score;

type ViewerStatus = "loading" | "ready" | "error" | "not-found";

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
        scoreRef.current = null;

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

                const storedMeta = metas.find((item) => item.id === id) ?? null;

                api = new alphatab.AlphaTabApi(containerRef.current, settings);
                apiRef.current = api;
                scoreRef.current = score;

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
        };
    }, [id, entrySource]);

    const handleTrackChange = (index: number) => {
        setTrackIndex(index);
        if (apiRef.current && scoreRef.current) {
            apiRef.current.renderScore(scoreRef.current, [index]);
        }
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

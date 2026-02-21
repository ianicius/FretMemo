import { lazy, Suspense, useEffect } from "react";
import type { LazyExoticComponent, ComponentType } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trackFeatureOpened } from "@/lib/analytics";

const SoundToFretboard = lazy(() => import("@/components/ear-training/SoundToFretboard"));
const IntervalTrainer = lazy(() => import("@/components/ear-training/IntervalTrainer"));
const ChordQualityTrainer = lazy(() => import("@/components/ear-training/ChordQualityTrainer"));
const FunctionalEarTrainer = lazy(() => import("@/components/ear-training/FunctionalEarTrainer"));

type LazyComponent = LazyExoticComponent<ComponentType<unknown>>;

const MODES: Record<string, { component: LazyComponent; titleKey: string }> = {
    "sound-to-fret": { component: SoundToFretboard, titleKey: "ear.page.modes.soundToFretboard" },
    intervals: { component: IntervalTrainer, titleKey: "ear.page.modes.intervalRecognition" },
    "chord-quality": { component: ChordQualityTrainer, titleKey: "ear.page.modes.chordQuality" },
    functional: { component: FunctionalEarTrainer, titleKey: "ear.page.modes.functionalEar" },
};

export default function EarTraining() {
    const { t } = useTranslation();
    const { mode } = useParams<{ mode: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const tool = mode ? MODES[mode] : undefined;
    const routeState = (location.state as { entrySource?: string } | null) ?? null;
    const entrySource = routeState?.entrySource ?? "direct";

    useEffect(() => {
        if (!mode || !tool) return;
        trackFeatureOpened("ear_training", mode, entrySource);
    }, [entrySource, mode, tool]);

    if (!tool) {
        return (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
                <h2 className="type-h1">{t("ear.page.modeNotFoundTitle")}</h2>
                <p className="type-body text-muted-foreground">
                    {t("ear.page.modeNotFoundDesc", { mode })}
                </p>
                <Button variant="outline" onClick={() => navigate("/train")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> {t("ear.page.backToLibrary")}
                </Button>
            </div>
        );
    }

    const ToolComponent = tool.component;

    return (
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate("/train")} className="shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="type-h1">{t(tool.titleKey)}</h1>
            </div>

            <Suspense fallback={<PageSkeleton />}>
                <ToolComponent />
            </Suspense>
        </div>
    );
}

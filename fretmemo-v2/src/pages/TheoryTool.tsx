import { lazy, Suspense, useEffect } from "react";
import type { LazyExoticComponent, ComponentType } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trackFeatureOpened } from "@/lib/analytics";

const ScaleExplorer = lazy(() => import("@/components/theory/ScaleExplorer"));
const CircleOfFifths = lazy(() => import("@/components/theory/CircleOfFifths"));
const CagedVisualizer = lazy(() => import("@/components/theory/CagedVisualizer"));
const TriadVisualizer = lazy(() => import("@/components/theory/TriadVisualizer"));
const ChordLibrary = lazy(() => import("@/components/theory/ChordLibrary"));
const IntervalFretboardTrainer = lazy(() => import("@/components/theory/IntervalFretboardTrainer"));

type LazyComponent = LazyExoticComponent<ComponentType<unknown>>;

const TOOLS: Record<string, { component: LazyComponent; titleKey: string }> = {
    scales: { component: ScaleExplorer, titleKey: "theory.page.tools.scaleExplorer" },
    circle: { component: CircleOfFifths, titleKey: "theory.page.tools.circleOfFifths" },
    caged: { component: CagedVisualizer, titleKey: "theory.page.tools.cagedSystem" },
    triads: { component: TriadVisualizer, titleKey: "theory.page.tools.triads" },
    chords: { component: ChordLibrary, titleKey: "theory.page.tools.chordLibrary" },
    intervals: { component: IntervalFretboardTrainer, titleKey: "theory.page.tools.intervalTrainer" },
};

export default function TheoryTool() {
    const { t } = useTranslation();
    const { toolId } = useParams<{ toolId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const tool = toolId ? TOOLS[toolId] : undefined;
    const routeState = (location.state as { entrySource?: string } | null) ?? null;
    const entrySource = routeState?.entrySource ?? "direct";

    useEffect(() => {
        if (!toolId || !tool) return;
        trackFeatureOpened("theory", toolId, entrySource);
    }, [entrySource, tool, toolId]);

    if (!tool) {
        return (
            <div className="space-y-4 pb-8">
                <h1 className="type-display">{t("theory.page.toolNotFoundTitle")}</h1>
                <p className="text-muted-foreground">{t("theory.page.toolNotFoundDesc")}</p>
                <Button variant="outline" onClick={() => navigate("/train")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> {t("theory.page.backToTrain")}
                </Button>
            </div>
        );
    }

    const ToolComponent = tool.component;

    return (
        <div className="space-y-4 pb-8">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/train", { state: { restoreTrain: true } })}
                    aria-label={t("theory.page.backToTrain")}
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="type-display">{t(tool.titleKey)}</h1>
            </div>
            <Suspense fallback={<PageSkeleton />}>
                <ToolComponent />
            </Suspense>
        </div>
    );
}

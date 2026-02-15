import { lazy, Suspense } from "react";
import type { LazyExoticComponent, ComponentType } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const ScaleExplorer = lazy(() => import("@/components/theory/ScaleExplorer"));
const CircleOfFifths = lazy(() => import("@/components/theory/CircleOfFifths"));
const CagedVisualizer = lazy(() => import("@/components/theory/CagedVisualizer"));
const TriadVisualizer = lazy(() => import("@/components/theory/TriadVisualizer"));
const ChordLibrary = lazy(() => import("@/components/theory/ChordLibrary"));
const IntervalFretboardTrainer = lazy(() => import("@/components/theory/IntervalFretboardTrainer"));

type LazyComponent = LazyExoticComponent<ComponentType<unknown>>;

const TOOLS: Record<string, { component: LazyComponent; title: string }> = {
    scales: { component: ScaleExplorer, title: "Scale Explorer" },
    circle: { component: CircleOfFifths, title: "Circle of Fifths" },
    caged: { component: CagedVisualizer, title: "CAGED System" },
    triads: { component: TriadVisualizer, title: "Triads" },
    chords: { component: ChordLibrary, title: "Chord Library" },
    intervals: { component: IntervalFretboardTrainer, title: "Interval Trainer" },
};

export default function TheoryTool() {
    const { toolId } = useParams<{ toolId: string }>();
    const navigate = useNavigate();
    const tool = toolId ? TOOLS[toolId] : undefined;

    if (!tool) {
        return (
            <div className="space-y-4 pb-8">
                <h1 className="type-display">Theory Tool Not Found</h1>
                <p className="text-muted-foreground">The requested tool does not exist.</p>
                <Button variant="outline" onClick={() => navigate("/train")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Train
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
                    aria-label="Back to Train"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="type-display">{tool.title}</h1>
            </div>
            <Suspense fallback={<PageSkeleton />}>
                <ToolComponent />
            </Suspense>
        </div>
    );
}

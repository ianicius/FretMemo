import { lazy, Suspense } from "react";
import type { LazyExoticComponent, ComponentType } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const SoundToFretboard = lazy(() => import("@/components/ear-training/SoundToFretboard"));
const IntervalTrainer = lazy(() => import("@/components/ear-training/IntervalTrainer"));
const ChordQualityTrainer = lazy(() => import("@/components/ear-training/ChordQualityTrainer"));
const FunctionalEarTrainer = lazy(() => import("@/components/ear-training/FunctionalEarTrainer"));

type LazyComponent = LazyExoticComponent<ComponentType<unknown>>;

const MODES: Record<string, { component: LazyComponent; title: string }> = {
    "sound-to-fret": { component: SoundToFretboard, title: "Sound → Fretboard" },
    intervals: { component: IntervalTrainer, title: "Interval Recognition" },
    "chord-quality": { component: ChordQualityTrainer, title: "Chord Quality" },
    functional: { component: FunctionalEarTrainer, title: "Functional Ear Training" },
};

export default function EarTraining() {
    const { mode } = useParams<{ mode: string }>();
    const navigate = useNavigate();
    const tool = mode ? MODES[mode] : undefined;

    if (!tool) {
        return (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
                <h2 className="type-h1">Mode Not Found</h2>
                <p className="type-body text-muted-foreground">
                    The ear training mode &ldquo;{mode}&rdquo; doesn&apos;t exist.
                </p>
                <Button variant="outline" onClick={() => navigate("/train")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Library
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
                <h1 className="type-h1">{tool.title}</h1>
            </div>

            <Suspense fallback={<PageSkeleton />}>
                <ToolComponent />
            </Suspense>
        </div>
    );
}

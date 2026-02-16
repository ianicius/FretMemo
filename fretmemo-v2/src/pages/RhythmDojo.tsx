import { lazy, Suspense } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock4 } from "lucide-react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TapTheBeatMode = lazy(() => import("@/rhythm/modes/TapTheBeatMode"));
const StrumPatternsMode = lazy(() => import("@/rhythm/modes/StrumPatternsMode"));
const RhythmReadingMode = lazy(() => import("@/rhythm/modes/RhythmReadingMode"));
const GrooveLabMode = lazy(() => import("@/rhythm/modes/GrooveLabMode"));

type LazyModeComponent = LazyExoticComponent<ComponentType<unknown>>;

function ComingSoonMode({ title, description }: { title: string; description: string }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock4 className="h-5 w-5 text-primary" />
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    This mode is queued for the next sprint. Start with Tap the Beat or Strum Patterns now.
                </p>
            </CardContent>
        </Card>
    );
}

const MODES: Record<string, { title: string; component?: LazyModeComponent; description?: string }> = {
    "tap-beat": {
        title: "Tap the Beat",
        component: TapTheBeatMode,
    },
    "strum-patterns": {
        title: "Strum Patterns",
        component: StrumPatternsMode,
    },
    "rhythm-reading": {
        title: "Rhythm Reading",
        component: RhythmReadingMode,
    },
    "groove-lab": {
        title: "Groove Lab",
        component: GrooveLabMode,
    },
};

export default function RhythmDojo() {
    const { mode } = useParams<{ mode: string }>();
    const navigate = useNavigate();
    const currentMode = mode ? MODES[mode] : undefined;

    if (!currentMode) {
        return (
            <div className="space-y-4 pb-8">
                <h1 className="type-display">Rhythm Mode Not Found</h1>
                <p className="text-muted-foreground">The requested rhythm mode does not exist.</p>
                <Button variant="outline" onClick={() => navigate("/train", { state: { restoreTrain: true } })}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Train
                </Button>
            </div>
        );
    }

    const ModeComponent = currentMode.component;

    return (
        <div className="space-y-4 pb-8">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/train", { state: { restoreTrain: true } })}
                    aria-label="Back to Train"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="type-display">{currentMode.title}</h1>
            </div>

            {ModeComponent ? (
                <Suspense fallback={<PageSkeleton />}>
                    <ModeComponent />
                </Suspense>
            ) : (
                <ComingSoonMode
                    title={currentMode.title}
                    description={currentMode.description ?? "This mode is coming soon."}
                />
            )}
        </div>
    );
}

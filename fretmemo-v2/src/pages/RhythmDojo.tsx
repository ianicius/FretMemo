import { lazy, Suspense, useEffect } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock4 } from "lucide-react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { trackFeatureOpened } from "@/lib/analytics";

const TapTheBeatMode = lazy(() => import("@/rhythm/modes/TapTheBeatMode"));
const StrumPatternsMode = lazy(() => import("@/rhythm/modes/StrumPatternsMode"));
const RhythmReadingMode = lazy(() => import("@/rhythm/modes/RhythmReadingMode"));
const GrooveLabMode = lazy(() => import("@/rhythm/modes/GrooveLabMode"));

type LazyModeComponent = LazyExoticComponent<ComponentType<unknown>>;

function ComingSoonMode({ title, description }: { title: string; description: string }) {
    const { t } = useTranslation();

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
                    {t("rhythm.comingSoon.body")}
                </p>
            </CardContent>
        </Card>
    );
}

const MODES: Record<string, { titleKey: string; component?: LazyModeComponent; descriptionKey?: string }> = {
    "tap-beat": {
        titleKey: "rhythm.tapBeat.title",
        component: TapTheBeatMode,
    },
    "strum-patterns": {
        titleKey: "rhythm.strumPatterns.title",
        component: StrumPatternsMode,
    },
    "rhythm-reading": {
        titleKey: "rhythm.rhythmReading.title",
        component: RhythmReadingMode,
    },
    "groove-lab": {
        titleKey: "rhythm.grooveLab.title",
        component: GrooveLabMode,
    },
};

export default function RhythmDojo() {
    const { t } = useTranslation();
    const { mode } = useParams<{ mode: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const currentMode = mode ? MODES[mode] : undefined;
    const routeState = (location.state as { entrySource?: string } | null) ?? null;
    const entrySource = routeState?.entrySource ?? "direct";

    useEffect(() => {
        if (!mode || !currentMode) return;
        trackFeatureOpened("rhythm", mode, entrySource);
    }, [currentMode, entrySource, mode]);

    if (!currentMode) {
        return (
            <div className="space-y-4 pb-8">
                <h1 className="type-display">{t("rhythm.notFound.title")}</h1>
                <p className="text-muted-foreground">{t("rhythm.notFound.description")}</p>
                <Button variant="outline" onClick={() => navigate("/train", { state: { restoreTrain: true } })}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t("rhythm.notFound.backToTrain")}
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
                    aria-label={t("rhythm.notFound.backToTrain")}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="type-display">{t(currentMode.titleKey)}</h1>
            </div>

            {ModeComponent ? (
                <Suspense fallback={<PageSkeleton />}>
                    <ModeComponent />
                </Suspense>
            ) : (
                <ComingSoonMode
                    title={t(currentMode.titleKey)}
                    description={t(currentMode.descriptionKey ?? "rhythm.comingSoon.description")}
                />
            )}
        </div>
    );
}

/**
 * "Learn" section: one card per learning track from the registry
 * (src/data/improv/tracks.ts) — what the track gets you, how long it takes,
 * where the learner stands and one button to the next step.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { countCompletedModules, nextImprovExercise } from "@/data/improv/curriculum";
import { TRACKS } from "@/data/improv/tracks";
import { useImprovStore } from "@/stores/useImprovStore";

export default function Learn() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const moduleState = useImprovStore((state) => state.moduleState);

    return (
        <div className="space-y-5 pb-8">
            <div>
                <h1 className="type-display">{t("learn.title")}</h1>
                <p className="mt-1 text-muted-foreground">{t("learn.description")}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {TRACKS.map((track) => {
                    const total = track.modules.length;
                    const done = countCompletedModules(moduleState, track.modules);
                    const next = nextImprovExercise(moduleState, track.modules);
                    const started = track.modules.some((module) =>
                        Object.values(moduleState[module.id]?.exerciseRuns ?? {}).some((runs) => runs > 0));
                    return (
                        <Card key={track.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle>{t(`improv.tracks.${track.id}.title`)}</CardTitle>
                                <CardDescription className="text-sm">{t(`improv.tracks.${track.id}.promise`)}</CardDescription>
                            </CardHeader>
                            <CardContent className="mt-auto space-y-3">
                                <p className="text-xs text-muted-foreground">{t(`improv.tracks.${track.id}.duration`)}</p>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-medium">{t("learn.progress", { done, total })}</span>
                                        <span className="text-muted-foreground">{Math.round((done / total) * 100)}%</span>
                                    </div>
                                    <Progress value={(done / total) * 100} aria-label={t("learn.progress", { done, total })} />
                                </div>
                                {next ? (
                                    <p className="truncate text-sm">
                                        {t("learn.next", { order: next.module.order, module: t(`improv.modules.${next.module.id}.name`) })}
                                    </p>
                                ) : (
                                    <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-300">
                                        <CheckCircle2 className="h-4 w-4" />
                                        {t("learn.done")}
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {next && (
                                        <Button className="flex-1 justify-between" onClick={() => navigate(`/improv/${next.module.id}`)}>
                                            {t(started ? "learn.continue" : "learn.start")}
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button variant="outline" className={next ? undefined : "flex-1"} onClick={() => navigate(track.path)}>
                                        {t("learn.map")}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

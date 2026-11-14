/**
 * Improv Training page (run improv-training-2026-11-13).
 *
 * Two views on one page component:
 * - `/improv` (no route param): the roadmap — all 22 curriculum modules in
 *   the canonical order from the source video, with locked/available/passed
 *   status, overall progress and an unlock-all switch;
 * - `/improv/:moduleId`: module detail — theory card + all curriculum
 *   exercises rendered by their engines (fretboard quiz, choice quiz,
 *   diagram drill, backing loop).
 */

import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { TheoryCard } from "@/components/improv/TheoryCard";
import { FretboardQuiz } from "@/components/improv/FretboardQuiz";
import { ChoiceQuiz } from "@/components/improv/ChoiceQuiz";
import { DiagramDrill } from "@/components/improv/DiagramDrill";
import { BackingLoopExercise } from "@/components/improv/BackingLoopExercise";
import { CURRICULUM, countCompletedModules, getImprovModule, isModuleUnlocked, isModuleComplete } from "@/data/improv/curriculum";
import { useImprovStore } from "@/stores/useImprovStore";
import { cn } from "@/lib/utils";
import { trackFeatureOpened } from "@/lib/analytics";

export default function ImprovTraining() {
    const { moduleId } = useParams<{ moduleId: string }>();

    if (!moduleId) {
        return <RoadmapView />;
    }
    return <ModuleView moduleId={moduleId} />;
}

function RoadmapView() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const moduleState = useImprovStore((state) => state.moduleState);
    const unlockAll = useImprovStore((state) => state.unlockAll);
    const setUnlockAll = useImprovStore((state) => state.setUnlockAll);

    const completed = countCompletedModules(moduleState);
    const total = CURRICULUM.length;

    return (
        <div className="space-y-5 pb-8">
            <div>
                <h1 className="type-display">{t("improv.title")}</h1>
                <p className="mt-1 text-muted-foreground">{t("improv.description")}</p>
            </div>

            <Card>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                            {t("improv.roadmap.progress", { done: completed, total })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {t("improv.roadmap.percent", { percent: Math.round((completed / total) * 100) })}
                        </span>
                    </div>
                    <Progress value={(completed / total) * 100} />
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <Label className="text-xs font-medium">{t("improv.roadmap.unlockAll")}</Label>
                            <p className="text-xs text-muted-foreground">{t("improv.roadmap.unlockAllHint")}</p>
                        </div>
                        <Switch checked={unlockAll} onCheckedChange={setUnlockAll} aria-label={t("improv.roadmap.unlockAll")} />
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-2">
                {CURRICULUM.map((module) => {
                    const unlocked = isModuleUnlocked(module.id, moduleState, unlockAll);
                    const isComplete = isModuleComplete(module, moduleState[module.id]);
                    return (
                        <button
                            key={module.id}
                            type="button"
                            disabled={!unlocked}
                            onClick={() => navigate(`/improv/${module.id}`)}
                            className={cn(
                                "flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition",
                                unlocked && "hover:bg-accent/50",
                                !unlocked && "opacity-60",
                                isComplete && "border-emerald-500/40",
                            )}
                            aria-label={t("improv.roadmap.openModuleAria", { order: module.order, name: t(`improv.modules.${module.id}.name`) })}
                        >
                            <span
                                className={cn(
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                                    isComplete
                                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                                        : unlocked
                                            ? "border-primary/40 bg-primary/10 text-primary"
                                            : "border-border bg-muted text-muted-foreground",
                                )}
                            >
                                {module.order}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-card-foreground">
                                    {t(`improv.modules.${module.id}.name`)}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {t(`improv.modules.${module.id}.term`)}
                                </p>
                            </div>
                            {isComplete ? (
                                <Badge variant="outline" className="shrink-0 border-emerald-500/50 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-300">
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    {t("improv.status.done")}
                                </Badge>
                            ) : unlocked ? (
                                <Badge variant="secondary" className="shrink-0 text-[10px]">{t("improv.status.available")}</Badge>
                            ) : (
                                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            {unlocked && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ModuleView({ moduleId }: { moduleId: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const moduleState = useImprovStore((state) => state.moduleState);
    const unlockAll = useImprovStore((state) => state.unlockAll);

    const module = getImprovModule(moduleId);

    useEffect(() => {
        if (!module) return;
        trackFeatureOpened("improv", module.id, "improv_roadmap");
    }, [module]);

    if (!module) {
        return (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
                <h2 className="type-h1">{t("improv.module.notFoundTitle")}</h2>
                <p className="type-body text-muted-foreground">{t("improv.module.notFoundDesc", { moduleId })}</p>
                <Button variant="outline" onClick={() => navigate("/improv")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t("improv.module.backToRoadmap")}
                </Button>
            </div>
        );
    }

    const unlocked = isModuleUnlocked(module.id, moduleState, unlockAll);
    const isComplete = isModuleComplete(module, moduleState[module.id]);
    const moduleName = t(`improv.modules.${module.id}.name`);
    const moduleTerm = t(`improv.modules.${module.id}.term`);

    return (
        <div className="space-y-4 pb-8">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate("/improv")} aria-label={t("improv.module.backToRoadmap")} className="shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                    <h1 className="type-h1 truncate">{moduleName}</h1>
                    {moduleName !== moduleTerm && (
                        <p className="text-xs text-muted-foreground">{moduleTerm}</p>
                    )}
                </div>
                {isComplete && (
                    <Badge className="ml-auto shrink-0 border-transparent bg-emerald-500 text-emerald-50">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {t("improv.status.done")}
                    </Badge>
                )}
            </div>

            {!unlocked ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                        <Lock className="h-6 w-6 text-muted-foreground" />
                        <p className="text-sm font-medium">{t("improv.module.lockedTitle")}</p>
                        <p className="max-w-sm text-xs text-muted-foreground">{t("improv.module.lockedDesc")}</p>
                        <Button variant="outline" size="sm" onClick={() => navigate("/improv")}>
                            {t("improv.module.backToRoadmap")}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <TheoryCard theoryKey={module.theoryKey} />
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-foreground">{t("improv.module.exercisesTitle")}</h2>
                        {module.exercises.map((exercise) => {
                            switch (exercise.engine) {
                                case "fretboard-quiz":
                                    return <FretboardQuiz key={exercise.id} moduleId={module.id} exercise={exercise} />;
                                case "choice-quiz":
                                    return <ChoiceQuiz key={exercise.id} moduleId={module.id} exercise={exercise} />;
                                case "diagram-drill":
                                    return <DiagramDrill key={exercise.id} moduleId={module.id} exercise={exercise} />;
                                case "backing-improv":
                                    return <BackingLoopExercise key={exercise.id} moduleId={module.id} exercise={exercise} />;
                                default:
                                    return null;
                            }
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

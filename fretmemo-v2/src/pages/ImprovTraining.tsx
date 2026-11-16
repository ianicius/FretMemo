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

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2, ChevronRight, GraduationCap, Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { TheoryCard } from "@/components/improv/TheoryCard";
import { ChoiceQuiz } from "@/components/improv/ChoiceQuiz";
import { DiagramDrill } from "@/components/improv/DiagramDrill";
import { BuildScaleDrill } from "@/components/improv/BuildScaleDrill";
import type { DiagramDrillParams, ImprovExercise } from "@/data/improv/curriculum";
import { BackingLoopExercise } from "@/components/improv/BackingLoopExercise";
import { PracticeLinkExercise } from "@/components/improv/PracticeLinkExercise";
import { LickExercise } from "@/components/improv/LickExercise";
import { CURRICULUM, REVIEW_ID, STANDARDS, STANDARDS_ID, countCompletedModules, dailySession, passedQuizGenerators, reviewQuiz, getImprovModule, isModuleUnlocked, isModuleComplete, isNonGating } from "@/data/improv/curriculum";
import type { ChoiceGeneratorId } from "@/lib/improv/questions";
import { useImprovStore } from "@/stores/useImprovStore";
import { IMPROV_SESSION_MODE, useQuestStore } from "@/stores/useQuestStore";
import { isDueForReview } from "@/lib/sm2";
import { cn } from "@/lib/utils";
import { preloadGuitarSamples } from "@/lib/audio";
import { trackFeatureOpened } from "@/lib/analytics";
import { ArrowLeft as ArrowLeftIcon } from "lucide-react";

export default function ImprovTraining() {
    const { moduleId } = useParams<{ moduleId: string }>();
    // Fetch the guitar samples now, so the first chord or lick is not the synth fallback.
    useEffect(() => preloadGuitarSamples(), []);

    if (moduleId === "session") {
        return <SessionView />;
    }
    if (!moduleId) {
        return <RoadmapView />;
    }
    return <ModuleView moduleId={moduleId} />;
}

/** Plan phase 6: display stages over the canonical order (display only). */
const STAGES: Array<{ labelKey: string; from: number; to: number }> = [
    { labelKey: "improv.stage.podstawy", from: 1, to: 6 },
    { labelKey: "improv.stage.harmonia", from: 7, to: 11 },
    { labelKey: "improv.stage.granie", from: 12, to: 17 },
    { labelKey: "improv.stage.zaawansowane", from: 18, to: 22 },
];

function RoadmapView() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const moduleState = useImprovStore((state) => state.moduleState);
    const unlockAll = useImprovStore((state) => state.unlockAll);
    const setUnlockAll = useImprovStore((state) => state.setUnlockAll);
    const entranceUnlockCount = useImprovStore((state) => state.entranceUnlockCount);
    const updateReviewSR = useImprovStore((state) => state.updateReviewSR);
    const reviewSRS = useImprovStore((state) => state.reviewSRS);
    const setEntranceUnlockCount = useImprovStore((state) => state.setEntranceUnlockCount);

    const completed = countCompletedModules(moduleState);
    const total = CURRICULUM.length;

    // Plan phase 6: mixed review quiz from the choice-quiz generators of
    // passed modules; SM-2 entries per generator schedule the review.
    const passedGenerators = useMemo(() => passedQuizGenerators(moduleState), [moduleState]);
    // SM-2 schedule: review the generators that are due (never reviewed or
    // past their date); when nothing is due, review everything passed.
    const reviewGenerators = useMemo(() => {
        const due = passedGenerators.filter((generatorId) => {
            const entry = reviewSRS[generatorId];
            return !entry || isDueForReview(entry);
        });
        return due.length > 0 ? due : passedGenerators;
    }, [passedGenerators, reviewSRS]);
    const [reviewOpen, setReviewOpen] = useState(false);
    const reviewExercise = useMemo(() => reviewQuiz(reviewGenerators), [reviewGenerators]);
    const handleReviewAnswered = useCallback((generatorId: string, correct: boolean) => {
        updateReviewSR(generatorId, correct ? 5 : 2);
    }, [updateReviewSR]);

    // Plan phase 6: placement quiz — one question per module (in canonical
    // order where the module has a choice-quiz generator); unlocks modules
    // up to the first failed one.
    const generatorModuleOrder = useMemo(() => {
        const map = new Map<string, number>();
        for (const module of CURRICULUM) {
            for (const exercise of module.exercises) {
                if (exercise.engine !== "choice-quiz") continue;
                const generatorId = (exercise.params as { generatorId: string }).generatorId;
                const previous = map.get(generatorId);
                if (previous === undefined || module.order < previous) map.set(generatorId, module.order);
            }
        }
        return map;
    }, []);
    const orderedEntranceGenerators = useMemo(
        () => [...generatorModuleOrder.entries()].sort((a, b) => a[1] - b[1]).map(([generatorId]) => generatorId),
        [generatorModuleOrder],
    );
    const [entranceOpen, setEntranceOpen] = useState(false);
    const failedOrdersRef = useRef<Set<number>>(new Set());
    const entranceExercise = useMemo(() => ({
        id: "entrance.quiz",
        engine: "choice-quiz" as const,
        nameKey: "improv.roadmap.entranceTestName",
        descKey: "improv.roadmap.entranceTestDesc",
        params: {
            generatorId: "mixed" as const,
            allowedGenerators: orderedEntranceGenerators as ChoiceGeneratorId[],
            questionCount: orderedEntranceGenerators.length,
            requiredCorrect: orderedEntranceGenerators.length,
            answerOptions: 4,
            // One question per module, in curriculum order.
            sequential: true,
        },
    }), [orderedEntranceGenerators]);
    const handleEntranceAnswered = useCallback((generatorId: string, correct: boolean) => {
        if (correct) return;
        const order = generatorModuleOrder.get(generatorId);
        if (order) failedOrdersRef.current.add(order);
    }, [generatorModuleOrder]);
    const handleEntranceFinished = useCallback(() => {
        const firstFailed = failedOrdersRef.current.size > 0 ? Math.min(...failedOrdersRef.current) : CURRICULUM.length;
        // Modules up to AND including the first failed one unlock — the
        // failed module is the one to study next.
        setEntranceUnlockCount(firstFailed);
        failedOrdersRef.current = new Set();
        setEntranceOpen(false);
    }, [setEntranceUnlockCount, setEntranceOpen]);

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
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                            type="button"
                            size="sm"
                            variant={reviewOpen ? "secondary" : "outline"}
                            disabled={completed === 0}
                            onClick={() => {
                                setEntranceOpen(false);
                                setReviewOpen((previous) => !previous);
                            }}
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {t("improv.review.button")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={entranceOpen ? "secondary" : "outline"}
                            onClick={() => {
                                setReviewOpen(false);
                                failedOrdersRef.current = new Set();
                                setEntranceOpen((previous) => !previous);
                            }}
                        >
                            <GraduationCap className="mr-2 h-4 w-4" />
                            {t("improv.roadmap.entranceTest")}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {reviewOpen && completed > 0 && (
                <ChoiceQuiz
                    key={`review-${reviewGenerators.join(",")}`}
                    moduleId={REVIEW_ID}
                    exercise={reviewExercise}
                    onQuestionAnswered={handleReviewAnswered}
                />
            )}
            {reviewOpen && completed === 0 && (
                <p className="text-xs text-muted-foreground">{t("improv.review.disabledHint")}</p>
            )}
            {entranceOpen && (
                <ChoiceQuiz
                    key="entrance-quiz"
                    moduleId="entrance"
                    exercise={entranceExercise}
                    onQuestionAnswered={handleEntranceAnswered}
                    onRunFinished={handleEntranceFinished}
                />
            )}

            <div className="space-y-2">
                {CURRICULUM.map((module) => {
                    const stageLabel = STAGES.find((stage) => stage.from === module.order)?.labelKey;
                    const unlocked = isModuleUnlocked(module.id, moduleState, unlockAll, entranceUnlockCount);
                    const isComplete = isModuleComplete(module, moduleState[module.id]);
                    const moduleName = t(`improv.modules.${module.id}.name`);
                    const moduleTerm = t(`improv.modules.${module.id}.term`);
                    return (
                        <Fragment key={`m-${module.order}`}>
                        {stageLabel && (
                            <p className="pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {t(stageLabel)}
                            </p>
                        )}
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
                                    {moduleName}
                                </p>
                                {moduleTerm !== moduleName && (
                                    <p className="truncate text-xs text-muted-foreground">
                                        {moduleTerm}
                                    </p>
                                )}
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
                        </Fragment>
                    );
                })}
            </div>

            <p className="pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("improv.standards.title")}
            </p>
            <BackingLoopExercise moduleId={STANDARDS_ID} exercise={STANDARDS} />
        </div>
    );
}

function renderImprovExercise(moduleId: string, exercise: ImprovExercise) {
    switch (exercise.engine) {
        case "choice-quiz":
            return <ChoiceQuiz key={exercise.id} moduleId={moduleId} exercise={exercise} />;
        case "diagram-drill":
            return (exercise.params as DiagramDrillParams).buildStarts
                ? <BuildScaleDrill key={exercise.id} moduleId={moduleId} exercise={exercise} />
                : <DiagramDrill key={exercise.id} moduleId={moduleId} exercise={exercise} />;
        case "backing-improv":
            return <BackingLoopExercise key={exercise.id} moduleId={moduleId} exercise={exercise} />;
        case "practice-link":
            return <PracticeLinkExercise key={exercise.id} moduleId={moduleId} exercise={exercise} />;
        case "lick":
            return <LickExercise key={exercise.id} moduleId={moduleId} exercise={exercise} />;
        default:
            return null;
    }
}

/** Suggested minutes per step of the session of the day: 15 in total. */
const SESSION_MINUTES = [3, 5, 7];

/** Plan F1: three exercises in a row, one click away from the home page. */
function SessionView() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const updateReviewSR = useImprovStore((state) => state.updateReviewSR);
    // Chosen once on entry: passing a step must not swap the steps that follow.
    const [steps] = useState(() => dailySession(useImprovStore.getState().moduleState));
    const [index, setIndex] = useState(0);
    const step = steps[index];
    const last = index === steps.length - 1;

    return (
        <div className="space-y-4 pb-8">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label={t("improv.session.back")} className="shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                    <h1 className="type-h1 truncate">{t("improv.session.title")}</h1>
                    <p className="text-xs text-muted-foreground">
                        {t("improv.session.step", {
                            step: index + 1,
                            total: steps.length,
                            name: t(`improv.session.engine.${step.exercise.engine}`),
                            minutes: SESSION_MINUTES[index],
                        })}
                    </p>
                </div>
            </div>
            {step.moduleId === REVIEW_ID ? (
                <ChoiceQuiz
                    key={step.exercise.id}
                    moduleId={REVIEW_ID}
                    exercise={step.exercise}
                    onQuestionAnswered={(generatorId, correct) => updateReviewSR(generatorId, correct ? 5 : 2)}
                />
            ) : renderImprovExercise(step.moduleId, step.exercise)}
            <Button
                className="w-full"
                onClick={() => {
                    if (last) {
                        useQuestStore.getState().updateProgress("play_mode", 1, { mode: IMPROV_SESSION_MODE });
                        navigate("/");
                        return;
                    }
                    setIndex(index + 1);
                    window.scrollTo(0, 0);
                }}
            >
                {t(last ? "improv.session.finish" : "improv.session.next")}
            </Button>
        </div>
    );
}

function ModuleView({ moduleId }: { moduleId: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const moduleState = useImprovStore((state) => state.moduleState);
    const unlockAll = useImprovStore((state) => state.unlockAll);
    const entranceUnlockCount = useImprovStore((state) => state.entranceUnlockCount);

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

    const renderExercise = (exercise: ImprovExercise) => renderImprovExercise(module.id, exercise);
    const extraExercises = module.exercises.filter(isNonGating);

    const unlocked = isModuleUnlocked(module.id, moduleState, unlockAll, entranceUnlockCount);
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
                    <TheoryCard theoryKey={module.theoryKey} embed={module.embed} />
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-foreground">{t("improv.module.exercisesTitle")}</h2>
                        {module.exercises.filter((exercise) => !isNonGating(exercise)).map(renderExercise)}
                        {extraExercises.length > 0 && (
                            // Extras never gate the module, so they stay folded until asked for.
                            <details className="group rounded-xl border border-border bg-card/40">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                                    <span>{t("improv.module.moreExercises", { count: extraExercises.length })}</span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                                </summary>
                                <div className="space-y-3 px-2 pb-2">
                                    <p className="px-2 text-xs text-muted-foreground">{t("improv.module.supplementaryHint")}</p>
                                    {extraExercises.map(renderExercise)}
                                </div>
                            </details>
                        )}
                    </div>
                    {module.supplementary && module.supplementary.length > 0 && (
                        <div className="space-y-2">
                            <h2 className="text-sm font-semibold text-foreground">{t("improv.module.supplementaryTitle")}</h2>
                            <div className="flex flex-wrap gap-2">
                                {module.supplementary.map((link) => (
                                    <Button key={link.href} variant="outline" size="sm" onClick={() => navigate(link.href)}>
                                        <ArrowLeftIcon className="mr-2 h-4 w-4 rotate-180" />
                                        {t(link.labelKey)}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">{t("improv.module.supplementaryHint")}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

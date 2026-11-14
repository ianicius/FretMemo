/**
 * E2 choice-quiz engine (run improv-training-2026-11-13).
 *
 * Closed questions (1 of N) generated from the pure generators in
 * src/lib/improv/questions.ts, keyed by `generatorId` from the curriculum.
 * Feedback: selected option turns green (correct) / red (wrong), the
 * canonical answer is always highlighted, optional explanation line
 * appears, then the quiz auto-advances. Ends with a score summary; a run
 * meeting `requiredCorrect` is recorded in the improv store.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
    generateChoiceQuiz,
    type ChoiceQuestion,
} from "@/lib/improv/questions";
import type { ChoiceQuizParams, ImprovExercise } from "@/data/improv/curriculum";
import { useImprovStore } from "@/stores/useImprovStore";
import { cn } from "@/lib/utils";
import { ExerciseFrame, ScoreStrip } from "./ExerciseFrame";
import { localizePromptValues, localizeToken } from "@/lib/improv/display";

interface ChoiceQuizProps {
    moduleId: string;
    exercise: ImprovExercise;
}

const ANSWER_ADVANCE_MS = 1300;

/** Options that are i18n keys (borrowed-chord answers) get translated. */
function formatOption(option: string, translate: (key: string) => string): string {
    return option.startsWith("improv.") ? translate(option) : localizeToken(option);
}

export function ChoiceQuiz({ moduleId, exercise }: ChoiceQuizProps) {
    const { t } = useTranslation();
    const params = exercise.params as ChoiceQuizParams;
    const recordQuizResult = useImprovStore((state) => state.recordQuizResult);
    const quizBest = useImprovStore((state) => state.moduleState[moduleId]?.quizBest ?? 0);
    const passed = quizBest >= params.requiredCorrect;

    const attemptSeed = useRef(0);
    const [questions, setQuestions] = useState<ChoiceQuestion[]>(() =>
        generateChoiceQuiz(params, `${exercise.id}:0:${Date.now()}`));
    const [index, setIndex] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [finished, setFinished] = useState(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    }, []);

    const question = questions[index];

    const choose = (option: string) => {
        if (selected || !question) return;
        const wasCorrect = option === question.options[question.correctIndex];
        const nextCorrect = wasCorrect ? correct + 1 : correct;
        if (wasCorrect) setCorrect(nextCorrect);
        setSelected(option);
        timerRef.current = window.setTimeout(() => {
            setSelected(null);
            if (index + 1 >= questions.length) {
                recordQuizResult(moduleId, exercise.id, nextCorrect);
                setFinished(true);
            } else {
                setIndex((previous) => previous + 1);
            }
        }, ANSWER_ADVANCE_MS);
    };

    const restart = useCallback(() => {
        attemptSeed.current += 1;
        setQuestions(generateChoiceQuiz(params, `${exercise.id}:${attemptSeed.current}:${Date.now()}`));
        setIndex(0);
        setCorrect(0);
        setSelected(null);
        setFinished(false);
    }, [exercise.id, params]);

    const thresholdLabel = t("improv.quiz.threshold", {
        required: params.requiredCorrect,
        total: params.questionCount,
    });

    return (
        <ExerciseFrame
            engine={exercise.engine}
            name={t(exercise.nameKey)}
            description={t(exercise.descKey)}
            thresholdLabel={thresholdLabel}
            passed={passed}
        >
            {finished || !question ? (
                <div className="space-y-3">
                    <ScoreStrip
                        label={t("improv.quiz.finalScore")}
                        value={t("improv.quiz.scoreValue", { correct, total: questions.length })}
                    />
                    <p className={cn("text-sm font-medium", correct >= params.requiredCorrect ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300")}>
                        {correct >= params.requiredCorrect
                            ? t("improv.quiz.passed")
                            : t("improv.quiz.failed", { required: params.requiredCorrect })}
                    </p>
                    <Button variant="outline" size="sm" onClick={restart}>
                        {t("improv.quiz.restart")}
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    <ScoreStrip
                        label={t("improv.quiz.question", { current: index + 1, total: questions.length })}
                        value={t("improv.quiz.scoreValue", { correct, total: questions.length })}
                    />
                    <p className="text-sm font-medium">{t(question.promptKey, localizePromptValues(question.promptValues))}</p>
                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                        {question.options.map((option) => {
                            const isCorrectOption = option === question.options[question.correctIndex];
                            const isSelected = selected === option;
                            return (
                                <Button
                                    key={option}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={Boolean(selected)}
                                    className={cn(
                                        "justify-start",
                                        selected && isCorrectOption && "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                                        isSelected && !isCorrectOption && "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300",
                                    )}
                                    onClick={() => choose(option)}
                                >
                                    {formatOption(option, t)}
                                </Button>
                            );
                        })}
                    </div>
                    {selected && question.hintKey && (
                        <p className="text-xs text-muted-foreground">
                            {selected === question.options[question.correctIndex]
                                ? t("improv.quiz.correct")
                                : t("improv.quiz.wrong", { answer: formatOption(question.options[question.correctIndex], t) })}
                            {" "}
                            {t(question.hintKey, localizePromptValues(question.hintValues ?? {}))}
                        </p>
                    )}
                </div>
            )}
        </ExerciseFrame>
    );
}

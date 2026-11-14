/**
 * E1 fretboard-quiz engine (run improv-training-2026-11-13).
 *
 * Two directions driven by curriculum params:
 * - `position-to-note`: a position is highlighted on the Fretboard, the user
 *   picks the note name from 4 buttons;
 * - `note-to-position`: a note name is shown, the user clicks the matching
 *   position on the (clickable) Fretboard.
 *
 * Pass threshold: requiredCorrect / questionCount (e.g. 10/10 for the E
 * string module). A passed run is recorded in the improv store.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Fretboard } from "@/components/fretboard/Fretboard";
import type { NoteStatus, Position } from "@/types/fretboard";
import {
    generateFretboardQuestions,
    type FretboardQuestion,
} from "@/lib/improv/questions";
import { isExercisePassed, QUIZ_PASSED_ATTEMPTS, type FretboardQuizParams, type ImprovExercise } from "@/data/improv/curriculum";
import { selectModuleProgress, useImprovStore } from "@/stores/useImprovStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { cn } from "@/lib/utils";
import { ExerciseFrame, ScoreStrip } from "./ExerciseFrame";
import { localizeToken } from "@/lib/improv/display";

interface FretboardQuizProps {
    moduleId: string;
    exercise: ImprovExercise;
}

interface AnswerState {
    wasCorrect: boolean;
    selectedOption?: string;
    clickedPosition?: Position;
}

const ANSWER_ADVANCE_MS = 900;

export function FretboardQuiz({ moduleId, exercise }: FretboardQuizProps) {
    const { t } = useTranslation();
    const params = exercise.params as FretboardQuizParams;
    const recordQuizResult = useImprovStore((state) => state.recordQuizResult);
    const recordSession = useProgressStore((state) => state.recordSession);
    const progress = useImprovStore((state) => selectModuleProgress(state, moduleId));
    const passed = isExercisePassed(exercise, progress);
    const passedAttempts = progress.exerciseRuns[exercise.id] ?? 0;

    const attemptSeed = useRef(0);
    const [questions, setQuestions] = useState<FretboardQuestion[]>(() =>
        generateFretboardQuestions(params, `${exercise.id}:0:${Date.now()}`));
    const [index, setIndex] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [answer, setAnswer] = useState<AnswerState | null>(null);
    const [finished, setFinished] = useState(false);
    const timerRef = useRef<number | null>(null);
    const [runStart] = useState(() => Date.now());

    useEffect(() => () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    }, []);

    const question = questions[index];

    const finishRun = useCallback((finalCorrect: number) => {
        recordQuizResult(moduleId, exercise.id, finalCorrect);
        recordSession({
            startedAt: runStart,
            correct: finalCorrect,
            incorrect: Math.max(0, questions.length - finalCorrect),
            durationSeconds: Math.max(1, Math.round((Date.now() - runStart) / 1000)),
        });
        setFinished(true);
    }, [exercise.id, moduleId, questions.length, recordQuizResult, recordSession, runStart]);

    const scheduleAdvance = useCallback((wasCorrect: boolean, hadAnswer: boolean) => {
        const nextCorrect = wasCorrect && hadAnswer ? correct + 1 : correct;
        if (wasCorrect && hadAnswer) setCorrect(nextCorrect);
        setAnswer({ wasCorrect });
        timerRef.current = window.setTimeout(() => {
            setAnswer(null);
            if (index + 1 >= questions.length) {
                finishRun(nextCorrect);
            } else {
                setIndex((previous) => previous + 1);
            }
        }, ANSWER_ADVANCE_MS);
    }, [correct, finishRun, index, questions.length]);

    const answerOption = (option: string) => {
        if (answer || !question) return;
        scheduleAdvance(option === question.note, true);
        setAnswer((previous) => ({ ...previous, wasCorrect: option === question.note, selectedOption: option }));
    };

    const clickPosition = (position: Position) => {
        if (answer || !question) return;
        const withinStrings = params.stringIndices.includes(position.stringIndex);
        const withinFrets = position.fret >= params.fretFrom && position.fret <= params.fretTo;
        const wasCorrect = withinStrings && withinFrets && position.note === question.note;
        setAnswer({ wasCorrect, clickedPosition: position });
        scheduleAdvance(wasCorrect, true);
    };

    const restart = () => {
        attemptSeed.current += 1;
        setQuestions(generateFretboardQuestions(params, `${exercise.id}:${attemptSeed.current}:${Date.now()}`));
        setIndex(0);
        setCorrect(0);
        setAnswer(null);
        setFinished(false);
    };

    const activeNotes = useMemo((): NoteStatus[] => {
        if (!question) return [];
        if (question.direction === "position-to-note") {
            const status = answer
                ? (answer.wasCorrect ? "correct" : "incorrect")
                : "active";
            return [{
                position: { stringIndex: question.stringIndex, fret: question.fret, note: question.note },
                status,
                emphasis: "strong",
            }];
        }
        const notes: NoteStatus[] = [];
        if (answer?.clickedPosition) {
            notes.push({
                position: answer.clickedPosition,
                status: answer.wasCorrect ? "correct" : "incorrect",
                emphasis: "strong",
            });
        }
        if (answer && !answer.wasCorrect) {
            notes.push({
                position: { stringIndex: question.stringIndex, fret: question.fret, note: question.note },
                status: "correct",
                emphasis: "strong",
            });
        }
        return notes;
    }, [answer, question]);

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
                            ? t("improv.quiz.passed", { required: QUIZ_PASSED_ATTEMPTS })
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
                    <ScoreStrip
                        label={t("improv.quiz.attempts")}
                        value={t("improv.quiz.attemptsValue", { done: Math.min(passedAttempts, 2), required: 2 })}
                    />
                    {question.direction === "position-to-note" ? (
                        <>
                            <p className="text-sm font-medium">{t("improv.fretQuiz.promptPositionToNote")}</p>
                            <Fretboard
                                frets={params.fretTo}
                                activeNotes={activeNotes}
                                fitContainer
                                className="rounded-lg border border-border bg-card/60"
                            />
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {(question.options ?? []).map((option) => {
                                    const isSelected = answer?.selectedOption === option;
                                    const isCorrectOption = Boolean(answer) && option === question.note;
                                    return (
                                        <Button
                                            key={option}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={Boolean(answer)}
                                            className={cn(
                                                isCorrectOption && "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                                                isSelected && !isCorrectOption && "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300",
                                            )}
                                            onClick={() => answerOption(option)}
                                        >
                                            {localizeToken(option)}
                                        </Button>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-medium">
                                {t("improv.fretQuiz.promptNoteToPosition", { note: localizeToken(question.note) })}
                            </p>
                            <Fretboard
                                frets={params.fretTo}
                                activeNotes={activeNotes}
                                onNoteClick={clickPosition}
                                fitContainer
                                className="rounded-lg border border-border bg-card/60"
                            />
                            <p className="text-xs text-muted-foreground">
                                {answer
                                    ? (answer.wasCorrect
                                        ? t("improv.quiz.correct")
                                        : t("improv.fretQuiz.wrongPosition", { note: localizeToken(question.note) }))
                                    : t("improv.fretQuiz.clickHint")}
                            </p>
                        </>
                    )}
                </div>
            )}
        </ExerciseFrame>
    );
}

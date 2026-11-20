/**
 * "Play what you hear": the app plays a cadence and a short phrase, the
 * learner plays the phrase back on the guitar in any octave and the microphone
 * follows it note by note (lib/improv/noteSequence.ts). Phrases come from
 * lib/improv/echo.ts.
 *
 * The microphone ignores the app's own playback. Without a microphone the
 * learner marks phrases themselves; those passes are stored as unverified.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NOTES } from "@/lib/constants";
import { createRng } from "@/lib/improv/questions";
import { echoKey, echoNoteNames, echoPhrase, echoSound, pitchClassOf, type EchoPhrase } from "@/lib/improv/echo";
import { SEQUENCE_IDLE, advanceSequence, sequenceDone } from "@/lib/improv/noteSequence";
import { soundSeconds } from "@/lib/improv/questionSound";
import { playSoundSteps } from "@/lib/improv/playSound";
import { localizeToken } from "@/lib/improv/display";
import { isExercisePassed, isExerciseVerified, isNonGating, type EchoDrillParams, type ImprovExercise } from "@/data/improv/curriculum";
import { selectModuleProgress, useImprovStore } from "@/stores/useImprovStore";
import { usePitchDetector } from "@/services/pitch";
import { cn } from "@/lib/utils";
import { ExerciseFrame } from "./ExerciseFrame";

/** The last note of the playback still rings this long after it: the microphone waits it out. */
const RING_OUT_SECONDS = 1;

interface EchoDrillProps {
    moduleId: string;
    exercise: ImprovExercise;
}

export function EchoDrill({ moduleId, exercise }: EchoDrillProps) {
    const { t } = useTranslation();
    const params = exercise.params as EchoDrillParams;
    const recordLoopPass = useImprovStore((state) => state.recordLoopPass);
    const progress = useImprovStore((state) => selectModuleProgress(state, moduleId));
    const passed = isExercisePassed(exercise, progress);
    const phrasesDone = progress.exerciseRuns[exercise.id] ?? 0;

    const newPhrase = () => echoPhrase(createRng(`${exercise.id}:${Date.now()}:${Math.random()}`), params);
    const [phrase, setPhrase] = useState<EchoPhrase>(newPhrase);
    const [revealed, setRevealed] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [micOn, setMicOn] = useState(false);
    const detector = usePitchDetector(micOn);

    // Follow the detector while the learner plays (not while the app does).
    const target = phrase.midis.map(pitchClassOf);
    const reading = micOn && !playing ? detector.note : null;
    const [seen, setSeen] = useState<string | null>(null);
    const [sequence, setSequence] = useState(SEQUENCE_IDLE);
    const done = sequenceDone(target, sequence);
    if (reading !== seen) {
        setSeen(reading);
        if (!done) setSequence(advanceSequence(target, sequence, reading === null ? null : NOTES.indexOf(reading as (typeof NOTES)[number])));
    }

    const recordedRef = useRef(false);
    useEffect(() => {
        if (!done || recordedRef.current) return;
        recordedRef.current = true;
        recordLoopPass(moduleId, exercise.id, undefined, true);
    }, [done, exercise.id, moduleId, recordLoopPass]);

    const cancelRef = useRef<(() => void) | null>(null);
    const timerRef = useRef<number | null>(null);
    useEffect(() => () => {
        cancelRef.current?.();
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    }, []);

    const play = (next: EchoPhrase) => {
        cancelRef.current?.();
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        const steps = echoSound(next);
        cancelRef.current = playSoundSteps(steps);
        setPlaying(true);
        setSequence(SEQUENCE_IDLE);
        timerRef.current = window.setTimeout(() => setPlaying(false), (soundSeconds(steps) + RING_OUT_SECONDS) * 1000);
    };

    const nextPhrase = () => {
        const next = newPhrase();
        recordedRef.current = false;
        setPhrase(next);
        setRevealed(false);
        play(next);
    };

    const selfMark = () => {
        recordLoopPass(moduleId, exercise.id, undefined, false);
        nextPhrase();
    };

    const names = echoNoteNames(phrase);
    const key = localizeToken(echoKey(phrase));

    return (
        <ExerciseFrame
            engine={exercise.engine}
            name={t(exercise.nameKey)}
            description={t(exercise.descKey)}
            thresholdLabel={t("improv.echo.threshold", { required: params.requiredPhrases })}
            passed={passed}
            unverified={passed && !isExerciseVerified(exercise, progress)}
        >
            {isNonGating(exercise) && (
                <Badge variant="secondary" className="w-fit text-[10px]">{t("improv.practiceLink.extra")}</Badge>
            )}
            <p className="text-sm">
                {t(phrase.mode === "minor" ? "improv.echo.promptMinor" : "improv.echo.promptMajor", { key })}
            </p>

            <div className="flex items-center gap-2" aria-label={t("improv.echo.progress", { done: sequence.matched, total: target.length })}>
                {target.map((_, index) => (
                    <span
                        key={index}
                        className={cn(
                            "flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-medium",
                            index < sequence.matched ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted/40 text-muted-foreground",
                        )}
                    >
                        {revealed || index < sequence.matched ? localizeToken(names[index] as string) : index + 1}
                    </span>
                ))}
            </div>

            <p className="text-xs text-muted-foreground" aria-live="polite">
                {done
                    ? t("improv.echo.done")
                    : playing
                        ? t("improv.echo.listen")
                        : !micOn
                            ? t("improv.echo.micOffHint")
                            : detector.error
                                ? t("improv.loop.micError")
                                : t("improv.echo.waiting")}
            </p>
            {revealed && (
                <p className="text-xs text-muted-foreground">
                    {t("improv.echo.degrees", { degrees: phrase.degrees.join(" – ") })}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button type="button" size="sm" onClick={() => (done ? nextPhrase() : play(phrase))}>
                    {done ? t("improv.echo.next") : t("improv.quiz.play")}
                </Button>
                <Button type="button" size="sm" variant={micOn ? "secondary" : "outline"} onClick={() => setMicOn((previous) => !previous)}>
                    {micOn ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                    {micOn ? t("improv.loop.micDisable") : t("improv.loop.micEnable")}
                </Button>
                {!done && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setRevealed(true)} disabled={revealed}>
                        {t("improv.echo.reveal")}
                    </Button>
                )}
                {!done && (
                    <Button type="button" size="sm" variant="outline" onClick={selfMark}>
                        {t("improv.echo.selfMark")}
                    </Button>
                )}
                <Badge variant="outline" className="text-xs">
                    {t("improv.echo.count", { done: Math.min(phrasesDone, params.requiredPhrases), required: params.requiredPhrases })}
                </Badge>
            </div>
        </ExerciseFrame>
    );
}

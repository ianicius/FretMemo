/**
 * Plan D2: a lick on the fretboard — numbered notes, playback with the
 * current note lit, transposition to any key, and a "played it" counter.
 * Notes may carry a technique (bend, hammer-on, slide, vibrato) or a second
 * note of a double stop; a lick may be played with a shuffle feel.
 *
 * shortcut: standard tuning only, and a bend is played back as its target
 * note without the glide; add tuning-aware frets or a pitch glide if learners
 * ask for them.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { STANDARD_TUNING, getNoteAt } from "@/lib/constants";
import { playChord, playTone } from "@/lib/audio";
import { keyChoices, keyPitchClass } from "@/lib/improv/loopTools";
import { IMPROV_FRETBOARD_ROWS, localizeToken } from "@/lib/improv/display";
import { LICK_MAX_FRET, getLick, lickBeat, lickOrderLabel, lickNoteMidi, lickNoteName, lickShift, lickSoundingMidi, lickTechMark, type Lick, type LickNote } from "@/data/improv/licks";
import { isExercisePassed, isNonGating, loopRunKey, type ImprovExercise, type LickParams } from "@/data/improv/curriculum";
import { selectModuleProgress, useImprovStore } from "@/stores/useImprovStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { NoteStatus } from "@/types/fretboard";
import { Badge } from "@/components/ui/badge";
import { ExerciseFrame } from "./ExerciseFrame";

const DEFAULT_BPM = 90;

interface LickExerciseProps {
    moduleId: string;
    exercise: ImprovExercise;
}

export function LickExercise({ moduleId, exercise }: LickExerciseProps) {
    const { t } = useTranslation();
    const params = exercise.params as LickParams;
    const licks = params.lickIds.map((id) => getLick(id) as Lick);
    const recordLoopPass = useImprovStore((state) => state.recordLoopPass);
    const progress = useImprovStore((state) => selectModuleProgress(state, moduleId));
    const leftHanded = useSettingsStore((state) => state.full.instrument.leftHanded);

    const [lickId, setLickId] = useState(licks[0].id);
    const lick = licks.find((item) => item.id === lickId) ?? licks[0];
    const originalPc = keyPitchClass(lick.key);
    const [keyPc, setKeyPc] = useState(originalPc);
    const [bpm, setBpm] = useState(DEFAULT_BPM);
    const shift = lickShift(lick, originalPc, keyPc);
    const notes: LickNote[] = lick.notes.map(([string, fret, eighths, mods]) => [
        string, fret + shift, eighths, mods?.also ? { ...mods, also: [mods.also[0], mods.also[1] + shift] } : mods,
    ]);

    const [playingIndex, setPlayingIndex] = useState<number | null>(null);
    const timersRef = useRef<number[]>([]);
    const stop = () => {
        for (const id of timersRef.current) window.clearTimeout(id);
        timersRef.current = [];
        setPlayingIndex(null);
    };
    useEffect(() => () => {
        for (const id of timersRef.current) window.clearTimeout(id);
    }, []);

    const play = () => {
        stop();
        const beatSec = 60 / bpm;
        let eighths = 0;
        notes.forEach((note, index) => {
            const startSec = lickBeat(eighths, lick.feel) * beatSec;
            const lengthSec = (lickBeat(eighths + note[2], lick.feel) - lickBeat(eighths, lick.feel)) * beatSec + 0.15;
            const timer = window.setTimeout(() => {
                setPlayingIndex(index);
                try {
                    const also = note[3]?.also;
                    if (also) void playChord([lickSoundingMidi(note), lickNoteMidi(also)].sort((a, b) => a - b), lengthSec, { strumDelaySec: 0 });
                    else void playTone(lickSoundingMidi(note), lengthSec);
                } catch {
                    // Audio unavailable — the numbered board still shows the lick.
                }
            }, startSec * 1000);
            timersRef.current.push(timer);
            eighths += note[2];
        });
        timersRef.current.push(window.setTimeout(() => setPlayingIndex(null), lickBeat(eighths, lick.feel) * beatSec * 1000 + 300));
    };

    // One dot per position; a position played more than once lists every number ("2·6", runs as "1–4").
    const dots = new Map<string, { string: number; fret: number; numbers: number[] }>();
    notes.forEach((note, index) => {
        for (const [string, fret] of [[note[0], note[1]], ...(note[3]?.also ? [note[3].also] : [])]) {
            const key = `${string}:${fret}`;
            const entry = dots.get(key) ?? { string, fret, numbers: [] };
            if (!entry.numbers.includes(index)) entry.numbers.push(index);
            dots.set(key, entry);
        }
    });
    const activeNotes: NoteStatus[] = [...dots.values()].map(({ string, fret, numbers }) => ({
        position: { stringIndex: string - 1, fret, note: getNoteAt(STANDARD_TUNING[string - 1], fret) },
        status: playingIndex !== null && numbers.includes(playingIndex) ? "correct" : "active",
        label: lickOrderLabel(numbers),
        emphasis: numbers.includes(0) ? "strong" : "normal",
    }));

    const runKey = loopRunKey(exercise.id, lick.id);
    const runs = progress.exerciseRuns[runKey] ?? 0;
    const keyOptions = keyChoices(lick.key);
    const activeKey = keyOptions[keyPc] ?? lick.key;
    const noteNames = notes.map((note) => {
        const also = note[3]?.also;
        const name = localizeToken(lickNoteName(note, activeKey));
        return `${also ? `${name}+${localizeToken(lickNoteName([also[0], also[1], 1], activeKey))}` : name}${lickTechMark(note[3])}`;
    });
    const hasTech = notes.some((note) => lickTechMark(note[3]) !== "");

    return (
        <ExerciseFrame
            engine={exercise.engine}
            name={t(exercise.nameKey)}
            description={t(exercise.descKey)}
            thresholdLabel={t("improv.lick.threshold", { required: params.requiredRuns })}
            passed={isExercisePassed(exercise, progress)}
        >
            {isNonGating(exercise) && (
                <Badge variant="secondary" className="w-fit text-[10px]">{t("improv.practiceLink.extra")}</Badge>
            )}
            <div className="flex flex-wrap items-end gap-3">
                {licks.length > 1 && (
                    <div className="min-w-0 space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("improv.lick.choose")}</Label>
                        <Select
                            value={lick.id}
                            onChange={(event) => {
                                stop();
                                const next = getLick(event.target.value) as Lick;
                                setLickId(next.id);
                                setKeyPc(keyPitchClass(next.key));
                            }}
                            className="h-9 w-64 max-w-full text-xs"
                            aria-label={t("improv.lick.choose")}
                        >
                            {licks.map((item) => (
                                <option key={item.id} value={item.id}>{t(`improv.licks.${item.id}.name`)}</option>
                            ))}
                        </Select>
                    </div>
                )}
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("improv.loop.key")}</Label>
                    <Select
                        value={String(keyPc)}
                        onChange={(event) => {
                            stop();
                            setKeyPc(Number(event.target.value));
                        }}
                        className="h-9 w-36 text-xs"
                        aria-label={t("improv.loop.key")}
                    >
                        {keyOptions.map((option, pc) => (
                            <option key={option} value={pc}>
                                {pc === originalPc ? t("improv.loop.keyOriginal", { key: localizeToken(lick.key) }) : localizeToken(option)}
                            </option>
                        ))}
                    </Select>
                </div>
                <div className="min-w-40 flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("improv.loop.bpm", { bpm })}</Label>
                    <Slider value={[bpm]} min={50} max={140} step={5} onValueChange={(values) => { stop(); setBpm(values[0] ?? DEFAULT_BPM); }} />
                </div>
            </div>

            <p className="text-sm">
                {t(`improv.licks.${lick.id}.tip`)}
                {keyPc !== originalPc && (
                    <span className="block text-xs text-muted-foreground">{t("improv.lick.transposed", { key: localizeToken(lick.key) })}</span>
                )}
            </p>

            <div className="space-y-2">
                <Fretboard
                    frets={LICK_MAX_FRET}
                    activeNotes={activeNotes}
                    tuning={STANDARD_TUNING}
                    leftHanded={leftHanded}
                    fitContainer
                    className={`rounded-lg border border-border bg-card/60 ${IMPROV_FRETBOARD_ROWS}`}
                />
                <p className="text-xs text-muted-foreground">
                    {t("improv.lick.legend")}
                    {lick.feel === "shuffle" ? ` ${t("improv.lick.legendShuffle")}` : ""}
                </p>
                <p className="font-mono text-sm" aria-label={t("improv.lick.notes")}>
                    {noteNames.map((name, index) => (
                        <span key={index} className={index === playingIndex ? "font-bold text-primary" : undefined}>
                            {index > 0 && " "}
                            {name}
                        </span>
                    ))}
                </p>
                {hasTech && <p className="text-xs text-muted-foreground">{t("improv.lick.legendTech")}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={playingIndex === null ? play : stop}>
                    {playingIndex === null ? <Play className="mr-2 h-4 w-4" /> : <Square className="mr-2 h-4 w-4" />}
                    {t(playingIndex === null ? "improv.lick.listen" : "improv.lick.stop")}
                </Button>
                <Button type="button" onClick={() => recordLoopPass(moduleId, exercise.id, lick.id)}>
                    {t("improv.lick.played")}
                </Button>
                <span className="text-sm text-muted-foreground">
                    {t("improv.lick.runs", { done: Math.min(runs, params.requiredRuns), total: params.requiredRuns })}
                </span>
            </div>
        </ExerciseFrame>
    );
}

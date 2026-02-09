import type { NoteName, Position } from "@/types/fretboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NoteAnswerButtonsProps {
    noteOptions: string[];
    targetNote?: NoteName;
    selectedNote?: NoteName;
    isLocked: boolean;
    isCorrect?: boolean;
    isPlaying: boolean;
    onSubmit: (note: NoteName) => void;
}

/**
 * Grid of note answer buttons for "Fretboard to Note" and "Tab to Note" modes.
 */
export function NoteAnswerButtons({
    noteOptions,
    targetNote,
    selectedNote,
    isLocked,
    isCorrect,
    isPlaying,
    onSubmit,
}: NoteAnswerButtonsProps) {
    return (
        <div className="mx-auto grid max-w-[19.5rem] grid-cols-2 gap-2 min-[360px]:max-w-[21rem] min-[390px]:max-w-[22rem] min-[412px]:max-w-[23rem] min-[390px]:gap-2.5 sm:max-w-3xl sm:gap-3 sm:grid-cols-4">
            {noteOptions.map((note, idx) => {
                const isCorrectOption = isLocked && note === targetNote;
                const isChosenOption = isLocked && note === selectedNote;
                const isIncorrectChoice = isChosenOption && !isCorrect;
                return (
                    <Button
                        key={`${note}-${idx}`}
                        variant="outline"
                        className={cn(
                            "h-11 rounded-lg border-2 px-2 text-base font-black transition-all shadow-sm hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 active:scale-95 active:bg-primary/10 min-[360px]:h-12 min-[390px]:h-[52px] min-[390px]:text-lg min-[412px]:h-14 sm:h-16 sm:rounded-2xl sm:text-2xl sm:hover:-translate-y-1",
                            isCorrectOption && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                            isIncorrectChoice && "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        )}
                        disabled={!isPlaying || isLocked}
                        onClick={() => onSubmit(note as NoteName)}
                        aria-pressed={isLocked ? isChosenOption : undefined}
                        aria-label={`Answer ${note}`}
                    >
                        {note}
                    </Button>
                );
            })}
        </div>
    );
}

interface MiniTabProps {
    position: Position;
    tuning: NoteName[];
    leftHanded?: boolean;
}

/**
 * Compact tablature display for position answer options.
 */
export function MiniTab({ position, tuning, leftHanded = false }: MiniTabProps) {
    const rows = leftHanded
        ? tuning.map((openNote, index) => ({
            openNote,
            stringIndex: tuning.length - 1 - index,
        }))
        : tuning.map((openNote, index) => ({
            openNote,
            stringIndex: index,
        }));

    return (
        <div className="space-y-1 font-mono text-[10px] leading-none">
            {rows.map(({ openNote, stringIndex }) => {
                const isTarget = stringIndex === position.stringIndex;
                return (
                    <div key={`${openNote}-${stringIndex}`} className="flex items-center gap-1">
                        <span className="w-4 text-muted-foreground font-semibold">{openNote}</span>
                        <span className="text-muted-foreground">|--</span>
                        <span
                            className={cn(
                                "w-7 text-center font-bold tabular-nums rounded border px-1 py-0.5",
                                isTarget
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "border-transparent text-muted-foreground/50"
                            )}
                        >
                            {isTarget ? position.fret : "-"}
                        </span>
                        <span className="text-muted-foreground">--|</span>
                    </div>
                );
            })}
        </div>
    );
}

interface PositionAnswerButtonsProps {
    options: Position[];
    targetPosition?: Position;
    lastAnswerPosition?: Position;
    isLocked: boolean;
    isCorrect?: boolean;
    isPlaying: boolean;
    stringLabels: string[];
    tuning: NoteName[];
    leftHanded: boolean;
    onSubmit: (option: Position) => void;
}

/**
 * Grid of position answer buttons for "Note to Tab" mode.
 */
export function PositionAnswerButtons({
    options,
    targetPosition,
    lastAnswerPosition,
    isLocked,
    isCorrect,
    isPlaying,
    stringLabels,
    tuning,
    leftHanded,
    onSubmit,
}: PositionAnswerButtonsProps) {
    return (
        <div className="grid grid-cols-2 gap-2.5 min-[390px]:gap-3 sm:gap-4">
            {options.map((option) => {
                const key = `${option.stringIndex}-${option.fret}`;
                const isCorrectOption = isLocked && targetPosition && option.stringIndex === targetPosition.stringIndex && option.fret === targetPosition.fret;
                const isChosenOption = lastAnswerPosition && option.stringIndex === lastAnswerPosition.stringIndex && option.fret === lastAnswerPosition.fret;
                return (
                    <Button
                        key={key}
                        type="button"
                        variant="outline"
                        className={cn(
                            "h-auto px-2.5 py-3 min-[390px]:px-3 min-[390px]:py-3.5 sm:px-6 sm:py-6 justify-start text-left rounded-xl sm:rounded-2xl border-2 transition-all relative overflow-hidden group",
                            "hover:border-primary/50 hover:bg-card/80",
                            isCorrectOption && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/30",
                            isChosenOption && !isCorrect && "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400 shake"
                        )}
                        disabled={!isPlaying || isLocked}
                        onClick={() => onSubmit(option)}
                        aria-pressed={isLocked ? !!isChosenOption : undefined}
                        aria-label={`${stringLabels[option.stringIndex]} string, fret ${option.fret}`}
                    >
                        <div className="w-full relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-bold tracking-wide uppercase text-muted-foreground group-hover:text-primary transition-colors">
                                    {stringLabels[option.stringIndex]} String
                                </span>
                                <span className="text-xs font-black font-mono bg-primary/10 text-primary px-3 py-1 rounded-full">
                                    Fret {option.fret}
                                </span>
                            </div>
                            <div className="opacity-80 group-hover:opacity-100 transition-opacity scale-100 group-hover:scale-105 origin-left duration-300">
                                <MiniTab position={option} tuning={tuning} leftHanded={leftHanded} />
                            </div>
                        </div>
                    </Button>
                );
            })}
        </div>
    );
}

import { cn } from "@/lib/utils";
import { STANDARD_TUNING, getNoteAt, isMarker } from "@/lib/constants";
import { Fragment } from "react";
import { StringLine } from "./StringLine";
import { NoteDot } from "./NoteDot";
import type { FretboardProps, Position } from "@/types/fretboard";

export function Fretboard({
    tuning = STANDARD_TUNING,
    frets = 12,
    showFretNumbers = true,
    activeNotes = [],
    onNoteClick,
    leftHanded = false,
    fitContainer = false,
    className,
}: FretboardProps & {
    leftHanded?: boolean;
    className?: string;
    fitContainer?: boolean;
}) {
    // tuning array: [E, B, G, D, A, E] where [0] is High E (string 1)
    // We display High E at the TOP (visual row 0)

    const stringThicknesses = tuning.map((_, index) => {
        if (tuning.length <= 1) return 2;
        const ratio = index / (tuning.length - 1);
        return Number((1.1 + ratio * 1.9).toFixed(2));
    });

    // Match original app: consistent column widths + thick nut at fret 0.
    // Use min widths so the board stays readable on small screens (horizontal scroll instead of squishing).
    // If fitContainer is true, we allow squishing (min 0).
    const minColWidth = fitContainer ? '0px' : '1.75rem'; // 1.75rem was original
    const gridColumns = `minmax(2.25rem, 3rem) repeat(${frets}, minmax(${minColWidth}, 1fr))`;
    const gridRows = `repeat(${tuning.length}, minmax(2.35rem, 1fr))`;

    const markerMap: Record<number, number[]> = {
        3: [2],
        5: [2],
        7: [2],
        9: [2],
        12: [1, 3],
        15: [2],
        17: [2],
        19: [2],
        21: [2],
        24: [1, 3],
    };

    return (
        <div className={cn(
            "relative select-none w-full fretboard-container overflow-x-auto overflow-y-hidden",
            leftHanded && "transform scale-x-[-1]",
            className
        )}>
            {/* Background Gradient Overlay for Dark Mode */}
            <div className={cn(
                "absolute inset-0 z-0 pointer-events-none transition-opacity duration-300",
                "bg-[image:var(--fretboard-bg-dark)] opacity-0 dark:opacity-100"
            )} />

            {/* Main Fretboard Content */}
            <div className="relative z-10 px-2 py-2 md:px-4 md:py-3">
                {/* Grid Container */}
                <div className="relative">
                    <div className="relative">
                        {/* Marker layer - must align only to string/fret grid (not fret-number row) */}
                        <div
                            className="absolute inset-0 z-0 pointer-events-none grid"
                            style={{ gridTemplateColumns: gridColumns }}
                            aria-hidden="true"
                        >
                            {/* Empty cell for fret 0 (nut) */}
                            <div />
                            {/* Markers for each fret */}
                            {Array.from({ length: frets }).map((_, fretIdx) => {
                                const fret = fretIdx + 1;
                                const markerPositions = markerMap[fret];
                                if (!markerPositions) return <div key={`fret-marker-${fret}`} />;

                                const markerCount = markerPositions.length;
                                const topPercents = markerCount === 1
                                    ? [50]
                                    : markerPositions.map((_, idx) => ((idx + 1) / (markerCount + 1)) * 100);

                                return (
                                    <div key={`fret-marker-${fret}`} className="relative h-full">
                                        {markerPositions.map((pos, idx) => (
                                            <div
                                                key={`marker-${fret}-${idx}-${pos}`}
                                                className="marker-dot absolute w-3 h-3 md:w-4 md:h-4 rounded-full"
                                                style={{
                                                    top: `${topPercents[idx]}%`,
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%)'
                                                }}
                                            />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Strings and Frets Grid */}
                        <div
                            className="relative z-10 grid"
                            style={{
                                gridTemplateColumns: gridColumns,
                                gridTemplateRows: gridRows,
                            }}
                        >
                            {tuning.map((openNote, stringIdx) => (
                                <Fragment key={`string-${stringIdx}`}>
                                    {/* Fret 0 (nut + string label) */}
                                    <div
                                        key={`str-${stringIdx}-fr-0`}
                                        className={cn("relative flex items-center justify-center fret-cell fret-wire fret-nut")}
                                        data-string={stringIdx}
                                        data-fret={0}
                                    >
                                        <StringLine thickness={stringThicknesses[stringIdx]} />
                                        <span
                                            className={cn(
                                                "relative z-10 text-[11px] font-semibold text-muted-foreground",
                                                leftHanded && "transform scale-x-[-1]"
                                            )}
                                        >
                                            {openNote}
                                        </span>
                                    </div>

                                    {/* Fretted notes 1..N */}
                                    {Array.from({ length: frets }).map((_, colIdx) => {
                                        const fretNum = colIdx + 1;
                                        const noteName = getNoteAt(openNote, fretNum);
                                        const position: Position = {
                                            stringIndex: stringIdx,
                                            fret: fretNum,
                                            note: noteName,
                                        };

                                        const noteStatus = activeNotes.find(
                                            (n) => n.position.stringIndex === stringIdx && n.position.fret === fretNum
                                        );

                                        return (
                                            <div
                                                key={`str-${stringIdx}-fr-${fretNum}`}
                                                className={cn(
                                                    "relative flex items-center justify-center fret-cell fret-wire",
                                                    fretNum === frets && "fret-wire--last"
                                                )}
                                                data-string={stringIdx}
                                                data-fret={fretNum}
                                            >
                                                <StringLine thickness={stringThicknesses[stringIdx]} />
                                                <NoteDot
                                                    position={position}
                                                    noteStatus={noteStatus}
                                                    onClick={onNoteClick}
                                                    showLabel={false}
                                                    leftHanded={leftHanded}
                                                />
                                            </div>
                                        );
                                    })}
                                </Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Fret numbers row (below, like original) */}
                    {showFretNumbers && (
                        <div className="grid mt-1" style={{ gridTemplateColumns: gridColumns }}>
                            <div />
                            {Array.from({ length: frets }).map((_, i) => {
                                const fret = i + 1;
                                const showNumber = isMarker(fret);
                                return (
                                    <div key={`num-${fret}`} className="text-center">
                                        {showNumber && (
                                            <span
                                                className={cn(
                                                    "text-[10px] md:text-xs text-muted-foreground font-mono",
                                                    leftHanded && "transform scale-x-[-1] inline-block"
                                                )}
                                            >
                                                {fret}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

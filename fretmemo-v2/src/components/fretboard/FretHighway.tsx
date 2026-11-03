import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteName, Position } from "@/types/fretboard";
import { cn } from "@/lib/utils";

const LANE_COUNT = 3; // visible falling lanes above the board
const MAX_FRET = 12; // matches the store's position picker range
const DEFAULT_TUNING: NoteName[] = ["E", "B", "G", "D", "A", "E"];

interface FretHighwayProps {
    /** The position arriving at the board this cycle. */
    target: Position | null;
    /** Positions queued after the target, nearest first. */
    upcoming: Position[];
    /** Milliseconds per metronome beat (drives the fall speed). */
    beatMs: number;
    /** Wall-clock stamp of the last beat, from `useGameStore.lastBeatAt`. */
    lastBeatAt: number | null;
    /** Whether the metronome is actually ticking; false freezes the lanes. */
    clockRunning?: boolean;
    /** True when the target cycle was answered (hit flash). */
    answered: boolean;
    /** True when the target cycle expired unanswered (miss flash). */
    missed: boolean;
    tuning?: NoteName[];
}

function fretToColumnPercent(fret: number, maxFret: number): number {
    return ((fret + 0.5) / (maxFret + 1)) * 100;
}

/**
 * Within-beat offset applied on top of each dot's static lane slot.
 * Rises linearly from 0 (top of the slot) to one lane height (touching the
 * next slot down), so a dot falls continuously and — because the queue
 * rotates at the beat boundary — the promoted dot re-enters at offset 0 of
 * the slot its predecessor just left without any visual jump.
 */
export function highwayFallOffset(fraction: number, laneHeightPx: number): number {
    const clamped = Math.min(1, Math.max(0, fraction));
    return clamped * laneHeightPx;
}

/**
 * Synthesia-style falling positions above a horizontal fretboard, for the
 * Tab Sequence drill. Each metronome beat moves every queued position one
 * lane down; the target lands on the board exactly on the cycle's last beat.
 *
 * Motion interpolates between beats with a requestAnimationFrame loop fed by
 * the store's `lastBeatAt` stamp, so visual drift is re-anchored every beat.
 * When the user prefers reduced motion the loop is skipped entirely and
 * positions snap lane by lane.
 */
export function FretHighway({
    target,
    upcoming,
    beatMs,
    lastBeatAt,
    clockRunning = true,
    answered,
    missed,
    tuning = DEFAULT_TUNING,
}: FretHighwayProps) {
    const laneAreaRef = useRef<HTMLDivElement | null>(null);
    const dotRefs = useRef<Array<HTMLDivElement | null>>([]);
    // Lazy init: reduced-motion users must never see the animation loop.
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(
        () =>
            typeof window !== "undefined" &&
            Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
    );

    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        setPrefersReducedMotion(media.matches);
        const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    // queue[0] is the next arrival after the target; render target + up to
    // LANE_COUNT upcoming dots (one per lane).
    const dots = useMemo(
        () => [target, ...upcoming.slice(0, LANE_COUNT)].filter(
            (position): position is Position => position !== null,
        ),
        [target, upcoming],
    );

    const beatClockRef = useRef({ beatMs, lastBeatAt, clockRunning });
    useEffect(() => {
        beatClockRef.current = { beatMs, lastBeatAt, clockRunning };
    }, [beatMs, lastBeatAt, clockRunning]);

    useEffect(() => {
        if (prefersReducedMotion) return;
        let frameId = 0;
        const applyPositions = () => {
            const { beatMs: ms, lastBeatAt: stamp, clockRunning: running } = beatClockRef.current;
            // Without a beating clock (metronome off) the lanes stay parked.
            const fraction =
                !running || stamp === null || ms <= 0
                    ? 0
                    : (Date.now() - stamp) / ms;
            const laneArea = laneAreaRef.current;
            const step = laneArea ? laneArea.clientHeight / (LANE_COUNT + 1) : 0;
            const offset = highwayFallOffset(fraction, step);
            dots.forEach((_, index) => {
                const dot = dotRefs.current[index];
                if (!dot) return;
                dot.style.transform = `translateY(${offset}px)`;
            });
            frameId = window.requestAnimationFrame(applyPositions);
        };
        frameId = window.requestAnimationFrame(applyPositions);
        return () => window.cancelAnimationFrame(frameId);
    }, [prefersReducedMotion, dots]);

    const targetFeedback = answered ? "hit" : missed ? "miss" : null;

    return (
        <div className="fret-highway" data-testid="fret-highway">
            {/* Decorative: the accessible data lives in the TabView cards below. */}
            <div className="fret-highway__lanes" ref={laneAreaRef} aria-hidden="true">
                {Array.from({ length: LANE_COUNT + 1 }, (_, lane) => (
                    <div
                        key={lane}
                        className="fret-highway__lane-line"
                        style={{ top: `${((lane + 1) / (LANE_COUNT + 1)) * 100}%` }}
                    />
                ))}
                {dots.map((position, index) => {
                    const isTarget = index === 0;
                    return (
                        <div
                            key={`${index}-${position.stringIndex}-${position.fret}`}
                            ref={(element) => { dotRefs.current[index] = element; }}
                            data-testid="fret-highway-dot"
                            data-fret={position.fret}
                            data-string={position.stringIndex}
                            className={cn(
                                "fret-highway__dot",
                                isTarget && targetFeedback === "hit" && "fret-highway__dot--hit",
                                isTarget && targetFeedback === "miss" && "fret-highway__dot--miss",
                            )}
                            style={{
                                left: `${fretToColumnPercent(position.fret, MAX_FRET)}%`,
                                // Static lane slots; rAF adds the within-beat fall offset.
                                top: `${((dots.length - index - 1) / (LANE_COUNT + 1)) * 100}%`,
                            }}
                        >
                            <span className="fret-highway__dot-fret">{position.fret}</span>
                            <span className="fret-highway__dot-string">s{position.stringIndex + 1}</span>
                        </div>
                    );
                })}
            </div>
            <div
                className="fret-highway__board"
                style={{ gridTemplateColumns: `repeat(${MAX_FRET + 1}, minmax(0, 1fr))` }}
            >
                {tuning.map((openNote, stringIndex) =>
                    Array.from({ length: MAX_FRET + 1 }, (_, fret) => {
                        const isLanding =
                            target !== null &&
                            target.stringIndex === stringIndex &&
                            target.fret === fret;
                        return (
                            <div
                                key={`${stringIndex}-${fret}`}
                                className={cn(
                                    "fret-highway__cell",
                                    fret === 0 && "fret-highway__cell--nut",
                                    isLanding && "fret-highway__cell--landing",
                                )}
                                {...(isLanding
                                    ? {
                                          "data-testid": "fret-highway-landing",
                                          "data-fret": fret,
                                          "data-string": stringIndex,
                                      }
                                    : {})}
                            >
                                {fret === 0 ? (
                                    <span className="fret-highway__open-note">{openNote}</span>
                                ) : null}
                            </div>
                        );
                    }),
                )}
            </div>
        </div>
    );
}

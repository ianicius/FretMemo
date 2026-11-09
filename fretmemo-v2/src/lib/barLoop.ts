/**
 * Bar-range loop helpers (roadmap R-04 §5.4: loop a 2–4 bar fragment).
 *
 * Pure conversions from a bar index range to playback windows: ticks for
 * alphaTab's native `api.playbackRange` (soundfont transport) and
 * milliseconds for our MultiTrackPlayback loop (guitar transport). The ms
 * walk follows tempo automations at bar starts — the same tempo map
 * alphaTab bakes into the exported audio buffers.
 */

/** alphaTab's fixed resolution: 960 ticks per quarter note. */
export const TICKS_PER_QUARTER = 960;

interface MasterBarLike {
    /** Start position in ticks (alphaTab maintains this on finish). */
    start: number;
    calculateDuration(): number;
    tempoAutomations: Array<{ type: number; value: number }>;
}

interface ScoreLike {
    tempo: number;
    masterBars: MasterBarLike[];
}

const TEMPO_AUTOMATION_TYPE = 0; // alphaTab AutomationType.Tempo

function assertRange(score: ScoreLike, startBar: number, endBar: number): void {
    const last = score.masterBars.length - 1;
    if (
        !Number.isInteger(startBar) || !Number.isInteger(endBar) ||
        startBar < 0 || endBar < 0 || startBar > endBar || startBar > last
    ) {
        throw new Error(`Invalid bar range: ${startBar}-${endBar}`);
    }
}

function clampEnd(score: ScoreLike, endBar: number): number {
    return Math.min(endBar, score.masterBars.length - 1);
}

/** Tick window {startTick, endTick} covering the bar range (inclusive). */
export function barRangeTicks(
    score: ScoreLike,
    startBar: number,
    endBar: number,
): { startTick: number; endTick: number } {
    assertRange(score, startBar, endBar);
    const end = clampEnd(score, endBar);
    const masterBar = score.masterBars[end];
    return {
        startTick: score.masterBars[startBar].start,
        endTick: masterBar.start + masterBar.calculateDuration(),
    };
}

function ticksToMs(ticks: number, tempoBpm: number): number {
    return (ticks * 60000) / (TICKS_PER_QUARTER * tempoBpm);
}

/**
 * Millisecond window {startMs, endMs} covering the bar range, walking the
 * tempo map from bar 0 so mid-song tempo changes are respected.
 */
export function barRangeToMsWindow(
    score: ScoreLike,
    startBar: number,
    endBar: number,
): { startMs: number; endMs: number } {
    assertRange(score, startBar, endBar);
    const end = clampEnd(score, endBar);
    let tempo = score.tempo || 120;
    let offsetMs = 0;
    let startMs: number | null = null;
    let endMs = 0;
    for (let index = 0; index <= end; index += 1) {
        const masterBar = score.masterBars[index];
        const automation = masterBar.tempoAutomations.find(
            (entry) => entry.type === TEMPO_AUTOMATION_TYPE,
        );
        if (automation) tempo = automation.value;
        const barMs = ticksToMs(masterBar.calculateDuration(), tempo);
        if (index === startBar) startMs = offsetMs;
        offsetMs += barMs;
        if (index === end) endMs = offsetMs;
    }
    return { startMs: startMs ?? 0, endMs };
}

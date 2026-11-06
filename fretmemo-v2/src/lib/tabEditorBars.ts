/**
 * Bar-structure operations (tab editor v1.1, roadmap R-07) on the live
 * alphaTab model: append, duplicate and remove bars plus score tempo.
 *
 * alphaTab keeps bar↔masterBar alignment by INDEX (`bar.masterBar` is a
 * getter resolving `staff.track.score.masterBars[bar.index]`) plus mutable
 * prev/next links and start positions. Appending can use the official
 * `addBar`/`addMasterBar` registration; any mid-list insert or removal must
 * splice AND relink — `relinkScore` re-stamps indices, both linked lists
 * and start offsets, then rebuilds the repeat groups. Callers still run
 * `score.finish(settings)` and refresh the API afterwards. Like
 * tabEditorUndo, these helpers dynamically import alphaTab.
 */

/** Internal shape of the alphaTab objects these ops touch. */
interface BarsScoreLike {
    masterBars: MasterBarLike[];
    tracks: Array<{ staves: StaffLike[] }>;
    rebuildRepeatGroups(): void;
    addMasterBar?(bar: MasterBarLike): void;
}

interface MasterBarLike {
    score?: unknown;
    index: number;
    previousMasterBar: MasterBarLike | null;
    nextMasterBar: MasterBarLike | null;
    start: number;
    isAnacrusis: boolean;
    timeSignatureNumerator: number;
    timeSignatureDenominator: number;
    tempoAutomations: Array<{
        type: number;
        isLinear: boolean;
        ratioPosition: number;
        value: number;
    }>;
    calculateDuration(): number;
}

interface StaffLike {
    bars: BarLike[];
    addBar?(bar: BarLike): void;
}

interface BarLike {
    staff?: unknown;
    index: number;
    previousBar: BarLike | null;
    nextBar: BarLike | null;
    voices: Array<{
        beats: Array<{
            duration: number;
            dots: number;
            isEmpty: boolean;
            notes: Array<{ string: number; fret: number }>;
        }>;
    }>;
}

type BarModel = Awaited<ReturnType<typeof loadModel>>;

async function loadModel() {
    const alphatab = await import("@coderline/alphatab");
    return alphatab.model;
}

/**
 * Re-stamps every structural back-reference after a mid-list splice:
 * masterBar chain (score/index/prev/next/start) and each staff's bar chain.
 */
function relinkScore(score: BarsScoreLike): void {
    let prevMasterBar: MasterBarLike | null = null;
    for (let i = 0; i < score.masterBars.length; i += 1) {
        const masterBar = score.masterBars[i];
        masterBar.index = i;
        masterBar.previousMasterBar = prevMasterBar;
        if (prevMasterBar) {
            prevMasterBar.nextMasterBar = masterBar;
            masterBar.start =
                prevMasterBar.start +
                (prevMasterBar.isAnacrusis ? 0 : prevMasterBar.calculateDuration());
        }
        prevMasterBar = masterBar;
    }
    if (prevMasterBar) prevMasterBar.nextMasterBar = null;

    for (const track of score.tracks) {
        for (const staff of track.staves) {
            let prevBar: BarLike | null = null;
            for (let i = 0; i < staff.bars.length; i += 1) {
                const bar = staff.bars[i];
                bar.staff = staff;
                bar.index = i;
                bar.previousBar = prevBar;
                if (prevBar) prevBar.nextBar = bar;
                prevBar = bar;
            }
            if (prevBar) prevBar.nextBar = null;
        }
    }
    score.rebuildRepeatGroups();
}

function assertBarIndex(score: BarsScoreLike, barIndex: number): void {
    if (!Number.isInteger(barIndex) || barIndex < 0 || barIndex >= score.masterBars.length) {
        throw new Error(`Bar index out of range: ${barIndex}`);
    }
}

/** Deep-copies beats/notes so the duplicate is fully independent. */
function cloneBar(bar: BarLike, model: BarModel): BarLike {
    const copy = new model.Bar();
    for (const voice of bar.voices) {
        const voiceCopy = new model.Voice();
        for (const beat of voice.beats) {
            const beatCopy = new model.Beat();
            beatCopy.duration = beat.duration;
            beatCopy.dots = beat.dots;
            beatCopy.isEmpty = beat.isEmpty;
            for (const note of beat.notes) {
                const noteCopy = new model.Note();
                noteCopy.string = note.string;
                noteCopy.fret = note.fret;
                beatCopy.addNote(noteCopy);
            }
            voiceCopy.addBeat(beatCopy);
        }
        copy.addVoice(voiceCopy);
    }
    return copy;
}

function cloneMasterBar(masterBar: MasterBarLike, model: BarModel): MasterBarLike {
    const copy = new model.MasterBar();
    copy.timeSignatureNumerator = masterBar.timeSignatureNumerator;
    copy.timeSignatureDenominator = masterBar.timeSignatureDenominator;
    for (const automation of masterBar.tempoAutomations) {
        const auto = new model.Automation();
        auto.type = automation.type;
        auto.isLinear = automation.isLinear;
        auto.ratioPosition = automation.ratioPosition;
        auto.value = automation.value;
        copy.tempoAutomations.push(auto);
    }
    return copy;
}

/** Index of the appended bar (the new last bar). */
export async function appendEmptyBar(score: BarsScoreLike): Promise<number> {
    const model = await loadModel();
    const lastMasterBar = score.masterBars[score.masterBars.length - 1];
    if (!lastMasterBar) {
        throw new Error("Score has no master bars");
    }

    const masterBar = cloneMasterBar(lastMasterBar, model);
    // addMasterBar registers score/index/linked-list/start + repeat groups.
    if (!score.addMasterBar) {
        throw new Error("alphaTab score has no addMasterBar");
    }
    score.addMasterBar(masterBar as never);

    for (const track of score.tracks) {
        for (const staff of track.staves) {
            const bar = new model.Bar();
            const voice = new model.Voice();
            const beat = new model.Beat();
            beat.duration = model.Duration.Quarter;
            beat.isEmpty = true;
            voice.addBeat(beat);
            bar.addVoice(voice);
            // addBar registers the staff backref + index + linked list —
            // a plain push would leave the bar invisible to score.finish.
            if (!staff.addBar) {
                throw new Error("alphaTab staff has no addBar");
            }
            staff.addBar(bar as never);
        }
    }
    score.rebuildRepeatGroups();
    return score.masterBars.length - 1;
}

/** Index of the inserted copy (right after the source bar). */
export async function duplicateBarAt(score: BarsScoreLike, barIndex: number): Promise<number> {
    const model = await loadModel();
    assertBarIndex(score, barIndex);

    score.masterBars.splice(barIndex + 1, 0, cloneMasterBar(score.masterBars[barIndex], model));
    for (const track of score.tracks) {
        for (const staff of track.staves) {
            const bar = staff.bars[barIndex];
            if (bar) {
                staff.bars.splice(barIndex + 1, 0, cloneBar(bar, model));
            }
        }
    }
    relinkScore(score);
    return barIndex + 1;
}

export function removeBarAt(score: BarsScoreLike, barIndex: number): void {
    assertBarIndex(score, barIndex);
    if (score.masterBars.length <= 1) {
        throw new Error("Cannot remove the last remaining bar");
    }

    score.masterBars.splice(barIndex, 1);
    for (const track of score.tracks) {
        for (const staff of track.staves) {
            if (barIndex < staff.bars.length) {
                staff.bars.splice(barIndex, 1);
            }
        }
    }
    relinkScore(score);
}

const TEMPO_AUTOMATION_TYPE = 0; // alphaTab AutomationType.Tempo

export function setScoreTempo(score: BarsScoreLike, bpm: number): void {
    if (!Number.isFinite(bpm) || bpm < 10 || bpm > 400) {
        throw new Error(`Invalid tempo: ${bpm}`);
    }
    const first = score.masterBars[0];
    if (!first) {
        throw new Error("Score has no master bars");
    }
    const existing = first.tempoAutomations.find(
        (automation) => automation.type === TEMPO_AUTOMATION_TYPE,
    );
    if (existing) {
        existing.value = bpm;
        existing.isLinear = true;
        existing.ratioPosition = 0;
        return;
    }
    first.tempoAutomations.push({
        type: TEMPO_AUTOMATION_TYPE,
        isLinear: true,
        ratioPosition: 0,
        value: bpm,
    });
}

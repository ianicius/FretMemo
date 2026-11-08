import { describe, expect, it } from "vitest";
import { model, Settings } from "@coderline/alphatab";
import {
    appendEmptyBar,
    duplicateBarAt,
    removeBarAt,
    setScoreTempo,
} from "../tabEditorBars";

/** Builds a two-bar single-track score; bar 0 carries one fretted note. */
function makeScore(barCount = 2) {
    const score = new model.Score();
    const track = new model.Track();
    const staff = new model.Staff();
    for (let i = 0; i < barCount; i += 1) {
        const bar = new model.Bar();
        const voice = new model.Voice();
        const beat = new model.Beat();
        beat.duration = model.Duration.Quarter;
        if (i === 0) {
            const note = new model.Note();
            note.string = 1;
            note.fret = 5;
            beat.addNote(note);
        } else {
            beat.isEmpty = true;
        }
        voice.addBeat(beat);
        bar.addVoice(voice);
        staff.addBar(bar);
        score.addMasterBar(new model.MasterBar());
    }
    track.addStaff(staff);
    score.addTrack(track);
    score.finish(new Settings());
    return score;
}

describe("tabEditorBars — appendEmptyBar", () => {
    it("appends a bar and master bar in sync, keeping structure finished", async () => {
        const score = makeScore();
        const barIndex = await appendEmptyBar(score);
        expect(barIndex).toBe(2);
        expect(score.tracks[0].staves[0].bars).toHaveLength(3);
        expect(score.masterBars).toHaveLength(3);
        // New bar holds one empty (rest) beat per staff.
        const newBar = score.tracks[0].staves[0].bars[2];
        expect(newBar.voices[0].beats).toHaveLength(1);
        expect(newBar.voices[0].beats[0].isEmpty).toBe(true);
        expect(() => score.finish(new Settings())).not.toThrow();
    });

    it("copies the time signature of the last master bar", async () => {
        const score = makeScore();
        score.masterBars[score.masterBars.length - 1].timeSignatureNumerator = 7;
        score.masterBars[score.masterBars.length - 1].timeSignatureDenominator = 8;
        await appendEmptyBar(score);
        const last = score.masterBars[score.masterBars.length - 1];
        expect(last.timeSignatureNumerator).toBe(7);
        expect(last.timeSignatureDenominator).toBe(8);
    });

    it("works on multi-track scores (one bar per staff)", async () => {
        const score = makeScore();
        const track2 = new model.Track();
        const staff2 = new model.Staff();
        staff2.addBar(new model.Bar());
        track2.addStaff(staff2);
        score.addTrack(track2);
        score.finish(new Settings());

        await appendEmptyBar(score);
        expect(score.masterBars).toHaveLength(3);
        expect(score.tracks[0].staves[0].bars).toHaveLength(3);
        expect(score.tracks[1].staves[0].bars).toHaveLength(2);
    });
});

describe("tabEditorBars — duplicateBarAt", () => {
    it("duplicates notes into a new bar right after the source", async () => {
        const score = makeScore();
        const newIndex = await duplicateBarAt(score, 0);
        expect(newIndex).toBe(1);
        const staff = score.tracks[0].staves[0];
        expect(staff.bars).toHaveLength(3);
        expect(score.masterBars).toHaveLength(3);
        // Copy carries the original note; original untouched.
        const copy = staff.bars[1];
        const original = staff.bars[0];
        expect(copy).not.toBe(original);
        expect(copy.voices[0].beats[0].notes[0].fret).toBe(5);
        expect(copy.voices[0].beats[0].notes[0]).not.toBe(original.voices[0].beats[0].notes[0]);
        expect(original.voices[0].beats[0].notes).toHaveLength(1);
        expect(() => score.finish(new Settings())).not.toThrow();
    });

    it("rejects an out-of-range bar index", async () => {
        const score = makeScore();
        await expect(duplicateBarAt(score, 5)).rejects.toThrow();
    });
});

describe("tabEditorBars — removeBarAt", () => {
    it("removes the bar and master bar from every staff", () => {
        const score = makeScore();
        const staff = score.tracks[0].staves[0];
        const noteCountBefore = staff.bars[0].voices[0].beats[0].notes.length;
        expect(noteCountBefore).toBe(1);

        removeBarAt(score, 1);
        expect(staff.bars).toHaveLength(1);
        expect(score.masterBars).toHaveLength(1);
        // Bar 0 with its note survives.
        expect(staff.bars[0].voices[0].beats[0].notes[0].fret).toBe(5);
        expect(() => score.finish(new Settings())).not.toThrow();
    });

    it("keeps reindexed bars aligned after removing the first bar", () => {
        const score = makeScore(3);
        removeBarAt(score, 0);
        const staff = score.tracks[0].staves[0];
        expect(staff.bars).toHaveLength(2);
        expect(score.masterBars).toHaveLength(2);
        expect(() => score.finish(new Settings())).not.toThrow();
    });

    it("refuses to remove the last remaining bar", () => {
        const score = makeScore(1);
        expect(() => removeBarAt(score, 0)).toThrow();
        expect(score.masterBars).toHaveLength(1);
    });

    it("rejects an out-of-range bar index", () => {
        const score = makeScore();
        expect(() => removeBarAt(score, 9)).toThrow();
    });
});

describe("tabEditorBars — setScoreTempo", () => {
    it("sets the tempo on the first master bar and reads back via score.tempo", () => {
        const score = makeScore();
        setScoreTempo(score, 145);
        expect(score.tempo).toBe(145);
        expect(() => score.finish(new Settings())).not.toThrow();
    });

    it("updates an existing tempo automation instead of stacking new ones", () => {
        const score = makeScore();
        setScoreTempo(score, 100);
        setScoreTempo(score, 160);
        const automations = score.masterBars[0].tempoAutomations.filter(
            (a) => a.type === 0,
        );
        expect(automations).toHaveLength(1);
        expect(automations[0].value).toBe(160);
    });
});

describe("tabEditorBars — setTimeSignatureAt", () => {
    it("sets the meter on the target master bar only", async () => {
        const score = makeScore();
        await import("../tabEditorBars").then(({ setTimeSignatureAt }) =>
            setTimeSignatureAt(score, 1, 6, 8),
        );
        expect(score.masterBars[0].timeSignatureNumerator).toBe(4);
        expect(score.masterBars[1].timeSignatureNumerator).toBe(6);
        expect(score.masterBars[1].timeSignatureDenominator).toBe(8);
        expect(() => score.finish(new Settings())).not.toThrow();
    });

    it("rejects invalid numerators and non-power-of-two denominators", async () => {
        const score = makeScore();
        const { setTimeSignatureAt } = await import("../tabEditorBars");
        expect(() => setTimeSignatureAt(score, 0, 0, 4)).toThrow();
        expect(() => setTimeSignatureAt(score, 0, 13, 4)).toThrow();
        expect(() => setTimeSignatureAt(score, 0, 4, 3)).toThrow();
        expect(() => setTimeSignatureAt(score, 0, 4, 7)).toThrow();
        expect(() => setTimeSignatureAt(score, 9, 4, 4)).toThrow();
    });
});

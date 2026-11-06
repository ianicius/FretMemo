import { describe, expect, it } from "vitest";
import { model, Settings } from "@coderline/alphatab";
import {
    addNoteToString,
    beatSummary,
    clearBeat,
    removeNoteFromString,
    setBeatDuration,
    setNoteFret,
} from "../tabEditor";

/** Builds a quarter beat on a 6-string guitar with one note: string 1 (low), fret 0. */
function makeBeat(fret = 0, string = 1): model.Beat {
    const beat = new model.Beat();
    const note = new model.Note();
    note.string = string;
    note.fret = fret;
    beat.duration = model.Duration.Quarter;
    beat.addNote(note);
    return beat;
}

function makeNote() {
    return new model.Note();
}

describe("tabEditor — setNoteFret", () => {
    it("changes the fret of the note on the given string", () => {
        const beat = makeBeat(0, 1);
        setNoteFret(beat, 1, 5);
        expect(beat.notes[0].fret).toBe(5);
        expect(beat.getNoteOnString(1)?.fret).toBe(5);
    });

    it("throws when the string has no note", () => {
        const beat = makeBeat(0, 1);
        expect(() => setNoteFret(beat, 3, 7)).toThrow();
    });

    it("rejects negative frets", () => {
        const beat = makeBeat(0, 1);
        expect(() => setNoteFret(beat, 1, -1)).toThrow();
    });
});

describe("tabEditor — addNoteToString / removeNoteFromString", () => {

    it("adds a note on a free string and keeps the lookup consistent", () => {
        const beat = makeBeat(0, 1);
        addNoteToString(beat, 4, 7, makeNote);
        expect(beat.notes).toHaveLength(2);
        expect(beat.getNoteOnString(4)?.fret).toBe(7);
    });

    it("adds a real model.Note that survives score.finish", () => {
        // Regression (review P1): a plain object instead of model.Note makes
        // score.finish throw "n.chain is not a function".
        const score = new model.Score();
        const track = new model.Track();
        const staff = new model.Staff();
        const bar = new model.Bar();
        const voice = new model.Voice();
        const beat = new model.Beat();
        beat.duration = model.Duration.Quarter;
        voice.addBeat(beat);
        bar.addVoice(voice);
        staff.addBar(bar);
        track.addStaff(staff);
        score.addTrack(track);
        score.addMasterBar(new model.MasterBar());

        addNoteToString(beat, 4, 7, makeNote);
        expect(() => score.finish(new Settings())).not.toThrow();
    });

    it("throws when adding to an occupied string", () => {
        const beat = makeBeat(0, 1);
        expect(() => addNoteToString(beat, 1, 3, makeNote)).toThrow();
    });

    it("removes a note and clears the string lookup", () => {
        const beat = makeBeat(0, 1);
        addNoteToString(beat, 4, 7, makeNote);
        removeNoteFromString(beat, 1);
        expect(beat.notes).toHaveLength(1);
        expect(beat.getNoteOnString(1)).toBeNull();
    });

    it("throws when removing from a string without a note", () => {
        const beat = makeBeat(0, 1);
        expect(() => removeNoteFromString(beat, 2)).toThrow();
    });
});

describe("tabEditor — clearBeat (rest)", () => {
    it("removes all notes leaving an empty (rest) beat", () => {
        const beat = makeBeat(0, 1);
        addNoteToString(beat, 4, 7, makeNote);
        clearBeat(beat);
        expect(beat.notes).toHaveLength(0);
        expect(beat.isRest).toBe(true);
        expect(beat.isEmpty).toBe(true);
    });
});

describe("tabEditor — setBeatDuration", () => {
    it("sets duration and dots then recalculates via updateDurations", () => {
        const beat = makeBeat(0, 1);
        setBeatDuration(beat, model.Duration.Eighth, 1);
        expect(beat.duration).toBe(model.Duration.Eighth);
        expect(beat.dots).toBe(1);
        expect(beat.playbackDuration).toBeGreaterThan(0);
    });

    it("rejects unknown duration values", () => {
        const beat = makeBeat(0, 1);
        expect(() => setBeatDuration(beat, 3 as unknown as model.Duration, 0)).toThrow();
    });
});

describe("tabEditor — beatSummary", () => {
    it("summarizes frets per string (1-based, null when empty)", () => {
        const beat = makeBeat(0, 1);
        addNoteToString(beat, 4, 7, makeNote);
        const summary = beatSummary(beat, 6);
        expect(summary[0]).toBe(0);
        expect(summary[3]).toBe(7);
        expect(summary[1]).toBeNull();
        expect(summary[5]).toBeNull();
    });
});

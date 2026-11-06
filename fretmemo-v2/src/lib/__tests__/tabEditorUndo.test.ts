import { describe, expect, it } from "vitest";
import { model } from "@coderline/alphatab";
import { restoreScoreSnapshot, snapshotScoreAsync } from "../tabEditorUndo";
import { clearBeat } from "../tabEditor";

/** Builds a minimal score: 1 track, 1 staff, 2 bars, 1 note each. */
function makeScore(): model.Score {
    const score = new model.Score();
    const track = new model.Track();
    const staff = new model.Staff();
    track.addStaff(staff);
    score.addTrack(track);
    for (let i = 0; i < 2; i += 1) {
        const bar = new model.Bar();
        const voice = new model.Voice();
        const beat = new model.Beat();
        const note = new model.Note();
        note.string = 1;
        note.fret = i;
        beat.duration = model.Duration.Quarter;
        beat.addNote(note);
        voice.addBeat(beat);
        bar.addVoice(voice);
        staff.addBar(bar);
        score.addMasterBar(new model.MasterBar());
    }
    return score;
}

describe("tabEditorUndo", () => {
    it("snapshot returns JSON text; restore round-trips structure", async () => {
        const score = makeScore();
        const snapshot = await snapshotScoreAsync(score);
        expect(typeof snapshot).toBe("string");

        // Mutate the live model, then restore the snapshot.
        const beat = score.tracks[0].staves[0].bars[0].voices[0].beats[0];
        clearBeat(beat as never);
        expect(beat.isRest).toBe(true);

        const restored = (await restoreScoreSnapshot(snapshot)) as model.Score;
        expect(restored.tracks.length).toBe(1);
        const restoredBeat =
            restored.tracks[0].staves[0].bars[0].voices[0].beats[0];
        expect(restoredBeat.notes.length).toBe(1);
        expect(restoredBeat.notes[0].fret).toBe(0);
    });
});

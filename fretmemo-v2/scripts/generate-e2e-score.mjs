/**
 * E2E smoke score for the tab editor (R-07).
 *
 * Builds a small GP file deterministically:
 *  - 1 guitar track, 6 strings, standard tuning
 *  - 2 bars, quarter notes
 *  - bar 1 beat 1: single note on string 1 fret 0  → strings 2..6 EMPTY
 *    (lets the E2E verify the add-note-on-empty-string path end to end)
 *  - bar 1 beat 2: note on string 4 fret 3 (fret-edit target)
 *  - bar 2: two notes for playback sanity
 *
 * Usage: node scripts/generate-e2e-score.mjs  → public/e2e-smoke.gp
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { model, Settings, exporter } from "@coderline/alphatab";

const score = new model.Score();
score.title = "E2E Smoke";

const track = new model.Track();
track.name = "Guitar";
const staff = new model.Staff();
staff.stringTuning = model.Tuning.getDefaultTuningFor(6);

function addBar(beatDefs) {
    const bar = new model.Bar();
    const voice = new model.Voice();
    for (const def of beatDefs) {
        const beat = new model.Beat();
        beat.duration = model.Duration.Quarter;
        for (const [string, fret] of def) {
            const note = new model.Note();
            note.string = string;
            note.fret = fret;
            beat.addNote(note);
        }
        voice.addBeat(beat);
    }
    bar.addVoice(voice);
    staff.addBar(bar);
    score.addMasterBar(new model.MasterBar());
}

// Bar 1: beat 1 = one note (strings 2-6 empty), beat 2 = fret-edit target.
addBar([
    [[1, 0]],
    [[4, 3]],
    [],
    [],
]);
// Bar 2: playback sanity.
addBar([
    [[2, 5]],
    [[3, 7]],
    [],
    [],
]);

track.addStaff(staff);
score.addTrack(track);
score.finish(new Settings());

const bytes = new exporter.Gp7Exporter().export(score);
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "e2e-smoke.gp");
writeFileSync(out, bytes);
console.log(`Wrote ${out} (${bytes.length} bytes)`);

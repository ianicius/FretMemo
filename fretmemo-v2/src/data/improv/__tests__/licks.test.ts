import { describe, expect, it } from "vitest";
import { Chord, Note, Scale } from "tonal";
import { LICKS, LICK_MAX_FRET, lickNoteMidi, lickNoteName, lickShift } from "../licks";
import { CURRICULUM, type BackingLoopParams, type LickParams } from "../curriculum";

const chroma = (midi: number) => midi % 12;
const pcs = (notes: string[]) => new Set(notes.map((note) => Note.chroma(note)));

describe("plan D2: licks", () => {
    it("has ten licks, each used by exactly one module", () => {
        const used = CURRICULUM.flatMap((module) => module.exercises)
            .filter((exercise) => exercise.engine === "lick")
            .flatMap((exercise) => (exercise.params as LickParams).lickIds);
        expect(LICKS).toHaveLength(10);
        expect([...used].sort()).toEqual(LICKS.map((lick) => lick.id).sort());
    });

    it("keeps every note in its scale or chord, and the last note on the landing chord", () => {
        for (const lick of LICKS) {
            const allowed = "scale" in lick.fits ? pcs(Scale.get(lick.fits.scale).notes) : pcs(Chord.get(lick.fits.chord).notes);
            expect(allowed.size, lick.id).toBeGreaterThan(2);
            for (const note of lick.notes) {
                expect(allowed.has(chroma(lickNoteMidi(note))), `${lick.id} ${note.join("/")}`).toBe(true);
                expect(note[0]).toBeGreaterThanOrEqual(1);
                expect(note[0]).toBeLessThanOrEqual(6);
                expect(note[2]).toBeGreaterThan(0);
            }
            if (lick.landsOn) {
                const last = lick.notes[lick.notes.length - 1];
                expect(pcs(Chord.get(lick.landsOn).notes).has(chroma(lickNoteMidi(last))), lick.id).toBe(true);
            }
        }
    });

    it("transposes into every key within the board", () => {
        for (const lick of LICKS) {
            const original = Note.chroma(lick.key.replace(/m$/, "")) as number;
            for (let target = 0; target < 12; target += 1) {
                const shift = lickShift(lick, original, target);
                for (const [, fret] of lick.notes) {
                    expect(fret + shift, `${lick.id} to ${target}`).toBeGreaterThanOrEqual(0);
                    expect(fret + shift, `${lick.id} to ${target}`).toBeLessThanOrEqual(LICK_MAX_FRET);
                }
            }
        }
        // Same key = no shift.
        expect(lickNoteName([3, 8, 1], "Am")).toBe("Eb");
        expect(lickNoteName([3, 6, 1], "Em")).toBe("C#");
        expect(lickNoteName([1, 6, 1], "Gm")).toBe("Bb");
        expect(lickShift(LICKS[0], 9, 9)).toBe(0);
    });

    it("D3: the lick loops are extras and name a lick on the bars where it is played", () => {
        for (const [moduleId, suffix] of [["pentatonic-scale", "e9"], ["target-chord-tones", "e6"]] as const) {
            const exercise = CURRICULUM.find((module) => module.id === moduleId)?.exercises.find((item) => item.id === `${moduleId}.${suffix}`);
            const params = exercise?.params as BackingLoopParams;
            expect(params.nonGating, suffix).toBe(true);
            const hints = params.progression.map((entry) => (typeof entry === "string" ? "" : entry.hintKey));
            expect(hints.filter((hint) => hint?.startsWith("improv.hints.lick") && hint !== "improv.hints.lickOwn")).toHaveLength(2);
        }
    });
});

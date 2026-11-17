import { describe, expect, it } from "vitest";
import { Chord, Note, Scale } from "tonal";
import { LICKS, LICK_MAX_FRET, lickBeat, lickOrderLabel, lickNoteMidi, lickNoteName, lickShift, lickSoundingMidi, lickTechMark } from "../licks";
import { CURRICULUM, type BackingLoopParams, type LickParams } from "../curriculum";
import { ALL_MODULES } from "../tracks";

const chroma = (midi: number) => midi % 12;
const pcs = (notes: string[]) => new Set(notes.map((note) => Note.chroma(note)));

describe("plan D2: licks", () => {
    it("uses every lick in exactly one module, across all tracks", () => {
        const used = ALL_MODULES.flatMap((module) => module.exercises)
            .filter((exercise) => exercise.engine === "lick")
            .flatMap((exercise) => (exercise.params as LickParams).lickIds);
        expect(LICKS.length).toBeGreaterThanOrEqual(10);
        expect([...used].sort()).toEqual(LICKS.map((lick) => lick.id).sort());
    });

    it("keeps every note in its scale or chord, and the last note on the landing chord", () => {
        for (const lick of LICKS) {
            const allowed = "scale" in lick.fits
                ? pcs([lick.fits.scale].flat().flatMap((scale) => Scale.get(scale).notes))
                : pcs(Chord.get(lick.fits.chord).notes);
            expect(allowed.size, lick.id).toBeGreaterThan(2);
            for (const note of lick.notes) {
                // A bent note is judged by the pitch it reaches; a double stop by both notes.
                expect(allowed.has(chroma(lickSoundingMidi(note))), `${lick.id} ${note[0]}/${note[1]}`).toBe(true);
                if (note[3]?.also) expect(allowed.has(chroma(lickNoteMidi(note[3].also))), `${lick.id} also`).toBe(true);
                expect(note[0]).toBeGreaterThanOrEqual(1);
                expect(note[0]).toBeLessThanOrEqual(6);
                expect(note[2]).toBeGreaterThan(0);
            }
            if (lick.landsOn) {
                const last = lick.notes[lick.notes.length - 1];
                expect(pcs(Chord.get(lick.landsOn).notes).has(chroma(lickSoundingMidi(last))), lick.id).toBe(true);
            }
        }
    });

    it("transposes into every key within the board", () => {
        for (const lick of LICKS) {
            const original = Note.chroma(lick.key.replace(/m$/, "")) as number;
            for (let target = 0; target < 12; target += 1) {
                const shift = lickShift(lick, original, target);
                for (const [, fret, , mods] of lick.notes) {
                    for (const position of [fret, ...(mods?.also ? [mods.also[1]] : [])]) {
                        expect(position + shift, `${lick.id} to ${target}`).toBeGreaterThanOrEqual(0);
                        expect(position + shift, `${lick.id} to ${target}`).toBeLessThanOrEqual(LICK_MAX_FRET);
                    }
                }
            }
        }
        // Same key = no shift.
        expect(lickNoteName([3, 8, 1], "Am")).toBe("Eb");
        expect(lickNoteName([3, 6, 1], "Em")).toBe("C#");
        expect(lickNoteName([1, 6, 1], "Gm")).toBe("Bb");
        expect(lickShift(LICKS[0], 9, 9)).toBe(0);
    });

    it("times shuffle eighths long–short and reads bends", () => {
        expect([lickOrderLabel([0]), lickOrderLabel([1, 5]), lickOrderLabel([0, 1, 2, 3, 4, 5, 6, 7]), lickOrderLabel([0, 1, 4, 5])])
            .toEqual(["1", "2·6", "1–8", "1–2·5–6"]);
        expect(lickBeat(3)).toBe(1.5);
        expect(lickBeat(0, "shuffle")).toBe(0);
        expect(lickBeat(1, "shuffle")).toBeCloseTo(2 / 3);
        expect(lickBeat(2, "shuffle")).toBeCloseTo(1);
        expect(lickBeat(3, "shuffle")).toBeCloseTo(1 + 2 / 3);
        // A whole-step bend sounds two frets up; a quarter-tone curl stays on the fretted note.
        expect(lickSoundingMidi([3, 7, 2, { bend: 2 }])).toBe(lickNoteMidi([3, 9, 2]));
        expect(lickSoundingMidi([3, 5, 2, { bend: 0.5 }])).toBe(lickNoteMidi([3, 5, 2]));
        expect([lickTechMark({ bend: 2 }), lickTechMark({ bend: 1 }), lickTechMark({ bend: 0.5 }), lickTechMark({ tech: "v" }), lickTechMark(undefined)])
            .toEqual(["1↑", "½↑", "¼↑", "~", ""]);
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

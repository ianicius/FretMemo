import { describe, expect, it } from "vitest";
import { Interval, Note } from "tonal";
import { CURRICULUM, type BackingLoopParams, type ChordMicTargets, type ProgressionEntry } from "@/data/improv/curriculum";
import { getChordPitchClasses } from "../chords";
import {
    RAMP_EVERY_PASSES,
    RAMP_STEP_BPM,
    keyChoices,
    keyPitchClass,
    keyShiftInterval,
    loopChordReport,
    loopKey,
    rampBpmAfterPass,
    transposeChord,
    transposeProgression,
    transposeTargets,
} from "../loopTools";

const chordOf = (entry: string | ProgressionEntry) => (typeof entry === "string" ? entry : entry.chord);
const rootPc = (chord: string) => Note.chroma(/^[A-G][#b]?/.exec(chord)?.[0] ?? "") as number;
const mod12 = (value: number) => ((value % 12) + 12) % 12;

/** Every loop of the curriculum: the base progression and each variant, with its targets. */
function allLoops(): Array<{ id: string; progression: Array<string | ProgressionEntry>; targets?: ChordMicTargets[] }> {
    const loops: Array<{ id: string; progression: Array<string | ProgressionEntry>; targets?: ChordMicTargets[] }> = [];
    for (const module of CURRICULUM) {
        for (const exercise of module.exercises) {
            if (exercise.engine !== "backing-improv") continue;
            const params = exercise.params as BackingLoopParams;
            loops.push({ id: exercise.id, progression: params.progression, targets: params.targets });
            for (const variant of params.variants ?? []) {
                loops.push({ id: `${exercise.id}#${variant.id}`, progression: variant.progression, targets: variant.targets ?? params.targets });
            }
        }
    }
    return loops;
}

describe("loop transposition (plan B2)", () => {
    it("all curriculum loops × 11 shifts keep chord-root intervals, chord qualities and chord-to-target intervals", () => {
        const loops = allLoops();
        expect(loops.length).toBeGreaterThan(30);
        for (let shift = 1; shift <= 11; shift += 1) {
            const interval = Interval.fromSemitones(shift);
            for (const loop of loops) {
                const original = loop.progression.map(chordOf);
                const moved = transposeProgression(loop.progression, interval).map(chordOf);
                expect(moved).toHaveLength(original.length);
                original.forEach((chord, index) => {
                    const next = moved[index] as string;
                    // Root moves by exactly `shift`; so all root-to-root intervals are preserved.
                    expect(mod12(rootPc(next) - rootPc(chord)), `${loop.id} ${chord}→${next}`).toBe(shift);
                    // Same chord quality: the chord tones relative to the root are unchanged.
                    const shape = (symbol: string) => getChordPitchClasses(symbol).map((pc) => mod12(pc - rootPc(symbol)));
                    expect(shape(next), `${loop.id} ${next}`).toEqual(shape(chord));
                    // Per-entry metadata survives.
                    const sourceEntry = loop.progression[index];
                    const movedEntry = transposeProgression(loop.progression, interval)[index];
                    if (typeof sourceEntry !== "string" && typeof movedEntry !== "string") {
                        expect({ ...movedEntry, chord: sourceEntry?.chord }).toEqual(sourceEntry);
                    }
                });
                for (let index = 1; index < original.length; index += 1) {
                    expect(mod12(rootPc(moved[index] as string) - rootPc(moved[index - 1] as string)))
                        .toBe(mod12(rootPc(original[index] as string) - rootPc(original[index - 1] as string)));
                }
                const movedTargets = transposeTargets(loop.targets, interval);
                (loop.targets ?? []).forEach((target, index) => {
                    const movedTarget = movedTargets?.[index] as ChordMicTargets;
                    // The transposed target still points at a chord of the transposed loop…
                    expect(moved, `${loop.id} target ${movedTarget.chord}`).toContain(movedTarget.chord);
                    // …and keeps its interval above that chord's root.
                    target.pitchClasses.forEach((pitchClass, pcIndex) => {
                        expect(mod12((Note.chroma(movedTarget.pitchClasses[pcIndex] as string) as number) - rootPc(movedTarget.chord)))
                            .toBe(mod12((Note.chroma(pitchClass) as number) - rootPc(target.chord)));
                    });
                });
            }
        }
    });

    it("the key selector shifts by the interval between the two tonics (module 9 C → F)", () => {
        expect(loopKey("C", "Dm7")).toBe("C");
        expect(loopKey(undefined, "Am7")).toBe("Am");
        expect(loopKey(undefined, "A7")).toBe("A");
        const interval = keyShiftInterval("C", "F");
        expect(interval).toBe("4P");
        expect(["Dm7", "G7", "Cmaj7"].map((chord) => transposeChord(chord, interval))).toEqual(["Gm7", "C7", "Fmaj7"]);
        expect(keyShiftInterval("Am", "Am")).toBe("1P");
        expect(transposeChord("Am(maj7)", keyShiftInterval("Am", "Cm"))).toBe("Cm(maj7)");
        expect(keyChoices("Am")).toHaveLength(12);
        expect(keyChoices("Am").every((key) => key.endsWith("m"))).toBe(true);
        keyChoices("C").forEach((key, pc) => expect(keyPitchClass(key)).toBe(pc));
    });
});

describe("per-chord loop report (plan B3)", () => {
    it("lists every chord of the loop in order with its hit/miss", () => {
        expect(loopChordReport(["Am", "C", "Em", "D"], [true, false, true])).toEqual([
            { chord: "Am", hit: true },
            { chord: "C", hit: false },
            { chord: "Em", hit: true },
            { chord: "D", hit: false },
        ]);
        // Repeated chords (12-bar blues) keep one row per bar.
        expect(loopChordReport(["A7", "A7", "D7"], [false, true, false]).map((row) => row.hit)).toEqual([false, true, false]);
    });
});

describe("tempo ramp (plan B5)", () => {
    it("adds 5 BPM after every second successful loop and never exceeds maxBpm", () => {
        expect(RAMP_STEP_BPM).toBe(5);
        expect(RAMP_EVERY_PASSES).toBe(2);
        let bpm = 80;
        const history: number[] = [];
        for (let pass = 1; pass <= 12; pass += 1) {
            bpm = rampBpmAfterPass(bpm, pass, 100);
            history.push(bpm);
            expect(bpm).toBeLessThanOrEqual(100);
        }
        expect(history).toEqual([80, 85, 85, 90, 90, 95, 95, 100, 100, 100, 100, 100]);
        expect(rampBpmAfterPass(158, 2, 160)).toBe(160);
        expect(rampBpmAfterPass(160, 4, 160)).toBe(160);
        expect(rampBpmAfterPass(80, 0, 160)).toBe(80);
    });
});

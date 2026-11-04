import { describe, expect, it } from "vitest";
import { buildChordTimeline, deriveChordFromBar } from "../chords";

/* Structural fakes mirroring the alphaTab model fields the builder touches:
   track.staves[].bars[] → bar.voices[].beats[] → beat.chordId / beat.chord.name
   and beat.notes[].realValue (midi) for the derivation path. */

type FakeNote = { realValue: number };
type FakeBeat = {
    chordId: string | null;
    chord: { name: string } | null;
    notes: FakeNote[];
};
type FakeVoice = { beats: FakeBeat[] };
type FakeBar = { voices: FakeVoice[] };
type FakeStaff = { bars: FakeBar[]; chords: Record<string, { name: string }> | null };

function beat(options: Partial<FakeBeat> = {}): FakeBeat {
    return {
        chordId: options.chordId ?? null,
        chord: options.chord ?? null,
        notes: options.notes ?? [],
    };
}

function bar(beats: FakeBeat[]): FakeBar {
    return { voices: [{ beats }] };
}

function staff(bars: FakeBar[], chords: FakeStaff["chords"] = null): FakeStaff {
    return { bars, chords };
}

function track(staves: FakeStaff[]): { staves: FakeStaff[] } {
    return { staves };
}

describe("deriveChordFromBar", () => {
    it("derives a major chord from C-E-G midi notes", () => {
        const notes: FakeNote[] = [
            { realValue: 60 }, // C4
            { realValue: 64 }, // E4
            { realValue: 67 }, // G4
        ];
        expect(deriveChordFromBar(notes)).toBe("C");
    });

    it("derives a seventh chord when the seventh is present", () => {
        const notes: FakeNote[] = [
            { realValue: 60 }, // C
            { realValue: 64 }, // E
            { realValue: 67 }, // G
            { realValue: 71 }, // B
        ];
        expect(deriveChordFromBar(notes)).toMatch(/C(maj7|7)/);
    });

    it("returns null when the notes form no known chord", () => {
        const notes: FakeNote[] = [
            { realValue: 60 },
            { realValue: 61 }, // C + C# — no chord
            { realValue: 66 },
        ];
        expect(deriveChordFromBar(notes)).toBeNull();
    });

    it("returns null for an empty bar", () => {
        expect(deriveChordFromBar([])).toBeNull();
    });
});

describe("buildChordTimeline", () => {
    it("uses annotated chord names from beats with chordId", () => {
        const t = track([
            staff([
                bar([
                    beat({ chordId: "c1", chord: { name: "C" } }),
                    beat({ chordId: "c1", chord: { name: "C" } }),
                ]),
                bar([
                    beat({ chordId: "g1", chord: { name: "G" } }),
                    beat(),
                ]),
            ]),
        ]);

        const timeline = buildChordTimeline(t as never, 2);
        expect(timeline).toEqual([
            { name: "C", source: "annotation" },
            { name: "G", source: "annotation" },
        ]);
    });

    it("derives chords for bars without annotations", () => {
        const t = track([
            staff([
                bar([
                    beat({ notes: [{ realValue: 60 }, { realValue: 64 }, { realValue: 67 }] }),
                    beat({ notes: [{ realValue: 64 }] }),
                ]),
                bar([beat({ notes: [{ realValue: 64 }, { realValue: 67 }, { realValue: 71 }] })]),
            ]),
        ]);

        const timeline = buildChordTimeline(t as never, 2);
        expect(timeline![0]).toEqual({ name: "C", source: "derived" });
        expect(timeline![1]).toEqual({ name: "Em", source: "derived" });
    });

    it("prefers the annotation over derivation when both are available", () => {
        const t = track([
            staff([
                bar([
                    beat({
                        chordId: "c1",
                        chord: { name: "Csus4" },
                        notes: [{ realValue: 60 }, { realValue: 64 }, { realValue: 67 }],
                    }),
                ]),
            ]),
        ]);

        const timeline = buildChordTimeline(t as never, 1);
        expect(timeline![0]).toEqual({ name: "Csus4", source: "annotation" });
    });

    it("pads with nulls when the staff has fewer bars than masterBars", () => {
        const t = track([staff([bar([beat({ chordId: "c1", chord: { name: "C" } })])])]);
        const timeline = buildChordTimeline(t as never, 3);
        expect(timeline).toEqual([
            { name: "C", source: "annotation" },
            null,
            null,
        ]);
    });

    it("returns null when the whole track has no chords at all", () => {
        const t = track([
            staff([bar([beat({ notes: [{ realValue: 60 }, { realValue: 61 }] })])]),
        ]);
        expect(buildChordTimeline(t as never, 1)).toBeNull();
    });

    it("returns null when the track has no staves", () => {
        expect(buildChordTimeline(track([]) as never, 2)).toBeNull();
    });
});

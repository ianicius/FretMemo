import { describe, expect, it } from "vitest";
import { songScales } from "../chordScales";

describe("plan E4: scales over a song's chords", () => {
    it("estimates the key and gives diatonic chords the mode of their degree", () => {
        const song = songScales(["G", "Em7", "Cmaj7", "D7", "Am7", "Bm7", "F#m7b5"]);
        expect(song.key).toBe("G");
        expect(song.scaleFor("Cmaj7")).toEqual({ root: "C", mode: "Lydian" });
        expect(song.scaleFor("D7")).toEqual({ root: "D", mode: "Mixolydian" });
        expect(song.scaleFor("Bm7")).toEqual({ root: "B", mode: "Phrygian" });
        expect(song.scaleFor("Em7")).toEqual({ root: "E", mode: "Aeolian" });
        expect(song.scaleFor("F#m7b5")).toEqual({ root: "F#", mode: "Locrian" });
        expect(song.scaleFor("D/F#")).toEqual({ root: "D", mode: "Mixolydian" });
    });

    it("falls back to the chord quality outside the key or without a key", () => {
        const song = songScales(["C", "F", "G", "C", "E7", "Am"]);
        expect(song.key).toBe("C");
        expect(song.scaleFor("E7")).toEqual({ root: "E", mode: "Mixolydian" });
        expect(song.scaleFor("Fm7")).toEqual({ root: "F", mode: "Dorian" });
        expect(song.scaleFor("Cdim7")).toEqual({ root: "C", mode: "Diminished" });
        expect(song.scaleFor("Caug")).toEqual({ root: "C", mode: "Whole Tone" });
        expect(song.scaleFor("not a chord")).toBeNull();
        // Chromatic chords that fit no key half-way: no key claimed.
        expect(songScales(["C7", "Db7", "D7", "Eb7", "E7"]).key).toBeNull();
    });
});

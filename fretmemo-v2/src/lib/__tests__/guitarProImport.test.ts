import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { detectGuitarProFormat } from "../guitarProImport";

/**
 * Guitar Pro 3–5 files start with a length-prefixed version string:
 *   GP3: 0x18 0x02 0x00 0x00 + "FICHIER GUITAR PRO v3.00"
 *   GP4: 0x1E 0x02 0x00 0x00 + "FICHIER GUITAR PRO v4.00"
 *   GP5: 0x32 0x02 0x00 0x00 + "FICHIER GUITAR PRO v5.00"
 * Guitar Pro 6+ (.gpx/.gp) is a ZIP container ("PK\x03\x04") holding score.gpif.
 */
function gpHeader(version: 3 | 4 | 5): Uint8Array {
    const versionString = `FICHIER GUITAR PRO v${version}.00`;
    const header = new Uint8Array(4 + versionString.length);
    header[0] = versionString.length;
    header[1] = 0x02;
    header[2] = 0x00;
    header[3] = 0x00;
    for (let i = 0; i < versionString.length; i += 1) {
        header[4 + i] = versionString.charCodeAt(i);
    }
    return header;
}

function zipHeader(): Uint8Array {
    return new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00]);
}

describe("detectGuitarProFormat", () => {
    it("detects GP3 files by header magic", () => {
        expect(detectGuitarProFormat(gpHeader(3))).toBe("gp3");
    });

    it("detects GP4 files by header magic", () => {
        expect(detectGuitarProFormat(gpHeader(4))).toBe("gp4");
    });

    it("detects GP5 files by header magic", () => {
        expect(detectGuitarProFormat(gpHeader(5))).toBe("gp5");
    });

    it("detects ZIP-container formats (.gpx/.gp6+) as gp", () => {
        expect(detectGuitarProFormat(zipHeader())).toBe("gp");
    });

    it("accepts version strings with minor revisions (v4.06, v5.10)", () => {
        const v406 = new TextEncoder().encode(
            "\x1e\x02\x00\x00FICHIER GUITAR PRO v4.06",
        );
        expect(detectGuitarProFormat(v406)).toBe("gp4");
    });

    it("returns null for random binary data", () => {
        const random = new Uint8Array(64);
        for (let i = 0; i < random.length; i += 1) {
            random[i] = (i * 37 + 11) % 256;
        }
        expect(detectGuitarProFormat(random)).toBeNull();
    });

    it("returns null for an empty buffer", () => {
        expect(detectGuitarProFormat(new Uint8Array(0))).toBeNull();
    });

    it("returns null for a truncated GP header", () => {
        expect(detectGuitarProFormat(new Uint8Array([0x18, 0x02, 0x00]))).toBeNull();
    });
});

describe("parseScoreSummary", () => {
    // alphaTab is imported dynamically inside parseScoreSummary; mock it before import.
    vi.mock("@coderline/alphatab", () => {
        type FakeScore = {
            title: string;
            artist: string;
            tempo: number;
            tracks: Array<{ name: string; isPercussion: boolean }>;
        };
        const state: { nextScore: FakeScore | null; throwOnCall: Error | null } = {
            nextScore: null,
            throwOnCall: null,
        };
        const ScoreLoader = {
            loadScoreFromBytes(data: Uint8Array): FakeScore {
                void data;
                if (state.throwOnCall) {
                    throw state.throwOnCall;
                }
                if (!state.nextScore) {
                    throw new Error("no fake score configured");
                }
                return state.nextScore;
            },
        };
        return {
            __fakeState: state,
            // Production code reaches the loader through the `importer`
            // namespace (alphaTab 1.9 export layout).
            importer: { ScoreLoader },
        };
    });

    // Import after the mock is registered.
    let parseScoreSummary: typeof import("../guitarProImport").parseScoreSummary;
    let fakeState: { nextScore: unknown; throwOnCall: Error | null };

    beforeEach(async () => {
        vi.resetModules();
        const lib = await import("../guitarProImport");
        parseScoreSummary = lib.parseScoreSummary;
        const alphatab = (await import("@coderline/alphatab")) as unknown as {
            __fakeState: { nextScore: unknown; throwOnCall: Error | null };
        };
        fakeState = alphatab.__fakeState;
        fakeState.nextScore = null;
        fakeState.throwOnCall = null;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("extracts title, track count and tempo from a parsed score", async () => {
        fakeState.nextScore = {
            title: "Smoke on the Water",
            artist: "Deep Purple",
            tempo: 112,
            tracks: [
                { name: "Rhythm Guitar", isPercussion: false },
                { name: "Lead Guitar", isPercussion: false },
            ],
        };
        const summary = await parseScoreSummary(
            gpHeader(4),
            "test.gp4",
            12345,
        );
        expect(summary).toMatchObject({
            name: "test.gp4",
            sizeBytes: 12345,
            format: "gp4",
            title: "Smoke on the Water",
            trackCount: 2,
            tempoBpm: 112,
        });
        expect(summary?.id).toEqual(expect.any(String));
        expect(summary?.addedAt).toEqual(expect.any(Number));
    });

    it("falls back to the file name when the score has no title", async () => {
        fakeState.nextScore = {
            title: "",
            artist: "",
            tempo: 120,
            tracks: [{ name: "Guitar", isPercussion: false }],
        };
        const summary = await parseScoreSummary(gpHeader(5), "riff.gp5", 42);
        expect(summary?.title).toBe("riff.gp5");
    });

    it("throws a ScoreParseError when alphaTab cannot parse the bytes", async () => {
        fakeState.throwOnCall = new Error("unsupported file");
        await expect(
            parseScoreSummary(gpHeader(3), "broken.gp3", 10),
        ).rejects.toThrow();
    });
});

/**
 * Detection and parsing of Guitar Pro files.
 *
 * Format detection is clean-room: it relies only on the publicly known magic
 * bytes (version-string headers for GP3–GP5, ZIP container for .gpx/.gp6+).
 * Actual parsing is delegated to alphaTab (MPL-2.0), loaded lazily so the
 * library never enters the initial bundle — it is needed by the Library import
 * flow and the score viewer only.
 */
import type { GuitarProFormat, ScoreSummary } from "@/types/scores";

const GP_HEADER_PREFIX = "FICHIER GUITAR PRO v";

/** Raised when a file is not a Guitar Pro file or cannot be parsed. */
export class ScoreParseError extends Error {
    /** `"format"` — not a Guitar Pro file; `"parse"` — recognized but unparsable. */
    readonly kind: "format" | "parse";

    constructor(
        message: string,
        options?: { cause?: unknown; kind?: "format" | "parse" },
    ) {
        super(message, options);
        this.name = "ScoreParseError";
        this.kind = options?.kind ?? "parse";
    }
}

function decodeLatin1(bytes: Uint8Array): string {
    let out = "";
    for (let i = 0; i < bytes.length; i += 1) {
        out += String.fromCharCode(bytes[i]);
    }
    return out;
}

/**
 * Detects the Guitar Pro container format from magic bytes, or `null` when
 * the data is not a recognizable Guitar Pro file.
 */
export function detectGuitarProFormat(bytes: Uint8Array): GuitarProFormat | null {
    if (bytes.length < 4) {
        return null;
    }
    // ZIP local-file header: .gpx and every .gp from Guitar Pro 6 onward.
    if (
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        bytes[2] === 0x03 &&
        bytes[3] === 0x04
    ) {
        return "gp";
    }
    const header = decodeLatin1(bytes.subarray(0, 48));
    const marker = header.indexOf(GP_HEADER_PREFIX);
    if (marker === -1) {
        return null;
    }
    const version = header.charAt(marker + GP_HEADER_PREFIX.length);
    if (version === "3") {
        return "gp3";
    }
    if (version === "4") {
        return "gp4";
    }
    if (version === "5") {
        return "gp5";
    }
    return null;
}

/**
 * Reads a user-selected file into bytes via `FileReader`.
 * Used instead of `Blob.arrayBuffer()` because jsdom (test environment)
 * does not implement the promise-based Blob read methods.
 */
export function readFileBytes(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = () =>
            reject(reader.error ?? new Error("Failed to read file"));
        reader.readAsArrayBuffer(file);
    });
}

function createScoreId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `score-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Parses a Guitar Pro file into a `ScoreSummary` via alphaTab.
 * Throws `ScoreParseError` for unknown formats and unparsable data.
 */
export async function parseScoreSummary(
    bytes: Uint8Array,
    fileName: string,
    sizeBytes: number,
): Promise<ScoreSummary> {
    const format = detectGuitarProFormat(bytes);
    if (!format) {
        throw new ScoreParseError(`Unsupported file format: ${fileName}`, {
            kind: "format",
        });
    }
    let score: { title?: unknown; tempo?: unknown; tracks?: unknown };
    try {
        const { importer } = await import("@coderline/alphatab");
        score = importer.ScoreLoader.loadScoreFromBytes(bytes);
    } catch (error) {
        throw new ScoreParseError(`Failed to parse ${fileName}`, {
            cause: error,
            // A ZIP container that is not a valid Guitar Pro archive is a
            // wrong-format file, not corrupt GP data.
            kind: format === "gp" ? "format" : "parse",
        });
    }
    const parsedTitle = typeof score.title === "string" ? score.title.trim() : "";
    const tracks = Array.isArray(score.tracks) ? score.tracks : [];
    const tempo =
        typeof score.tempo === "number" && Number.isFinite(score.tempo) && score.tempo > 0
            ? score.tempo
            : null;
    return {
        id: createScoreId(),
        name: fileName,
        addedAt: Date.now(),
        sizeBytes,
        format,
        title: parsedTitle.length > 0 ? parsedTitle : fileName,
        trackCount: tracks.length,
        tempoBpm: tempo,
    };
}

/**
 * Domain types for imported Guitar Pro scores.
 *
 * Binary payloads live in IndexedDB (`src/lib/scoreStore.ts`); summaries are
 * the lightweight shape consumed by the Library list and the score viewer.
 */

/**
 * Container format detected from magic bytes. Guitar Pro 3–5 are proprietary
 * binary formats; `"gp"` covers the ZIP-container family (.gpx, .gp6, .gp7,
 * .gp8 and bare `.gp`), which cannot be told apart from the header alone.
 */
export type GuitarProFormat = "gp3" | "gp4" | "gp5" | "gp";

/** Metadata shown in the Library list and on the score viewer. */
export interface ScoreSummary {
    /** Opaque identifier (UUID) generated at import time. */
    id: string;
    /** Original file name, used as fallback title. */
    name: string;
    /** Import timestamp (epoch ms). */
    addedAt: number;
    /** File size in bytes. */
    sizeBytes: number;
    /** Detected container format. */
    format: GuitarProFormat;
    /** Score title from the file, falling back to the file name. */
    title: string;
    /** Number of tracks in the score. */
    trackCount: number;
    /** Default tempo in BPM, when the file provides one. */
    tempoBpm: number | null;
}

/** A full score with its binary payload, as persisted in IndexedDB. */
export interface ScoreRecord extends ScoreSummary {
    bytes: ArrayBuffer;
}

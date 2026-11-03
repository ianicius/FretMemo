/**
 * State and actions for imported Guitar Pro scores.
 *
 * IndexedDB (`src/lib/scoreStore.ts`) is the single source of truth for both
 * metadata and binaries; this store is an in-memory cache loaded from it.
 * Deliberately not persisted: duplicating the list in localStorage would risk
 * divergence from the binary store (other persisted stores hold only small
 * JSON-serializable state).
 */
import { create } from "zustand";
import {
    ScoreParseError,
    parseScoreSummary,
    readFileBytes,
} from "@/lib/guitarProImport";
import { deleteScoreFile, listScoreMeta, putScoreFile } from "@/lib/scoreStore";
import type { ScoreRecord, ScoreSummary } from "@/types/scores";

export type ScoreImportError =
    | "unsupported-format"
    | "parse-error"
    | "storage-error";

interface ScoresStoreState {
    /** Import summaries, newest first. Empty until `loadScores` ran. */
    scores: ScoreSummary[];
    isLoading: boolean;
    /** True once the cache has been hydrated from IndexedDB. */
    isLoaded: boolean;
    /** Last import error, surfaced by the Library section. */
    lastError: ScoreImportError | null;
    loadScores(): Promise<void>;
    addScore(file: File): Promise<ScoreSummary | null>;
    removeScore(id: string): Promise<void>;
    clearError(): void;
}

export const useScoresStore = create<ScoresStoreState>()((set, get) => ({
    scores: [],
    isLoading: false,
    isLoaded: false,
    lastError: null,

    loadScores: async () => {
        if (get().isLoading) {
            return;
        }
        set({ isLoading: true });
        try {
            const scores = await listScoreMeta();
            set({ scores, isLoaded: true, isLoading: false });
        } catch {
            set({ isLoading: false, lastError: "storage-error" });
        }
    },

    addScore: async (file) => {
        try {
            const bytes = await readFileBytes(file);
            const summary = await parseScoreSummary(bytes, file.name, file.size);
            const record: ScoreRecord = {
                ...summary,
                // Uint8Array.buffer is ArrayBufferLike; the reader always
                // produces a plain ArrayBuffer (never SharedArrayBuffer).
                bytes: bytes.buffer as ArrayBuffer,
            };
            await putScoreFile(record);
            set((state) => ({
                scores: [summary, ...state.scores].sort(
                    (a, b) => b.addedAt - a.addedAt,
                ),
                lastError: null,
            }));
            return summary;
        } catch (error) {
            const lastError: ScoreImportError =
                error instanceof ScoreParseError
                    ? error.kind === "format"
                        ? "unsupported-format"
                        : "parse-error"
                    : "storage-error";
            set({ lastError });
            return null;
        }
    },

    removeScore: async (id) => {
        try {
            await deleteScoreFile(id);
            set((state) => ({
                scores: state.scores.filter((score) => score.id !== id),
            }));
        } catch {
            set({ lastError: "storage-error" });
        }
    },

    clearError: () => set({ lastError: null }),
}));

/**
 * Per-track voice assignment for "Your Songs" (roadmap: per-track rendering).
 *
 * Each imported score can carry a list of track configs — one per track —
 * saying whether the track plays through a sound-engine preset chain or
 * directly from the soundfont, plus a mute flag. Configs live in their own
 * IndexedDB store (`fretmemo-scores-v1` / `trackConfigs`) so the score bytes
 * record stays untouched.
 */
import { getBuiltinPresets, getPresetById } from "@/audio/presets";
import { withTrackConfigsStore } from "@/lib/scoreStore";

export type TrackVoiceKind = "preset" | "direct";

export interface TrackConfig {
    /** Zero-based track index within the score. */
    trackIndex: number;
    kind: TrackVoiceKind;
    /** Sound-engine preset id; required when kind is "preset". */
    presetId?: string;
    muted: boolean;
}

export interface ValidTrackConfig {
    trackIndex: number;
    kind: TrackVoiceKind;
    /** Sound-engine preset id; present only when kind is "preset". */
    presetId?: string;
    muted: boolean;
}

function isValidPresetId(id: unknown): id is string {
    if (typeof id !== "string" || id.length === 0) {
        return false;
    }
    // Built-in presets are static; custom-<uuid> presets live in IndexedDB and
    // are validated against the sound store by the caller before assignment.
    return (
        getPresetById(id) !== undefined ||
        (id.startsWith("custom-") && id.length > "custom-".length)
    );
}

/**
 * Defensive read: drops malformed records, unknown preset ids, out-of-range
 * track indexes and duplicate indexes so a stale config can never crash
 * playback after a score was re-imported with fewer tracks.
 */
export function sanitizeTrackConfigs(
    configs: unknown,
    trackCount: number,
): ValidTrackConfig[] {
    if (!Array.isArray(configs)) {
        return [];
    }
    const seen = new Set<number>();
    const validPresets = new Set(getBuiltinPresets().map((preset) => preset.id));
    const result: ValidTrackConfig[] = [];
    for (const raw of configs) {
        if (typeof raw !== "object" || raw === null) {
            continue;
        }
        const r = raw as Record<string, unknown>;
        const trackIndex = r.trackIndex;
        if (typeof trackIndex !== "number" || !Number.isInteger(trackIndex)) {
            continue;
        }
        if (trackIndex < 0 || trackIndex >= trackCount || seen.has(trackIndex)) {
            continue;
        }
        const kind = r.kind;
        if (kind !== "preset" && kind !== "direct") {
            continue;
        }
        const muted = r.muted === true;
        if (kind === "preset") {
            const presetId = r.presetId;
            const known =
                typeof presetId === "string" &&
                (validPresets.has(presetId) || isValidPresetId(presetId));
            if (!known) {
                continue;
            }
            seen.add(trackIndex);
            result.push({ trackIndex, kind, presetId, muted });
        } else {
            seen.add(trackIndex);
            result.push({ trackIndex, kind, muted });
        }
    }
    return result.sort((a, b) => a.trackIndex - b.trackIndex);
}

export async function getTrackConfigs(scoreId: string): Promise<TrackConfig[]> {
    try {
        const record = (await withTrackConfigsStore("readonly", (store) => {
            const request = store.get(scoreId);
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () =>
                    reject(request.error ?? new Error("Failed to read track configs"));
            });
        })) as { configs?: unknown } | undefined;
        if (!record || !Array.isArray(record.configs)) {
            return [];
        }
        // Structural validation only at read time (no track count known here);
        // range checks happen in sanitizeTrackConfigs when the count is available.
        return record.configs.filter(
            (entry): entry is TrackConfig =>
                typeof entry === "object" &&
                entry !== null &&
                typeof (entry as TrackConfig).trackIndex === "number" &&
                ((entry as TrackConfig).kind === "preset" ||
                    (entry as TrackConfig).kind === "direct"),
        );
    } catch {
        // Persistence is best-effort: no IndexedDB (private mode, test env)
        // must never break song loading — the song just plays unassigned.
        return [];
    }
}

export async function setTrackConfigs(
    scoreId: string,
    configs: TrackConfig[],
): Promise<void> {
    try {
        await withTrackConfigsStore("readwrite", (store) => {
            store.put({ scoreId, configs });
            return Promise.resolve();
        });
    } catch {
        // Same best-effort contract as getTrackConfigs.
    }
}

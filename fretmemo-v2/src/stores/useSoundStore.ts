/**
 * State and actions for the Sound screen: user-authored presets ("tone
 * designer") plus a mirror of the sound engine status.
 *
 * Persistence: IndexedDB (`fretmemo-sound-presets-v1`), following the scores
 * store pattern — the DB wrapper lives in this module (promise-based CRUD,
 * defensive validation on read so a corrupted record cannot break the Sound
 * page) and the store is an in-memory cache hydrated by `loadCustomPresets`.
 *
 * Data model conventions for custom presets (`SoundPreset` from
 * `src/audio/presets.ts`):
 * - `id` is always `custom-<uuid>`;
 * - `kind` is always 'custom' (the engine call site adapts it — see
 *   `toEnginePreset` — because the engine keys NAM loading off `kind`);
 * - `nameKey` holds the **literal user-entered name** (it is not an i18n key
 *   for custom presets; the UI renders it directly);
 * - `amp` is 'classic' or a NAM model id from `NAM_MODELS`;
 * - `updatedAt` (extra field) orders the list newest first.
 *
 * The active preset id lives in the SETTINGS store (`full.audio.soundPreset`)
 * — this store never owns it. It only mirrors engine status and the custom
 * preset list.
 */
import { create } from "zustand";
import {
    soundEngine,
    type SoundEngineState,
} from "@/audio/engine";
import { registerPresetLookup } from "@/audio/presetLookup";
import {
    CAB_NONE,
    CHAIN_PARAM_RANGES,
    GATE_THRESHOLD_RANGE,
    IMPULSE_RESPONSES,
    MAX_CHAIN_BLOCKS,
    NAM_MODELS,
    deriveLegacyStudio,
    firstEnabledAmpModel,
    getPresetById,
    isBlockType,
    neutralChainParams,
    neutralGlobals,
    projectStudioFields,
    type ChainAssembly,
    type ChainBlock,
    type ChainGlobals,
    type ChainParams,
    type SoundPreset,
} from "@/audio/presets";
import { useSettingsStore } from "@/stores/useSettingsStore";

export type SoundStorageError = "storage-error";

/** Persisted record: a custom preset plus ordering metadata. */
export type CustomPresetRecord = SoundPreset & { updatedAt: number };

interface SoundStoreState {
    /** User-authored presets, newest first. Empty until `loadCustomPresets` ran. */
    customPresets: SoundPreset[];
    isLoading: boolean;
    /** True once the cache has been hydrated from IndexedDB. */
    isLoaded: boolean;
    /** Last storage error, surfaced by the Sound page. */
    lastError: SoundStorageError | null;
    /** Mirror of `soundEngine.getState()` (the engine drives it). */
    engine: SoundEngineState;
    loadCustomPresets(): Promise<void>;
    saveCustomPreset(input: SaveCustomPresetInput): Promise<SoundPreset | null>;
    deleteCustomPreset(id: string): Promise<void>;
    clearError(): void;
}

export interface SaveCustomPresetInput {
    /** When given (and known), the existing preset is updated instead of created. */
    id?: string;
    /** User-entered display name (stored literally in `nameKey`). */
    name: string;
    /** 'classic' or a NAM model id from `NAM_MODELS`. */
    amp: string;
    params: ChainParams;
    /** Cabinet IR id or `CAB_NONE`; absent = default cabinet handling. */
    cab?: string;
    /** Reverb IR id; absent = synthetic room. */
    reverb?: string;
    /** Studio chain. When set with `assembly: 'blocks'`, this is what gets saved and played. */
    chain?: ChainBlock[];
    globals?: ChainGlobals;
    assembly?: ChainAssembly;
}

/* ─────────── IndexedDB wrapper (thin, promise-based) ─────────── */

const DB_NAME = "fretmemo-sound-presets-v1";
const DB_VERSION = 1;
const STORE = "customPresets";

let dbPromise: Promise<IDBDatabase> | null = null;
let loadInflight: Promise<void> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: "id" });
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                // Free the connection when another tab upgrades the schema so
                // future migrations are not blocked; the next call reopens.
                db.onversionchange = () => {
                    db.close();
                    dbPromise = null;
                };
                resolve(db);
            };
            request.onerror = () => {
                // Never cache a failed open: the next call retries.
                dbPromise = null;
                reject(request.error ?? new Error("Failed to open IndexedDB"));
            };
        });
    }
    return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
    });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
            reject(transaction.error ?? new Error("IndexedDB transaction failed"));
        transaction.onabort = () =>
            reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    });
}

export async function listCustomPresetRecords(): Promise<CustomPresetRecord[]> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const records = await requestToPromise(tx.objectStore(STORE).getAll());
    return records
        .filter(isPersistedRecord)
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putCustomPresetRecord(record: CustomPresetRecord): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    await transactionDone(tx);
}

export async function deleteCustomPresetRecord(id: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await transactionDone(tx);
}

/** Removes every stored custom preset. Also used by tests for isolation. */
export async function clearAllCustomPresets(): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await transactionDone(tx);
}

/* ─────────── Validation (defensive read) ─────────── */

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Type guard: is every `ChainParams` field a finite number in declared range?
 * Fields added after a record was saved (e.g. the effect pedals) are read as
 * their neutral value, so older presets stay valid and sound unchanged.
 */
function isValidChainParams(value: unknown): value is ChainParams {
    if (!isPlainObject(value)) return false;
    const filled: Record<string, unknown> = { ...neutralChainParams(), ...value };
    return (Object.keys(CHAIN_PARAM_RANGES) as Array<keyof ChainParams>).every((key) => {
        const raw = filled[key];
        const { min, max } = CHAIN_PARAM_RANGES[key];
        return typeof raw === "number" && Number.isFinite(raw) && raw >= min && raw <= max;
    });
}

function isPersistedRecord(value: unknown): value is CustomPresetRecord {
    return (
        isPlainObject(value) &&
        typeof value.id === "string" &&
        value.id.length > 0 &&
        typeof value.nameKey === "string" &&
        typeof value.amp === "string" &&
        typeof value.updatedAt === "number" &&
        Number.isFinite(value.updatedAt) &&
        isValidChainParams(value.params)
    );
}

interface ParsedCustomPreset {
    preset: CustomPresetRecord;
    /** True when an unknown amp id was rewritten to 'classic' (self-heal). */
    ampRepaired: boolean;
}

/**
 * Narrow a persisted record into a valid custom preset.
 * - Records with unknown amp ids (e.g. a model removed from the registry in a
 *   newer app version) fall back to `amp: 'classic'` rendering.
 * - Returns `null` for malformed records (dropped by the caller, never thrown).
 */
export function parseCustomPresetRecord(value: CustomPresetRecord): ParsedCustomPreset | null {
    const name = value.nameKey.trim();
    if (name.length === 0) {
        return null;
    }
    // `user-*` amps are imported models; a deleted one surfaces as an engine
    // error (classic fallback) instead of silently rewriting the preset.
    const amp =
        value.amp === "classic" || value.amp in NAM_MODELS || value.amp.startsWith("user-")
            ? value.amp
            : "classic";
    const cab = value.cab === CAB_NONE || IMPULSE_RESPONSES[value.cab ?? ""]?.kind === "cab" ? value.cab : undefined;
    const reverb = IMPULSE_RESPONSES[value.reverb ?? ""]?.kind === "reverb" ? value.reverb : undefined;
    const params = { ...neutralChainParams(), ...value.params };
    const base: SoundPreset = {
        id: value.id,
        kind: "custom",
        amp,
        ...(cab ? { cab } : {}),
        ...(reverb ? { reverb } : {}),
        params,
        nameKey: name,
        builtIn: false,
    };
    const stored = readStoredStudio(value);
    let chain: ChainBlock[];
    let globals: ChainGlobals;
    let assembly: ChainAssembly = "legacy";
    let ampRepaired = amp !== value.amp;
    if (stored) {
        chain = stored.blocks;
        globals = stored.globals;
        assembly = "blocks";
        for (const block of chain) {
            if (block.type !== "amp") continue;
            const model = typeof block.params.model === "string" ? block.params.model : "classic";
            const known = model === "classic" || model in NAM_MODELS || model.startsWith("user-");
            if (!known) {
                block.params.model = "classic";
                ampRepaired = true;
            }
        }
        if (ampRepaired) {
            base.amp = firstEnabledAmpModel(chain);
        }
    } else {
        const derived = deriveLegacyStudio(base);
        chain = derived.blocks;
        globals = derived.globals;
    }
    const preset: CustomPresetRecord = {
        ...base,
        chain,
        globals,
        assembly,
        updatedAt: value.updatedAt,
    };
    return { preset, ampRepaired };
}

function readStoredStudio(value: CustomPresetRecord): { blocks: ChainBlock[]; globals: ChainGlobals } | null {
    if (value.assembly !== "blocks") return null;
    const blocks = parseStoredChain(value.chain);
    if (!blocks) return null;
    const globals = parseStoredGlobals(value.globals, blocks.length);
    if (!globals) return null;
    return { blocks, globals };
}

function parseStoredChain(value: unknown): ChainBlock[] | null {
    if (!Array.isArray(value) || value.length > MAX_CHAIN_BLOCKS) return null;
    const blocks: ChainBlock[] = [];
    for (const item of value) {
        if (!isPlainObject(item) || !isBlockType(item.type)) return null;
        if (typeof item.id !== "string" || item.id.length === 0 || typeof item.enabled !== "boolean") return null;
        if (!isPlainObject(item.params)) return null;
        const params: Record<string, string | number> = {};
        for (const [key, raw] of Object.entries(item.params)) {
            if (typeof raw === "number" && Number.isFinite(raw)) params[key] = raw;
            else if (typeof raw === "string") params[key] = raw;
        }
        blocks.push({ id: item.id, type: item.type, enabled: item.enabled, params });
    }
    return blocks;
}

function parseStoredGlobals(value: unknown, blockCount: number): ChainGlobals | null {
    if (!isPlainObject(value) || typeof value.gateEnabled !== "boolean") return null;
    const base = neutralGlobals(0);
    const numeric: Array<keyof ChainGlobals> = ["inputGain", "bass", "mid", "treble", "outputGain", "gateThresholdDb", "toneStackIndex"];
    for (const key of numeric) {
        if (typeof value[key] !== "number" || !Number.isFinite(value[key])) return null;
    }
    const inputGain = value.inputGain as number;
    const outputGain = value.outputGain as number;
    const bass = value.bass as number;
    const mid = value.mid as number;
    const treble = value.treble as number;
    const gateThresholdDb = value.gateThresholdDb as number;
    const toneStackIndex = value.toneStackIndex as number;
    const inRange = (n: number, min: number, max: number) => n >= min && n <= max;
    if (!inRange(inputGain, CHAIN_PARAM_RANGES.inputGain.min, CHAIN_PARAM_RANGES.inputGain.max)) return null;
    if (!inRange(outputGain, CHAIN_PARAM_RANGES.outputGain.min, CHAIN_PARAM_RANGES.outputGain.max)) return null;
    if (!inRange(bass, CHAIN_PARAM_RANGES.bass.min, CHAIN_PARAM_RANGES.bass.max)) return null;
    if (!inRange(mid, CHAIN_PARAM_RANGES.mid.min, CHAIN_PARAM_RANGES.mid.max)) return null;
    if (!inRange(treble, CHAIN_PARAM_RANGES.treble.min, CHAIN_PARAM_RANGES.treble.max)) return null;
    if (!inRange(gateThresholdDb, GATE_THRESHOLD_RANGE.min, GATE_THRESHOLD_RANGE.max)) return null;
    if (!Number.isInteger(toneStackIndex) || toneStackIndex < 0 || toneStackIndex > blockCount) return null;
    return {
        ...base,
        inputGain,
        outputGain,
        bass,
        mid,
        treble,
        gateEnabled: value.gateEnabled,
        gateThresholdDb,
        toneStackIndex,
    };
}

/** Stable id for a new custom preset: `custom-<uuid>`. */
function createCustomPresetId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `custom-${crypto.randomUUID()}`;
    }
    // Deterministic-quality fallback for environments without crypto.randomUUID.
    return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/* ─────────── Engine adaptation ─────────── */

/**
 * Adapt a preset for `soundEngine.setPreset`. The engine decides between the
 * classic amp stage and a NAM model load from `kind` (`'nam'` → NAM), while
 * custom presets are persisted with `kind: 'custom'`. The persisted data model
 * is untouched — only the object handed to the engine is adapted.
 */
export function toEnginePreset(preset: SoundPreset): SoundPreset {
    if (preset.assembly === "blocks" && preset.chain && preset.globals) {
        const model = firstEnabledAmpModel(preset.chain);
        return { ...preset, amp: model, kind: model === "classic" ? "classic" : "nam" };
    }
    if (preset.kind !== "custom") {
        return preset;
    }
    return { ...preset, kind: preset.amp === "classic" ? "classic" : "nam" };
}

/**
 * Load custom rigs before the first note when the saved preset is not a
 * built-in. Built-in ids return immediately so ordinary playback never waits
 * on IndexedDB. If the engine already started on the wrong chain, re-apply.
 */
export async function ensureActiveRigReady(): Promise<void> {
    const id = useSettingsStore.getState().full.audio.soundPreset;
    if (!id || getPresetById(id)) return;
    await useSoundStore.getState().loadCustomPresets();
    const custom = useSoundStore.getState().customPresets.find((preset) => preset.id === id);
    if (!custom || !soundEngine.hasContext()) return;
    const state = soundEngine.getState();
    if (state.presetId === id && state.status === "ready") return;
    await soundEngine.setPreset(toEnginePreset(custom));
}

/* ─────────── Store ─────────── */

export const useSoundStore = create<SoundStoreState>()((set, get) => ({
    customPresets: [],
    isLoading: false,
    isLoaded: false,
    lastError: null,
    engine: soundEngine.getState(),

    loadCustomPresets: () => {
        if (loadInflight) return loadInflight;
        loadInflight = (async () => {
        set({ isLoading: true });
        try {
            const records = await listCustomPresetRecords();
            const presets: SoundPreset[] = [];
            const repairs: CustomPresetRecord[] = [];
            for (const record of records) {
                const parsed = parseCustomPresetRecord(record);
                if (!parsed) {
                    // Malformed record: dropped from the list (never thrown),
                    // mirroring the scores store read policy.
                    continue;
                }
                presets.push(parsed.preset);
                if (parsed.ampRepaired) {
                    repairs.push({ ...parsed.preset, updatedAt: record.updatedAt });
                }
            }
            set({
                customPresets: presets,
                isLoaded: true,
                isLoading: false,
                lastError: null,
            });
            // Self-heal repaired records best-effort (unknown amp → classic).
            for (const record of repairs) {
                void putCustomPresetRecord(record).catch(() => {
                    // Best-effort only; the in-memory fix is already applied.
                });
            }
        } catch {
            set({ isLoading: false, lastError: "storage-error" });
        } finally {
            loadInflight = null;
        }
        })();
        return loadInflight;
    },

    saveCustomPreset: async (input) => {
        const name = input.name.trim();
        if (name.length === 0) {
            return null;
        }
        const existing = input.id
            ? get().customPresets.find((preset) => preset.id === input.id)
            : undefined;
        const studio = input.assembly === "blocks" && input.chain && input.globals
            ? projectStudioFields(input.chain, input.globals)
            : null;
        const record: CustomPresetRecord = {
            id: existing?.id ?? createCustomPresetId(),
            kind: "custom",
            amp: studio?.amp ?? input.amp,
            ...(studio?.cab ? { cab: studio.cab } : input.cab ? { cab: input.cab } : {}),
            ...(studio?.reverb ? { reverb: studio.reverb } : input.reverb ? { reverb: input.reverb } : {}),
            params: { ...(studio?.params ?? input.params) },
            nameKey: name,
            builtIn: false,
            updatedAt: Date.now(),
            ...(studio && input.chain && input.globals
                ? { chain: input.chain, globals: input.globals, assembly: "blocks" as const }
                : {}),
        };
        try {
            await putCustomPresetRecord(record);
            // Every in-memory custom preset is a full record (parse keeps
            // updatedAt), so the newest-first ordering stays total.
            const next = [
                record,
                ...get().customPresets.filter((preset) => preset.id !== record.id),
            ] as CustomPresetRecord[];
            next.sort((a, b) => b.updatedAt - a.updatedAt);
            set({ customPresets: next, lastError: null });
            return record;
        } catch {
            set({ lastError: "storage-error" });
            return null;
        }
    },

    deleteCustomPreset: async (id) => {
        try {
            await deleteCustomPresetRecord(id);
            set((state) => ({
                customPresets: state.customPresets.filter((preset) => preset.id !== id),
            }));
        } catch {
            set({ lastError: "storage-error" });
        }
    },

    clearError: () => set({ lastError: null }),
}));

/* ─────────── Engine status mirror + reload repair ─────────── */

/**
 * The engine's initial chain is resolved from built-ins only
 * (`getPresetById`): after a reload with a custom preset persisted as
 * `full.audio.soundPreset`, the first engine init falls back to the classic
 * chain with an `Unknown sound preset` error. Once custom presets are known
 * here, re-apply the persisted custom preset — the engine was initialized by
 * a user gesture at that point, so the repair is autoplay-safe. Guarded to at
 * most one repair per preset id per session so a genuinely broken preset
 * cannot loop.
 */
const repairedPresetIds = new Set<string>();

soundEngine.subscribe((state) => {
    useSoundStore.setState({ engine: state });

    const error = state.error;
    if (
        state.status !== "error" ||
        typeof error !== "string" ||
        !error.startsWith("Unknown sound preset:") ||
        repairedPresetIds.has(state.presetId)
    ) {
        return;
    }
    const custom = useSoundStore
        .getState()
        .customPresets.find((preset) => preset.id === state.presetId);
    if (!custom) {
        return;
    }
    repairedPresetIds.add(state.presetId);
    void soundEngine.setPreset(toEnginePreset(custom));
});

registerPresetLookup((id) => {
    const found = useSoundStore.getState().customPresets.find((preset) => preset.id === id);
    return found ? toEnginePreset(found) : undefined;
});

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { BUILT_IN_PRESETS, NAM_MODELS, neutralChainParams } from "@/audio/presets";
import {
    clearAllCustomPresets,
    listCustomPresetRecords,
    parseCustomPresetRecord,
    putCustomPresetRecord,
    toEnginePreset,
    useSoundStore,
    type CustomPresetRecord,
} from "@/stores/useSoundStore";

/**
 * Tested against the real IndexedDB wrapper (`fake-indexeddb`), mirroring the
 * scores store test setup. The engine subscription at module level is inert
 * here: no `setPreset` call is made, so no AudioContext is ever created.
 */

function makeInput(overrides: Partial<{ name: string; amp: string; drive: number }> = {}) {
    return {
        name: overrides.name ?? "Ciepły jazz",
        amp: overrides.amp ?? "classic",
        params: {
            ...neutralChainParams(),
            ...(overrides.drive !== undefined ? { drive: overrides.drive } : {}),
        },
    };
}

function makeRecord(overrides: Partial<CustomPresetRecord> = {}): CustomPresetRecord {
    return {
        id: "custom-test-1",
        kind: "custom",
        amp: "classic",
        params: neutralChainParams(),
        nameKey: "Test tone",
        builtIn: false,
        updatedAt: 1_700_000_000_000,
        ...overrides,
    };
}

beforeEach(async () => {
    await clearAllCustomPresets();
    useSoundStore.setState({
        customPresets: [],
        isLoading: false,
        isLoaded: false,
        lastError: null,
    });
});

describe("useSoundStore", () => {
    it("saveCustomPreset creates a custom-<uuid> preset, persists it and updates the list", async () => {
        const saved = await useSoundStore.getState().saveCustomPreset(makeInput());

        expect(saved).not.toBeNull();
        expect(saved?.id).toMatch(/^custom-[0-9a-z-]+$/i);
        expect(saved?.kind).toBe("custom");
        expect(saved?.builtIn).toBe(false);
        expect(saved?.nameKey).toBe("Ciepły jazz");
        expect(saved?.amp).toBe("classic");
        expect(useSoundStore.getState().customPresets).toHaveLength(1);
        expect(useSoundStore.getState().lastError).toBeNull();

        const records = await listCustomPresetRecords();
        expect(records).toHaveLength(1);
        expect(records[0].id).toBe(saved?.id);
        expect(records[0].updatedAt).toBeGreaterThan(0);
    });

    it("saveCustomPreset keeps a NAM amp on a custom preset", async () => {
        const amp = "nam-lead-jcm";
        expect(amp).toBe(NAM_MODELS["nam-lead-jcm"] ? amp : "nam-lead-jcm");

        const saved = await useSoundStore.getState().saveCustomPreset(makeInput({ amp }));

        expect(saved?.amp).toBe("nam-lead-jcm");
        expect(saved?.kind).toBe("custom");
    });

    it("saveCustomPreset updates the existing record when its id is passed", async () => {
        const first = await useSoundStore.getState().saveCustomPreset(makeInput());
        expect(first).not.toBeNull();

        const updated = await useSoundStore.getState().saveCustomPreset({
            id: first!.id,
            name: "Zmienione",
            amp: "nam-clean-jc",
            params: { ...neutralChainParams(), drive: 0.2 },
        });

        expect(updated?.id).toBe(first!.id);
        expect(useSoundStore.getState().customPresets).toHaveLength(1);
        expect(useSoundStore.getState().customPresets[0].nameKey).toBe("Zmienione");
        expect(useSoundStore.getState().customPresets[0].amp).toBe("nam-clean-jc");
        const records = await listCustomPresetRecords();
        expect(records).toHaveLength(1);
        expect(records[0].params.drive).toBe(0.2);
    });

    it("saveCustomPreset rejects an empty name without touching storage", async () => {
        const saved = await useSoundStore.getState().saveCustomPreset(makeInput({ name: "   " }));

        expect(saved).toBeNull();
        expect(useSoundStore.getState().customPresets).toHaveLength(0);
        expect(await listCustomPresetRecords()).toHaveLength(0);
    });

    it("deleteCustomPreset removes the preset from IndexedDB and the list", async () => {
        const saved = await useSoundStore.getState().saveCustomPreset(makeInput());

        await useSoundStore.getState().deleteCustomPreset(saved!.id);

        expect(useSoundStore.getState().customPresets).toHaveLength(0);
        expect(await listCustomPresetRecords()).toHaveLength(0);
    });

    it("loadCustomPresets hydrates the cache from IndexedDB, newest first", async () => {
        await putCustomPresetRecord(makeRecord({ id: "custom-old", updatedAt: 1_000 }));
        await putCustomPresetRecord(makeRecord({ id: "custom-new", updatedAt: 2_000 }));
        useSoundStore.setState({ customPresets: [], isLoaded: false });

        await useSoundStore.getState().loadCustomPresets();

        expect(useSoundStore.getState().isLoaded).toBe(true);
        expect(useSoundStore.getState().customPresets.map((preset) => preset.id)).toEqual([
            "custom-new",
            "custom-old",
        ]);
    });

    it("loadCustomPresets drops malformed records instead of throwing", async () => {
        // Cast on purpose: simulates a partially written / corrupted record.
        await putCustomPresetRecord({ id: "custom-broken", nope: true } as unknown as CustomPresetRecord);
        await putCustomPresetRecord(
            makeRecord({ id: "custom-bad-params", params: { ...neutralChainParams(), drive: 42 } }),
        );
        await putCustomPresetRecord(makeRecord({ id: "custom-ok" }));

        await useSoundStore.getState().loadCustomPresets();

        expect(useSoundStore.getState().customPresets.map((preset) => preset.id)).toEqual([
            "custom-ok",
        ]);
        expect(await listCustomPresetRecords().then((records) => records.map((r) => r.id))).toEqual([
            "custom-ok",
        ]);
    });

    it("loadCustomPresets falls back to classic rendering for unknown amps and self-heals the record", async () => {
        await putCustomPresetRecord(makeRecord({ id: "custom-stale", amp: "removed-model-v9" }));

        await useSoundStore.getState().loadCustomPresets();

        const preset = useSoundStore.getState().customPresets.find((p) => p.id === "custom-stale");
        expect(preset?.amp).toBe("classic");
        expect(preset?.kind).toBe("custom");
        const persisted = await listCustomPresetRecords();
        expect(persisted.find((r) => r.id === "custom-stale")?.amp).toBe("classic");
    });

    it("parseCustomPresetRecord returns null for a blank name", () => {
        expect(parseCustomPresetRecord(makeRecord({ nameKey: "   " }))).toBeNull();
        expect(parseCustomPresetRecord(makeRecord({ nameKey: "OK" }))).not.toBeNull();
    });

    it("toEnginePreset adapts the kind for the engine without touching built-ins", () => {
        const classicCustom = toEnginePreset(makeRecord());
        expect(classicCustom.kind).toBe("classic");

        const namCustom = toEnginePreset(makeRecord({ amp: "nam-high-gain-5153" }));
        expect(namCustom.kind).toBe("nam");
        expect(namCustom.amp).toBe("nam-high-gain-5153");

        const builtIn = BUILT_IN_PRESETS[0];
        expect(toEnginePreset(builtIn)).toBe(builtIn);
    });

    it("clearError resets lastError", async () => {
        useSoundStore.setState({ lastError: "storage-error" });
        useSoundStore.getState().clearError();
        expect(useSoundStore.getState().lastError).toBeNull();
    });
});

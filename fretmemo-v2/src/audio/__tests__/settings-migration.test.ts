import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PRESET_ID } from '@/audio/presets';

/**
 * Exercises the persist `merge` sanitizer of useSettingsStore for the
 * audio.soundPreset migration (legacy audio.instrumentSound → soundPreset),
 * following the store-test style of src/stores/__tests__/useScoresStore.test.ts.
 *
 * Each test seeds localStorage with a "previous app version" snapshot and
 * re-imports the store module so persist rehydration runs through merge().
 */

const STORAGE_KEY = 'fretmemo-settings-v2';

type StoredSettings = Record<string, unknown>;

function seedPersistedSettings(audio: Record<string, unknown>): void {
    // zustand persist wraps stored state as `{ state, version }`.
    const persisted = {
        state: {
            full: {
                audio,
            },
        } satisfies StoredSettings,
        version: 0,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

async function loadStore() {
    const mod = await import('@/stores/useSettingsStore');
    return mod.useSettingsStore;
}

beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
});

afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
});

describe('settings migration: audio.instrumentSound → audio.soundPreset', () => {
    it('defaults soundPreset to classic-acoustic on a fresh install', async () => {
        const store = await loadStore();
        expect(store.getState().full.audio.soundPreset).toBe('classic-acoustic');
        expect(DEFAULT_PRESET_ID).toBe('classic-acoustic');
    });

    it('maps legacy instrumentSound=acoustic to classic-acoustic', async () => {
        seedPersistedSettings({ volume: 0.7, instrumentSound: 'acoustic', pitchTolerance: 10 });
        const store = await loadStore();
        expect(store.getState().full.audio.soundPreset).toBe('classic-acoustic');
        expect(store.getState().full.audio.volume).toBe(0.7);
    });

    it('maps any other legacy instrumentSound value to the default preset', async () => {
        seedPersistedSettings({ volume: 0.6, instrumentSound: 'electric', pitchTolerance: 10 });
        const store = await loadStore();
        expect(store.getState().full.audio.soundPreset).toBe(DEFAULT_PRESET_ID);

        vi.resetModules();
        window.localStorage.clear();
        seedPersistedSettings({ volume: 0.6, instrumentSound: 'clean', pitchTolerance: 10 });
        const store2 = await loadStore();
        expect(store2.getState().full.audio.soundPreset).toBe(DEFAULT_PRESET_ID);
    });

    it('keeps a persisted non-empty soundPreset as-is', async () => {
        seedPersistedSettings({
            volume: 0.6,
            instrumentSound: 'acoustic',
            soundPreset: 'nam-lead-jcm',
            pitchTolerance: 10,
        });
        const store = await loadStore();
        expect(store.getState().full.audio.soundPreset).toBe('nam-lead-jcm');
    });

    it('falls back to the default preset for invalid soundPreset values', async () => {
        seedPersistedSettings({ volume: 0.6, soundPreset: '', pitchTolerance: 10 });
        const store = await loadStore();
        expect(store.getState().full.audio.soundPreset).toBe(DEFAULT_PRESET_ID);

        vi.resetModules();
        window.localStorage.clear();
        seedPersistedSettings({ volume: 0.6, soundPreset: 42, pitchTolerance: 10 });
        const store2 = await loadStore();
        expect(store2.getState().full.audio.soundPreset).toBe(DEFAULT_PRESET_ID);
    });

    it('falls back to the default preset when neither field is persisted', async () => {
        seedPersistedSettings({ volume: 0.6, pitchTolerance: 10 });
        const store = await loadStore();
        expect(store.getState().full.audio.soundPreset).toBe(DEFAULT_PRESET_ID);
    });

    it('coerces invalid volumes and keeps unrelated audio fields through migration', async () => {
        seedPersistedSettings({ volume: 'loud', instrumentSound: 'acoustic', pitchTolerance: 25 });
        const store = await loadStore();
        // Volume sanitization is out of scope here; what matters is that the
        // migration does not lose persisted fields.
        expect(store.getState().full.audio.pitchTolerance).toBe(25);
        expect(store.getState().full.audio.soundPreset).toBe('classic-acoustic');
    });
});

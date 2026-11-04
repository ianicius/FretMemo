import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    BUILT_IN_PRESETS,
    CHAIN_PARAM_RANGES,
    DEFAULT_PRESET_ID,
    NAM_MODELS,
    getBuiltinPresets,
    getPresetById,
    isWithinDeclaredRanges,
    neutralChainParams,
} from '../presets';

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');
const SOUND_DIR = path.join(PROJECT_ROOT, 'public', 'sound');
const MAX_MODEL_BYTES = 5 * 1024 * 1024;

describe('built-in preset registry', () => {
    it('defines at least 4 built-in presets', () => {
        expect(BUILT_IN_PRESETS.length).toBeGreaterThanOrEqual(4);
    });

    it('uses unique preset ids', () => {
        const ids = BUILT_IN_PRESETS.map((preset) => preset.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('exposes the default preset as a built-in classic preset', () => {
        expect(DEFAULT_PRESET_ID).toBe('classic-acoustic');
        const fallback = getPresetById(DEFAULT_PRESET_ID);
        expect(fallback).toBeDefined();
        expect(fallback!.builtIn).toBe(true);
        expect(fallback!.kind).toBe('classic');
        expect(fallback!.amp).toBe('classic');
    });

    it('keeps every preset within the declared ChainParams ranges', () => {
        for (const preset of BUILT_IN_PRESETS) {
            expect(isWithinDeclaredRanges(preset.params), `preset ${preset.id}`).toBe(true);
        }
    });

    it('declares a sane min/max for every ChainParams field', () => {
        for (const key of Object.keys(CHAIN_PARAM_RANGES) as Array<keyof typeof CHAIN_PARAM_RANGES>) {
            const { min, max } = CHAIN_PARAM_RANGES[key];
            expect(min, key).toBeLessThan(max);
        }
    });

    it('defines i18n name keys for every preset', () => {
        for (const preset of BUILT_IN_PRESETS) {
            expect(preset.nameKey.startsWith('sound.presets.'), preset.id).toBe(true);
        }
    });

    it('classic-acoustic reproduces the neutral (historical) sound', () => {
        const acoustic = getPresetById('classic-acoustic')!;
        expect(acoustic.params).toEqual(neutralChainParams());
        expect(acoustic.params.drive).toBe(0);
        expect(acoustic.params.delayMix).toBe(0);
        expect(acoustic.params.reverbMix).toBe(0);
    });

    it('getBuiltinPresets returns a copy, getPresetById unknown id is undefined', () => {
        const list = getBuiltinPresets();
        expect(list).not.toBe(BUILT_IN_PRESETS);
        expect(list).toEqual(BUILT_IN_PRESETS);
        expect(getPresetById('does-not-exist')).toBeUndefined();
    });
});

describe('NAM-based presets', () => {
    const namPresets = BUILT_IN_PRESETS.filter((preset) => preset.kind === 'nam');

    it('ships at least 3 NAM-based presets (plus the classic fallback)', () => {
        expect(namPresets.length).toBeGreaterThanOrEqual(3);
    });

    it('references a registered NAM model for every NAM preset', () => {
        for (const preset of namPresets) {
            expect(NAM_MODELS[preset.amp], `preset ${preset.id}`).toBeDefined();
        }
    });

    it('keeps drive neutral on NAM presets (models carry their own gain)', () => {
        for (const preset of namPresets) {
            expect(preset.params.drive, preset.id).toBe(0);
        }
    });

    it('has a bundled model file (≤ 5 MB) for every registered NAM model', () => {
        for (const [modelId, model] of Object.entries(NAM_MODELS)) {
            const filePath = path.join(SOUND_DIR, model.file);
            expect(existsSync(filePath), `missing file for ${modelId}: ${filePath}`).toBe(true);
            expect(statSync(filePath).size).toBeLessThanOrEqual(MAX_MODEL_BYTES);
        }
    });

    it('bundles only A2 SlimmableContainer model files', () => {
        for (const [modelId, model] of Object.entries(NAM_MODELS)) {
            const filePath = path.join(SOUND_DIR, model.file);
            const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { architecture?: string };
            expect(parsed.architecture, `model ${modelId}`).toBe('SlimmableContainer');
        }
    });
});

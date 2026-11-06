import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import {
    deleteUserModel,
    getUserModelBlobUrl,
    getUserModelBytes,
    listUserModels,
    saveUserModel,
    UserModelError,
    validateUserModel,
} from '../userModels';

const VALID_A2 = JSON.stringify({
    architecture: 'SlimmableContainer',
    config: { submodels: [{ max_value: 0.5 }, { max_value: 1 }] },
});

const LEGACY_A1 = JSON.stringify({ architecture: 'WaveNet', version: '0.2.0' });

function bytesOf(text: string): ArrayBuffer {
    return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

beforeEach(async () => {
    // clean the store between tests (fake-indexeddb persists per import)
    const existing = await listUserModels();
    for (const model of existing) {
        await deleteUserModel(model.id);
    }
});

describe('validateUserModel', () => {
    it('accepts an A2 SlimmableContainer file', () => {
        expect(() => validateUserModel(bytesOf(VALID_A2))).not.toThrow();
    });

    it('rejects a legacy single-architecture file with a typed error', () => {
        try {
            validateUserModel(bytesOf(LEGACY_A1));
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(UserModelError);
            expect((error as UserModelError).code).toBe('legacy-format');
        }
    });

    it('rejects non-JSON content', () => {
        try {
            validateUserModel(bytesOf('this is not a model'));
            expect.unreachable('should have thrown');
        } catch (error) {
            expect((error as UserModelError).code).toBe('invalid-model');
        }
    });

    it('rejects oversized files', () => {
        const huge = bytesOf(VALID_A2);
        Object.defineProperty(huge, 'byteLength', { value: 16 * 1024 * 1024 });
        try {
            validateUserModel(huge);
            expect.unreachable('should have thrown');
        } catch (error) {
            expect((error as UserModelError).code).toBe('too-large');
        }
    });
});

describe('save/list/delete roundtrip', () => {
    it('persists a model and lists it newest-first', async () => {
        const first = await saveUserModel('  Jazz Amp  ', bytesOf(VALID_A2));
        expect(first.id).toMatch(/^user-/);
        expect(first.name).toBe('Jazz Amp'); // trimmed

        const second = await saveUserModel(' Blues King ', bytesOf(VALID_A2));
        const list = await listUserModels();
        expect(list.map((m) => m.id)).toEqual([second.id, first.id]);
    });

    it('falls back to a default name when the file name is blank', async () => {
        const model = await saveUserModel('   ', bytesOf(VALID_A2));
        expect(model.name).toBe('Imported model');
    });

    it('deletes a model and its session blob url', async () => {
        const model = await saveUserModel('Doom', bytesOf(VALID_A2));
        const url = await getUserModelBlobUrl(model.id);
        expect(url).toMatch(/^blob:/);

        await deleteUserModel(model.id);
        expect(await listUserModels()).toHaveLength(0);
        expect(await getUserModelBytes(model.id)).toBeNull();
        expect(await getUserModelBlobUrl(model.id)).toBeNull();
    });

    it('returns the stored bytes for the engine', async () => {
        const model = await saveUserModel('Amp', bytesOf(VALID_A2));
        const bytes = await getUserModelBytes(model.id);
        expect(new TextDecoder().decode(bytes as ArrayBuffer)).toBe(VALID_A2);
    });
});

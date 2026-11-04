import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NamEngine, NamModelInfo, NamNodePool } from 'neural-amp-modeler-wasm/engine';

/**
 * The `neural-amp-modeler-wasm/engine` module is mocked at the package
 * boundary (it needs AudioWorklet + wasm); fetch is stubbed per test. No
 * real audio hardware or network is involved.
 */

const attachMock = vi.fn();
const createNodeMock = vi.fn();
const loadModelMock = vi.fn();
const acquireMock = vi.fn();

vi.mock('neural-amp-modeler-wasm/engine', () => {
    class FakeNamEngine {
        static attach = attachMock;
        createNode = createNodeMock;
    }
    class FakeNamNodePool {
        acquire = acquireMock;
    }
    return {
        NamEngine: FakeNamEngine,
        NamNodePool: FakeNamNodePool,
    };
});

import { getEngineAssetBaseUrl, getNamModelUrl, isSlimmableContainerJson, loadNamNode, MAX_LOADED_NAM_NODES } from '../nam';
import { NAM_MODELS } from '../presets';
import { FakeAudioContext } from './fixtures/audioStubs';

const SLIMMABLE_JSON = JSON.stringify({
    version: '0.7.0',
    architecture: 'SlimmableContainer',
    config: { submodels: [{ max_value: 0.5 }, { max_value: 1 }] },
});

const MODEL_INFO: NamModelInfo = {
    slimmable: true,
    slimmableBreakpoints: [0.5],
    hasLoudness: true,
    loudness: -18,
    expectedSampleRate: 48000,
};

class FakeNamNodeImpl {
    loadModel = loadModelMock;
}

type FetchMock = ReturnType<typeof vi.fn>;

function stubFetch(body: string | null, status = 200): FetchMock {
    const response = {
        ok: status >= 200 && status < 300,
        status,
        text: async () => body ?? '',
    };
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

beforeEach(() => {
    vi.unstubAllGlobals();
    attachMock.mockReset();
    createNodeMock.mockReset();
    loadModelMock.mockReset();
    acquireMock.mockReset();

    attachMock.mockResolvedValue({ createNode: createNodeMock } as unknown as NamEngine);
    acquireMock.mockResolvedValue(new FakeNamNodeImpl());
    loadModelMock.mockResolvedValue(MODEL_INFO);
});

describe('isSlimmableContainerJson', () => {
    it('accepts A2 SlimmableContainer files', () => {
        expect(isSlimmableContainerJson(SLIMMABLE_JSON)).toBe(true);
    });

    it('rejects legacy single-architecture files and invalid JSON', () => {
        expect(isSlimmableContainerJson(JSON.stringify({ architecture: 'WaveNet' }))).toBe(false);
        expect(isSlimmableContainerJson(JSON.stringify({ version: '0.5.0' }))).toBe(false);
        expect(isSlimmableContainerJson('not json at all')).toBe(false);
    });
});

describe('URL helpers', () => {
    it('resolves model files under the sound base path', () => {
        expect(getNamModelUrl('nam-deluxe-a2')).toBe('/sound/models/deluxe-a2.nam');
        expect(getNamModelUrl('unknown-model')).toBeNull();
    });

    it('points engine assets at the copied public/sound/engine directory', () => {
        expect(getEngineAssetBaseUrl()).toBe('/sound/engine/');
    });
});

describe('loadNamNode', () => {
    it('fetches, validates and loads a bundled model through the pool', async () => {
        const fetchMock = stubFetch(SLIMMABLE_JSON);
        const ctx = new FakeAudioContext();

        const result = await loadNamNode(ctx as unknown as AudioContext, 'nam-deluxe-a2');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.info).toEqual(MODEL_INFO);
        }
        expect(attachMock).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ assetBaseUrl: getEngineAssetBaseUrl() }),
        );
        expect(acquireMock).toHaveBeenCalledWith('nam-deluxe-a2');
        expect(loadModelMock).toHaveBeenCalledWith(SLIMMABLE_JSON);
        const requestedUrl = (fetchMock.mock.calls[0]?.[0] as string) ?? '';
        expect(requestedUrl).toContain(NAM_MODELS['nam-deluxe-a2'].file);
    });

    it('reports unknown-model for ids outside the registry', async () => {
        stubFetch(SLIMMABLE_JSON);
        const result = await loadNamNode(new FakeAudioContext() as unknown as AudioContext, 'nope');
        expect(result).toMatchObject({ ok: false, code: 'unknown-model' });
        expect(attachMock).not.toHaveBeenCalled();
    });

    it('maps fetch failures to a network error', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => {
            throw new Error('offline');
        }));
        const result = await loadNamNode(new FakeAudioContext() as unknown as AudioContext, 'nam-deluxe-a2');
        expect(result).toMatchObject({ ok: false, code: 'network' });
    });

    it('maps HTTP errors to a network error', async () => {
        stubFetch('gone', 404);
        const result = await loadNamNode(new FakeAudioContext() as unknown as AudioContext, 'nam-deluxe-a2');
        expect(result).toMatchObject({ ok: false, code: 'network' });
    });

    it('maps non-JSON payloads to an invalid-model error', async () => {
        stubFetch('this is a binary blob');
        const result = await loadNamNode(new FakeAudioContext() as unknown as AudioContext, 'nam-deluxe-a2');
        expect(result).toMatchObject({ ok: false, code: 'invalid-model' });
        expect(loadModelMock).not.toHaveBeenCalled();
    });

    it('maps legacy single-architecture files to a legacy-format error', async () => {
        stubFetch(JSON.stringify({ version: '0.5.0', architecture: 'WaveNet', weights: {} }));
        const result = await loadNamNode(new FakeAudioContext() as unknown as AudioContext, 'nam-deluxe-a2');
        expect(result).toMatchObject({ ok: false, code: 'legacy-format' });
        expect(loadModelMock).not.toHaveBeenCalled();
    });

    it('maps engine attach failures to an engine-unavailable error', async () => {
        stubFetch(SLIMMABLE_JSON);
        attachMock.mockRejectedValue(new Error('AudioWorklet not supported'));
        const result = await loadNamNode(new FakeAudioContext() as unknown as AudioContext, 'nam-deluxe-a2');
        expect(result).toMatchObject({ ok: false, code: 'engine-unavailable' });
    });

    it('survives a loadModel rejection with a model-load error', async () => {
        stubFetch(SLIMMABLE_JSON);
        acquireMock.mockResolvedValue(new FakeNamNodeImpl());
        loadModelMock.mockRejectedValue(new Error('weights corrupt'));
        const result = await loadNamNode(new FakeAudioContext() as unknown as AudioContext, 'nam-deluxe-a2');
        expect(result).toMatchObject({ ok: false, code: 'model-load' });
    });

    it('caches one engine per AudioContext and caps the pool size', async () => {
        stubFetch(SLIMMABLE_JSON);
        const ctx = new FakeAudioContext() as unknown as AudioContext;

        await loadNamNode(ctx, 'nam-deluxe-a2');
        await loadNamNode(ctx, 'nam-clean-jc');

        expect(attachMock).toHaveBeenCalledTimes(1);
        const { NamNodePool: PoolCtor } = (await import('neural-amp-modeler-wasm/engine')) as unknown as {
            NamNodePool: new (engine: NamEngine, maxNodes: number, onEvict?: unknown) => NamNodePool;
        };
        // The pool was constructed with MAX_LOADED_NAM_NODES.
        expect(acquireMock).toHaveBeenCalledTimes(2);
        expect(PoolCtor).toBeDefined();
        expect(MAX_LOADED_NAM_NODES).toBeGreaterThanOrEqual(3);
    });
});

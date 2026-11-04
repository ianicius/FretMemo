/**
 * NAM (Neural Amp Modeler) loader.
 *
 * Wraps `neural-amp-modeler-wasm/engine`:
 * - lazy dynamic import of the engine entry (no worklet/wasm cost until a
 *   NAM preset is actually used),
 * - one `NamEngine` per AudioContext (the package enforces this; we cache
 *   the attach promise),
 * - an LRU node pool (max 3) so switching presets reuses nodes with their
 *   model still loaded — re-acquiring an evicted model reloads transparently,
 * - typed load errors instead of raw exceptions.
 *
 * Asset strategy: the worklet script + wasm binary are copied from the
 * package (`dist/engine/`) into `public/sound/engine/` and passed explicitly
 * via `assetBaseUrl`, so resolution does not depend on how the bundler
 * rewrites `new URL(..., import.meta.url)` inside node_modules. The same
 * files are runtime-cached by the service worker (see vite.config.ts).
 */

import type { NamEngine, NamModelInfo, NamNode, NamNodePool } from 'neural-amp-modeler-wasm/engine';
import { NAM_MODELS } from './presets';

/** Maximum simultaneously loaded NAM nodes (LRU-evicted beyond this). */
export const MAX_LOADED_NAM_NODES = 3;

/** Architecture string required by the player/engine: A2 SlimmableContainer. */
const REQUIRED_ARCHITECTURE = 'SlimmableContainer';

export type NamLoadErrorCode =
    | 'unknown-model'
    | 'network'
    | 'invalid-model'
    | 'legacy-format'
    | 'engine-unavailable'
    | 'model-load';

export interface NamLoadSuccess {
    ok: true;
    node: NamNode;
    /** Model metadata reported by the engine after a fresh load. */
    info: NamModelInfo | undefined;
}

export interface NamLoadFailure {
    ok: false;
    code: NamLoadErrorCode;
    message: string;
}

export type NamLoadResult = NamLoadSuccess | NamLoadFailure;

/** True if the .nam JSON text is an A2 SlimmableContainer file. */
export function isSlimmableContainerJson(text: string): boolean {
    try {
        const parsed: unknown = JSON.parse(text);
        return (
            typeof parsed === 'object' &&
            parsed !== null &&
            (parsed as { architecture?: unknown }).architecture === REQUIRED_ARCHITECTURE
        );
    } catch {
        return false;
    }
}

/** Resolve the public URL of a bundled model file (`public/sound/<file>`). */
export function getNamModelUrl(modelId: string): string | null {
    const model = NAM_MODELS[modelId];
    if (!model) return null;
    return `${import.meta.env.BASE_URL}sound/${model.file}`;
}

/** Base URL for the engine assets copied to `public/sound/engine/`. */
export function getEngineAssetBaseUrl(): string {
    return `${import.meta.env.BASE_URL}sound/engine/`;
}

// — Engine attach cache (one engine per AudioContext) —

type EngineAttachment = {
    promise: Promise<NamEngine>;
    pool: NamNodePool | null;
    /** Model ids currently loaded in a pooled node (pool key === model id). */
    loadedKeys: Set<string>;
};

const attachments = new WeakMap<AudioContext, EngineAttachment>();

async function importNamEngineModule() {
    return import('neural-amp-modeler-wasm/engine');
}

async function getAttachment(ctx: AudioContext): Promise<EngineAttachment> {
    const existing = attachments.get(ctx);
    if (existing) return existing;

    const attachment: EngineAttachment = {
        promise: (async () => {
            const { NamEngine: NamEngineClass } = await importNamEngineModule();
            return NamEngineClass.attach(ctx, { assetBaseUrl: getEngineAssetBaseUrl() });
        })(),
        pool: null,
        loadedKeys: new Set<string>(),
    };
    attachments.set(ctx, attachment);

    // Mark a failed attach as retryable (drop the cache entry).
    attachment.promise.catch(() => {
        if (attachments.get(ctx) === attachment) {
            attachments.delete(ctx);
        }
    });

    return attachment;
}

function mapUnknownError(error: unknown, code: NamLoadErrorCode): NamLoadFailure {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code, message };
}

/**
 * Fetch, validate and load a NAM model into a pooled node.
 *
 * Returns a discriminated result; never throws. `modelUrl` overrides the
 * registry-derived URL (used by tests and, later, by the .nam import UI).
 */
export async function loadNamNode(
    ctx: AudioContext,
    modelId: string,
    modelUrl?: string,
): Promise<NamLoadResult> {
    const url = modelUrl ?? getNamModelUrl(modelId);
    if (!url) {
        return {
            ok: false,
            code: 'unknown-model',
            message: `Unknown NAM model id: ${modelId}`,
        };
    }

    try {
        const attachment = await getAttachment(ctx);
        const engine = await attachment.promise;

        if (!attachment.pool) {
            const { NamNodePool: NamNodePoolClass } = await importNamEngineModule();
            attachment.pool = new NamNodePoolClass(engine, MAX_LOADED_NAM_NODES, (_node, key) => {
                attachment.loadedKeys.delete(key);
            });
        }

        const node = await attachment.pool.acquire(modelId);
        if (attachment.loadedKeys.has(modelId)) {
            // Pooled node still holds this exact model: instant switch.
            return { ok: true, node, info: undefined };
        }

        let response: Response;
        try {
            response = await fetch(url);
        } catch (error) {
            return mapUnknownError(error, 'network');
        }
        if (!response.ok) {
            return {
                ok: false,
                code: 'network',
                message: `Failed to fetch NAM model ${modelId}: HTTP ${response.status}`,
            };
        }

        const text = await response.text();
        if (!isSlimmableContainerJson(text)) {
            return {
                ok: false,
                code: text.trimStart().startsWith('{') ? 'legacy-format' : 'invalid-model',
                message: `NAM model ${modelId} is not an A2 SlimmableContainer file`,
            };
        }

        let info: NamModelInfo | undefined;
        try {
            info = await node.loadModel(text);
        } catch (error) {
            // The engine rejected the file contents (e.g. corrupt weights).
            return mapUnknownError(error, 'model-load');
        }
        attachment.loadedKeys.add(modelId);
        return { ok: true, node, info };
    } catch (error) {
        // Attach/createNode/acquire failures (worklet missing, wasm broken…).
        return mapUnknownError(error, 'engine-unavailable');
    }
}

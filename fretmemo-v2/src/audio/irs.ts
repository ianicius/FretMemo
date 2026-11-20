/**
 * Bundled impulse-response loader (cabinets + reverbs, `public/sound/irs/`).
 *
 * Fetch + decode once per context (decodeAudioData resamples to the
 * context rate, which ConvolverNode requires). Never throws: an unknown id or
 * a failed fetch resolves to null and the chain falls back to its default
 * cabinet / synthetic reverb. Files are runtime-cached by the service worker.
 */

import { IMPULSE_RESPONSES, type ChainBlock, type ImpulseResponseDescriptor, type SoundPreset } from './presets';

const cache = new WeakMap<BaseAudioContext, Map<string, Promise<AudioBuffer | null>>>();

export function loadImpulseResponse(
    ctx: BaseAudioContext,
    id: string | undefined,
    kind: ImpulseResponseDescriptor['kind'],
): Promise<AudioBuffer | null> {
    const ir = id ? IMPULSE_RESPONSES[id] : undefined;
    if (!id || !ir || ir.kind !== kind) return Promise.resolve(null);
    let perContext = cache.get(ctx);
    if (!perContext) {
        perContext = new Map();
        cache.set(ctx, perContext);
    }
    const entries = perContext;
    let pending = entries.get(id);
    if (!pending) {
        pending = fetch(`${import.meta.env.BASE_URL}sound/${ir.file}`)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.arrayBuffer();
            })
            .then((bytes) => ctx.decodeAudioData(bytes))
            .catch(() => {
                entries.delete(id); // retry on the next request
                return null;
            });
        entries.set(id, pending);
    }
    return pending;
}

/** Both IRs a preset asks for, ready to pass to `assembleChain`. */
export async function loadPresetImpulseResponses(
    ctx: BaseAudioContext,
    preset: SoundPreset,
): Promise<{ cabBuffer: AudioBuffer | null; reverbBuffer: AudioBuffer | null }> {
    const [cabBuffer, reverbBuffer] = await Promise.all([
        loadImpulseResponse(ctx, preset.cab, 'cab'),
        loadImpulseResponse(ctx, preset.reverb, 'reverb'),
    ]);
    return { cabBuffer, reverbBuffer };
}

/** IRs referenced by studio blocks, keyed by block id. Missing files resolve to null. */
export async function loadBlockImpulseResponses(
    ctx: BaseAudioContext,
    blocks: ChainBlock[],
): Promise<{ cabBuffers: Record<string, AudioBuffer | null>; reverbBuffers: Record<string, AudioBuffer | null> }> {
    const cabBuffers: Record<string, AudioBuffer | null> = {};
    const reverbBuffers: Record<string, AudioBuffer | null> = {};
    await Promise.all(blocks.map(async (block) => {
        if (block.type === 'cab' && block.params.mode === 'ir' && typeof block.params.irId === 'string') {
            cabBuffers[block.id] = await loadImpulseResponse(ctx, block.params.irId, 'cab');
        }
        if (block.type === 'reverb' && typeof block.params.irId === 'string') {
            reverbBuffers[block.id] = await loadImpulseResponse(ctx, block.params.irId, 'reverb');
        }
    }));
    return { cabBuffers, reverbBuffers };
}

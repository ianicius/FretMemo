/**
 * SoundEngine singleton — the single playback path for all guitar voices.
 *
 * Topology (stage order also documented in docs/sound-engine.md):
 *
 *   voices (lib/audio.ts) → voiceBus → inputGain → amp stage
 *     (classic filter pair | NAM AudioWorkletNode) → drive → EQ → comp
 *     → delay → reverb → chainOutput → fadeGain → masterGain → destination
 *
 * - Count-in clicks / metronomes stay on `ctx.destination` directly and are
 *   NOT part of this engine (they are not guitar sound).
 * - The engine owns the AudioContext (moved from src/lib/audio.ts).
 * - The master gain is driven by `full.audio.volume` from the settings store
 *   and tracks live changes.
 * - `setPreset` rebuilds the amp/chain for a new preset with a ~20 ms
 *   crossfade; failed/unknown NAM models fall back to the classic stage.
 */

import { useSettingsStore } from '@/stores/useSettingsStore';
import { assembleChain, connectNodes, disconnectNodes, type AssembledChain, type ChainAudioNode } from './chain';
import { loadGateWorklet } from './gate';
import { loadBlockImpulseResponses, loadPresetImpulseResponses } from './irs';
import { loadNamNode } from './nam';
import { lookupPreset } from './presetLookup';
import { getUserModelBlobUrl } from './userModels';
import { DEFAULT_PRESET_ID, getPresetById, type SoundPreset } from './presets';

export type SoundEngineStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SoundEngineState {
    /** Preset the engine is playing (or attempting to play). */
    presetId: string;
    status: SoundEngineStatus;
    /** Present when status === 'error'. */
    error?: string;
}

export type SoundEngineListener = (state: SoundEngineState) => void;

/**
 * The historical per-voice master gain (0.40) from lib/audio.ts moved here:
 * it now applies once on the engine master gain, scaled by the volume
 * setting, so overall loudness stays similar when volume = 1.
 */
export const VOICE_BUS_TRIM = 0.40;

/** Master gain for a volume setting (pure; unit-tested). */
export function masterGainValue(volume: number): number {
    const clamped = Math.min(Math.max(volume, 0), 1);
    return clamped * VOICE_BUS_TRIM;
}

/** Duration of the preset-switch gain crossfade. */
export const CROSSFADE_SEC = 0.02;

interface ActiveChain {
    chain: AssembledChain;
    fadeGain: GainNode;
    presetId: string;
}

class SoundEngineController {
    private ctx: AudioContext | null = null;
    private voiceBusNode: GainNode | null = null;
    private masterGainNode: GainNode | null = null;
    private active: ActiveChain | null = null;
    private voiceBusBypassed = false;
    private state: SoundEngineState = { presetId: DEFAULT_PRESET_ID, status: 'idle' };
    /** Last preset handed to the engine, including unsaved studio drafts. */
    private currentPreset: SoundPreset | null = null;
    /** Bumps on every activation so a slower rebuild cannot replace a newer one. */
    private activation = 0;
    private listeners = new Set<SoundEngineListener>();
    private unsubscribeStore: (() => void) | null = null;
    private storeVolumeSeen: number | null = null;

    // ——— Context / wiring ———

    /**
     * Lazy AudioContext accessor (moved from src/lib/audio.ts). Creates the
     * context, voice bus and master gain on first call, wires the initial
     * chain and resumes a suspended context on every call.
     */
    getAudioContext(): AudioContext {
        if (!this.ctx) {
            const ctx = new AudioContext();
            this.ctx = ctx;
            this.voiceBusNode = ctx.createGain();
            this.masterGainNode = ctx.createGain();

            this.applyVolumeFromSettings();
            this.masterGainNode.connect(ctx.destination);
            this.subscribeToSettingsStore();

            // Initial preset: the persisted `soundPreset` when valid, else
            // the default (an unknown persisted id falls back with an error
            // status, mirroring the setPreset fallback policy).
            const requestedId = useSettingsStore.getState().full.audio.soundPreset || DEFAULT_PRESET_ID;
            const preset = lookupPreset(requestedId);
            if (!preset) {
                const fallback = getPresetById(DEFAULT_PRESET_ID)!;
                this.currentPreset = fallback;
                this.installChain(fallback, { crossfade: false });
                this.state = {
                    presetId: requestedId,
                    status: 'error',
                    error: `Unknown sound preset: ${requestedId}`,
                };
                this.emit();
            } else if (preset.assembly === 'blocks') {
                this.currentPreset = preset;
                this.connectBypass();
                void this.activatePreset(preset, { crossfade: true });
            } else if (preset.kind === 'nam') {
                // Classic chain cannot be built synchronously for a NAM
                // preset: pass audio through untouched until the model is
                // loaded, then crossfade into the full chain.
                this.currentPreset = preset;
                this.connectBypass();
                void this.activatePreset(preset, { crossfade: true });
            } else {
                this.currentPreset = preset;
                this.installChain(preset, { crossfade: false });
                this.state = { presetId: preset.id, status: 'ready' };
                this.emit();
            }
        }
        if (this.ctx.state === 'suspended') {
            void this.ctx.resume();
        }
        return this.ctx;
    }

    /**
     * The node every guitar voice connects into. Requires the context to
     * exist (call sites call `getAudioContext()` first).
     */
    getVoiceBus(): GainNode {
        this.getAudioContext();
        if (!this.voiceBusNode) {
            throw new Error('Sound engine voice bus missing despite initialized context');
        }
        return this.voiceBusNode;
    }

    /** Master gain node (null before the context exists). Introspection API. */
    getMasterGain(): GainNode | null {
        return this.masterGainNode;
    }

    // ——— Presets ———

    /**
     * Switch presets: rebuilds the amp/chain stage for `preset` without
     * tearing down the AudioContext or the voice bus, crossfading ~20 ms.
     * Unknown/failed NAM models fall back to the classic stage and set an
     * error status. Never throws.
     */
    async setPreset(preset: SoundPreset, options?: { force?: boolean }): Promise<void> {
        this.getAudioContext();
        if (!options?.force && this.state.presetId === preset.id && this.state.status === 'ready') {
            return;
        }
        this.currentPreset = preset;
        await this.activatePreset(preset, { crossfade: true });
    }

    /** True after the AudioContext has been created. Does not create one. */
    hasContext(): boolean {
        return this.ctx !== null;
    }

    /** Preset currently installed, or the one activation is aiming at. */
    getCurrentPreset(): SoundPreset | null {
        return this.currentPreset;
    }

    private async activatePreset(preset: SoundPreset, options: { crossfade: boolean }): Promise<void> {
        const ctx = this.ctx;
        if (!ctx) return;
        const ticket = ++this.activation;
        this.currentPreset = preset;

        if (preset.assembly === 'blocks' && preset.chain && preset.globals) {
            await this.activateBlockPreset(preset, options, ticket);
            return;
        }

        if (this.state.presetId !== preset.id || this.state.status !== 'ready') {
            this.state = { presetId: preset.id, status: 'loading' };
            this.emit();
        }

        try {
            let ampNode: ChainAudioNode | undefined;
            if (preset.kind === 'nam') {
                // User-imported models resolve to a session blob URL over
                // IndexedDB bytes; bundled ids skip the lookup entirely.
                const userModelUrl = preset.amp.startsWith('user-')
                    ? await getUserModelBlobUrl(preset.amp)
                    : null;
                if (preset.amp.startsWith('user-') && !userModelUrl) {
                    throw new Error(`NAM load failed (unknown-model): user model ${preset.amp} not found`);
                }
                const result = await loadNamNode(ctx, preset.amp, userModelUrl ?? undefined);
                if (!result.ok) {
                    throw new Error(`NAM load failed (${result.code}): ${result.message}`);
                }
                ampNode = result.node;
            }

            const irs = await loadPresetImpulseResponses(ctx, preset);
            const next = assembleChain(ctx, preset, { ampNode, ...irs });
            if (ticket !== this.activation) {
                next.dispose();
                return;
            }
            const swap = () => {
                this.installChain(preset, { crossfade: options.crossfade, next });
                this.state = { presetId: preset.id, status: 'ready' };
                this.emit();
            };

            if (options.crossfade) {
                // Swap on the next microtask-ish tick so a `loading` status
                // can render before the (synchronous) node rebuild.
                await Promise.resolve();
                if (ticket !== this.activation) {
                    next.dispose();
                    return;
                }
                swap();
            } else {
                swap();
            }
        } catch (error) {
            if (ticket !== this.activation) return;
            this.fallbackToClassic(preset, error);
        }
    }

    /** Studio rig: load every NAM amp and IR, then assemble blocks in order. */
    private async activateBlockPreset(preset: SoundPreset, options: { crossfade: boolean }, ticket: number): Promise<void> {
        const ctx = this.ctx;
        const chain = preset.chain;
        if (!ctx || !chain) return;

        if (this.state.presetId !== preset.id || this.state.status !== 'ready') {
            this.state = { presetId: preset.id, status: 'loading' };
            this.emit();
        }

        try {
            const ampNodes: Record<string, ChainAudioNode> = {};
            for (const block of chain) {
                if (block.type !== 'amp' || !block.enabled) continue;
                const model = typeof block.params.model === 'string' ? block.params.model : 'classic';
                if (model === 'classic') continue;
                const userModelUrl = model.startsWith('user-') ? await getUserModelBlobUrl(model) : null;
                if (model.startsWith('user-') && !userModelUrl) {
                    throw new Error(`NAM load failed (unknown-model): user model ${model} not found`);
                }
                const result = await loadNamNode(ctx, model, userModelUrl ?? undefined, `${model}::${block.id}`);
                if (!result.ok) {
                    throw new Error(`NAM load failed (${result.code}): ${result.message}`);
                }
                ampNodes[block.id] = result.node;
            }

            await loadGateWorklet(ctx).catch(() => {
                // Gate falls back to a unity gain inside the chain.
            });
            const buffers = await loadBlockImpulseResponses(ctx, chain);
            const next = assembleChain(ctx, preset, { ampNodes, ...buffers });
            if (ticket !== this.activation) {
                next.dispose();
                return;
            }
            const swap = () => {
                this.installChain(preset, { crossfade: options.crossfade, next });
                this.state = { presetId: preset.id, status: 'ready' };
                this.emit();
            };
            if (options.crossfade) {
                await Promise.resolve();
                if (ticket !== this.activation) {
                    next.dispose();
                    return;
                }
                swap();
            } else {
                swap();
            }
        } catch (error) {
            if (ticket !== this.activation) return;
            this.fallbackToClassic(preset, error);
        }
    }

    /** Install a classic chain after a failed NAM load; sets error status. */
    private fallbackToClassic(preset: SoundPreset, error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        const fallback: SoundPreset = {
            id: preset.id,
            kind: 'classic',
            amp: 'classic',
            params: getPresetById(DEFAULT_PRESET_ID)!.params,
            nameKey: preset.nameKey,
            builtIn: false,
        };
        this.installChain(fallback, { crossfade: true });
        this.state = { presetId: preset.id, status: 'error', error: message };
        this.emit();
    }

    /**
     * Wire `voiceBus → next.input … next.output → fadeGain → masterGain`.
     * The voice bus keeps feeding the previous chain during the fade; the
     * previous chain is cleaned up right after the crossfade completes.
     */
    private installChain(
        preset: SoundPreset,
        options: { crossfade: boolean; next?: AssembledChain },
    ): void {
        const ctx = this.ctx;
        const voiceBus = this.voiceBusNode;
        const masterGain = this.masterGainNode;
        if (!ctx || !voiceBus || !masterGain) return;

        const next = options.next ?? assembleChain(ctx, preset);
        const now = ctx.currentTime;
        const fadeGain = ctx.createGain();
        if (options.crossfade) {
            fadeGain.gain.setValueAtTime(0, now);
            fadeGain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SEC);
        } else {
            fadeGain.gain.setValueAtTime(1, now);
        }
        next.output.connect(fadeGain);
        fadeGain.connect(masterGain);
        connectNodes(voiceBus, next.input);

        const previous = this.active;
        const previousBypassed = this.voiceBusBypassed;
        this.active = { chain: next, fadeGain, presetId: preset.id };
        this.voiceBusBypassed = false;

        if (previous) {
            this.teardownChainAfterFade(previous);
        } else if (previousBypassed) {
            // First chain after a bypass start: drop the direct route once
            // the fade-in completed.
            window.setTimeout(() => {
                try {
                    voiceBus.disconnect(masterGain);
                } catch {
                    // Already disconnected: ignore.
                }
            }, CROSSFADE_SEC * 1000 + 30);
        }
    }

    /** Fade the previous chain out, then disconnect and dispose it. */
    private teardownChainAfterFade(previous: ActiveChain): void {
        const ctx = this.ctx;
        const voiceBus = this.voiceBusNode;
        if (!ctx || !voiceBus) return;
        const now = ctx.currentTime;
        const currentLevel = previous.fadeGain.gain.value;
        previous.fadeGain.gain.cancelScheduledValues(now);
        previous.fadeGain.gain.setValueAtTime(currentLevel, now);
        previous.fadeGain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SEC);

        window.setTimeout(() => {
            try {
                disconnectNodes(voiceBus, previous.chain.input);
            } catch {
                // Already disconnected: ignore.
            }
            try {
                previous.fadeGain.disconnect();
            } catch {
                // Already disconnected: ignore.
            }
            previous.chain.dispose();
        }, CROSSFADE_SEC * 1000 + 30);
    }

    private connectBypass(): void {
        if (!this.ctx || !this.voiceBusNode || !this.masterGainNode) return;
        this.voiceBusNode.connect(this.masterGainNode);
        this.voiceBusBypassed = true;
    }

    // ——— Volume ———

    /** Apply `full.audio.volume` from the settings store to the master gain. */
    applyVolumeFromSettings(): void {
        if (!this.masterGainNode || !this.ctx) return;
        const volume = useSettingsStore.getState().full.audio.volume;
        this.storeVolumeSeen = volume;
        this.masterGainNode.gain.setTargetAtTime(masterGainValue(volume), this.ctx.currentTime, 0.01);
    }

    private subscribeToSettingsStore(): void {
        if (this.unsubscribeStore) return;
        this.unsubscribeStore = useSettingsStore.subscribe((state) => {
            const volume = state.full.audio.volume;
            if (volume !== this.storeVolumeSeen) {
                this.applyVolumeFromSettings();
            }
        });
    }

    // ——— Status events ———

    getState(): SoundEngineState {
        return this.state;
    }

    subscribe(listener: SoundEngineListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private emit(): void {
        for (const listener of [...this.listeners]) {
            try {
                listener(this.state);
            } catch {
                // Listener errors must not break the engine.
            }
        }
    }
}

/** App-wide sound engine singleton. */
export const soundEngine = new SoundEngineController();

/** Context accessor used by src/lib/audio.ts (same lazy/resume semantics). */
export function getSoundEngineContext(): AudioContext {
    return soundEngine.getAudioContext();
}

/** Voice bus accessor used by src/lib/audio.ts. */
export function getSoundEngineVoiceBus(): GainNode {
    return soundEngine.getVoiceBus();
}

/**
 * Idempotent warm-up: create the context, wire the chain and preload the
 * current preset (NAM attach happens in the background if needed).
 * Safe to call on every user interaction.
 */
export function initSoundEngine(): void {
    soundEngine.getAudioContext();
}

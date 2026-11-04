import { beforeAll, describe, expect, it, vi } from 'vitest';
import type * as EngineModule from '@/audio/engine';
import type * as LibAudioModule from '@/lib/audio';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { DEFAULT_PRESET_ID, getPresetById, neutralChainParams } from '@/audio/presets';
import { FakeAudioContext, stubAudioContextGlobal } from './fixtures/audioStubs';

/**
 * Wiring test: lib/audio.ts voices must terminate in the sound engine's
 * voice bus (not ctx.destination), count-in clicks must still go straight
 * to destination, and the master gain must track full.audio.volume.
 *
 * The AudioContext constructor is stubbed with a recording fake at the
 * global boundary; no real audio hardware or worklets are involved.
 */

let engine: typeof EngineModule;
let audio: typeof LibAudioModule;
let ctx: FakeAudioContext;

beforeAll(async () => {
    stubAudioContextGlobal();
    engine = await import('@/audio/engine');
    audio = await import('@/lib/audio');
    ctx = engine.soundEngine.getAudioContext() as unknown as FakeAudioContext;
});

describe('sound engine wiring', () => {
    it('routes playTone voices into the engine voice bus, not the destination', async () => {
        const bus = engine.soundEngine.getVoiceBus() as unknown as {
            incoming: Array<{ destination: unknown }>;
        };
        const incomingBefore = bus.incoming.length;

        await audio.playTone(60, 0.01);

        expect(bus.incoming.length).toBeGreaterThan(incomingBefore);
        // Exactly one node feeds ctx.destination: the engine master gain.
        const destinationIncoming = (ctx.destination as unknown as {
            incoming: Array<{ destination: unknown }>;
        }).incoming;
        expect(destinationIncoming).toHaveLength(1);
    });

    it('routes playChord voices into the engine voice bus', async () => {
        const bus = engine.soundEngine.getVoiceBus() as unknown as {
            incoming: Array<{ destination: unknown }>;
        };
        const incomingBefore = bus.incoming.length;

        await audio.playChord([60, 64, 67], 0.01);

        expect(bus.incoming.length).toBeGreaterThan(incomingBefore);
    });

    it('keeps count-in clicks on ctx.destination (outside the preset chain)', () => {
        const destinationIncoming = (ctx.destination as unknown as {
            incoming: Array<{ destination: unknown }>;
        }).incoming;
        const before = destinationIncoming.length;

        audio.playCountInClicks(120, 4);

        // One gain node per beat connected straight into the destination.
        expect(destinationIncoming.length).toBe(before + 4);
        const latestSources = destinationIncoming.slice(before).map((c) => c.destination);
        // None of the click gains pass through the voice bus.
        const bus = engine.soundEngine.getVoiceBus();
        for (const source of latestSources) {
            expect(source).not.toBe(bus);
        }
    });

    it('initAudio delegates to the engine warm-up (same shared context)', () => {
        audio.initAudio();
        expect(engine.soundEngine.getAudioContext()).toBe(ctx);
    });
});

describe('engine volume sync (full.audio.volume → master gain)', () => {
    it('applies the stored volume through VOICE_BUS_TRIM', () => {
        const masterGain = engine.soundEngine.getMasterGain();
        expect(masterGain).not.toBeNull();
        const volume = useSettingsStore.getState().full.audio.volume;
        expect((masterGain as unknown as { gain: { value: number } }).gain.value).toBe(
            engine.masterGainValue(volume),
        );
    });

    it('reacts to live volume setting changes', () => {
        const masterGain = engine.soundEngine.getMasterGain() as unknown as {
            gain: { value: number };
        };
        const state = useSettingsStore.getState();
        useSettingsStore.setState({
            full: { ...state.full, audio: { ...state.full.audio, volume: 0.5 } },
        });
        expect(masterGain.gain.value).toBe(engine.masterGainValue(0.5));
        expect(engine.masterGainValue(0.5)).toBeCloseTo(0.5 * engine.VOICE_BUS_TRIM, 10);

        const stateAfter = useSettingsStore.getState();
        useSettingsStore.setState({
            full: { ...stateAfter.full, audio: { ...stateAfter.full.audio, volume: 0.8 } },
        });
        expect(masterGain.gain.value).toBeCloseTo(0.32, 10);
    });
});

describe('engine preset switching', () => {
    it('builds the default preset synchronously and reports ready', () => {
        const state = engine.soundEngine.getState();
        expect(state.presetId).toBe(DEFAULT_PRESET_ID);
        expect(state.status).toBe('ready');
        expect(state.error).toBeUndefined();
    });

    it('switches to another classic preset without losing the context', async () => {
        const preset = getPresetById('nam-clean-jc')!;
        const classicVariant = { ...preset, kind: 'classic' as const, amp: 'classic' as const };
        await engine.soundEngine.setPreset(classicVariant);
        expect(engine.soundEngine.getState()).toMatchObject({
            presetId: 'nam-clean-jc',
            status: 'ready',
        });
        expect(engine.soundEngine.getAudioContext()).toBe(ctx);
    });

    it('falls back to the classic stage and reports an error for unknown NAM models', async () => {
        const badPreset = {
            id: 'bad-nam',
            kind: 'nam' as const,
            amp: 'not-in-registry',
            params: neutralChainParams(),
            nameKey: 'sound.presets.bad.name',
            builtIn: false,
        };
        const events: EngineModule.SoundEngineState[] = [];
        const unsubscribe = engine.soundEngine.subscribe((state) => events.push({ ...state }));

        await engine.soundEngine.setPreset(badPreset);

        expect(engine.soundEngine.getState()).toMatchObject({
            presetId: 'bad-nam',
            status: 'error',
        });
        expect(engine.soundEngine.getState().error).toContain('unknown-model');
        expect(events.some((e) => e.status === 'loading')).toBe(true);
        unsubscribe();
    });

    it('notifies subscribers on status changes', async () => {
        const events: EngineModule.SoundEngineState[] = [];
        const unsubscribe = engine.soundEngine.subscribe((state) => events.push({ ...state }));
        await engine.soundEngine.setPreset(getPresetById(DEFAULT_PRESET_ID)!);
        expect(events.map((e) => e.status)).toContain('ready');
        unsubscribe();
    });
});

describe('engine startup preset resolution', () => {
    it('honors the persisted soundPreset, falling back with an error for unknown ids', async () => {
        // Fresh module registry: the engine singleton reads the store once,
        // on first context creation.
        vi.resetModules();
        const storeModule = await import('@/stores/useSettingsStore');
        const state = storeModule.useSettingsStore.getState();
        storeModule.useSettingsStore.setState({
            full: { ...state.full, audio: { ...state.full.audio, soundPreset: 'mystery-preset' } },
        });
        const freshEngine = await import('@/audio/engine');
        freshEngine.soundEngine.getAudioContext();
        expect(freshEngine.soundEngine.getState()).toMatchObject({
            presetId: 'mystery-preset',
            status: 'error',
        });
        expect(freshEngine.soundEngine.getState().error).toContain('mystery-preset');
    });
});

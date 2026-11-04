import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as EngineModule from '@/audio/engine';
import type * as LiveInputModule from '@/audio/liveInput';
import { FakeAudioContext, FakeAudioNode, stubAudioContextGlobal } from './fixtures/audioStubs';

/**
 * Live input unit tests: getUserMedia + audio nodes are exercised through
 * recording fakes at the module boundary — no real microphone or audio
 * hardware. Covers the exact constraints object, chain routing
 * (source → inputGain → voiceBus + analyser tap), mute semantics
 * (graph edit, stream stays alive), full teardown and error mapping.
 */

interface FakeMediaStreamSource extends FakeAudioNode {
    stream: unknown;
}

interface FakeAnalyserNode extends FakeAudioNode {
    fftSize: number;
    getByteTimeDomainData: (buffer: Uint8Array) => void;
}

const getUserMediaMock = vi.fn();

function makeError(name: string): Error {
    // DOMException with the exact name a browser would reject with.
    return new DOMException(`mock ${name}`, name);
}

function makeStream(): { stream: MediaStream; tracks: Array<{ stop: ReturnType<typeof vi.fn> }> } {
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    const stream = { getTracks: () => tracks } as unknown as MediaStream;
    return { stream, tracks };
}

function stubMediaDevices(getUserMedia: unknown = getUserMediaMock): void {
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia },
    });
}

let engine: typeof EngineModule;
let mod: typeof LiveInputModule;
let ctx: FakeAudioContext;

beforeAll(async () => {
    stubAudioContextGlobal();

    // Extend the shared recording fake with the two node types live input
    // needs (mic stream source + analyser); jsdom has no Web Audio.
    const proto = FakeAudioContext.prototype as unknown as Record<string, unknown>;
    proto.createMediaStreamSource = function (this: FakeAudioContext, stream: unknown) {
        const node = new FakeAudioNode() as FakeMediaStreamSource;
        node.stream = stream;
        this.createdNodes.push(node);
        return node;
    };
    proto.createAnalyser = function (this: FakeAudioContext) {
        const node = new FakeAudioNode() as FakeAnalyserNode;
        node.fftSize = 256;
        node.getByteTimeDomainData = vi.fn();
        this.createdNodes.push(node);
        return node;
    };

    engine = await import('@/audio/engine');
    mod = await import('@/audio/liveInput');
    ctx = engine.soundEngine.getAudioContext() as unknown as FakeAudioContext;
});

beforeEach(() => {
    getUserMediaMock.mockReset();
    stubMediaDevices();
});

afterEach(() => {
    mod.liveInput.stop();
    mod.liveInput.setMuted(false);
});

/** Start with a resolved two-track stream and wait for status 'on'. */
async function startOn(): Promise<{ stream: MediaStream; tracks: Array<{ stop: ReturnType<typeof vi.fn> }> }> {
    const { stream, tracks } = makeStream();
    getUserMediaMock.mockResolvedValueOnce(stream);
    await mod.liveInput.start();
    return { stream, tracks };
}

function activeInputGain(): FakeAudioNode {
    // inputGain is the node feeding the analyser tap.
    const analyser = mod.liveInput.getAnalyser() as unknown as FakeAnalyserNode;
    return analyser.incoming[0].destination as FakeAudioNode;
}

/** Forward-edge check: does inputGain feed the engine voice bus right now? */
function connectsToVoiceBus(inputGain: FakeAudioNode): boolean {
    return inputGain.connections.some(
        (connection) => connection.destination === engine.soundEngine.getVoiceBus(),
    );
}

describe('live input start (C1-LIVE-START)', () => {
    it('requests getUserMedia with the exact constraints and reports on', async () => {
        const events: string[] = [];
        const unsubscribe = mod.liveInput.subscribe((state) => events.push(state.status));

        await startOn();

        expect(getUserMediaMock).toHaveBeenCalledTimes(1);
        expect(getUserMediaMock).toHaveBeenCalledWith({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            },
        });
        expect(mod.liveInput.getState()).toMatchObject({ status: 'on', muted: false });
        expect(events).toEqual(['starting', 'on']);
        unsubscribe();
    });

    it('routes mic source → modest input gain → engine voice bus, with an analyser tap', async () => {
        const { stream } = await startOn();

        const analyser = mod.liveInput.getAnalyser() as unknown as FakeAnalyserNode;
        const inputGain = analyser.incoming[0].destination as FakeAudioNode;
        const source = inputGain.incoming[0].destination as FakeMediaStreamSource;

        // The mic enters at the same chain input the guitar voices use.
        expect(connectsToVoiceBus(inputGain)).toBe(true);
        expect(source.stream).toBe(stream);
        expect((inputGain as unknown as { gain: { value: number } }).gain.value).toBe(
            mod.LIVE_INPUT_GAIN,
        );
        expect(ctx.createdNodes).toContain(analyser);
    });

    it('is idempotent while starting and while on (no duplicate getUserMedia)', async () => {
        let resolveGm!: (stream: MediaStream) => void;
        getUserMediaMock.mockReturnValueOnce(
            new Promise<MediaStream>((resolve) => {
                resolveGm = resolve;
            }),
        );
        const first = mod.liveInput.start();
        const second = mod.liveInput.start(); // guarded: no second request

        const { stream } = makeStream();
        resolveGm(stream);
        await Promise.all([first, second]);

        expect(getUserMediaMock).toHaveBeenCalledTimes(1);
        expect(mod.liveInput.getState().status).toBe('on');

        await mod.liveInput.start(); // 'on' guard
        expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    });

    it('resumes a suspended context through initSoundEngine on the start gesture', async () => {
        ctx.state = 'suspended';
        ctx.resume.mockClear();
        await startOn();
        expect(ctx.resume).toHaveBeenCalled();
        ctx.state = 'running';
    });
});

describe('mute keeps the stream alive (C4-LIVE-GUARDS, module side)', () => {
    it('disconnects only the voice-bus edge; capture and analyser stay alive', async () => {
        await startOn();
        const inputGain = activeInputGain();

        mod.liveInput.setMuted(true);

        expect(mod.liveInput.getState()).toMatchObject({ status: 'on', muted: true });
        expect(connectsToVoiceBus(inputGain)).toBe(false);
        // Stream alive: only the analyser tap edge remains, no track stopped.
        expect(inputGain.connections).toHaveLength(1);
        expect(mod.liveInput.getAnalyser()).not.toBeNull();
    });

    it('reconnects the voice-bus edge on unmute (instant recovery)', async () => {
        await startOn();
        const inputGain = activeInputGain();

        mod.liveInput.setMuted(true);
        expect(connectsToVoiceBus(inputGain)).toBe(false);
        mod.liveInput.setMuted(false);
        expect(connectsToVoiceBus(inputGain)).toBe(true);
        expect(mod.liveInput.getState().muted).toBe(false);
    });

    it('toggleMuted flips and returns the new value', async () => {
        await startOn();
        expect(mod.liveInput.toggleMuted()).toBe(true);
        expect(mod.liveInput.getState().muted).toBe(true);
        expect(mod.liveInput.toggleMuted()).toBe(false);
        expect(mod.liveInput.getState().muted).toBe(false);
    });

    it('starts muted without ever connecting to the voice bus', async () => {
        mod.liveInput.setMuted(true); // preference before start (nodes absent)
        await startOn();

        const inputGain = activeInputGain();
        expect(mod.liveInput.getState()).toMatchObject({ status: 'on', muted: true });
        expect(connectsToVoiceBus(inputGain)).toBe(false);
        expect(inputGain.connections).toHaveLength(1); // analyser tap only
    });

    it('preserves the mute preference across stop/start (fail-safe restart)', async () => {
        await startOn();
        mod.liveInput.setMuted(true);
        mod.liveInput.stop();
        expect(mod.liveInput.getState()).toMatchObject({ status: 'off', muted: true });

        await startOn();
        expect(mod.liveInput.getState().muted).toBe(true);
        expect(connectsToVoiceBus(activeInputGain())).toBe(false);
    });
});

describe('teardown (C2-LIVE-STOP)', () => {
    it('stops every track, disconnects created nodes, resets state', async () => {
        const { tracks } = await startOn();
        const analyser = mod.liveInput.getAnalyser() as unknown as FakeAnalyserNode;
        const inputGain = analyser.incoming[0].destination as FakeAudioNode;
        const source = inputGain.incoming[0].destination as FakeAudioNode;

        mod.liveInput.stop();

        expect(tracks[0].stop).toHaveBeenCalledTimes(1);
        expect(tracks[1].stop).toHaveBeenCalledTimes(1);
        for (const node of [source, inputGain, analyser]) {
            expect(node.disconnectCalls.some((c) => c.destination === undefined)).toBe(true);
            expect(node.connections).toHaveLength(0);
        }
        expect(mod.liveInput.getState()).toEqual({ status: 'off', muted: false });
        expect(mod.liveInput.getAnalyser()).toBeNull();
    });

    it('stop is a no-op when already off (no track stop, no throw)', async () => {
        mod.liveInput.stop(); // off from the start
        const { tracks } = await startOn();
        mod.liveInput.stop();
        mod.liveInput.stop(); // second stop after teardown

        expect(tracks[0].stop).toHaveBeenCalledTimes(1);
        expect(tracks[1].stop).toHaveBeenCalledTimes(1);
        expect(mod.liveInput.getState().status).toBe('off');
    });

    it('a start that resolves after stop() releases the fresh stream and stays off', async () => {
        let resolveGm!: (stream: MediaStream) => void;
        getUserMediaMock.mockReturnValueOnce(
            new Promise<MediaStream>((resolve) => {
                resolveGm = resolve;
            }),
        );
        const startPromise = mod.liveInput.start();
        mod.liveInput.stop();

        const { stream, tracks } = makeStream();
        resolveGm(stream);
        await startPromise;

        // The stale start must not have gone 'on'; the fresh stream is
        // released immediately (stop() stays authoritative).
        expect(mod.liveInput.getState().status).toBe('off');
        for (const track of tracks) {
            expect(track.stop).toHaveBeenCalledTimes(1);
        }
        expect(mod.liveInput.getAnalyser()).toBeNull();
    });
});

describe('error handling (C3-LIVE-ERR)', () => {
    it.each([
        ['NotAllowedError', 'denied'],
        ['SecurityError', 'denied'],
        ['NotFoundError', 'notfound'],
        ['DevicesNotFoundError', 'notfound'],
        ['TypeError', 'unknown'],
    ] as const)('maps %s to %s (pure mapper)', (name, kind) => {
        expect(mod.mapLiveInputError(makeError(name))).toBe(kind);
    });

    it('maps non-error throwables to unknown', () => {
        expect(mod.mapLiveInputError('nope')).toBe('unknown');
        expect(mod.mapLiveInputError(undefined)).toBe('unknown');
    });

    it('denied permission lands in the UI-facing error state', async () => {
        getUserMediaMock.mockRejectedValueOnce(makeError('NotAllowedError'));
        await mod.liveInput.start();
        expect(mod.liveInput.getState()).toEqual({ status: 'error', errorKind: 'denied', muted: false });
    });

    it('missing device lands in the UI-facing error state', async () => {
        getUserMediaMock.mockRejectedValueOnce(makeError('NotFoundError'));
        await mod.liveInput.start();
        expect(mod.liveInput.getState()).toEqual({ status: 'error', errorKind: 'notfound', muted: false });
    });

    it('unexpected failures land in the unknown error state', async () => {
        getUserMediaMock.mockRejectedValueOnce(makeError('TypeError'));
        await mod.liveInput.start();
        expect(mod.liveInput.getState()).toEqual({ status: 'error', errorKind: 'unknown', muted: false });
    });

    it('missing mediaDevices API (insecure context) is an unknown error, not a crash', async () => {
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
        await mod.liveInput.start();
        expect(mod.liveInput.getState()).toEqual({ status: 'error', errorKind: 'unknown', muted: false });
    });

    it('allows a retry from the error state', async () => {
        getUserMediaMock.mockRejectedValueOnce(makeError('NotAllowedError'));
        await mod.liveInput.start();
        expect(mod.liveInput.getState().status).toBe('error');

        await startOn();
        expect(mod.liveInput.getState().status).toBe('on');
    });
});

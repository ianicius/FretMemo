/**
 * Lightweight AudioContext/AudioNode stubs for unit tests (jsdom has no Web
 * Audio). Nodes record their connections so tests can assert wiring without
 * any real audio hardware.
 */

import { vi } from 'vitest';

export class FakeAudioParam {
    value: number;
    automationCalls: Array<{ method: string; args: unknown[] }> = [];

    constructor(value = 1) {
        this.value = value;
    }

    setValueAtTime(value: number, startTime: number): void {
        this.value = value;
        this.automationCalls.push({ method: 'setValueAtTime', args: [value, startTime] });
    }

    linearRampToValueAtTime(value: number, endTime: number): void {
        this.value = value;
        this.automationCalls.push({ method: 'linearRampToValueAtTime', args: [value, endTime] });
    }

    exponentialRampToValueAtTime(value: number, endTime: number): void {
        this.value = value;
        this.automationCalls.push({ method: 'exponentialRampToValueAtTime', args: [value, endTime] });
    }

    setTargetAtTime(value: number, startTime: number): void {
        this.value = value;
        this.automationCalls.push({ method: 'setTargetAtTime', args: [value, startTime] });
    }

    cancelScheduledValues(startTime: number): void {
        this.automationCalls.push({ method: 'cancelScheduledValues', args: [startTime] });
    }
}

export interface FakeNodeConnection {
    destination: unknown;
    output?: number;
    input?: number;
}

export class FakeAudioNode {
    connections: FakeNodeConnection[] = [];
    disconnectCalls: Array<{ destination?: unknown }> = [];
    /** Nodes that connected INTO this node (reverse edges, for assertions). */
    incoming: FakeNodeConnection[] = [];

    connect(destination: unknown, output?: number, input?: number): unknown {
        this.connections.push({ destination, output, input });
        (destination as { incoming?: FakeNodeConnection[] }).incoming?.push({
            destination: this,
            output,
            input,
        });
        return destination;
    }

    disconnect(destination?: unknown): void {
        this.disconnectCalls.push({ destination });
        if (destination === undefined) {
            this.connections = [];
        } else {
            this.connections = this.connections.filter((c) => c.destination !== destination);
        }
    }
}

export class FakeGainNode extends FakeAudioNode {
    gain = new FakeAudioParam(1);
}

export class FakeBiquadFilterNode extends FakeAudioNode {
    type = 'peaking';
    frequency = new FakeAudioParam(350);
    detune = new FakeAudioParam(0);
    Q = new FakeAudioParam(1);
    gain = new FakeAudioParam(0);
}

export class FakeWaveShaperNode extends FakeAudioNode {
    curve: Float32Array | null = null;
    oversample = 'none';
}

export class FakeDynamicsCompressorNode extends FakeAudioNode {
    threshold = new FakeAudioParam(-24);
    knee = new FakeAudioParam(30);
    ratio = new FakeAudioParam(12);
    attack = new FakeAudioParam(0.003);
    release = new FakeAudioParam(0.25);
}

export class FakeDelayNode extends FakeAudioNode {
    delayTime = new FakeAudioParam(0);
}

export class FakeConvolverNode extends FakeAudioNode {
    buffer: AudioBuffer | null = null;
}

export class FakeOscillatorNode extends FakeAudioNode {
    type = 'sine';
    frequency = new FakeAudioParam(440);
    detune = new FakeAudioParam(0);

    start = vi.fn();
    stop = vi.fn();
}

export class FakeAudioBufferSourceNode extends FakeAudioNode {
    buffer: AudioBuffer | null = null;
    playbackRate = new FakeAudioParam(1);

    start = vi.fn();
    stop = vi.fn();
}

export class FakeAudioBuffer {
    numberOfChannels: number;
    length: number;
    sampleRate: number;
    private channels: Float32Array[];

    constructor(numberOfChannels: number, length: number, sampleRate: number) {
        this.numberOfChannels = numberOfChannels;
        this.length = length;
        this.sampleRate = sampleRate;
        this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    }

    /** Mirrors the real AudioBuffer duration (seconds). */
    get duration(): number {
        return this.length / this.sampleRate;
    }

    getChannelData(channel: number): Float32Array {
        return this.channels[channel];
    }
}

export class FakeAudioContext {
    static lastInstance: FakeAudioContext | null = null;

    currentTime = 0;
    sampleRate = 48000;
    state: 'running' | 'suspended' = 'running';
    destination = new FakeAudioNode();

    createdNodes: unknown[] = [];

    resume = vi.fn(async () => {
        this.state = 'running';
    });

    constructor() {
        FakeAudioContext.lastInstance = this;
    }

    createGain(): FakeGainNode {
        return this.record(new FakeGainNode());
    }

    createBiquadFilter(): FakeBiquadFilterNode {
        return this.record(new FakeBiquadFilterNode());
    }

    createWaveShaper(): FakeWaveShaperNode {
        return this.record(new FakeWaveShaperNode());
    }

    createDynamicsCompressor(): FakeDynamicsCompressorNode {
        return this.record(new FakeDynamicsCompressorNode());
    }

    createDelay(): FakeDelayNode {
        return this.record(new FakeDelayNode());
    }

    createConvolver(): FakeConvolverNode {
        return this.record(new FakeConvolverNode());
    }

    createOscillator(): FakeOscillatorNode {
        return this.record(new FakeOscillatorNode());
    }

    createBufferSource(): FakeAudioBufferSourceNode {
        return this.record(new FakeAudioBufferSourceNode());
    }

    createBuffer(numberOfChannels: number, length: number, sampleRate: number): FakeAudioBuffer {
        return this.record(new FakeAudioBuffer(numberOfChannels, length, sampleRate));
    }

    /** All connections recorded context-wide, as [source, destination]. */
    get connectLog(): Array<[unknown, unknown]> {
        return this.createdNodes.flatMap((node) =>
            (node as FakeAudioNode).connections?.map((c) => [node, c.destination] as [unknown, unknown]) ?? [],
        );
    }

    private record<T>(node: T): T {
        this.createdNodes.push(node);
        return node;
    }
}

/** Restore whatever AudioContext implementation was registered before. */
export function stubAudioContextGlobal(): void {
    vi.stubGlobal('AudioContext', FakeAudioContext);
}

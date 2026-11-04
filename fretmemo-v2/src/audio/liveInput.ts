/**
 * Live microphone input routed through the active sound chain.
 *
 * Topology (see docs/sound-feature.md, "Wejście na żywo"):
 *
 *   mic stream → MediaStreamAudioSourceNode → inputGain ─┬→ voiceBus (engine chain)
 *                                                        └→ analyser (level meter tap)
 *
 * - The mic enters at the SAME point every guitar voice uses
 *   (`soundEngine.getVoiceBus()`), so it flows through the currently
 *   selected preset: amp → drive → EQ → comp → delay → reverb → master.
 *   No engine files are touched — this is the documented public API.
 * - All browser-side signal processing (echo cancellation, noise
 *   suppression, auto gain control) stays OFF: the raw signal must hit
 *   the chain untouched, and echo cancellation gates long sustains.
 * - Mute is a graph edit, not a stream edit: `inputGain` is disconnected
 *   from the voice bus (monitoring stops instantly) while the capture
 *   stream stays alive, so unmuting is equally instant. The analyser tap
 *   stays connected, so the level meter keeps showing the input signal.
 * - Teardown stops EVERY track, disconnects every created node and drops
 *   all references — no leaked streams or graph nodes.
 */

import { getSoundEngineContext, initSoundEngine, soundEngine } from './engine';

export type LiveInputStatus = 'off' | 'starting' | 'on' | 'error';

export type LiveInputErrorKind = 'denied' | 'notfound' | 'unknown';

export interface LiveInputState {
    status: LiveInputStatus;
    /** Present when status === 'error'. */
    errorKind?: LiveInputErrorKind;
    /** True while monitoring output is muted (capture stream stays alive). */
    muted: boolean;
}

export type LiveInputListener = (state: LiveInputState) => void;

/**
 * Exact getUserMedia constraints for live input. Nothing else is requested
 * (in particular no channelCount/deviceId): the three browser DSP toggles
 * are the load-bearing part and must be verbatim.
 */
export const LIVE_INPUT_MEDIA_CONSTRAINTS = {
    audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
    },
} as const;

/**
 * Mic input gain into the voice bus. Slightly below unity so a hot pickup
 * in front of a speaker keeps feedback headroom inside the shared chain.
 */
export const LIVE_INPUT_GAIN = 0.9;

/** Map a getUserMedia failure to a user-facing error kind (pure; unit-tested). */
export function mapLiveInputError(error: unknown): LiveInputErrorKind {
    const name =
        typeof error === 'object' && error !== null && 'name' in error
            ? String((error as { name: unknown }).name)
            : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'notfound';
    return 'unknown';
}

/** Nodes created by one start() session, torn down together in stop(). */
interface LiveInputNodes {
    stream: MediaStream;
    source: MediaStreamAudioSourceNode;
    inputGain: GainNode;
    analyser: AnalyserNode;
}

class LiveInputController {
    private state: LiveInputState = { status: 'off', muted: false };
    private listeners = new Set<LiveInputListener>();
    private nodes: LiveInputNodes | null = null;
    private analyser: AnalyserNode | null = null;
    /**
     * Bumped on every start()/stop() so an async start() that resolves
     * after stop() (e.g. the user dismissed the permission prompt late)
     * recognizes itself as stale and cleans up instead of going 'on'.
     */
    private startGeneration = 0;

    // getState/subscribe/getAnalyser are bound arrow properties: the panel
    // passes them straight to useSyncExternalStore, which must not lose
    // `this` (they double as stable callbacks between renders).

    readonly getState = (): LiveInputState => {
        return this.state;
    };

    readonly subscribe = (listener: LiveInputListener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /** Level-meter tap (null unless status === 'on'). */
    readonly getAnalyser = (): AnalyserNode | null => {
        return this.analyser;
    };

    /**
     * Request the microphone and route it into the engine's voice bus.
     * Call from a user gesture: initSoundEngine() creates/resumes the
     * shared AudioContext and the browser prompts for permission.
     * Idempotent while 'starting'/'on'; retries are allowed from 'error'.
     */
    async start(): Promise<void> {
        if (this.state.status === 'starting' || this.state.status === 'on') {
            return;
        }
        // Engine warm-up is idempotent (context creation + resume-on-gesture).
        initSoundEngine();
        this.startGeneration += 1;
        const generation = this.startGeneration;
        this.setState({ status: 'starting', muted: this.state.muted });

        const mediaDevices = navigator.mediaDevices;
        const getUserMedia = mediaDevices?.getUserMedia.bind(mediaDevices);
        if (!getUserMedia) {
            // No mediaDevices at all (e.g. insecure context): not a permission
            // problem, but live input is still not possible.
            this.setState({ status: 'error', errorKind: 'unknown', muted: this.state.muted });
            return;
        }

        let stream: MediaStream;
        try {
            stream = await getUserMedia(LIVE_INPUT_MEDIA_CONSTRAINTS);
        } catch (error) {
            if (generation !== this.startGeneration) return; // stop() raced us
            this.setState({
                status: 'error',
                errorKind: mapLiveInputError(error),
                muted: this.state.muted,
            });
            return;
        }

        if (generation !== this.startGeneration) {
            // stop() happened while the prompt was open: release the fresh
            // stream immediately and keep the 'off' state stop() set.
            for (const track of stream.getTracks()) {
                track.stop();
            }
            return;
        }

        const ctx = getSoundEngineContext();
        const source = ctx.createMediaStreamSource(stream);
        const inputGain = ctx.createGain();
        inputGain.gain.value = LIVE_INPUT_GAIN;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;

        source.connect(inputGain);
        inputGain.connect(analyser);
        if (!this.state.muted) {
            inputGain.connect(soundEngine.getVoiceBus());
        }

        this.nodes = { stream, source, inputGain, analyser };
        this.analyser = analyser;
        this.setState({ status: 'on', muted: this.state.muted });
    }

    /**
     * Full teardown: stop every track, disconnect every created node,
     * drop references, reset status to 'off'. Mute is preserved across
     * restarts (fail-safe: a re-enable never unmutes by surprise).
     * No-op when already off.
     */
    stop(): void {
        if (this.state.status === 'off') return;
        this.startGeneration += 1; // invalidates any in-flight start()
        this.teardownNodes();
        this.setState({ status: 'off', muted: this.state.muted });
    }

    /**
     * Mute monitoring: disconnect inputGain from the voice bus (the output
     * path) while keeping the capture stream, source and analyser alive.
     * Safe to call when off — it only records the preference then.
     */
    setMuted(muted: boolean): void {
        if (this.state.muted === muted) return;
        this.state = { ...this.state, muted };
        const inputGain = this.nodes?.inputGain;
        if (inputGain) {
            const bus = soundEngine.getVoiceBus();
            if (muted) {
                inputGain.disconnect(bus);
            } else {
                inputGain.connect(bus);
            }
        }
        this.emit();
    }

    /** Toggle mute; returns the new muted value. */
    toggleMuted(): boolean {
        this.setMuted(!this.state.muted);
        return this.state.muted;
    }

    private teardownNodes(): void {
        const nodes = this.nodes;
        this.nodes = null;
        this.analyser = null;
        if (!nodes) return;
        for (const track of nodes.stream.getTracks()) {
            track.stop();
        }
        nodes.source.disconnect();
        nodes.inputGain.disconnect();
        nodes.analyser.disconnect();
    }

    private setState(next: LiveInputState): void {
        this.state = next;
        this.emit();
    }

    private emit(): void {
        for (const listener of [...this.listeners]) {
            try {
                listener(this.state);
            } catch {
                // Listener errors must not break the controller.
            }
        }
    }
}

/** App-wide live input controller singleton. */
export const liveInput = new LiveInputController();

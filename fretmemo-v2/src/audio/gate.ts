/**
 * Noise gate used by the studio global strip.
 * `applyNoiseGate` is the pure twin of `public/sound/engine/gate-worklet.js`.
 */

const readyContexts = new WeakSet<BaseAudioContext>();

/** 1 ms attack, 80 ms release. Matches the worklet sample loop. */
export function applyNoiseGate(input: Float32Array, sampleRate: number, thresholdDb: number): Float32Array {
    const output = new Float32Array(input.length);
    const threshold = Math.pow(10, thresholdDb / 20);
    const attack = Math.exp(-1 / (sampleRate * 0.001));
    const release = Math.exp(-1 / (sampleRate * 0.08));
    let env = 0;
    let gain = 1;
    for (let i = 0; i < input.length; i += 1) {
        const x = input[i];
        const abs = Math.abs(x);
        const coeff = abs > env ? attack : release;
        env = abs + coeff * (env - abs);
        const open = env >= threshold ? 1 : 0;
        const gainCoeff = open > gain ? attack : release;
        gain = open + gainCoeff * (gain - open);
        output[i] = x * gain;
    }
    return output;
}

export function isGateWorkletReady(ctx: BaseAudioContext): boolean {
    return readyContexts.has(ctx);
}

/** Load the gate processor. Safe to call more than once per context. */
export async function loadGateWorklet(ctx: BaseAudioContext): Promise<void> {
    if (readyContexts.has(ctx)) return;
    const worklet = (ctx as BaseAudioContext & { audioWorklet?: { addModule: (url: string) => Promise<void> } }).audioWorklet;
    if (!worklet || typeof AudioWorkletNode === 'undefined') return;
    await worklet.addModule(`${import.meta.env.BASE_URL}sound/engine/gate-worklet.js`);
    readyContexts.add(ctx);
}

export function rms(samples: Float32Array): number {
    if (samples.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
    return Math.sqrt(sum / samples.length);
}

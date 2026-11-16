/** Synthesised drum voices (Groove Lab and the improv backing loops). */

export function scheduleKick(context: AudioContext, time: number, accent = false): void {
    const osc = context.createOscillator();
    const gain = context.createGain();

    const peak = accent ? 0.25 : 0.18;
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + 0.08);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(time);
    osc.stop(time + 0.11);
}

export function scheduleHat(context: AudioContext, time: number, accent = false): void {
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(accent ? 5200 : 4300, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.08 : 0.05, time + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(time);
    osc.stop(time + 0.035);
}

function createNoiseSource(context: AudioContext, durationSec: number): AudioBufferSourceNode {
    const length = Math.max(1, Math.round(context.sampleRate * durationSec));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
        data[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    return source;
}

export function scheduleSnare(context: AudioContext, time: number, accent = false): void {
    const toneOsc = context.createOscillator();
    const toneGain = context.createGain();
    toneOsc.type = "triangle";
    toneOsc.frequency.setValueAtTime(210, time);
    toneOsc.frequency.exponentialRampToValueAtTime(140, time + 0.05);

    toneGain.gain.setValueAtTime(0.0001, time);
    toneGain.gain.exponentialRampToValueAtTime(accent ? 0.14 : 0.11, time + 0.002);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);

    toneOsc.connect(toneGain);
    toneGain.connect(context.destination);
    toneOsc.start(time);
    toneOsc.stop(time + 0.1);

    const noise = createNoiseSource(context, 0.045);
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(2100, time);
    noiseFilter.Q.setValueAtTime(0.7, time);

    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.12, time + 0.0015);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(context.destination);
    noise.start(time);
    noise.stop(time + 0.055);
}

/**
 * Fingered electric-bass stand-in for the improv loops: a sawtooth through a
 * closing low-pass plus a sine on the fundamental for weight. Goes straight to
 * the destination like the drums, so the guitar amp chain never colours it.
 */
export function scheduleBass(context: AudioContext, midi: number, time: number, durationSec: number, velocity = 1): void {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const end = time + Math.max(0.12, durationSec);
    const peak = 0.2 * velocity;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.setValueAtTime(0.8, time);
    filter.frequency.setValueAtTime(1400, time);
    filter.frequency.exponentialRampToValueAtTime(380, time + 0.25);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(peak * 0.55, time + 0.18);
    gain.gain.setValueAtTime(peak * 0.55, end - 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    filter.connect(gain);
    gain.connect(context.destination);
    for (const [type, level] of [["sawtooth", 0.6], ["sine", 0.9]] as const) {
        const osc = context.createOscillator();
        const oscGain = context.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, time);
        oscGain.gain.setValueAtTime(level, time);
        osc.connect(oscGain);
        oscGain.connect(filter);
        osc.start(time);
        osc.stop(end + 0.01);
    }
}

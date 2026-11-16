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

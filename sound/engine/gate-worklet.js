/**
 * Noise gate for the Sound Studio global strip.
 * Keep the envelope in sync with `applyNoiseGate` in src/audio/gate.ts:
 * 1 ms attack, 80 ms release, hard open/close against a linear threshold.
 */
class FretMemoNoiseGate extends AudioWorkletProcessor {
    constructor() {
        super();
        this.env = 0;
        this.gain = 1;
    }

    static get parameterDescriptors() {
        return [
            { name: 'threshold', defaultValue: -40, minValue: -80, maxValue: 0, automationRate: 'k-rate' },
        ];
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0] && inputs[0][0];
        const output = outputs[0] && outputs[0][0];
        if (!input || !output) return true;

        const threshold = Math.pow(10, (parameters.threshold[0] ?? -40) / 20);
        const attack = Math.exp(-1 / (sampleRate * 0.001));
        const release = Math.exp(-1 / (sampleRate * 0.08));

        for (let i = 0; i < input.length; i += 1) {
            const x = input[i];
            const abs = Math.abs(x);
            const coeff = abs > this.env ? attack : release;
            this.env = abs + coeff * (this.env - abs);
            const open = this.env >= threshold ? 1 : 0;
            const gainCoeff = open > this.gain ? attack : release;
            this.gain = open + gainCoeff * (this.gain - open);
            output[i] = x * this.gain;
        }
        return true;
    }
}

registerProcessor('fretmemo-noise-gate', FretMemoNoiseGate);

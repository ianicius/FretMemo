import * as Tone from 'tone';

class AudioEngine {
    private synth: Tone.PolySynth | null = null;
    private metronomeSynth: Tone.MembraneSynth | null = null;
    private isInitialized = false;
    private volume = new Tone.Volume(-10).toDestination();

    public async initialize() {
        if (this.isInitialized) return;

        await Tone.start();

        // Guitar-ish Pluck Synth
        this.synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: {
                attack: 0.005,
                decay: 0.3,
                sustain: 0.1,
                release: 1.5
            }
        }).connect(this.volume);

        // Metronome Click
        this.metronomeSynth = new Tone.MembraneSynth({
            pitchDecay: 0.008,
            octaves: 2,
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.1,
                sustain: 0.01,
                release: 0.01
            }
        }).connect(this.volume);

        this.isInitialized = true;
    }

    public setVolume(db: number) {
        // Map 0-1 to -60db to 0db roughly
        const gain = Tone.gainToDb(db);
        this.volume.volume.rampTo(gain, 0.1);
    }

    public playNote(note: string, duration: string = '8n') {
        if (!this.isInitialized) this.initialize();
        this.synth?.triggerAttackRelease(note, duration);
    }

    public playClick(strong: boolean = false) {
        if (!this.isInitialized) this.initialize();
        const note = strong ? "G5" : "C5";
        this.metronomeSynth?.triggerAttackRelease(note, "32n");
    }

    public getPitch(openNote: string, fret: number): string {
        return Tone.Frequency(openNote).transpose(fret).toNote();
    }

    public stopAll() {
        this.synth?.releaseAll();
    }
}

export const audio = new AudioEngine();

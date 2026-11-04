/**
 * Sound preset data model + built-in registry.
 *
 * A preset is a pure data description of the playback chain:
 * - `amp: 'classic'`  → the built-in Web Audio "classic guitar" amp stage
 *   (body resonance + brightness filter, see chain.ts).
 * - `amp: <nam model id>` → a bundled Neural Amp Modeler model
 *   (NAM A2 "SlimmableContainer" .nam file, see nam.ts); kind must be 'nam'.
 *
 * This module is intentionally dependency-free (no Web Audio, no store) so it
 * can be imported by the settings store, the engine and tests alike.
 */

/** Linear gain multiplier applied right after the voice bus. 1 = neutral. */
export type ChainGainValue = number; // 0..2

/** Waveshaper drive amount. 0 = neutral curve (bypass), 1 = hardest clip. */
export type DriveAmount = number; // 0..1

/** Equaliser trim in dB for one band. 0 = neutral. */
export type EqDecibels = number; // -12..12

/** Compressor amount. 0 = no compression, 1 = firmest setting. */
export type CompAmount = number; // 0..1

/** Wet mix of a parallel send effect (delay / reverb). 0 = dry only. */
export type WetMix = number; // 0..1

/**
 * Values that shape the sound chain. All ranges are declared in
 * `CHAIN_PARAM_RANGES` and validated by the preset tests.
 */
export interface ChainParams {
    /** Pre-amp input gain (linear multiplier). */
    inputGain: ChainGainValue;
    /** Drive / soft-clip amount for the classic amp stage. */
    drive: DriveAmount;
    /** Low shelf gain in dB (200 Hz). */
    bass: EqDecibels;
    /** Mid peaking gain in dB (1 kHz). */
    mid: EqDecibels;
    /** High shelf gain in dB (3.2 kHz). */
    treble: EqDecibels;
    /** Compressor amount. */
    comp: CompAmount;
    /** Delay wet mix (parallel send, ~280 ms, feedback 0.35). */
    delayMix: WetMix;
    /** Reverb wet mix (parallel send, synthetic decaying-noise IR). */
    reverbMix: WetMix;
    /** Post-chain output gain (linear multiplier). */
    outputGain: ChainGainValue;
}

/** Declared value ranges for every `ChainParams` field (validated in tests). */
export const CHAIN_PARAM_RANGES = {
    inputGain: { min: 0, max: 2 },
    drive: { min: 0, max: 1 },
    bass: { min: -12, max: 12 },
    mid: { min: -12, max: 12 },
    treble: { min: -12, max: 12 },
    comp: { min: 0, max: 1 },
    delayMix: { min: 0, max: 1 },
    reverbMix: { min: 0, max: 1 },
    outputGain: { min: 0, max: 2 },
} as const satisfies Record<keyof ChainParams, { min: number; max: number }>;

/** Neutral chain: no drive, no EQ trim, no comp, no wet effects. */
export function neutralChainParams(): ChainParams {
    return {
        inputGain: 1,
        drive: 0,
        bass: 0,
        mid: 0,
        treble: 0,
        comp: 0,
        delayMix: 0,
        reverbMix: 0,
        outputGain: 1,
    };
}

export type SoundPresetKind = 'classic' | 'nam' | 'custom';

export interface SoundPreset {
    /** Stable identifier (persisted in `full.audio.soundPreset`). */
    id: string;
    /**
     * - 'classic': built-in Web Audio amp stage.
     * - 'nam': bundled NAM model (id in `amp`).
     * - 'custom': user-authored preset (not used by built-ins; reserved for
     *   the upcoming Sound screen / .nam import feature).
     */
    kind: SoundPresetKind;
    /** 'classic' or a NAM model id from `NAM_MODELS`. */
    amp: 'classic' | string;
    params: ChainParams;
    /** i18n key for the display name (locales owned by the sound-ui node). */
    nameKey: string;
    /** Optional i18n key for a short description. */
    descriptionKey?: string;
    /** True for presets shipped with the app (vs user-created). */
    builtIn: boolean;
}

/**
 * Bundled NAM models. Every entry has a verified redistributable license —
 * see `public/sound/LICENSES.md` before adding anything here.
 *
 * `file` is relative to `public/sound/` (served under `${BASE_URL}sound/`).
 */
export interface NamModelDescriptor {
    /** Path relative to `public/sound/`. */
    file: string;
    /** Human-readable label (not translated; gear the model captures). */
    label: string;
    /** i18n key for the display name. */
    nameKey: string;
}

export const NAM_MODELS: Record<string, NamModelDescriptor> = {
    'nam-deluxe-a2': {
        file: 'models/deluxe-a2.nam',
        label: 'Fender Deluxe Reverb (A2 capture)',
        nameKey: 'sound.presets.namCleanDeluxe.name',
    },
    'nam-clean-jc': {
        file: 'models/jc.nam',
        label: 'Roland JC-120 (A2 capture)',
        nameKey: 'sound.presets.namCleanJc.name',
    },
    'nam-crunch-ac10': {
        file: 'models/ac10.nam',
        label: 'Vox AC10 (A2 capture)',
        nameKey: 'sound.presets.namCrunchAc10.name',
    },
    'nam-lead-jcm': {
        file: 'models/jcm.nam',
        label: 'Marshall JCM800 (A2 capture)',
        nameKey: 'sound.presets.namLeadJcm.name',
    },
    'nam-high-gain-5153': {
        file: 'models/5153.nam',
        label: 'Boosted EVH 5153 (A2 capture)',
        nameKey: 'sound.presets.namHighGain5153.name',
    },
    'nam-lead-dumble': {
        file: 'models/dumble.nam',
        label: 'Dumble Overdrive Special (A2 capture)',
        nameKey: 'sound.presets.namLeadDumble.name',
    },
    'nam-vintage-ampeg': {
        file: 'models/ampeg.nam',
        label: 'Ampeg V-2 (A2 capture)',
        nameKey: 'sound.presets.namVintageAmpeg.name',
    },
};

/** Id of the preset used out of the box (matches the store default). */
export const DEFAULT_PRESET_ID = 'classic-acoustic';

const BASE_NAME_KEY = 'sound.presets';

/**
 * Built-in presets.
 *
 * NAM presets keep `drive: 0` by design — the models already carry the amp's
 * preamp/poweramp distortion; a waveshaper in front of a NAM model would
 * double-clip. Effect sends (reverb/delay) and EQ trims stay available.
 */
export const BUILT_IN_PRESETS: SoundPreset[] = [
    {
        id: 'classic-acoustic',
        kind: 'classic',
        amp: 'classic',
        params: neutralChainParams(),
        nameKey: `${BASE_NAME_KEY}.classicAcoustic.name`,
        descriptionKey: `${BASE_NAME_KEY}.classicAcoustic.description`,
        builtIn: true,
    },
    {
        id: 'nam-clean-jc',
        kind: 'nam',
        amp: 'nam-clean-jc',
        params: { ...neutralChainParams(), reverbMix: 0.1 },
        nameKey: `${BASE_NAME_KEY}.namCleanJc.name`,
        descriptionKey: `${BASE_NAME_KEY}.namCleanJc.description`,
        builtIn: true,
    },
    {
        id: 'nam-clean-deluxe',
        kind: 'nam',
        amp: 'nam-deluxe-a2',
        params: { ...neutralChainParams(), treble: 1, reverbMix: 0.18 },
        nameKey: `${BASE_NAME_KEY}.namCleanDeluxe.name`,
        descriptionKey: `${BASE_NAME_KEY}.namCleanDeluxe.description`,
        builtIn: true,
    },
    {
        id: 'nam-crunch-ac10',
        kind: 'nam',
        amp: 'nam-crunch-ac10',
        params: { ...neutralChainParams(), inputGain: 1.4, mid: 1.5, delayMix: 0.08, reverbMix: 0.12 },
        nameKey: `${BASE_NAME_KEY}.namCrunchAc10.name`,
        descriptionKey: `${BASE_NAME_KEY}.namCrunchAc10.description`,
        builtIn: true,
    },
    {
        id: 'nam-lead-jcm',
        kind: 'nam',
        amp: 'nam-lead-jcm',
        params: { ...neutralChainParams(), inputGain: 1.7, bass: 1, mid: 2, comp: 0.2, reverbMix: 0.1 },
        nameKey: `${BASE_NAME_KEY}.namLeadJcm.name`,
        descriptionKey: `${BASE_NAME_KEY}.namLeadJcm.description`,
        builtIn: true,
    },
    {
        id: 'nam-high-gain-5153',
        kind: 'nam',
        amp: 'nam-high-gain-5153',
        params: { ...neutralChainParams(), inputGain: 2, treble: 1.5, comp: 0.15, reverbMix: 0.08 },
        nameKey: `${BASE_NAME_KEY}.namHighGain5153.name`,
        descriptionKey: `${BASE_NAME_KEY}.namHighGain5153.description`,
        builtIn: true,
    },
    {
        id: 'nam-lead-dumble',
        kind: 'nam',
        amp: 'nam-lead-dumble',
        params: { ...neutralChainParams(), inputGain: 1.8, comp: 0.15, reverbMix: 0.12 },
        nameKey: `${BASE_NAME_KEY}.namLeadDumble.name`,
        descriptionKey: `${BASE_NAME_KEY}.namLeadDumble.description`,
        builtIn: true,
    },
    {
        id: 'nam-vintage-ampeg',
        kind: 'nam',
        amp: 'nam-vintage-ampeg',
        params: { ...neutralChainParams(), inputGain: 1.2, reverbMix: 0.15 },
        nameKey: `${BASE_NAME_KEY}.namVintageAmpeg.name`,
        descriptionKey: `${BASE_NAME_KEY}.namVintageAmpeg.description`,
        builtIn: true,
    },
];

/** All built-in presets in registry order. */
export function getBuiltinPresets(): SoundPreset[] {
    return [...BUILT_IN_PRESETS];
}

/** Look up a preset by id (built-ins only; unknown ids return undefined). */
export function getPresetById(id: string): SoundPreset | undefined {
    return BUILT_IN_PRESETS.find((preset) => preset.id === id);
}

/** Type guard: is every `ChainParams` field inside its declared range? */
export function isWithinDeclaredRanges(params: ChainParams): boolean {
    return (Object.keys(CHAIN_PARAM_RANGES) as Array<keyof ChainParams>).every((key) => {
        const { min, max } = CHAIN_PARAM_RANGES[key];
        const value = params[key];
        return value >= min && value <= max;
    });
}

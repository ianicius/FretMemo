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
    /** Chorus wet mix (modulated short delay, parallel). */
    chorusMix: WetMix;
    /** Tremolo depth (amplitude LFO). 0 = off. */
    tremoloDepth: WetMix;
    /** Tremolo rate in Hz. */
    tremoloRate: number; // 1..12
    /** Delay wet mix (parallel send). */
    delayMix: WetMix;
    /** Delay time in seconds. */
    delayTime: number; // 0.05..1
    /** Delay feedback (repeats). */
    delayFeedback: number; // 0..0.9
    /** Reverb wet mix (parallel send; IR picked by `SoundPreset.reverb`). */
    reverbMix: WetMix;
    /** Decay of the synthetic "room" reverb in seconds (IR reverbs ignore it). */
    reverbDecay: number; // 0.3..5
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
    chorusMix: { min: 0, max: 1 },
    tremoloDepth: { min: 0, max: 1 },
    tremoloRate: { min: 1, max: 12 },
    delayMix: { min: 0, max: 1 },
    delayTime: { min: 0.05, max: 1 },
    delayFeedback: { min: 0, max: 0.9 },
    reverbMix: { min: 0, max: 1 },
    reverbDecay: { min: 0.3, max: 5 },
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
        chorusMix: 0,
        tremoloDepth: 0,
        tremoloRate: 5,
        delayMix: 0,
        delayTime: 0.28,
        delayFeedback: 0.35,
        reverbMix: 0,
        reverbDecay: 1.6,
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
    /** Cabinet IR id from `IMPULSE_RESPONSES` (kind 'cab'); absent = default cabinet handling. */
    cab?: string;
    /** Reverb IR id from `IMPULSE_RESPONSES` (kind 'reverb'); absent = synthetic room. */
    reverb?: string;
    /** i18n key for the display name (locales owned by the sound-ui node). */
    nameKey: string;
    /** Optional i18n key for a short description. */
    descriptionKey?: string;
    /** True for presets shipped with the app (vs user-created). */
    builtIn: boolean;
    /**
     * Ordered effect blocks. Studio rigs (`assembly: 'blocks'`) play this list.
     * Legacy records gain a derived chain on load so the editor can show them;
     * their audio stays on the historical graph until the user edits.
     */
    chain?: ChainBlock[];
    /** Input, noise gate, tone stack and output. Not blocks. */
    globals?: ChainGlobals;
    /**
     * `'legacy'` — fixed historical graph (built-ins and untouched custom rigs).
     * `'blocks'` — `chain` in list order, tone stack inserted at `globals.toneStackIndex`.
     */
    assembly?: ChainAssembly;
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

/**
 * Bundled impulse responses (`public/sound/irs/`, licenses in LICENSES.md).
 * 'cab' IRs replace the speaker stage after the amp; 'reverb' IRs feed the
 * reverb send. Labels name the gear and are not translated.
 */
export interface ImpulseResponseDescriptor {
    kind: 'cab' | 'reverb';
    file: string;
    label: string;
    /**
     * Cab loudness trim (dB) so every IR plays at the level of the default
     * filter-curve cabinet. Measured 2026-11-20 in Chromium: sawtooth 82/165/330 Hz
     * through the normalized convolver vs `buildCabinetStage`.
     */
    gainDb?: number;
}

export const IMPULSE_RESPONSES: Record<string, ImpulseResponseDescriptor> = {
    'cab-mesa-412': { kind: 'cab', file: 'irs/mesa.wav', label: 'Mesa 4x12 OS', gainDb: 12.3 },
    'cab-celestion-v30': { kind: 'cab', file: 'irs/celestion.wav', label: 'Celestion G12 Vintage', gainDb: 6.3 },
    'cab-eminence': { kind: 'cab', file: 'irs/eminence.wav', label: 'Eminence Governor', gainDb: 14.1 },
    'cab-ampeg-810': { kind: 'cab', file: 'irs/ampeg.wav', label: 'Ampeg 8x10 (bass)', gainDb: 6.5 },
    'reverb-plate': { kind: 'reverb', file: 'irs/plate.wav', label: 'EMT 140 Plate' },
    'reverb-spring': { kind: 'reverb', file: 'irs/spring.wav', label: 'Fender Spring' },
};

/** Cab value meaning "no speaker stage at all" (raw amp, e.g. into a real cab). */
export const CAB_NONE = 'none';

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

/** Hard cap so a chain stays a pedalboard, not an unbounded graph. */
export const MAX_CHAIN_BLOCKS = 10;

export const BLOCK_TYPES = ['amp', 'cab', 'drive', 'comp', 'eq', 'chorus', 'tremolo', 'phaser', 'flanger', 'wah', 'delay', 'reverb'] as const;

/**
 * Drive circuits we wrote. Missing or unknown values stay `soft`, which is
 * the historical tanh clip, so older rigs do not change voice.
 */
export const DRIVE_CHARACTERS = ['soft', 'screamer', 'transparent', 'hard', 'fuzz'] as const;

export type DriveCharacter = (typeof DRIVE_CHARACTERS)[number];

export function driveCharacterOf(value: unknown): DriveCharacter {
    return typeof value === 'string' && (DRIVE_CHARACTERS as readonly string[]).includes(value)
        ? (value as DriveCharacter)
        : 'soft';
}

export type BlockType = (typeof BLOCK_TYPES)[number];

export type ChainAssembly = 'legacy' | 'blocks';

/** Default gate threshold (dBfs). Signals well below this close the gate. */
export const DEFAULT_GATE_THRESHOLD_DB = -40;

export const GATE_THRESHOLD_RANGE = { min: -80, max: 0 } as const;

/**
 * Global strip. `toneStackIndex` is the block index in front of which
 * bass → mid → treble is inserted (chain length = after every block).
 */
export interface ChainGlobals {
    inputGain: ChainGainValue;
    gateEnabled: boolean;
    gateThresholdDb: number;
    bass: EqDecibels;
    mid: EqDecibels;
    treble: EqDecibels;
    outputGain: ChainGainValue;
    toneStackIndex: number;
}

/** One pedal. `params` keys depend on `type` (see `createChainBlock`). */
export interface ChainBlock {
    id: string;
    type: BlockType;
    enabled: boolean;
    params: Record<string, string | number>;
}

export function isBlockType(value: unknown): value is BlockType {
    return typeof value === 'string' && (BLOCK_TYPES as readonly string[]).includes(value);
}

export function createBlockId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `b-${crypto.randomUUID()}`;
    }
    return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function neutralGlobals(toneStackIndex = 0): ChainGlobals {
    const params = neutralChainParams();
    return {
        inputGain: params.inputGain,
        gateEnabled: false,
        gateThresholdDb: DEFAULT_GATE_THRESHOLD_DB,
        bass: params.bass,
        mid: params.mid,
        treble: params.treble,
        outputGain: params.outputGain,
        toneStackIndex,
    };
}

/** Fresh block at a musical (not neutral) setting, so inserting it is audible. */
export function createChainBlock(type: BlockType, id = createBlockId()): ChainBlock {
    switch (type) {
        case 'amp':
            return { id, type, enabled: true, params: { model: 'classic' } };
        case 'cab':
            return { id, type, enabled: true, params: { mode: 'filter' } };
        case 'drive':
            return { id, type, enabled: true, params: { amount: 0.35, character: 'screamer' } };
        case 'comp':
            return { id, type, enabled: true, params: { amount: 0.4 } };
        case 'eq':
            return { id, type, enabled: true, params: { bass: 2, mid: -4, treble: 3 } };
        case 'chorus':
            return { id, type, enabled: true, params: { mix: 0.35 } };
        case 'tremolo':
            return { id, type, enabled: true, params: { depth: 0.4, rate: 5 } };
        case 'phaser':
            return { id, type, enabled: true, params: { depth: 0.65, rate: 0.4 } };
        case 'flanger':
            return { id, type, enabled: true, params: { depth: 0.55, rate: 0.25 } };
        case 'wah':
            return { id, type, enabled: true, params: { depth: 0.75, response: 0.55 } };
        case 'delay':
            return { id, type, enabled: true, params: { mix: 0.25, time: 0.28, feedback: 0.35 } };
        case 'reverb':
            return { id, type, enabled: true, params: { mix: 0.22, decay: 1.6 } };
        default: {
            const unreachable: never = type;
            return unreachable;
        }
    }
}

export function emptyStudio(): { blocks: ChainBlock[]; globals: ChainGlobals } {
    return { blocks: [], globals: neutralGlobals(0) };
}

function num(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Blocks a legacy preset shows in the studio, plus the tone-stack slot that
 * keeps EQ where the historical graph had it (after amp/cab, before time effects).
 * Zero-mix pedals are omitted; the legacy assembler still owns the real audio
 * until the user edits (`assembly` stays `'legacy'`).
 */
export function deriveLegacyStudio(preset: SoundPreset): { blocks: ChainBlock[]; globals: ChainGlobals } {
    const params = preset.params;
    const blocks: ChainBlock[] = [];

    if (params.drive > 0) {
        blocks.push({ id: `${preset.id}-drive`, type: 'drive', enabled: true, params: { amount: params.drive } });
    }
    blocks.push({ id: `${preset.id}-amp`, type: 'amp', enabled: true, params: { model: preset.amp } });

    if (preset.cab === CAB_NONE) {
        // Explicitly no cabinet.
    } else if (preset.cab && IMPULSE_RESPONSES[preset.cab]?.kind === 'cab') {
        blocks.push({
            id: `${preset.id}-cab`,
            type: 'cab',
            enabled: true,
            params: { mode: 'ir', irId: preset.cab },
        });
    } else if (preset.amp !== 'classic' && !preset.amp.startsWith('user-')) {
        blocks.push({ id: `${preset.id}-cab`, type: 'cab', enabled: true, params: { mode: 'filter' } });
    }

    const toneStackIndex = blocks.length;

    if (params.comp > 0) {
        blocks.push({ id: `${preset.id}-comp`, type: 'comp', enabled: true, params: { amount: params.comp } });
    }
    if (params.chorusMix > 0) {
        blocks.push({ id: `${preset.id}-chorus`, type: 'chorus', enabled: true, params: { mix: params.chorusMix } });
    }
    if (params.tremoloDepth > 0) {
        blocks.push({
            id: `${preset.id}-tremolo`,
            type: 'tremolo',
            enabled: true,
            params: { depth: params.tremoloDepth, rate: params.tremoloRate },
        });
    }
    if (params.delayMix > 0) {
        blocks.push({
            id: `${preset.id}-delay`,
            type: 'delay',
            enabled: true,
            params: { mix: params.delayMix, time: params.delayTime, feedback: params.delayFeedback },
        });
    }
    if (params.reverbMix > 0) {
        blocks.push({
            id: `${preset.id}-reverb`,
            type: 'reverb',
            enabled: true,
            params: {
                mix: params.reverbMix,
                decay: params.reverbDecay,
                ...(preset.reverb ? { irId: preset.reverb } : {}),
            },
        });
    }

    return {
        blocks,
        globals: {
            inputGain: params.inputGain,
            gateEnabled: false,
            gateThresholdDb: DEFAULT_GATE_THRESHOLD_DB,
            bass: params.bass,
            mid: params.mid,
            treble: params.treble,
            outputGain: params.outputGain,
            toneStackIndex,
        },
    };
}

/** First enabled amp decides the legacy `amp` field and the sample set. */
export function firstEnabledAmpModel(blocks: ChainBlock[]): string {
    const amp = blocks.find((block) => block.type === 'amp' && block.enabled);
    const model = amp ? amp.params.model : 'classic';
    return typeof model === 'string' && model.length > 0 ? model : 'classic';
}

/**
 * Nylon for a classic amp (or no amp). Electric when the enabled amp block
 * is a NAM model — including user imports.
 */
export function sampleSetForPreset(preset: Pick<SoundPreset, 'amp' | 'assembly' | 'chain'> | null | undefined): 'nylon' | 'electric' {
    if (!preset) return 'nylon';
    if (preset.assembly === 'blocks' && preset.chain) {
        return firstEnabledAmpModel(preset.chain) === 'classic' ? 'nylon' : 'electric';
    }
    return preset.amp !== 'classic' ? 'electric' : 'nylon';
}

/** Best-effort legacy fields so older readers still see a valid preset. */
export function projectStudioFields(
    blocks: ChainBlock[],
    globals: ChainGlobals,
): Pick<SoundPreset, 'amp' | 'params' | 'cab' | 'reverb'> {
    const params = neutralChainParams();
    params.inputGain = globals.inputGain;
    params.bass = globals.bass;
    params.mid = globals.mid;
    params.treble = globals.treble;
    params.outputGain = globals.outputGain;

    let cab: string | undefined;
    let reverb: string | undefined;
    let sawDrive = false;
    let sawComp = false;
    let sawChorus = false;
    let sawTremolo = false;
    let sawDelay = false;
    let sawReverb = false;

    for (const block of blocks) {
        if (!block.enabled) continue;
        if (block.type === 'drive' && !sawDrive) {
            params.drive = num(block.params.amount, 0);
            sawDrive = true;
        } else if (block.type === 'comp' && !sawComp) {
            params.comp = num(block.params.amount, 0);
            sawComp = true;
        } else if (block.type === 'chorus' && !sawChorus) {
            params.chorusMix = num(block.params.mix, 0);
            sawChorus = true;
        } else if (block.type === 'tremolo' && !sawTremolo) {
            params.tremoloDepth = num(block.params.depth, 0);
            params.tremoloRate = num(block.params.rate, params.tremoloRate);
            sawTremolo = true;
        } else if (block.type === 'delay' && !sawDelay) {
            params.delayMix = num(block.params.mix, 0);
            params.delayTime = num(block.params.time, params.delayTime);
            params.delayFeedback = num(block.params.feedback, params.delayFeedback);
            sawDelay = true;
        } else if (block.type === 'reverb' && !sawReverb) {
            params.reverbMix = num(block.params.mix, 0);
            params.reverbDecay = num(block.params.decay, params.reverbDecay);
            if (typeof block.params.irId === 'string') reverb = block.params.irId;
            sawReverb = true;
        } else if (block.type === 'cab' && cab === undefined) {
            if (block.params.mode === 'none') cab = CAB_NONE;
            else if (block.params.mode === 'ir' && typeof block.params.irId === 'string') cab = block.params.irId;
        }
    }

    return {
        amp: firstEnabledAmpModel(blocks),
        params,
        ...(cab ? { cab } : {}),
        ...(reverb ? { reverb } : {}),
    };
}

export function insertBlock(
    blocks: ChainBlock[],
    globals: ChainGlobals,
    index: number,
    block: ChainBlock,
): { blocks: ChainBlock[]; globals: ChainGlobals } {
    if (blocks.length >= MAX_CHAIN_BLOCKS) return { blocks, globals };
    const at = Math.max(0, Math.min(index, blocks.length));
    const next = blocks.slice();
    next.splice(at, 0, block);
    const toneStackIndex = at <= globals.toneStackIndex ? globals.toneStackIndex + 1 : globals.toneStackIndex;
    return { blocks: next, globals: { ...globals, toneStackIndex } };
}

export function removeBlock(
    blocks: ChainBlock[],
    globals: ChainGlobals,
    index: number,
): { blocks: ChainBlock[]; globals: ChainGlobals } {
    if (index < 0 || index >= blocks.length) return { blocks, globals };
    const next = blocks.filter((_, i) => i !== index);
    const toneStackIndex = index < globals.toneStackIndex ? Math.max(0, globals.toneStackIndex - 1) : globals.toneStackIndex;
    return { blocks: next, globals: { ...globals, toneStackIndex: Math.min(toneStackIndex, next.length) } };
}

export function moveBlock(
    blocks: ChainBlock[],
    globals: ChainGlobals,
    index: number,
    direction: -1 | 1,
): { blocks: ChainBlock[]; globals: ChainGlobals } {
    const target = index + direction;
    if (index < 0 || target < 0 || index >= blocks.length || target >= blocks.length) {
        return { blocks, globals };
    }
    const next = blocks.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    let toneStackIndex = globals.toneStackIndex;
    if (index < toneStackIndex && target >= toneStackIndex) toneStackIndex -= 1;
    else if (index >= toneStackIndex && target < toneStackIndex) toneStackIndex += 1;
    return { blocks: next, globals: { ...globals, toneStackIndex } };
}

/** Type guard: is every `ChainParams` field inside its declared range? */
export function isWithinDeclaredRanges(params: ChainParams): boolean {
    return (Object.keys(CHAIN_PARAM_RANGES) as Array<keyof ChainParams>).every((key) => {
        const { min, max } = CHAIN_PARAM_RANGES[key];
        const value = params[key];
        return value >= min && value <= max;
    });
}

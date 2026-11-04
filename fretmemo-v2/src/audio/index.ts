/**
 * Sound engine module: presets, chain builders, NAM loader and the engine
 * singleton. See docs/sound-engine.md for the architecture overview.
 */

export * from './presets';
export * from './chain';
export * from './engine';
export {
    loadNamNode,
    isSlimmableContainerJson,
    getNamModelUrl,
    getEngineAssetBaseUrl,
    MAX_LOADED_NAM_NODES,
    type NamLoadResult,
    type NamLoadErrorCode,
} from './nam';
export {
    ensureSamplerLoaded,
    isSamplerReady,
    loadSampler,
    pickSampleMidi,
    computeSampleRate,
    playSampleVoice,
    SAMPLE_LOW_MIDI,
    SAMPLE_HIGH_MIDI,
    SET_TARGET_PEAK,
    SAMPLED_MIDIS,
    type SampleSetId,
    type SampleVoiceHandle,
} from './sampler';

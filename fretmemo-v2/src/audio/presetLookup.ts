/**
 * Resolve a preset id to a built-in or a custom rig without a cycle between
 * the engine and the sound store. The store registers the custom lookup.
 */
import { getPresetById, type SoundPreset } from './presets';

type Lookup = (id: string) => SoundPreset | undefined;

let customLookup: Lookup = () => undefined;

export function registerPresetLookup(lookup: Lookup): void {
    customLookup = lookup;
}

export function lookupPreset(id: string | null | undefined): SoundPreset | undefined {
    if (!id) return undefined;
    return getPresetById(id) ?? customLookup(id);
}

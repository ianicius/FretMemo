/**
 * Audition plumbing for the Sound screen.
 *
 * - `selectSoundPreset` is the ONE sanctioned switch path: it persists the
 *   preset id in the settings store (`full.audio.soundPreset`) AND applies it
 *   to the engine (`soundEngine.setPreset`). Every switch/audition in the UI
 *   goes through it, so the persisted default and the live chain never
 *   diverge at rest.
 * - `playAuditionPhrase` is a fixed musical phrase (strummed chord + short
 *   lick) so parameter and preset changes are directly comparable by ear.
 * - `useAudition` guards against overlapping auditions (single in-flight
 *   phrase regardless of which card/button triggered it) and warms the
 *   engine on the user gesture (autoplay policy).
 */
import { useCallback, useRef, useState } from "react";
import { initSoundEngine, soundEngine } from "@/audio/engine";
import type { SoundPreset } from "@/audio/presets";
import { playChord, playTone } from "@/lib/audio";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { toEnginePreset } from "@/stores/useSoundStore";

/**
 * Switch the global guitar sound: persist `full.audio.soundPreset` and apply
 * the preset to the engine. Custom presets are adapted via `toEnginePreset`
 * (the engine keys NAM loading off `kind`).
 */
export async function selectSoundPreset(preset: SoundPreset): Promise<void> {
    const { full, updateFullSettings } = useSettingsStore.getState();
    if (full.audio.soundPreset !== preset.id) {
        updateFullSettings({ audio: { ...full.audio, soundPreset: preset.id } });
    }
    await soundEngine.setPreset(toEnginePreset(preset));
}

function waitMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fixed audition phrase: an A-major strum followed by a short A-pentatonic
 * lick (chord voicing around the open position, lick on frets 5–9).
 */
export async function playAuditionPhrase(): Promise<void> {
    await playChord([45, 52, 57, 61, 64], 1.4);
    await waitMs(120);
    await playTone(64, 0.45);
    await playTone(67, 0.45);
    await playTone(69, 0.55);
    await playTone(72, 0.9);
}

/** What is currently playing: a preset card audition or the designer draft. */
export type AuditionTarget =
    | { kind: "preset"; id: string }
    | { kind: "draft" };

export interface UseAuditionResult {
    /** Target currently playing, or null when idle. */
    target: AuditionTarget | null;
    isAuditioning: boolean;
    /** Select the preset (persisted + engine) and play the phrase. */
    audition: (preset: SoundPreset) => Promise<void>;
    /**
     * Play the phrase through the chain already applied by the tone designer
     * draft (the designer calls its apply step first).
     */
    auditionDraft: () => Promise<void>;
}

export function useAudition(): UseAuditionResult {
    const [target, setTarget] = useState<AuditionTarget | null>(null);
    const busyRef = useRef(false);

    const audition = useCallback(async (preset: SoundPreset) => {
        if (busyRef.current) return;
        busyRef.current = true;
        setTarget({ kind: "preset", id: preset.id });
        try {
            // First user gesture on this screen: create/resume the context.
            initSoundEngine();
            await selectSoundPreset(preset);
            await playAuditionPhrase();
        } finally {
            busyRef.current = false;
            setTarget(null);
        }
    }, []);

    const auditionDraft = useCallback(async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        setTarget({ kind: "draft" });
        try {
            initSoundEngine();
            await playAuditionPhrase();
        } finally {
            busyRef.current = false;
            setTarget(null);
        }
    }, []);

    return { target, isAuditioning: target !== null, audition, auditionDraft };
}

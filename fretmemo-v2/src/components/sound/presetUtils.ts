/**
 * Display helpers for the Sound screen: preset names, badges, amp options and
 * chain-parameter slider configuration. All user-facing text goes through
 * `t` (react-i18next) except custom preset names, which are stored literally
 * in `nameKey` (see `useSoundStore` conventions).
 */
import type { TFunction } from "i18next";
import { NAM_MODELS, type ChainParams, type SoundPreset } from "@/audio/presets";

/** Simple structural type for the react-i18next translator (keeps helpers testable). */
export type Translate = TFunction;

/** Slider order (top → bottom in the tone designer). */
export const CHAIN_PARAM_ORDER: Array<keyof ChainParams> = [
    "inputGain",
    "drive",
    "bass",
    "mid",
    "treble",
    "comp",
    "delayMix",
    "reverbMix",
    "outputGain",
];

/** Slider step per parameter (kept coarse enough for touch, fine enough to dial in). */
export const CHAIN_PARAM_STEPS: Record<keyof ChainParams, number> = {
    inputGain: 0.05,
    drive: 0.01,
    bass: 0.5,
    mid: 0.5,
    treble: 0.5,
    comp: 0.01,
    delayMix: 0.01,
    reverbMix: 0.01,
    outputGain: 0.05,
};

export type ParamUnit = "db" | "percent" | "x";

export const CHAIN_PARAM_UNITS: Record<keyof ChainParams, ParamUnit> = {
    inputGain: "x",
    drive: "percent",
    bass: "db",
    mid: "db",
    treble: "db",
    comp: "percent",
    delayMix: "percent",
    reverbMix: "percent",
    outputGain: "x",
};

/** i18n key of a parameter label: `sound.designer.params.<key>`. */
export function chainParamLabelKey(key: keyof ChainParams): string {
    return `sound.designer.params.${key}`;
}

/** Formatted percent (0–1 → `35 %`), shared by the designer mixes and the master volume. */
export function formatPercentValue(value: number, t: Translate): string {
    return `${Math.round(value * 100)} ${t("sound.designer.units.percent")}`;
}

/**
 * Formatted value label, e.g. `+1.5 dB`, `35 %`, `1.95x` — no stray spaces:
 * unit separated by a single space only for `dB`/`%`, gain values attach `x`
 * directly. Doubles as the sliders' `aria-valuetext`.
 */
export function formatChainParamValue(key: keyof ChainParams, value: number, t: Translate): string {
    const clean = Number(value.toFixed(2));
    const unit = CHAIN_PARAM_UNITS[key];
    if (unit === "db") {
        const sign = clean > 0 ? "+" : "";
        return `${sign}${clean} ${t("sound.designer.units.db")}`;
    }
    if (unit === "percent") {
        return formatPercentValue(clean, t);
    }
    return `${clean}${t("sound.designer.units.x")}`;
}

/** Display name: built-ins use their i18n key; custom presets store the literal name in `nameKey`. */
export function getPresetName(preset: SoundPreset, t: Translate): string {
    if (preset.kind === "custom") {
        return preset.nameKey;
    }
    return t(preset.nameKey);
}

/** Short character description (built-ins only). */
export function getPresetDescription(preset: SoundPreset, t: Translate): string | null {
    if (preset.kind === "custom" || !preset.descriptionKey) {
        return null;
    }
    return t(preset.descriptionKey);
}

export type PresetBadgeTone = "acoustic" | "nam" | "custom";

export interface PresetBadgeInfo {
    label: string;
    tone: PresetBadgeTone;
}

/** Category badge: Akustyczna / NAM / Własny. */
export function getPresetBadge(preset: SoundPreset, t: Translate): PresetBadgeInfo {
    if (preset.kind === "custom") {
        return { label: t("sound.kind.custom"), tone: "custom" };
    }
    if (preset.amp === "classic") {
        return { label: t("sound.kind.acoustic"), tone: "acoustic" };
    }
    return { label: t("sound.kind.nam"), tone: "nam" };
}

/** Amp options for the tone designer: classic synthesis + every registered NAM model. */
export function getAmpOptions(): Array<{ id: string }> {
    return [{ id: "classic" }, ...Object.keys(NAM_MODELS).map((id) => ({ id }))];
}

/** i18n key of an amp label: `sound.designer.amps.<id>`. */
export function ampLabelKey(amp: string): string {
    return `sound.designer.amps.${amp}`;
}

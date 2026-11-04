import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/locales/en/translation.json";
import pl from "@/locales/pl/translation.json";
import { BUILT_IN_PRESETS } from "@/audio/presets";
import { getAmpOptions } from "../presetUtils";

/**
 * E5-I18N: every t() key used by the Sound UI must resolve in BOTH locales.
 * 1. full structural parity of the `sound` namespace,
 * 2. an explicit list of load-bearing keys (incl. the preset nameKeys declared
 *    in src/audio/presets.ts and the settingsPage.audio additions),
 * 3. a source scan: every static t("...") literal in the Sound components/pages
 *    resolves in both locales.
 */

// vitest runs with the package root as cwd.
const SOUND_DIR = path.resolve(process.cwd(), "src/components/sound");
const SCAN_FILES = [
    path.resolve(SOUND_DIR, "../../pages/Sound.tsx"),
    path.resolve(SOUND_DIR, "../../pages/Settings.tsx"),
    path.join(SOUND_DIR, "PresetCard.tsx"),
    path.join(SOUND_DIR, "SoundSlider.tsx"),
    path.join(SOUND_DIR, "ToneDesigner.tsx"),
    path.join(SOUND_DIR, "LiveInputPanel.tsx"),
    path.join(SOUND_DIR, "presetUtils.ts"),
    path.join(SOUND_DIR, "useAudition.ts"),
];

function flattenLeaves(node: unknown, prefix = ""): string[] {
    if (typeof node !== "object" || node === null) {
        return [prefix];
    }
    return Object.entries(node).flatMap(([key, value]) =>
        flattenLeaves(value, prefix ? `${prefix}.${key}` : key),
    );
}

function resolveKey(root: unknown, key: string): unknown {
    return key.split(".").reduce<unknown>((acc, part) => {
        if (typeof acc === "object" && acc !== null && part in (acc as Record<string, unknown>)) {
            return (acc as Record<string, unknown>)[part];
        }
        return undefined;
    }, root);
}

function leafExists(root: unknown, key: string): boolean {
    const value = resolveKey(root, key);
    return typeof value === "string" || typeof value === "object";
}

describe("sound i18n parity (en + pl)", () => {
    it("the sound namespace has identical leaf keys in both locales", () => {
        const enKeys = flattenLeaves(en.sound).sort();
        const plKeys = flattenLeaves(pl.sound).sort();
        expect(enKeys.length).toBeGreaterThan(40);
        expect(plKeys).toEqual(enKeys);
    });

    it("every required Sound key exists in both locales", () => {
        const required: string[] = [
            "nav.sound",
            "sound.title",
            "sound.subtitle",
            "sound.activeSummary",
            "sound.activeFallback",
            "sound.moreSettings",
            "sound.kind.acoustic",
            "sound.kind.nam",
            "sound.kind.custom",
            "sound.status.active",
            "sound.status.loading",
            "sound.status.ready",
            "sound.status.error",
            "sound.status.retry",
            "sound.actions.select",
            "sound.actions.selected",
            "sound.actions.audition",
            "sound.actions.auditioning",
            "sound.actions.delete",
            "sound.actions.deleteTone",
            "sound.volume.label",
            "sound.volume.hint",
            "sound.custom.emptyTitle",
            "sound.custom.emptyDescription",
            "sound.custom.deleteConfirmTitle",
            "sound.custom.deleteConfirmDescription",
            "sound.custom.deleteConfirmConfirm",
            "sound.custom.deleteConfirmCancel",
            "sound.custom.feedback.deleted",
            "sound.designer.title",
            "sound.designer.summary",
            "sound.designer.description",
            "sound.designer.amp",
            "sound.designer.audition",
            "sound.designer.auditioning",
            "sound.designer.nameLabel",
            "sound.designer.namePlaceholder",
            "sound.designer.nameRequired",
            "sound.designer.save",
            "sound.designer.saving",
            "sound.designer.feedback.saved",
            "sound.designer.feedback.saveFailed",
            // designer param labels: every ChainParams field
            "sound.designer.params.inputGain",
            "sound.designer.params.drive",
            "sound.designer.params.bass",
            "sound.designer.params.mid",
            "sound.designer.params.treble",
            "sound.designer.params.comp",
            "sound.designer.params.delayMix",
            "sound.designer.params.reverbMix",
            "sound.designer.params.outputGain",
            // designer units
            "sound.designer.units.db",
            "sound.designer.units.percent",
            "sound.designer.units.x",
            // settingsPage.audio additions
            "settingsPage.audio.soundPreset",
            "settingsPage.audio.soundPresetHint",
        ];

        // Amp labels for the designer selector (classic + every NAM model).
        const ampKeys = getAmpOptions().map((option) => `sound.designer.amps.${option.id}`);
        // Preset nameKeys + descriptionKeys declared by the engine registry.
        const presetKeys = BUILT_IN_PRESETS.flatMap((preset) =>
            [preset.nameKey, preset.descriptionKey].filter((key): key is string => Boolean(key)),
        );

        for (const key of [...required, ...ampKeys, ...presetKeys]) {
            expect(leafExists(en, key), `missing in en: ${key}`).toBe(true);
            expect(leafExists(pl, key), `missing in pl: ${key}`).toBe(true);
        }
    });

    it("every static t() literal in the Sound sources resolves in both locales", () => {
        const literal = /(?<![\w$.])t\(\s*["']([a-zA-Z0-9_.]+)["']/g;
        const used = new Set<string>();
        for (const file of SCAN_FILES) {
            const source = readFileSync(file, "utf8");
            for (const match of source.matchAll(literal)) {
                used.add(match[1]);
            }
        }
        expect(used.size).toBeGreaterThan(20);
        for (const key of used) {
            expect(leafExists(en, key), `missing in en: ${key} (used in Sound sources)`).toBe(true);
            expect(leafExists(pl, key), `missing in pl: ${key} (used in Sound sources)`).toBe(true);
        }
    });
});

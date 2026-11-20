/**
 * Sound Studio: one surface for the rig editor, preset browser, master
 * volume and live input. The active preset id stays in the settings store.
 * A saved custom rig is what exercises play after a reload.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AudioWaveform, ExternalLink, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { initSoundEngine, soundEngine } from "@/audio/engine";
import {
    BUILT_IN_PRESETS,
    DEFAULT_PRESET_ID,
    deriveLegacyStudio,
    emptyStudio,
    getPresetById,
    neutralChainParams,
    projectStudioFields,
    type SoundPreset,
} from "@/audio/presets";
import { listUserModels, type UserModelMeta } from "@/audio/userModels";
import { LiveInputPanel } from "@/components/sound/LiveInputPanel";
import { formatPercentValue, getPresetName } from "@/components/sound/presetUtils";
import { SoundSlider } from "@/components/sound/SoundSlider";
import { StudioBoard, type StudioEditor } from "@/components/sound/StudioBoard";
import { playAuditionPhrase, selectSoundPreset, useAudition } from "@/components/sound/useAudition";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFeedbackStore } from "@/stores/useFeedbackStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { toEnginePreset, useSoundStore } from "@/stores/useSoundStore";

function editorFromPreset(preset: SoundPreset, name: string): StudioEditor {
    if (preset.assembly === "blocks" && preset.chain && preset.globals) {
        return {
            sourceId: preset.kind === "custom" ? preset.id : null,
            name,
            blocks: preset.chain.map((block) => ({ ...block, params: { ...block.params } })),
            globals: { ...preset.globals },
            dirty: false,
        };
    }
    const derived = deriveLegacyStudio(preset);
    return {
        sourceId: preset.kind === "custom" ? preset.id : null,
        name,
        blocks: derived.blocks,
        globals: derived.globals,
        dirty: false,
    };
}

function draftFromEditor(editor: StudioEditor): SoundPreset {
    const projected = projectStudioFields(editor.blocks, editor.globals);
    return {
        id: editor.sourceId ?? "studio-draft",
        kind: "custom",
        ...projected,
        nameKey: editor.name.trim() || "Draft",
        builtIn: false,
        assembly: "blocks",
        chain: editor.blocks,
        globals: editor.globals,
    };
}

export default function Sound() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const customPresets = useSoundStore((state) => state.customPresets);
    const engine = useSoundStore((state) => state.engine);
    const loadCustomPresets = useSoundStore((state) => state.loadCustomPresets);
    const saveCustomPreset = useSoundStore((state) => state.saveCustomPreset);
    const deleteCustomPreset = useSoundStore((state) => state.deleteCustomPreset);
    const audioSettings = useSettingsStore((state) => state.full.audio);
    const updateFullSettings = useSettingsStore((state) => state.updateFullSettings);
    const enqueueFeedback = useFeedbackStore((state) => state.enqueue);
    const { target, audition } = useAudition();

    const [pendingDelete, setPendingDelete] = useState<SoundPreset | null>(null);
    const [userAmps, setUserAmps] = useState<UserModelMeta[]>([]);
    const [saving, setSaving] = useState(false);
    const [nameError, setNameError] = useState(false);
    const [nameTouched, setNameTouched] = useState(false);
    const [editor, setEditor] = useState<StudioEditor>(() => {
        const savedId = useSettingsStore.getState().full.audio.soundPreset;
        const preset = getPresetById(savedId) ?? getPresetById(DEFAULT_PRESET_ID)!;
        return editorFromPreset(preset, "");
    });
    const [syncedPresetId, setSyncedPresetId] = useState(() => {
        const savedId = useSettingsStore.getState().full.audio.soundPreset;
        return getPresetById(savedId)?.id ?? "";
    });

    useEffect(() => {
        void loadCustomPresets();
        void listUserModels().then(setUserAmps).catch(() => setUserAmps([]));
    }, [loadCustomPresets]);

    const isCustomsLoaded = useSoundStore((state) => state.isLoaded);
    useEffect(() => {
        if (isCustomsLoaded) initSoundEngine();
    }, [isCustomsLoaded]);

    const allPresets = useMemo(
        () => [...BUILT_IN_PRESETS, ...customPresets],
        [customPresets],
    );
    const activePreset = useMemo(
        () => allPresets.find((preset) => preset.id === audioSettings.soundPreset) ?? null,
        [allPresets, audioSettings.soundPreset],
    );

    // Customs arrive after the first paint. Adopt that rig while the editor is
    // still clean. Doing it here, not in an effect, keeps the chain in step
    // with the saved preset without a second render cycle from the effect.
    if (activePreset && !editor.dirty && syncedPresetId !== activePreset.id) {
        setSyncedPresetId(activePreset.id);
        setNameTouched(false);
        setEditor(editorFromPreset(activePreset, getPresetName(activePreset, t)));
    }

    const followsActive = Boolean(
        activePreset && editor.sourceId === (activePreset.kind === "custom" ? activePreset.id : null),
    );
    const shown: StudioEditor = !nameTouched && editor.name === "" && !editor.dirty && followsActive && activePreset
        ? { ...editor, name: getPresetName(activePreset, t) }
        : editor;

    useEffect(() => {
        if (!editor.dirty) return;
        const handle = window.setTimeout(() => {
            void soundEngine.setPreset(toEnginePreset(draftFromEditor(editor)), { force: true });
        }, 120);
        return () => window.clearTimeout(handle);
    }, [editor]);

    const handleSelect = useCallback((preset: SoundPreset) => {
        initSoundEngine();
        setNameError(false);
        setNameTouched(false);
        setSyncedPresetId(preset.id);
        setEditor(editorFromPreset(preset, getPresetName(preset, t)));
        void selectSoundPreset(preset);
    }, [t]);

    const handleNewRig = () => {
        const blank = emptyStudio();
        setNameError(false);
        setNameTouched(true);
        setEditor({
            sourceId: null,
            name: "",
            blocks: blank.blocks,
            globals: blank.globals,
            dirty: true,
        });
    };

    const handleVolumeChange = (percent: number) => {
        if (typeof percent !== "number") return;
        updateFullSettings({
            audio: { ...audioSettings, volume: Math.min(100, Math.max(0, percent)) / 100 },
        });
    };

    const handleSave = async () => {
        const name = shown.name.trim();
        if (!name) {
            setNameError(true);
            return;
        }
        setSaving(true);
        const saved = await saveCustomPreset({
            id: editor.sourceId ?? undefined,
            name,
            amp: "classic",
            params: neutralChainParams(),
            chain: editor.blocks,
            globals: editor.globals,
            assembly: "blocks",
        });
        setSaving(false);
        if (!saved) {
            enqueueFeedback(t("sound.studio.saveFailed"), "error");
            return;
        }
        setNameTouched(false);
        setSyncedPresetId(saved.id);
        setEditor(editorFromPreset(saved, name));
        await selectSoundPreset(saved);
        enqueueFeedback(t("sound.studio.saved", { name }), "success");
    };

    const handleAudition = async () => {
        initSoundEngine();
        // A saved custom rig, or any edited chain, must be rebuilt before the
        // phrase. Reusing a pooled NAM node used to leave the live chain silent
        // until the rig was selected again.
        const hearsChain = editor.dirty || activePreset?.kind === "custom" || activePreset?.assembly === "blocks";
        if (hearsChain) {
            await soundEngine.setPreset(toEnginePreset(draftFromEditor(shown)), { force: true });
            await playAuditionPhrase();
            return;
        }
        if (activePreset) await audition(activePreset);
    };

    const handleConfirmDelete = async () => {
        const deleted = pendingDelete;
        if (!deleted) return;
        setPendingDelete(null);
        await deleteCustomPreset(deleted.id);
        if (useSettingsStore.getState().full.audio.soundPreset === deleted.id) {
            const fallback = getPresetById(DEFAULT_PRESET_ID);
            if (fallback) await selectSoundPreset(fallback);
        }
        if (editor.sourceId === deleted.id) {
            const fallback = getPresetById(DEFAULT_PRESET_ID)!;
            setNameTouched(false);
            setSyncedPresetId(fallback.id);
            setEditor(editorFromPreset(fallback, getPresetName(fallback, t)));
        }
        enqueueFeedback(t("sound.custom.feedback.deleted", { name: getPresetName(deleted, t) }), "success");
    };

    const activeName = activePreset ? getPresetName(activePreset, t) : t("sound.activeFallback");

    return (
        <div className="min-w-0 space-y-5 overflow-x-hidden pb-8">
            <header className="space-y-1">
                <h1 className="type-display">{t("sound.title")}</h1>
                <p className="type-body text-muted-foreground">{t("sound.subtitle")}</p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AudioWaveform className="h-4 w-4 text-primary" />
                    <span>{t("sound.activeSummary", { name: activeName })}</span>
                    {engine.status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {engine.status === "error" && <span className="text-destructive">{t("sound.status.error")}</span>}
                </p>
                {editor.dirty && <p className="text-xs text-muted-foreground">{t("sound.studio.unsaved")}</p>}
            </header>

            <StudioBoard
                editor={shown}
                builtInPresets={BUILT_IN_PRESETS}
                customPresets={customPresets}
                activePresetId={audioSettings.soundPreset}
                userAmps={userAmps}
                onUserAmpsChange={setUserAmps}
                onSelectPreset={handleSelect}
                onDeletePreset={setPendingDelete}
                onNewRig={handleNewRig}
                onChange={(next) => {
                    setNameError(false);
                    setEditor(next);
                }}
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Card>
                    <CardContent className="space-y-3 pt-6">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="min-w-[12rem] flex-1 space-y-1">
                                <Label htmlFor="studio-name">{t("sound.studio.nameLabel")}</Label>
                                <Input
                                    id="studio-name"
                                    value={shown.name}
                                    placeholder={t("sound.studio.namePlaceholder")}
                                    onChange={(event) => {
                                        setNameTouched(true);
                                        setNameError(false);
                                        setEditor((current) => ({ ...current, name: event.target.value }));
                                    }}
                                />
                                {nameError && <p className="text-xs text-destructive">{t("sound.designer.nameRequired")}</p>}
                            </div>
                            <Button type="button" variant="outline" onClick={() => void handleAudition()}>
                                {target ? t("sound.actions.auditioning") : t("sound.studio.audition")}
                            </Button>
                            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                                {saving ? t("sound.studio.saving") : t("sound.studio.save")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex items-baseline justify-between gap-2">
                            <Label htmlFor="sound-volume">{t("sound.volume.label")}</Label>
                            <span className="text-sm tabular-nums text-muted-foreground">
                                {formatPercentValue(audioSettings.volume, t)}
                            </span>
                        </div>
                        <SoundSlider
                            id="sound-volume"
                            label={t("sound.volume.label")}
                            valueText={formatPercentValue(audioSettings.volume, t)}
                            value={Math.round(audioSettings.volume * 100)}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={handleVolumeChange}
                        />
                        <p className="text-xs text-muted-foreground">{t("sound.volume.hint")}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <LiveInputPanel embedded />
                </CardContent>
            </Card>

            <div className="flex justify-center">
                <Button variant="link" size="sm" className="h-auto text-muted-foreground" onClick={() => navigate("/me?section=settings")}>
                    {t("sound.moreSettings")}
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Button>
            </div>

            <ConfirmDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingDelete(null);
                }}
                title={t("sound.custom.deleteConfirmTitle")}
                description={t("sound.custom.deleteConfirmDescription", {
                    name: pendingDelete ? getPresetName(pendingDelete, t) : "",
                })}
                confirmLabel={t("sound.custom.deleteConfirmConfirm")}
                cancelLabel={t("sound.custom.deleteConfirmCancel")}
                confirmVariant="destructive"
                onConfirm={() => void handleConfirmDelete()}
            />
        </div>
    );
}

/**
 * Visual tone designer: amp selector + one slider per `ChainParams` field.
 *
 * Live audition model:
 * - Opening the designer does NOT touch the engine. The first change marks the
 *   draft "dirty"; every change (debounced ~180 ms) applies the draft to the
 *   engine as a transient preset (`custom-draft-*` id, adapted via
 *   `toEnginePreset`), so slider moves become audible immediately.
 * - The audition button flushes the pending change and plays the shared
 *   phrase (guarded by the page-level `useAudition`).
 * - Discarding (close without save) restores the base (active) preset chain;
 *   a successful save persists the draft as a custom preset, selects it
 *   (settings + engine) and closes without restoring.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Play, Save, Trash2, Upload } from "lucide-react";
import { DEFAULT_PRESET_ID, getPresetById, neutralChainParams, CHAIN_PARAM_RANGES, type ChainParams, type SoundPreset } from "@/audio/presets";
import type { SoundEngineStatus } from "@/audio/engine";
import { soundEngine } from "@/audio/engine";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useFeedbackStore } from "@/stores/useFeedbackStore";
import { toEnginePreset, useSoundStore } from "@/stores/useSoundStore";
import {
    deleteUserModel,
    listUserModels,
    saveUserModel,
    UserModelError,
    type UserModelMeta,
} from "@/audio/userModels";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslation } from "react-i18next";
import { selectSoundPreset } from "./useAudition";
import { SoundSlider } from "./SoundSlider";
import {
    CHAIN_PARAM_ORDER,
    CHAIN_PARAM_STEPS,
    ampLabelKey,
    chainParamLabelKey,
    formatChainParamValue,
    getAmpOptions,
} from "./presetUtils";

interface ToneDesignerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Draft anchor: the currently active preset (or null → neutral classic). */
    basePreset: SoundPreset | null;
    onAuditionDraft: () => Promise<void>;
    /** True while the draft phrase is playing (shared audition guard). */
    auditioningDraft: boolean;
}

const DRAFT_ID_PREFIX = "custom-draft-";
const APPLY_DEBOUNCE_MS = 180;

export function ToneDesigner({
    open,
    onOpenChange,
    basePreset,
    onAuditionDraft,
    auditioningDraft,
}: ToneDesignerProps) {
    const { t } = useTranslation();
    const enqueueFeedback = useFeedbackStore((state) => state.enqueue);
    const engine = useSoundStore((state) => state.engine);
    const saveCustomPreset = useSoundStore((state) => state.saveCustomPreset);

    const [amp, setAmp] = useState("classic");
    const [params, setParams] = useState<ChainParams>(() => basePreset?.params ?? neutralChainParams());
    const [name, setName] = useState("");
    const [nameError, setNameError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [userAmps, setUserAmps] = useState<UserModelMeta[]>([]);
    const [importing, setImporting] = useState(false);
    const [importErrorKey, setImportErrorKey] = useState<string | null>(null);
    const [ampPendingDelete, setAmpPendingDelete] = useState<UserModelMeta | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Refresh the user-imported amp list whenever the designer opens.
    useEffect(() => {
        if (!open) return;
        void listUserModels().then(setUserAmps);
    }, [open]);

    // Refs mirror state/props for the open/close transition effect, which
    // deliberately runs on `open` transitions only.
    const basePresetRef = useRef<SoundPreset | null>(basePreset);
    basePresetRef.current = basePreset;
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;
    const prevOpenRef = useRef(false);
    const applyTimerRef = useRef<number | null>(null);
    const draftVersionRef = useRef(0);
    const lastAppliedSignatureRef = useRef<string | null>(null);

    /** Apply the current draft to the engine (transient preset, unique id per apply). */
    const applyDraft = useCallback(() => {
        const signature = JSON.stringify({ amp, params });
        if (signature === lastAppliedSignatureRef.current) {
            return Promise.resolve();
        }
        lastAppliedSignatureRef.current = signature;
        draftVersionRef.current += 1;
        const draft = {
            id: `${DRAFT_ID_PREFIX}${draftVersionRef.current}`,
            kind: "custom" as const,
            amp,
            params,
            nameKey: name,
            builtIn: false,
        };
        return soundEngine.setPreset(toEnginePreset(draft));
    }, [amp, params, name]);

    const clearApplyTimer = useCallback(() => {
        if (applyTimerRef.current !== null) {
            window.clearTimeout(applyTimerRef.current);
            applyTimerRef.current = null;
        }
    }, []);

    // Debounced live apply while the designer is open and dirty.
    useEffect(() => {
        if (!open || !dirty) {
            return;
        }
        clearApplyTimer();
        applyTimerRef.current = window.setTimeout(() => {
            applyTimerRef.current = null;
            void applyDraft();
        }, APPLY_DEBOUNCE_MS);
        return clearApplyTimer;
    }, [open, dirty, amp, params, applyDraft, clearApplyTimer]);

    // Open/close transitions: reset the draft on open, restore the base chain
    // on discard (close without save).
    useEffect(() => {
        const wasOpen = prevOpenRef.current;
        prevOpenRef.current = open;
        if (open && !wasOpen) {
            const base = basePresetRef.current;
            setAmp(base?.amp ?? "classic");
            setParams(base?.params ?? neutralChainParams());
            setName("");
            setNameError(false);
            setSaving(false);
            setDirty(false);
            lastAppliedSignatureRef.current = null;
            return;
        }
        if (!open && wasOpen) {
            clearApplyTimer();
            if (dirtyRef.current) {
                void soundEngine.setPreset(
                    toEnginePreset(
                        basePresetRef.current ??
                            getPresetById(DEFAULT_PRESET_ID) ?? {
                                id: DEFAULT_PRESET_ID,
                                kind: "classic",
                                amp: "classic",
                                params: neutralChainParams(),
                                nameKey: "sound.presets.classicAcoustic.name",
                                builtIn: true,
                            },
                    ),
                );
            }
        }
    }, [open, clearApplyTimer]);

    // Safety net: restoring when unmounted mid-edit (e.g. route change).
    useEffect(() => {
        return () => {
            if (prevOpenRef.current && dirtyRef.current) {
                void soundEngine.setPreset(
                    toEnginePreset(
                        basePresetRef.current ??
                            getPresetById(DEFAULT_PRESET_ID) ?? {
                                id: DEFAULT_PRESET_ID,
                                kind: "classic",
                                amp: "classic",
                                params: neutralChainParams(),
                                nameKey: "sound.presets.classicAcoustic.name",
                                builtIn: true,
                            },
                    ),
                );
            }
        };
    }, []);

    const markDirty = () => setDirty(true);

    const handleParamChange = (key: keyof ChainParams, value: number) => {
        markDirty();
        setParams((prev) => ({ ...prev, [key]: value }));
    };

    const handleAmpChange = (value: string) => {
        markDirty();
        setAmp(value);
    };

    /** Import a user .nam file: validate, store locally, list and select it. */
    const handleImportFile = async (file: File) => {
        setImporting(true);
        setImportErrorKey(null);
        try {
            const bytes = await file.arrayBuffer();
            const meta = await saveUserModel(file.name.replace(/\.nam$/i, ""), bytes);
            setUserAmps((previous) => [meta, ...previous]);
            handleAmpChange(meta.id);
            enqueueFeedback(t("sound.designer.import.success", { name: meta.name }), "success");
        } catch (error) {
            const code = error instanceof UserModelError ? error.code : "storage-error";
            setImportErrorKey(`sound.designer.import.errors.${code}`);
        } finally {
            setImporting(false);
        }
    };

    const confirmDeleteUserAmp = async () => {
        const model = ampPendingDelete;
        if (!model) return;
        setAmpPendingDelete(null);
        await deleteUserModel(model.id);
        setUserAmps((previous) => previous.filter((amp) => amp.id !== model.id));
        if (amp === model.id) {
            handleAmpChange("classic");
        }
        enqueueFeedback(t("sound.designer.import.deleted", { name: model.name }), "success");
    };

    /** Flush the pending draft change, then play the shared phrase. */
    const handleAudition = async () => {
        markDirty();
        clearApplyTimer();
        await applyDraft();
        await onAuditionDraft();
    };

    const handleSave = async () => {
        const trimmed = name.trim();
        if (trimmed.length === 0) {
            setNameError(true);
            return;
        }
        setSaving(true);
        try {
            const saved = await saveCustomPreset({ name: trimmed, amp, params });
            if (!saved) {
                enqueueFeedback(t("sound.designer.feedback.saveFailed"), "error");
                return;
            }
            // Select the saved preset (persisted + engine) before closing so
            // the discard-restore logic (dirty → false) leaves it in place.
            setDirty(false);
            dirtyRef.current = false;
            lastAppliedSignatureRef.current = null;
            await selectSoundPreset(saved);
            enqueueFeedback(t("sound.designer.feedback.saved", { name: saved.nameKey }), "success");
            onOpenChange(false);
        } finally {
            setSaving(false);
        }
    };

    const draftStatus: SoundEngineStatus | null = engine.presetId.startsWith(DRAFT_ID_PREFIX)
        ? engine.status
        : null;

    return (
        <div className="space-y-6">
            <p className="text-sm text-muted-foreground">{t("sound.designer.description")}</p>

            <FormField id="designer-amp" label={t("sound.designer.amp")}>
                <div className="flex items-center gap-2">
                    <Select
                        value={amp}
                        onChange={(event) => handleAmpChange(event.target.value)}
                        className="flex-1"
                    >
                        {getAmpOptions().map((option) => (
                            <option key={option.id} value={option.id}>
                                {t(ampLabelKey(option.id))}
                            </option>
                        ))}
                        {userAmps.map((model) => (
                            <option key={model.id} value={model.id}>
                                {model.name} (user)
                            </option>
                        ))}
                    </Select>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".nam,application/json"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void handleImportFile(file);
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={importing}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {t("sound.designer.import.label")}
                    </Button>
                </div>
                {importErrorKey && (
                    <p className="text-xs text-destructive" role="alert">
                        {t(importErrorKey)}
                    </p>
                )}
                {amp.startsWith("user-") && (
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{t("sound.designer.import.userNote")}</span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const model = userAmps.find((ampMeta) => ampMeta.id === amp);
                                if (model) setAmpPendingDelete(model);
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                            {t("sound.designer.import.deleteAmp")}
                        </Button>
                    </div>
                )}
                <p className="text-xs text-muted-foreground">{t("sound.designer.import.licenseNote")}</p>
            </FormField>

            <ConfirmDialog
                open={ampPendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open) setAmpPendingDelete(null);
                }}
                title={t("sound.designer.import.deleteConfirmTitle")}
                description={t("sound.designer.import.deleteConfirmDesc", {
                    name: ampPendingDelete?.name ?? "",
                })}
                confirmLabel={t("sound.designer.import.deleteAmp")}
                confirmVariant="destructive"
                onConfirm={() => void confirmDeleteUserAmp()}
            />

            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                {CHAIN_PARAM_ORDER.map((key) => {
                    const range = CHAIN_PARAM_RANGES[key];
                    return (
                        <div key={key} className="space-y-2">
                            <div className="flex items-baseline justify-between gap-2">
                                <Label htmlFor={`designer-param-${key}`}>{t(chainParamLabelKey(key))}</Label>
                                <span className="type-mono text-xs tabular-nums text-muted-foreground">
                                    {formatChainParamValue(key, params[key], t)}
                                </span>
                            </div>
                            <SoundSlider
                                id={`designer-param-${key}`}
                                label={t(chainParamLabelKey(key))}
                                valueText={formatChainParamValue(key, params[key], t)}
                                value={params[key]}
                                min={range.min}
                                max={range.max}
                                step={CHAIN_PARAM_STEPS[key]}
                                onValueChange={(value) => handleParamChange(key, value)}
                            />
                        </div>
                    );
                })}
            </div>

            {draftStatus === "loading" && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("sound.status.loading")}
                </p>
            )}
            {draftStatus === "error" && (
                <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                    {t("sound.status.error")}
                </p>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor="designer-name">{t("sound.designer.nameLabel")}</Label>
                    <Input
                        id="designer-name"
                        value={name}
                        onChange={(event) => {
                            setName(event.target.value);
                            if (nameError) setNameError(false);
                        }}
                        placeholder={t("sound.designer.namePlaceholder")}
                        aria-invalid={nameError || undefined}
                        maxLength={40}
                    />
                    {nameError && (
                        <p className="text-xs text-destructive">{t("sound.designer.nameRequired")}</p>
                    )}
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" onClick={() => void handleAudition()} disabled={auditioningDraft}>
                        {auditioningDraft ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Play className="mr-2 h-4 w-4" />
                        )}
                        {auditioningDraft ? t("sound.designer.auditioning") : t("sound.designer.audition")}
                    </Button>
                    <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        {saving ? t("sound.designer.saving") : t("sound.designer.save")}
                    </Button>
                </div>
            </div>
        </div>
    );
}

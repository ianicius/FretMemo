/**
 * Sound screen: audition and switch the global guitar sound, design and
 * manage custom presets.
 *
 * Wiring contract (see docs/sound-feature.md):
 * - The active preset id is owned by the SETTINGS store (`full.audio.soundPreset`);
 *   every switch goes through `selectSoundPreset`, which persists it AND calls
 *   `soundEngine.setPreset`, so the engine chain and the persisted default
 *   never diverge at rest.
 * - Custom presets live in `useSoundStore` (IndexedDB); the engine status
 *   mirror drives per-card loading/error states.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AudioWaveform, ExternalLink, Loader2 } from "lucide-react";
import { initSoundEngine } from "@/audio/engine";
import { BUILT_IN_PRESETS, DEFAULT_PRESET_ID, getPresetById, type SoundPreset } from "@/audio/presets";
import { LiveInputPanel } from "@/components/sound/LiveInputPanel";
import { PresetCard } from "@/components/sound/PresetCard";
import { ToneDesigner } from "@/components/sound/ToneDesigner";
import { SoundSlider } from "@/components/sound/SoundSlider";
import { formatPercentValue, getPresetName } from "@/components/sound/presetUtils";
import { selectSoundPreset, useAudition } from "@/components/sound/useAudition";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { SectionCollapse } from "@/components/ui/section-collapse";
import { useFeedbackStore } from "@/stores/useFeedbackStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useSoundStore } from "@/stores/useSoundStore";
import { useTranslation } from "react-i18next";

export default function Sound() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const customPresets = useSoundStore((state) => state.customPresets);
    const engine = useSoundStore((state) => state.engine);
    const loadCustomPresets = useSoundStore((state) => state.loadCustomPresets);
    const deleteCustomPreset = useSoundStore((state) => state.deleteCustomPreset);
    const audioSettings = useSettingsStore((state) => state.full.audio);
    const updateFullSettings = useSettingsStore((state) => state.updateFullSettings);
    const enqueueFeedback = useFeedbackStore((state) => state.enqueue);

    const [designerOpen, setDesignerOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<SoundPreset | null>(null);
    const [pendingDesignerScroll, setPendingDesignerScroll] = useState(false);
    const designerSectionRef = useRef<HTMLDivElement | null>(null);

    const { target, audition, auditionDraft } = useAudition();

    useEffect(() => {
        void loadCustomPresets();
    }, [loadCustomPresets]);

    // Once the custom list is hydrated, warm the engine up (idempotent, no
    // playback — context creation is gesture-free and stays suspended until a
    // real gesture elsewhere). The engine then reports a real status for the
    // restored preset, which makes the active card's "Ready" line
    // deterministic on every path: initial restore, explicit select and the
    // post-delete fallback all converge on "engine ready for the active
    // preset". Gating on `isLoaded` (not on the load promise) keeps this
    // correct under StrictMode's double-invoked effects.
    const isCustomsLoaded = useSoundStore((state) => state.isLoaded);
    useEffect(() => {
        if (isCustomsLoaded) {
            initSoundEngine();
        }
    }, [isCustomsLoaded]);

    // While the custom list is empty the collapsed designer accordion would
    // duplicate the empty-state CTA — the CTA is the single entry point: it
    // reveals the accordion and scrolls it into view.
    const handleOpenDesigner = useCallback(() => {
        setDesignerOpen(true);
        setPendingDesignerScroll(true);
    }, []);

    useEffect(() => {
        if (!pendingDesignerScroll) {
            return;
        }
        // One frame so the accordion (mounted only while open) is in the DOM;
        // existence-checked because jsdom does not implement scrollIntoView.
        const frame = requestAnimationFrame(() => {
            setPendingDesignerScroll(false);
            const node = designerSectionRef.current;
            if (node && typeof node.scrollIntoView === "function") {
                node.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [pendingDesignerScroll]);

    const allPresets = useMemo(
        () => [...BUILT_IN_PRESETS, ...customPresets],
        [customPresets],
    );
    const activePreset = useMemo(
        () => allPresets.find((preset) => preset.id === audioSettings.soundPreset) ?? null,
        [allPresets, audioSettings.soundPreset],
    );

    const handleSelect = useCallback((preset: SoundPreset) => {
        initSoundEngine();
        void selectSoundPreset(preset);
    }, []);

    const handleAudition = useCallback(
        (preset: SoundPreset) => {
            void audition(preset);
        },
        [audition],
    );

    const handleVolumeChange = (percent: number) => {
        if (typeof percent !== "number") return;
        updateFullSettings({
            audio: { ...audioSettings, volume: Math.min(100, Math.max(0, percent)) / 100 },
        });
    };

    const handleConfirmDelete = async () => {
        const deleted = pendingDelete;
        if (!deleted) return;
        setPendingDelete(null);
        await deleteCustomPreset(deleted.id);
        // If the deleted preset was active, fall back to the default sound
        // (persisted + engine) instead of leaving a dangling selection.
        if (useSettingsStore.getState().full.audio.soundPreset === deleted.id) {
            const fallback = getPresetById(DEFAULT_PRESET_ID);
            if (fallback) {
                await selectSoundPreset(fallback);
            }
        }
        enqueueFeedback(
            t("sound.custom.feedback.deleted", { name: getPresetName(deleted, t) }),
            "success",
        );
    };

    const activeName = activePreset
        ? getPresetName(activePreset, t)
        : t("sound.activeFallback");

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-1">
                <h1 className="type-display">{t("sound.title")}</h1>
                <p className="type-body text-muted-foreground">{t("sound.subtitle")}</p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AudioWaveform className="h-4 w-4 text-primary" />
                    <span>{t("sound.activeSummary", { name: activeName })}</span>
                    {engine.status === "loading" && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    )}
                </p>
            </header>

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

            <section aria-label={t("sound.title")} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {allPresets.map((preset) => (
                        <PresetCard
                            key={preset.id}
                            preset={preset}
                            active={preset.id === audioSettings.soundPreset}
                            engineStatus={
                                engine.presetId === preset.id ? engine.status : null
                            }
                            auditioning={target?.kind === "preset" && target.id === preset.id}
                            onSelect={() => handleSelect(preset)}
                            onAudition={() => handleAudition(preset)}
                            onDelete={
                                preset.kind === "custom"
                                    ? () => setPendingDelete(preset)
                                    : undefined
                            }
                        />
                    ))}
                </div>
                {isCustomsLoaded && customPresets.length === 0 && (
                    <EmptyState
                        icon={AudioWaveform}
                        title={t("sound.custom.emptyTitle")}
                        description={t("sound.custom.emptyDescription")}
                        ctaLabel={t("sound.designer.title")}
                        onCtaClick={handleOpenDesigner}
                    />
                )}
            </section>

            {/* Single entry point while the custom list is empty: the collapsed
                accordion would duplicate the empty-state CTA above, so it only
                renders once revealed (open) or once a custom preset exists. The
                neutral graphite hover keeps the trigger from reading as a state
                indicator (the ghost variant's accent tint is olive/gold). */}
            {(designerOpen || !(isCustomsLoaded && customPresets.length === 0)) && (
                <div ref={designerSectionRef} className="scroll-mt-4">
                    <SectionCollapse
                        title={t("sound.designer.title")}
                        summary={t("sound.designer.summary")}
                        open={designerOpen}
                        onOpenChange={setDesignerOpen}
                        className="[&>button:hover]:bg-muted/50"
                    >
                        <ToneDesigner
                            open={designerOpen}
                            onOpenChange={setDesignerOpen}
                            basePreset={activePreset}
                            onAuditionDraft={auditionDraft}
                            auditioningDraft={target?.kind === "draft"}
                        />
                    </SectionCollapse>
                </div>
            )}

            {/* Live input: mic monitoring through the active chain (see
                docs/sound-feature.md). Own collapse state; rendered after the
                tone designer so the preset/designer flow stays on top. */}
            <LiveInputPanel />

            <div className="flex justify-center">
                <Button
                    variant="link"
                    size="sm"
                    className="h-auto text-muted-foreground"
                    onClick={() => navigate("/me?section=settings")}
                >
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

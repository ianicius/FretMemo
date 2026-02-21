import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useFeedbackStore, type AppFeedbackTone } from "@/stores/useFeedbackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useRhythmDojoStore } from "@/stores/useRhythmDojoStore";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { downloadProgressExport, parseJsonFile } from "@/lib/progressTransfer";
import { trackEvent } from "@/lib/analytics";
import { NOTES } from "@/lib/constants";
import { formatPitchClass } from "@/lib/noteNotation";
import { TECHNIQUE_EXERCISES } from "@/data/techniqueExercises";
import {
    INSTRUMENT_LABELS,
    getDefaultTuningForInstrument,
    getTuningByPresetId,
    getTuningPresetId,
    getTuningPresetsForInstrument,
    normalizeInstrumentType,
    normalizeTuning,
} from "@/lib/tuning";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { SectionCollapse } from "@/components/ui/section-collapse";
import { RotateCcw, Volume2, Gamepad2, GraduationCap, Palette, Guitar, Database, CircleHelp, Newspaper, HandHeart, Coffee, Mail, ExternalLink, Search, Settings2, History } from "lucide-react";
import { EXTERNAL_LINKS } from "@/lib/externalLinks";
import { useTranslation } from "react-i18next";

type ConfirmAction = "reset-settings" | "replace-progress-import" | "reset-progress" | null;
type SettingsScope = "global" | "modules" | "data";

const PRACTICE_SCALE_OPTIONS = [
    { id: "major" },
    { id: "minor" },
    { id: "majorPentatonic" },
    { id: "minorPentatonic" },
] as const;

const PRACTICE_NOTE_SEQUENCE_OPTIONS = [
    { id: "random" },
    { id: "minorThirds" },
    { id: "majorThirds" },
    { id: "fourths" },
    { id: "fifths" },
    { id: "sevenths" },
    { id: "majorScale" },
    { id: "naturalMinorScale" },
    { id: "majorPentatonic" },
    { id: "minorPentatonic" },
] as const;

const EAR_INTERVAL_OPTIONS = ["P1", "m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7", "P8"] as const;

function clampInputLatency(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(250, Math.round(value)));
}

export default function Settings() {
    const { t } = useTranslation();
    const quick = useSettingsStore((state) => state.quick);
    const full = useSettingsStore((state) => state.full);
    const modules = useSettingsStore((state) => state.modules);
    const updateQuickSettings = useSettingsStore((state) => state.updateQuickSettings);
    const updateFullSettings = useSettingsStore((state) => state.updateFullSettings);
    const updateModuleSettings = useSettingsStore((state) => state.updateModuleSettings);
    const resetModuleSettings = useSettingsStore((state) => state.resetModuleSettings);
    const resetSettings = useSettingsStore((state) => state.resetSettings);
    const importProgressData = useProgressStore((state) => state.importProgressData);
    const resetProgressData = useProgressStore((state) => state.resetProgressData);
    const streakFreezes = useProgressStore((state) => state.streakFreezes);
    const rhythmInputLatencyMs = useRhythmDojoStore((state) => state.inputLatencyMs);
    const setRhythmInputLatencyMs = useRhythmDojoStore((state) => state.setInputLatencyMs);
    const enqueueFeedback = useFeedbackStore((state) => state.enqueue);
    const importFileInputRef = useRef<HTMLInputElement | null>(null);
    const importModeRef = useRef<"merge" | "replace">("merge");
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeScope, setActiveScope] = useState<SettingsScope>("global");

    const showFeedback = (message: string, tone: AppFeedbackTone = "info") => {
        enqueueFeedback(message, tone);
    };

    const triggerImportPicker = (mode: "merge" | "replace") => {
        importModeRef.current = mode;
        importFileInputRef.current?.click();
    };

    const handleReset = () => {
        setConfirmAction("reset-settings");
    };

    const handleExportProgress = () => {
        try {
            downloadProgressExport(useProgressStore.getState());
            trackEvent("fm_v2_progress_export_clicked");
            showFeedback(t("settingsPage.feedback.exportSuccess"), "success");
        } catch (error) {
            console.error("Failed to export progress data", error);
            showFeedback(t("settingsPage.feedback.exportError"), "error");
            trackEvent("fm_v2_progress_export_failed");
        }
    };

    const handleImportProgressTrigger = (mode: "merge" | "replace") => {
        if (mode === "replace") {
            setConfirmAction("replace-progress-import");
            return;
        }
        triggerImportPicker(mode);
    };

    const handleImportProgressFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file) return;

        try {
            const parsed = await parseJsonFile(file);
            const result = importProgressData(parsed, importModeRef.current);
            showFeedback(result.message, result.success ? "success" : "error");
            trackEvent("fm_v2_progress_import_completed", {
                mode: importModeRef.current,
                success: result.success,
            });
        } catch (error) {
            console.error("Failed to import progress data", error);
            showFeedback(t("settingsPage.feedback.importError"), "error");
            trackEvent("fm_v2_progress_import_failed", {
                mode: importModeRef.current,
            });
        } finally {
            input.value = "";
        }
    };

    const handleResetProgress = () => {
        setConfirmAction("reset-progress");
    };

    const handleConfirmAction = () => {
        if (confirmAction === "reset-settings") {
            resetSettings();
            showFeedback(t("settingsPage.feedback.resetSettingsSuccess"), "success");
            return;
        }
        if (confirmAction === "replace-progress-import") {
            triggerImportPicker("replace");
            return;
        }
        if (confirmAction === "reset-progress") {
            resetProgressData();
            showFeedback(t("settingsPage.feedback.resetProgressSuccess"), "success");
            trackEvent("fm_v2_progress_reset_confirmed");
        }
    };

    const confirmDialogConfig: {
        title: string;
        description: string;
        confirmLabel: string;
        confirmVariant: "default" | "destructive" | "secondary" | "outline" | "ghost" | "link";
    } | null = (() => {
        if (confirmAction === "reset-settings") {
            return {
                title: t("settingsPage.confirm.resetSettings.title"),
                description: t("settingsPage.confirm.resetSettings.description"),
                confirmLabel: t("settingsPage.confirm.resetSettings.confirm"),
                confirmVariant: "destructive",
            };
        }
        if (confirmAction === "replace-progress-import") {
            return {
                title: t("settingsPage.confirm.replaceImport.title"),
                description: t("settingsPage.confirm.replaceImport.description"),
                confirmLabel: t("settingsPage.confirm.replaceImport.confirm"),
                confirmVariant: "destructive",
            };
        }
        if (confirmAction === "reset-progress") {
            return {
                title: t("settingsPage.confirm.resetProgress.title"),
                description: t("settingsPage.confirm.resetProgress.description"),
                confirmLabel: t("settingsPage.confirm.resetProgress.confirm"),
                confirmVariant: "destructive",
            };
        }
        return null;
    })();

    const isConfirmDialogOpen = Boolean(confirmDialogConfig);
    const selectedTuning = normalizeTuning(quick.tuning);
    const instrumentType = normalizeInstrumentType(full.instrument.type);
    const instrumentPresets = getTuningPresetsForInstrument(instrumentType);
    const selectedTuningPresetId = (() => {
        const presetId = getTuningPresetId(selectedTuning);
        return instrumentPresets.some((preset) => preset.id === presetId) ? presetId : "custom";
    })();
    const selectedInstrumentLabel = t(`settingsPage.instrument.instrumentTypes.${instrumentType}`, INSTRUMENT_LABELS[instrumentType]);
    const selectedTuningSummary = selectedTuning.slice().reverse().join("-");
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesQuery = (keywords: string[]) => {
        if (!normalizedQuery) return true;
        return keywords.some((keyword) => keyword.toLowerCase().includes(normalizedQuery));
    };
    const techniqueStartingEntries = useMemo(
        () => Object.entries(modules.technique.startingBpm ?? {}).sort(([left], [right]) => left.localeCompare(right)),
        [modules.technique.startingBpm]
    );

    const showGlobalInstrument = matchesQuery(["profile", "profil", "instrument", "tuning", "strojenie", "notation", "notacja", "left-handed", "leworęczny", "fret", "gryf"]);
    const showGlobalLearning = matchesQuery(["learning", "nauka", "session", "sesja", "auto-advance", "auto", "hints", "podpowiedzi", "difficulty", "trudność", "repetition", "powtórki"]);
    const showGlobalAudio = matchesQuery(["audio", "dźwięk", "volume", "głośność", "sound", "pitch", "strój", "input", "wejście"]);
    const showGlobalAppearance = matchesQuery(["appearance", "wygląd", "theme", "motyw", "display", "widok", "layer", "warstwa"]);
    const showGlobalGame = matchesQuery(["game", "gra", "gamification", "xp", "streak", "seria", "achievement", "osiągnięcia"]);
    const showModulePractice = matchesQuery(["practice defaults", "domyślne treningu", "tempo", "metronome", "metronom", "root", "tonika", "scale", "skala", "sequence", "kolejność", "fret range", "zakres progów"]);
    const showModuleTechnique = matchesQuery(["technique defaults", "domyślne techniki", "starting bpm", "startowe bpm", "history", "historia", "session", "sesja"]);
    const showModuleEar = matchesQuery(["ear training", "trening słuchu", "interval", "interwał", "direction", "kierunek"]);
    const showModuleRhythm = matchesQuery(["rhythm", "rytm", "latency", "opóźnienie", "tap", "strum", "groove"]);
    const showData = matchesQuery(["data", "dane", "backup", "kopia", "import", "eksport", "export", "reset"]);
    const showHelp = matchesQuery(["help", "pomoc", "faq", "blog", "contact", "kontakt", "support", "legacy", "v1"]);
    const hasVisibleGlobal = showGlobalInstrument || showGlobalLearning || showGlobalAudio || showGlobalAppearance || showGlobalGame;
    const hasVisibleModules = showModulePractice || showModuleTechnique || showModuleEar || showModuleRhythm;
    const hasVisibleData = showData || showHelp;

    const handleConfirmDialogOpenChange = (open: boolean) => {
        if (!open) {
            setConfirmAction(null);
        }
    };

    return (
        <div className="space-y-6 pb-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="type-display">{t("settingsPage.title")}</h1>
                    <p className="type-body text-muted-foreground">{t("settingsPage.subtitle")}</p>
                </div>
                <Button variant="outline" onClick={handleReset} className="text-destructive hover:text-destructive">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t("settingsPage.resetAllDefaults")}
                </Button>
            </div>

            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={t("settingsPage.searchPlaceholder")}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant={activeScope === "global" ? "secondary" : "outline"} onClick={() => setActiveScope("global")}>
                            {t("settingsPage.scope.global")}
                        </Button>
                        <Button type="button" size="sm" variant={activeScope === "modules" ? "secondary" : "outline"} onClick={() => setActiveScope("modules")}>
                            {t("settingsPage.scope.modules")}
                        </Button>
                        <Button type="button" size="sm" variant={activeScope === "data" ? "secondary" : "outline"} onClick={() => setActiveScope("data")}>
                            {t("settingsPage.scope.data")}
                        </Button>
                    </div>
                    <p className="type-caption text-muted-foreground">
                        {t("settingsPage.scopeHint")}
                    </p>
                </CardContent>
            </Card>

            {activeScope === "global" && showGlobalInstrument && (
            <SectionCollapse
                title={t("settingsPage.instrument.sectionTitle")}
                summary={t("settingsPage.instrument.sectionSummary", {
                    instrument: selectedInstrumentLabel,
                    strings: selectedTuning.length,
                })}
                defaultOpen
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Guitar className="h-5 w-5" />
                            {t("settingsPage.instrument.cardTitle")}
                        </CardTitle>
                        <CardDescription>{t("settingsPage.instrument.cardDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField
                            id="instrument-type"
                            label={t("settingsPage.instrument.instrumentType")}
                            hint={t("settingsPage.instrument.instrumentTypeHint")}
                        >
                            <Select
                                value={instrumentType}
                                onChange={(event) => {
                                    const nextType = normalizeInstrumentType(event.target.value);
                                    updateFullSettings({ instrument: { ...full.instrument, type: nextType } });
                                    updateQuickSettings({ tuning: getDefaultTuningForInstrument(nextType) });
                                }}
                            >
                                {Object.entries(INSTRUMENT_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {t(`settingsPage.instrument.instrumentTypes.${value}`, label)}
                                    </option>
                                ))}
                            </Select>
                        </FormField>

                        <FormField
                            id="tuning-preset"
                            label={t("settingsPage.instrument.tuningPreset")}
                            hint={t("settingsPage.instrument.tuningPresetHint")}
                        >
                            <Select
                                value={selectedTuningPresetId}
                                onChange={(event) => {
                                    const presetId = event.target.value;
                                    if (presetId === "custom") return;
                                    updateQuickSettings({ tuning: getTuningByPresetId(presetId) });
                                }}
                            >
                                {instrumentPresets.map((preset) => (
                                    <option key={preset.id} value={preset.id}>
                                        {t(`settingsPage.instrument.tuningPresets.${preset.id}`, preset.label)}
                                    </option>
                                ))}
                                <option value="custom">{t("settingsPage.instrument.customCurrent")}</option>
                            </Select>
                            <p className="type-mono text-muted-foreground">
                                {t("settingsPage.instrument.activeTuning", {
                                    strings: selectedTuning.length,
                                    tuning: selectedTuningSummary,
                                })}
                            </p>
                        </FormField>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.instrument.leftHanded")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.instrument.leftHandedHint")}</p>
                            </div>
                            <Switch
                                checked={full.instrument.leftHanded}
                                onCheckedChange={(checked) => updateFullSettings({ instrument: { ...full.instrument, leftHanded: checked } })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.instrument.showFretNumbers")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.instrument.showFretNumbersHint")}</p>
                            </div>
                            <Switch
                                checked={full.instrument.showFretNumbers}
                                onCheckedChange={(checked) => updateFullSettings({ instrument: { ...full.instrument, showFretNumbers: checked } })}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.instrument.noteNaming")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.instrument.noteNamingHint")}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 sm:w-80">
                                {[
                                    { id: "sharps", label: t("settingsPage.instrument.notation.sharps") },
                                    { id: "flats", label: t("settingsPage.instrument.notation.flats") },
                                    { id: "random", label: t("settingsPage.instrument.notation.random") },
                                ].map((notationOption) => (
                                    <Button
                                        key={notationOption.id}
                                        type="button"
                                        size="sm"
                                        variant={full.instrument.notation === notationOption.id ? "secondary" : "outline"}
                                        onClick={() => updateFullSettings({
                                            instrument: {
                                                ...full.instrument,
                                                notation: notationOption.id as typeof full.instrument.notation,
                                            },
                                        })}
                                    >
                                        {notationOption.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {full.instrument.notation === "random" && (
                            <div className="space-y-2">
                                <div className="space-y-0.5">
                                    <Label>{t("settingsPage.instrument.randomization")}</Label>
                                    <p className="text-sm text-muted-foreground">{t("settingsPage.instrument.randomizationHint")}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:w-80">
                                    {[
                                        { id: "session", label: t("settingsPage.instrument.randomizationModes.session") },
                                        { id: "question", label: t("settingsPage.instrument.randomizationModes.question") },
                                    ].map((modeOption) => (
                                        <Button
                                            key={modeOption.id}
                                            type="button"
                                            size="sm"
                                            variant={full.instrument.notationRandomization === modeOption.id ? "secondary" : "outline"}
                                            onClick={() => updateFullSettings({
                                                instrument: {
                                                    ...full.instrument,
                                                    notationRandomization: modeOption.id as typeof full.instrument.notationRandomization,
                                                },
                                            })}
                                        >
                                            {modeOption.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.instrument.accidentalComplexity")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.instrument.accidentalComplexityHint")}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:w-80">
                                {[
                                    { id: "standard", label: t("settingsPage.instrument.accidentalComplexityModes.standard") },
                                    { id: "advanced", label: t("settingsPage.instrument.accidentalComplexityModes.advanced") },
                                ].map((complexityOption) => (
                                    <Button
                                        key={complexityOption.id}
                                        type="button"
                                        size="sm"
                                        variant={full.instrument.accidentalComplexity === complexityOption.id ? "secondary" : "outline"}
                                        onClick={() => updateFullSettings({
                                            instrument: {
                                                ...full.instrument,
                                                accidentalComplexity: complexityOption.id as typeof full.instrument.accidentalComplexity,
                                            },
                                        })}
                                    >
                                        {complexityOption.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "global" && showGlobalLearning && (
            <SectionCollapse
                title={t("settingsPage.learning.sectionTitle")}
                summary={t("settingsPage.learning.sectionSummary", {
                    tempo: quick.tempo,
                    autoAdvance: full.learning.autoAdvance
                        ? t("settingsPage.common.on")
                        : t("settingsPage.common.off"),
                })}
                defaultOpen
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5" />
                            {t("settingsPage.learning.cardTitle")}
                        </CardTitle>
                        <CardDescription>{t("settingsPage.learning.cardDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.learning.difficultyMode")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.learning.difficultyModeHint")}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:w-72">
                                {[
                                    { id: "adaptive", label: t("settingsPage.learning.difficulty.adaptive") },
                                    { id: "manual", label: t("settingsPage.learning.difficulty.manual") },
                                ].map((difficultyOption) => (
                                    <Button
                                        key={difficultyOption.id}
                                        type="button"
                                        size="sm"
                                        variant={full.learning.difficultyMode === difficultyOption.id ? "secondary" : "outline"}
                                        onClick={() => updateFullSettings({
                                            learning: {
                                                ...full.learning,
                                                difficultyMode: difficultyOption.id as typeof full.learning.difficultyMode,
                                            },
                                        })}
                                    >
                                        {difficultyOption.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.learning.autoAdvance")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.learning.autoAdvanceHint")}</p>
                            </div>
                            <Switch
                                checked={full.learning.autoAdvance}
                                onCheckedChange={(checked) => updateFullSettings({ learning: { ...full.learning, autoAdvance: checked } })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.learning.showHints")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.learning.showHintsHint")}</p>
                            </div>
                            <Switch
                                checked={full.learning.showHints}
                                onCheckedChange={(checked) => updateFullSettings({ learning: { ...full.learning, showHints: checked } })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.learning.spacedRepetition")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.learning.spacedRepetitionHint")}</p>
                            </div>
                            <Switch
                                checked={full.learning.spacedRepetition}
                                onCheckedChange={(checked) => updateFullSettings({ learning: { ...full.learning, spacedRepetition: checked } })}
                            />
                        </div>
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "global" && showGlobalAudio && (
            <SectionCollapse
                title={t("settingsPage.audio.sectionTitle")}
                summary={t("settingsPage.audio.sectionSummary", {
                    volume: Math.round(full.audio.volume * 100),
                    tolerance: full.audio.pitchTolerance,
                })}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Volume2 className="h-5 w-5" />
                            {t("settingsPage.audio.cardTitle")}
                        </CardTitle>
                        <CardDescription>{t("settingsPage.audio.cardDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <Label>{t("settingsPage.audio.masterVolume")}</Label>
                                <span className="text-sm text-muted-foreground">{Math.round(full.audio.volume * 100)}%</span>
                            </div>
                            <Slider
                                value={[full.audio.volume * 100]}
                                min={0}
                                max={100}
                                step={1}
                                onValueChange={(vals) => updateFullSettings({ audio: { ...full.audio, volume: vals[0] / 100 } })}
                            />
                        </div>
                        <FormField
                            id="instrument-sound"
                            label={t("settingsPage.audio.instrumentSound")}
                            hint={t("settingsPage.audio.instrumentSoundHint")}
                        >
                            <Select
                                value={full.audio.instrumentSound}
                                onChange={(event) => updateFullSettings({
                                    audio: {
                                        ...full.audio,
                                        instrumentSound: event.target.value as typeof full.audio.instrumentSound,
                                    },
                                })}
                            >
                                <option value="acoustic">{t("settingsPage.audio.sounds.acoustic")}</option>
                                <option value="electric">{t("settingsPage.audio.sounds.electric")}</option>
                                <option value="clean">{t("settingsPage.audio.sounds.clean")}</option>
                            </Select>
                        </FormField>
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <Label>{t("settingsPage.audio.pitchTolerance")}</Label>
                                <span className="text-sm text-muted-foreground">±{full.audio.pitchTolerance}</span>
                            </div>
                            <Slider
                                value={[full.audio.pitchTolerance]}
                                min={5}
                                max={50}
                                step={1}
                                onValueChange={(vals) => updateFullSettings({ audio: { ...full.audio, pitchTolerance: vals[0] } })}
                            />
                            <p className="text-xs text-muted-foreground">{t("settingsPage.audio.pitchToleranceHint")}</p>
                        </div>
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "global" && showGlobalAppearance && (
            <SectionCollapse
                title={t("settingsPage.appearance.sectionTitle")}
                summary={t("settingsPage.appearance.sectionSummary", {
                    theme: t(`settingsPage.appearance.themeOptions.${full.display.theme}`),
                    layer: t(`practice.layers.${full.display.defaultLayer}`),
                })}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Palette className="h-5 w-5" />
                            {t("settingsPage.appearance.cardTitle")}
                        </CardTitle>
                        <CardDescription>{t("settingsPage.appearance.cardDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.appearance.theme")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.appearance.themeHint")}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: "light", label: t("settingsPage.appearance.themeOptions.light") },
                                    { id: "dark", label: t("settingsPage.appearance.themeOptions.dark") },
                                    { id: "system", label: t("settingsPage.appearance.themeOptions.system") },
                                ].map((themeOption) => (
                                    <Button
                                        key={themeOption.id}
                                        type="button"
                                        size="sm"
                                        variant={full.display.theme === themeOption.id ? "secondary" : "outline"}
                                        onClick={() => updateFullSettings({
                                            display: { ...full.display, theme: themeOption.id as typeof full.display.theme },
                                        })}
                                    >
                                        {themeOption.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.appearance.defaultLayer")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.appearance.defaultLayerHint")}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {[
                                    { id: "standard", label: t("practice.layers.standard") },
                                    { id: "heatmap", label: t("practice.layers.heatmap") },
                                    { id: "scale", label: t("practice.layers.scale") },
                                    { id: "intervals", label: t("practice.layers.intervals") },
                                ].map((layer) => (
                                    <Button
                                        key={layer.id}
                                        type="button"
                                        size="sm"
                                        variant={full.display.defaultLayer === layer.id ? "secondary" : "outline"}
                                        onClick={() => updateFullSettings({
                                            display: { ...full.display, defaultLayer: layer.id as typeof full.display.defaultLayer },
                                        })}
                                    >
                                        {layer.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "global" && showGlobalGame && (
            <SectionCollapse
                title={t("settingsPage.gamification.sectionTitle")}
                summary={t("settingsPage.gamification.sectionSummary", {
                    xp: full.gamification.showXPNotes ? t("settingsPage.common.on") : t("settingsPage.common.off"),
                    warnings: full.gamification.showStreakWarnings ? t("settingsPage.common.on") : t("settingsPage.common.off"),
                })}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Gamepad2 className="h-5 w-5" />
                            {t("settingsPage.gamification.cardTitle")}
                        </CardTitle>
                        <CardDescription>{t("settingsPage.gamification.cardDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.gamification.showXpAnimations")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.gamification.showXpAnimationsHint")}</p>
                            </div>
                            <Switch
                                checked={full.gamification.showXPNotes}
                                onCheckedChange={(checked) => updateFullSettings({ gamification: { ...full.gamification, showXPNotes: checked } })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.gamification.streakWarnings")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.gamification.streakWarningsHint")}</p>
                            </div>
                            <Switch
                                checked={full.gamification.showStreakWarnings}
                                onCheckedChange={(checked) => updateFullSettings({ gamification: { ...full.gamification, showStreakWarnings: checked } })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.gamification.achievementToasts")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.gamification.achievementToastsHint")}</p>
                            </div>
                            <Switch
                                checked={full.gamification.showAchievements}
                                onCheckedChange={(checked) => updateFullSettings({ gamification: { ...full.gamification, showAchievements: checked } })}
                            />
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="text-sm font-medium">{t("settingsPage.gamification.streakFreezes")}</span>
                                    <p className="text-xs text-muted-foreground">{t("settingsPage.gamification.streakFreezesHint")}</p>
                                </div>
                                <span className="text-lg font-bold text-primary tabular-nums">
                                    {streakFreezes}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "modules" && showModulePractice && (
            <SectionCollapse
                title={t("settingsPage.modulePractice.sectionTitle")}
                summary={t("settingsPage.modulePractice.sectionSummary", {
                    tempo: quick.tempo,
                    metronome: quick.isMetronomeOn ? t("settingsPage.common.on") : t("settingsPage.common.off"),
                })}
                defaultOpen
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5" />
                            {t("settingsPage.modulePractice.cardTitle")}
                        </CardTitle>
                        <CardDescription>{t("settingsPage.modulePractice.cardDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <Label>{t("settingsPage.modulePractice.defaultTempo")}</Label>
                                <span className="text-sm text-muted-foreground">{quick.tempo} BPM</span>
                            </div>
                            <Slider
                                value={[quick.tempo]}
                                min={30}
                                max={280}
                                step={1}
                                onValueChange={([value]) => updateQuickSettings({ tempo: value })}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.modulePractice.metronomeDefault")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.modulePractice.metronomeDefaultHint")}</p>
                            </div>
                            <Switch
                                checked={quick.isMetronomeOn}
                                onCheckedChange={(checked) => updateQuickSettings({ isMetronomeOn: checked })}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <Label>{t("settingsPage.modulePractice.defaultFretRange")}</Label>
                                <span className="text-sm text-muted-foreground">{quick.fretRange.min} - {quick.fretRange.max}</span>
                            </div>
                            <Slider
                                value={[quick.fretRange.min, quick.fretRange.max]}
                                min={0}
                                max={12}
                                step={1}
                                onValueChange={(values) => {
                                    if (values.length < 2) return;
                                    const min = Math.min(values[0], values[1]);
                                    const max = Math.max(values[0], values[1]);
                                    updateQuickSettings({ fretRange: { min, max } });
                                }}
                            />
                        </div>

                        <FormField id="practice-root-note" label={t("settingsPage.modulePractice.defaultRootNote")}>
                            <Select
                                value={quick.practiceRootNote}
                                onChange={(event) => updateQuickSettings({ practiceRootNote: event.target.value as typeof quick.practiceRootNote })}
                            >
                                {NOTES.map((note) => (
                                    <option key={note} value={note}>
                                        {formatPitchClass(note, full.instrument.notation)}
                                    </option>
                                ))}
                            </Select>
                        </FormField>

                        <div className="space-y-2">
                            <div className="space-y-0.5">
                                <Label>{t("settingsPage.modulePractice.defaultScaleType")}</Label>
                                <p className="text-sm text-muted-foreground">{t("settingsPage.modulePractice.defaultScaleTypeHint")}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {PRACTICE_SCALE_OPTIONS.map((scaleOption) => (
                                    <Button
                                        key={scaleOption.id}
                                        type="button"
                                        size="sm"
                                        variant={quick.practiceScaleType === scaleOption.id ? "secondary" : "outline"}
                                        onClick={() => updateQuickSettings({ practiceScaleType: scaleOption.id })}
                                    >
                                        {t(`practice.setup.scaleTypes.${scaleOption.id}`)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <FormField id="practice-note-sequence" label={t("settingsPage.modulePractice.defaultNoteSequence")}>
                            <Select
                                value={quick.practiceNoteSequence}
                                onChange={(event) => updateQuickSettings({ practiceNoteSequence: event.target.value as typeof quick.practiceNoteSequence })}
                            >
                                {PRACTICE_NOTE_SEQUENCE_OPTIONS.map((sequenceOption) => (
                                    <option key={sequenceOption.id} value={sequenceOption.id}>
                                        {t(`practice.setup.sequenceOptions.${sequenceOption.id}`)}
                                    </option>
                                ))}
                            </Select>
                        </FormField>
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "modules" && (showModuleTechnique || showModuleEar || showModuleRhythm) && (
            <SectionCollapse
                title={t("settingsPage.moduleTraining.sectionTitle")}
                summary={t("settingsPage.moduleTraining.sectionSummary", {
                    technique: techniqueStartingEntries.length,
                    intervals: modules.earTraining.intervals.length,
                })}
            >
                <Card>
                    <CardHeader>
                        <CardTitle>{t("settingsPage.moduleTraining.cardTitle")}</CardTitle>
                        <CardDescription>{t("settingsPage.moduleTraining.cardDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {showModuleTechnique && (
                            <div className="space-y-4">
                                <div className="space-y-0.5">
                                    <Label>{t("settingsPage.moduleTraining.technique.bpmOverrides")}</Label>
                                    <p className="text-sm text-muted-foreground">{t("settingsPage.moduleTraining.technique.bpmOverridesHint")}</p>
                                </div>
                                {techniqueStartingEntries.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{t("settingsPage.moduleTraining.technique.noOverrides")}</p>
                                ) : (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {techniqueStartingEntries.map(([exerciseId, bpm]) => (
                                            <div key={exerciseId} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                                                <p className="text-sm font-medium">
                                                    {t(`technique.${exerciseId}.name`, TECHNIQUE_EXERCISES[exerciseId]?.name ?? exerciseId)}
                                                </p>
                                                <p className="type-mono text-muted-foreground">{bpm} BPM</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => updateModuleSettings("technique", { startingBpm: {} })}
                                    >
                                        {t("settingsPage.moduleTraining.technique.clearBpmOverrides")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => updateModuleSettings("technique", {
                                            bestBpm: {},
                                            sessionsCompleted: {},
                                            lastPracticedAt: {},
                                        })}
                                    >
                                        {t("settingsPage.moduleTraining.technique.clearTechniqueStats")}
                                    </Button>
                                    <Button variant="outline" onClick={() => resetModuleSettings("technique")}>
                                        {t("settingsPage.moduleTraining.technique.resetTechniqueModule")}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {showModuleEar && (
                            <div className="space-y-4">
                                <FormField id="ear-direction" label={t("settingsPage.moduleTraining.ear.defaultDirection")}>
                                    <Select
                                        value={modules.earTraining.direction}
                                        onChange={(event) => updateModuleSettings("earTraining", {
                                            direction: event.target.value as typeof modules.earTraining.direction,
                                        })}
                                    >
                                        <option value="ascending">{t("settingsPage.moduleTraining.ear.directions.ascending")}</option>
                                        <option value="descending">{t("settingsPage.moduleTraining.ear.directions.descending")}</option>
                                        <option value="harmonic">{t("settingsPage.moduleTraining.ear.directions.harmonic")}</option>
                                    </Select>
                                </FormField>
                                <div className="space-y-2">
                                    <div className="space-y-0.5">
                                        <Label>{t("settingsPage.moduleTraining.ear.activeIntervals")}</Label>
                                        <p className="text-sm text-muted-foreground">{t("settingsPage.moduleTraining.ear.activeIntervalsHint")}</p>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                                        {EAR_INTERVAL_OPTIONS.map((interval) => {
                                            const active = modules.earTraining.intervals.includes(interval);
                                            return (
                                                <Button
                                                    key={interval}
                                                    type="button"
                                                    size="sm"
                                                    variant={active ? "secondary" : "outline"}
                                                    onClick={() => {
                                                        const current = modules.earTraining.intervals;
                                                        const next = current.includes(interval)
                                                            ? current.filter((item) => item !== interval)
                                                            : [...current, interval];
                                                        if (next.length === 0) return;
                                                        const ordered = EAR_INTERVAL_OPTIONS.filter((option) => next.includes(option));
                                                        updateModuleSettings("earTraining", { intervals: ordered });
                                                    }}
                                                >
                                                    {interval}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <Button variant="outline" onClick={() => resetModuleSettings("earTraining")}>
                                    {t("settingsPage.moduleTraining.ear.resetDefaults")}
                                </Button>
                            </div>
                        )}

                        {showModuleRhythm && (
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <Label>{t("settingsPage.moduleTraining.rhythm.inputLatency")}</Label>
                                    <span className="text-sm text-muted-foreground">{rhythmInputLatencyMs} ms</span>
                                </div>
                                <Slider
                                    value={[rhythmInputLatencyMs]}
                                    min={0}
                                    max={250}
                                    step={5}
                                    onValueChange={([value]) => setRhythmInputLatencyMs(clampInputLatency(value))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t("settingsPage.moduleTraining.rhythm.inputLatencyHint")}
                                </p>
                                <Button variant="outline" onClick={() => setRhythmInputLatencyMs(0)}>
                                    {t("settingsPage.moduleTraining.rhythm.resetLatency")}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "data" && showData && (
            <SectionCollapse
                title={t("settingsPage.data.sectionTitle")}
                summary={t("settingsPage.data.sectionSummary")}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5" />
                            {t("settingsPage.data.cardTitle")}
                        </CardTitle>
                        <CardDescription>
                            {t("settingsPage.data.cardDescription")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <input
                            ref={importFileInputRef}
                            type="file"
                            accept=".json,application/json"
                            className="hidden"
                            onChange={handleImportProgressFile}
                        />
                        <div className="grid gap-2 sm:grid-cols-3">
                            <Button variant="outline" onClick={handleExportProgress}>
                                {t("settingsPage.data.export")}
                            </Button>
                            <Button variant="outline" onClick={() => handleImportProgressTrigger("merge")}>
                                {t("settingsPage.data.importMerge")}
                            </Button>
                            <Button variant="outline" onClick={() => handleImportProgressTrigger("replace")}>
                                {t("settingsPage.data.importReplace")}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t("settingsPage.data.mergeVsReplace")}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-destructive/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <RotateCcw className="h-5 w-5" />
                            {t("settingsPage.data.dangerTitle")}
                        </CardTitle>
                        <CardDescription>
                            {t("settingsPage.data.dangerDescription")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="destructive" onClick={handleResetProgress}>
                            {t("settingsPage.data.resetAllProgress")}
                        </Button>
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "data" && showHelp && (
            <SectionCollapse
                title={t("settingsPage.help.sectionTitle")}
                summary={t("settingsPage.help.sectionSummary")}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HandHeart className="h-5 w-5" />
                            {t("settingsPage.help.cardTitle")}
                        </CardTitle>
                        <CardDescription>
                            {t("settingsPage.help.cardDescription")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2 sm:grid-cols-4">
                            <Button asChild variant="outline" className="justify-between">
                                <a href={EXTERNAL_LINKS.faq} target="_blank" rel="noreferrer noopener">
                                    <span className="inline-flex items-center gap-2">
                                        <CircleHelp className="h-4 w-4" />
                                        {t("settingsPage.help.faq")}
                                    </span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </Button>
                            <Button asChild variant="outline" className="justify-between">
                                <a href={EXTERNAL_LINKS.blog} target="_blank" rel="noreferrer noopener">
                                    <span className="inline-flex items-center gap-2">
                                        <Newspaper className="h-4 w-4" />
                                        {t("settingsPage.help.blog")}
                                    </span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </Button>
                            <Button asChild variant="outline" className="justify-between">
                                <a href={EXTERNAL_LINKS.contactMailto}>
                                    <span className="inline-flex items-center gap-2">
                                        <Mail className="h-4 w-4" />
                                        {t("settingsPage.help.contact")}
                                    </span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </Button>
                            <Button asChild variant="outline" className="justify-between">
                                <a
                                    href={EXTERNAL_LINKS.legacyV1}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    onClick={() => trackEvent("fm_v2_to_v1_clicked", { cta_id: "settings_help_legacy_v1" })}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <History className="h-4 w-4" />
                                        {t("settingsPage.help.legacyV1")}
                                    </span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </Button>
                        </div>
                        <Button asChild className="control-btn--primary justify-start">
                            <a href={EXTERNAL_LINKS.buyMeCoffee} target="_blank" rel="noreferrer noopener">
                                <Coffee className="h-4 w-4" />
                                {t("settingsPage.help.buyCoffee")}
                            </a>
                        </Button>
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "global" && !hasVisibleGlobal && (
                <Card>
                    <CardContent className="py-10 text-center">
                        <p className="type-body text-muted-foreground">
                            {t("settingsPage.empty.global", { query: searchQuery.trim() })}
                        </p>
                        <Button variant="outline" className="mt-4" onClick={() => setSearchQuery("")}>
                            {t("settingsPage.empty.clearSearch")}
                        </Button>
                    </CardContent>
                </Card>
            )}
            {activeScope === "modules" && !hasVisibleModules && (
                <Card>
                    <CardContent className="py-10 text-center">
                        <p className="type-body text-muted-foreground">
                            {t("settingsPage.empty.modules", { query: searchQuery.trim() })}
                        </p>
                        <Button variant="outline" className="mt-4" onClick={() => setSearchQuery("")}>
                            {t("settingsPage.empty.clearSearch")}
                        </Button>
                    </CardContent>
                </Card>
            )}
            {activeScope === "data" && !hasVisibleData && (
                <Card>
                    <CardContent className="py-10 text-center">
                        <p className="type-body text-muted-foreground">
                            {t("settingsPage.empty.data", { query: searchQuery.trim() })}
                        </p>
                        <Button variant="outline" className="mt-4" onClick={() => setSearchQuery("")}>
                            {t("settingsPage.empty.clearSearch")}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {confirmDialogConfig && (
                <ConfirmDialog
                    open={isConfirmDialogOpen}
                    onOpenChange={handleConfirmDialogOpenChange}
                    title={confirmDialogConfig.title}
                    description={confirmDialogConfig.description}
                    confirmLabel={confirmDialogConfig.confirmLabel}
                    confirmVariant={confirmDialogConfig.confirmVariant}
                    onConfirm={handleConfirmAction}
                />
            )}
        </div>
    );
}

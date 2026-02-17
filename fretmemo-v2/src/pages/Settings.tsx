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
import { RotateCcw, Volume2, Gamepad2, GraduationCap, Palette, Guitar, Database, CircleHelp, Newspaper, HandHeart, Coffee, Mail, ExternalLink, Search, Settings2 } from "lucide-react";
import { EXTERNAL_LINKS } from "@/lib/externalLinks";

type ConfirmAction = "reset-settings" | "replace-progress-import" | "reset-progress" | null;
type SettingsScope = "global" | "modules" | "data";

const PRACTICE_SCALE_OPTIONS = [
    { id: "major", label: "Major" },
    { id: "minor", label: "Minor" },
    { id: "majorPentatonic", label: "Major Pentatonic" },
    { id: "minorPentatonic", label: "Minor Pentatonic" },
] as const;

const PRACTICE_NOTE_SEQUENCE_OPTIONS = [
    { id: "random", label: "Random" },
    { id: "minorThirds", label: "Minor Thirds" },
    { id: "majorThirds", label: "Major Thirds" },
    { id: "fourths", label: "Fourths" },
    { id: "fifths", label: "Fifths" },
    { id: "sevenths", label: "Sevenths" },
    { id: "majorScale", label: "Major Scale" },
    { id: "naturalMinorScale", label: "Natural Minor Scale" },
    { id: "majorPentatonic", label: "Major Pentatonic" },
    { id: "minorPentatonic", label: "Minor Pentatonic" },
] as const;

const EAR_INTERVAL_OPTIONS = ["P1", "m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7", "P8"] as const;

function clampInputLatency(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(250, Math.round(value)));
}

export default function Settings() {
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
            showFeedback("Progress data exported.", "success");
        } catch (error) {
            console.error("Failed to export progress data", error);
            showFeedback("Could not export progress data. Please try again.", "error");
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
            showFeedback("Could not import progress data. Make sure the file is valid JSON.", "error");
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
            showFeedback("Settings reset to defaults.", "success");
            return;
        }
        if (confirmAction === "replace-progress-import") {
            triggerImportPicker("replace");
            return;
        }
        if (confirmAction === "reset-progress") {
            resetProgressData();
            showFeedback("All progress data has been reset.", "success");
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
                title: "Reset Settings?",
                description: "This restores all app settings to defaults. Progress data will not be changed.",
                confirmLabel: "Reset Settings",
                confirmVariant: "destructive",
            };
        }
        if (confirmAction === "replace-progress-import") {
            return {
                title: "Replace Progress Data?",
                description: "This will overwrite your current progress with imported data.",
                confirmLabel: "Replace",
                confirmVariant: "destructive",
            };
        }
        if (confirmAction === "reset-progress") {
            return {
                title: "Reset All Progress Data?",
                description: "This removes practice stats, session history, and unlocked achievements.",
                confirmLabel: "Reset Progress",
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
    const selectedInstrumentLabel = INSTRUMENT_LABELS[instrumentType];
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

    const showGlobalInstrument = matchesQuery(["profile", "instrument", "tuning", "notation", "left-handed", "fret"]);
    const showGlobalLearning = matchesQuery(["learning", "session", "auto-advance", "hints", "difficulty", "repetition"]);
    const showGlobalAudio = matchesQuery(["audio", "volume", "sound", "pitch", "input"]);
    const showGlobalAppearance = matchesQuery(["appearance", "theme", "display", "layer"]);
    const showGlobalGame = matchesQuery(["game", "gamification", "xp", "streak", "achievement"]);
    const showModulePractice = matchesQuery(["practice defaults", "tempo", "metronome", "root", "scale", "sequence", "fret range"]);
    const showModuleTechnique = matchesQuery(["technique defaults", "starting bpm", "history", "session"]);
    const showModuleEar = matchesQuery(["ear training", "interval", "direction"]);
    const showModuleRhythm = matchesQuery(["rhythm", "latency", "tap", "strum", "groove"]);
    const showData = matchesQuery(["data", "backup", "import", "export", "reset"]);
    const showHelp = matchesQuery(["help", "faq", "blog", "contact", "support"]);
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
                    <h1 className="type-display">Settings</h1>
                    <p className="type-body text-muted-foreground">Manage global defaults, module defaults, and safety controls.</p>
                </div>
                <Button variant="outline" onClick={handleReset} className="text-destructive hover:text-destructive">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset All Defaults
                </Button>
            </div>

            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search settings (e.g. tuning, metronome, latency)"
                            className="pl-9"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant={activeScope === "global" ? "secondary" : "outline"} onClick={() => setActiveScope("global")}>
                            Global Defaults
                        </Button>
                        <Button type="button" size="sm" variant={activeScope === "modules" ? "secondary" : "outline"} onClick={() => setActiveScope("modules")}>
                            Module Defaults
                        </Button>
                        <Button type="button" size="sm" variant={activeScope === "data" ? "secondary" : "outline"} onClick={() => setActiveScope("data")}>
                            Data & Support
                        </Button>
                    </div>
                    <p className="type-caption text-muted-foreground">
                        Global defaults affect the whole app. Module defaults prefill specific training modes.
                    </p>
                </CardContent>
            </Card>

            {activeScope === "global" && showGlobalInstrument && (
            <SectionCollapse
                title="Instrument"
                summary={`${selectedInstrumentLabel} · ${selectedTuning.length} strings`}
                defaultOpen
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Guitar className="h-5 w-5" />
                            Instrument
                        </CardTitle>
                        <CardDescription>Configure instrument family, tuning, and handedness.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField
                            id="instrument-type"
                            label="Instrument Type"
                            hint="Changes available tuning presets and string count."
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
                                        {label}
                                    </option>
                                ))}
                            </Select>
                        </FormField>

                        <FormField
                            id="tuning-preset"
                            label="Tuning Preset"
                            hint="Applies to all fretboard-based exercises."
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
                                        {preset.label}
                                    </option>
                                ))}
                                <option value="custom">Custom (Current)</option>
                            </Select>
                            <p className="type-mono text-muted-foreground">
                                Active tuning ({selectedTuning.length} strings): {selectedTuningSummary}
                            </p>
                        </FormField>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Left-Handed Mode</Label>
                                <p className="text-sm text-muted-foreground">Mirror the fretboard for left-handed playing.</p>
                            </div>
                            <Switch
                                checked={full.instrument.leftHanded}
                                onCheckedChange={(checked) => updateFullSettings({ instrument: { ...full.instrument, leftHanded: checked } })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Show Fret Numbers</Label>
                                <p className="text-sm text-muted-foreground">Display numbers on the fretboard visualization.</p>
                            </div>
                            <Switch
                                checked={full.instrument.showFretNumbers}
                                onCheckedChange={(checked) => updateFullSettings({ instrument: { ...full.instrument, showFretNumbers: checked } })}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="space-y-0.5">
                                <Label>Note Naming</Label>
                                <p className="text-sm text-muted-foreground">Choose whether notes are displayed as sharps or flats.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:w-56">
                                {[
                                    { id: "sharps", label: "Sharps (#)" },
                                    { id: "flats", label: "Flats (b)" },
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
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "global" && showGlobalLearning && (
            <SectionCollapse
                title="Practice"
                summary={`${quick.tempo} BPM · ${full.learning.autoAdvance ? "Auto-Advance On" : "Auto-Advance Off"}`}
                defaultOpen
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5" />
                            Learning Behavior
                        </CardTitle>
                        <CardDescription>Adjust how the application helps you learn.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="space-y-0.5">
                                <Label>Difficulty Mode</Label>
                                <p className="text-sm text-muted-foreground">Adaptive mode reacts to your results. Manual keeps fixed behavior.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:w-72">
                                {[
                                    { id: "adaptive", label: "Adaptive" },
                                    { id: "manual", label: "Manual" },
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
                                <Label>Auto-Advance</Label>
                                <p className="text-sm text-muted-foreground">Automatically move to the next question after a correct answer.</p>
                            </div>
                            <Switch
                                checked={full.learning.autoAdvance}
                                onCheckedChange={(checked) => updateFullSettings({ learning: { ...full.learning, autoAdvance: checked } })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Show Hints</Label>
                                <p className="text-sm text-muted-foreground">Display markers or helpers when stuck.</p>
                            </div>
                            <Switch
                                checked={full.learning.showHints}
                                onCheckedChange={(checked) => updateFullSettings({ learning: { ...full.learning, showHints: checked } })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Spaced Repetition</Label>
                                <p className="text-sm text-muted-foreground">Prioritize weak areas and older items.</p>
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
                title="Audio"
                summary={`Volume ${Math.round(full.audio.volume * 100)}% · ±${full.audio.pitchTolerance} cents`}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Volume2 className="h-5 w-5" />
                            Audio & Input
                        </CardTitle>
                        <CardDescription>Manage sound output and microphone input.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <Label>Master Volume</Label>
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
                        <FormField id="instrument-sound" label="Playback Instrument Sound" hint="Used for generated tones and reference notes.">
                            <Select
                                value={full.audio.instrumentSound}
                                onChange={(event) => updateFullSettings({
                                    audio: {
                                        ...full.audio,
                                        instrumentSound: event.target.value as typeof full.audio.instrumentSound,
                                    },
                                })}
                            >
                                <option value="acoustic">Acoustic</option>
                                <option value="electric">Electric</option>
                                <option value="clean">Clean</option>
                            </Select>
                        </FormField>
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <Label>Pitch Tolerance (cents)</Label>
                                <span className="text-sm text-muted-foreground">±{full.audio.pitchTolerance}</span>
                            </div>
                            <Slider
                                value={[full.audio.pitchTolerance]}
                                min={5}
                                max={50}
                                step={1}
                                onValueChange={(vals) => updateFullSettings({ audio: { ...full.audio, pitchTolerance: vals[0] } })}
                            />
                            <p className="text-xs text-muted-foreground">Higher values make detection more forgiving.</p>
                        </div>
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "global" && showGlobalAppearance && (
            <SectionCollapse
                title="Appearance"
                summary={`${full.display.theme === "dark" ? "Dark" : full.display.theme === "light" ? "Light" : "System"} · ${full.display.defaultLayer}`}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Palette className="h-5 w-5" />
                            Appearance & Interface
                        </CardTitle>
                        <CardDescription>Customize how FretMemo looks and feels.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="space-y-0.5">
                                <Label>Theme</Label>
                                <p className="text-sm text-muted-foreground">Choose light, dark, or follow your device preference.</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: "light", label: "Light" },
                                    { id: "dark", label: "Dark" },
                                    { id: "system", label: "System" },
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
                                <Label>Default Fretboard Layer</Label>
                                <p className="text-sm text-muted-foreground">Used as the starting layer in Focus Mode.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {[
                                    { id: "standard", label: "Standard" },
                                    { id: "heatmap", label: "Heatmap" },
                                    { id: "scale", label: "Scale" },
                                    { id: "intervals", label: "Intervals" },
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
                title="Game"
                summary={`${full.gamification.showXPNotes ? "XP Notes On" : "XP Notes Off"} · ${full.gamification.showStreakWarnings ? "Warnings On" : "Warnings Off"}`}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Gamepad2 className="h-5 w-5" />
                            Gamification
                        </CardTitle>
                        <CardDescription>Manage XP, streaks, and rewards.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Show XP Animations</Label>
                                <p className="text-sm text-muted-foreground">Show floating XP summaries after answers.</p>
                            </div>
                            <Switch
                                checked={full.gamification.showXPNotes}
                                onCheckedChange={(checked) => updateFullSettings({ gamification: { ...full.gamification, showXPNotes: checked } })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Streak Warnings</Label>
                                <p className="text-sm text-muted-foreground">Alert when streak is at risk of breaking.</p>
                            </div>
                            <Switch
                                checked={full.gamification.showStreakWarnings}
                                onCheckedChange={(checked) => updateFullSettings({ gamification: { ...full.gamification, showStreakWarnings: checked } })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Achievement Toasts</Label>
                                <p className="text-sm text-muted-foreground">Show unlock notifications during practice sessions.</p>
                            </div>
                            <Switch
                                checked={full.gamification.showAchievements}
                                onCheckedChange={(checked) => updateFullSettings({ gamification: { ...full.gamification, showAchievements: checked } })}
                            />
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="text-sm font-medium">Streak Freezes</span>
                                    <p className="text-xs text-muted-foreground">Protect your streak if you miss a day.</p>
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
                title="Practice Module Defaults"
                summary={`${quick.tempo} BPM · ${quick.isMetronomeOn ? "Metronome On" : "Metronome Off"}`}
                defaultOpen
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5" />
                            Practice Defaults
                        </CardTitle>
                        <CardDescription>Prefill Session Setup for fretboard practice modes.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <Label>Default Tempo</Label>
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
                                <Label>Metronome Armed by Default</Label>
                                <p className="text-sm text-muted-foreground">Enable click track automatically on session start.</p>
                            </div>
                            <Switch
                                checked={quick.isMetronomeOn}
                                onCheckedChange={(checked) => updateQuickSettings({ isMetronomeOn: checked })}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <Label>Default Fret Range</Label>
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

                        <FormField id="practice-root-note" label="Default Root Note">
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
                                <Label>Default Scale Type</Label>
                                <p className="text-sm text-muted-foreground">Used when scale constraints are enabled.</p>
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
                                        {scaleOption.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <FormField id="practice-note-sequence" label="Default Note Sequence">
                            <Select
                                value={quick.practiceNoteSequence}
                                onChange={(event) => updateQuickSettings({ practiceNoteSequence: event.target.value as typeof quick.practiceNoteSequence })}
                            >
                                {PRACTICE_NOTE_SEQUENCE_OPTIONS.map((sequenceOption) => (
                                    <option key={sequenceOption.id} value={sequenceOption.id}>
                                        {sequenceOption.label}
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
                title="Training Module Defaults"
                summary={`${techniqueStartingEntries.length} technique BPM overrides · ${modules.earTraining.intervals.length} ear intervals`}
            >
                <Card>
                    <CardHeader>
                        <CardTitle>Technique, Ear Training & Rhythm</CardTitle>
                        <CardDescription>Module-specific defaults and persisted training calibration.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {showModuleTechnique && (
                            <div className="space-y-4">
                                <div className="space-y-0.5">
                                    <Label>Technique Starting BPM Overrides</Label>
                                    <p className="text-sm text-muted-foreground">Saved per exercise when tempo is adjusted in Technique mode.</p>
                                </div>
                                {techniqueStartingEntries.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No exercise-specific starting BPM overrides yet.</p>
                                ) : (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {techniqueStartingEntries.map(([exerciseId, bpm]) => (
                                            <div key={exerciseId} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                                                <p className="text-sm font-medium">{TECHNIQUE_EXERCISES[exerciseId]?.name ?? exerciseId}</p>
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
                                        Clear BPM Overrides
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => updateModuleSettings("technique", {
                                            bestBpm: {},
                                            sessionsCompleted: {},
                                            lastPracticedAt: {},
                                        })}
                                    >
                                        Clear Technique Stats
                                    </Button>
                                    <Button variant="outline" onClick={() => resetModuleSettings("technique")}>
                                        Reset Technique Module
                                    </Button>
                                </div>
                            </div>
                        )}

                        {showModuleEar && (
                            <div className="space-y-4">
                                <FormField id="ear-direction" label="Ear Training Default Direction">
                                    <Select
                                        value={modules.earTraining.direction}
                                        onChange={(event) => updateModuleSettings("earTraining", {
                                            direction: event.target.value as typeof modules.earTraining.direction,
                                        })}
                                    >
                                        <option value="ascending">Ascending</option>
                                        <option value="descending">Descending</option>
                                        <option value="harmonic">Harmonic</option>
                                    </Select>
                                </FormField>
                                <div className="space-y-2">
                                    <div className="space-y-0.5">
                                        <Label>Active Ear Intervals</Label>
                                        <p className="text-sm text-muted-foreground">At least one interval must stay enabled.</p>
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
                                <Button variant="outline" onClick={() => resetModuleSettings("earTraining")}>Reset Ear Defaults</Button>
                            </div>
                        )}

                        {showModuleRhythm && (
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <Label>Rhythm Input Latency Compensation</Label>
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
                                    Increase this if taps are consistently marked late despite feeling on-beat.
                                </p>
                                <Button variant="outline" onClick={() => setRhythmInputLatencyMs(0)}>
                                    Reset Latency to 0 ms
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "data" && showData && (
            <SectionCollapse
                title="Data"
                summary="Export · Import · Reset"
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5" />
                            Progress Backup
                        </CardTitle>
                        <CardDescription>
                            Export your practice data to JSON and import it later.
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
                                Export Progress
                            </Button>
                            <Button variant="outline" onClick={() => handleImportProgressTrigger("merge")}>
                                Import (Merge)
                            </Button>
                            <Button variant="outline" onClick={() => handleImportProgressTrigger("replace")}>
                                Import (Replace)
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Merge keeps current progress and adds imported data. Replace overwrites all current progress.
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-destructive/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <RotateCcw className="h-5 w-5" />
                            Danger Zone
                        </CardTitle>
                        <CardDescription>
                            Permanent actions affecting your learning history.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="destructive" onClick={handleResetProgress}>
                            Reset All Progress Data
                        </Button>
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "data" && showHelp && (
            <SectionCollapse
                title="Help"
                summary="FAQ · Blog · Contact"
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HandHeart className="h-5 w-5" />
                            Help & Support
                        </CardTitle>
                        <CardDescription>
                            Quick access to FAQ, updates, and support.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2 sm:grid-cols-3">
                            <Button asChild variant="outline" className="justify-between">
                                <a href={EXTERNAL_LINKS.faq} target="_blank" rel="noreferrer noopener">
                                    <span className="inline-flex items-center gap-2">
                                        <CircleHelp className="h-4 w-4" />
                                        FAQ
                                    </span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </Button>
                            <Button asChild variant="outline" className="justify-between">
                                <a href={EXTERNAL_LINKS.blog} target="_blank" rel="noreferrer noopener">
                                    <span className="inline-flex items-center gap-2">
                                        <Newspaper className="h-4 w-4" />
                                        Blog
                                    </span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </Button>
                            <Button asChild variant="outline" className="justify-between">
                                <a href={EXTERNAL_LINKS.contactMailto}>
                                    <span className="inline-flex items-center gap-2">
                                        <Mail className="h-4 w-4" />
                                        Contact
                                    </span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </Button>
                        </div>
                        <Button asChild className="control-btn--primary justify-start">
                            <a href={EXTERNAL_LINKS.buyMeCoffee} target="_blank" rel="noreferrer noopener">
                                <Coffee className="h-4 w-4" />
                                Buy me a coffee
                            </a>
                        </Button>
                    </CardContent>
                </Card>
            </SectionCollapse>
            )}

            {activeScope === "global" && !hasVisibleGlobal && (
                <Card>
                    <CardContent className="py-10 text-center">
                        <p className="type-body text-muted-foreground">No global settings match "{searchQuery.trim()}".</p>
                        <Button variant="outline" className="mt-4" onClick={() => setSearchQuery("")}>Clear Search</Button>
                    </CardContent>
                </Card>
            )}
            {activeScope === "modules" && !hasVisibleModules && (
                <Card>
                    <CardContent className="py-10 text-center">
                        <p className="type-body text-muted-foreground">No module settings match "{searchQuery.trim()}".</p>
                        <Button variant="outline" className="mt-4" onClick={() => setSearchQuery("")}>Clear Search</Button>
                    </CardContent>
                </Card>
            )}
            {activeScope === "data" && !hasVisibleData && (
                <Card>
                    <CardContent className="py-10 text-center">
                        <p className="type-body text-muted-foreground">No data/support settings match "{searchQuery.trim()}".</p>
                        <Button variant="outline" className="mt-4" onClick={() => setSearchQuery("")}>Clear Search</Button>
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

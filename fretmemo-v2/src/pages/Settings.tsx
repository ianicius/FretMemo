import { type ChangeEvent, useRef, useState } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useFeedbackStore, type AppFeedbackTone } from "@/stores/useFeedbackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { downloadProgressExport, parseJsonFile } from "@/lib/progressTransfer";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { SectionCollapse } from "@/components/ui/section-collapse";
import { RotateCcw, Volume2, Gamepad2, GraduationCap, Palette, Guitar, Database, CircleHelp, Newspaper, HandHeart, Coffee, Mail, ExternalLink } from "lucide-react";
import { EXTERNAL_LINKS } from "@/lib/externalLinks";

type ConfirmAction = "reset-settings" | "replace-progress-import" | "reset-progress" | null;

export default function Settings() {
    const quick = useSettingsStore((state) => state.quick);
    const full = useSettingsStore((state) => state.full);
    const updateQuickSettings = useSettingsStore((state) => state.updateQuickSettings);
    const updateFullSettings = useSettingsStore((state) => state.updateFullSettings);
    const resetSettings = useSettingsStore((state) => state.resetSettings);
    const importProgressData = useProgressStore((state) => state.importProgressData);
    const resetProgressData = useProgressStore((state) => state.resetProgressData);
    const enqueueFeedback = useFeedbackStore((state) => state.enqueue);
    const importFileInputRef = useRef<HTMLInputElement | null>(null);
    const importModeRef = useRef<"merge" | "replace">("merge");
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

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
            showFeedback("Progress data exported.", "success");
        } catch (error) {
            console.error("Failed to export progress data", error);
            showFeedback("Could not export progress data. Please try again.", "error");
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
        } catch (error) {
            console.error("Failed to import progress data", error);
            showFeedback("Could not import progress data. Make sure the file is valid JSON.", "error");
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

    const handleConfirmDialogOpenChange = (open: boolean) => {
        if (!open) {
            setConfirmAction(null);
        }
    };

    return (
        <div className="space-y-6 pb-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground">Manage your preferences and configuration.</p>
                </div>
                <Button variant="outline" onClick={handleReset} className="text-destructive hover:text-destructive">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset Defaults
                </Button>
            </div>

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
                        <div className="space-y-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="instrument-type">Instrument Type</Label>
                                <p className="text-sm text-muted-foreground">Changes available tuning presets and string count.</p>
                            </div>
                            <select
                                id="instrument-type"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                            </select>
                        </div>

                        <div className="space-y-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="tuning-preset">Tuning Preset</Label>
                                <p className="text-sm text-muted-foreground">Applies to all fretboard-based exercises.</p>
                            </div>
                            <select
                                id="tuning-preset"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                            </select>
                            <p className="text-xs font-mono text-muted-foreground">
                                Active tuning ({selectedTuning.length} strings): {selectedTuningSummary}
                            </p>
                        </div>

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
                    </CardContent>
                </Card>
            </SectionCollapse>

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
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="text-sm font-medium">Streak Freezes</span>
                                    <p className="text-xs text-muted-foreground">Protect your streak if you miss a day.</p>
                                </div>
                                <span className="text-lg font-bold text-primary tabular-nums">
                                    {useProgressStore.getState().streakFreezes}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </SectionCollapse>

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

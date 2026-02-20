import { useMemo, useState } from "react";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SessionModeToggle } from "@/components/session-setup/session-mode-toggle";
import { SessionSetupDialogShell } from "@/components/session-setup/session-setup-dialog-shell";
import { cn } from "@/lib/utils";
import { NOTES } from "@/lib/constants";
import { useGameStore, type NoteFilter, type NoteSequence, type ScaleType } from "@/stores/useGameStore";
import type { NoteName } from "@/types/fretboard";
import { ChevronDown, Mic, Play, Settings2, X, Zap } from "lucide-react";

type PracticeMode = "fretboardToNote" | "tabToNote" | "noteToTab" | "playNotes" | "playTab";
type PlaySessionMode = "scored" | "guitar";

interface PreFlightModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: () => void;
    mode: PracticeMode;
    bpm: number;
    onBpmChange: (bpm: number) => void;
    noteDuration: number;
    onNoteDurationChange: (duration: number) => void;
    isMetronomeOn: boolean;
    onMetronomeToggle: () => void;
    fretRange: { min: number; max: number };
    tuning: NoteName[];
    onFretRangeChange: (range: { min: number; max: number }) => void;
    enabledStrings: boolean[];
    onStringToggle: (stringIndex: number) => void;
    noteFilter: NoteFilter;
    onNoteFilterChange: (filter: NoteFilter) => void;
    rootNote: NoteName;
    onRootNoteChange: (root: NoteName) => void;
    scaleType: ScaleType;
    onScaleTypeChange: (scaleType: ScaleType) => void;
    noteSequence: NoteSequence;
    onNoteSequenceChange: (sequence: NoteSequence) => void;
    onApplyPreset: (preset: {
        fretRange?: { min: number; max: number };
        enabledStrings?: boolean[];
        noteFilter?: NoteFilter;
        rootNote?: NoteName;
        scaleType?: ScaleType;
    }) => void;
    micEnabled?: boolean;
    onMicEnabledChange?: (enabled: boolean) => void;
    micError?: string | null;
    audioInputDevices?: Array<{ id: string; label: string }>;
    selectedAudioInputId?: string;
    onAudioInputChange?: (deviceId: string) => void;
    onRefreshAudioInputs?: () => void;
    sessionMode?: PlaySessionMode;
    onSessionModeChange?: (mode: PlaySessionMode) => void;
}

const MODE_CONFIG: Record<PracticeMode, { label: string; description: string }> = {
    fretboardToNote: {
        label: "Fretboard → Note",
        description: "Identify notes on the fretboard.",
    },
    tabToNote: {
        label: "Tab → Note",
        description: "Read tablature and identify notes.",
    },
    noteToTab: {
        label: "Note → Tab",
        description: "Find the right position for each note.",
    },
    playNotes: {
        label: "Note Generator (Mic)",
        description: "Play the prompted note on your guitar.",
    },
    playTab: {
        label: "Tab Sequence (Mic)",
        description: "Play tab prompts with microphone detection.",
    },
};

const PRESETS_ENABLING_ALL_STRINGS = new Set(["full-neck", "open-major", "a-minor-pent"]);
const SCALE_TYPE_OPTIONS: Array<{ id: ScaleType; label: string }> = [
    { id: "major", label: "Major" },
    { id: "minor", label: "Minor" },
    { id: "majorPentatonic", label: "Major Pentatonic" },
    { id: "minorPentatonic", label: "Minor Pentatonic" },
];
const NOTE_SEQUENCE_OPTIONS: Array<{
    group: string;
    items: Array<{ id: NoteSequence; label: string }>;
}> = [
        {
            group: "Intervals",
            items: [
                { id: "random", label: "Random" },
                { id: "minorThirds", label: "Minor Thirds" },
                { id: "majorThirds", label: "Major Thirds" },
                { id: "fourths", label: "Fourths" },
                { id: "fifths", label: "Fifths" },
                { id: "sevenths", label: "Sevenths" },
            ],
        },
        {
            group: "Scales",
            items: [
                { id: "majorScale", label: "Major Scale" },
                { id: "naturalMinorScale", label: "Natural Minor Scale" },
                { id: "majorPentatonic", label: "Major Pentatonic" },
                { id: "minorPentatonic", label: "Minor Pentatonic" },
            ],
        },
    ];

const PRESET_OPTIONS: Array<{
    id: string;
    label: string;
    values: {
        fretRange?: { min: number; max: number };
        enabledStrings?: boolean[];
        noteFilter?: NoteFilter;
        rootNote?: NoteName;
        scaleType?: ScaleType;
    };
}> = [
        {
            id: "full-neck",
            label: "Full Neck",
            values: { fretRange: { min: 1, max: 12 }, noteFilter: "all" },
        },
        {
            id: "open-major",
            label: "Open Major",
            values: { fretRange: { min: 1, max: 5 }, rootNote: "C", scaleType: "major", noteFilter: "all" },
        },
        {
            id: "a-minor-pent",
            label: "A Minor Pent",
            values: { fretRange: { min: 5, max: 8 }, rootNote: "A", scaleType: "minorPentatonic", noteFilter: "all" },
        },
        {
            id: "naturals",
            label: "Naturals",
            values: { noteFilter: "naturals" },
        },
    ];

export function PreFlightModal({
    isOpen,
    onClose,
    onStart,
    mode,
    bpm,
    onBpmChange,
    noteDuration,
    onNoteDurationChange,
    isMetronomeOn,
    onMetronomeToggle,
    fretRange,
    tuning,
    onFretRangeChange,
    enabledStrings,
    onStringToggle,
    noteFilter,
    onNoteFilterChange,
    rootNote,
    onRootNoteChange,
    scaleType,
    onScaleTypeChange,
    noteSequence,
    onNoteSequenceChange,
    onApplyPreset,
    micEnabled,
    onMicEnabledChange,
    micError,
    audioInputDevices,
    selectedAudioInputId,
    onAudioInputChange,
    onRefreshAudioInputs,
    sessionMode,
    onSessionModeChange,
}: PreFlightModalProps) {
    const config = MODE_CONFIG[mode];
    const [showAdvanced, setShowAdvanced] = useState(false);
    const isPlayMode = mode === "playNotes" || mode === "playTab";
    const allStringsEnabled = useMemo(() => Array.from({ length: tuning.length }, () => true), [tuning.length]);
    const stringToggleLabels = useMemo(
        () => tuning.map((note, index) => (index === 0 ? note.toLowerCase() : note)),
        [tuning]
    );

    const speedUpEnabled = useGameStore((s) => s.speedUpEnabled);
    const speedUpAmount = useGameStore((s) => s.speedUpAmount);
    const speedUpInterval = useGameStore((s) => s.speedUpInterval);
    const setSpeedUpEnabled = useGameStore((s) => s.setSpeedUpEnabled);
    const setSpeedUpAmount = useGameStore((s) => s.setSpeedUpAmount);
    const setSpeedUpInterval = useGameStore((s) => s.setSpeedUpInterval);

    const isPresetActive = (preset: (typeof PRESET_OPTIONS)[number]): boolean => {
        const values = preset.values;
        if (values.fretRange) {
            if (values.fretRange.min !== fretRange.min || values.fretRange.max !== fretRange.max) {
                return false;
            }
        }
        if (PRESETS_ENABLING_ALL_STRINGS.has(preset.id)) {
            const sameStrings = allStringsEnabled.every((_, index) => Boolean(enabledStrings[index]));
            if (!sameStrings) return false;
        }
        if (values.noteFilter && values.noteFilter !== noteFilter) return false;
        if (values.rootNote && values.rootNote !== rootNote) return false;
        if (values.scaleType && values.scaleType !== scaleType) return false;
        return true;
    };

    return (
        <SessionSetupDialogShell
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="Session Setup"
            badgeLabel={config.label}
            description={config.description}
            bodyClassName="space-y-6"
            footer={
                <DialogFooter className="shrink-0 gap-2 border-t border-border/50 bg-background px-6 py-4">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                    </Button>
                    <Button onClick={onStart} className="flex-1 control-btn--primary">
                        <Play className="mr-2 h-4 w-4" />
                        Start
                    </Button>
                </DialogFooter>
            }
        >
            <section className="space-y-3 rounded-lg border border-border/50 p-3">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm">Tempo</Label>
                        <span className="font-mono text-xs text-muted-foreground">{bpm} BPM</span>
                    </div>
                    <Slider value={[bpm]} onValueChange={([value]) => onBpmChange(value)} min={30} max={280} step={1} />
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <span className="text-sm">Metronome</span>
                        <p className="text-xs text-muted-foreground">Use click track while practicing.</p>
                    </div>
                    <Switch
                        checked={isMetronomeOn}
                        onCheckedChange={(checked) => {
                            if (checked !== isMetronomeOn) onMetronomeToggle();
                        }}
                    />
                </div>

                {isMetronomeOn && (
                    <div className="space-y-3 rounded-md border border-amber-300/40 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-900/10">
                        <div className="flex items-center justify-between">
                            <div className="inline-flex items-center gap-2">
                                <Zap className="h-4 w-4 text-amber-600" />
                                <span className="text-sm font-medium">Auto Speed-Up</span>
                            </div>
                            <Switch checked={speedUpEnabled} onCheckedChange={setSpeedUpEnabled} />
                        </div>
                        {speedUpEnabled && (
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Increase" labelClassName="text-xs">
                                    <NumberInput
                                        value={speedUpAmount}
                                        min={1}
                                        max={20}
                                        step={1}
                                        onValueChange={setSpeedUpAmount}
                                        className="gap-1"
                                        inputClassName="h-8 px-2 text-sm"
                                    />
                                </FormField>
                                <FormField label="Every X beats" labelClassName="text-xs">
                                    <NumberInput
                                        value={speedUpInterval}
                                        min={1}
                                        max={32}
                                        step={1}
                                        onValueChange={setSpeedUpInterval}
                                        className="gap-1"
                                        inputClassName="h-8 px-2 text-sm"
                                    />
                                </FormField>
                            </div>
                        )}
                    </div>
                )}

                {isPlayMode && onMicEnabledChange && (
                    <div className="space-y-3 rounded-lg border border-border/50 p-3">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-2 text-sm">
                                    <Mic className="h-4 w-4 text-muted-foreground" />
                                    Microphone Input
                                </span>
                                <p className="text-xs text-muted-foreground">Enable this to detect played guitar notes.</p>
                            </div>
                            <Switch checked={Boolean(micEnabled)} onCheckedChange={onMicEnabledChange} />
                        </div>

                        {Boolean(micEnabled) && onAudioInputChange && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs" htmlFor="preflight-audio-input">
                                        Input Device
                                    </Label>
                                    {onRefreshAudioInputs && (
                                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={onRefreshAudioInputs}>
                                            Refresh
                                        </Button>
                                    )}
                                </div>
                                <Select
                                    id="preflight-audio-input"
                                    className="h-9 py-1"
                                    value={selectedAudioInputId ?? ""}
                                    onChange={(event) => onAudioInputChange(event.target.value)}
                                >
                                    <option value="">System Default</option>
                                    {(audioInputDevices ?? []).map((device) => (
                                        <option key={device.id} value={device.id}>
                                            {device.label}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}

                        {micError && <p className="text-xs text-destructive">{micError}</p>}
                    </div>
                )}

                {isPlayMode && onSessionModeChange && (
                    <SessionModeToggle
                        value={sessionMode ?? "scored"}
                        onChange={onSessionModeChange}
                        options={[
                            {
                                value: "scored",
                                label: "Scored Session",
                                description: "Auto-finishes after target count and shows summary.",
                            },
                            {
                                value: "guitar",
                                label: "Guitar Mode",
                                description: "No session limit. Keep playing until you stop manually.",
                            },
                        ]}
                    />
                )}

                {isPlayMode && (
                    <FormField
                        label="Note Sequence"
                        labelClassName="text-sm"
                        className="space-y-2 rounded-lg border border-border/50 p-3"
                    >
                        <Select
                            className="h-9 py-1"
                            value={noteSequence}
                            onChange={(event) => onNoteSequenceChange(event.target.value as NoteSequence)}
                        >
                            {NOTE_SEQUENCE_OPTIONS.map((group) => (
                                <optgroup key={group.group} label={group.group}>
                                    {group.items.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </Select>
                    </FormField>
                )}

                <div className="space-y-2">
                    <Label className="text-sm">Quick Presets</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {PRESET_OPTIONS.map((preset) => (
                            <Button
                                key={preset.id}
                                type="button"
                                size="sm"
                                variant={isPresetActive(preset) ? "secondary" : "outline"}
                                className={cn("h-8 text-xs", isPresetActive(preset) && "border-primary/40")}
                                onClick={() =>
                                    onApplyPreset(
                                        PRESETS_ENABLING_ALL_STRINGS.has(preset.id)
                                            ? { ...preset.values, enabledStrings: allStringsEnabled }
                                            : preset.values
                                    )
                                }
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-between rounded-lg border border-dashed border-border px-3 py-2"
                    onClick={() => setShowAdvanced((prev) => !prev)}
                >
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                        <Settings2 className="h-4 w-4" />
                        Advanced
                    </span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
                </Button>

                {showAdvanced && (
                    <div className="space-y-4 rounded-lg border border-border/50 p-3">
                        {isMetronomeOn && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm">Note Duration</Label>
                                    <span className="font-mono text-xs text-muted-foreground">{noteDuration}</span>
                                </div>
                                <Slider value={[noteDuration]} onValueChange={([value]) => onNoteDurationChange(value)} min={1} max={16} step={1} />
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm">Fret Range</Label>
                                <span className="font-mono text-xs text-muted-foreground">{fretRange.min} - {fretRange.max}</span>
                            </div>
                            <Slider
                                value={[fretRange.min, fretRange.max]}
                                onValueChange={(values) => {
                                    if (values.length < 2) return;
                                    const min = Math.min(values[0], values[1]);
                                    const max = Math.max(values[0], values[1]);
                                    onFretRangeChange({ min, max });
                                }}
                                min={1}
                                max={12}
                                step={1}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm">Strings</Label>
                            <div
                                className="grid gap-2"
                                style={{
                                    gridTemplateColumns: `repeat(${Math.max(1, Math.min(8, tuning.length))}, minmax(0, 1fr))`,
                                }}
                            >
                                {stringToggleLabels.map((label, index) => {
                                    const enabled = Boolean(enabledStrings[index]);
                                    return (
                                        <Button
                                            key={`${label}-${index}`}
                                            type="button"
                                            size="sm"
                                            variant={enabled ? "secondary" : "outline"}
                                            className="h-8 px-0 text-xs"
                                            onClick={() => onStringToggle(index)}
                                        >
                                            {label}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm">Notes</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button type="button" size="sm" variant={noteFilter === "all" ? "secondary" : "outline"} onClick={() => onNoteFilterChange("all")}>
                                    All Notes
                                </Button>
                                <Button type="button" size="sm" variant={noteFilter === "naturals" ? "secondary" : "outline"} onClick={() => onNoteFilterChange("naturals")}>
                                    Naturals
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <FormField label="Root Note" labelClassName="text-sm">
                                <Select
                                    className="h-9 py-1"
                                    value={rootNote}
                                    onChange={(event) => onRootNoteChange(event.target.value as NoteName)}
                                >
                                    {NOTES.map((note) => (
                                        <option key={note} value={note}>
                                            {note}
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm">Scale Type</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {SCALE_TYPE_OPTIONS.map((option) => (
                                    <Button
                                        key={option.id}
                                        type="button"
                                        size="sm"
                                        variant={scaleType === option.id ? "secondary" : "outline"}
                                        className="h-8 text-xs"
                                        onClick={() => onScaleTypeChange(option.id)}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>


                    </div>
                )}
            </section>
        </SessionSetupDialogShell>
    );
}

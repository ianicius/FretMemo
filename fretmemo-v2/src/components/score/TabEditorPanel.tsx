import { useTranslation } from "react-i18next";
import { RotateCcw, Redo2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { BeatStringSummary } from "@/lib/tabEditor";

const DURATION_OPTIONS = [
    { value: 1, labelKey: "scores.editor.durations.whole" },
    { value: 2, labelKey: "scores.editor.durations.half" },
    { value: 4, labelKey: "scores.editor.durations.quarter" },
    { value: 8, labelKey: "scores.editor.durations.eighth" },
    { value: 16, labelKey: "scores.editor.durations.sixteenth" },
];

interface TabEditorPanelProps {
    /** Bumped on every model mutation — forces parent-driven panel refresh. */
    beatVersion?: number;
    /** Per-string fret summary of the beat under the cursor (null = none). */
    summary: BeatStringSummary | null;
    stringCount: number;
    duration: number;
    dirty: boolean;
    canUndo: boolean;
    canRedo: boolean;
    onFretChange: (stringIndex: number, fret: number | null) => void;
    onDurationChange: (duration: number) => void;
    onRest: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onSave: () => void;
}

/**
 * Edit panel for the beat under the playback cursor: per-string fret inputs,
 * duration, rest toggle and undo/redo/save. Pure presentation.
 */
export function TabEditorPanel({
    beatVersion,
    summary,
    stringCount,
    duration,
    dirty,
    canUndo,
    canRedo,
    onFretChange,
    onDurationChange,
    onRest,
    onUndo,
    onRedo,
    onSave,
}: TabEditorPanelProps) {
    const { t } = useTranslation();
    const strings = summary ?? Array.from({ length: stringCount }, () => null);

    return (
        <div className="space-y-3 rounded-lg border border-border/50 p-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm">{t("scores.editor.title")}</Label>
                {dirty && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                        {t("scores.editor.unsaved")}
                    </span>
                )}
            </div>

            <div className="space-y-1.5" data-beat-version={beatVersion}>
                {strings
                    .map((fret, index) => ({ fret, index }))
                    .reverse()
                    .map(({ fret, index }) => (
                        <div key={index} className="flex items-center gap-2">
                            <span className="w-14 font-mono text-xs text-muted-foreground">
                                {t("scores.editor.stringLabel", { n: index + 1 })}
                            </span>
                            <input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                className={cn(
                                    "h-8 w-16 rounded-md border border-input bg-background px-2 text-sm",
                                    fret !== null && "border-primary/60",
                                )}
                                value={fret ?? ""}
                                placeholder="—"
                                aria-label={t("scores.editor.fretAria", { n: index + 1 })}
                                onChange={(event) => {
                                    const raw = event.target.value;
                                    onFretChange(
                                        index,
                                        raw === "" ? null : Math.max(0, Number(raw)),
                                    );
                                }}
                            />
                        </div>
                    ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs text-muted-foreground" htmlFor="beat-duration">
                    {t("scores.editor.duration")}
                </Label>
                <Select
                    id="beat-duration"
                    className="h-8 w-auto"
                    value={duration}
                    onChange={(event) => onDurationChange(Number(event.target.value))}
                >
                    {DURATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {t(option.labelKey)}
                        </option>
                    ))}
                </Select>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRest}
                >
                    <Trash2 className="h-4 w-4" />
                    {t("scores.editor.rest")}
                </Button>
                <div className="ml-auto flex gap-1.5">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canUndo}
                        onClick={onUndo}
                        aria-label={t("scores.editor.undo")}
                    >
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canRedo}
                        onClick={onRedo}
                        aria-label={t("scores.editor.redo")}
                    >
                        <Redo2 className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" disabled={!dirty} onClick={onSave}>
                        <Save className="h-4 w-4" />
                        {t("scores.editor.save")}
                    </Button>
                </div>
            </div>
        </div>
    );
}

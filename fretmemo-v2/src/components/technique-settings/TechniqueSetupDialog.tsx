import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SessionSetupDialogShell } from "@/components/session-setup/session-setup-dialog-shell";
import { cn } from "@/lib/utils";
import { ChevronDown, Play, Settings2, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

interface TechniqueSetupDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onStart: () => void;
    exerciseName: string;
    exerciseDescription: string;
    bpm: number;
    onBpmChange: (value: number) => void;
    stepMode: boolean;
    onStepModeChange: (checked: boolean) => void;
    startFret: number;
    onStartFretChange: (fret: number) => void;
    speedUpEnabled: boolean;
    onSpeedUpEnabledChange: (checked: boolean) => void;
    speedUpAmount: number;
    onSpeedUpAmountChange: (value: number) => void;
    speedUpInterval: number;
    onSpeedUpIntervalChange: (value: number) => void;
    advancedContent?: ReactNode;
    advancedLabel?: string;
}

export function TechniqueSetupDialog({
    isOpen,
    onOpenChange,
    onStart,
    exerciseName,
    exerciseDescription,
    bpm,
    onBpmChange,
    stepMode,
    onStepModeChange,
    startFret,
    onStartFretChange,
    speedUpEnabled,
    onSpeedUpEnabledChange,
    speedUpAmount,
    onSpeedUpAmountChange,
    speedUpInterval,
    onSpeedUpIntervalChange,
    advancedContent,
    advancedLabel,
}: TechniqueSetupDialogProps) {
    const { t } = useTranslation();
    const [showAdvanced, setShowAdvanced] = useState(false);
    const resolvedAdvancedLabel = advancedLabel ?? t("technique.setup.advanced");

    return (
        <SessionSetupDialogShell
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    setShowAdvanced(false);
                }
                onOpenChange(open);
            }}
            title={t("technique.setup.title")}
            badgeLabel={exerciseName}
            description={exerciseDescription}
            bodyClassName="space-y-4"
            footer={
                <DialogFooter className="shrink-0 border-t border-border/50 px-6 py-4 sm:justify-between sm:space-x-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t("technique.setup.cancel")}
                    </Button>
                    <Button className="control-btn--primary" onClick={onStart}>
                        <Play className="mr-2 h-4 w-4" />
                        {t("technique.setup.start")}
                    </Button>
                </DialogFooter>
            }
        >
            <section className="space-y-3 rounded-lg border border-border/50 p-3">
                <div className={cn("space-y-2", stepMode && "opacity-50 pointer-events-none")}>
                    <div className="flex items-center justify-between">
                        <Label className="text-sm">{t("technique.setup.tempo")}</Label>
                        <span className="font-mono text-xs text-muted-foreground">{bpm} BPM</span>
                    </div>
                    <Slider
                        value={[bpm]}
                        onValueChange={([value]) => onBpmChange(value)}
                        min={30}
                        max={280}
                        step={1}
                        disabled={stepMode}
                    />
                </div>

                {!stepMode && (
                    <div className="space-y-3 rounded-md border border-amber-300/40 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-900/10">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-2 text-sm font-medium">
                                    <Zap className="h-4 w-4 text-amber-600" />
                                    {t("technique.setup.autoSpeedUp")}
                                </span>
                                <p className="text-xs text-muted-foreground">{t("technique.setup.autoSpeedUpDesc")}</p>
                            </div>
                            <Switch checked={speedUpEnabled} onCheckedChange={onSpeedUpEnabledChange} />
                        </div>

                        <div className={cn("space-y-3", !speedUpEnabled && "hidden")}>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <Label className="text-xs">{t("technique.setup.increase")}</Label>
                                    <span className="font-mono text-xs">+{speedUpAmount} BPM</span>
                                </div>
                                <Slider
                                    value={[speedUpAmount]}
                                    onValueChange={([value]) => onSpeedUpAmountChange(value)}
                                    min={1}
                                    max={20}
                                    step={1}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <Label className="text-xs">{t("technique.setup.every")}</Label>
                                    <span className="font-mono text-xs">
                                        {speedUpInterval} {speedUpInterval > 1 ? t("technique.setup.beats") : t("technique.setup.beat")}
                                    </span>
                                </div>
                                <Slider
                                    value={[speedUpInterval]}
                                    onValueChange={([value]) => onSpeedUpIntervalChange(value)}
                                    min={1}
                                    max={32}
                                    step={1}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-sm">{t("technique.setup.stepMode")}</Label>
                        <p className="text-xs text-muted-foreground">{t("technique.setup.stepModeDesc")}</p>
                    </div>
                    <Switch checked={stepMode} onCheckedChange={onStepModeChange} />
                </div>

                <div className="space-y-2">
                    <Label className="text-sm">{t("technique.setup.startFret")}</Label>
                    <div className="flex gap-2">
                        {[1, 3, 5, 7].map((fret) => (
                            <Button
                                key={fret}
                                variant={startFret === fret ? "default" : "outline"}
                                size="sm"
                                onClick={() => onStartFretChange(fret)}
                                className="flex-1"
                            >
                                {fret}
                            </Button>
                        ))}
                    </div>
                </div>
            </section>



            {advancedContent && (
                <section className="space-y-3">
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-between rounded-lg border border-dashed border-border px-3 py-2"
                        onClick={() => setShowAdvanced((prev) => !prev)}
                    >
                        <span className="inline-flex items-center gap-2 text-sm font-medium">
                            <Settings2 className="h-4 w-4" />
                            {resolvedAdvancedLabel}
                        </span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
                    </Button>

                    {showAdvanced && (
                        <div className="space-y-4 rounded-lg border border-border/50 p-3">
                            {advancedContent}
                        </div>
                    )}
                </section>
            )}
        </SessionSetupDialogShell>
    );
}

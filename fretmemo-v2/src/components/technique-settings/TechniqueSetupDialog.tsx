import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SessionSetupDialogShell } from "@/components/session-setup/session-setup-dialog-shell";
import { cn } from "@/lib/utils";
import { Play, Zap } from "lucide-react";

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
}: TechniqueSetupDialogProps) {
    return (
        <SessionSetupDialogShell
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title="Session Setup"
            badgeLabel={exerciseName}
            description={exerciseDescription}
            bodyClassName="space-y-4"
            footer={
                <DialogFooter className="shrink-0 border-t border-border/50 px-6 py-4 sm:justify-between sm:space-x-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button className="control-btn--primary" onClick={onStart}>
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
                            <Slider
                                value={[bpm]}
                                onValueChange={([value]) => onBpmChange(value)}
                                min={30}
                                max={280}
                                step={1}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm">Step Mode</Label>
                                <p className="text-xs text-muted-foreground">Manually advance each beat.</p>
                            </div>
                            <Switch checked={stepMode} onCheckedChange={onStepModeChange} />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm">Start Fret</Label>
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

            <section className="space-y-3 rounded-lg border border-border/50 p-3">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-2 text-sm">
                                    <Zap className="h-4 w-4 text-muted-foreground" />
                                    Auto Speed-Up
                                </span>
                                <p className="text-xs text-muted-foreground">Increase tempo automatically while playing.</p>
                            </div>
                            <Switch checked={speedUpEnabled} onCheckedChange={onSpeedUpEnabledChange} />
                        </div>

                        <div className={cn("space-y-3", !speedUpEnabled && "opacity-50")}>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <Label className="text-sm">Increase</Label>
                                    <span className="font-mono text-xs">+{speedUpAmount} BPM</span>
                                </div>
                                <Slider
                                    value={[speedUpAmount]}
                                    onValueChange={([value]) => onSpeedUpAmountChange(value)}
                                    min={1}
                                    max={20}
                                    step={1}
                                    disabled={!speedUpEnabled}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <Label className="text-sm">Every</Label>
                                    <span className="font-mono text-xs">
                                        {speedUpInterval} beat{speedUpInterval > 1 ? "s" : ""}
                                    </span>
                                </div>
                                <Slider
                                    value={[speedUpInterval]}
                                    onValueChange={([value]) => onSpeedUpIntervalChange(value)}
                                    min={1}
                                    max={32}
                                    step={1}
                                    disabled={!speedUpEnabled}
                                />
                            </div>
                        </div>
            </section>

            <p className="text-xs text-muted-foreground">
                Exercise-specific advanced options remain available in the side settings panel.
            </p>
        </SessionSetupDialogShell>
    );
}

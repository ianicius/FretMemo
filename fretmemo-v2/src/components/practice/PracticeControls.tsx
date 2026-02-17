import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayModeMicControlsProps {
    micEnabled: boolean;
    onMicChange: (enabled: boolean) => void;
}

/**
 * Microphone controls for Play modes (playNotes, playTab).
 */
export function PlayModeMicControls({ micEnabled, onMicChange }: PlayModeMicControlsProps) {
    return (
        <div className="flex items-center justify-center gap-4">
            <div
                className={cn(
                    "flex w-full max-w-md items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors",
                    micEnabled ? "border-primary/35 bg-primary/5" : "border-border/60 bg-card/50"
                )}
            >
                <div className="flex items-center gap-2">
                    <Mic className={cn("h-5 w-5 transition-colors", micEnabled ? "text-primary" : "text-muted-foreground")} />
                    <div className="flex flex-col">
                        <Label htmlFor="mic-toggle-focus" className="cursor-pointer text-sm font-semibold">Microphone</Label>
                        <span className="text-[11px] text-muted-foreground">{micEnabled ? "Input active" : "Input disabled"}</span>
                    </div>
                </div>
                <Switch id="mic-toggle-focus" checked={micEnabled} onCheckedChange={onMicChange} />
            </div>
        </div>
    );
}

interface HintButtonProps {
    onHint: () => void;
    hintUsed: boolean;
}

/**
 * Hint button for guess modes.
 */
export function HintButton({ onHint, hintUsed }: HintButtonProps) {
    return (
        <div className="flex justify-center">
            <Button
                type="button"
                variant="outline"
                className="rounded-full px-5 text-sm"
                onClick={onHint}
                disabled={hintUsed}
            >
                ? Hint ({hintUsed ? "used" : "-5 pts"})
            </Button>
        </div>
    );
}

interface NextButtonProps {
    onNext: () => void;
}

/**
 * Manual advance button shown after answering.
 */
export function NextButton({ onNext }: NextButtonProps) {
    return (
        <div className="flex justify-center">
            <Button
                type="button"
                size="lg"
                className="control-btn--primary px-8"
                onClick={onNext}
            >
                Next
            </Button>
        </div>
    );
}

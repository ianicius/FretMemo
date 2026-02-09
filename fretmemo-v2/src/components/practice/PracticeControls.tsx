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
                    "flex items-center gap-4 px-6 py-4 rounded-full border-2 transition-all duration-300",
                    micEnabled ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border/50"
                )}
                style={micEnabled ? { boxShadow: "0 0 20px hsl(var(--primary) / 0.1)" } : undefined}
            >
                <Mic className={cn("w-6 h-6 transition-colors", micEnabled ? "text-primary animate-pulse" : "text-muted-foreground")} />
                <div className="flex flex-col">
                    <Label htmlFor="mic-toggle-focus" className="text-sm font-bold cursor-pointer">Microphone Input</Label>
                    <span className="text-xs text-muted-foreground">{micEnabled ? "Listening..." : "Click to enable"}</span>
                </div>
                <Switch id="mic-toggle-focus" checked={micEnabled} onCheckedChange={onMicChange} className="ml-2 scale-110" />
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

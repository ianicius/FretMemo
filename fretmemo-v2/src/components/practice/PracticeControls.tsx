import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PlayModeMicControlsProps {
    micEnabled: boolean;
    onMicChange: (enabled: boolean) => void;
}

/**
 * Microphone controls for Play modes (playNotes, playTab).
 */
export function PlayModeMicControls({ micEnabled, onMicChange }: PlayModeMicControlsProps) {
    const { t } = useTranslation();

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
                        <Label htmlFor="mic-toggle-focus" className="cursor-pointer text-sm font-semibold">{t("practice.controls.microphone")}</Label>
                        <span className="text-[11px] text-muted-foreground">
                            {micEnabled ? t("practice.controls.inputActive") : t("practice.controls.inputDisabled")}
                        </span>
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
    const { t } = useTranslation();

    return (
        <div className="flex justify-center">
            <Button
                type="button"
                variant="outline"
                className="rounded-full px-5 text-sm"
                onClick={onHint}
                disabled={hintUsed}
            >
                ? {t("practice.controls.hint")} ({hintUsed ? t("practice.controls.used") : t("practice.controls.minusPoints", { points: 5 })})
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
    const { t } = useTranslation();

    return (
        <div className="flex justify-center">
            <Button
                type="button"
                size="lg"
                className="control-btn--primary px-8"
                onClick={onNext}
            >
                {t("practice.controls.next")}
            </Button>
        </div>
    );
}

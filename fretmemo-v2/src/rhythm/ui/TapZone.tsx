import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { StrumDirection } from "@/rhythm/engine/InputEvaluator";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface TapZoneProps {
    disabled?: boolean;
    showDirectionButtons?: boolean;
    onTap: (direction: StrumDirection) => void;
    className?: string;
}

function isEditableElement(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function TapZone({
    disabled = false,
    showDirectionButtons = false,
    onTap,
    className,
}: TapZoneProps) {
    const { t } = useTranslation();

    useEffect(() => {
        if (disabled) return;

        const handleKeydown = (event: KeyboardEvent) => {
            if (isEditableElement(event.target)) return;

            if (event.code === "ArrowDown") {
                event.preventDefault();
                onTap("down");
                return;
            }
            if (event.code === "ArrowUp") {
                event.preventDefault();
                onTap("up");
                return;
            }
            if (!showDirectionButtons && (event.code === "Space" || event.code === "Enter")) {
                event.preventDefault();
                onTap("tap");
            }
        };

        window.addEventListener("keydown", handleKeydown);
        return () => window.removeEventListener("keydown", handleKeydown);
    }, [disabled, onTap, showDirectionButtons]);

    if (showDirectionButtons) {
        return (
            <div className={cn("grid grid-cols-2 gap-2", className)}>
                <Button
                    type="button"
                    size="lg"
                    disabled={disabled}
                    className="h-14 text-base font-bold"
                    onPointerDown={() => onTap("down")}
                >
                    {t("rhythm.ui.tapZone.down")} ↓
                </Button>
                <Button
                    type="button"
                    size="lg"
                    disabled={disabled}
                    variant="outline"
                    className="h-14 text-base font-bold"
                    onPointerDown={() => onTap("up")}
                >
                    {t("rhythm.ui.tapZone.up")} ↑
                </Button>
                <p className="col-span-2 text-center text-xs text-muted-foreground">
                    {t("rhythm.ui.tapZone.keyboardLabel")}: <span className="font-mono">↓</span> / <span className="font-mono">↑</span>
                </p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-2", className)}>
            <Button
                type="button"
                size="lg"
                disabled={disabled}
                className="h-16 w-full text-base font-bold"
                onPointerDown={() => onTap("tap")}
            >
                {t("rhythm.ui.tapZone.tapBeat")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
                {t("rhythm.ui.tapZone.keyboardLabel")}: <span className="font-mono">Space</span> / <span className="font-mono">Enter</span>
            </p>
        </div>
    );
}

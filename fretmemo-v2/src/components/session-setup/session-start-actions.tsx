import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SessionStartActionsProps {
    primaryLabel: string;
    secondaryLabel?: string;
    onPrimary: () => void;
    onSecondary?: () => void;
    primaryDisabled?: boolean;
    secondaryDisabled?: boolean;
    className?: string;
}

export function SessionStartActions({
    primaryLabel,
    secondaryLabel,
    onPrimary,
    onSecondary,
    primaryDisabled = false,
    secondaryDisabled = false,
    className,
}: SessionStartActionsProps) {
    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            <Button onClick={onPrimary} className="w-full sm:w-auto" disabled={primaryDisabled}>
                {primaryLabel}
            </Button>
            {secondaryLabel && onSecondary ? (
                <Button
                    variant="outline"
                    onClick={onSecondary}
                    className="w-full sm:w-auto"
                    disabled={secondaryDisabled}
                >
                    {secondaryLabel}
                </Button>
            ) : null}
        </div>
    );
}


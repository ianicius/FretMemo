import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SessionModeOption<T extends string> {
    value: T;
    label: string;
    description?: string;
}

interface SessionModeToggleProps<T extends string> {
    label?: string;
    value: T;
    options: ReadonlyArray<SessionModeOption<T>>;
    onChange: (next: T) => void;
    className?: string;
    disabled?: boolean;
    size?: "sm" | "default";
}

export function SessionModeToggle<T extends string>({
    label = "Session Mode",
    value,
    options,
    onChange,
    className,
    disabled = false,
    size = "sm",
}: SessionModeToggleProps<T>) {
    const gridColsClass = options.length <= 1 ? "grid-cols-1" : options.length === 2 ? "grid-cols-2" : "grid-cols-3";
    const activeOption = options.find((option) => option.value === value);

    return (
        <div className={cn("space-y-2 rounded-lg border border-border/50 p-3", className)}>
            <Label className="text-sm">{label}</Label>
            <div className={cn("grid gap-2", gridColsClass)}>
                {options.map((option) => (
                    <Button
                        key={option.value}
                        type="button"
                        size={size}
                        variant={value === option.value ? "secondary" : "outline"}
                        className={cn(size === "sm" ? "h-8 text-xs" : "h-10 text-sm")}
                        onClick={() => onChange(option.value)}
                        disabled={disabled}
                    >
                        {option.label}
                    </Button>
                ))}
            </div>
            {activeOption?.description ? (
                <p className="text-xs text-muted-foreground">{activeOption.description}</p>
            ) : null}
        </div>
    );
}


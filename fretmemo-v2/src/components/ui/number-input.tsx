import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function clampNumber(value: number, min?: number, max?: number): number {
    const withMin = typeof min === "number" ? Math.max(min, value) : value;
    return typeof max === "number" ? Math.min(max, withMin) : withMin;
}

export interface NumberInputProps
    extends Omit<
        React.InputHTMLAttributes<HTMLInputElement>,
        "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"
    > {
    value: number;
    onValueChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    withControls?: boolean;
    decrementLabel?: string;
    incrementLabel?: string;
    inputClassName?: string;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
    (
        {
            className,
            inputClassName,
            value,
            onValueChange,
            min,
            max,
            step = 1,
            withControls = true,
            decrementLabel = "Decrease value",
            incrementLabel = "Increase value",
            disabled,
            onBlur,
            ...props
        },
        ref
    ) => {
        const safeValue = Number.isFinite(value) ? value : min ?? 0;

        const applyValue = (nextValue: number) => {
            onValueChange(clampNumber(nextValue, min, max));
        };

        const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const parsed = Number(event.target.value);
            if (Number.isNaN(parsed)) return;
            applyValue(parsed);
        };

        const handleStep = (delta: number) => {
            applyValue(safeValue + delta);
        };

        const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
            applyValue(safeValue);
            onBlur?.(event);
        };

        return (
            <div className={cn("flex items-center gap-2", className)}>
                {withControls ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => handleStep(-step)}
                        disabled={disabled}
                        aria-label={decrementLabel}
                    >
                        <Minus className="h-4 w-4" />
                    </Button>
                ) : null}
                <Input
                    {...props}
                    ref={ref}
                    type="number"
                    value={safeValue}
                    min={min}
                    max={max}
                    step={step}
                    disabled={disabled}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={cn(
                        "text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                        inputClassName
                    )}
                />
                {withControls ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => handleStep(step)}
                        disabled={disabled}
                        aria-label={incrementLabel}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                ) : null}
            </div>
        );
    }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };


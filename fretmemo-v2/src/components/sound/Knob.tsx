import { useRef } from "react";
import { cn } from "@/lib/utils";

interface KnobProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    valueText: string;
    onChange: (value: number) => void;
    disabled?: boolean;
}

function clampToStep(value: number, min: number, max: number, step: number): number {
    const steps = Math.round((value - min) / step);
    const next = min + steps * step;
    const clamped = Math.min(max, Math.max(min, next));
    return Number(clamped.toFixed(4));
}

/**
 * Keyboard-accessible knob. Arrow keys step, PageUp/PageDown jump a tenth of
 * the range, Home/End hit the ends. Dragging up increases the value.
 */
export function Knob({ label, value, min, max, step, valueText, onChange, disabled }: KnobProps) {
    const drag = useRef<{ y: number; value: number } | null>(null);
    const page = Math.max(step, (max - min) / 10);
    const set = (next: number) => onChange(clampToStep(next, min, max, step));
    const span = max - min || 1;
    const angle = -140 + ((value - min) / span) * 280;

    return (
        <div className="flex w-16 flex-col items-center gap-1">
            <button
                type="button"
                role="slider"
                aria-label={label}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={value}
                aria-valuetext={valueText}
                aria-orientation="vertical"
                disabled={disabled}
                className={cn(
                    "relative grid h-14 w-14 place-items-center rounded-full border border-border bg-card shadow-inner",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    disabled && "opacity-40",
                )}
                onKeyDown={(event) => {
                    if (disabled) return;
                    const key = event.key;
                    if (key === "ArrowUp" || key === "ArrowRight") {
                        event.preventDefault();
                        set(value + step);
                    } else if (key === "ArrowDown" || key === "ArrowLeft") {
                        event.preventDefault();
                        set(value - step);
                    } else if (key === "PageUp") {
                        event.preventDefault();
                        set(value + page);
                    } else if (key === "PageDown") {
                        event.preventDefault();
                        set(value - page);
                    } else if (key === "Home") {
                        event.preventDefault();
                        set(min);
                    } else if (key === "End") {
                        event.preventDefault();
                        set(max);
                    }
                }}
                onPointerDown={(event) => {
                    if (disabled) return;
                    drag.current = { y: event.clientY, value };
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                    if (!drag.current) return;
                    const dy = drag.current.y - event.clientY;
                    set(drag.current.value + (dy / 48) * span);
                }}
                onPointerUp={() => {
                    drag.current = null;
                }}
            >
                <span
                    className="absolute h-5 w-0.5 rounded-full bg-primary"
                    style={{ transform: `rotate(${angle}deg) translateY(-8px)` }}
                    aria-hidden="true"
                />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-hidden="true" />
            </button>
            <span className="max-w-full truncate text-[11px] font-medium text-foreground">{label}</span>
            <span className="text-[10px] tabular-nums text-muted-foreground">{valueText}</span>
        </div>
    );
}

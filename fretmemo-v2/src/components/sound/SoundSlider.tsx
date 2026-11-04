/**
 * Accessible slider for the Sound screen (master volume + tone-designer
 * parameters).
 *
 * Why this local wrapper exists: the shared `components/ui/slider` forwards
 * every extra prop to the Radix `Slider.Root` div, but the element carrying
 * `role="slider"` is the Radix `Thumb` — so an `aria-label` / `aria-valuetext`
 * passed to the wrapper (and a visible-label `htmlFor`/`id` association, the
 * thumb not being a labelable element) can never reach the accessible node.
 * This wrapper renders the same Radix primitives with identical styling and
 * puts the accessible name and the unit-bearing value text on the thumb.
 */
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SoundSliderProps {
    /** Accessible name — the same i18n key as the visible label. */
    label: string;
    /** Human-readable value with its unit, exposed as `aria-valuetext`. */
    valueText: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onValueChange: (value: number) => void;
    /**
     * Kept for DOM anchoring/tests. Note: an `htmlFor` label pointing at this
     * id does not reach the Radix thumb — `label` provides the accessible name.
     */
    id?: string;
    className?: string;
}

export function SoundSlider({
    id,
    className,
    label,
    valueText,
    value,
    min,
    max,
    step,
    onValueChange,
}: SoundSliderProps) {
    return (
        <SliderPrimitive.Root
            id={id}
            className={cn(
                "relative flex w-full touch-none select-none items-center px-1.5",
                className,
            )}
            value={[value]}
            min={min}
            max={max}
            step={step}
            onValueChange={(values) => onValueChange(values[0] ?? value)}
        >
            <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
                <SliderPrimitive.Range className="absolute h-full bg-primary" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
                aria-label={label}
                aria-valuetext={valueText}
                className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            />
        </SliderPrimitive.Root>
    );
}

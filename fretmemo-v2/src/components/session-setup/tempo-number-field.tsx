import { FormField } from "@/components/ui/form-field";
import { NumberInput } from "@/components/ui/number-input";

interface TempoNumberFieldProps {
    id: string;
    value: number;
    min: number;
    max: number;
    onChange: (nextValue: number) => void;
    className?: string;
}

export function TempoNumberField({
    id,
    value,
    min,
    max,
    onChange,
    className,
}: TempoNumberFieldProps) {
    return (
        <FormField id={id} label="Tempo" className={className}>
            <NumberInput
                value={value}
                min={min}
                max={max}
                step={1}
                withControls={false}
                onValueChange={onChange}
                inputClassName="h-10 text-left"
            />
        </FormField>
    );
}


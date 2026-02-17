import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
    id?: string;
    label: React.ReactNode;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    required?: boolean;
    className?: string;
    labelClassName?: string;
    hintClassName?: string;
    errorClassName?: string;
    controlClassName?: string;
    children: React.ReactNode;
}

function mergeDescribedBy(current: string | undefined, extra: string | undefined): string | undefined {
    if (!current && !extra) return undefined;
    if (!current) return extra;
    if (!extra) return current;

    return `${current} ${extra}`.trim();
}

export function FormField({
    id,
    label,
    hint,
    error,
    required = false,
    className,
    labelClassName,
    hintClassName,
    errorClassName,
    controlClassName,
    children,
}: FormFieldProps) {
    const reactId = React.useId();
    const fieldId = id ?? `field-${reactId}`;
    const controlId =
        React.isValidElement(children) &&
            typeof (children.props as { id?: unknown }).id === "string" &&
            ((children.props as { id?: string }).id ?? "").length > 0
            ? (children.props as { id: string }).id
            : fieldId;

    const hintId = hint ? `${fieldId}-hint` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

    let controlNode = children;
    if (React.isValidElement(children)) {
        const childProps = children.props as {
            id?: string;
            "aria-describedby"?: string;
            "aria-invalid"?: boolean;
        };

        controlNode = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: controlId,
            "aria-describedby": mergeDescribedBy(childProps["aria-describedby"], describedBy),
            "aria-invalid": error ? true : childProps["aria-invalid"],
        });
    }

    return (
        <div className={cn("space-y-2", className)}>
            <Label htmlFor={controlId} className={cn("type-body", labelClassName)}>
                {label}
                {required ? <span className="ml-1 text-destructive">*</span> : null}
            </Label>
            {hint ? (
                <p id={hintId} className={cn("type-caption text-muted-foreground", hintClassName)}>
                    {hint}
                </p>
            ) : null}
            <div className={controlClassName}>{controlNode}</div>
            {error ? (
                <p id={errorId} className={cn("type-caption text-destructive", errorClassName)}>
                    {error}
                </p>
            ) : null}
        </div>
    );
}


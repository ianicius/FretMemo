import { cn } from "@/lib/utils";

interface StringLineProps {
    thickness: number;
    className?: string;
}

export function StringLine({ thickness, className }: StringLineProps) {
    return (
        <div
            className={cn(
                "absolute left-0 right-0 z-10 pointer-events-none string-line",
                className
            )}
            style={{
                height: `${thickness}px`,
                top: "50%",
                transform: "translateY(-50%)"
            }}
        />
    );
}

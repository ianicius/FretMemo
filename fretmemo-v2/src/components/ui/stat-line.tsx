import { cn } from "@/lib/utils";

interface StatLineProps {
    icon: React.ElementType;
    label: string;
    value: string | number;
    tone?: "default" | "success" | "warning" | "danger";
    className?: string;
}

export function StatLine({ icon: Icon, label, value, tone = "default", className }: StatLineProps) {
    const toneDotClasses = {
        default: "bg-muted-foreground",
        success: "bg-emerald-500",
        warning: "bg-amber-500",
        danger: "bg-rose-500",
    };

    return (
        <div className={cn("flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2", className)}>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", toneDotClasses[tone])} />
                <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
            </div>
        </div>
    );
}

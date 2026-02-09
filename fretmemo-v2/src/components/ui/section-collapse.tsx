import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SectionCollapseProps {
    title: string;
    summary?: string;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (nextOpen: boolean) => void;
    children: ReactNode;
    className?: string;
}

export function SectionCollapse({
    title,
    summary,
    defaultOpen = false,
    open,
    onOpenChange,
    children,
    className,
}: SectionCollapseProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const resolvedOpen = typeof open === "boolean" ? open : isOpen;

    const handleToggle = () => {
        const nextOpen = !resolvedOpen;
        if (typeof open !== "boolean") {
            setIsOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    };

    return (
        <section className={cn("rounded-xl border border-border bg-card", className)}>
            <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-between rounded-xl px-3 py-2.5"
                onClick={handleToggle}
            >
                <div className="min-w-0 text-left">
                    <h3 className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-card-foreground">{title}</h3>
                </div>
                <div className="flex items-center gap-2">
                    {summary && <p className="text-[11px] text-muted-foreground">{summary}</p>}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", resolvedOpen && "rotate-180")} />
                </div>
            </Button>
            {resolvedOpen && <div className="border-t border-border p-3">{children}</div>}
        </section>
    );
}

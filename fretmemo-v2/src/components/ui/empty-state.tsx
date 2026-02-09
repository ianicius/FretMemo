import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: React.ElementType;
    ctaLabel?: string;
    onCtaClick?: () => void;
    className?: string;
}

export function EmptyState({
    title,
    description,
    icon: Icon,
    ctaLabel,
    onCtaClick,
    className,
}: EmptyStateProps) {
    return (
        <div className={cn("rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center", className)}>
            {Icon && (
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="h-6 w-6" />
                </div>
            )}
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            {ctaLabel && onCtaClick && (
                <Button className="mt-4" onClick={onCtaClick}>
                    {ctaLabel}
                </Button>
            )}
        </div>
    );
}

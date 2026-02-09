import { Badge } from "@/components/ui/badge";
import { MasteryBar } from "@/components/ui/mastery-bar";
import { cn } from "@/lib/utils";
import { Clock, ArrowRight } from "lucide-react";

type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";
type ExerciseCardVariant = "standard" | "catalog";

interface ExerciseCardProps {
    title: string;
    description?: string;
    mastery: number;
    lastPracticedLabel?: string;
    difficulty: ExerciseDifficulty;
    icon?: React.ElementType;
    onClick?: () => void;
    className?: string;
    variant?: ExerciseCardVariant;
    isNew?: boolean;
}

const DIFFICULTY_STYLES: Record<ExerciseDifficulty, string> = {
    beginner: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
    intermediate: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    advanced: "bg-secondary text-secondary-foreground border-border",
};

export function ExerciseCard({
    title,
    description,
    mastery,
    lastPracticedLabel,
    difficulty,
    icon: Icon,
    onClick,
    className,
    variant = "standard",
    isNew = false,
}: ExerciseCardProps) {
    const Component = onClick ? "button" : "div";
    const safeMastery = Math.max(0, Math.min(100, Math.round(mastery)));
    const masteryLabel = isNew ? "New" : `${safeMastery}%`;

    if (variant === "catalog") {
        return (
            <Component
                type={onClick ? "button" : undefined}
                className={cn(
                    "group w-full rounded-xl border border-border bg-card p-2.5 text-left transition hover:border-border/80 hover:shadow-sm active:scale-[0.99] min-[390px]:p-3 min-[412px]:p-3.5",
                    onClick && "cursor-pointer",
                    className
                )}
                onClick={onClick}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-1.5 min-[390px]:gap-2">
                        {Icon && (
                            <div className="mt-0.5 rounded-md bg-muted p-1.5 text-muted-foreground">
                                <Icon className="h-3 w-3 min-[390px]:h-3.5 min-[390px]:w-3.5" />
                            </div>
                        )}
                        <h3 className="text-[13px] font-semibold leading-tight text-card-foreground break-words min-[390px]:text-sm min-[412px]:text-[15px]">
                            {title}
                        </h3>
                    </div>
                    {onClick && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
                </div>

                <div className="mt-1.5 min-[390px]:mt-2">
                    <Badge variant="outline" className={cn("h-5 px-1.5 text-[9px] capitalize min-[390px]:px-2 min-[390px]:text-[10px]", DIFFICULTY_STYLES[difficulty])}>
                        {difficulty}
                    </Badge>
                </div>

                <div className="mt-1.5 flex items-center gap-1.5 min-[390px]:mt-2 min-[390px]:gap-2">
                    <MasteryBar value={safeMastery} showLabel={false} className="flex-1" />
                    <span className="w-8 shrink-0 text-right text-[11px] font-semibold text-muted-foreground min-[390px]:w-9 min-[390px]:text-xs">{masteryLabel}</span>
                </div>
            </Component>
        );
    }

    return (
        <Component
            type={onClick ? "button" : undefined}
            className={cn(
                "w-full rounded-xl border border-border bg-card p-4 text-left transition hover:border-border/80 hover:shadow-sm",
                onClick && "cursor-pointer",
                className
            )}
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    {Icon && (
                        <div className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
                            <Icon className="h-4 w-4" />
                        </div>
                    )}
                    <div>
                        <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
                        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
                    </div>
                </div>
                <Badge variant="outline" className={cn("capitalize", DIFFICULTY_STYLES[difficulty])}>
                    {difficulty}
                </Badge>
            </div>

            <div className="mt-3">
                <MasteryBar value={safeMastery} />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                {lastPracticedLabel ? (
                    <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Last: {lastPracticedLabel}</span>
                    </div>
                ) : (
                    <span />
                )}
                {onClick && <ArrowRight className="h-4 w-4" />}
            </div>
        </Component>
    );
}

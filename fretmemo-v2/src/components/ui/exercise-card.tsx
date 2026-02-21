import { Badge } from "@/components/ui/badge";
import { MasteryBar } from "@/components/ui/mastery-bar";
import { cn } from "@/lib/utils";
import { Clock, ArrowRight, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    isLocked?: boolean;
    minLevel?: number;
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
    isLocked = false,
    minLevel,
}: ExerciseCardProps) {
    const { t } = useTranslation();
    const Component = (onClick && !isLocked) ? "button" : "div";
    const safeMastery = Math.max(0, Math.min(100, Math.round(mastery)));
    const masteryLabel = isLocked ? (
        <Badge variant="outline" className="border-muted bg-muted text-[10px] text-muted-foreground uppercase opacity-70">{t("common.locked", "LOCKED")}</Badge>
    ) : isNew ? (
        <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-400 font-bold uppercase tracking-widest text-[10px] px-1.5 py-0">{t("common.new", "NEW")}</Badge>
    ) : (
        `${safeMastery}%`
    );

    const handleClick = () => {
        if (!isLocked && onClick) {
            onClick();
        }
    };

    if (variant === "catalog") {
        return (
            <Component
                type={Component === "button" ? "button" : undefined}
                className={cn(
                    "group w-full rounded-xl border border-border bg-card p-3 text-left transition hover:border-border/80 hover:shadow-sm active:scale-[0.99] min-[390px]:p-3.5",
                    !isLocked && onClick && "cursor-pointer",
                    isLocked && "opacity-60 cursor-not-allowed filter grayscale-[0.8]",
                    className
                )}
                onClick={handleClick}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                        {Icon && (
                            <div className="mt-0.5 rounded-md bg-muted p-1.5 text-muted-foreground">
                                <Icon className="h-3.5 w-3.5" />
                            </div>
                        )}
                        <h3 className="text-[15px] font-semibold leading-tight text-card-foreground break-words">
                            {title}
                        </h3>
                    </div>
                    {onClick && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
                </div>

                <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className={cn("h-5 px-2 text-[11px] capitalize", isLocked ? "border-muted text-muted-foreground" : DIFFICULTY_STYLES[difficulty])}>
                        {t(`common.difficulty.${difficulty}`, difficulty)}
                    </Badge>
                    {isLocked && minLevel && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-500">
                            <Lock className="h-3 w-3" />
                            <span>{t("common.levelRequired", { level: minLevel, defaultValue: `Lvl ${minLevel} required` })}</span>
                        </div>
                    )}
                </div>

                <div className="mt-2 flex items-center gap-2">
                    <MasteryBar value={safeMastery} showLabel={false} className="flex-1" />
                    <span className="w-9 shrink-0 text-right text-xs font-semibold text-muted-foreground">{masteryLabel}</span>
                </div>
            </Component>
        );
    }

    return (
        <Component
            type={Component === "button" ? "button" : undefined}
            className={cn(
                "w-full rounded-xl border border-border bg-card p-4 text-left transition hover:border-border/80 hover:shadow-sm",
                !isLocked && onClick && "cursor-pointer",
                isLocked && "opacity-60 cursor-not-allowed grayscale-[0.8]",
                className
            )}
            onClick={handleClick}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    {Icon && (
                        <div className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
                            <Icon className="h-4 w-4" />
                        </div>
                    )}
                    <div>
                        <h3 className="text-base font-semibold text-card-foreground">
                            {title}
                        </h3>
                        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
                    </div>
                </div>
                {isLocked ? (
                    <Badge variant="outline" className="border-muted px-2 py-0 text-[10px] text-muted-foreground">
                        <Lock className="mr-1 h-3 w-3 inline" />
                        {t("common.level", { level: minLevel, defaultValue: `Lvl ${minLevel}` })}
                    </Badge>
                ) : (
                    <Badge variant="outline" className={cn("capitalize", DIFFICULTY_STYLES[difficulty])}>
                        {t(`common.difficulty.${difficulty}`, difficulty)}
                    </Badge>
                )}
            </div>

            <div className="mt-3">
                <MasteryBar value={safeMastery} />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                {lastPracticedLabel ? (
                    <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{t("common.lastPracticed", { time: lastPracticedLabel, defaultValue: `Last: ${lastPracticedLabel}` })}</span>
                    </div>
                ) : (
                    <span />
                )}
                {onClick && <ArrowRight className="h-4 w-4" />}
            </div>
        </Component>
    );
}

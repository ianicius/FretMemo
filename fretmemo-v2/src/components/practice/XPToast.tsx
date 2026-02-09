import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Star, Zap, Flame, Trophy, AlertTriangle } from "lucide-react";

interface XPToastProps {
    xp: number;
    isVisible: boolean;
    onClose: () => void;
    streak?: number;
    type?: XPToastType;
    message?: string;
}
export type XPToastType = "correct" | "streak" | "achievement" | "levelup" | "warning";

export function XPToast({
    xp,
    isVisible,
    onClose,
    streak = 0,
    type = "correct",
    message,
}: XPToastProps) {
    useEffect(() => {
        if (!isVisible) return;
        const closeTimer = setTimeout(() => {
            onClose();
        }, 2500);
        return () => {
            clearTimeout(closeTimer);
        };
    }, [isVisible, onClose]);

    if (!isVisible) return null;

    const config = {
        correct: {
            icon: Star,
            iconBgColor: "bg-primary",
            iconTextColor: "text-primary-foreground",
            textColor: "text-primary",
            borderColor: "border-primary/30",
            bgGradient: "from-primary/20 to-primary/5",
            progressColor: "bg-primary",
            defaultMessage: "Correct!",
        },
        streak: {
            icon: Flame,
            iconBgColor: "bg-amber-500",
            iconTextColor: "text-white",
            textColor: "text-amber-600 dark:text-amber-300",
            borderColor: "border-amber-500/30",
            bgGradient: "from-amber-500/20 to-amber-500/5",
            progressColor: "bg-amber-500",
            defaultMessage: `${streak} streak!`,
        },
        achievement: {
            icon: Trophy,
            iconBgColor: "bg-emerald-500",
            iconTextColor: "text-white",
            textColor: "text-emerald-600 dark:text-emerald-300",
            borderColor: "border-emerald-500/30",
            bgGradient: "from-emerald-500/20 to-emerald-500/5",
            progressColor: "bg-emerald-500",
            defaultMessage: "Achievement Unlocked!",
        },
        levelup: {
            icon: Zap,
            iconBgColor: "bg-primary",
            iconTextColor: "text-primary-foreground",
            textColor: "text-primary",
            borderColor: "border-primary/30",
            bgGradient: "from-primary/20 to-primary/5",
            progressColor: "bg-primary",
            defaultMessage: "Level Up!",
        },
        warning: {
            icon: AlertTriangle,
            iconBgColor: "bg-rose-500",
            iconTextColor: "text-white",
            textColor: "text-rose-600 dark:text-rose-300",
            borderColor: "border-rose-500/30",
            bgGradient: "from-rose-500/20 to-rose-500/5",
            progressColor: "bg-rose-500",
            defaultMessage: "Streak lost",
        },
    };

    const { icon: Icon, iconBgColor, iconTextColor, textColor, borderColor, bgGradient, progressColor, defaultMessage } = config[type];

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
            <div
                className={cn(
                    "relative flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg",
                    "bg-gradient-to-r",
                    bgGradient,
                    borderColor,
                    "animate-in slide-in-from-top-4 fade-in duration-300"
                )}
            >
                {/* Icon Circle */}
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", iconBgColor)}>
                    <Icon className={cn("w-5 h-5", iconTextColor)} />
                </div>

                {/* Content */}
                <div className="flex flex-col">
                    <span className="font-bold text-foreground">{message || defaultMessage}</span>
                    {xp > 0 && (
                        <div className="flex items-center gap-1">
                            <span className={cn("text-lg font-black", textColor)}>+{xp}</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">XP</span>
                        </div>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/40 rounded-b-xl overflow-hidden">
                    <div
                        className={cn("h-full rounded-full origin-left animate-[toastProgress_2.5s_linear_forwards]", progressColor)}
                        style={{ transformOrigin: "left center" }}
                    />
                </div>
            </div>
            <style>{`
                @keyframes toastProgress {
                    from { transform: scaleX(0); }
                    to { transform: scaleX(1); }
                }
            `}</style>
        </div>
    );
}

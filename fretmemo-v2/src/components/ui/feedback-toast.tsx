import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type FeedbackTone = "success" | "error" | "info";

interface FeedbackToastProps {
    isOpen: boolean;
    message: string;
    tone?: FeedbackTone;
    onClose: () => void;
    durationMs?: number;
}

export function FeedbackToast({
    isOpen,
    message,
    tone = "info",
    onClose,
    durationMs = 2800,
}: FeedbackToastProps) {
    useEffect(() => {
        if (!isOpen) return;
        const timer = window.setTimeout(onClose, durationMs);
        return () => window.clearTimeout(timer);
    }, [isOpen, message, tone, durationMs, onClose]);

    if (!isOpen || !message) return null;

    const toneStyles = {
        success: "border-emerald-500/30 bg-emerald-500/10 text-foreground",
        error: "border-rose-500/30 bg-rose-500/10 text-foreground",
        info: "border-primary/30 bg-primary/10 text-foreground",
    } as const;
    const iconColor = {
        success: "text-emerald-500",
        error: "text-rose-500",
        info: "text-primary",
    } as const;
    const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertTriangle : Info;

    return (
        <div className="pointer-events-none fixed right-4 top-4 z-[100]">
            <div
                className={cn(
                    "pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-2 shadow-lg backdrop-blur",
                    "animate-in fade-in-0 slide-in-from-top-2 duration-200",
                    toneStyles[tone]
                )}
                role="status"
                aria-live="polite"
            >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor[tone])} />
                <p className="max-w-xs text-sm leading-5">{message}</p>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-current/70 hover:text-current"
                    onClick={onClose}
                    aria-label="Close message"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

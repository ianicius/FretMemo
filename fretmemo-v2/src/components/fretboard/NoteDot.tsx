import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { NoteStatus, Position } from "@/types/fretboard";

interface NoteDotProps {
    noteStatus?: NoteStatus;
    position: Position;
    onClick?: (pos: Position) => void;
    showLabel?: boolean;
    leftHanded?: boolean;
}

export function NoteDot({ noteStatus, position, onClick, showLabel, leftHanded }: NoteDotProps) {
    const status = noteStatus?.status || "idle";
    const isActive = status !== "idle";
    const isStrongActive = status === "active" && noteStatus?.emphasis === "strong";
    const heatOpacity = typeof noteStatus?.opacity === "number" ? Math.max(0.08, noteStatus.opacity) : null;
    const labelText = noteStatus?.label ?? (showLabel ? position.note : null);
    const feedbackText = status === "active" ? noteStatus?.feedbackText : undefined;
    const customColor = noteStatus?.color;
    const idleOpacity = heatOpacity ?? (customColor ? 0.92 : 0);
    const customStyle = customColor && status === "idle"
        ? {
            backgroundColor: customColor,
            borderColor: customColor,
            color: "var(--graphite-900)",
        }
        : undefined;
    const dotAriaLabel = `Note at string ${position.stringIndex + 1}, fret ${position.fret}${position.note ? `, ${position.note}` : ""}`;

    // Determine styling based on status
    const getStatusClasses = () => {
        switch (status) {
            case 'active':
                return "note-dot--active";
            case 'correct':
                return "note-dot--correct";
            case 'incorrect':
                return "note-dot--incorrect";
            default:
                return "note-dot--idle";
        }
    };

    return (
        <div
            className={cn("absolute inset-0 flex items-center justify-center group z-10", onClick && "cursor-pointer")}
            onClick={() => onClick?.(position)}
            onKeyDown={(event) => {
                if (!onClick) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onClick(position);
                }
            }}
            role={onClick ? "button" : "presentation"}
            tabIndex={onClick ? 0 : -1}
            aria-label={dotAriaLabel}
        >
            {feedbackText && (
                <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={cn(
                        "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[175%] rounded-full border border-rose-300/70 bg-rose-50/95 px-2 py-0.5 text-[10px] font-semibold text-rose-700 shadow-sm dark:border-rose-500/40 dark:bg-rose-950/80 dark:text-rose-200",
                        leftHanded && "scale-x-[-1]"
                    )}
                    aria-hidden="true"
                >
                    {feedbackText}
                </motion.div>
            )}

            {/* The Dot Circle */}
            <motion.div
                initial={false}
                animate={{
                    scale: isActive ? 1.12 : heatOpacity !== null ? 0.92 : 0.85,
                    opacity: isActive ? 1 : idleOpacity
                }}
                whileHover={{ scale: 1.2, opacity: 1 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={cn(
                    "note-dot",
                    getStatusClasses(),
                    isStrongActive && "note-dot--active-strong",
                    leftHanded && "transform scale-x-[-1]"
                )}
                style={customStyle}
            >
                {labelText && (
                    <span className={cn(leftHanded && "transform scale-x-[-1]")}>
                        {labelText}
                    </span>
                )}
            </motion.div>

            {/* Invisible hit area for easier clicking when idle */}
            {!isActive && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/10" />
                    </div>
                </div>
            )}
        </div>
    );
}

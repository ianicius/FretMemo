import { cn } from "@/lib/utils";
import { STANDARD_TUNING } from "@/lib/constants";
import type { NoteName, Position } from "@/types/fretboard";

interface TabViewProps {
  tuning?: NoteName[];
  position?: Position | null;
  leftHanded?: boolean;
  className?: string;
}

export function TabView({ tuning = STANDARD_TUNING, position, leftHanded = false, className }: TabViewProps) {
  const rows = leftHanded
    ? tuning.map((openNote, index) => ({
        openNote,
        stringIndex: tuning.length - 1 - index,
      }))
    : tuning.map((openNote, index) => ({
        openNote,
        stringIndex: index,
      }));

  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <div className="rounded-2xl border border-border/60 bg-card/40 shadow-sm px-4 py-5">
        <div className="space-y-2 font-mono text-sm">
          {rows.map(({ openNote, stringIndex }) => {
            const isTarget = Boolean(position && position.stringIndex === stringIndex);
            const fretText = isTarget && position ? String(position.fret) : "-";

            return (
              <div key={`${openNote}-${stringIndex}`} className="flex items-center gap-2">
                <span className="w-8 text-muted-foreground font-semibold">{openNote}</span>
                <span className="text-muted-foreground">|--</span>
                <span
                  className={cn(
                    "w-10 text-center font-bold tabular-nums rounded-md border px-1 py-0.5",
                    isTarget
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/40 bg-muted/20 text-muted-foreground"
                  )}
                >
                  {fretText}
                </span>
                <span className="text-muted-foreground">--|</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

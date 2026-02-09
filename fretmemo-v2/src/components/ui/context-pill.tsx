import { Button } from "@/components/ui/button";
import { useGameStore } from "@/stores/useGameStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { normalizeTuning, INSTRUMENT_LABELS } from "@/lib/tuning";
import { Settings } from "lucide-react";

interface ContextPillProps {
    onOpenSettings?: () => void;
}

export function ContextPill({ onOpenSettings }: ContextPillProps) {
    const bpm = useGameStore((state) => state.bpm);
    const instrumentType = useSettingsStore((state) => state.full.instrument.type);
    const tuning = useSettingsStore((state) => state.quick.tuning);
    const normalizedTuning = normalizeTuning(tuning);
    const instrumentLabel = INSTRUMENT_LABELS[instrumentType];

    return (
        <div className="flex items-center justify-between gap-3 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground">
            <span className="truncate">
                {instrumentLabel} · {normalizedTuning.slice().reverse().join("-")} · {bpm} BPM
            </span>
            {onOpenSettings && (
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onOpenSettings}>
                    <Settings className="h-3.5 w-3.5" />
                    <span className="sr-only">Open settings</span>
                </Button>
            )}
        </div>
    );
}

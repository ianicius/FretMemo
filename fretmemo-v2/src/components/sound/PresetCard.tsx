/**
 * One preset card in the Sound screen grid: name, character description,
 * category badge, live engine status for its model and the two actions
 * (select / audition). Custom presets additionally get a delete action
 * (confirm dialog handled by the page).
 */
import { Check, Loader2, Play, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { motion } from "framer-motion";
import type { SoundEngineStatus } from "@/audio/engine";
import type { SoundPreset } from "@/audio/presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
    ampLabelKey,
    getPresetBadge,
    getPresetDescription,
    getPresetName,
} from "./presetUtils";

interface PresetCardProps {
    preset: SoundPreset;
    /** The persisted, active preset (`full.audio.soundPreset`). */
    active: boolean;
    /** Engine status while the engine sits on this preset, else null. */
    engineStatus: SoundEngineStatus | null;
    /** True while this card's audition phrase plays. */
    auditioning: boolean;
    onSelect: () => void;
    onAudition: () => void;
    /** Present for custom presets only. */
    onDelete?: () => void;
}

export function PresetCard({
    preset,
    active,
    engineStatus,
    auditioning,
    onSelect,
    onAudition,
    onDelete,
}: PresetCardProps) {
    const { t } = useTranslation();
    const badge = getPresetBadge(preset, t);
    const description = getPresetDescription(preset, t);
    const isLoading = engineStatus === "loading";
    const hasError = engineStatus === "error";

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
        >
            <Card
                className={cn(
                    "flex h-full flex-col transition-colors",
                    active && "border-primary ring-1 ring-primary",
                )}
                aria-current={active ? "true" : undefined}
            >
                <CardContent className="flex h-full flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                        <Badge
                            variant={badge.tone === "custom" ? "secondary" : "outline"}
                            className={cn(
                                badge.tone === "nam" && "border-primary/40 text-primary",
                                badge.tone === "acoustic" && "text-foreground/80",
                            )}
                        >
                            {badge.label}
                        </Badge>
                        {active && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                                <Check className="h-3.5 w-3.5" />
                                {t("sound.status.active")}
                            </span>
                        )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="truncate text-sm font-semibold text-card-foreground" title={getPresetName(preset, t)}>
                            {getPresetName(preset, t)}
                        </h3>
                        {description ? (
                            <p className="text-xs leading-snug text-muted-foreground">{description}</p>
                        ) : (
                            preset.kind === "custom" && (
                                <p className="text-xs leading-snug text-muted-foreground">
                                    {t(ampLabelKey(preset.amp))}
                                </p>
                            )
                        )}
                    </div>

                    {isLoading && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {t("sound.status.loading")}
                        </p>
                    )}
                    {hasError && (
                        <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5">
                            <p className="flex min-w-0 items-center gap-1.5 text-xs text-destructive">
                                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{t("sound.status.error")}</span>
                            </p>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0 px-2 text-xs"
                                onClick={onSelect}
                            >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                {t("sound.status.retry")}
                            </Button>
                        </div>
                    )}
                    {/* Deterministic Ready line: only the ACTIVE card shows it,
                        and only while the engine reports ready for exactly that
                        preset — identical on every path (initial restore,
                        explicit select, post-delete fallback). Loading/error
                        states render instead while present. */}
                    {active && engineStatus === "ready" && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                            <Check className="h-3.5 w-3.5" />
                            {t("sound.status.ready")}
                        </p>
                    )}

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant={active ? "secondary" : "default"}
                            className="h-8 flex-1"
                            onClick={onSelect}
                            disabled={active || isLoading}
                        >
                            {active ? t("sound.actions.selected") : t("sound.actions.select")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 flex-1"
                            onClick={onAudition}
                            disabled={auditioning}
                        >
                            {auditioning ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Play className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            {auditioning ? t("sound.actions.auditioning") : t("sound.actions.audition")}
                        </Button>
                        {onDelete && (
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={onDelete}
                                aria-label={t("sound.actions.deleteTone")}
                                title={t("sound.actions.deleteTone")}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

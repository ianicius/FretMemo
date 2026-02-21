import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

interface TechniqueActionCue {
    label: string;
    notation: string;
    detail?: string;
}

interface TechniqueStatusCardProps {
    currentStringLabel: string;
    currentStep: number;
    tempoBpm: number;
    speedUpEnabled: boolean;
    speedUpAmount: number;
    speedUpInterval: number;
    isPlaying: boolean;
    nextIncreaseInBeats: number;
    showPermutationMeta: boolean;
    permutationModeLabel: string;
    permutationTierLabel: string;
    permutationStringsToPlay: number;
    permutationDirection: string;
    techniqueCue: TechniqueActionCue | null;
    displayedPatternLabel: string;
}

export function TechniqueStatusCard({
    currentStringLabel,
    currentStep,
    tempoBpm,
    speedUpEnabled,
    speedUpAmount,
    speedUpInterval,
    isPlaying,
    nextIncreaseInBeats,
    showPermutationMeta,
    permutationModeLabel,
    permutationTierLabel,
    permutationStringsToPlay,
    permutationDirection,
    techniqueCue,
    displayedPatternLabel,
}: TechniqueStatusCardProps) {
    const { t } = useTranslation();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t("technique.status.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("technique.status.currentString")}</span>
                    <span className="font-medium">{currentStringLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("technique.status.step")}</span>
                    <span className="font-medium">{currentStep}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("technique.status.tempo")}</span>
                    <span className="font-medium">{tempoBpm} BPM</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("technique.status.speedUp")}</span>
                    <span className="font-medium">{speedUpEnabled ? `+${speedUpAmount}/${speedUpInterval}b` : t("technique.status.off")}</span>
                </div>
                {speedUpEnabled && isPlaying && (
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("technique.status.nextIncreaseIn")}</span>
                        <span className="font-medium">
                            {nextIncreaseInBeats} {nextIncreaseInBeats !== 1 ? t("technique.status.beats") : t("technique.status.beat")}
                        </span>
                    </div>
                )}
                {showPermutationMeta && (
                    <>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("technique.status.mode")}</span>
                            <span className="font-medium">{permutationModeLabel}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("technique.status.tier")}</span>
                            <span className="font-medium">{permutationTierLabel}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("technique.status.strings")}</span>
                            <span className="font-medium">{permutationStringsToPlay}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("technique.status.direction")}</span>
                            <span className="font-medium">{permutationDirection}</span>
                        </div>
                    </>
                )}
                {techniqueCue && (
                    <div className="space-y-1 rounded-md border border-primary/20 bg-primary/5 p-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{t("technique.status.currentAction")}</span>
                            <Badge variant="secondary">{techniqueCue.label}</Badge>
                        </div>
                        <div className="font-mono text-sm">{techniqueCue.notation}</div>
                        {techniqueCue.detail && <div className="text-xs text-muted-foreground">{techniqueCue.detail}</div>}
                    </div>
                )}
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("technique.status.pattern")}</span>
                    <Badge variant="secondary">{displayedPatternLabel}</Badge>
                </div>
            </CardContent>
        </Card>
    );
}

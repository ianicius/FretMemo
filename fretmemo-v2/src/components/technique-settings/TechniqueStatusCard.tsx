import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current String</span>
                    <span className="font-medium">{currentStringLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Step</span>
                    <span className="font-medium">{currentStep}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tempo</span>
                    <span className="font-medium">{tempoBpm} BPM</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Speed-Up</span>
                    <span className="font-medium">{speedUpEnabled ? `+${speedUpAmount}/${speedUpInterval}b` : "Off"}</span>
                </div>
                {speedUpEnabled && isPlaying && (
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Next Increase In</span>
                        <span className="font-medium">
                            {nextIncreaseInBeats} beat{nextIncreaseInBeats !== 1 ? "s" : ""}
                        </span>
                    </div>
                )}
                {showPermutationMeta && (
                    <>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Mode</span>
                            <span className="font-medium">{permutationModeLabel}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tier</span>
                            <span className="font-medium">{permutationTierLabel}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Strings</span>
                            <span className="font-medium">{permutationStringsToPlay}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Direction</span>
                            <span className="font-medium capitalize">{permutationDirection}</span>
                        </div>
                    </>
                )}
                {techniqueCue && (
                    <div className="space-y-1 rounded-md border border-primary/20 bg-primary/5 p-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Current Action</span>
                            <Badge variant="secondary">{techniqueCue.label}</Badge>
                        </div>
                        <div className="font-mono text-sm">{techniqueCue.notation}</div>
                        {techniqueCue.detail && <div className="text-xs text-muted-foreground">{techniqueCue.detail}</div>}
                    </div>
                )}
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pattern</span>
                    <Badge variant="secondary">{displayedPatternLabel}</Badge>
                </div>
            </CardContent>
        </Card>
    );
}

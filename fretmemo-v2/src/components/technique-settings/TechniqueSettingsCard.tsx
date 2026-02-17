import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Settings2 } from "lucide-react";

interface SelectOption {
    value: string;
    label: string;
}

interface PatternOption {
    value: number;
    label: string;
}

interface TechniqueSettingsCardProps {
    isPlaying: boolean;
    stepMode: boolean;
    onStepModeChange: (checked: boolean) => void;
    startFret: number;
    onStartFretChange: (fret: number) => void;

    showPermutation: boolean;
    permutationMode: string;
    permutationModeOptions: ReadonlyArray<SelectOption>;
    onPermutationModeChange: (value: string) => void;
    permutationTier: string;
    onPermutationTierChange: (value: string) => void;
    permutationPattern: number;
    permutationPatternOptions: ReadonlyArray<PatternOption>;
    onPermutationPatternChange: (value: number) => void;
    permutationDailyMode: boolean;
    permutationStringsToPlay: number;
    permutationStringsMax: number;
    onPermutationStringsToPlayChange: (value: number) => void;
    permutationDirection: string;
    onPermutationDirectionChange: (value: string) => void;
    randomSwitchBars: number;
    onRandomSwitchBarsChange: (value: number) => void;
    showRandomSwitchBars: boolean;

    showDiagonal: boolean;
    diagonalPattern: string;
    onDiagonalPatternChange: (value: string) => void;
    diagonalStringsPerGroup: number;
    diagonalStringsMax: number;
    onDiagonalStringsPerGroupChange: (value: number) => void;
    diagonalPickingStyle: string;
    onDiagonalPickingStyleChange: (value: string) => void;
    diagonalShowPickDirection: boolean;
    onDiagonalShowPickDirectionChange: (checked: boolean) => void;

    showStringSkip: boolean;
    stringSkipPattern: string;
    stringSkipPatternOptions: ReadonlyArray<SelectOption>;
    onStringSkipPatternChange: (value: string) => void;
    stringSkipPickingFocus: string;
    onStringSkipPickingFocusChange: (value: string) => void;
    stringSkipStartPickDirection: string;
    onStringSkipStartPickDirectionChange: (value: string) => void;
    stringSkipShowPickIndicators: boolean;
    onStringSkipShowPickIndicatorsChange: (checked: boolean) => void;

    showLegato: boolean;
    legatoExerciseType: string;
    onLegatoExerciseTypeChange: (value: string) => void;
    legatoTrillPair: string;
    legatoTrillPairOptions: ReadonlyArray<string>;
    onLegatoTrillPairChange: (value: string) => void;

    showLinear: boolean;
    linearString: number;
    linearStringMax: number;
    onLinearStringChange: (value: number) => void;
    linearEndFret: number;
    linearEndFretMin: number;
    linearEndFretMax: number;
    onLinearEndFretChange: (value: number) => void;
    linearNotesPerShift: number;
    onLinearNotesPerShiftChange: (value: number) => void;
    linearDirection: string;
    onLinearDirectionChange: (value: string) => void;
    linearShiftAmount: number;
    onLinearShiftAmountChange: (value: number) => void;
    linearPickingStyle: string;
    onLinearPickingStyleChange: (value: string) => void;

    speedUpEnabled: boolean;
    onSpeedUpEnabledChange: (checked: boolean) => void;
    speedUpAmount: number;
    onSpeedUpAmountChange: (value: number) => void;
    speedUpInterval: number;
    onSpeedUpIntervalChange: (value: number) => void;
}

export function TechniqueSettingsCard({
    isPlaying,
    stepMode,
    onStepModeChange,
    startFret,
    onStartFretChange,
    showPermutation,
    permutationMode,
    permutationModeOptions,
    onPermutationModeChange,
    permutationTier,
    onPermutationTierChange,
    permutationPattern,
    permutationPatternOptions,
    onPermutationPatternChange,
    permutationDailyMode,
    permutationStringsToPlay,
    permutationStringsMax,
    onPermutationStringsToPlayChange,
    permutationDirection,
    onPermutationDirectionChange,
    randomSwitchBars,
    onRandomSwitchBarsChange,
    showRandomSwitchBars,
    showDiagonal,
    diagonalPattern,
    onDiagonalPatternChange,
    diagonalStringsPerGroup,
    diagonalStringsMax,
    onDiagonalStringsPerGroupChange,
    diagonalPickingStyle,
    onDiagonalPickingStyleChange,
    diagonalShowPickDirection,
    onDiagonalShowPickDirectionChange,
    showStringSkip,
    stringSkipPattern,
    stringSkipPatternOptions,
    onStringSkipPatternChange,
    stringSkipPickingFocus,
    onStringSkipPickingFocusChange,
    stringSkipStartPickDirection,
    onStringSkipStartPickDirectionChange,
    stringSkipShowPickIndicators,
    onStringSkipShowPickIndicatorsChange,
    showLegato,
    legatoExerciseType,
    onLegatoExerciseTypeChange,
    legatoTrillPair,
    legatoTrillPairOptions,
    onLegatoTrillPairChange,
    showLinear,
    linearString,
    linearStringMax,
    onLinearStringChange,
    linearEndFret,
    linearEndFretMin,
    linearEndFretMax,
    onLinearEndFretChange,
    linearNotesPerShift,
    onLinearNotesPerShiftChange,
    linearDirection,
    onLinearDirectionChange,
    linearShiftAmount,
    onLinearShiftAmountChange,
    linearPickingStyle,
    onLinearPickingStyleChange,
    speedUpEnabled,
    onSpeedUpEnabledChange,
    speedUpAmount,
    onSpeedUpAmountChange,
    speedUpInterval,
    onSpeedUpIntervalChange,
}: TechniqueSettingsCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings2 className="h-4 w-4" />
                    Settings
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label htmlFor="step-mode">Step Mode</Label>
                    <Switch id="step-mode" checked={stepMode} onCheckedChange={onStepModeChange} disabled={isPlaying} />
                </div>

                <div className="space-y-2">
                    <Label>Start Fret</Label>
                    <div className="flex gap-2">
                        {[1, 3, 5, 7].map((fret) => (
                            <Button
                                key={fret}
                                variant={startFret === fret ? "default" : "outline"}
                                size="sm"
                                onClick={() => onStartFretChange(fret)}
                                disabled={isPlaying}
                                className="flex-1"
                            >
                                {fret}
                            </Button>
                        ))}
                    </div>
                </div>

                {showPermutation && (
                    <div className="space-y-4 rounded-md border border-border/50 p-3">
                        <div className="space-y-2">
                            <Label htmlFor="permutation-mode">Mode</Label>
                            <Select
                                id="permutation-mode"
                                value={permutationMode}
                                onChange={(event) => onPermutationModeChange(event.target.value)}
                                disabled={isPlaying}
                                className="h-9 py-2"
                            >
                                {permutationModeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="permutation-tier">Tier</Label>
                            <Select
                                id="permutation-tier"
                                value={permutationTier}
                                onChange={(event) => onPermutationTierChange(event.target.value)}
                                disabled={isPlaying}
                                className="h-9 py-2"
                            >
                                <option value="all">All Tiers (24)</option>
                                <option value="1">Tier 1 - Beginner</option>
                                <option value="2">Tier 2 - Intermediate</option>
                                <option value="3">Tier 3 - Advanced</option>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="permutation-pattern">Pattern</Label>
                            <Select
                                id="permutation-pattern"
                                value={String(permutationPattern)}
                                onChange={(event) => onPermutationPatternChange(Number(event.target.value))}
                                disabled={isPlaying || permutationDailyMode}
                                className="h-9 py-2"
                            >
                                {permutationPatternOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                            {permutationDailyMode && (
                                <p className="text-xs text-muted-foreground">Daily challenge selects a fixed pattern for today.</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <Label className="text-sm">Strings to play</Label>
                                <span className="font-mono text-xs">{permutationStringsToPlay}</span>
                            </div>
                            <Slider
                                value={[permutationStringsToPlay]}
                                onValueChange={([value]) => onPermutationStringsToPlayChange(value)}
                                min={1}
                                max={permutationStringsMax}
                                step={1}
                                disabled={isPlaying}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Direction</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: "ascending", label: "Ascending" },
                                    { value: "descending", label: "Descending" },
                                    { value: "both", label: "Both" },
                                ].map((option) => (
                                    <Button
                                        key={option.value}
                                        variant={permutationDirection === option.value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onPermutationDirectionChange(option.value)}
                                        disabled={isPlaying}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label>Sticky Fingers</Label>
                                <p className="text-xs text-muted-foreground">Enabled by default in Permutation Trainer (Spider-style).</p>
                            </div>
                            <Badge variant="secondary">On</Badge>
                        </div>

                        {showRandomSwitchBars && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <Label className="text-sm">Random switch every</Label>
                                    <span className="font-mono text-xs">
                                        {randomSwitchBars} bar{randomSwitchBars > 1 ? "s" : ""}
                                    </span>
                                </div>
                                <Slider
                                    value={[randomSwitchBars]}
                                    onValueChange={([value]) => onRandomSwitchBarsChange(value)}
                                    min={1}
                                    max={8}
                                    step={1}
                                    disabled={isPlaying}
                                />
                            </div>
                        )}
                    </div>
                )}

                {showDiagonal && (
                    <div className="space-y-4 rounded-md border border-border/50 p-3">
                        <div className="space-y-2">
                            <Label>Pattern</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: "ascending", label: "Ascending" },
                                    { value: "descending", label: "Descending" },
                                    { value: "full", label: "Full" },
                                ].map((option) => (
                                    <Button
                                        key={option.value}
                                        variant={diagonalPattern === option.value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onDiagonalPatternChange(option.value)}
                                        disabled={isPlaying}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <Label className="text-sm">Strings per group</Label>
                                <span className="font-mono text-xs">{diagonalStringsPerGroup}</span>
                            </div>
                            <Slider
                                value={[diagonalStringsPerGroup]}
                                onValueChange={([value]) => onDiagonalStringsPerGroupChange(value)}
                                min={2}
                                max={diagonalStringsMax}
                                step={1}
                                disabled={isPlaying}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Picking Style</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "alternate", label: "Alternate" },
                                    { value: "economy", label: "Economy" },
                                ].map((option) => (
                                    <Button
                                        key={option.value}
                                        variant={diagonalPickingStyle === option.value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onDiagonalPickingStyleChange(option.value)}
                                        disabled={isPlaying}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="diagonal-pick-indicators">Show pick indicators</Label>
                            <Switch
                                id="diagonal-pick-indicators"
                                checked={diagonalShowPickDirection}
                                onCheckedChange={onDiagonalShowPickDirectionChange}
                            />
                        </div>
                    </div>
                )}

                {showStringSkip && (
                    <div className="space-y-4 rounded-md border border-border/50 p-3">
                        <div className="space-y-2">
                            <Label htmlFor="string-skip-pattern">Skip Pattern</Label>
                            <Select
                                id="string-skip-pattern"
                                value={stringSkipPattern}
                                onChange={(event) => onStringSkipPatternChange(event.target.value)}
                                disabled={isPlaying}
                                className="h-9 py-2"
                            >
                                {stringSkipPatternOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Picking Focus</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: "alternate", label: "Alternate" },
                                    { value: "inside", label: "Inside" },
                                    { value: "outside", label: "Outside" },
                                ].map((option) => (
                                    <Button
                                        key={option.value}
                                        variant={stringSkipPickingFocus === option.value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onStringSkipPickingFocusChange(option.value)}
                                        disabled={isPlaying}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Start Pick Direction</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "down", label: "Down (v)" },
                                    { value: "up", label: "Up (^)" },
                                ].map((option) => (
                                    <Button
                                        key={option.value}
                                        variant={stringSkipStartPickDirection === option.value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onStringSkipStartPickDirectionChange(option.value)}
                                        disabled={isPlaying}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="string-skip-pick-indicators">Show pick indicators</Label>
                            <Switch
                                id="string-skip-pick-indicators"
                                checked={stringSkipShowPickIndicators}
                                onCheckedChange={onStringSkipShowPickIndicatorsChange}
                            />
                        </div>
                    </div>
                )}

                {showLegato && (
                    <div className="space-y-4 rounded-md border border-border/50 p-3">
                        <div className="space-y-2">
                            <Label>Exercise Type</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "trill", label: "Trill" },
                                    { value: "hammerOnly", label: "Hammer Spider" },
                                    { value: "pullOnly", label: "Pull Desc" },
                                    { value: "threeNote", label: "3-Note" },
                                ].map((option) => (
                                    <Button
                                        key={option.value}
                                        variant={legatoExerciseType === option.value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onLegatoExerciseTypeChange(option.value)}
                                        disabled={isPlaying}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {legatoExerciseType === "trill" && (
                            <div className="space-y-2">
                                <Label htmlFor="legato-trill-pair">Trill Pair</Label>
                                <Select
                                    id="legato-trill-pair"
                                    value={legatoTrillPair}
                                    onChange={(event) => onLegatoTrillPairChange(event.target.value)}
                                    disabled={isPlaying}
                                    className="h-9 py-2"
                                >
                                    {legatoTrillPairOptions.map((pair) => (
                                        <option key={pair} value={pair}>
                                            {pair}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}

                        <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground">
                            Legato notation follows guitar standard: <span className="font-mono">5h7</span> for hammer-on,{" "}
                            <span className="font-mono">7p5</span> for pull-off.
                        </div>
                    </div>
                )}

                {showLinear && (
                    <div className="space-y-4 rounded-md border border-border/50 p-3">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <Label className="text-sm">String</Label>
                                <span className="font-mono text-xs">{linearString}</span>
                            </div>
                            <Slider
                                value={[linearString]}
                                onValueChange={([value]) => onLinearStringChange(value)}
                                min={1}
                                max={linearStringMax}
                                step={1}
                                disabled={isPlaying}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <Label className="text-sm">End Fret</Label>
                                <span className="font-mono text-xs">{linearEndFret}</span>
                            </div>
                            <Slider
                                value={[linearEndFret]}
                                onValueChange={([value]) => onLinearEndFretChange(value)}
                                min={linearEndFretMin}
                                max={linearEndFretMax}
                                step={1}
                                disabled={isPlaying}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Notes per Shift</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[4, 5, 6].map((value) => (
                                    <Button
                                        key={value}
                                        variant={linearNotesPerShift === value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onLinearNotesPerShiftChange(value)}
                                        disabled={isPlaying}
                                    >
                                        {value}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Direction</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: "ascending", label: "Asc" },
                                    { value: "descending", label: "Desc" },
                                    { value: "roundTrip", label: "Round" },
                                ].map((option) => (
                                    <Button
                                        key={option.value}
                                        variant={linearDirection === option.value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onLinearDirectionChange(option.value)}
                                        disabled={isPlaying}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <Label className="text-sm">Shift Amount</Label>
                                <span className="font-mono text-xs">{linearShiftAmount}</span>
                            </div>
                            <Slider
                                value={[linearShiftAmount]}
                                onValueChange={([value]) => onLinearShiftAmountChange(value)}
                                min={1}
                                max={3}
                                step={1}
                                disabled={isPlaying}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Picking Style</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "alternate", label: "Alternate" },
                                    { value: "legato", label: "Legato" },
                                ].map((option) => (
                                    <Button
                                        key={option.value}
                                        variant={linearPickingStyle === option.value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onLinearPickingStyleChange(option.value)}
                                        disabled={isPlaying}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-3 border-t border-border/50 pt-3">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="speed-up">Auto Speed-Up</Label>
                        <Switch id="speed-up" checked={speedUpEnabled} onCheckedChange={onSpeedUpEnabledChange} />
                    </div>

                    <div className={cn("space-y-3", !speedUpEnabled && "opacity-50")}>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <Label className="text-sm">Increase</Label>
                                <span className="font-mono text-xs">+{speedUpAmount} BPM</span>
                            </div>
                            <Slider
                                value={[speedUpAmount]}
                                onValueChange={([value]) => onSpeedUpAmountChange(value)}
                                min={1}
                                max={20}
                                step={1}
                                disabled={!speedUpEnabled}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <Label className="text-sm">Every</Label>
                                <span className="font-mono text-xs">
                                    {speedUpInterval} beat{speedUpInterval > 1 ? "s" : ""}
                                </span>
                            </div>
                            <Slider
                                value={[speedUpInterval]}
                                onValueChange={([value]) => onSpeedUpIntervalChange(value)}
                                min={1}
                                max={32}
                                step={1}
                                disabled={!speedUpEnabled}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

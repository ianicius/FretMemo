import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    renderContainer?: boolean;
    contentClassName?: string;
    showCoreControls?: boolean;
    showSpeedUpControls?: boolean;
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
    renderContainer = true,
    contentClassName,
    showCoreControls = true,
    showSpeedUpControls = true,
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
    const { t } = useTranslation();

    const content = (
        <div className={cn("space-y-4", contentClassName)}>
            {showCoreControls && (
                <div className="flex items-center justify-between">
                    <Label htmlFor="step-mode">{t("technique.settings.stepMode")}</Label>
                    <Switch id="step-mode" checked={stepMode} onCheckedChange={onStepModeChange} disabled={isPlaying} />
                </div>
            )}

            {showCoreControls && (
                <div className="space-y-2">
                    <Label>{t("technique.settings.startFret")}</Label>
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
            )}

            {showPermutation && (
                <div className="space-y-4 rounded-md border border-border/50 p-3">
                    <div className="space-y-2">
                        <Label htmlFor="permutation-mode">{t("technique.settings.mode")}</Label>
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
                        <Label htmlFor="permutation-tier">{t("technique.settings.tier")}</Label>
                        <Select
                            id="permutation-tier"
                            value={permutationTier}
                            onChange={(event) => onPermutationTierChange(event.target.value)}
                            disabled={isPlaying}
                            className="h-9 py-2"
                        >
                            <option value="all">{t("technique.settings.tierOptions.all")}</option>
                            <option value="1">{t("technique.settings.tierOptions.tier1")}</option>
                            <option value="2">{t("technique.settings.tierOptions.tier2")}</option>
                            <option value="3">{t("technique.settings.tierOptions.tier3")}</option>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="permutation-pattern">{t("technique.settings.pattern")}</Label>
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
                            <p className="text-xs text-muted-foreground">{t("technique.settings.dailyModeHint")}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <Label className="text-sm">{t("technique.settings.stringsToPlay")}</Label>
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
                        <Label>{t("technique.settings.direction")}</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: "ascending", label: t("technique.settings.directionOptions.ascending") },
                                { value: "descending", label: t("technique.settings.directionOptions.descending") },
                                { value: "both", label: t("technique.settings.directionOptions.both") },
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
                            <Label>{t("technique.settings.stickyFingers")}</Label>
                            <p className="text-xs text-muted-foreground">{t("technique.settings.stickyFingersHint")}</p>
                        </div>
                        <Badge variant="secondary">{t("technique.settings.on")}</Badge>
                    </div>

                    {showRandomSwitchBars && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <Label className="text-sm">{t("technique.settings.randomSwitchEvery")}</Label>
                                <span className="font-mono text-xs">
                                    {randomSwitchBars} {randomSwitchBars > 1 ? t("technique.settings.bars") : t("technique.settings.bar")}
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
                            <Label>{t("technique.settings.pattern")}</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: "ascending", label: t("technique.settings.diagonalPatternOptions.ascending") },
                                    { value: "descending", label: t("technique.settings.diagonalPatternOptions.descending") },
                                    { value: "full", label: t("technique.settings.diagonalPatternOptions.full") },
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
                                <Label className="text-sm">{t("technique.settings.stringsPerGroup")}</Label>
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
                            <Label>{t("technique.settings.pickingStyle")}</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "alternate", label: t("technique.settings.pickingStyles.alternate") },
                                    { value: "economy", label: t("technique.settings.pickingStyles.economy") },
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
                            <Label htmlFor="diagonal-pick-indicators">{t("technique.settings.showPickIndicators")}</Label>
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
                            <Label htmlFor="string-skip-pattern">{t("technique.settings.skipPattern")}</Label>
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
                            <Label>{t("technique.settings.pickingFocus")}</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: "alternate", label: t("technique.settings.pickingFocusOptions.alternate") },
                                    { value: "inside", label: t("technique.settings.pickingFocusOptions.inside") },
                                    { value: "outside", label: t("technique.settings.pickingFocusOptions.outside") },
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
                            <Label>{t("technique.settings.startPickDirection")}</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "down", label: t("technique.settings.pickDirectionOptions.down") },
                                    { value: "up", label: t("technique.settings.pickDirectionOptions.up") },
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
                            <Label htmlFor="string-skip-pick-indicators">{t("technique.settings.showPickIndicators")}</Label>
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
                            <Label>{t("technique.settings.exerciseType")}</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "trill", label: t("technique.settings.legatoTypeOptions.trill") },
                                    { value: "hammerOnly", label: t("technique.settings.legatoTypeOptions.hammerOnly") },
                                    { value: "pullOnly", label: t("technique.settings.legatoTypeOptions.pullOnly") },
                                    { value: "threeNote", label: t("technique.settings.legatoTypeOptions.threeNote") },
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
                                <Label htmlFor="legato-trill-pair">{t("technique.settings.trillPair")}</Label>
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
                            {t("technique.settings.legatoNotationHintPrefix")} <span className="font-mono">5h7</span> {t("technique.settings.legatoNotationHintMiddle")}{" "}
                            <span className="font-mono">7p5</span> {t("technique.settings.legatoNotationHintSuffix")}
                        </div>
                    </div>
                )}

                {showLinear && (
                    <div className="space-y-4 rounded-md border border-border/50 p-3">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <Label className="text-sm">{t("technique.settings.string")}</Label>
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
                                <Label className="text-sm">{t("technique.settings.endFret")}</Label>
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
                            <Label>{t("technique.settings.notesPerShift")}</Label>
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
                            <Label>{t("technique.settings.direction")}</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: "ascending", label: t("technique.settings.linearDirectionOptions.asc") },
                                    { value: "descending", label: t("technique.settings.linearDirectionOptions.desc") },
                                    { value: "roundTrip", label: t("technique.settings.linearDirectionOptions.round") },
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
                                <Label className="text-sm">{t("technique.settings.shiftAmount")}</Label>
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
                            <Label>{t("technique.settings.pickingStyle")}</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "alternate", label: t("technique.settings.pickingStyles.alternate") },
                                    { value: "legato", label: t("technique.settings.pickingStyles.legato") },
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

            {showSpeedUpControls && (
                <div className="space-y-3 border-t border-border/50 pt-3">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="speed-up">{t("technique.settings.autoSpeedUp")}</Label>
                        <Switch id="speed-up" checked={speedUpEnabled} onCheckedChange={onSpeedUpEnabledChange} />
                    </div>

                    <div className={cn("space-y-3", !speedUpEnabled && "opacity-50")}>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <Label className="text-sm">{t("technique.settings.increase")}</Label>
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
                                <Label className="text-sm">{t("technique.settings.every")}</Label>
                                <span className="font-mono text-xs">
                                    {speedUpInterval} {speedUpInterval > 1 ? t("technique.settings.beats") : t("technique.settings.beat")}
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
            )}
        </div>
    );

    if (!renderContainer) return content;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings2 className="h-4 w-4" />
                    {t("technique.settings.title")}
                </CardTitle>
            </CardHeader>
            <CardContent>{content}</CardContent>
        </Card>
    );
}

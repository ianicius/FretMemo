import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContextPill } from "@/components/ui/context-pill";
import { Fretboard } from "@/components/fretboard/Fretboard";
import type { NoteName, NoteStatus } from "@/types/fretboard";
import { getNoteAt } from "@/lib/constants";
import { getStringLabels, normalizeTuning } from "@/lib/tuning";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { TECHNIQUE_EXERCISES } from "@/data/techniqueExercises";
import { ArrowLeft, Play, Square, Settings2, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { TechniqueSettingsCard } from "@/components/technique-settings/TechniqueSettingsCard";
import { TechniqueStatusCard } from "@/components/technique-settings/TechniqueStatusCard";
import { TechniqueSetupDialog } from "@/components/technique-settings/TechniqueSetupDialog";
import { useTranslation } from "react-i18next";
import { trackEvent, trackFeatureOpened } from "@/lib/analytics";
const SPIDER_FINGERS = 4;
const TECHNIQUE_FRETS = 12;
const BEATS_PER_BAR = 4;

type StringDirection = "up" | "down";
type FretDirection = "right" | "left";
type PermutationMode = "single" | "daily" | "sequential" | "random";
type PermutationTier = 1 | 2 | 3;
type PermutationTierFilter = PermutationTier | "all";
type PermutationDirection = "ascending" | "descending" | "both";
type DiagonalPattern = "ascending" | "descending" | "full";
type DiagonalPickingStyle = "alternate" | "economy";
type StringSkipPattern = "single" | "octave" | "double" | "wide";
type StringSkipPickingFocus = "alternate" | "inside" | "outside";
type PickDirection = "down" | "up";
type LegatoExerciseType = "trill" | "hammerOnly" | "pullOnly" | "threeNote";
type LegatoTrillPair = "1-2" | "1-3" | "1-4" | "2-3" | "2-4" | "3-4";
type LinearDirection = "ascending" | "descending" | "roundTrip";
type LinearPickingStyle = "alternate" | "legato";

interface TechniqueActionCue {
    label: string;
    notation: string;
    detail?: string;
}

interface PermutationPattern {
    pattern: [number, number, number, number];
    tier: PermutationTier;
}

const PERMUTATIONS: PermutationPattern[] = [
    { pattern: [1, 2, 3, 4], tier: 1 },
    { pattern: [1, 2, 4, 3], tier: 2 },
    { pattern: [1, 3, 2, 4], tier: 2 },
    { pattern: [1, 3, 4, 2], tier: 2 },
    { pattern: [1, 4, 2, 3], tier: 2 },
    { pattern: [1, 4, 3, 2], tier: 2 },
    { pattern: [2, 1, 3, 4], tier: 2 },
    { pattern: [2, 1, 4, 3], tier: 2 },
    { pattern: [2, 3, 1, 4], tier: 3 },
    { pattern: [2, 3, 4, 1], tier: 2 },
    { pattern: [2, 4, 1, 3], tier: 2 },
    { pattern: [2, 4, 3, 1], tier: 3 },
    { pattern: [3, 1, 2, 4], tier: 3 },
    { pattern: [3, 1, 4, 2], tier: 3 },
    { pattern: [3, 2, 1, 4], tier: 3 },
    { pattern: [3, 2, 4, 1], tier: 3 },
    { pattern: [3, 4, 1, 2], tier: 3 },
    { pattern: [3, 4, 2, 1], tier: 3 },
    { pattern: [4, 1, 2, 3], tier: 3 },
    { pattern: [4, 1, 3, 2], tier: 3 },
    { pattern: [4, 2, 1, 3], tier: 3 },
    { pattern: [4, 2, 3, 1], tier: 3 },
    { pattern: [4, 3, 1, 2], tier: 3 },
    { pattern: [4, 3, 2, 1], tier: 1 },
];

const PERMUTATION_MODE_KEYS: Record<PermutationMode, string> = {
    single: "technique.labels.permutationMode.single",
    daily: "technique.labels.permutationMode.daily",
    sequential: "technique.labels.permutationMode.sequential",
    random: "technique.labels.permutationMode.random",
};

const DIAGONAL_PATTERN_KEYS: Record<DiagonalPattern, string> = {
    ascending: "technique.labels.diagonalPattern.ascending",
    descending: "technique.labels.diagonalPattern.descending",
    full: "technique.labels.diagonalPattern.full",
};

const STRING_SKIP_PATTERNS: Record<StringSkipPattern, number[]> = {
    single: [6, 4, 5, 3, 4, 2, 3, 1],
    octave: [6, 4, 5, 3, 4, 2, 3, 1],
    double: [6, 3, 5, 2, 4, 1],
    wide: [6, 1, 5, 2, 4, 3],
};

const STRING_SKIP_PATTERN_KEYS: Record<StringSkipPattern, string> = {
    single: "technique.labels.stringSkipPattern.single",
    octave: "technique.labels.stringSkipPattern.octave",
    double: "technique.labels.stringSkipPattern.double",
    wide: "technique.labels.stringSkipPattern.wide",
};

const LEGATO_TRILL_PAIRS: Record<LegatoTrillPair, [number, number]> = {
    "1-2": [1, 2],
    "1-3": [1, 3],
    "1-4": [1, 4],
    "2-3": [2, 3],
    "2-4": [2, 4],
    "3-4": [3, 4],
};

const LEGATO_EXERCISE_KEYS: Record<LegatoExerciseType, string> = {
    trill: "technique.labels.legatoType.trill",
    hammerOnly: "technique.labels.legatoType.hammerOnly",
    pullOnly: "technique.labels.legatoType.pullOnly",
    threeNote: "technique.labels.legatoType.threeNote",
};

const LINEAR_DIRECTION_KEYS: Record<LinearDirection, string> = {
    ascending: "technique.labels.linearDirection.ascending",
    descending: "technique.labels.linearDirection.descending",
    roundTrip: "technique.labels.linearDirection.roundTrip",
};

function getPermutationIndicesByTier(tier: PermutationTierFilter): number[] {
    if (tier === "all") {
        return PERMUTATIONS.map((_, index) => index);
    }

    return PERMUTATIONS.reduce<number[]>((indices, permutation, index) => {
        if (permutation.tier === tier) {
            indices.push(index);
        }
        return indices;
    }, []);
}

function getDailyPermutationIndex(indices: number[], date: Date = new Date()): number {
    if (indices.length === 0) return 0;
    const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    return indices[seed % indices.length];
}

function getNextSequentialPermutationIndex(indices: number[], currentIndex: number): number {
    if (indices.length === 0) return 0;
    const currentPosition = indices.indexOf(currentIndex);
    const safePosition = currentPosition >= 0 ? currentPosition : 0;
    return indices[(safePosition + 1) % indices.length];
}

function getRandomPermutationIndex(indices: number[], currentIndex: number): number {
    if (indices.length <= 1) return indices[0] ?? 0;

    let candidate = currentIndex;
    while (candidate === currentIndex) {
        const randomPosition = Math.floor(Math.random() * indices.length);
        candidate = indices[randomPosition];
    }
    return candidate;
}

function clampBaseFret(raw: number, maxOffset: number, frets: number = TECHNIQUE_FRETS): number {
    const maxStart = Math.max(1, frets - maxOffset);
    return Math.max(1, Math.min(maxStart, Math.round(raw)));
}

function getBouncedValue(step: number, min: number, max: number): number {
    if (max <= min) return min;
    const range = max - min;
    const period = range * 2;
    const mod = step % period;
    return mod <= range ? min + mod : max - (mod - range);
}

function toStringIndex(stringNumber: number, stringCount: number): number {
    return Math.max(0, Math.min(stringCount - 1, Math.round(stringNumber) - 1));
}

function getPickGlyph(direction: PickDirection): string {
    return direction === "down" ? "v" : "^";
}

interface FingerPlacement {
    stringIndex: number;
    fret: number;
    finger: number;
}

interface StickyState {
    startFret: number;
    step: number;
    stringDirection: StringDirection;
    fretDirection: FretDirection;
    positions: Array<FingerPlacement | null>;
}

interface StickyAdvanceOptions {
    stringsToPlay?: number;
    directionMode?: PermutationDirection;
}

function clampStartFret(raw: number, frets: number = TECHNIQUE_FRETS): number {
    const maxStart = Math.max(1, frets - SPIDER_FINGERS + 1);
    return Math.max(1, Math.min(maxStart, Math.round(raw)));
}

function createStickyState(
    startFret: number,
    initialStringDirection: StringDirection = "up"
): StickyState {
    return {
        startFret: clampStartFret(startFret),
        step: 0,
        stringDirection: initialStringDirection,
        fretDirection: "right",
        positions: [null, null, null, null],
    };
}

function advanceStickyState(
    prev: StickyState,
    fingerPattern: number[],
    options: StickyAdvanceOptions = {},
    stringCount: number,
    frets: number = TECHNIQUE_FRETS
): { nextState: StickyState; currentString: number; activeFingerSlot: number } {
    const stringsToPlay = Math.max(
        1,
        Math.min(stringCount, Math.round(options.stringsToPlay ?? stringCount))
    );
    const lowestIncludedString = stringCount - stringsToPlay;
    const directionMode = options.directionMode ?? "both";
    const maxStart = Math.max(1, frets - SPIDER_FINGERS + 1);
    let working: StickyState = {
        ...prev,
        positions: [...prev.positions],
    };

    while (true) {
        const fingerToMove = working.step % SPIDER_FINGERS;
        const stringGroup = Math.floor(working.step / SPIDER_FINGERS);

        if (stringGroup >= stringsToPlay) {
            let nextStartFret = working.startFret;
            let nextFretDirection = working.fretDirection;

            if (working.fretDirection === "right") {
                nextStartFret += 1;
                if (nextStartFret > maxStart) {
                    nextStartFret = maxStart;
                    nextFretDirection = "left";
                }
            } else {
                nextStartFret -= 1;
                if (nextStartFret < 1) {
                    nextStartFret = 1;
                    nextFretDirection = "right";
                }
            }

            const nextStringDirection: StringDirection =
                directionMode === "ascending"
                    ? "up"
                    : directionMode === "descending"
                        ? "down"
                        : working.stringDirection === "down"
                            ? "up"
                            : "down";

            working = {
                startFret: nextStartFret,
                step: 0,
                stringDirection: nextStringDirection,
                fretDirection: nextFretDirection,
                positions: [null, null, null, null],
            };
            continue;
        }

        const currentString =
            working.stringDirection === "down"
                ? lowestIncludedString + stringGroup
                : stringCount - 1 - stringGroup;

        const fingerNumber = fingerPattern[fingerToMove];
        const currentFret = working.startFret + (fingerNumber - 1);
        const nextPositions = [...working.positions];
        nextPositions[fingerToMove] = {
            stringIndex: currentString,
            fret: currentFret,
            finger: fingerNumber,
        };

        return {
            nextState: {
                ...working,
                step: working.step + 1,
                positions: nextPositions,
            },
            currentString,
            activeFingerSlot: fingerToMove,
        };
    }
}

function stickyPositionsToNotes(
    positions: Array<FingerPlacement | null>,
    activeFingerSlot: number,
    holdFingersDown: boolean,
    tuning: NoteName[]
): NoteStatus[] {
    const notes: NoteStatus[] = [];

    for (let slot = 0; slot < positions.length; slot++) {
        if (!holdFingersDown && slot !== activeFingerSlot) continue;
        const pos = positions[slot];
        if (!pos) continue;

        const openNote = tuning[pos.stringIndex];
        notes.push({
            position: {
                stringIndex: pos.stringIndex,
                fret: pos.fret,
                note: getNoteAt(openNote, pos.fret),
            },
            status: slot === activeFingerSlot ? "active" : "correct",
            label: `${pos.finger}`,
            emphasis: slot === activeFingerSlot ? "strong" : "normal",
        });
    }

    return notes;
}

function buildStickyPreviewNotes(
    state: StickyState,
    fingerPattern: number[],
    options: StickyAdvanceOptions,
    stringCount: number,
    tuning: NoteName[],
    frets: number = TECHNIQUE_FRETS,
    previewDepth: number = 8
): NoteStatus[] {
    const previewState: StickyState = {
        ...state,
        positions: [...state.positions],
    };
    const previewByPosition = new Map<string, { placement: FingerPlacement; distance: number }>();

    for (let index = 0; index < previewDepth; index++) {
        const advanced = advanceStickyState(previewState, fingerPattern, options, stringCount, frets);
        previewState.startFret = advanced.nextState.startFret;
        previewState.step = advanced.nextState.step;
        previewState.stringDirection = advanced.nextState.stringDirection;
        previewState.fretDirection = advanced.nextState.fretDirection;
        previewState.positions = [...advanced.nextState.positions];

        const placement = advanced.nextState.positions[advanced.activeFingerSlot];
        if (!placement) continue;

        const distance = index + 1;
        const key = `${placement.stringIndex}-${placement.fret}`;
        const existing = previewByPosition.get(key);
        if (!existing || distance < existing.distance) {
            previewByPosition.set(key, { placement, distance });
        }
    }

    return Array.from(previewByPosition.values())
        .sort((left, right) => left.distance - right.distance)
        .map(({ placement, distance }) => ({
            position: {
                stringIndex: placement.stringIndex,
                fret: placement.fret,
                note: getNoteAt(tuning[placement.stringIndex], placement.fret),
            },
            status: "idle" as const,
            opacity: distance <= 2 ? 0.45 : distance <= 4 ? 0.28 : 0.12,
        }));
}

export default function Technique() {
    const { id } = useParams();
    const exerciseId = id && TECHNIQUE_EXERCISES[id] ? id : "spider";

    return <TechniqueSession key={exerciseId} exerciseId={exerciseId} />;
}

function TechniqueSession({ exerciseId }: { exerciseId: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const routeState = (location.state as { fromTrain?: boolean; entrySource?: string } | null) ?? null;
    const entrySource = routeState?.entrySource ?? (routeState?.fromTrain ? "train" : "direct");
    const exercise = TECHNIQUE_EXERCISES[exerciseId];
    const techniqueSettings = useSettingsStore((state) => state.modules.technique);
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);
    const leftHanded = useSettingsStore((state) => state.full.instrument.leftHanded);
    const masterVolume = useSettingsStore((state) => state.full.audio.volume);
    const updateModuleSettings = useSettingsStore((state) => state.updateModuleSettings);
    const initialBpm = techniqueSettings.startingBpm?.[exerciseId] ?? exercise.defaultBpm;
    const stringCount = tuning.length;
    const stringLabels = useMemo(() => getStringLabels(tuning), [tuning]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(initialBpm);
    const [currentStep, setCurrentStep] = useState(0);
    const [currentString, setCurrentString] = useState(() => Math.max(0, stringCount - 1)); // Start on lowest string
    const [startFret, setStartFret] = useState(5);
    const [stepMode, setStepMode] = useState(false);
    const [activeNotes, setActiveNotes] = useState<NoteStatus[]>([]);
    const [permutationIndex, setPermutationIndex] = useState(0);
    const [permutationMode, setPermutationMode] = useState<PermutationMode>("single");
    const [permutationTier, setPermutationTier] = useState<PermutationTierFilter>("all");
    const [permutationStringsToPlay, setPermutationStringsToPlay] = useState(() => Math.max(1, stringCount));
    const [permutationDirection, setPermutationDirection] = useState<PermutationDirection>("both");
    const holdFingersDown = true;
    const [randomSwitchBars, setRandomSwitchBars] = useState(2);
    const [diagonalPattern, setDiagonalPattern] = useState<DiagonalPattern>("ascending");
    const [diagonalStringsPerGroup, setDiagonalStringsPerGroup] = useState(4);
    const [diagonalPickingStyle, setDiagonalPickingStyle] = useState<DiagonalPickingStyle>("alternate");
    const [diagonalShowPickDirection, setDiagonalShowPickDirection] = useState(true);
    const [stringSkipPattern, setStringSkipPattern] = useState<StringSkipPattern>("single");
    const [stringSkipPickingFocus, setStringSkipPickingFocus] = useState<StringSkipPickingFocus>("alternate");
    const [stringSkipStartPickDirection, setStringSkipStartPickDirection] = useState<PickDirection>("down");
    const [stringSkipShowPickIndicators, setStringSkipShowPickIndicators] = useState(true);
    const [legatoExerciseType, setLegatoExerciseType] = useState<LegatoExerciseType>("trill");
    const [legatoTrillPair, setLegatoTrillPair] = useState<LegatoTrillPair>("1-2");
    const [linearString, setLinearString] = useState(() => Math.max(1, stringCount));
    const [linearEndFret, setLinearEndFret] = useState(12);
    const [linearNotesPerShift, setLinearNotesPerShift] = useState(4);
    const [linearDirection, setLinearDirection] = useState<LinearDirection>("ascending");
    const [linearShiftAmount, setLinearShiftAmount] = useState(1);
    const [linearPickingStyle, setLinearPickingStyle] = useState<LinearPickingStyle>("alternate");
    const [techniqueCue, setTechniqueCue] = useState<TechniqueActionCue | null>(null);
    const [activePatternLabel, setActivePatternLabel] = useState("1-2-3-4");
    const [currentBpm, setCurrentBpm] = useState(initialBpm);
    const [speedUpEnabled, setSpeedUpEnabled] = useState(false);
    const [speedUpAmount, setSpeedUpAmount] = useState(5);
    const [speedUpInterval, setSpeedUpInterval] = useState(8);
    const [speedUpBeatCounter, setSpeedUpBeatCounter] = useState(0);
    const [showSetupDialog, setShowSetupDialog] = useState(false);

    const metronomeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const metronomeAudioContextRef = useRef<AudioContext | null>(null);
    const metronomeBeatRef = useRef(0);
    const currentBpmRef = useRef(initialBpm);
    const speedUpBeatCounterRef = useRef(0);
    const randomModeBeatCounterRef = useRef(0);
    const stickyStateRef = useRef<StickyState>(createStickyState(startFret));
    const sessionStartedAtRef = useRef<number | null>(null);
    const previousSetupDialogOpenRef = useRef<boolean | null>(null);

    const availablePermutationIndices = useMemo(
        () => getPermutationIndicesByTier(permutationTier),
        [permutationTier]
    );
    const dailyPermutationIndex = useMemo(
        () => getDailyPermutationIndex(availablePermutationIndices),
        [availablePermutationIndices]
    );
    const resolvedPermutationIndex = useMemo(() => {
        if (availablePermutationIndices.length === 0) return 0;
        if (permutationMode === "daily") return dailyPermutationIndex;
        if (availablePermutationIndices.includes(permutationIndex)) return permutationIndex;
        return availablePermutationIndices[0];
    }, [availablePermutationIndices, permutationMode, dailyPermutationIndex, permutationIndex]);
    const activePermutationPattern = PERMUTATIONS[resolvedPermutationIndex]?.pattern ?? PERMUTATIONS[0].pattern;
    const activePermutationTier = PERMUTATIONS[resolvedPermutationIndex]?.tier ?? 1;
    const isPermutationExercise = exerciseId === "permutation";
    const hasExerciseSpecificSetup =
        isPermutationExercise ||
        exerciseId === "diagonal" ||
        exerciseId === "stringskip" ||
        exerciseId === "legato" ||
        exerciseId === "linear";
    const stringSkipSequence = STRING_SKIP_PATTERNS[stringSkipPattern];
    const activeTrillPair = LEGATO_TRILL_PAIRS[legatoTrillPair];
    const getPermutationModeLabel = useCallback(
        (mode: PermutationMode) => t(PERMUTATION_MODE_KEYS[mode]),
        [t]
    );
    const getDiagonalPatternLabel = useCallback(
        (pattern: DiagonalPattern) => t(DIAGONAL_PATTERN_KEYS[pattern]),
        [t]
    );
    const getStringSkipPatternLabel = useCallback(
        (pattern: StringSkipPattern) => t(STRING_SKIP_PATTERN_KEYS[pattern]),
        [t]
    );
    const getLegatoExerciseLabel = useCallback(
        (type: LegatoExerciseType) => t(LEGATO_EXERCISE_KEYS[type]),
        [t]
    );
    const getLinearDirectionLabel = useCallback(
        (direction: LinearDirection) => t(LINEAR_DIRECTION_KEYS[direction]),
        [t]
    );
    const getPermutationDirectionLabel = useCallback(
        (direction: PermutationDirection) => t(`technique.settings.directionOptions.${direction}`),
        [t]
    );

    useEffect(() => {
        trackFeatureOpened("technique", exerciseId, entrySource);
    }, [entrySource, exerciseId]);

    useEffect(() => {
        const previousOpen = previousSetupDialogOpenRef.current;
        if (showSetupDialog && previousOpen !== true) {
            trackEvent("fm_v2_preflight_opened", {
                module: "technique",
                mode: exerciseId,
                entry_source: entrySource,
            });
        }
        previousSetupDialogOpenRef.current = showSetupDialog;
    }, [entrySource, exerciseId, showSetupDialog]);

    const defaultPatternLabel = useMemo(() => {
        if (exerciseId === "permutation") return activePermutationPattern.join("-");
        if (exerciseId === "diagonal") return t("technique.patternLabel.diagonal", { label: getDiagonalPatternLabel(diagonalPattern), strings: diagonalStringsPerGroup });
        if (exerciseId === "stringskip") return getStringSkipPatternLabel(stringSkipPattern);
        if (exerciseId === "legato") {
            return legatoExerciseType === "trill"
                ? `${getLegatoExerciseLabel(legatoExerciseType)} ${legatoTrillPair}`
                : getLegatoExerciseLabel(legatoExerciseType);
        }
        if (exerciseId === "linear") return t("technique.patternLabel.linear", { string: linearString, direction: getLinearDirectionLabel(linearDirection) });
        return "1-2-3-4";
    }, [
        exerciseId,
        activePermutationPattern,
        diagonalPattern,
        diagonalStringsPerGroup,
        stringSkipPattern,
        legatoExerciseType,
        legatoTrillPair,
        linearString,
        linearDirection,
        t,
        getDiagonalPatternLabel,
        getStringSkipPatternLabel,
        getLegatoExerciseLabel,
        getLinearDirectionLabel,
    ]);
    const displayedPatternLabel = isPlaying ? activePatternLabel : defaultPatternLabel;
    const permutationModeOptions = useMemo(
        () =>
            Object.keys(PERMUTATION_MODE_KEYS).map((value) => ({
                value,
                label: getPermutationModeLabel(value as PermutationMode),
            })),
        [getPermutationModeLabel]
    );
    const permutationPatternOptions = useMemo(
        () =>
            availablePermutationIndices.map((index) => {
                const pattern = PERMUTATIONS[index];
                return {
                    value: index,
                    label: `#${index + 1} - ${pattern.pattern.join("-")} (T${pattern.tier})`,
                };
            }),
        [availablePermutationIndices]
    );
    const stringSkipPatternOptions = useMemo(
        () =>
            Object.keys(STRING_SKIP_PATTERN_KEYS).map((value) => ({
                value,
                label: getStringSkipPatternLabel(value as StringSkipPattern),
            })),
        [getStringSkipPatternLabel]
    );
    const legatoTrillPairOptions = useMemo(
        () => Object.keys(LEGATO_TRILL_PAIRS),
        []
    );

    const getAlternatingPickDirection = useCallback(
        (step: number, startDirection: PickDirection): PickDirection =>
            ((step % 2 === 0) === (startDirection === "down")) ? "down" : "up",
        []
    );

    const getInitialStringDirection = useCallback((): StringDirection => {
        if (exerciseId !== "permutation") return "up";
        return permutationDirection === "descending" ? "down" : "up";
    }, [exerciseId, permutationDirection]);

    const resetTechniqueRunState = useCallback((nextStartFret?: number, nextBpm?: number) => {
        const resetFret = nextStartFret ?? startFret;
        const resetBpm = nextBpm ?? bpm;

        stickyStateRef.current = createStickyState(resetFret, getInitialStringDirection());
        setCurrentStep(0);
        setCurrentString(exerciseId === "linear" ? toStringIndex(linearString, stringCount) : stringCount - 1);
        setActiveNotes([]);
        setTechniqueCue(null);
        setActivePatternLabel("1-2-3-4");
        currentBpmRef.current = resetBpm;
        setCurrentBpm(resetBpm);
        speedUpBeatCounterRef.current = 0;
        setSpeedUpBeatCounter(0);
        randomModeBeatCounterRef.current = 0;
        metronomeBeatRef.current = 0;
    }, [startFret, bpm, getInitialStringDirection, exerciseId, linearString, stringCount]);

    const playMetronomeTick = useCallback(() => {
        if (typeof window === "undefined") return;

        const AudioContextCtor =
            window.AudioContext ||
            (window as unknown as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;

        let audioContext = metronomeAudioContextRef.current;
        if (!audioContext || audioContext.state === "closed") {
            audioContext = new AudioContextCtor();
            metronomeAudioContextRef.current = audioContext;
        }

        if (audioContext.state === "suspended") {
            void audioContext.resume();
        }

        const beat = metronomeBeatRef.current;
        const isDownbeat = beat % 4 === 0;
        const volumeScale = Math.max(0, Math.min(1, masterVolume));

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(isDownbeat ? 1040 : 760, audioContext.currentTime);

        const baseGain = isDownbeat ? 0.14 : 0.08;
        const finalGain = Math.max(0.005, baseGain * Math.max(0.2, volumeScale));
        gainNode.gain.setValueAtTime(finalGain, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.05);

        metronomeBeatRef.current = beat + 1;
    }, [masterVolume]);

    const persistStartingBpm = useCallback((nextBpm: number) => {
        const latestStartingBpm = useSettingsStore.getState().modules.technique.startingBpm ?? {};
        updateModuleSettings("technique", {
            startingBpm: {
                ...latestStartingBpm,
                [exerciseId]: nextBpm,
            },
        });
    }, [exerciseId, updateModuleSettings]);

    const persistTechniqueSession = useCallback((sessionPeakBpm: number) => {
        const latestTechniqueSettings = useSettingsStore.getState().modules.technique;
        const latestBestBpm = latestTechniqueSettings.bestBpm ?? {};
        const latestSessions = latestTechniqueSettings.sessionsCompleted ?? {};
        const latestLastPracticed = latestTechniqueSettings.lastPracticedAt ?? {};
        const currentBest = latestBestBpm[exerciseId] ?? 0;
        const currentSessions = latestSessions[exerciseId] ?? 0;

        updateModuleSettings("technique", {
            bestBpm: {
                ...latestBestBpm,
                [exerciseId]: Math.max(currentBest, Math.round(sessionPeakBpm)),
            },
            sessionsCompleted: {
                ...latestSessions,
                [exerciseId]: currentSessions + 1,
            },
            lastPracticedAt: {
                ...latestLastPracticed,
                [exerciseId]: new Date().toISOString(),
            },
        });
    }, [exerciseId, updateModuleSettings]);

    const tick = useCallback(() => {
        const makeNote = (
            rawStringIndex: number,
            rawFret: number,
            status: NoteStatus["status"],
            label: string
        ): NoteStatus => {
            const stringIndex = Math.max(0, Math.min(stringCount - 1, rawStringIndex));
            const fret = Math.max(1, Math.min(TECHNIQUE_FRETS, Math.round(rawFret)));
            const openNote = tuning[stringIndex];
            return {
                position: {
                    stringIndex,
                    fret,
                    note: getNoteAt(openNote, fret),
                },
                status,
                label,
            };
        };

        if (exerciseId === "spider" || exerciseId === "permutation") {
            if (exerciseId === "permutation") {
                const permutationPool = availablePermutationIndices.length > 0 ? availablePermutationIndices : [0];
                const cycleLength = permutationStringsToPlay * SPIDER_FINGERS;
                const atCycleBoundary = stickyStateRef.current.step >= cycleLength;

                let activePermutationIndex = resolvedPermutationIndex;

                if (atCycleBoundary) {
                    if (permutationMode === "sequential") {
                        const nextIndex = getNextSequentialPermutationIndex(
                            permutationPool,
                            activePermutationIndex
                        );
                        activePermutationIndex = nextIndex;
                        if (nextIndex !== permutationIndex) {
                            setPermutationIndex(nextIndex);
                        }
                    } else if (permutationMode === "random") {
                        const beatsPerSwitch = Math.max(1, randomSwitchBars) * BEATS_PER_BAR;
                        if (randomModeBeatCounterRef.current >= beatsPerSwitch) {
                            randomModeBeatCounterRef.current = 0;
                            const nextIndex = getRandomPermutationIndex(
                                permutationPool,
                                activePermutationIndex
                            );
                            activePermutationIndex = nextIndex;
                            if (nextIndex !== permutationIndex) {
                                setPermutationIndex(nextIndex);
                            }
                        }
                    }
                }

                const selectedPattern = PERMUTATIONS[activePermutationIndex]?.pattern ?? PERMUTATIONS[0].pattern;
                const advanced = advanceStickyState(
                    stickyStateRef.current,
                    selectedPattern,
                    {
                        stringsToPlay: permutationStringsToPlay,
                        directionMode: permutationDirection,
                    },
                    stringCount,
                    TECHNIQUE_FRETS
                );

                stickyStateRef.current = advanced.nextState;
                setCurrentString(advanced.currentString);
                setActiveNotes(
                    stickyPositionsToNotes(
                        advanced.nextState.positions,
                        advanced.activeFingerSlot,
                        holdFingersDown,
                        tuning
                    )
                );

                if (permutationMode === "random") {
                    randomModeBeatCounterRef.current += 1;
                }

                setTechniqueCue(null);
                setActivePatternLabel(selectedPattern.join("-"));
                setCurrentStep((prev) => prev + 1);
                return;
            }

            const advanced = advanceStickyState(stickyStateRef.current, [1, 2, 3, 4], {}, stringCount, TECHNIQUE_FRETS);
            stickyStateRef.current = advanced.nextState;
            setCurrentString(advanced.currentString);
            const heldNotes = stickyPositionsToNotes(advanced.nextState.positions, advanced.activeFingerSlot, true, tuning);
            const previewNotes = buildStickyPreviewNotes(
                advanced.nextState,
                [1, 2, 3, 4],
                {},
                stringCount,
                tuning,
                TECHNIQUE_FRETS,
                8
            );
            setActiveNotes([...heldNotes, ...previewNotes]);
            setTechniqueCue(null);
            setActivePatternLabel("1-2-3-4");

            setCurrentStep((prev) => prev + 1);
            return;
        }

        const step = currentStep;

        if (exerciseId === "diagonal") {
            const groupSize = Math.max(2, Math.min(stringCount, diagonalStringsPerGroup));
            const startPositions = Math.max(1, stringCount - groupSize + 1);
            const groupIndex = Math.floor(step / groupSize);
            const stepInGroup = step % groupSize;
            const shiftedRound = Math.floor(groupIndex / startPositions);
            const groupStartOffset = groupIndex % startPositions;
            const mode = diagonalPattern === "full"
                ? (groupIndex % 2 === 0 ? "ascending" : "descending")
                : diagonalPattern;
            const maxOffset = groupSize - 1;
            const baseMin = clampBaseFret(startFret, maxOffset);
            const baseMax = Math.max(baseMin, TECHNIQUE_FRETS - maxOffset);
            const baseFret = getBouncedValue(shiftedRound, baseMin, baseMax);
            const lowestStringIndex = stringCount - 1 - groupStartOffset;
            const ascendingMode = mode === "ascending";
            const stringIndex = ascendingMode
                ? lowestStringIndex - stepInGroup
                : lowestStringIndex - (groupSize - 1 - stepInGroup);
            const fret = ascendingMode
                ? baseFret + stepInGroup
                : baseFret + (groupSize - 1 - stepInGroup);
            const finger = ascendingMode ? stepInGroup + 1 : groupSize - stepInGroup;
            const notes = [makeNote(stringIndex, fret, "active", `${Math.max(1, Math.min(4, finger))}`)];

            let cue: TechniqueActionCue | null = null;
            if (diagonalShowPickDirection) {
                const pickDirection: PickDirection = diagonalPickingStyle === "alternate"
                    ? getAlternatingPickDirection(step, "down")
                    : (ascendingMode ? "down" : "up");
                cue = {
                    label: diagonalPickingStyle === "economy" ? t("technique.cue.economyPicking") : t("technique.cue.alternatePicking"),
                    notation: getPickGlyph(pickDirection),
                    detail: pickDirection === "down" ? t("technique.cue.downstroke") : t("technique.cue.upstroke"),
                };
            }

            setCurrentString(stringIndex);
            setActiveNotes(notes);
            setTechniqueCue(cue);
            setActivePatternLabel(t("technique.patternLabel.diagonal", { label: getDiagonalPatternLabel(diagonalPattern), strings: groupSize }));
            setCurrentStep((prev) => prev + 1);
            return;
        }

        if (exerciseId === "stringskip") {
            const fingerPattern = [1, 2, 3, 4];
            const patternLength = stringSkipSequence.length;
            const stepInPattern = step % patternLength;
            const patternCycle = Math.floor(step / patternLength);
            const stringNumber = stringSkipSequence[stepInPattern];
            const stringIndex = toStringIndex(stringNumber, stringCount);
            const finger = fingerPattern[step % fingerPattern.length];
            const baseMin = clampBaseFret(startFret, SPIDER_FINGERS - 1);
            const baseMax = Math.max(baseMin, TECHNIQUE_FRETS - (SPIDER_FINGERS - 1));
            const baseFret = getBouncedValue(patternCycle, baseMin, baseMax);
            const fret = baseFret + finger - 1;

            const resolvePickDirection = (absoluteStep: number): PickDirection => {
                const normalizedStep = Math.max(0, absoluteStep);
                const sequenceIndex = normalizedStep % patternLength;
                const currentStringNumber = stringSkipSequence[sequenceIndex];
                let direction = getAlternatingPickDirection(normalizedStep, stringSkipStartPickDirection);
                if (stringSkipPickingFocus !== "alternate" && normalizedStep > 0) {
                    const previousStringNumber = stringSkipSequence[(sequenceIndex - 1 + patternLength) % patternLength];
                    const movingToThinner = currentStringNumber < previousStringNumber;
                    direction = stringSkipPickingFocus === "inside"
                        ? (movingToThinner ? "down" : "up")
                        : (movingToThinner ? "up" : "down");
                }
                return direction;
            };

            const pickDirection = resolvePickDirection(step);

            const activeLabel = stringSkipShowPickIndicators
                ? `${finger}${getPickGlyph(pickDirection)}`
                : `${finger}`;
            const notes: NoteStatus[] = [makeNote(stringIndex, fret, "active", activeLabel)];

            if (step > 0) {
                const previousStringNumber = stringSkipSequence[(stepInPattern - 1 + patternLength) % patternLength];
                const previousStringIndex = toStringIndex(previousStringNumber, stringCount);
                const previousFinger = fingerPattern[(step - 1) % fingerPattern.length];
                const previousFret = baseFret + previousFinger - 1;
                const previousPickDirection = resolvePickDirection(step - 1);
                const previousLabel = stringSkipShowPickIndicators
                    ? `${previousFinger}${getPickGlyph(previousPickDirection)}`
                    : `${previousFinger}`;
                notes.unshift(makeNote(previousStringIndex, previousFret, "correct", previousLabel));
            }

            const cue: TechniqueActionCue = {
                label:
                    stringSkipPickingFocus === "alternate"
                        ? t("technique.cue.alternatePicking")
                        : stringSkipPickingFocus === "inside"
                            ? t("technique.cue.insidePicking")
                            : t("technique.cue.outsidePicking"),
                notation: getPickGlyph(pickDirection),
                detail: pickDirection === "down" ? t("technique.cue.downstroke") : t("technique.cue.upstroke"),
            };

            setCurrentString(stringIndex);
            setActiveNotes(notes);
            setTechniqueCue(cue);
            setActivePatternLabel(getStringSkipPatternLabel(stringSkipPattern));
            setCurrentStep((prev) => prev + 1);
            return;
        }

        if (exerciseId === "legato") {
            const safeStartFret = clampBaseFret(startFret, 4);
            const fingerPatternAscending = [1, 2, 3, 4];
            const fingerPatternDescending = [4, 3, 2, 1];
            const notes: NoteStatus[] = [];
            let cue: TechniqueActionCue | null = null;
            let stringIndex = 5;

            if (legatoExerciseType === "trill") {
                const [lowFinger, highFinger] = activeTrillPair;
                const maxOffset = highFinger - 1;
                const stringRotation = Math.floor(step / 16) % stringCount;
                const cycleRound = Math.floor(step / (16 * stringCount));
                const baseMin = clampBaseFret(safeStartFret, maxOffset);
                const baseMax = Math.max(baseMin, TECHNIQUE_FRETS - maxOffset);
                const baseFret = getBouncedValue(cycleRound, baseMin, baseMax);
                const lowFret = baseFret + lowFinger - 1;
                const highFret = baseFret + highFinger - 1;
                const onUpperNote = step % 2 === 1;
                stringIndex = stringCount - 1 - stringRotation;

                const lowLabel = !onUpperNote && step > 0 ? `${lowFinger}p` : `${lowFinger}`;
                const highLabel = onUpperNote && step > 0 ? `${highFinger}h` : `${highFinger}`;
                notes.push(makeNote(stringIndex, lowFret, onUpperNote ? "correct" : "active", lowLabel));
                notes.push(makeNote(stringIndex, highFret, onUpperNote ? "active" : "correct", highLabel));

                if (step === 0) {
                    cue = { label: t("technique.cue.pick"), notation: `${lowFret}`, detail: t("technique.cueDetail.initialPickedNote") };
                } else if (onUpperNote) {
                    cue = { label: t("technique.cue.hammerOn"), notation: `${lowFret}h${highFret}`, detail: t("technique.cueDetail.legatoAscent") };
                } else {
                    cue = { label: t("technique.cue.pullOff"), notation: `${highFret}p${lowFret}`, detail: t("technique.cueDetail.legatoDescent") };
                }
            } else if (legatoExerciseType === "hammerOnly") {
                const notesPerString = 4;
                const stepInString = step % notesPerString;
                const stringRotation = Math.floor(step / notesPerString) % stringCount;
                const cycleRound = Math.floor(step / (notesPerString * stringCount));
                const baseMin = clampBaseFret(safeStartFret, 3);
                const baseMax = Math.max(baseMin, TECHNIQUE_FRETS - 3);
                const baseFret = getBouncedValue(cycleRound, baseMin, baseMax);
                stringIndex = stringCount - 1 - stringRotation;

                for (let i = 0; i <= stepInString; i++) {
                    const finger = fingerPatternAscending[i];
                    const fret = baseFret + finger - 1;
                    const isActive = i === stepInString;
                    const activeLabel = stepInString > 0 ? `${finger}h` : `${finger}`;
                    notes.push(makeNote(stringIndex, fret, isActive ? "active" : "correct", isActive ? activeLabel : `${finger}`));
                }

                if (stepInString === 0) {
                    cue = { label: t("technique.cue.pick"), notation: `${baseFret}`, detail: t("technique.cueDetail.firstNotePerString") };
                } else {
                    const fromFret = baseFret + fingerPatternAscending[stepInString - 1] - 1;
                    const toFret = baseFret + fingerPatternAscending[stepInString] - 1;
                    cue = { label: t("technique.cue.hammerOn"), notation: `${fromFret}h${toFret}`, detail: t("technique.cueDetail.noAdditionalPick") };
                }
            } else if (legatoExerciseType === "pullOnly") {
                const notesPerString = 4;
                const stepInString = step % notesPerString;
                const stringRotation = Math.floor(step / notesPerString) % stringCount;
                const cycleRound = Math.floor(step / (notesPerString * stringCount));
                const baseMin = clampBaseFret(safeStartFret, 3);
                const baseMax = Math.max(baseMin, TECHNIQUE_FRETS - 3);
                const baseFret = getBouncedValue(cycleRound, baseMin, baseMax);
                stringIndex = stringCount - 1 - stringRotation;
                const anchorFinger = 1;
                const activeFinger = fingerPatternDescending[stepInString];
                const anchorFret = baseFret + anchorFinger - 1;
                if (activeFinger !== anchorFinger) {
                    notes.push(makeNote(stringIndex, anchorFret, "correct", `${anchorFinger}`));
                }

                const activeFret = baseFret + activeFinger - 1;
                notes.push(
                    makeNote(
                        stringIndex,
                        activeFret,
                        "active",
                        stepInString === 0 || activeFinger === anchorFinger
                            ? `${activeFinger}`
                            : `${activeFinger}p`
                    )
                );

                if (stepInString === 0) {
                    const pickedFret = baseFret + fingerPatternDescending[0] - 1;
                    cue = { label: t("technique.cue.pick"), notation: `${pickedFret}`, detail: t("technique.cueDetail.pickHighNoteAnchorIndex") };
                } else {
                    const fromFret = baseFret + fingerPatternDescending[stepInString - 1] - 1;
                    const toFret = baseFret + fingerPatternDescending[stepInString] - 1;
                    cue = { label: t("technique.cue.pullOff"), notation: `${fromFret}p${toFret}`, detail: t("technique.cueDetail.keepIndexAnchored") };
                }
            } else {
                const notesPerString = 3;
                const fingerPattern = [1, 3, 4];
                const offsets = [0, 2, 4];
                const stepInString = step % notesPerString;
                const stringRotation = Math.floor(step / notesPerString) % stringCount;
                const cycleRound = Math.floor(step / (notesPerString * stringCount));
                const baseMin = clampBaseFret(safeStartFret, 4);
                const baseMax = Math.max(baseMin, TECHNIQUE_FRETS - 4);
                const baseFret = getBouncedValue(cycleRound, baseMin, baseMax);
                stringIndex = stringCount - 1 - stringRotation;

                for (let i = 0; i <= stepInString; i++) {
                    const fret = baseFret + offsets[i];
                    const isActive = i === stepInString;
                    const activeLabel = stepInString > 0 ? `${fingerPattern[i]}h` : `${fingerPattern[i]}`;
                    notes.push(
                        makeNote(
                            stringIndex,
                            fret,
                            isActive ? "active" : "correct",
                            isActive ? activeLabel : `${fingerPattern[i]}`
                        )
                    );
                }

                if (stepInString === 0) {
                    cue = { label: t("technique.cue.pick"), notation: `${baseFret}`, detail: t("technique.cueDetail.startEachStringWithPick") };
                } else {
                    const fromFret = baseFret + offsets[stepInString - 1];
                    const toFret = baseFret + offsets[stepInString];
                    cue = { label: t("technique.cue.hammerOn"), notation: `${fromFret}h${toFret}`, detail: t("technique.cueDetail.twoLegatoNotesPerString") };
                }
            }

            setCurrentString(stringIndex);
            setActiveNotes(notes);
            setTechniqueCue(cue);
            setActivePatternLabel(
                legatoExerciseType === "trill"
                    ? `${getLegatoExerciseLabel(legatoExerciseType)} ${legatoTrillPair}`
                    : getLegatoExerciseLabel(legatoExerciseType)
            );
            setCurrentStep((prev) => prev + 1);
            return;
        }

        if (exerciseId === "linear") {
            const notesPerShift = Math.max(4, Math.min(6, linearNotesPerShift));
            const maxOffset = notesPerShift - 1;
            const baseMin = clampBaseFret(startFret, maxOffset);
            const safeEndFret = Math.max(
                baseMin + maxOffset,
                Math.min(TECHNIQUE_FRETS, Math.round(linearEndFret))
            );
            const baseMax = Math.max(baseMin, safeEndFret - maxOffset);
            const groupIndex = Math.floor(step / notesPerShift);
            const stepInGroup = step % notesPerShift;
            const shiftAmount = Math.max(1, linearShiftAmount);
            let baseFret = baseMin;

            if (linearDirection === "ascending") {
                baseFret = Math.min(baseMin + groupIndex * shiftAmount, baseMax);
            } else if (linearDirection === "descending") {
                baseFret = Math.max(baseMax - groupIndex * shiftAmount, baseMin);
            } else {
                const travelSteps = Math.floor((baseMax - baseMin) / shiftAmount);
                if (travelSteps > 0) {
                    const period = travelSteps * 2;
                    const position = groupIndex % period;
                    const mirrored = position <= travelSteps ? position : period - position;
                    baseFret = baseMin + mirrored * shiftAmount;
                }
            }

            const stringIndex = toStringIndex(linearString, stringCount);
            const fret = baseFret + stepInGroup;
            const finger = (stepInGroup % 4) + 1;
            const notes: NoteStatus[] = [];
            let cue: TechniqueActionCue | null = null;

            if (linearPickingStyle === "legato") {
                for (let i = 0; i <= stepInGroup; i++) {
                    notes.push(makeNote(stringIndex, baseFret + i, i === stepInGroup ? "active" : "correct", `${(i % 4) + 1}`));
                }

                if (stepInGroup === 0) {
                    cue = { label: t("technique.cue.pick"), notation: `${baseFret}`, detail: t("technique.cueDetail.initialAttack") };
                } else {
                    cue = {
                        label: t("technique.cue.hammerOn"),
                        notation: `${baseFret + stepInGroup - 1}h${baseFret + stepInGroup}`,
                        detail: t("technique.cueDetail.legatoWithinShiftGroup"),
                    };
                }
            } else {
                notes.push(makeNote(stringIndex, fret, "active", `${finger}`));
                const pickDirection = getAlternatingPickDirection(step, "down");
                cue = {
                    label: t("technique.cue.alternatePicking"),
                    notation: getPickGlyph(pickDirection),
                    detail: pickDirection === "down" ? t("technique.cue.downstroke") : t("technique.cue.upstroke"),
                };
            }

            setCurrentString(stringIndex);
            setActiveNotes(notes);
            setTechniqueCue(cue);
            setActivePatternLabel(t("technique.patternLabel.linear", { string: linearString, direction: getLinearDirectionLabel(linearDirection) }));
            setCurrentStep((prev) => prev + 1);
            return;
        }

        setTechniqueCue(null);
        setActivePatternLabel("1-2-3-4");
        setCurrentStep((prev) => prev + 1);
    }, [
        currentStep,
        exerciseId,
        permutationIndex,
        permutationMode,
        permutationDirection,
        permutationStringsToPlay,
        holdFingersDown,
        randomSwitchBars,
        resolvedPermutationIndex,
        availablePermutationIndices,
        getAlternatingPickDirection,
        startFret,
        diagonalPattern,
        diagonalStringsPerGroup,
        diagonalPickingStyle,
        diagonalShowPickDirection,
        stringSkipSequence,
        stringSkipPattern,
        stringSkipPickingFocus,
        stringSkipStartPickDirection,
        stringSkipShowPickIndicators,
        legatoExerciseType,
        legatoTrillPair,
        activeTrillPair,
        linearString,
        linearEndFret,
        linearNotesPerShift,
        linearDirection,
        linearShiftAmount,
        linearPickingStyle,
        stringCount,
        tuning,
        t,
        getDiagonalPatternLabel,
        getStringSkipPatternLabel,
        getLegatoExerciseLabel,
        getLinearDirectionLabel,
    ]);

    const runTechniqueBeat = useCallback(() => {
        playMetronomeTick();
        tick();

        let nextCounter = speedUpBeatCounterRef.current + 1;
        let nextBpm = currentBpmRef.current;

        if (speedUpEnabled && nextCounter >= speedUpInterval) {
            nextCounter = 0;
            nextBpm = Math.min(280, currentBpmRef.current + speedUpAmount);
        }

        speedUpBeatCounterRef.current = nextCounter;
        setSpeedUpBeatCounter(nextCounter);

        currentBpmRef.current = nextBpm;
        setCurrentBpm(nextBpm);
    }, [playMetronomeTick, tick, speedUpEnabled, speedUpInterval, speedUpAmount]);

    useEffect(() => {
        if (!isPlaying || stepMode) return;

        const scheduleNext = () => {
            metronomeTimeoutRef.current = setTimeout(() => {
                runTechniqueBeat();
                scheduleNext();
            }, 60000 / currentBpmRef.current);
        };

        scheduleNext();

        return () => {
            if (metronomeTimeoutRef.current) {
                clearTimeout(metronomeTimeoutRef.current);
                metronomeTimeoutRef.current = null;
            }
        };
    }, [isPlaying, stepMode, runTechniqueBeat]);

    const handleNextStep = () => {
        if (stepMode) {
            playMetronomeTick();
            tick();
        }
    };

    useEffect(() => {
        return () => {
            const context = metronomeAudioContextRef.current;
            if (context && context.state !== "closed") {
                void context.close();
            }
            metronomeAudioContextRef.current = null;
        };
    }, []);

    const startTechniqueSession = () => {
        sessionStartedAtRef.current = Date.now();
        trackEvent("fm_v2_technique_session_started", {
            exercise_id: exerciseId,
            entry_source: entrySource,
            start_bpm: bpm,
            step_mode: stepMode,
            start_fret: startFret,
            string_count: stringCount,
            speed_up_enabled: speedUpEnabled,
            speed_up_amount: speedUpAmount,
            speed_up_interval_beats: speedUpInterval,
        });

        resetTechniqueRunState();
        setIsPlaying(true);
        runTechniqueBeat();
    };

    const stopTechniqueSession = () => {
        const durationSeconds = sessionStartedAtRef.current
            ? Math.floor((Date.now() - sessionStartedAtRef.current) / 1000)
            : 0;
        const completedSteps = currentStep;

        trackEvent("fm_v2_technique_session_ended", {
            exercise_id: exerciseId,
            entry_source: entrySource,
            duration_seconds: durationSeconds,
            completed_steps: completedSteps,
            final_bpm: Math.round(currentBpmRef.current),
            start_bpm: bpm,
            step_mode: stepMode,
            speed_up_enabled: speedUpEnabled,
        });
        sessionStartedAtRef.current = null;

        if (currentStep > 0) {
            persistTechniqueSession(currentBpmRef.current);
        }
        setIsPlaying(false);
        resetTechniqueRunState();
    };

    const handlePlayButton = () => {
        if (isPlaying) {
            stopTechniqueSession();
            return;
        }
        setShowSetupDialog(true);
    };

    const handleStartFromSetup = () => {
        trackEvent("fm_v2_preflight_started", {
            module: "technique",
            mode: exerciseId,
            entry_source: entrySource,
            start_bpm: bpm,
            step_mode: stepMode,
            start_fret: startFret,
            speed_up_enabled: speedUpEnabled,
        });
        setShowSetupDialog(false);
        startTechniqueSession();
    };

    const handleSetupDialogOpenChange = (open: boolean) => {
        if (!open && showSetupDialog) {
            trackEvent("fm_v2_preflight_cancelled", {
                module: "technique",
                mode: exerciseId,
                entry_source: entrySource,
                cancel_reason: "dismissed",
            });
        }
        setShowSetupDialog(open);
    };

    const handleBackToTrain = () => {
        if (routeState?.fromTrain) {
            navigate(-1);
            return;
        }

        navigate("/train", { state: { restoreTrain: true } });
    };

    const resetPreviewIfIdle = () => {
        if (!isPlaying) {
            resetTechniqueRunState(startFret, bpm);
        }
    };

    const handleBpmChange = (value: number) => {
        setBpm(value);
        persistStartingBpm(value);
        if (!isPlaying) {
            currentBpmRef.current = value;
            setCurrentBpm(value);
        }
    };

    const handleStartFretChange = (fret: number) => {
        setStartFret(fret);
        if (exerciseId === "linear" && linearEndFret < fret + 3) {
            setLinearEndFret(Math.min(TECHNIQUE_FRETS, fret + 3));
        }
        if (!isPlaying) {
            resetTechniqueRunState(fret, bpm);
        }
    };

    const handlePermutationTierChange = (value: string) => {
        const nextTier = value === "all" ? "all" : (Number(value) as PermutationTier);
        const nextTierIndices = getPermutationIndicesByTier(nextTier);
        setPermutationTier(nextTier);
        if (!nextTierIndices.includes(permutationIndex)) {
            setPermutationIndex(nextTierIndices[0] ?? 0);
        }
        resetPreviewIfIdle();
    };

    const handlePermutationModeChange = (value: string) => {
        setPermutationMode(value as PermutationMode);
        resetPreviewIfIdle();
    };

    const handlePermutationPatternChange = (value: number) => {
        setPermutationIndex(value);
        resetPreviewIfIdle();
    };

    const handlePermutationStringsToPlayChange = (value: number) => {
        setPermutationStringsToPlay(value);
        resetPreviewIfIdle();
    };

    const handlePermutationDirectionChange = (value: string) => {
        setPermutationDirection(value as PermutationDirection);
        resetPreviewIfIdle();
    };

    const handleRandomSwitchBarsChange = (value: number) => {
        setRandomSwitchBars(value);
        resetPreviewIfIdle();
    };

    const handleDiagonalPatternChange = (value: string) => {
        setDiagonalPattern(value as DiagonalPattern);
        resetPreviewIfIdle();
    };

    const handleDiagonalStringsPerGroupChange = (value: number) => {
        setDiagonalStringsPerGroup(value);
        resetPreviewIfIdle();
    };

    const handleDiagonalPickingStyleChange = (value: string) => {
        setDiagonalPickingStyle(value as DiagonalPickingStyle);
        resetPreviewIfIdle();
    };

    const handleDiagonalShowPickDirectionChange = (checked: boolean) => {
        setDiagonalShowPickDirection(checked);
        resetPreviewIfIdle();
    };

    const handleStringSkipPatternChange = (value: string) => {
        setStringSkipPattern(value as StringSkipPattern);
        resetPreviewIfIdle();
    };

    const handleStringSkipPickingFocusChange = (value: string) => {
        setStringSkipPickingFocus(value as StringSkipPickingFocus);
        resetPreviewIfIdle();
    };

    const handleStringSkipStartPickDirectionChange = (value: string) => {
        setStringSkipStartPickDirection(value as PickDirection);
        resetPreviewIfIdle();
    };

    const handleStringSkipShowPickIndicatorsChange = (checked: boolean) => {
        setStringSkipShowPickIndicators(checked);
        resetPreviewIfIdle();
    };

    const handleLegatoExerciseTypeChange = (value: string) => {
        setLegatoExerciseType(value as LegatoExerciseType);
        resetPreviewIfIdle();
    };

    const handleLegatoTrillPairChange = (value: string) => {
        setLegatoTrillPair(value as LegatoTrillPair);
        resetPreviewIfIdle();
    };

    const handleLinearStringChange = (value: number) => {
        setLinearString(value);
        resetPreviewIfIdle();
    };

    const handleLinearEndFretChange = (value: number) => {
        setLinearEndFret(Math.max(startFret + 3, value));
        resetPreviewIfIdle();
    };

    const handleLinearNotesPerShiftChange = (value: number) => {
        setLinearNotesPerShift(value);
        resetPreviewIfIdle();
    };

    const handleLinearDirectionChange = (value: string) => {
        setLinearDirection(value as LinearDirection);
        resetPreviewIfIdle();
    };

    const handleLinearShiftAmountChange = (value: number) => {
        setLinearShiftAmount(value);
        resetPreviewIfIdle();
    };

    const handleLinearPickingStyleChange = (value: string) => {
        setLinearPickingStyle(value as LinearPickingStyle);
        resetPreviewIfIdle();
    };

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleBackToTrain}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="type-display">{t(`technique.${exerciseId}.name`, exercise.name)}</h1>
                    <p className="type-body text-muted-foreground">{t(`technique.${exerciseId}.description`, exercise.description)}</p>
                    <div className="mt-2 max-w-xl">
                        <ContextPill onOpenSettings={() => navigate("/me?section=settings")} />
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Fretboard */}
                    <Card>
                        <CardContent className="p-4">
                            <Fretboard
                                frets={12}
                                activeNotes={activeNotes}
                                tuning={tuning}
                                leftHanded={leftHanded}
                                className="max-w-full"
                            />
                        </CardContent>
                    </Card>

                    {techniqueCue && (
                        <Card className="border-primary/30 bg-primary/5">
                            <CardContent className="p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("technique.ui.actionCue")}</span>
                                    <Badge variant="secondary">{techniqueCue.label}</Badge>
                                </div>
                                <div className="mt-1 font-mono text-lg">{techniqueCue.notation}</div>
                                {techniqueCue.detail && (
                                    <p className="mt-1 text-xs text-muted-foreground">{techniqueCue.detail}</p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Controls */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <Button
                                        size="lg"
                                        className={cn(
                                            "w-32",
                                            isPlaying ? "control-btn" : "control-btn--primary"
                                        )}
                                        onClick={handlePlayButton}
                                    >
                                        {isPlaying ? (
                                            <><Square className="mr-2 h-4 w-4 fill-current" /> {t("technique.ui.stop")}</>
                                        ) : (
                                            <><Play className="mr-2 h-4 w-4" /> {t("technique.ui.start")}</>
                                        )}
                                    </Button>

                                    {stepMode && isPlaying && (
                                        <Button
                                            variant="outline"
                                            onClick={handleNextStep}
                                        >
                                            <SkipForward className="mr-2 h-4 w-4" />
                                            {t("technique.ui.nextStep")}
                                        </Button>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm font-medium min-w-[60px]">{isPlaying ? currentBpm : bpm} BPM</span>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowSetupDialog(true)}
                                        disabled={isPlaying}
                                    >
                                        <Settings2 className="mr-2 h-4 w-4" />
                                        {t("technique.ui.sessionSetup")}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Instructions */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">{t("practice.instructions")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ol className="space-y-2 list-decimal list-inside">
                                {exercise.instructions.map((instruction, i) => (
                                    <li key={i} className="text-sm text-muted-foreground">
                                        {instruction}
                                    </li>
                                ))}
                            </ol>
                        </CardContent>
                    </Card>
                    <TechniqueStatusCard
                        currentStringLabel={stringLabels[currentString] ?? "-"}
                        currentStep={currentStep}
                        tempoBpm={isPlaying ? currentBpm : bpm}
                        speedUpEnabled={speedUpEnabled}
                        speedUpAmount={speedUpAmount}
                        speedUpInterval={speedUpInterval}
                        isPlaying={isPlaying}
                        nextIncreaseInBeats={Math.max(0, speedUpInterval - speedUpBeatCounter)}
                        showPermutationMeta={isPermutationExercise}
                        permutationModeLabel={getPermutationModeLabel(permutationMode)}
                        permutationTierLabel={
                            permutationTier === "all"
                                ? t("technique.ui.tierLabelAll", { tier: activePermutationTier })
                                : t("technique.ui.tierLabelTier", { tier: activePermutationTier })
                        }
                        permutationStringsToPlay={permutationStringsToPlay}
                        permutationDirection={getPermutationDirectionLabel(permutationDirection)}
                        techniqueCue={techniqueCue}
                        displayedPatternLabel={displayedPatternLabel}
                    />

                </div>
            </div>

            <TechniqueSetupDialog
                isOpen={showSetupDialog}
                onOpenChange={handleSetupDialogOpenChange}
                onStart={handleStartFromSetup}
                exerciseName={exercise.name}
                exerciseDescription={exercise.description}
                bpm={bpm}
                onBpmChange={handleBpmChange}
                stepMode={stepMode}
                onStepModeChange={setStepMode}
                startFret={startFret}
                onStartFretChange={handleStartFretChange}
                speedUpEnabled={speedUpEnabled}
                onSpeedUpEnabledChange={setSpeedUpEnabled}
                speedUpAmount={speedUpAmount}
                onSpeedUpAmountChange={setSpeedUpAmount}
                speedUpInterval={speedUpInterval}
                onSpeedUpIntervalChange={setSpeedUpInterval}
                advancedLabel={t("technique.ui.exerciseAdvanced")}
                advancedContent={hasExerciseSpecificSetup ? (
                    <TechniqueSettingsCard
                        isPlaying={false}
                        renderContainer={false}
                        showCoreControls={false}
                        showSpeedUpControls={false}
                        stepMode={stepMode}
                        onStepModeChange={setStepMode}
                        startFret={startFret}
                        onStartFretChange={handleStartFretChange}
                        showPermutation={isPermutationExercise}
                        permutationMode={permutationMode}
                        permutationModeOptions={permutationModeOptions}
                        onPermutationModeChange={handlePermutationModeChange}
                        permutationTier={String(permutationTier)}
                        onPermutationTierChange={handlePermutationTierChange}
                        permutationPattern={resolvedPermutationIndex}
                        permutationPatternOptions={permutationPatternOptions}
                        onPermutationPatternChange={handlePermutationPatternChange}
                        permutationDailyMode={permutationMode === "daily"}
                        permutationStringsToPlay={permutationStringsToPlay}
                        permutationStringsMax={stringCount}
                        onPermutationStringsToPlayChange={handlePermutationStringsToPlayChange}
                        permutationDirection={permutationDirection}
                        onPermutationDirectionChange={handlePermutationDirectionChange}
                        randomSwitchBars={randomSwitchBars}
                        onRandomSwitchBarsChange={handleRandomSwitchBarsChange}
                        showRandomSwitchBars={permutationMode === "random"}
                        showDiagonal={exerciseId === "diagonal"}
                        diagonalPattern={diagonalPattern}
                        onDiagonalPatternChange={handleDiagonalPatternChange}
                        diagonalStringsPerGroup={diagonalStringsPerGroup}
                        diagonalStringsMax={Math.max(2, stringCount)}
                        onDiagonalStringsPerGroupChange={handleDiagonalStringsPerGroupChange}
                        diagonalPickingStyle={diagonalPickingStyle}
                        onDiagonalPickingStyleChange={handleDiagonalPickingStyleChange}
                        diagonalShowPickDirection={diagonalShowPickDirection}
                        onDiagonalShowPickDirectionChange={handleDiagonalShowPickDirectionChange}
                        showStringSkip={exerciseId === "stringskip"}
                        stringSkipPattern={stringSkipPattern}
                        stringSkipPatternOptions={stringSkipPatternOptions}
                        onStringSkipPatternChange={handleStringSkipPatternChange}
                        stringSkipPickingFocus={stringSkipPickingFocus}
                        onStringSkipPickingFocusChange={handleStringSkipPickingFocusChange}
                        stringSkipStartPickDirection={stringSkipStartPickDirection}
                        onStringSkipStartPickDirectionChange={handleStringSkipStartPickDirectionChange}
                        stringSkipShowPickIndicators={stringSkipShowPickIndicators}
                        onStringSkipShowPickIndicatorsChange={handleStringSkipShowPickIndicatorsChange}
                        showLegato={exerciseId === "legato"}
                        legatoExerciseType={legatoExerciseType}
                        onLegatoExerciseTypeChange={handleLegatoExerciseTypeChange}
                        legatoTrillPair={legatoTrillPair}
                        legatoTrillPairOptions={legatoTrillPairOptions}
                        onLegatoTrillPairChange={handleLegatoTrillPairChange}
                        showLinear={exerciseId === "linear"}
                        linearString={linearString}
                        linearStringMax={stringCount}
                        onLinearStringChange={handleLinearStringChange}
                        linearEndFret={linearEndFret}
                        linearEndFretMin={Math.min(TECHNIQUE_FRETS, startFret + 3)}
                        linearEndFretMax={TECHNIQUE_FRETS}
                        onLinearEndFretChange={handleLinearEndFretChange}
                        linearNotesPerShift={linearNotesPerShift}
                        onLinearNotesPerShiftChange={handleLinearNotesPerShiftChange}
                        linearDirection={linearDirection}
                        onLinearDirectionChange={handleLinearDirectionChange}
                        linearShiftAmount={linearShiftAmount}
                        onLinearShiftAmountChange={handleLinearShiftAmountChange}
                        linearPickingStyle={linearPickingStyle}
                        onLinearPickingStyleChange={handleLinearPickingStyleChange}
                        speedUpEnabled={speedUpEnabled}
                        onSpeedUpEnabledChange={setSpeedUpEnabled}
                        speedUpAmount={speedUpAmount}
                        onSpeedUpAmountChange={setSpeedUpAmount}
                        speedUpInterval={speedUpInterval}
                        onSpeedUpIntervalChange={setSpeedUpInterval}
                    />
                ) : undefined}
            />
        </div>
    );
}

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

const PERMUTATION_MODE_LABELS: Record<PermutationMode, string> = {
    single: "Single Permutation",
    daily: "Daily Challenge",
    sequential: "Sequential Trainer",
    random: "Random Mode",
};

const DIAGONAL_PATTERN_LABELS: Record<DiagonalPattern, string> = {
    ascending: "Ascending",
    descending: "Descending",
    full: "Full Run",
};

const STRING_SKIP_PATTERNS: Record<StringSkipPattern, number[]> = {
    single: [6, 4, 5, 3, 4, 2, 3, 1],
    octave: [6, 4, 5, 3, 4, 2, 3, 1],
    double: [6, 3, 5, 2, 4, 1],
    wide: [6, 1, 5, 2, 4, 3],
};

const STRING_SKIP_PATTERN_LABELS: Record<StringSkipPattern, string> = {
    single: "Single Skip",
    octave: "Octave Skip",
    double: "Double Skip",
    wide: "Wide Skip",
};

const LEGATO_TRILL_PAIRS: Record<LegatoTrillPair, [number, number]> = {
    "1-2": [1, 2],
    "1-3": [1, 3],
    "1-4": [1, 4],
    "2-3": [2, 3],
    "2-4": [2, 4],
    "3-4": [3, 4],
};

const LEGATO_EXERCISE_LABELS: Record<LegatoExerciseType, string> = {
    trill: "Trill",
    hammerOnly: "Hammer-On Spider",
    pullOnly: "Pull-Off Descending",
    threeNote: "3-Note Legato",
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
    const navigate = useNavigate();
    const location = useLocation();
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

    const metronomeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const metronomeAudioContextRef = useRef<AudioContext | null>(null);
    const metronomeBeatRef = useRef(0);
    const currentBpmRef = useRef(initialBpm);
    const speedUpBeatCounterRef = useRef(0);
    const randomModeBeatCounterRef = useRef(0);
    const stickyStateRef = useRef<StickyState>(createStickyState(startFret));

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
    const stringSkipSequence = STRING_SKIP_PATTERNS[stringSkipPattern];
    const activeTrillPair = LEGATO_TRILL_PAIRS[legatoTrillPair];
    const defaultPatternLabel = useMemo(() => {
        if (exerciseId === "permutation") return activePermutationPattern.join("-");
        if (exerciseId === "diagonal") return `${DIAGONAL_PATTERN_LABELS[diagonalPattern]} (${diagonalStringsPerGroup} str)`;
        if (exerciseId === "stringskip") return STRING_SKIP_PATTERN_LABELS[stringSkipPattern];
        if (exerciseId === "legato") {
            return legatoExerciseType === "trill"
                ? `${LEGATO_EXERCISE_LABELS[legatoExerciseType]} ${legatoTrillPair}`
                : LEGATO_EXERCISE_LABELS[legatoExerciseType];
        }
        if (exerciseId === "linear") return `String ${linearString} • ${linearDirection}`;
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
    ]);
    const displayedPatternLabel = isPlaying ? activePatternLabel : defaultPatternLabel;

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
                    label: diagonalPickingStyle === "economy" ? "Economy Picking" : "Alternate Picking",
                    notation: getPickGlyph(pickDirection),
                    detail: pickDirection === "down" ? "Downstroke" : "Upstroke",
                };
            }

            setCurrentString(stringIndex);
            setActiveNotes(notes);
            setTechniqueCue(cue);
            setActivePatternLabel(`${DIAGONAL_PATTERN_LABELS[diagonalPattern]} (${groupSize} str)`);
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
                        ? "Alternate Picking"
                        : stringSkipPickingFocus === "inside"
                            ? "Inside Picking"
                            : "Outside Picking",
                notation: getPickGlyph(pickDirection),
                detail: pickDirection === "down" ? "Downstroke" : "Upstroke",
            };

            setCurrentString(stringIndex);
            setActiveNotes(notes);
            setTechniqueCue(cue);
            setActivePatternLabel(STRING_SKIP_PATTERN_LABELS[stringSkipPattern]);
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
                    cue = { label: "Pick", notation: `${lowFret}`, detail: "Initial picked note" };
                } else if (onUpperNote) {
                    cue = { label: "Hammer-On", notation: `${lowFret}h${highFret}`, detail: "Legato ascent" };
                } else {
                    cue = { label: "Pull-Off", notation: `${highFret}p${lowFret}`, detail: "Legato descent" };
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
                    cue = { label: "Pick", notation: `${baseFret}`, detail: "First note per string" };
                } else {
                    const fromFret = baseFret + fingerPatternAscending[stepInString - 1] - 1;
                    const toFret = baseFret + fingerPatternAscending[stepInString] - 1;
                    cue = { label: "Hammer-On", notation: `${fromFret}h${toFret}`, detail: "No additional pick" };
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
                    cue = { label: "Pick", notation: `${pickedFret}`, detail: "Pick high note while index stays planted" };
                } else {
                    const fromFret = baseFret + fingerPatternDescending[stepInString - 1] - 1;
                    const toFret = baseFret + fingerPatternDescending[stepInString] - 1;
                    cue = { label: "Pull-Off", notation: `${fromFret}p${toFret}`, detail: "Keep index anchored and release down" };
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
                    cue = { label: "Pick", notation: `${baseFret}`, detail: "Start each string with pick" };
                } else {
                    const fromFret = baseFret + offsets[stepInString - 1];
                    const toFret = baseFret + offsets[stepInString];
                    cue = { label: "Hammer-On", notation: `${fromFret}h${toFret}`, detail: "2 legato notes per string" };
                }
            }

            setCurrentString(stringIndex);
            setActiveNotes(notes);
            setTechniqueCue(cue);
            setActivePatternLabel(
                legatoExerciseType === "trill"
                    ? `${LEGATO_EXERCISE_LABELS[legatoExerciseType]} ${legatoTrillPair}`
                    : LEGATO_EXERCISE_LABELS[legatoExerciseType]
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
                    cue = { label: "Pick", notation: `${baseFret}`, detail: "Initial attack" };
                } else {
                    cue = {
                        label: "Hammer-On",
                        notation: `${baseFret + stepInGroup - 1}h${baseFret + stepInGroup}`,
                        detail: "Legato within shift group",
                    };
                }
            } else {
                notes.push(makeNote(stringIndex, fret, "active", `${finger}`));
                const pickDirection = getAlternatingPickDirection(step, "down");
                cue = {
                    label: "Alternate Picking",
                    notation: getPickGlyph(pickDirection),
                    detail: pickDirection === "down" ? "Downstroke" : "Upstroke",
                };
            }

            setCurrentString(stringIndex);
            setActiveNotes(notes);
            setTechniqueCue(cue);
            setActivePatternLabel(`String ${linearString} • ${linearDirection}`);
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

    const togglePlay = () => {
        if (isPlaying) {
            if (currentStep > 0) {
                persistTechniqueSession(currentBpmRef.current);
            }
            setIsPlaying(false);
            resetTechniqueRunState();
            return;
        }

        resetTechniqueRunState();
        setIsPlaying(true);
        runTechniqueBeat();
    };

    const handleBackToTrain = () => {
        const routeState = location.state as { fromTrain?: boolean } | null;
        if (routeState?.fromTrain) {
            navigate(-1);
            return;
        }

        navigate("/train", { state: { restoreTrain: true } });
    };

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleBackToTrain}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{exercise.name}</h1>
                    <p className="text-muted-foreground">{exercise.description}</p>
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
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Action Cue</span>
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
                                        onClick={togglePlay}
                                    >
                                        {isPlaying ? (
                                            <><Square className="mr-2 h-4 w-4 fill-current" /> Stop</>
                                        ) : (
                                            <><Play className="mr-2 h-4 w-4" /> Start</>
                                        )}
                                    </Button>
                                    
                                    {stepMode && isPlaying && (
                                        <Button
                                            variant="outline"
                                            onClick={handleNextStep}
                                        >
                                            <SkipForward className="mr-2 h-4 w-4" />
                                            Next Step
                                        </Button>
                                    )}
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm font-medium min-w-[60px]">{isPlaying ? currentBpm : bpm} BPM</span>
                                    </div>
                                    <Slider
                                        value={[bpm]}
                                        onValueChange={([v]) => {
                                            setBpm(v);
                                            persistStartingBpm(v);
                                            if (!isPlaying) {
                                                currentBpmRef.current = v;
                                                setCurrentBpm(v);
                                            }
                                        }}
                                        min={30}
                                        max={200}
                                        step={5}
                                        className="w-32"
                                        disabled={isPlaying}
                                    />
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
                            <CardTitle className="text-lg">Instructions</CardTitle>
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

                    {/* Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Settings2 className="w-4 h-4" />
                                Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="step-mode">Step Mode</Label>
                                <Switch
                                    id="step-mode"
                                    checked={stepMode}
                                    onCheckedChange={setStepMode}
                                    disabled={isPlaying}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Start Fret</Label>
                                <div className="flex gap-2">
                                    {[1, 3, 5, 7].map(fret => (
                                        <Button
                                            key={fret}
                                            variant={startFret === fret ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => {
                                                setStartFret(fret);
                                                if (exerciseId === "linear" && linearEndFret < fret + 3) {
                                                    setLinearEndFret(Math.min(TECHNIQUE_FRETS, fret + 3));
                                                }
                                                if (!isPlaying) {
                                                    resetTechniqueRunState(fret, bpm);
                                                }
                                            }}
                                            disabled={isPlaying}
                                            className="flex-1"
                                        >
                                            {fret}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {isPermutationExercise && (
                                <div className="space-y-4 rounded-md border border-border/50 p-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="permutation-mode">Mode</Label>
                                        <select
                                            id="permutation-mode"
                                            value={permutationMode}
                                            onChange={(event) => {
                                                setPermutationMode(event.target.value as PermutationMode);
                                                if (!isPlaying) {
                                                    resetTechniqueRunState(startFret, bpm);
                                                }
                                            }}
                                            disabled={isPlaying}
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {Object.entries(PERMUTATION_MODE_LABELS).map(([mode, label]) => (
                                                <option key={mode} value={mode}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="permutation-tier">Tier</Label>
                                        <select
                                            id="permutation-tier"
                                            value={String(permutationTier)}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                const nextTier = value === "all" ? "all" : (Number(value) as PermutationTier);
                                                const nextTierIndices = getPermutationIndicesByTier(nextTier);
                                                setPermutationTier(nextTier);
                                                if (!nextTierIndices.includes(permutationIndex)) {
                                                    setPermutationIndex(nextTierIndices[0] ?? 0);
                                                }
                                                if (!isPlaying) {
                                                    resetTechniqueRunState(startFret, bpm);
                                                }
                                            }}
                                            disabled={isPlaying}
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="all">All Tiers (24)</option>
                                            <option value="1">Tier 1 - Beginner</option>
                                            <option value="2">Tier 2 - Intermediate</option>
                                            <option value="3">Tier 3 - Advanced</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="permutation-pattern">Pattern</Label>
                                        <select
                                            id="permutation-pattern"
                                            value={String(resolvedPermutationIndex)}
                                            onChange={(event) => {
                                                setPermutationIndex(Number(event.target.value));
                                                if (!isPlaying) {
                                                    resetTechniqueRunState(startFret, bpm);
                                                }
                                            }}
                                            disabled={isPlaying || permutationMode === "daily"}
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {availablePermutationIndices.map((index) => {
                                                const pattern = PERMUTATIONS[index];
                                                return (
                                                    <option key={index} value={index}>
                                                        #{index + 1} - {pattern.pattern.join("-")} (T{pattern.tier})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {permutationMode === "daily" && (
                                            <p className="text-xs text-muted-foreground">
                                                Daily challenge selects a fixed pattern for today.
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <Label className="text-sm">Strings to play</Label>
                                            <span className="font-mono text-xs">{permutationStringsToPlay}</span>
                                        </div>
                                        <Slider
                                            value={[permutationStringsToPlay]}
                                            onValueChange={([value]) => {
                                                setPermutationStringsToPlay(value);
                                                if (!isPlaying) {
                                                    resetTechniqueRunState(startFret, bpm);
                                                }
                                            }}
                                            min={1}
                                            max={stringCount}
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
                                                    onClick={() => {
                                                        setPermutationDirection(option.value as PermutationDirection);
                                                        if (!isPlaying) {
                                                            resetTechniqueRunState(startFret, bpm);
                                                        }
                                                    }}
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
                                            <p className="text-xs text-muted-foreground">
                                                Enabled by default in Permutation Trainer (Spider-style).
                                            </p>
                                        </div>
                                        <Badge variant="secondary">On</Badge>
                                    </div>

                                    {permutationMode === "random" && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <Label className="text-sm">Random switch every</Label>
                                                <span className="font-mono text-xs">
                                                    {randomSwitchBars} bar{randomSwitchBars > 1 ? "s" : ""}
                                                </span>
                                            </div>
                                            <Slider
                                                value={[randomSwitchBars]}
                                                onValueChange={([value]) => {
                                                    setRandomSwitchBars(value);
                                                    if (!isPlaying) {
                                                        resetTechniqueRunState(startFret, bpm);
                                                    }
                                                }}
                                                min={1}
                                                max={8}
                                                step={1}
                                                disabled={isPlaying}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {exerciseId === "diagonal" && (
                                <div className="space-y-4 rounded-md border border-border/50 p-3">
                                    <div className="space-y-2">
                                        <Label>Pattern</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(
                                                [
                                                    { value: "ascending", label: "Ascending" },
                                                    { value: "descending", label: "Descending" },
                                                    { value: "full", label: "Full" },
                                                ] satisfies Array<{ value: DiagonalPattern; label: string }>
                                            ).map((option) => (
                                                <Button
                                                    key={option.value}
                                                    variant={diagonalPattern === option.value ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => {
                                                        setDiagonalPattern(option.value);
                                                        if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                                    }}
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
                                            onValueChange={([value]) => {
                                                setDiagonalStringsPerGroup(value);
                                                if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                            }}
                                            min={2}
                                            max={Math.max(2, stringCount)}
                                            step={1}
                                            disabled={isPlaying}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Picking Style</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(
                                                [
                                                    { value: "alternate", label: "Alternate" },
                                                    { value: "economy", label: "Economy" },
                                                ] satisfies Array<{ value: DiagonalPickingStyle; label: string }>
                                            ).map((option) => (
                                                <Button
                                                    key={option.value}
                                                    variant={diagonalPickingStyle === option.value ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => {
                                                        setDiagonalPickingStyle(option.value);
                                                        if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                                    }}
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
                                            onCheckedChange={(checked) => {
                                                setDiagonalShowPickDirection(checked);
                                                if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {exerciseId === "stringskip" && (
                                <div className="space-y-4 rounded-md border border-border/50 p-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="string-skip-pattern">Skip Pattern</Label>
                                        <select
                                            id="string-skip-pattern"
                                            value={stringSkipPattern}
                                            onChange={(event) => {
                                                setStringSkipPattern(event.target.value as StringSkipPattern);
                                                if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                            }}
                                            disabled={isPlaying}
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {Object.entries(STRING_SKIP_PATTERN_LABELS).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Picking Focus</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(
                                                [
                                                    { value: "alternate", label: "Alternate" },
                                                    { value: "inside", label: "Inside" },
                                                    { value: "outside", label: "Outside" },
                                                ] satisfies Array<{ value: StringSkipPickingFocus; label: string }>
                                            ).map((option) => (
                                                <Button
                                                    key={option.value}
                                                    variant={stringSkipPickingFocus === option.value ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => {
                                                        setStringSkipPickingFocus(option.value);
                                                        if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                                    }}
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
                                            {(
                                                [
                                                    { value: "down", label: "Down (v)" },
                                                    { value: "up", label: "Up (^)" },
                                                ] satisfies Array<{ value: PickDirection; label: string }>
                                            ).map((option) => (
                                                <Button
                                                    key={option.value}
                                                    variant={stringSkipStartPickDirection === option.value ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => {
                                                        setStringSkipStartPickDirection(option.value);
                                                        if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                                    }}
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
                                            onCheckedChange={(checked) => {
                                                setStringSkipShowPickIndicators(checked);
                                                if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {exerciseId === "legato" && (
                                <div className="space-y-4 rounded-md border border-border/50 p-3">
                                    <div className="space-y-2">
                                        <Label>Exercise Type</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(
                                                [
                                                    { value: "trill", label: "Trill" },
                                                    { value: "hammerOnly", label: "Hammer Spider" },
                                                    { value: "pullOnly", label: "Pull Desc" },
                                                    { value: "threeNote", label: "3-Note" },
                                                ] satisfies Array<{ value: LegatoExerciseType; label: string }>
                                            ).map((option) => (
                                                <Button
                                                    key={option.value}
                                                    variant={legatoExerciseType === option.value ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => {
                                                        setLegatoExerciseType(option.value);
                                                        if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                                    }}
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
                                            <select
                                                id="legato-trill-pair"
                                                value={legatoTrillPair}
                                                onChange={(event) => {
                                                    setLegatoTrillPair(event.target.value as LegatoTrillPair);
                                                    if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                                }}
                                                disabled={isPlaying}
                                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {Object.keys(LEGATO_TRILL_PAIRS).map((pair) => (
                                                    <option key={pair} value={pair}>
                                                        {pair}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground">
                                        Legato notation follows guitar standard: <span className="font-mono">5h7</span> for hammer-on, <span className="font-mono">7p5</span> for pull-off.
                                    </div>
                                </div>
                            )}

                            {exerciseId === "linear" && (
                                <div className="space-y-4 rounded-md border border-border/50 p-3">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <Label className="text-sm">String</Label>
                                            <span className="font-mono text-xs">{linearString}</span>
                                        </div>
                                        <Slider
                                            value={[linearString]}
                                            onValueChange={([value]) => {
                                                setLinearString(value);
                                                if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                            }}
                                            min={1}
                                            max={stringCount}
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
                                            onValueChange={([value]) => {
                                                setLinearEndFret(Math.max(startFret + 3, value));
                                                if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                            }}
                                            min={Math.min(TECHNIQUE_FRETS, startFret + 3)}
                                            max={TECHNIQUE_FRETS}
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
                                                    onClick={() => {
                                                        setLinearNotesPerShift(value);
                                                        if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                                    }}
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
                                            {(
                                                [
                                                    { value: "ascending", label: "Asc" },
                                                    { value: "descending", label: "Desc" },
                                                    { value: "roundTrip", label: "Round" },
                                                ] satisfies Array<{ value: LinearDirection; label: string }>
                                            ).map((option) => (
                                                <Button
                                                    key={option.value}
                                                    variant={linearDirection === option.value ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => {
                                                        setLinearDirection(option.value);
                                                        if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                                    }}
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
                                            onValueChange={([value]) => {
                                                setLinearShiftAmount(value);
                                                if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                            }}
                                            min={1}
                                            max={3}
                                            step={1}
                                            disabled={isPlaying}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Picking Style</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(
                                                [
                                                    { value: "alternate", label: "Alternate" },
                                                    { value: "legato", label: "Legato" },
                                                ] satisfies Array<{ value: LinearPickingStyle; label: string }>
                                            ).map((option) => (
                                                <Button
                                                    key={option.value}
                                                    variant={linearPickingStyle === option.value ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => {
                                                        setLinearPickingStyle(option.value);
                                                        if (!isPlaying) resetTechniqueRunState(startFret, bpm);
                                                    }}
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
                                    <Switch
                                        id="speed-up"
                                        checked={speedUpEnabled}
                                        onCheckedChange={setSpeedUpEnabled}
                                    />
                                </div>

                                <div className={cn("space-y-3", !speedUpEnabled && "opacity-50")}>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <Label className="text-sm">Increase</Label>
                                            <span className="font-mono text-xs">+{speedUpAmount} BPM</span>
                                        </div>
                                        <Slider
                                            value={[speedUpAmount]}
                                            onValueChange={([v]) => setSpeedUpAmount(v)}
                                            min={1}
                                            max={20}
                                            step={1}
                                            disabled={!speedUpEnabled}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <Label className="text-sm">Every</Label>
                                            <span className="font-mono text-xs">{speedUpInterval} beat{speedUpInterval > 1 ? 's' : ''}</span>
                                        </div>
                                        <Slider
                                            value={[speedUpInterval]}
                                            onValueChange={([v]) => setSpeedUpInterval(v)}
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

                    {/* Current Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Current String</span>
                                <span className="font-medium">{stringLabels[currentString] ?? "-"}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Step</span>
                                <span className="font-medium">{currentStep}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tempo</span>
                                <span className="font-medium">{isPlaying ? currentBpm : bpm} BPM</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Speed-Up</span>
                                <span className="font-medium">
                                    {speedUpEnabled ? `+${speedUpAmount}/${speedUpInterval}b` : "Off"}
                                </span>
                            </div>
                            {speedUpEnabled && isPlaying && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Next Increase In</span>
                                    <span className="font-medium">
                                        {Math.max(0, speedUpInterval - speedUpBeatCounter)} beat{Math.max(0, speedUpInterval - speedUpBeatCounter) !== 1 ? "s" : ""}
                                    </span>
                                </div>
                            )}
                            {isPermutationExercise && (
                                <>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Mode</span>
                                        <span className="font-medium">{PERMUTATION_MODE_LABELS[permutationMode]}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Tier</span>
                                        <span className="font-medium">
                                            {permutationTier === "all" ? `All (T${activePermutationTier})` : `Tier ${activePermutationTier}`}
                                        </span>
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
                                    {techniqueCue.detail && (
                                        <div className="text-xs text-muted-foreground">{techniqueCue.detail}</div>
                                    )}
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Pattern</span>
                                <Badge variant="secondary">
                                    {displayedPatternLabel}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

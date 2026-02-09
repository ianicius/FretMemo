import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Fretboard } from "@/components/fretboard/Fretboard";
import { TabView } from "@/components/fretboard/TabView";
import type { NoteName, Position, NoteStatus, FretboardLayer } from "@/types/fretboard";
import { useGameStore, type ScaleType, type NoteFilter } from "@/stores/useGameStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { NOTES, getNoteAt } from "@/lib/constants";
import { getStringLabels, normalizeTuning } from "@/lib/tuning";
import { usePitchDetector } from "@/services/pitch";
import { Flame, Map as MapIcon, Mic, Play, Target, Clock } from "lucide-react";

// Focus Mode Components
import { PreFlightModal } from "@/components/practice/PreFlightModal";
import { SessionSummaryModal } from "@/components/practice/SessionSummaryModal";
import { FocusModeHUD } from "@/components/practice/FocusModeHUD";
import { XPToast } from "@/components/practice/XPToast";
import { AriaLiveAnnouncer } from "@/components/ui/aria-live-announcer";
import { NoteAnswerButtons, PositionAnswerButtons } from "@/components/practice/AnswerButtons";
import { PlayModeMicControls, HintButton, NextButton } from "@/components/practice/PracticeControls";
import { useXPToast } from "@/hooks/useXPToast";

type GuessMode = "fretboardToNote" | "tabToNote" | "noteToTab";
type PlayMode = "playNotes" | "playTab";
type PracticeMode = GuessMode | PlayMode;
type ChallengeConfig = {
    type: "timed" | "survival" | "findAll";
    label: string;
    timeLimitSec?: number;
    targetNote?: NoteName;
};
type PracticeRouteState = {
    openPreFlight?: boolean;
    source?: string;
    mode?: PracticeMode;
    challenge?: ChallengeConfig;
    constraints?: {
        fretRange?: { min: number; max: number };
        enabledStrings?: boolean[];
        noteFilter?: NoteFilter;
        rootNote?: NoteName;
        scaleType?: ScaleType;
    };
};

const LAYER_OPTIONS: Array<{ id: FretboardLayer; label: string }> = [
    { id: "standard", label: "Standard" },
    { id: "heatmap", label: "Heatmap" },
    { id: "scale", label: "Scale" },
    { id: "intervals", label: "Intervals" },
];
const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const SCALE_DEGREE_COLORS = ["#fb7185", "#f97316", "#eab308", "#22c55e", "#38bdf8", "#6366f1", "#a855f7"] as const;
const TRIAD_INTERVAL_COLORS = {
    root: SCALE_DEGREE_COLORS[0],
    third: SCALE_DEGREE_COLORS[2],
    fifth: SCALE_DEGREE_COLORS[4],
} as const;
const SCALE_INTERVALS: Record<ScaleType, number[]> = {
    major: MAJOR_SCALE_OFFSETS,
    minor: [0, 2, 3, 5, 7, 8, 10],
    majorPentatonic: [0, 2, 4, 7, 9],
    minorPentatonic: [0, 3, 5, 7, 10],
};
const SCALE_LABELS: Record<ScaleType, string> = {
    major: "Major",
    minor: "Minor",
    majorPentatonic: "Major Pentatonic",
    minorPentatonic: "Minor Pentatonic",
};


export default function Practice() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        isPlaying,
        score,
        streak,
        mode,
        targetNote,
        targetPosition,
        nextNote,
        nextPosition,
        noteOptions,
        noteToTabOptions,
        practiceConstraints,
        feedbackMessage,
        lastAnswer,
        bpm,
        noteDuration,
        isMetronomeOn,
        isMetronomeArmed,
        sessionStartTime,
        sessionCorrect,
        sessionIncorrect,
        setMode,
        setBpm,
        setNoteDuration,
        setPracticeConstraints,
        setForcedTargetNote,
        togglePracticeString,
        startGame,
        stopGame,
        submitNoteGuess,
        submitPositionGuess,
        submitDetectedNote,
        applyHintPenalty,
        toggleMetronome,
        advanceAfterAnswer,
    } = useGameStore();

    const {
        heatMapEnabled,
        toggleHeatMap,
        getAccuracyForFretboard,
        streakDays,
        totalPracticeTime,
        totalCorrect,
        totalIncorrect,
        achievements,
        sessionHistory,
        positionStats,
    } = useProgressStore();
    const autoAdvanceEnabled = useSettingsStore((state) => state.full.learning.autoAdvance);
    const showXPNotes = useSettingsStore((state) => state.full.gamification.showXPNotes);
    const showStreakWarnings = useSettingsStore((state) => state.full.gamification.showStreakWarnings);
    const showAchievements = useSettingsStore((state) => state.full.gamification.showAchievements);
    const leftHanded = useSettingsStore((state) => state.full.instrument.leftHanded);
    const quickTuning = useSettingsStore((state) => state.quick.tuning);
    const tuning = useMemo(() => normalizeTuning(quickTuning), [quickTuning]);
    const displaySettings = useSettingsStore((state) => state.full.display);
    const updateFullSettings = useSettingsStore((state) => state.updateFullSettings);
    const [focusLayerOverride, setFocusLayerOverride] = useState<FretboardLayer | null>(null);
    const focusLayer: FretboardLayer = focusLayerOverride ?? displaySettings.defaultLayer;
    const stringLabels = useMemo(() => getStringLabels(tuning), [tuning]);
    const routeState = (location.state as PracticeRouteState | null) ?? null;
    const routeHasCatalogContext = Boolean(routeState?.mode || routeState?.source || routeState?.challenge);
    const routePreFlightOpen = Boolean(routeState?.openPreFlight) && !isPlaying;
    const [activeChallenge, setActiveChallenge] = useState<ChallengeConfig | null>(routeState?.challenge ?? null);
    const enteredViaCatalogRef = useRef(routeHasCatalogContext);
    const [challengeSecondsLeft, setChallengeSecondsLeft] = useState<number | null>(
        routeState?.challenge?.type === "timed" ? (routeState.challenge.timeLimitSec ?? 60) : null
    );
    const [findAllFoundKeys, setFindAllFoundKeys] = useState<string[]>([]);
    const challengeStopRef = useRef(false);

    // Focus Mode State
    const [showPreFlight, setShowPreFlight] = useState(() => routePreFlightOpen);
    const [showSummary, setShowSummary] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [hintPromptKey, setHintPromptKey] = useState<string | null>(null);
    const [hudHeight, setHudHeight] = useState(96);
    const [sessionStats, setSessionStats] = useState<{
        score: number;
        correct: number;
        incorrect: number;
        maxStreak: number;
        duration: number;
        previousAccuracy: number | null;
        isFirstSession: boolean;
        personalBest: boolean;
    } | null>(null);

    const maxStreakRef = useRef(0);
    const prevXpStreakRef = useRef(0);
    const prevWarningStreakRef = useRef(0);
    const prevUnlockedCountRef = useRef<number | null>(null);

    const { toast, showToast, hideToast } = useXPToast();
    const isPreFlightOpen = showPreFlight;

    useEffect(() => {
        if (!routeState || isPlaying) return;
        enteredViaCatalogRef.current = true;
        if (routeState.mode && routeState.mode !== mode) {
            setMode(routeState.mode);
        }
        if (routeState.constraints) {
            setPracticeConstraints(routeState.constraints);
        }
        challengeStopRef.current = false;
        navigate(
            { pathname: location.pathname, search: location.search },
            { replace: true, state: null }
        );
    }, [routeState, isPlaying, mode, setMode, setPracticeConstraints, navigate, location.pathname, location.search]);

    useEffect(() => {
        if (isPlaying || showSummary || isPreFlightOpen) return;
        if (enteredViaCatalogRef.current) return;
        navigate("/train", { replace: true });
    }, [isPlaying, isPreFlightOpen, navigate, showSummary]);

    useEffect(() => {
        if (isPlaying && streak > maxStreakRef.current) {
            maxStreakRef.current = streak;
        }
    }, [streak, isPlaying]);

    useEffect(() => {
        if (!showXPNotes) {
            prevXpStreakRef.current = streak;
            return;
        }

        if (isPlaying && streak > prevXpStreakRef.current) {
            const baseXP = 10;
            const streakBonus = (streak - 1) * 2;
            const totalXP = baseXP + streakBonus;

            let toastType: "correct" | "streak" = "correct";
            let message: string | undefined;

            if (streak === 5) {
                toastType = "streak";
                message = "5 streak! Keep it up!";
            } else if (streak === 10) {
                toastType = "streak";
                message = "Amazing! 10 streak!";
            } else if (streak === 20) {
                toastType = "streak";
                message = "Perfect Session! 20 streak!";
            }

            showToast(totalXP, toastType, streak, message);
        }
        prevXpStreakRef.current = streak;
    }, [streak, isPlaying, showToast, showXPNotes]);

    useEffect(() => {
        if (!isPlaying) {
            prevWarningStreakRef.current = streak;
            return;
        }

        const prev = prevWarningStreakRef.current;
        const streakBroken = prev >= 5 && streak === 0 && prev > streak;
        const wrongAttempt = Boolean(lastAnswer && !lastAnswer.correct) || feedbackMessage === "Too slow!";

        if (showStreakWarnings && streakBroken && wrongAttempt) {
            showToast(0, "warning", prev, `Streak broken at ${prev}`);
        }

        prevWarningStreakRef.current = streak;
    }, [streak, isPlaying, lastAnswer, feedbackMessage, showStreakWarnings, showToast]);

    useEffect(() => {
        const unlocked = achievements.filter((achievement) => achievement.unlockedAt);

        if (prevUnlockedCountRef.current === null) {
            prevUnlockedCountRef.current = unlocked.length;
            return;
        }

        if (unlocked.length > prevUnlockedCountRef.current && showAchievements) {
            const latest = [...unlocked].sort((a, b) => {
                const aTime = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
                const bTime = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
                return bTime - aTime;
            })[0];

            if (latest) {
                showToast(0, "achievement", 0, latest.name);
            }
        }

        prevUnlockedCountRef.current = unlocked.length;
    }, [achievements, showAchievements, showToast]);

    const isPlayModule = mode === "playNotes" || mode === "playTab";
    const moduleTab = isPlayModule ? ("play" as const) : ("guess" as const);
    const modeLabel =
        mode === "fretboardToNote"
            ? "Fretboard → Note"
            : mode === "tabToNote"
                ? "Tab → Note"
                : mode === "noteToTab"
                    ? "Note → Tab"
                    : mode === "playNotes"
                        ? "Note Names (Mic)"
                        : "Tab Sequence (Mic)";
    const layerRootNote = practiceConstraints.rootNote;
    const layerScaleLabel = SCALE_LABELS[practiceConstraints.scaleType];
    const manualAdvanceRequired = moduleTab === "guess" && !isMetronomeOn && !autoAdvanceEnabled && Boolean(lastAnswer);
    const isFretboardGuessMode = moduleTab === "guess" && mode === "fretboardToNote";
    const safeHudHeight = Math.min(132, Math.max(hudHeight + 8, 108));
    const selectedGuessNote = lastAnswer?.selectedNote;
    const sessionTotal = sessionCorrect + sessionIncorrect;
    const currentPromptKey = `${mode}:${targetPosition?.stringIndex ?? "x"}-${targetPosition?.fret ?? "x"}:${targetNote ?? "x"}`;
    const hintUsedForPrompt = hintPromptKey === currentPromptKey;
    const shouldShowToast = (() => {
        if (!toast.isVisible) return false;
        if (toast.type === "achievement") return showAchievements;
        if (toast.type === "warning") return showStreakWarnings;
        return showXPNotes;
    })();

    useEffect(() => {
        if (toast.isVisible && !shouldShowToast) {
            hideToast();
        }
    }, [toast.isVisible, shouldShowToast, hideToast]);

    const handleLayerChange = (layer: FretboardLayer) => {
        setFocusLayerOverride(layer);
        if (displaySettings.defaultLayer !== layer) {
            updateFullSettings({
                display: {
                    ...displaySettings,
                    defaultLayer: layer,
                },
            });
        }
    };

    const [micEnabled, setMicEnabled] = useState(false);
    const { note: detectedNote } = usePitchDetector(micEnabled);
    const lastDetectedRef = useRef<NoteName | null>(null);

    useEffect(() => {
        lastDetectedRef.current = null;
    }, [mode, targetNote, targetPosition?.note, micEnabled]);

    useEffect(() => {
        if (!micEnabled || !isPlaying || (mode !== "playNotes" && mode !== "playTab") || !detectedNote || detectedNote === lastDetectedRef.current) return;
        lastDetectedRef.current = detectedNote;
        submitDetectedNote(detectedNote);
    }, [detectedNote, isPlaying, micEnabled, mode, submitDetectedNote]);

    const overallAccuracy = totalCorrect + totalIncorrect > 0 ? Math.round((totalCorrect / (totalCorrect + totalIncorrect)) * 100) : 0;

    const activeNotes: NoteStatus[] = useMemo(() => {
        const byPosition = new Map<string, NoteStatus>();
        const keyFor = (position: Position) => `${position.stringIndex}-${position.fret}`;
        const put = (note: NoteStatus) => {
            byPosition.set(keyFor(note.position), note);
        };
        const putIfMissing = (note: NoteStatus) => {
            const key = keyFor(note.position);
            if (!byPosition.has(key)) {
                byPosition.set(key, note);
            }
        };

        if (lastAnswer) {
            put({
                position: lastAnswer.position,
                status: lastAnswer.correct ? "correct" : "incorrect",
                label: lastAnswer.correct ? targetPosition?.note : undefined,
            });

            if (!lastAnswer.correct && mode === "noteToTab" && targetPosition) {
                put({
                    position: targetPosition,
                    status: "correct",
                    label: targetPosition.note,
                });
            }
        }
        if (isPlaying && mode === "fretboardToNote" && targetPosition && !lastAnswer) {
            put({
                position: targetPosition,
                status: "active",
                label: "?",
                feedbackText: feedbackMessage === "Too slow!" ? "Too slow!" : undefined,
            });
        }

        const effectiveLayer: FretboardLayer =
            mode === "fretboardToNote"
                ? (isPlaying ? focusLayer : (heatMapEnabled ? "heatmap" : "standard"))
                : (heatMapEnabled && !isPlaying ? "heatmap" : "standard");

        if (effectiveLayer === "heatmap") {
            const heatmapData = getAccuracyForFretboard();
            heatmapData.forEach(({ position, accuracy }) => {
                if (accuracy !== null) {
                    putIfMissing({
                        position,
                        status: "idle",
                        opacity: 0.18 + accuracy * 0.7,
                    });
                }
            });
        }

        if (effectiveLayer === "scale" || effectiveLayer === "intervals") {
            const rootNote = practiceConstraints.rootNote;
            const scaleType = practiceConstraints.scaleType;
            const rootIndex = NOTES.indexOf(rootNote);
            const configuredStrings = practiceConstraints.enabledStrings
                .map((enabled, index) => (enabled ? index : -1))
                .filter((index) => index >= 0);
            const stringIndices = configuredStrings.length > 0
                ? configuredStrings
                : tuning.map((_, index) => index);
            const minFret = Math.max(1, Math.min(12, practiceConstraints.fretRange.min));
            const maxFret = Math.max(minFret, Math.min(12, practiceConstraints.fretRange.max));

            if (rootIndex >= 0) {
                if (effectiveLayer === "scale") {
                    const scaleMap = new Map<NoteName, { degree: number; color: string }>();
                    const intervals = SCALE_INTERVALS[scaleType] ?? SCALE_INTERVALS.major;
                    intervals.forEach((offset, degreeIndex) => {
                        const note = NOTES[(rootIndex + offset) % NOTES.length];
                        scaleMap.set(note, {
                            degree: degreeIndex + 1,
                            color: SCALE_DEGREE_COLORS[degreeIndex % SCALE_DEGREE_COLORS.length],
                        });
                    });

                    for (const stringIndex of stringIndices) {
                        for (let fret = minFret; fret <= maxFret; fret += 1) {
                            const note = getNoteAt(tuning[stringIndex], fret);
                            const degree = scaleMap.get(note);
                            if (!degree) continue;
                            putIfMissing({
                                position: { stringIndex, fret, note },
                                status: "idle",
                                label: `${degree.degree}`,
                                color: degree.color,
                            });
                        }
                    }
                } else {
                    const thirdOffset = scaleType === "minor" || scaleType === "minorPentatonic" ? 3 : 4;
                    const thirdLabel = thirdOffset === 3 ? "b3" : "3";
                    const thirdNote = NOTES[(rootIndex + thirdOffset) % NOTES.length];
                    const fifthNote = NOTES[(rootIndex + 7) % NOTES.length];
                    for (const stringIndex of stringIndices) {
                        for (let fret = minFret; fret <= maxFret; fret += 1) {
                            const note = getNoteAt(tuning[stringIndex], fret);
                            if (note === rootNote) {
                                putIfMissing({
                                    position: { stringIndex, fret, note },
                                    status: "idle",
                                    label: "R",
                                    color: TRIAD_INTERVAL_COLORS.root,
                                });
                            } else if (note === thirdNote) {
                                putIfMissing({
                                    position: { stringIndex, fret, note },
                                    status: "idle",
                                    label: thirdLabel,
                                    color: TRIAD_INTERVAL_COLORS.third,
                                });
                            } else if (note === fifthNote) {
                                putIfMissing({
                                    position: { stringIndex, fret, note },
                                    status: "idle",
                                    label: "5",
                                    color: TRIAD_INTERVAL_COLORS.fifth,
                                });
                            }
                        }
                    }
                }
            }
        }

        return Array.from(byPosition.values());
    }, [
        focusLayer,
        getAccuracyForFretboard,
        heatMapEnabled,
        isPlaying,
        lastAnswer,
        mode,
        practiceConstraints.enabledStrings,
        practiceConstraints.fretRange.max,
        practiceConstraints.fretRange.min,
        practiceConstraints.rootNote,
        practiceConstraints.scaleType,
        feedbackMessage,
        targetPosition,
        tuning,
    ]);

    const findAllTargetCount = useMemo(() => {
        if (activeChallenge?.type !== "findAll" || !activeChallenge.targetNote) return 0;

        const enabledIndices = practiceConstraints.enabledStrings
            .map((enabled, index) => (enabled ? index : -1))
            .filter((index) => index >= 0);
        const stringIndices = enabledIndices.length > 0
            ? enabledIndices
            : tuning.map((_, index) => index);
        const minFret = Math.max(1, Math.min(12, practiceConstraints.fretRange.min));
        const maxFret = Math.max(minFret, Math.min(12, practiceConstraints.fretRange.max));

        let total = 0;
        for (const stringIndex of stringIndices) {
            for (let fret = minFret; fret <= maxFret; fret += 1) {
                const note = getNoteAt(tuning[stringIndex], fret);
                if (note === activeChallenge.targetNote) {
                    total += 1;
                }
            }
        }

        return total;
    }, [activeChallenge, practiceConstraints.enabledStrings, practiceConstraints.fretRange.max, practiceConstraints.fretRange.min, tuning]);
    const progressTarget = activeChallenge?.type === "findAll" ? findAllTargetCount : 30;

    const handleSwitchModule = (next: "guess" | "play") => {
        if (isPlaying) return;
        setActiveChallenge(null);
        setForcedTargetNote(null);
        setChallengeSecondsLeft(null);
        setFindAllFoundKeys([]);
        if (next === "guess") setMode("fretboardToNote");
        else setMode("playNotes");
    };

    const handleGuessModeChange = (value: string) => {
        if (isPlaying) return;
        setActiveChallenge(null);
        setForcedTargetNote(null);
        setChallengeSecondsLeft(null);
        setFindAllFoundKeys([]);
        setMode(value as GuessMode);
    };

    const handlePlayModeChange = (value: string) => {
        if (isPlaying) return;
        setActiveChallenge(null);
        setForcedTargetNote(null);
        setChallengeSecondsLeft(null);
        setFindAllFoundKeys([]);
        setMode(value as PlayMode);
    };

    const handlePositionGuess = (option: Position) => {
        if (
            activeChallenge?.type === "findAll" &&
            mode === "noteToTab" &&
            targetPosition &&
            option.stringIndex === targetPosition.stringIndex &&
            option.fret === targetPosition.fret
        ) {
            const key = `${option.stringIndex}-${option.fret}`;
            setFindAllFoundKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
        }

        submitPositionGuess(option);
    };

    const handleStartClick = () => {
        setShowPreFlight(true);
    };

    const handlePreFlightStart = () => {
        setShowPreFlight(false);
        maxStreakRef.current = 0;
        prevXpStreakRef.current = 0;
        prevWarningStreakRef.current = 0;
        setFindAllFoundKeys([]);
        challengeStopRef.current = false;
        if (activeChallenge?.type === "findAll" && activeChallenge.targetNote) {
            setForcedTargetNote(activeChallenge.targetNote);
        } else {
            setForcedTargetNote(null);
        }
        setChallengeSecondsLeft(activeChallenge?.type === "timed" ? (activeChallenge.timeLimitSec ?? 60) : null);
        startGame();
    };

    const handlePreFlightClose = () => {
        setShowPreFlight(false);
        if (enteredViaCatalogRef.current && !isPlaying) {
            navigate("/train", { replace: true });
        }
    };

    const finalizeSession = useCallback(() => {
        const endTime = Date.now();
        const duration = sessionStartTime ? Math.floor((endTime - sessionStartTime) / 1000) : 0;
        const previousSession = sessionHistory[sessionHistory.length - 1];
        const previousAccuracy = previousSession
            ? Math.round(previousSession.accuracy)
            : null;
        const currentTotal = sessionCorrect + sessionIncorrect;
        const currentAccuracy = currentTotal > 0 ? Math.round((sessionCorrect / currentTotal) * 100) : 0;
        const maxPreviousAccuracy = sessionHistory.length > 0
            ? Math.max(...sessionHistory.map((session) => Math.round(session.accuracy)))
            : 0;

        setSessionStats({
            score,
            correct: sessionCorrect,
            incorrect: sessionIncorrect,
            maxStreak: maxStreakRef.current,
            duration,
            previousAccuracy,
            isFirstSession: sessionHistory.length === 0,
            personalBest: sessionHistory.length > 0 && currentAccuracy > maxPreviousAccuracy,
        });
        setIsPaused(false);
        hideToast();
        stopGame();
        setForcedTargetNote(null);
        setShowSummary(true);
    }, [hideToast, score, sessionCorrect, sessionHistory, sessionIncorrect, sessionStartTime, setForcedTargetNote, stopGame]);

    useEffect(() => {
        if (!isPlaying || activeChallenge?.type !== "timed" || isPaused) return;
        const interval = window.setInterval(() => {
            setChallengeSecondsLeft((prev) => {
                const fallback = activeChallenge.timeLimitSec ?? 60;
                if (prev === null) return Math.max(0, fallback - 1);
                return Math.max(0, prev - 1);
            });
        }, 1000);

        return () => window.clearInterval(interval);
    }, [activeChallenge, isPaused, isPlaying]);

    useEffect(() => {
        if (!isPlaying || activeChallenge?.type !== "timed") return;
        if (challengeSecondsLeft === null || challengeSecondsLeft > 0) return;
        if (challengeStopRef.current) return;

        challengeStopRef.current = true;
        finalizeSession();
    }, [activeChallenge, challengeSecondsLeft, finalizeSession, isPlaying]);

    useEffect(() => {
        if (!isPlaying || activeChallenge?.type !== "survival") return;
        if (sessionIncorrect <= 0 || challengeStopRef.current) return;

        challengeStopRef.current = true;
        finalizeSession();
    }, [activeChallenge, finalizeSession, isPlaying, sessionIncorrect]);

    useEffect(() => {
        if (!isPlaying || activeChallenge?.type !== "findAll") return;
        if (findAllTargetCount <= 0 || findAllFoundKeys.length < findAllTargetCount) return;
        if (challengeStopRef.current) return;

        challengeStopRef.current = true;
        finalizeSession();
    }, [activeChallenge, finalizeSession, findAllFoundKeys.length, findAllTargetCount, isPlaying]);

    // Auto-end session when reaching progress target (30 questions for regular sessions)
    useEffect(() => {
        if (!isPlaying) return;
        // Skip for timed/survival/findAll - they have their own end conditions
        if (activeChallenge?.type === "timed" || activeChallenge?.type === "survival" || activeChallenge?.type === "findAll") return;
        if (sessionTotal < progressTarget) return;
        if (challengeStopRef.current) return;

        challengeStopRef.current = true;
        finalizeSession();
    }, [activeChallenge?.type, finalizeSession, isPlaying, progressTarget, sessionTotal]);

    const handleStopSession = () => {
        challengeStopRef.current = true;
        finalizeSession();
    };

    const handlePause = () => setIsPaused(true);
    const handleResume = () => setIsPaused(false);
    const handleHint = () => {
        if (hintUsedForPrompt || Boolean(lastAnswer)) return;
        applyHintPenalty();
        setHintPromptKey(currentPromptKey);
    };

    const handleSummaryClose = () => {
        setShowSummary(false);
        setSessionStats(null);
        if (enteredViaCatalogRef.current) {
            navigate("/train", { replace: true });
        }
    };

    const handleRestart = () => {
        setShowSummary(false);
        setSessionStats(null);
        setHintPromptKey(null);
        maxStreakRef.current = 0;
        prevXpStreakRef.current = 0;
        prevWarningStreakRef.current = 0;
        setFindAllFoundKeys([]);
        challengeStopRef.current = false;
        if (activeChallenge?.type === "findAll" && activeChallenge.targetNote) {
            setForcedTargetNote(activeChallenge.targetNote);
        } else {
            setForcedTargetNote(null);
        }
        setChallengeSecondsLeft(activeChallenge?.type === "timed" ? (activeChallenge.timeLimitSec ?? 60) : null);
        setTimeout(() => startGame(), 100);
    };
    const handleFocusWeakSpots = () => {
        const weakestEntry = Object.entries(positionStats)
            .filter(([, stats]) => stats.total >= 3)
            .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))[0];

        if (weakestEntry) {
            const [key] = weakestEntry;
            const [stringIndex, fret] = key.split("-").map(Number);
            const focusedStrings = Array.from({ length: tuning.length }, (_, index) => index === stringIndex);
            setMode("fretboardToNote");
            setPracticeConstraints({
                fretRange: { min: Math.max(1, fret - 1), max: Math.min(12, fret + 1) },
                enabledStrings: focusedStrings,
            });
            setActiveChallenge(null);
            setChallengeSecondsLeft(null);
        }

        handleRestart();
    };

    const xpEarned = sessionStats ? sessionStats.correct * 10 + Math.max(0, (sessionStats.maxStreak - 1) * sessionStats.maxStreak) : 0;

    // Focus Mode Active UI
    if (isPlaying) {
        return (
            <>
                <FocusModeHUD
                    isPlaying={isPlaying}
                    score={score}
                    streak={streak}
                    correct={sessionCorrect}
                    incorrect={sessionIncorrect}
                    bpm={bpm}
                    noteDuration={noteDuration}
                    modeLabel={modeLabel}
                    sessionStartTime={sessionStartTime}
                    onPause={handlePause}
                    onResume={handleResume}
                    onStop={handleStopSession}
                    isPaused={isPaused}
                    progressCurrent={sessionTotal}
                    progressTarget={progressTarget}
                    onHeightChange={setHudHeight}
                />
                <XPToast
                    xp={toast.xp}
                    streak={toast.streak}
                    type={toast.type}
                    message={toast.message}
                    isVisible={shouldShowToast}
                    onClose={hideToast}
                />
                <AriaLiveAnnouncer message={feedbackMessage} />
                {activeChallenge && (
                    <div
                        className="fixed left-1/2 z-40 -translate-x-1/2 rounded-full border border-primary/40 bg-card/90 px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-md"
                        style={{ top: `${safeHudHeight + 8}px` }}
                    >
                        <span className="text-primary">{activeChallenge.label}</span>
                        {activeChallenge.type === "timed" && (
                            <span className="ml-2 font-mono text-foreground">{challengeSecondsLeft ?? activeChallenge.timeLimitSec ?? 60}s</span>
                        )}
                        {activeChallenge.type === "survival" && (
                            <span className="ml-2 text-foreground">No mistakes</span>
                        )}
                        {activeChallenge.type === "findAll" && (
                            <span className="ml-2 font-mono text-foreground">
                                {findAllFoundKeys.length}/{findAllTargetCount || "?"}
                            </span>
                        )}
                    </div>
                )}
                <div className={cn("fixed inset-0 z-40 bg-background flex flex-col", isPaused && "blur-sm")}>
                    {/* Header Space for HUD */}
                    <div className="shrink-0" style={{ height: `${safeHudHeight}px` }} />

                    {/* Main Immersive Workspace */}
                    <div className={cn(
                        "flex-1 w-full relative flex items-center justify-center overflow-x-hidden",
                        isFretboardGuessMode ? "overflow-y-auto" : "overflow-hidden"
                    )}>
                        {/* Background ambience */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
                        <div
                            className={cn(
                                "w-full max-w-[1400px] px-4 md:px-8 flex",
                                isFretboardGuessMode
                                    ? "flex-col items-center justify-start gap-1.5 pt-1 md:pt-3"
                                    : "items-center justify-center"
                            )}
                        >
                            {isFretboardGuessMode && (
                                <div className="w-full shrink-0 flex flex-col items-center gap-1.5">
                                    <div className="w-full overflow-x-auto pb-1">
                                        <div className="mx-auto inline-flex min-w-max items-center gap-1 rounded-full border border-border/50 bg-card/85 p-1 backdrop-blur-md shadow-md">
                                            {LAYER_OPTIONS.map((layer) => (
                                                <Button
                                                    key={layer.id}
                                                    type="button"
                                                    size="sm"
                                                    variant={focusLayer === layer.id ? "secondary" : "ghost"}
                                                    className={cn(
                                                        "h-7 rounded-full px-2.5 text-[11px] md:h-8 md:px-3 md:text-xs",
                                                        focusLayer === layer.id && "text-primary border border-primary/20"
                                                    )}
                                                    onClick={() => handleLayerChange(layer.id)}
                                                >
                                                    {layer.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    {(focusLayer === "scale" || focusLayer === "intervals") && (
                                        <div className="text-[11px] font-medium text-muted-foreground rounded-full bg-card/80 border border-border/40 px-3 py-1 backdrop-blur">
                                            Root: <span className="text-foreground font-semibold">{layerRootNote}</span> • Scale: <span className="text-foreground font-semibold">{layerScaleLabel}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {isFretboardGuessMode && (
                                <div className="w-full transition-all duration-500 ease-out animate-in zoom-in-95 fade-in">
                                    <Fretboard
                                        frets={12}
                                        activeLayer={focusLayer}
                                        activeNotes={activeNotes}
                                        tuning={tuning}
                                        leftHanded={leftHanded}
                                        className="max-w-full drop-shadow-2xl"
                                    />
                                </div>
                            )}
                            {moduleTab === "guess" && mode === "tabToNote" && (
                                <div className="w-full transition-all duration-500 ease-out animate-in slide-in-from-bottom-4 fade-in">
                                    <TabView tuning={tuning} position={targetPosition} leftHanded={leftHanded} className="w-full shadow-xl rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm" />
                                </div>
                            )}
                            {moduleTab === "guess" && mode === "noteToTab" && (
                                <div className="w-full max-w-md mx-auto text-center animate-in zoom-in-90 fade-in duration-500">
                                    <div className="text-xs text-muted-foreground font-semibold tracking-wider uppercase mb-8">Target Note</div>
                                    <div className="text-[12rem] font-black text-primary leading-none transition-all drop-shadow-2xl">
                                        {targetNote ?? "?"}
                                    </div>
                                    <div className="mt-12 text-lg text-muted-foreground/80 font-light">Pick the matching tab position below</div>
                                </div>
                            )}
                            {moduleTab === "play" && mode === "playNotes" && (
                                <div className="w-full max-w-md mx-auto text-center animate-in zoom-in-90 fade-in duration-500">
                                    <div className="text-xs text-muted-foreground font-semibold tracking-wider uppercase mb-8">Play This Note</div>
                                    <div className="text-[12rem] font-black text-primary leading-none transition-all drop-shadow-2xl">{targetNote ?? "?"}</div>
                                    <div className="mt-12 flex items-center justify-center gap-6 text-base text-muted-foreground">
                                        <span className="rounded-full border border-border/50 bg-background/40 px-6 py-2 backdrop-blur-md shadow-sm">
                                            Next: <span className="font-mono text-foreground font-bold">{nextNote ?? "--"}</span>
                                        </span>
                                        <span className="rounded-full border border-border/50 bg-background/40 px-6 py-2 backdrop-blur-md shadow-sm">
                                            Mic: <span className={cn("font-mono font-bold transition-colors", micEnabled ? "text-emerald-500" : "")}>{micEnabled ? detectedNote ?? "--" : "Off"}</span>
                                        </span>
                                    </div>
                                </div>
                            )}
                            {moduleTab === "play" && mode === "playTab" && (
                                <div className="w-full max-w-6xl mx-auto backdrop-blur-sm bg-background/30 p-8 rounded-3xl border border-border/20 shadow-2xl">
                                    <div className="grid gap-12 lg:grid-cols-2 items-center">
                                        <div className="relative group">
                                            <div
                                                className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-32 rounded-full bg-primary"
                                                style={{ boxShadow: "0 0 15px hsl(var(--primary) / 0.5)" }}
                                            />
                                            <div className="text-xs text-primary font-bold tracking-[0.2em] uppercase mb-4 pl-2 opacity-80">Current</div>
                                            <TabView tuning={tuning} position={targetPosition} leftHanded={leftHanded} className="w-full max-w-none shadow-lg scale-105 transition-transform" />
                                            {targetPosition && <div className="mt-4 text-base font-medium text-muted-foreground pl-2">{stringLabels[targetPosition.stringIndex]} string, fret <span className="font-mono text-foreground text-lg">{targetPosition.fret}</span></div>}
                                        </div>
                                        <div className="opacity-50 scale-95 origin-left blur-[1px] transition-all group-hover:blur-0 group-hover:opacity-70">
                                            <div className="text-xs text-muted-foreground font-bold tracking-[0.2em] uppercase mb-4 pl-2">Next</div>
                                            <TabView tuning={tuning} position={nextPosition} leftHanded={leftHanded} className="w-full max-w-none grayscale" />
                                            {nextPosition && <div className="mt-4 text-base text-muted-foreground pl-2">{stringLabels[nextPosition.stringIndex]} string, fret <span className="font-mono text-foreground">{nextPosition.fret}</span></div>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Controls Area */}
                    <div className="shrink-0 w-full bg-gradient-to-t from-background via-background/95 to-transparent pt-3 md:pt-8 pb-16 md:pb-8 px-4 z-20">
                        <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                            {/* Feedback Text */}
                            <div className="h-7 flex items-center justify-center text-lg md:text-xl font-medium tracking-tight" aria-live="polite">
                                <span className={cn(
                                    "transition-all duration-300",
                                    feedbackMessage?.includes("Correct") && "text-emerald-500 font-bold scale-110",
                                    feedbackMessage?.includes("Incorrect") && "text-rose-500 font-bold shake",
                                    feedbackMessage?.includes("Too slow") && "text-rose-500 font-bold animate-pulse-subtle",
                                    !feedbackMessage?.includes("Correct") && !feedbackMessage?.includes("Incorrect") && !feedbackMessage?.includes("Too slow") && "text-muted-foreground/60"
                                )}>
                                    {feedbackMessage ?? "Identify the note!"}
                                </span>
                            </div>

                            {/* Controls */}
                            {moduleTab === "guess" && (mode === "fretboardToNote" || mode === "tabToNote") && (
                                <NoteAnswerButtons
                                    noteOptions={noteOptions}
                                    targetNote={targetPosition?.note}
                                    selectedNote={selectedGuessNote}
                                    isLocked={Boolean(lastAnswer)}
                                    isCorrect={lastAnswer?.correct}
                                    isPlaying={isPlaying}
                                    onSubmit={submitNoteGuess}
                                />
                            )}
                            {moduleTab === "guess" && mode === "noteToTab" && (
                                <PositionAnswerButtons
                                    options={noteToTabOptions}
                                    targetPosition={targetPosition ?? undefined}
                                    lastAnswerPosition={lastAnswer?.position}
                                    isLocked={Boolean(lastAnswer)}
                                    isCorrect={lastAnswer?.correct}
                                    isPlaying={isPlaying}
                                    stringLabels={stringLabels}
                                    tuning={tuning}
                                    leftHanded={leftHanded}
                                    onSubmit={handlePositionGuess}
                                />
                            )}
                            {manualAdvanceRequired && (
                                <NextButton onNext={advanceAfterAnswer} />
                            )}
                            {moduleTab === "guess" && !lastAnswer && (
                                <HintButton onHint={handleHint} hintUsed={hintUsedForPrompt} />
                            )}
                            {moduleTab === "play" && (
                                <PlayModeMicControls micEnabled={micEnabled} onMicChange={setMicEnabled} />
                            )}
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Setup Mode UI
    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Practice</h1>
                <p className="text-muted-foreground mt-1">
                    Select a mode and configure your session
                </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Main Workspace - Col Span 2 */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Mode Selection */}
                    <div className="flex items-center gap-3 bg-muted/20 p-1 rounded-lg border border-border/40 w-fit">
                        <Button type="button" size="sm" variant={moduleTab === "guess" ? "secondary" : "ghost"} className="h-8 px-4 text-xs font-semibold" onClick={() => handleSwitchModule("guess")}>
                            Guess Note
                        </Button>
                        <Button type="button" size="sm" variant={moduleTab === "play" ? "secondary" : "ghost"} className="h-8 px-4 text-xs font-semibold" onClick={() => handleSwitchModule("play")}>
                            Play Practice
                        </Button>
                    </div>

                    {moduleTab === "guess" ? (
                        <Tabs value={mode as GuessMode} onValueChange={handleGuessModeChange} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 bg-muted/40 h-10">
                                <TabsTrigger value="fretboardToNote">Fretboard → Note</TabsTrigger>
                                <TabsTrigger value="tabToNote">Tab → Note</TabsTrigger>
                                <TabsTrigger value="noteToTab">Note → Tab</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    ) : (
                        <Tabs value={mode as PlayMode} onValueChange={handlePlayModeChange} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-muted/40 h-10">
                                <TabsTrigger value="playNotes">Note Names</TabsTrigger>
                                <TabsTrigger value="playTab">Tab Sequence</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}

                    {/* Live Preview Card */}
                    <Card className="min-h-[300px] flex flex-col justify-center overflow-hidden bg-card/60">
                        <div className="p-6 md:p-8 flex items-center justify-center w-full">
                            {/* Fretboard Preview */}
                            {moduleTab === "guess" && mode === "fretboardToNote" && (
                                <div className="w-full opacity-90 pointer-events-none scale-95 origin-center">
                                    <Fretboard
                                        frets={12}
                                        activeNotes={[{ position: { stringIndex: 2, fret: 5, note: 'C' }, status: 'active', label: '?' }]}
                                        tuning={tuning}
                                        leftHanded={leftHanded}
                                        className="max-w-full"
                                    />
                                </div>
                            )}

                            {/* Tab Preview */}
                            {(mode === "tabToNote" || mode === "playTab") && (
                                <div className="w-full max-w-xl mx-auto opacity-90">
                                    <TabView tuning={tuning} position={{ stringIndex: 1, fret: 3, note: 'D' }} leftHanded={leftHanded} className="w-full scale-110 origin-center" />
                                </div>
                            )}

                            {/* Big Note Preview */}
                            {(mode === "noteToTab" || mode === "playNotes") && (
                                <div className="text-center space-y-4 py-8">
                                    <div className="text-xs text-muted-foreground font-semibold tracking-wider uppercase">Target</div>
                                    <div className="text-9xl font-black text-primary/80 animate-pulse-slow">A</div>
                                    {mode === "playNotes" && (
                                        <div className="flex gap-2 justify-center mt-4">
                                            <span className="text-sm font-mono bg-muted px-2 py-1 rounded">Next: C#</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Settings & Controls - Moved here for Mobile Consistency */}
                    <Card>
                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-sm font-medium">Tempo</Label>
                                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{bpm} BPM</span>
                                    </div>
                                    <Switch checked={isMetronomeArmed} onCheckedChange={toggleMetronome} />
                                </div>
                                <Slider value={[bpm]} onValueChange={([v]) => setBpm(v)} min={30} max={200} step={5} className="w-full" />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-sm font-medium">Note Duration</Label>
                                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                            {noteDuration} beat{noteDuration > 1 ? "s" : ""}
                                        </span>
                                    </div>
                                </div>
                                <Slider value={[noteDuration]} onValueChange={([v]) => setNoteDuration(v)} min={1} max={16} step={1} className="w-full" />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MapIcon className="w-4 h-4 text-muted-foreground" />
                                    <Label htmlFor="heatmap-toggle" className="text-sm cursor-pointer">Heat Map Overlay</Label>
                                </div>
                                <Switch id="heatmap-toggle" checked={heatMapEnabled} onCheckedChange={toggleHeatMap} />
                            </div>

                            {moduleTab === "play" && (
                                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                    <div className="flex items-center gap-2">
                                        <Mic className="w-4 h-4 text-muted-foreground" />
                                        <Label htmlFor="mic-toggle" className="text-sm cursor-pointer">Microphone</Label>
                                    </div>
                                    <Switch id="mic-toggle" checked={micEnabled} onCheckedChange={setMicEnabled} />
                                </div>
                            )}

                            <Button size="lg" className="w-full control-btn--primary font-bold text-base shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all" onClick={handleStartClick}>
                                <Play className="mr-2 h-5 w-5 fill-current" /> Start Practice
                            </Button>
                        </div>
                    </Card>
                </div>

                {/* Sidebar - Col Span 1 */}
                <div className="space-y-6">
                    {/* Instructions Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Instructions</CardTitle>
                        </CardHeader>
                        <div className="px-6 pb-6">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {mode === "fretboardToNote" && "Identify the note shown on the highlighted fretboard position. Select the correct note name from the options."}
                                {mode === "tabToNote" && "Read the guitar tablature and identify the corresponding note name. Great for improving sight-reading."}
                                {mode === "noteToTab" && "Find the correct position on the fretboard for the given note. You'll see a string and fret to select."}
                                {mode === "playNotes" && "Use your microphone! The app listens as you play the displayed note on your real guitar."}
                                {mode === "playTab" && "Sight-read and play the tablature sequence on your instrument. The app verifies your pitch in real-time."}
                            </p>
                        </div>
                    </Card>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <Card className="p-4 flex flex-col items-center justify-center bg-muted/20">
                            <Flame className="w-6 h-6 text-amber-700 dark:text-amber-300 mb-2" />
                            <div className="text-2xl font-bold">{streakDays}</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Day Streak</div>
                        </Card>
                        <Card className="p-4 flex flex-col items-center justify-center bg-muted/20">
                            <Target className="w-6 h-6 text-primary mb-2" />
                            <div className={cn("text-2xl font-bold", overallAccuracy >= 75 ? "text-emerald-600 dark:text-emerald-400" : overallAccuracy >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400")}>
                                {overallAccuracy}%
                            </div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Accuracy</div>
                        </Card>
                        <Card className="col-span-2 p-3 flex items-center justify-between bg-muted/20">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Time Practiced</span>
                            </div>
                            <div className="font-bold font-mono">{Math.floor(totalPracticeTime / 60)}h {totalPracticeTime % 60}m</div>
                        </Card>
                    </div>

                </div>
            </div>




            <PreFlightModal
                isOpen={isPreFlightOpen}
                onClose={handlePreFlightClose}
                onStart={handlePreFlightStart}
                mode={mode}
                bpm={bpm}
                onBpmChange={setBpm}
                noteDuration={noteDuration}
                onNoteDurationChange={setNoteDuration}
                isMetronomeOn={isMetronomeArmed}
                onMetronomeToggle={toggleMetronome}
                fretRange={practiceConstraints.fretRange}
                tuning={tuning}
                onFretRangeChange={(range) => setPracticeConstraints({ fretRange: range })}
                enabledStrings={practiceConstraints.enabledStrings}
                onStringToggle={togglePracticeString}
                noteFilter={practiceConstraints.noteFilter}
                onNoteFilterChange={(noteFilter) => setPracticeConstraints({ noteFilter })}
                rootNote={practiceConstraints.rootNote}
                onRootNoteChange={(rootNote) => setPracticeConstraints({ rootNote })}
                scaleType={practiceConstraints.scaleType}
                onScaleTypeChange={(scaleType) => setPracticeConstraints({ scaleType })}
                onApplyPreset={(preset) => setPracticeConstraints(preset)}
            />
            <SessionSummaryModal
                isOpen={showSummary}
                onClose={handleSummaryClose}
                onRestart={handleRestart}
                onFocusWeakSpots={handleFocusWeakSpots}
                stats={sessionStats}
                xpEarned={xpEarned}
            />
        </div >
    );
}

import { create } from 'zustand';
import { NOTES, getNoteAt } from '@/lib/constants';
import { useProgressStore } from './useProgressStore';
import type { Position, NoteName } from '@/types/fretboard';
import type { PracticeScaleType } from '@/types/settings';
import { useSettingsStore } from './useSettingsStore';
import { normalizeTuning } from '@/lib/tuning';

type PracticeMode = 'fretboardToNote' | 'tabToNote' | 'noteToTab' | 'playNotes' | 'playTab';
export type NoteFilter = 'all' | 'naturals';
export type ScaleType = PracticeScaleType;

interface PracticeConstraints {
    fretRange: { min: number; max: number };
    enabledStrings: boolean[]; // High E -> Low E
    noteFilter: NoteFilter;
    rootNote: NoteName;
    scaleType: ScaleType;
}

interface OccurrenceOptions {
    minFret?: number;
    maxFret?: number;
    stringIndices?: number[];
}

const NATURAL_NOTES: NoteName[] = ["C", "D", "E", "F", "G", "A", "B"];
const SCALE_TYPES: ScaleType[] = ['major', 'minor', 'majorPentatonic', 'minorPentatonic'];
const DEFAULT_ROOT_NOTE: NoteName = "C";
const DEFAULT_SCALE_TYPE: ScaleType = "major";

function getActiveTuning(): NoteName[] {
    return normalizeTuning(useSettingsStore.getState().quick.tuning);
}

function getDefaultEnabledStrings(length: number = getActiveTuning().length): boolean[] {
    return Array.from({ length }, () => true);
}

function isGuessNoteMode(mode: PracticeMode): mode is 'fretboardToNote' | 'tabToNote' | 'noteToTab' {
    return mode === 'fretboardToNote' || mode === 'tabToNote' || mode === 'noteToTab';
}

interface GameState {
    isPlaying: boolean;
    score: number;
    streak: number;
    feedbackMessage: string | null;
    sessionStartTime: number | null;
    sessionCorrect: number;
    sessionIncorrect: number;

    mode: PracticeMode;
    targetNote: NoteName | null;
    targetPosition: Position | null;
    lastAnswer: { position: Position; correct: boolean; selectedNote?: NoteName } | null;
    noteOptions: NoteName[];
    noteToTabOptions: Position[];
    nextNote: NoteName | null;
    nextPosition: Position | null;
    playCycleAnswered: boolean;
    forcedTargetNote: NoteName | null;
    practiceConstraints: PracticeConstraints;

    // Metronome
    bpm: number;
    noteDuration: number;  // Cycle length in beats (original "Note Duration")
    noteTickCounter: number;  // Current beat position in cycle
    isMetronomeOn: boolean;  // Actually ticking
    isMetronomeArmed: boolean;  // User enabled, will start with session
    metronomeInterval: number | null;

    // Acceleration
    speedUpEnabled: boolean;
    speedUpAmount: number;  // BPM to add
    speedUpInterval: number;  // Every X beats
    speedUpTickCounter: number;

    // Actions
    setMode: (mode: PracticeMode) => void;
    setBpm: (bpm: number) => void;
    setNoteDuration: (duration: number) => void;
    setPracticeConstraints: (next: Partial<PracticeConstraints>) => void;
    setForcedTargetNote: (note: NoteName | null) => void;
    togglePracticeString: (stringIndex: number) => void;
    startGame: () => void;
    stopGame: () => void;
    submitNoteGuess: (note: NoteName) => void;
    submitPositionGuess: (pos: Position) => void;
    submitDetectedNote: (note: NoteName) => void;
    applyHintPenalty: () => void;
    generateNewTarget: () => void;
    advanceAfterAnswer: () => void;
    toggleMetronome: () => void;
    tickMetronome: () => void;
    setSpeedUpEnabled: (enabled: boolean) => void;
    setSpeedUpAmount: (amount: number) => void;
    setSpeedUpInterval: (interval: number) => void;
}

const SETTINGS_STORAGE_KEY = 'fretmemo-settings-v2';
const DEFAULT_FRET_RANGE = { min: 1, max: 12 };

function clampFretRange(min: number, max: number, frets: number = 12): { min: number; max: number } {
    const safeMin = Math.max(1, Math.min(frets, Math.round(min)));
    const safeMax = Math.max(1, Math.min(frets, Math.round(max)));
    return safeMin <= safeMax ? { min: safeMin, max: safeMax } : { min: safeMax, max: safeMin };
}

function normalizePracticeConstraints(
    constraints: Partial<PracticeConstraints> | PracticeConstraints
): PracticeConstraints {
    const tuningLength = getActiveTuning().length;
    const rawEnabled = Array.isArray(constraints.enabledStrings) ? constraints.enabledStrings : getDefaultEnabledStrings(tuningLength);
    const enabledStrings = rawEnabled
        .slice(0, tuningLength)
        .map((value) => Boolean(value));

    while (enabledStrings.length < tuningLength) {
        enabledStrings.push(true);
    }
    if (enabledStrings.length > 0 && !enabledStrings.some(Boolean)) {
        enabledStrings[enabledStrings.length - 1] = true;
    }

    const rawRange = constraints.fretRange ?? DEFAULT_FRET_RANGE;
    const fretRange = clampFretRange(rawRange.min, rawRange.max, 12);
    const rootNote = NOTES.includes(constraints.rootNote as NoteName)
        ? (constraints.rootNote as NoteName)
        : DEFAULT_ROOT_NOTE;
    const scaleType = SCALE_TYPES.includes(constraints.scaleType as ScaleType)
        ? (constraints.scaleType as ScaleType)
        : DEFAULT_SCALE_TYPE;

    return {
        fretRange,
        enabledStrings,
        noteFilter: constraints.noteFilter === 'naturals' ? 'naturals' : 'all',
        rootNote,
        scaleType,
    };
}

function getEnabledStringIndices(enabledStrings: boolean[]): number[] {
    const tuningLength = getActiveTuning().length;
    const indices = enabledStrings
        .map((enabled, index) => (enabled ? index : -1))
        .filter((index) => index >= 0);

    if (indices.length > 0) return indices;
    return Array.from({ length: tuningLength }, (_, index) => index);
}

function getAllowedNotePool(noteFilter: NoteFilter): NoteName[] {
    return noteFilter === 'naturals' ? NATURAL_NOTES : NOTES;
}

function getOccurrenceOptions(constraints: PracticeConstraints, frets: number = 12): OccurrenceOptions {
    const normalized = normalizePracticeConstraints(constraints);
    const fretRange = clampFretRange(normalized.fretRange.min, normalized.fretRange.max, frets);
    return {
        minFret: fretRange.min,
        maxFret: fretRange.max,
        stringIndices: getEnabledStringIndices(normalized.enabledStrings),
    };
}

function getAvailableNotesForConstraints(constraints: PracticeConstraints): NoteName[] {
    const options = getOccurrenceOptions(constraints, 12);
    const tuning = getActiveTuning();
    return getAllowedNotePool(constraints.noteFilter).filter((note) => getAllOccurrences(note, 12, options, tuning).length > 0);
}

function pickWeighted<T>(items: T[], weights: number[]): T {
    if (items.length === 0) {
        throw new Error("pickWeighted requires at least one item.");
    }

    const total = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
    if (total <= 0) {
        return items[Math.floor(Math.random() * items.length)];
    }

    let roll = Math.random() * total;
    for (let index = 0; index < items.length; index += 1) {
        roll -= Math.max(0, weights[index]);
        if (roll <= 0) {
            return items[index];
        }
    }

    return items[items.length - 1];
}

function pickNoteByLearningPriority(
    pool: NoteName[],
    constraints: PracticeConstraints,
    tuning: NoteName[]
): NoteName {
    if (pool.length <= 1) {
        return pool[0] ?? NOTES[0];
    }

    const spacedRepetitionEnabled = Boolean(useSettingsStore.getState().full.learning.spacedRepetition);
    if (!spacedRepetitionEnabled) {
        return pool[Math.floor(Math.random() * pool.length)];
    }

    const stats = useProgressStore.getState().positionStats;
    const options = getOccurrenceOptions(constraints, 12);
    const now = Date.now();

    const weights = pool.map((note) => {
        const occurrences = getAllOccurrences(note, 12, options, tuning);
        if (occurrences.length === 0) return 0;

        let practicedCount = 0;
        let accuracySum = 0;
        let latestPracticeAgeDays = 30;
        let hasLastPractice = false;

        for (const occurrence of occurrences) {
            const key = `${occurrence.stringIndex}-${occurrence.fret}`;
            const positionStats = stats[key];
            if (!positionStats || positionStats.total <= 0) continue;

            practicedCount += 1;
            accuracySum += positionStats.correct / positionStats.total;

            if (positionStats.lastPracticed) {
                const ageMs = Math.max(0, now - Date.parse(positionStats.lastPracticed));
                const ageDays = ageMs / (1000 * 60 * 60 * 24);
                if (!hasLastPractice || ageDays < latestPracticeAgeDays) {
                    latestPracticeAgeDays = ageDays;
                }
                hasLastPractice = true;
            }
        }

        const unpracticedRatio = 1 - practicedCount / occurrences.length;
        const avgAccuracy = practicedCount > 0 ? accuracySum / practicedCount : 0.5;
        const weakness = 1 - avgAccuracy;
        const recencyBoost = hasLastPractice ? Math.min(1, latestPracticeAgeDays / 7) * 0.4 : 0.6;
        const explorationBoost = practicedCount === 0 ? 0.5 : 0;

        return Math.max(0.1, 0.5 + weakness * 1.6 + unpracticedRatio * 0.8 + recencyBoost + explorationBoost);
    });

    return pickWeighted(pool, weights);
}

function getInitialQuickSettings(): { tempo: number; isMetronomeOn: boolean; fretRange: { min: number; max: number }; rootNote: NoteName; scaleType: ScaleType } | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        const quick = parsed?.state?.quick;
        if (!quick) return null;

        const tempo = typeof quick.tempo === 'number' ? quick.tempo : 60;
        const rawMin = typeof quick.fretRange?.min === 'number' ? quick.fretRange.min : DEFAULT_FRET_RANGE.min;
        const rawMax = typeof quick.fretRange?.max === 'number' ? quick.fretRange.max : DEFAULT_FRET_RANGE.max;
        const fretRange = clampFretRange(rawMin, rawMax, 12);
        const rootNote = NOTES.includes(quick.practiceRootNote as NoteName)
            ? (quick.practiceRootNote as NoteName)
            : DEFAULT_ROOT_NOTE;
        const scaleType = SCALE_TYPES.includes(quick.practiceScaleType as ScaleType)
            ? (quick.practiceScaleType as ScaleType)
            : DEFAULT_SCALE_TYPE;
        return {
            tempo: Math.max(30, Math.min(280, Math.round(tempo))),
            isMetronomeOn: Boolean(quick.isMetronomeOn),
            fretRange,
            rootNote,
            scaleType,
        };
    } catch {
        return null;
    }
}

const initialQuick = getInitialQuickSettings();
const initialPracticeConstraints = normalizePracticeConstraints({
    fretRange: initialQuick?.fretRange ?? DEFAULT_FRET_RANGE,
    enabledStrings: getDefaultEnabledStrings(),
    noteFilter: 'all',
    rootNote: initialQuick?.rootNote ?? DEFAULT_ROOT_NOTE,
    scaleType: initialQuick?.scaleType ?? DEFAULT_SCALE_TYPE,
});

function getPromptForMode(mode: PracticeMode): string {
    switch (mode) {
        case 'fretboardToNote':
        case 'tabToNote':
            return 'Identify the note!';
        case 'noteToTab':
            return 'Pick the correct tab position!';
        case 'playNotes':
            return 'Play the note (mic)!';
        case 'playTab':
            return 'Play the tab sequence (mic)!';
    }
}

function shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function getAllOccurrences(
    note: NoteName,
    frets: number = 12,
    options: OccurrenceOptions = {},
    tuning: NoteName[] = getActiveTuning()
): Position[] {
    const stringIndices = Array.isArray(options.stringIndices) && options.stringIndices.length > 0
        ? options.stringIndices.filter((idx) => idx >= 0 && idx < tuning.length)
        : tuning.map((_, index) => index);
    const range = clampFretRange(options.minFret ?? 1, options.maxFret ?? frets, frets);

    const occurrences: Position[] = [];
    for (const stringIndex of stringIndices) {
        const openNote = tuning[stringIndex];
        for (let fret = range.min; fret <= range.max; fret++) {
            const noteName = getNoteAt(openNote, fret);
            if (noteName === note) {
                occurrences.push({ stringIndex, fret, note: noteName });
            }
        }
    }
    return occurrences;
}

function pickClosestPosition(
    currentPos: Position,
    targetNote: NoteName,
    frets: number = 12,
    options: OccurrenceOptions = {},
    tuning: NoteName[] = getActiveTuning()
): Position | null {
    const occurrences = getAllOccurrences(targetNote, frets, options, tuning);
    if (occurrences.length === 0) return null;

    // Prefer a different string for better technique variety
    const differentString = occurrences.filter(p => p.stringIndex !== currentPos.stringIndex);
    const candidates = differentString.length > 0 ? differentString : occurrences;

    let best = candidates[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
        const dist = Math.abs(candidate.stringIndex - currentPos.stringIndex) + Math.abs(candidate.fret - currentPos.fret);
        if (dist < bestDistance) {
            best = candidate;
            bestDistance = dist;
        }
    }

    return best;
}

export const useGameStore = create<GameState>((set, get) => ({
    isPlaying: false,
    score: 0,
    streak: 0,
    feedbackMessage: null,
    sessionStartTime: null,
    sessionCorrect: 0,
    sessionIncorrect: 0,
    mode: 'fretboardToNote',
    targetNote: null,
    targetPosition: null,
    lastAnswer: null,
    noteOptions: [],
    noteToTabOptions: [],
    nextNote: null,
    nextPosition: null,
    playCycleAnswered: false,
    forcedTargetNote: null,
    practiceConstraints: initialPracticeConstraints,
    bpm: initialQuick?.tempo ?? 60,
    noteDuration: 1,
    noteTickCounter: 0,
    isMetronomeOn: false,
    isMetronomeArmed: initialQuick?.isMetronomeOn ?? false,
    metronomeInterval: null,
    speedUpEnabled: false,
    speedUpAmount: 5,
    speedUpInterval: 8,
    speedUpTickCounter: 0,

    setMode: (mode) => set({
        mode,
        isPlaying: false,
        score: 0,
        streak: 0,
        targetNote: null,
        targetPosition: null,
        noteOptions: [],
        noteToTabOptions: [],
        nextNote: null,
        nextPosition: null,
        playCycleAnswered: false,
        forcedTargetNote: null,
        sessionCorrect: 0,
        sessionIncorrect: 0,
        noteTickCounter: 0,
        isMetronomeOn: false,
        metronomeInterval: null
    }),

    setBpm: (bpm) => {
        const nextBpm = Math.max(30, Math.min(280, bpm));
        set({ bpm: nextBpm });
        useSettingsStore.getState().updateQuickSettings({ tempo: nextBpm });
    },
    setNoteDuration: (duration) => set({ noteDuration: Math.max(1, Math.min(16, Math.round(duration))) }),
    setPracticeConstraints: (next) =>
        set((state) => {
            const normalized = normalizePracticeConstraints({
                ...state.practiceConstraints,
                ...next,
            });
            useSettingsStore.getState().updateQuickSettings({
                fretRange: normalized.fretRange,
                practiceRootNote: normalized.rootNote,
                practiceScaleType: normalized.scaleType,
            });
            return { practiceConstraints: normalized };
        }),
    setForcedTargetNote: (note) =>
        set({
            forcedTargetNote: note && NOTES.includes(note) ? note : null,
        }),
    togglePracticeString: (stringIndex) =>
        set((state) => {
            const tuningLength = getActiveTuning().length;
            if (stringIndex < 0 || stringIndex >= tuningLength) {
                return {};
            }

            const nextEnabled = [...state.practiceConstraints.enabledStrings];
            nextEnabled[stringIndex] = !nextEnabled[stringIndex];
            if (!nextEnabled.some(Boolean)) {
                return {};
            }

            return {
                practiceConstraints: normalizePracticeConstraints({
                    ...state.practiceConstraints,
                    enabledStrings: nextEnabled,
                }),
            };
        }),

    startGame: () => {
        const { mode, isMetronomeArmed } = get();
        const isPlayMode = mode === 'playNotes' || mode === 'playTab';
        const deferPlayTargetToFirstBeat = isMetronomeArmed && isPlayMode;

        // Check streak when starting practice
        useProgressStore.getState().checkAndUpdateStreak();

        set({
            isPlaying: true,
            score: 0,
            streak: 0,
            lastAnswer: null,
            sessionStartTime: Date.now(),
            sessionCorrect: 0,
            sessionIncorrect: 0,
            feedbackMessage: getPromptForMode(mode),
            speedUpTickCounter: 0,
            noteTickCounter: 0,
            playCycleAnswered: false,
        });

        // Start metronome only if it was armed
        if (isMetronomeArmed) {
            set({ isMetronomeOn: true });
            get().tickMetronome();
        }

        // In Play Practice with metronome ON, the first target appears on beat 1.
        if (!deferPlayTargetToFirstBeat) {
            get().generateNewTarget();
        }
    },

    stopGame: () => {
        const {
            sessionStartTime,
            sessionCorrect,
            sessionIncorrect,
        } = get();
        const durationSeconds = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;

        // Update practice time
        if (sessionStartTime) {
            const minutes = Math.floor(durationSeconds / 60);
            if (minutes > 0) {
                useProgressStore.getState().updatePracticeTime(minutes);
            }
        }

        useProgressStore.getState().recordSession({
            startedAt: sessionStartTime,
            correct: sessionCorrect,
            incorrect: sessionIncorrect,
            durationSeconds,
        });

        // Clear metronome interval if running
        const { metronomeInterval } = get();
        if (metronomeInterval) {
            clearTimeout(metronomeInterval);
        }

        set({
            isPlaying: false,
            targetNote: null,
            targetPosition: null,
            noteOptions: [],
            noteToTabOptions: [],
            nextNote: null,
            nextPosition: null,
            feedbackMessage: null,  // Clear to prevent erroneous popups
            isMetronomeOn: false,
            metronomeInterval: null,
            sessionStartTime: null,
            speedUpTickCounter: 0,
            noteTickCounter: 0,
            playCycleAnswered: false,
        });
    },

    toggleMetronome: () => {
        const { isMetronomeArmed, isPlaying, metronomeInterval, mode } = get();
        const isPlayMode = mode === 'playNotes' || mode === 'playTab';

        if (isMetronomeArmed) {
            // Disarm metronome
            if (metronomeInterval) {
                clearTimeout(metronomeInterval);
            }
            set({
                isMetronomeArmed: false,
                isMetronomeOn: false,
                metronomeInterval: null,
                noteTickCounter: 0,
                speedUpTickCounter: 0,
            });
            useSettingsStore.getState().updateQuickSettings({ isMetronomeOn: false });
        } else {
            // Arm metronome - only start ticking if already playing
            set({ isMetronomeArmed: true });
            if (isPlaying) {
                // Prime play modes so enabling metronome mid-session does not immediately count a miss.
                set({
                    isMetronomeOn: true,
                    noteTickCounter: 0,
                    speedUpTickCounter: 0,
                    playCycleAnswered: isPlayMode ? true : get().playCycleAnswered
                });
                get().tickMetronome();
            }
            useSettingsStore.getState().updateQuickSettings({ isMetronomeOn: true });
        }
    },

    tickMetronome: () => {
        const {
            bpm,
            isMetronomeOn,
            mode,
            targetNote,
            targetPosition,
            lastAnswer,
            sessionIncorrect,
            speedUpEnabled,
            speedUpAmount,
            speedUpInterval,
            speedUpTickCounter,
            noteDuration,
            noteTickCounter,
            playCycleAnswered,
        } = get();

        if (!isMetronomeOn) return;
        const isCycleStart = noteTickCounter === 0;

        // Play tick sound
        const AudioContextCtor =
            window.AudioContext ||
            (window as unknown as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;

        const audioContext = new AudioContextCtor();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Accent the first beat of each note-duration cycle.
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(isCycleStart ? 1040 : 760, audioContext.currentTime);
        gainNode.gain.setValueAtTime(isCycleStart ? 0.14 : 0.08, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.05);

        // Handle acceleration
        let newBpm = bpm;
        let newCounter = speedUpTickCounter + 1;

        if (speedUpEnabled && newCounter >= speedUpInterval) {
            newCounter = 0;
            newBpm = Math.min(280, bpm + speedUpAmount);
        }

        const nextNoteTickCounter = noteTickCounter + 1 >= noteDuration ? 0 : noteTickCounter + 1;
        set({ bpm: newBpm, speedUpTickCounter: newCounter, noteTickCounter: nextNoteTickCounter });

        // Original behavior for Guess Note with metronome:
        // at each cycle boundary, unanswered question counts as miss, then next question appears.
        if (isGuessNoteMode(mode) && nextNoteTickCounter === 0) {
            const unanswered = !lastAnswer;
            if (unanswered && targetPosition) {
                useProgressStore.getState().recordAnswer(targetPosition, false);
                set({
                    streak: 0,
                    sessionIncorrect: sessionIncorrect + 1,
                    feedbackMessage: "Too slow!",
                });
            } else {
                set({ feedbackMessage: getPromptForMode(mode) });
            }
            get().generateNewTarget();
        }

        // Play Practice: change note on the first beat of each cycle.
        if ((mode === 'playNotes' || mode === 'playTab') && isCycleStart) {
            const hasTarget = mode === 'playNotes' ? Boolean(targetNote) : Boolean(targetPosition);
            if (hasTarget && !playCycleAnswered) {
                set({
                    streak: 0,
                    sessionIncorrect: sessionIncorrect + 1,
                    feedbackMessage: "Too slow!",
                });
            } else {
                set({ feedbackMessage: getPromptForMode(mode) });
            }
            get().generateNewTarget();
        }

        // Schedule next tick with current (possibly updated) BPM
        const interval = setTimeout(() => {
            if (get().isMetronomeOn) {
                get().tickMetronome();
            }
        }, 60000 / newBpm);

        set({ metronomeInterval: interval as unknown as number });
    },

    generateNewTarget: () => {
        const { mode, practiceConstraints, forcedTargetNote } = get();
        const tuning = getActiveTuning();
        const normalizedConstraints = normalizePracticeConstraints(practiceConstraints);
        const occurrenceOptions = getOccurrenceOptions(normalizedConstraints, 12);
        const constrainedPool = getAvailableNotesForConstraints(normalizedConstraints);
        const fallbackPool = getAllowedNotePool(normalizedConstraints.noteFilter);
        const activeNotePool = constrainedPool.length > 0 ? constrainedPool : fallbackPool;
        const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
        const pickNote = (source: NoteName[], avoid?: NoteName | null): NoteName => {
            const candidates = avoid && source.length > 1
                ? source.filter((note) => note !== avoid)
                : source;
            const usable = candidates.length > 0 ? candidates : source;
            return pickNoteByLearningPriority(usable, normalizedConstraints, tuning);
        };

        if (mode === 'fretboardToNote' || mode === 'tabToNote') {
            const pool = activeNotePool.length > 0 ? activeNotePool : NOTES;
            const correctNote = forcedTargetNote && pool.includes(forcedTargetNote)
                ? forcedTargetNote
                : pickNote(pool);
            let occurrences = getAllOccurrences(correctNote, 12, occurrenceOptions, tuning);
            if (occurrences.length === 0) {
                occurrences = getAllOccurrences(correctNote, 12, {}, tuning);
            }
            const chosen = pickRandom(occurrences);

            const opts = new Set<NoteName>([correctNote]);
            const optionSource = activeNotePool.length >= 4 ? activeNotePool : NOTES;
            while (opts.size < 4) {
                opts.add(pickRandom(optionSource));
            }

            set({
                targetPosition: chosen,
                targetNote: correctNote,
                noteOptions: shuffle(Array.from(opts)),
                noteToTabOptions: [],
                nextNote: null,
                nextPosition: null,
                lastAnswer: null,
                playCycleAnswered: false,
            });
            return;
        }

        if (mode === 'noteToTab') {
            const pool = activeNotePool.length > 0 ? activeNotePool : NOTES;
            const target = forcedTargetNote && pool.includes(forcedTargetNote)
                ? forcedTargetNote
                : pickNote(pool);
            let occurrences = getAllOccurrences(target, 12, occurrenceOptions, tuning);
            if (occurrences.length === 0) {
                occurrences = getAllOccurrences(target, 12, {}, tuning);
            }
            const correct = pickRandom(occurrences);

            const options: Position[] = [correct];
            const seen = new Set([`${correct.stringIndex}-${correct.fret}`]);
            const allowedStrings = occurrenceOptions.stringIndices?.length
                ? occurrenceOptions.stringIndices
                : tuning.map((_, index) => index);
            const range = clampFretRange(occurrenceOptions.minFret ?? 1, occurrenceOptions.maxFret ?? 12, 12);

            let attempts = 0;
            while (options.length < 4 && attempts < 240) {
                attempts += 1;
                const stringIndex = pickRandom(allowedStrings);
                const fret = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
                const key = `${stringIndex}-${fret}`;
                if (seen.has(key)) continue;

                const openNote = tuning[stringIndex];
                const noteName = getNoteAt(openNote, fret);
                if (noteName === target) continue;

                seen.add(key);
                options.push({ stringIndex, fret, note: noteName });
            }

            while (options.length < 4 && attempts < 400) {
                attempts += 1;
                const stringIndex = Math.floor(Math.random() * tuning.length);
                const fret = Math.floor(Math.random() * 12) + 1;
                const key = `${stringIndex}-${fret}`;
                if (seen.has(key)) continue;

                const openNote = tuning[stringIndex];
                const noteName = getNoteAt(openNote, fret);
                if (noteName === target) continue;

                seen.add(key);
                options.push({ stringIndex, fret, note: noteName });
            }

            set({
                targetNote: target,
                targetPosition: correct,
                noteOptions: [],
                noteToTabOptions: shuffle(options),
                nextNote: null,
                nextPosition: null,
                lastAnswer: null,
                playCycleAnswered: false,
            });
            return;
        }

        if (mode === 'playNotes') {
            const current = get().targetNote;
            const existingNext = get().nextNote;
            const pool = activeNotePool.length > 0 ? activeNotePool : NOTES;
            const pickNext = (avoid?: NoteName | null) => {
                if (!avoid || pool.length <= 1) return pickNote(pool);
                return pickNote(pool, avoid);
            };

            const nextCurrent = existingNext ?? pickNext(current);
            const nextNext = pickNext(nextCurrent);

            set({
                targetNote: nextCurrent,
                nextNote: nextNext,
                targetPosition: null,
                nextPosition: null,
                noteOptions: [],
                noteToTabOptions: [],
                lastAnswer: null,
                playCycleAnswered: false,
            });
            return;
        }

        const currentPos = get().targetPosition;
        const existingNextPos = get().nextPosition;
        const pool = activeNotePool.length > 0 ? activeNotePool : NOTES;

        const pickPlayTabNote = (avoid?: NoteName | null) => {
            if (!avoid || pool.length <= 1) return pickNote(pool);
            return pickNote(pool, avoid);
        };

        const initPos = () => {
            for (let i = 0; i < 40; i += 1) {
                const note = pickPlayTabNote();
                const constrained = getAllOccurrences(note, 12, occurrenceOptions, tuning);
                if (constrained.length > 0) {
                    return pickRandom(constrained);
                }
            }

            const fallbackNote = pickRandom(NOTES);
            const fallbackOcc = getAllOccurrences(fallbackNote, 12, {}, tuning);
            return pickRandom(fallbackOcc);
        };

        const newCurrent = existingNextPos ?? currentPos ?? initPos();
        const desiredNextNote = pickPlayTabNote(newCurrent.note);
        const newNext =
            pickClosestPosition(newCurrent, desiredNextNote, 12, occurrenceOptions, tuning) ??
            pickClosestPosition(newCurrent, desiredNextNote, 12, {}, tuning) ??
            initPos();

        set({
            targetPosition: newCurrent,
            targetNote: newCurrent.note,
            nextPosition: newNext,
            nextNote: newNext.note,
            noteOptions: [],
            noteToTabOptions: [],
            lastAnswer: null,
            playCycleAnswered: false,
        });
    },

    advanceAfterAnswer: () => {
        const { isPlaying, lastAnswer, mode, generateNewTarget } = get();
        if (!isPlaying || !lastAnswer) return;

        set({
            lastAnswer: null,
            feedbackMessage: getPromptForMode(mode),
        });
        generateNewTarget();
    },

    submitNoteGuess: (note: NoteName) => {
        const { mode, targetPosition, score, streak, generateNewTarget, isMetronomeOn, lastAnswer } = get();
        if (!targetPosition) return;
        if ((mode === 'fretboardToNote' || mode === 'tabToNote') && lastAnswer) return;

        const actualNote = targetPosition.note;
        const isCorrect = note === actualNote;
        const isGuessMode = mode === 'fretboardToNote' || mode === 'tabToNote';
        const autoAdvanceEnabled = useSettingsStore.getState().full.learning.autoAdvance;
        const shouldAutoAdvanceByMetronome = isGuessMode && isMetronomeOn;
        const shouldAutoAdvanceByClick = isGuessMode && !isMetronomeOn && autoAdvanceEnabled;
        const isManualAdvanceMode = isGuessMode && !isMetronomeOn && !autoAdvanceEnabled;

        // Record to progress store
        useProgressStore.getState().recordAnswer(targetPosition, isCorrect);

        if (isCorrect) {
            const newStreak = streak + 1;

            if (newStreak === 20) {
                useProgressStore.getState().unlockAchievement('perfect_session');
            }

            set({
                score: score + 10 + (streak * 2),
                streak: newStreak,
                lastAnswer: { position: targetPosition, correct: true, selectedNote: note },
                sessionCorrect: get().sessionCorrect + 1,
                feedbackMessage: "Correct!"
            });
            if (shouldAutoAdvanceByClick) {
                setTimeout(() => {
                    set({ lastAnswer: null, feedbackMessage: getPromptForMode(mode) });
                    generateNewTarget();
                }, 700);
            } else if (!shouldAutoAdvanceByMetronome && !isManualAdvanceMode) {
                setTimeout(() => {
                    set({ lastAnswer: null, feedbackMessage: getPromptForMode(mode) });
                    generateNewTarget();
                }, 800);
            }
        } else {
            set({
                streak: 0,
                lastAnswer: { position: targetPosition, correct: false, selectedNote: note },
                sessionIncorrect: get().sessionIncorrect + 1,
                feedbackMessage: `Incorrect! It was ${actualNote}`
            });
            if (shouldAutoAdvanceByClick) {
                setTimeout(() => {
                    set({ lastAnswer: null, feedbackMessage: getPromptForMode(mode) });
                    generateNewTarget();
                }, 1200);
            } else if (!shouldAutoAdvanceByMetronome && !isManualAdvanceMode) {
                setTimeout(() => {
                    set({ lastAnswer: null });
                }, 1200);
            }
        }
    },

    submitPositionGuess: (pos: Position) => {
        const { mode, targetPosition, score, streak, generateNewTarget, isMetronomeOn, lastAnswer } = get();
        if (!targetPosition) return;
        if (mode === 'noteToTab' && lastAnswer) return;

        const isCorrect = pos.stringIndex === targetPosition.stringIndex && pos.fret === targetPosition.fret;
        const autoAdvanceEnabled = useSettingsStore.getState().full.learning.autoAdvance;
        const shouldAutoAdvanceByMetronome = mode === 'noteToTab' && isMetronomeOn;
        const shouldAutoAdvanceByClick = mode === 'noteToTab' && !isMetronomeOn && autoAdvanceEnabled;
        const isManualAdvanceMode = mode === 'noteToTab' && !isMetronomeOn && !autoAdvanceEnabled;

        // Record to progress store using the *target* position (consistent with other identify-style modes)
        useProgressStore.getState().recordAnswer(targetPosition, isCorrect);

        if (isCorrect) {
            const newStreak = streak + 1;

            if (newStreak === 20) {
                useProgressStore.getState().unlockAchievement('perfect_session');
            }

            set({
                score: score + 10 + (streak * 2),
                streak: newStreak,
                lastAnswer: { position: pos, correct: true },
                sessionCorrect: get().sessionCorrect + 1,
                feedbackMessage: "Correct!"
            });
            if (shouldAutoAdvanceByClick) {
                setTimeout(() => {
                    set({ lastAnswer: null, feedbackMessage: getPromptForMode(mode) });
                    generateNewTarget();
                }, 700);
            } else if (!shouldAutoAdvanceByMetronome && !isManualAdvanceMode) {
                setTimeout(() => {
                    set({ lastAnswer: null, feedbackMessage: getPromptForMode(mode) });
                    generateNewTarget();
                }, 800);
            }
        } else {
            set({
                streak: 0,
                lastAnswer: { position: pos, correct: false },
                sessionIncorrect: get().sessionIncorrect + 1,
                feedbackMessage: `Incorrect! Correct: string ${targetPosition.stringIndex + 1}, fret ${targetPosition.fret}`
            });
            if (shouldAutoAdvanceByClick) {
                setTimeout(() => {
                    set({ lastAnswer: null, feedbackMessage: getPromptForMode(mode) });
                    generateNewTarget();
                }, 1200);
            } else if (!shouldAutoAdvanceByMetronome && !isManualAdvanceMode) {
                setTimeout(() => {
                    set({ lastAnswer: null });
                }, 1200);
            }
        }
    },

    submitDetectedNote: (note: NoteName) => {
        const { mode, targetNote, targetPosition, score, streak, generateNewTarget, isMetronomeOn, playCycleAnswered } = get();

        if (mode === 'playNotes') {
            if (!targetNote) return;
            const isCorrect = note === targetNote;

            if (isCorrect) {
                if (isMetronomeOn && playCycleAnswered) return;
                const newStreak = streak + 1;
                if (newStreak === 20) {
                    useProgressStore.getState().unlockAchievement('perfect_session');
                }

                set({
                    score: score + 10 + (streak * 2),
                    streak: newStreak,
                    sessionCorrect: get().sessionCorrect + 1,
                    feedbackMessage: "Correct!",
                    playCycleAnswered: true,
                });
                if (!isMetronomeOn) {
                    setTimeout(() => {
                        set({ feedbackMessage: getPromptForMode(mode) });
                        generateNewTarget();
                    }, 350);
                }
            } else {
                if (!isMetronomeOn) {
                    set({
                        streak: 0,
                        sessionIncorrect: get().sessionIncorrect + 1,
                        feedbackMessage: `Incorrect (${note})`
                    });
                }
            }

            return;
        }

        if (mode === 'playTab') {
            if (!targetPosition) return;
            const isCorrect = note === targetPosition.note;
            if (isCorrect) {
                if (isMetronomeOn && playCycleAnswered) return;
                const newStreak = streak + 1;
                if (newStreak === 20) {
                    useProgressStore.getState().unlockAchievement('perfect_session');
                }
                set({
                    score: score + 10 + (streak * 2),
                    streak: newStreak,
                    sessionCorrect: get().sessionCorrect + 1,
                    feedbackMessage: "Correct!",
                    playCycleAnswered: true,
                });
                if (!isMetronomeOn) {
                    setTimeout(() => {
                        set({ feedbackMessage: getPromptForMode(mode) });
                        generateNewTarget();
                    }, 350);
                }
            } else {
                if (!isMetronomeOn) {
                    set({
                        streak: 0,
                        sessionIncorrect: get().sessionIncorrect + 1,
                        feedbackMessage: `Incorrect (${note})`
                    });
                }
            }
        }
    },

    applyHintPenalty: () => {
        const { isPlaying, lastAnswer, score, targetNote, targetPosition } = get();
        if (!isPlaying || Boolean(lastAnswer)) return;

        const hintedNote = targetNote ?? targetPosition?.note;
        if (!hintedNote) return;

        set({
            score: Math.max(0, score - 5),
            feedbackMessage: `Hint: ${hintedNote} (-5)`,
        });
    },

    setSpeedUpEnabled: (enabled: boolean) => set({ speedUpEnabled: enabled }),
    setSpeedUpAmount: (amount: number) => set({ speedUpAmount: Math.max(1, Math.min(20, amount)) }),
    setSpeedUpInterval: (interval: number) => set({ speedUpInterval: Math.max(1, Math.min(32, interval)) })
}));

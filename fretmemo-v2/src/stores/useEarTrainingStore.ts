import { create } from "zustand";
import { trackEvent } from "@/lib/analytics";

export type EarTrainingMode = "sound-to-fret" | "intervals" | "chord-quality" | "functional";

interface EarTrainingState {
    mode: EarTrainingMode;
    isPlaying: boolean;
    score: number;
    streak: number;
    totalCorrect: number;
    totalIncorrect: number;
    currentMidi: number | null;        // single note mode
    currentInterval: [number, number] | null; // interval mode [root, target]
    currentChordMidis: number[] | null; // chord mode
    currentAnswer: string | null;       // expected answer label
    lastResult: "correct" | "incorrect" | null;
    audioReady: boolean;
    sessionStartedAt: number | null;

    setMode: (mode: EarTrainingMode) => void;
    startSession: () => void;
    endSession: () => void;
    setCurrentNote: (midi: number) => void;
    setCurrentInterval: (pair: [number, number], answer: string) => void;
    setCurrentChord: (midis: number[], answer: string) => void;
    submitAnswer: (answer: string) => void;
    setAudioReady: (ready: boolean) => void;
    reset: () => void;
}

export const useEarTrainingStore = create<EarTrainingState>((set, get) => ({
    mode: "sound-to-fret",
    isPlaying: false,
    score: 0,
    streak: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    currentMidi: null,
    currentInterval: null,
    currentChordMidis: null,
    currentAnswer: null,
    lastResult: null,
    audioReady: false,
    sessionStartedAt: null,

    setMode: (mode) => set({ mode }),

    startSession: () => {
        const { mode } = get();
        trackEvent("fm_v2_ear_training_session_started", { mode });

        set({
            isPlaying: true,
            score: 0,
            streak: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            lastResult: null,
            sessionStartedAt: Date.now(),
        });
    },

    endSession: () => {
        const { mode, totalCorrect, totalIncorrect, sessionStartedAt } = get();
        const durationMs = sessionStartedAt ? Math.max(0, Date.now() - sessionStartedAt) : 0;
        const totalAnswers = totalCorrect + totalIncorrect;
        const accuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

        trackEvent("fm_v2_ear_training_session_ended", {
            mode,
            duration_ms: durationMs,
            correct: totalCorrect,
            incorrect: totalIncorrect,
            accuracy,
        });

        set({
            isPlaying: false,
            currentMidi: null,
            currentInterval: null,
            currentChordMidis: null,
            currentAnswer: null,
            lastResult: null,
            sessionStartedAt: null,
        });
    },

    setCurrentNote: (midi) => set({
        currentMidi: midi,
        currentInterval: null,
        currentChordMidis: null,
        currentAnswer: null,
        lastResult: null,
    }),

    setCurrentInterval: (pair, answer) => set({
        currentMidi: null,
        currentInterval: pair,
        currentChordMidis: null,
        currentAnswer: answer,
        lastResult: null,
    }),

    setCurrentChord: (midis, answer) => set({
        currentMidi: null,
        currentInterval: null,
        currentChordMidis: midis,
        currentAnswer: answer,
        lastResult: null,
    }),

    submitAnswer: (answer) => {
        const { currentAnswer, score, streak, totalCorrect, totalIncorrect } = get();
        const isCorrect = answer === currentAnswer;

        set({
            lastResult: isCorrect ? "correct" : "incorrect",
            score: isCorrect ? score + 10 + streak * 2 : score,
            streak: isCorrect ? streak + 1 : 0,
            totalCorrect: isCorrect ? totalCorrect + 1 : totalCorrect,
            totalIncorrect: isCorrect ? totalIncorrect : totalIncorrect + 1,
        });
    },

    setAudioReady: (ready) => set({ audioReady: ready }),

    reset: () => set({
        isPlaying: false,
        score: 0,
        streak: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        currentMidi: null,
        currentInterval: null,
        currentChordMidis: null,
        currentAnswer: null,
        lastResult: null,
        sessionStartedAt: null,
    }),
}));

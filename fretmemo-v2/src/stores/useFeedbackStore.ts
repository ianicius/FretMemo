import { create } from "zustand";

export type AppFeedbackTone = "success" | "error" | "info";

interface FeedbackItem {
    id: string;
    message: string;
    tone: AppFeedbackTone;
    durationMs: number;
}

interface FeedbackState {
    active: FeedbackItem | null;
    queue: FeedbackItem[];
    enqueue: (message: string, tone?: AppFeedbackTone, durationMs?: number) => void;
    dismissActive: () => void;
    clearAll: () => void;
}

function createFeedbackItem(message: string, tone: AppFeedbackTone, durationMs: number): FeedbackItem {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message,
        tone,
        durationMs,
    };
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
    active: null,
    queue: [],

    enqueue: (message, tone = "info", durationMs = 2800) => {
        const item = createFeedbackItem(message, tone, durationMs);
        set((state) => {
            if (!state.active) {
                return { active: item };
            }
            return { queue: [...state.queue, item] };
        });
    },

    dismissActive: () =>
        set((state) => {
            if (state.queue.length === 0) {
                return { active: null };
            }

            const [next, ...rest] = state.queue;
            return {
                active: next,
                queue: rest,
            };
        }),

    clearAll: () =>
        set({
            active: null,
            queue: [],
        }),
}));

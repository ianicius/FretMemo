import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PinnedExerciseId =
    | "fretboardToNote"
    | "playNotes"
    | "noteToTab"
    | "tabToNote"
    | "playTab"
    | "spider"
    | "permutation"
    | "linear"
    | "diagonal"
    | "stringskip"
    | "legato";

interface PinnedExercisesState {
    pinnedIds: PinnedExerciseId[];
    maxPins: number;
    isPinned: (id: PinnedExerciseId) => boolean;
    togglePinned: (id: PinnedExerciseId) => void;
    pin: (id: PinnedExerciseId) => void;
    unpin: (id: PinnedExerciseId) => void;
    movePinned: (id: PinnedExerciseId, toIndex: number) => void;
}

const DEFAULT_PINNED: PinnedExerciseId[] = ["fretboardToNote", "playNotes"];
const DEFAULT_MAX_PINS = 4;

function normalizePinnedList(ids: PinnedExerciseId[], maxPins: number): PinnedExerciseId[] {
    const unique = Array.from(new Set(ids));
    return unique.slice(0, maxPins);
}

export const usePinnedExercisesStore = create<PinnedExercisesState>()(
    persist(
        (set, get) => ({
            pinnedIds: DEFAULT_PINNED,
            maxPins: DEFAULT_MAX_PINS,
            isPinned: (id) => get().pinnedIds.includes(id),
            togglePinned: (id) =>
                set((state) => {
                    if (state.pinnedIds.includes(id)) {
                        return {
                            pinnedIds: state.pinnedIds.filter((item) => item !== id),
                        };
                    }

                    const next = normalizePinnedList([...state.pinnedIds, id], state.maxPins);
                    return { pinnedIds: next };
                }),
            pin: (id) =>
                set((state) => ({
                    pinnedIds: normalizePinnedList([...state.pinnedIds, id], state.maxPins),
                })),
            unpin: (id) =>
                set((state) => ({
                    pinnedIds: state.pinnedIds.filter((item) => item !== id),
                })),
            movePinned: (id, toIndex) =>
                set((state) => {
                    const currentIndex = state.pinnedIds.indexOf(id);
                    if (currentIndex < 0) return {};

                    const next = [...state.pinnedIds];
                    next.splice(currentIndex, 1);
                    const clampedIndex = Math.max(0, Math.min(next.length, Math.round(toIndex)));
                    next.splice(clampedIndex, 0, id);
                    return { pinnedIds: next };
                }),
        }),
        {
            name: "fretmemo-pinned-v1",
            partialize: (state) => ({
                pinnedIds: state.pinnedIds,
                maxPins: state.maxPins,
            }),
            merge: (persistedState, currentState) => {
                const persisted = (persistedState ?? {}) as Partial<PinnedExercisesState>;
                const maxPins = persisted.maxPins ?? currentState.maxPins;
                const pinnedIds = Array.isArray(persisted.pinnedIds)
                    ? normalizePinnedList(persisted.pinnedIds as PinnedExerciseId[], maxPins)
                    : currentState.pinnedIds;

                return {
                    ...currentState,
                    ...persisted,
                    maxPins,
                    pinnedIds,
                };
            },
        }
    )
);


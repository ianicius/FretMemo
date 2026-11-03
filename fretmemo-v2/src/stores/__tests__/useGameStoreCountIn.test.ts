import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { useGameStore } from "../useGameStore";
import { useSettingsStore } from "../useSettingsStore";

vi.mock("@/lib/analytics", () => ({
    trackEvent: vi.fn(),
    trackFeatureOpened: vi.fn(),
    trackRouteView: vi.fn(),
    trackNavigationClicked: vi.fn(),
    initAnalyticsV2: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics";
const trackEventMock = vi.mocked(trackEvent);

const BEAT_MS_AT_120 = 500; // 60000 / 120

function setCountInEnabled(enabled: boolean) {
    const { quick } = useSettingsStore.getState();
    useSettingsStore.setState({ quick: { ...quick, countInEnabled: enabled } });
}

beforeEach(() => {
    vi.useFakeTimers();
    trackEventMock.mockClear();
    // Deterministic, isolated game-store state per test.
    useGameStore.setState({
        mode: "fretboardToNote",
        bpm: 120,
        isPlaying: false,
        isMetronomeArmed: false,
        isMetronomeOn: false,
        isCountInActive: false,
        countInBeat: 0,
        countInTimers: [],
        targetNote: null,
        targetPosition: null,
        sessionStartTime: null,
    });
    setCountInEnabled(false);
});

afterEach(() => {
    vi.useRealTimers();
});

describe("startGame count-in", () => {
    it("starts immediately when count-in is disabled (regression guard)", () => {
        setCountInEnabled(false);

        useGameStore.getState().startGame();

        const state = useGameStore.getState();
        expect(state.isPlaying).toBe(true);
        expect(state.isCountInActive).toBe(false);
        expect(state.countInBeat).toBe(0);
        expect(state.targetNote).not.toBeNull();
        expect(state.sessionStartTime).not.toBeNull();
        expect(trackEventMock).toHaveBeenCalledWith(
            "fm_v2_practice_session_started",
            expect.objectContaining({ count_in_enabled: false }),
        );
    });

    it("defers the first target and metronome behind one bar of count-in", () => {
        setCountInEnabled(true);

        useGameStore.getState().startGame();

        // Session UI is live, but nothing plays yet.
        let state = useGameStore.getState();
        expect(state.isPlaying).toBe(true);
        expect(state.isCountInActive).toBe(true);
        expect(state.countInBeat).toBe(4);
        expect(state.targetNote).toBeNull();
        expect(state.sessionStartTime).toBeNull();
        expect(trackEventMock).toHaveBeenCalledWith(
            "fm_v2_practice_session_started",
            expect.objectContaining({ count_in_enabled: true, bpm: 120 }),
        );

        vi.advanceTimersByTime(BEAT_MS_AT_120);
        expect(useGameStore.getState().countInBeat).toBe(3);
        vi.advanceTimersByTime(BEAT_MS_AT_120);
        expect(useGameStore.getState().countInBeat).toBe(2);
        vi.advanceTimersByTime(BEAT_MS_AT_120);
        expect(useGameStore.getState().countInBeat).toBe(1);
        expect(useGameStore.getState().targetNote).toBeNull();

        // Bar finished: session actually begins.
        vi.advanceTimersByTime(BEAT_MS_AT_120);
        state = useGameStore.getState();
        expect(state.isCountInActive).toBe(false);
        expect(state.countInBeat).toBe(0);
        expect(state.targetNote).not.toBeNull();
        expect(state.sessionStartTime).not.toBeNull();
    });

    it("arms the metronome only after the count-in bar", () => {
        setCountInEnabled(true);
        useGameStore.setState({ isMetronomeArmed: true });

        useGameStore.getState().startGame();
        expect(useGameStore.getState().isMetronomeOn).toBe(false);

        vi.advanceTimersByTime(BEAT_MS_AT_120 * 4);
        expect(useGameStore.getState().isMetronomeOn).toBe(true);
    });

    it("cancels cleanly when the session stops mid-count-in", () => {
        setCountInEnabled(true);

        useGameStore.getState().startGame();
        vi.advanceTimersByTime(BEAT_MS_AT_120); // beat 3

        useGameStore.getState().stopGame();

        const state = useGameStore.getState();
        expect(state.isPlaying).toBe(false);
        expect(state.isCountInActive).toBe(false);
        expect(state.countInBeat).toBe(0);

        // Late timers must not resurrect the session.
        vi.advanceTimersByTime(BEAT_MS_AT_120 * 4);
        const late = useGameStore.getState();
        expect(late.targetNote).toBeNull();
        expect(late.isCountInActive).toBe(false);
    });
});

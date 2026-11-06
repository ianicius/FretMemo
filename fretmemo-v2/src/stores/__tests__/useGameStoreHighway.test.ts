import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../useGameStore";
import type { Position } from "@/types/fretboard";

vi.mock("@/lib/analytics", () => ({
    trackEvent: vi.fn(),
    trackFeatureOpened: vi.fn(),
    trackRouteView: vi.fn(),
    trackNavigationClicked: vi.fn(),
    initAnalyticsV2: vi.fn(),
}));

function pos(fret: number, stringIndex: number, note: Position["note"]): Position {
    return { fret, stringIndex, note };
}

beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.setState({
        mode: "playTab",
        bpm: 120,
        isPlaying: false,
        isMetronomeArmed: false,
        isMetronomeOn: false,
        isCountInActive: false,
        countInBeat: 0,
        countInTimers: [],
        targetPosition: null,
        targetNote: null,
        nextPosition: null,
        nextNote: null,
        upcomingPositions: [],
        lastBeatAt: null,
        playCycleAnswered: false,
        lastAnswer: null,
    });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("playTab highway queue", () => {
    it("fills the queue to depth 3 and exposes queue[0] as nextPosition", () => {
        useGameStore.setState({ targetPosition: pos(3, 0, "C") });

        useGameStore.getState().generateNewTarget();

        const state = useGameStore.getState();
        expect(state.upcomingPositions).toHaveLength(3);
        expect(state.nextPosition).toBe(state.upcomingPositions[0]);
        expect(state.nextNote).toBe(state.upcomingPositions[0].note);
        for (const position of state.upcomingPositions) {
            expect(position.fret).toBeGreaterThanOrEqual(1);
            expect(position.fret).toBeLessThanOrEqual(12);
        }
    });

    it("promotes queue[0] to target and preserves the scheduled tail", () => {
        const a = pos(5, 1, "A");
        const b = pos(7, 2, "B");
        const c = pos(8, 3, "C");
        useGameStore.setState({
            targetPosition: pos(3, 0, "G"),
            upcomingPositions: [a, b, c],
        });

        useGameStore.getState().generateNewTarget();

        const state = useGameStore.getState();
        expect(state.targetPosition).toBe(a);
        expect(state.targetNote).toBe("A");
        expect(state.upcomingPositions.slice(0, 2)).toEqual([b, c]);
        expect(state.upcomingPositions).toHaveLength(3);
        expect(state.nextPosition).toBe(b);
    });

    it("startGame resets the queue so a new session rebuilds it", () => {
        useGameStore.setState({
            mode: "fretboardToNote",
            upcomingPositions: [pos(5, 1, "A")],
        });

        useGameStore.getState().startGame();

        expect(useGameStore.getState().upcomingPositions).toEqual([]);
    });

    it("stopGame clears the beat phase", () => {
        useGameStore.setState({
            isPlaying: true,
            isMetronomeOn: true,
            lastBeatAt: 12345,
        });

        useGameStore.getState().stopGame();

        expect(useGameStore.getState().lastBeatAt).toBeNull();
    });

    it("flags a missed cycle and clears the flag on rotation", () => {
        // Minimal AudioContext stub — see the lastBeatAt test below.
        class FakeOscillator {
            type = "triangle";
            frequency = { setValueAtTime: vi.fn() };
            connect = vi.fn();
            start = vi.fn();
            stop = vi.fn();
        }
        class FakeGain {
            connect = vi.fn();
            gain = {
                setValueAtTime: vi.fn(),
                exponentialRampToValueAtTime: vi.fn(),
            };
        }
        class FakeAudioContext {
            currentTime = 0;
            destination = {};
            createOscillator() { return new FakeOscillator(); }
            createGain() { return new FakeGain(); }
        }
        vi.stubGlobal("AudioContext", FakeAudioContext);

        useGameStore.setState({
            mode: "playTab",
            isPlaying: true,
            isMetronomeOn: true,
            noteDuration: 4,
            noteTickCounter: 0, // cycle start
            targetPosition: pos(3, 0, "C"),
            targetNote: "C",
            playCycleAnswered: false, // not answered this cycle
            lastCycleMissed: false,
        });

        useGameStore.getState().tickMetronome();
        expect(useGameStore.getState().lastCycleMissed).toBe(true);

        // The flag survives the miss rotation (flash plays on the arriving
        // target) and clears on the next answered cycle boundary.
        useGameStore.getState().generateNewTarget();
        expect(useGameStore.getState().lastCycleMissed).toBe(true);

        useGameStore.setState({ playCycleAnswered: true, noteTickCounter: 0 });
        useGameStore.getState().tickMetronome();
        expect(useGameStore.getState().lastCycleMissed).toBe(false);
        vi.unstubAllGlobals();
    });

    it("tickMetronome stamps lastBeatAt for the highway clock", () => {
        // tickMetronome bails early without an AudioContext (pre-existing
        // guard), so the test stubs the minimum surface it touches.
        class FakeOscillator {
            type = "triangle";
            frequency = { setValueAtTime: vi.fn() };
            connect = vi.fn();
            start = vi.fn();
            stop = vi.fn();
        }
        class FakeGain {
            connect = vi.fn();
            gain = {
                setValueAtTime: vi.fn(),
                exponentialRampToValueAtTime: vi.fn(),
            };
        }
        class FakeAudioContext {
            currentTime = 0;
            destination = {};
            createOscillator() { return new FakeOscillator(); }
            createGain() { return new FakeGain(); }
        }
        vi.stubGlobal("AudioContext", FakeAudioContext);

        useGameStore.setState({
            mode: "tabToNote",
            isPlaying: true,
            isMetronomeOn: true,
            noteDuration: 4,
            noteTickCounter: 1,
            lastBeatAt: null,
        });

        useGameStore.getState().tickMetronome();

        const stamp = useGameStore.getState().lastBeatAt;
        expect(stamp).not.toBeNull();
        // Fake timers freeze Date.now(); the stamp must come from that clock.
        expect(typeof stamp).toBe("number");
        vi.unstubAllGlobals();
    });
});

describe("playTab fingering (R-03)", () => {
    it("attaches finger and hand position to chained queue entries", () => {
        useGameStore.setState({
            targetPosition: { fret: 5, stringIndex: 0, note: "A", finger: 1, handPositionFret: 5 },
        });

        useGameStore.getState().generateNewTarget();

        const { upcomingPositions } = useGameStore.getState();
        expect(upcomingPositions).toHaveLength(3);
        for (const position of upcomingPositions) {
            expect(position.handPositionFret).not.toBeNull();
            expect(position.handPositionFret as number).toBeGreaterThanOrEqual(1);
            // Open strings carry no finger; fretted notes are within 1-4.
            if (position.fret === 0) {
                expect(position.finger).toBeNull();
            } else {
                expect(position.finger).toBeGreaterThanOrEqual(1);
                expect(position.finger).toBeLessThanOrEqual(4);
            }
        }
    });

    it("keeps the finger consistent with the hand window", () => {
        useGameStore.setState({
            targetPosition: { fret: 5, stringIndex: 0, note: "A", finger: 1, handPositionFret: 5 },
        });

        useGameStore.getState().generateNewTarget();

        const { upcomingPositions } = useGameStore.getState();
        for (const position of upcomingPositions) {
            if (position.fret > 0 && position.handPositionFret != null) {
                const expected = position.fret - position.handPositionFret + 1;
                expect(position.finger).toBe(expected);
            }
        }
    });
});

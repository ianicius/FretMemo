import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import { MicLatencyCalibration } from "../MicLatencyCalibration";
import { useRhythmDojoStore } from "@/stores/useRhythmDojoStore";

const stopTrack = vi.fn();
const { closeCtxSpy } = vi.hoisted(() => ({ closeCtxSpy: vi.fn() }));

vi.mock("@/rhythm/engine/RhythmClock", () => ({
    RhythmClock: class {
        getContext() {
            return {
                currentTime: 0,
                state: "running",
                resume: vi.fn(),
                close: closeCtxSpy,
                destination: {},
                createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
                createAnalyser: () => ({
                    fftSize: 0,
                    getFloatTimeDomainData: (arr: Float32Array) => arr.fill(0),
                }),
            };
        }
        async warmUp() {}
        now() { return 0; }
        close() { closeCtxSpy(); }
        toDelayMs() { return 0; }
    },
}));

vi.mock("@/rhythm/engine/MetronomeScheduler", () => ({
    MetronomeScheduler: class {
        private readonly opts: { onStep?: (step: { time: number; index: number }) => void };
        constructor(opts: { onStep?: (step: { time: number; index: number }) => void }) {
            this.opts = opts;
        }
        start() {
            // Fire a couple of clicks so the calibration window arms itself.
            this.opts.onStep?.({ time: 0.1, index: 0 });
            this.opts.onStep?.({ time: 0.7667, index: 1 });
        }
        stop() {}
    },
}));

const initialRhythmState = useRhythmDojoStore.getState();

beforeEach(async () => {
    await i18n.changeLanguage('en');
    useRhythmDojoStore.setState(initialRhythmState, true);
    vi.stubGlobal("navigator", {
        ...window.navigator,
        mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
                getTracks: () => [{ stop: stopTrack }],
            }),
        },
    });
});

afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.unstubAllGlobals();
    void i18n.changeLanguage('en');
    vi.clearAllMocks();
    useRhythmDojoStore.setState(initialRhythmState, true);
});

describe("MicLatencyCalibration", () => {
    it("renders idle state with the current latency value", () => {
        useRhythmDojoStore.setState({ inputLatencyMs: 85 });
        render(<MicLatencyCalibration />);
        expect(screen.getByText("Input latency (microphone)")).toBeInTheDocument();
        expect(screen.getByText("85 ms")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Calibrate" })).toBeInTheDocument();
    });

    it("enters the measuring state after arming the click track", async () => {
        render(<MicLatencyCalibration />);
        fireEvent.click(screen.getByRole("button", { name: "Calibrate" }));

        await waitFor(() => {
            expect(screen.getByText("Listening… play on each click")).toBeInTheDocument();
        });
        expect(screen.getByText("0 / 6")).toBeInTheDocument();
    });

    it("shows the no-mic error and keeps a retry button when capture fails", async () => {
        vi.stubGlobal("navigator", {
            ...window.navigator,
            mediaDevices: {
                getUserMedia: vi.fn().mockRejectedValue(new Error("NotAllowedError")),
            },
        });

        render(<MicLatencyCalibration />);
        fireEvent.click(screen.getByRole("button", { name: "Calibrate" }));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent("No microphone was found");
        });
        expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    it("times out a hanging getUserMedia prompt into the error state", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("navigator", {
            ...window.navigator,
            mediaDevices: {
                getUserMedia: vi.fn().mockReturnValue(new Promise(() => {})), // never settles
            },
        });

        render(<MicLatencyCalibration />);
        fireEvent.click(screen.getByRole("button", { name: "Calibrate" }));
        expect(screen.getByText(/Listening/)).toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(12_500);
        });

        expect(screen.getByRole("alert")).toHaveTextContent("No microphone was found");
    });

    it("stops an orphaned stream that resolves after the timeout won", async () => {
        vi.useFakeTimers();
        let resolveCapture: ((stream: unknown) => void) | null = null;
        vi.stubGlobal("navigator", {
            ...window.navigator,
            mediaDevices: {
                getUserMedia: vi.fn().mockReturnValue(
                    new Promise((resolve) => { resolveCapture = resolve; }),
                ),
            },
        });

        render(<MicLatencyCalibration />);
        fireEvent.click(screen.getByRole("button", { name: "Calibrate" }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(12_500); // timeout wins the race
        });
        expect(screen.getByRole("alert")).toBeInTheDocument();

        // The abandoned prompt finally resolves with a live stream…
        await act(async () => {
            resolveCapture?.({ getTracks: () => [{ stop: stopTrack }] });
        });

        // …and it must be stopped immediately instead of leaking the mic.
        expect(stopTrack).toHaveBeenCalled();
    });

    it("closes the audio context on unmount mid-measurement", async () => {
        render(<MicLatencyCalibration />);
        fireEvent.click(screen.getByRole("button", { name: "Calibrate" }));
        await waitFor(() => {
            expect(screen.getByText(/Listening/)).toBeInTheDocument();
        });
        expect(closeCtxSpy).not.toHaveBeenCalled();

        cleanup();

        expect(closeCtxSpy).toHaveBeenCalled();
    });

    it("stops mic tracks when the component unmounts mid-measurement", async () => {
        const { unmount } = render(<MicLatencyCalibration />);
        fireEvent.click(screen.getByRole("button", { name: "Calibrate" }));
        await waitFor(() => {
            expect(stopTrack).not.toHaveBeenCalled();
        });
        unmount();
        expect(stopTrack).toHaveBeenCalled();
    });
});

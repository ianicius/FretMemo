import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import { PlaybackControls } from "../PlaybackControls";

beforeEach(async () => {
    await i18n.changeLanguage("en");
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

function renderControls(overrides = {}) {
    const props = {
        playing: false,
        ready: true,
        soundfontProgress: null,
        positionMs: 1500,
        durationMs: 60000,
        speed: 1,
        volume: 0.8,
        metronomeOn: false,
        playerError: false,
        onPlayToggle: vi.fn(),
        onStop: vi.fn(),
        onSpeedChange: vi.fn(),
        onVolumeChange: vi.fn(),
        onMetronomeToggle: vi.fn(),
        onRetry: vi.fn(),
        ...overrides,
    };
    render(<PlaybackControls {...props} />);
    return props;
}

describe("PlaybackControls", () => {
    it("shows Play when paused and Stop with formatted position", () => {
        renderControls();
        expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
        expect(screen.getByText("0:01")).toBeInTheDocument();
        expect(screen.getByText("1:00")).toBeInTheDocument();
    });

    it("shows Pause while playing and fires the toggle", () => {
        const props = renderControls({ playing: true });
        const pause = screen.getByRole("button", { name: "Pause" });
        expect(pause).toBeInTheDocument();
        fireEvent.click(pause);
        expect(props.onPlayToggle).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Stop" }));
        expect(props.onStop).toHaveBeenCalledTimes(1);
    });

    it("reports soundfont loading progress instead of controls when not ready", () => {
        renderControls({ ready: false, soundfontProgress: 0.45 });
        expect(screen.getByText(/45%/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    });

    it("wires speed and volume sliders and the metronome toggle", () => {
        const props = renderControls({ metronomeOn: true });
        fireEvent.change(screen.getByLabelText("Speed"), { target: { value: "1.25" } });
        expect(props.onSpeedChange).toHaveBeenCalledWith(1.25);
        fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.5" } });
        expect(props.onVolumeChange).toHaveBeenCalledWith(0.5);
        const metro = screen.getByRole("switch", { name: "Metronome" });
        expect(metro).toBeChecked();
        fireEvent.click(metro);
        expect(props.onMetronomeToggle).toHaveBeenCalledTimes(1);
    });
});

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import type { LiveInputState, LiveInputListener } from "@/audio/liveInput";
import { LiveInputPanel } from "@/components/sound/LiveInputPanel";

/**
 * Panel render test: the `liveInput` controller is mocked at the module
 * boundary (no getUserMedia, no AudioContext in jsdom). Verifies the
 * user-facing states the Sound screen relies on: collapsed section,
 * enable/starting/disable controls, denied/missing-mic error copy,
 * headphones warning and the emergency mute control.
 */

const mocks = vi.hoisted(() => {
    const startMock = vi.fn(async () => {});
    const stopMock = vi.fn();
    const toggleMutedMock = vi.fn(() => false);
    const listeners = new Set<(state: LiveInputState) => void>();
    const panelState: { current: LiveInputState } = {
        current: { status: "off", muted: false } as LiveInputState,
    };
    return { startMock, stopMock, toggleMutedMock, listeners, panelState };
});

vi.mock("@/audio/liveInput", () => ({
    liveInput: {
        subscribe: (listener: LiveInputListener) => {
            mocks.listeners.add(listener);
            return () => {
                mocks.listeners.delete(listener);
            };
        },
        getState: () => mocks.panelState.current,
        getAnalyser: () => null,
        start: mocks.startMock,
        stop: mocks.stopMock,
        setMuted: vi.fn(),
        toggleMuted: mocks.toggleMutedMock,
    },
}));

/** Point the mocked controller at a state and notify subscribers (act-wrapped). */
function setPanelState(next: LiveInputState): void {
    mocks.panelState.current = next;
    act(() => {
        for (const listener of mocks.listeners) {
            listener(next);
        }
    });
}

beforeAll(async () => {
    await i18n.changeLanguage("en");
});

beforeEach(() => {
    mocks.startMock.mockClear();
    mocks.stopMock.mockClear();
    mocks.toggleMutedMock.mockClear();
    setPanelState({ status: "off", muted: false });
});

afterEach(() => {
    cleanup();
    mocks.listeners.clear();
});

function openPanel(): void {
    fireEvent.click(screen.getByRole("button", { name: /live input/i }));
}

describe("LiveInputPanel", () => {
    it("renders as a collapsed section with an enable affordance and a pre-enable headphones hint", () => {
        render(<LiveInputPanel />);
        expect(screen.getByRole("button", { name: /live input/i })).toBeInTheDocument();
        openPanel();
        expect(screen.getByRole("button", { name: /enable live input/i })).toBeInTheDocument();
        expect(screen.getByText(/before enabling: put on headphones/i)).toBeInTheDocument();
        // Collapsed by default: content hidden until opened.
        expect(screen.queryByRole("button", { name: /emergency mute/i })).not.toBeInTheDocument();
    });

    it("enable triggers start() and the starting state disables the control", async () => {
        render(<LiveInputPanel />);
        openPanel();
        fireEvent.click(screen.getByRole("button", { name: /enable live input/i }));
        expect(mocks.startMock).toHaveBeenCalledTimes(1);

        setPanelState({ status: "starting", muted: false });
        expect(screen.getByText(/starting microphone/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /starting/i })).toBeDisabled();
    });

    it("shows the headphones warning and an emergency mute while live; mute toggles", () => {
        setPanelState({ status: "on", muted: false });
        render(<LiveInputPanel />);
        openPanel();

        expect(screen.getByText(/headphones on!/i)).toBeInTheDocument();
        expect(screen.getByText(/live input is on/i)).toBeInTheDocument();
        expect(screen.getByText(/input level/i)).toBeInTheDocument();

        const muteButton = screen.getByRole("button", { name: /emergency mute/i });
        fireEvent.click(muteButton);
        expect(mocks.toggleMutedMock).toHaveBeenCalledTimes(1);

        setPanelState({ status: "on", muted: true });
        expect(screen.getByText(/muted/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /resume monitoring/i })).toBeInTheDocument();
    });

    it("renders a handled, actionable error state for a denied microphone", () => {
        setPanelState({ status: "error", errorKind: "denied", muted: false });
        render(<LiveInputPanel />);
        openPanel();

        expect(screen.getByText(/microphone access denied/i)).toBeInTheDocument();
        expect(screen.getByText(/allow it for this site/i)).toBeInTheDocument();
        const retry = screen.getByRole("button", { name: /try again/i });
        fireEvent.click(retry);
        expect(mocks.startMock).toHaveBeenCalledTimes(1);
    });

    it("renders a handled error state for a missing microphone", () => {
        setPanelState({ status: "error", errorKind: "notfound", muted: false });
        render(<LiveInputPanel />);
        openPanel();

        expect(screen.getByText(/no microphone found/i)).toBeInTheDocument();
        expect(screen.getByText(/connect a microphone or audio interface/i)).toBeInTheDocument();
    });

    it("disable while live calls stop()", async () => {
        setPanelState({ status: "on", muted: false });
        render(<LiveInputPanel />);
        openPanel();
        fireEvent.click(screen.getByRole("button", { name: /disable live input/i }));

        await waitFor(() => expect(mocks.stopMock).toHaveBeenCalledTimes(1));
    });
});

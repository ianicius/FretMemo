import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "@/lib/i18n";
import { useAppStore } from "@/stores/useAppStore";
import { useGameStore } from "@/stores/useGameStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import Practice from "@/pages/Practice";

vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/layout/BottomNav", () => ({ BottomNav: () => null }));
vi.mock("@/components/layout/SeoManager", () => ({ SeoManager: () => null }));
vi.mock("@/components/ui/global-feedback-toast", () => ({ GlobalFeedbackToast: () => null }));
vi.mock("@/components/session-setup/session-setup-dialog-shell", () => ({
    SessionSetupDialogShell: ({
        isOpen,
        title,
        children,
        footer,
    }: {
        isOpen: boolean;
        title: string;
        children: ReactNode;
        footer?: ReactNode;
    }) => isOpen ? <div role="dialog" aria-label={title}>{children}{footer}</div> : null,
}));
vi.mock("@/components/fretboard/Fretboard", () => ({ Fretboard: () => <div data-testid="fretboard" /> }));
vi.mock("@/components/fretboard/TabView", () => ({ TabView: () => <div data-testid="tab-view" /> }));
vi.mock("@/hooks/useOrientation", () => ({
    useOrientation: () => ({
        isLandscape: false,
        requestFullscreen: vi.fn(),
        exitFullscreen: vi.fn(),
    }),
}));
vi.mock("@/services/pitch", () => ({
    usePitchDetector: () => ({
        note: null,
        frequency: null,
        error: null,
        isRunning: false,
        inputDevices: [],
        activeDeviceId: null,
        refreshInputDevices: vi.fn(),
    }),
}));
vi.mock("@/lib/analytics", () => ({
    trackEvent: vi.fn(),
    trackFeatureOpened: vi.fn(),
}));

const initialAppState = useAppStore.getState();
const initialGameState = useGameStore.getState();
const initialProgressState = useProgressStore.getState();
const initialSettingsState = useSettingsStore.getState();

function restoreStores(): void {
    useAppStore.setState(initialAppState, true);
    useGameStore.setState(initialGameState, true);
    useProgressStore.setState(initialProgressState, true);
    useSettingsStore.setState(initialSettingsState, true);
}

beforeAll(() => {
    class ResizeObserverStub {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
    Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
});

beforeEach(async () => {
    restoreStores();
    await act(async () => {
        await i18n.changeLanguage("pl");
    });
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    restoreStores();
    vi.clearAllMocks();
});

afterAll(() => {
    vi.unstubAllGlobals();
});

function renderPracticeWithPreFlight(): void {
    render(
        <MemoryRouter
            initialEntries={[
                { pathname: "/practice", state: { openPreFlight: true, mode: "fretboardToNote" } },
            ]}
        >
            <Routes>
                <Route path="/practice" element={<Practice />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe("practice count-in", () => {
    it("shows a persisted count-in toggle in the pre-flight modal", () => {
        renderPracticeWithPreFlight();

        const toggle = screen.getByRole("switch", { name: "Wstęp (count-in)" });
        expect(toggle).toBeInTheDocument();
        expect(toggle).not.toBeChecked();

        fireEvent.click(toggle);

        expect(toggle).toBeChecked();
        expect(useSettingsStore.getState().quick.countInEnabled).toBe(true);
    });

    it("displays the count-in overlay after start and clears it after one bar", async () => {
        vi.useFakeTimers();
        const { quick } = useSettingsStore.getState();
        useSettingsStore.setState({ quick: { ...quick, countInEnabled: true } });
        useGameStore.setState({ bpm: 120 });

        renderPracticeWithPreFlight();
        fireEvent.click(screen.getByRole("button", { name: "Rozpocznij" }));

        // Focus UI is live and the count-in overlay shows the first beat.
        expect(screen.getByText("Wstęp (count-in)")).toBeInTheDocument();
        expect(screen.getByText("4")).toBeInTheDocument();

        await act(async () => {
            vi.advanceTimersByTime(2000); // one bar at 120 BPM
        });

        expect(screen.queryByText("Wstęp (count-in)")).not.toBeInTheDocument();
        expect(useGameStore.getState().isCountInActive).toBe(false);
        expect(useGameStore.getState().targetNote).not.toBeNull();
    });

    it("starts the session immediately when count-in is off", async () => {
        vi.useFakeTimers();

        renderPracticeWithPreFlight();
        fireEvent.click(screen.getByRole("button", { name: "Rozpocznij" }));

        expect(useGameStore.getState().isPlaying).toBe(true);
        expect(useGameStore.getState().isCountInActive).toBe(false);
        expect(useGameStore.getState().targetNote).not.toBeNull();
        expect(screen.queryByText("Wstęp (count-in)")).not.toBeInTheDocument();
    });
});

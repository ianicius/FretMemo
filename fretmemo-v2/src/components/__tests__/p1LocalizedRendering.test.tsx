import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "@/lib/i18n";
import { useAppStore } from "@/stores/useAppStore";
import { useGameStore } from "@/stores/useGameStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { AppShell } from "@/components/layout/AppShell";
import { DarkModeToggle } from "@/components/layout/DarkModeToggle";
import { MasteryBar } from "@/components/ui/mastery-bar";
import { NoteDot } from "@/components/fretboard/NoteDot";
import { NoteAnswerButtons, PositionAnswerButtons } from "@/components/practice/AnswerButtons";
import { XPToast } from "@/components/practice/XPToast";
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

afterEach(async () => {
  cleanup();
  restoreStores();
  vi.clearAllMocks();
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

describe("rendered Polish P1 localization", () => {
  it("renders the Polish AppShell support links and skip link", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<div>Treść</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Przejdź do głównej treści" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Postaw kawę" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Otwórz FAQ" })).toBeInTheDocument();
    expect(screen.queryByText("Buy me a coffee")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open FAQ" })).not.toBeInTheDocument();
  });

  it("renders the Polish guitar-mode suffix in the active Practice HUD", async () => {
    useGameStore.setState({ mode: "playNotes", isPlaying: false });

    render(
      <MemoryRouter
        initialEntries={[{
          pathname: "/practice",
          state: { openPreFlight: true, mode: "playNotes", source: "localization-test" },
        }]}
      >
        <Routes>
          <Route path="/practice" element={<Practice />} />
          <Route path="/train" element={<div>Trening</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Tryb gitary" }));
    fireEvent.click(screen.getByRole("button", { name: "Rozpocznij" }));

    expect(await screen.findByText("Generator nut · Tryb gitary")).toBeInTheDocument();
    expect(screen.queryByText(/Guitar Mode/)).not.toBeInTheDocument();
  });

  it("renders Polish theme, mastery, note, answer, position, and XP boundaries", () => {
    const { full } = useSettingsStore.getState();
    useSettingsStore.setState({
      full: {
        ...full,
        display: { ...full.display, theme: "dark" },
      },
    });

    render(
      <>
        <DarkModeToggle />
        <MasteryBar value={72} />
        <NoteDot position={{ stringIndex: 0, fret: 2, note: "B" }} onClick={vi.fn()} showLabel />
        <NoteAnswerButtons
          noteOptions={["B"]}
          targetNote="B"
          notation="sharps"
          isLocked={false}
          isPlaying
          onSubmit={vi.fn()}
        />
        <PositionAnswerButtons
          options={[{ stringIndex: 0, fret: 2, note: "B" }]}
          isLocked={false}
          isPlaying
          stringLabels={["1", "2", "3", "4", "5", "6"]}
          tuning={["E", "B", "G", "D", "A", "E"]}
          leftHanded={false}
          notation="sharps"
          onSubmit={vi.fn()}
        />
        <XPToast xp={0} isVisible onClose={vi.fn()} streak={7} type="streak" />
      </>,
    );

    expect(screen.getByRole("button", { name: "Jasny motyw" })).toHaveAttribute("title", "Przełącz na jasny motyw");
    expect(screen.getByRole("progressbar", { name: "Postęp opanowania" })).toHaveAttribute("aria-valuetext", "Opanowanie: 72%");
    expect(screen.getByText("Opanowanie: 72%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuta na strunie 1, próg 2, H" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Odpowiedź H" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Struna 1, próg 2" })).toBeInTheDocument();
    expect(screen.getByText("Seria: 7!")).toBeInTheDocument();
  });
});

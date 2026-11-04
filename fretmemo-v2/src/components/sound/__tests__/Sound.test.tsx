import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/lib/i18n";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useSoundStore } from "@/stores/useSoundStore";
import Sound from "../../../pages/Sound";

/**
 * Light render test for the Sound page: engine and playback modules are
 * mocked at our module boundaries (no AudioContext in jsdom); IndexedDB runs
 * on fake-indexeddb, so custom presets load as an empty list.
 */

// jsdom lacks ResizeObserver (Radix Slider measures its thumb).
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
}

const { setPresetMock, initSoundEngineMock } = vi.hoisted(() => ({
    setPresetMock: vi.fn(() => Promise.resolve()),
    initSoundEngineMock: vi.fn(),
}));

vi.mock("@/audio/engine", () => ({
    soundEngine: {
        getState: () => ({ presetId: "classic-acoustic", status: "idle" }),
        subscribe: () => () => {},
        setPreset: setPresetMock,
        getAudioContext: vi.fn(() => {
            throw new Error("AudioContext is not available in tests");
        }),
        getVoiceBus: vi.fn(() => {
            throw new Error("AudioContext is not available in tests");
        }),
        getMasterGain: () => null,
        applyVolumeFromSettings: vi.fn(),
    },
    initSoundEngine: initSoundEngineMock,
    getSoundEngineContext: vi.fn(),
    getSoundEngineVoiceBus: vi.fn(),
    masterGainValue: (volume: number) => volume * 0.4,
    CROSSFADE_SEC: 0.02,
    VOICE_BUS_TRIM: 0.4,
}));

vi.mock("@/lib/audio", () => ({
    playChord: vi.fn(async () => {}),
    playTone: vi.fn(async () => {}),
    playInterval: vi.fn(async () => {}),
    playIntervalPrompt: vi.fn(async () => {}),
    playCadence: vi.fn(async () => {}),
    playFunctionalPrompt: vi.fn(async () => {}),
    playCountInClicks: vi.fn(),
    initAudio: vi.fn(),
    midiToFrequency: (midi: number) => 440 * Math.pow(2, (midi - 69) / 12),
}));

const BUILT_IN_NAMES = [
    "Classic acoustic",
    "Clean JC-120",
    "Clean Deluxe",
    "Crunch AC10",
    "Lead JCM800",
    "High Gain 5153",
];

function renderPage() {
    return render(
        <MemoryRouter>
            <Sound />
        </MemoryRouter>,
    );
}

beforeEach(async () => {
    await i18n.changeLanguage("en");
    useSettingsStore.setState({
        full: {
            ...useSettingsStore.getState().full,
            audio: {
                ...useSettingsStore.getState().full.audio,
                soundPreset: "classic-acoustic",
                volume: 0.8,
            },
        },
    });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("Sound page", () => {
    it("renders a card for every built-in preset with select and audition actions", async () => {
        renderPage();

        for (const name of BUILT_IN_NAMES) {
            const heading = await screen.findByRole("heading", { name });
            expect(heading).toBeInTheDocument();
            const card = heading.closest(".bg-card") ?? document.body;
            expect(
                within(card as HTMLElement).getByRole("button", { name: /Select(ed)?/ }),
            ).toBeInTheDocument();
            expect(within(card as HTMLElement).getByRole("button", { name: "Audition" })).toBeInTheDocument();
        }
        expect(screen.getAllByRole("button", { name: /Select(ed)?/ })).toHaveLength(6);
        expect(screen.getAllByRole("button", { name: "Audition" })).toHaveLength(6);
    });

    it("highlights the active preset and marks its button as selected", async () => {
        renderPage();

        const activeHeading = await screen.findByRole("heading", { name: "Classic acoustic" });
        const card = activeHeading.closest(".bg-card") as HTMLElement;
        expect(within(card).getByRole("button", { name: "Selected" })).toBeDisabled();
        expect(within(card).getByText("Active")).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: "Select" })).toHaveLength(5);
    });

    it("shows the active sound summary from the settings store", async () => {
        renderPage();

        expect(screen.getByText("Active sound: Classic acoustic")).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 1, name: "Sound" })).toBeInTheDocument();
    });

    it("renders the master volume slider bound to full.audio.volume with an accessible name and value text", async () => {
        renderPage();

        // The only slider while the designer is closed: named from the same
        // i18n key as the visible label, valuetext carries the unit (V1/V4).
        const slider = screen.getByRole("slider", { name: "Volume" });
        expect(slider).toHaveAttribute("aria-valuenow", "80");
        expect(slider).toHaveAttribute("aria-valuetext", "80 %");
        expect(screen.getByText("80 %")).toBeInTheDocument();
    });

    it("updates full.audio.volume when the slider is moved", () => {
        renderPage();

        const slider = screen.getByRole("slider", { name: "Volume" });
        // Radix slider thumb: arrow keys step by `step` (1 → 80% → 79%).
        fireEvent.keyDown(slider, { key: "ArrowLeft" });

        return waitFor(() => {
            expect(useSettingsStore.getState().full.audio.volume).toBeCloseTo(0.79, 5);
        });
    });

    it("selecting a preset persists soundPreset and calls engine.setPreset", async () => {
        renderPage();

        const heading = await screen.findByRole("heading", { name: "Lead JCM800" });
        const card = heading.closest(".bg-card") as HTMLElement;
        fireEvent.click(within(card).getByRole("button", { name: "Select" }));

        await waitFor(() => {
            expect(setPresetMock).toHaveBeenCalledTimes(1);
        });
        const handed = (setPresetMock.mock.calls[0] as unknown[])[0] as { id: string; kind: string };
        expect(handed.id).toBe("nam-lead-jcm");
        expect(handed.kind).toBe("nam");
        expect(useSettingsStore.getState().full.audio.soundPreset).toBe("nam-lead-jcm");
    });

    it("shows the empty state as the single designer entry point while no custom presets exist", async () => {
        renderPage();

        expect(await screen.findByText("No custom tones yet")).toBeInTheDocument();
        // The collapsed designer accordion is hidden while the list is empty —
        // the empty-state CTA is the only visible entry point (V6).
        expect(screen.queryByText("Amp, EQ, effects")).not.toBeInTheDocument();
        const cta = screen.getByRole("button", { name: "Tone designer" });
        expect(screen.getByRole("button", { name: "More audio settings" })).toBeInTheDocument();

        // The CTA expands (and scrolls to) the designer accordion.
        fireEvent.click(cta);
        expect(await screen.findByText(/Build your own tone/)).toBeInTheDocument();
        expect(screen.getByText("Amp, EQ, effects")).toBeInTheDocument();
    });

    it("exposes accessible names and unit value text on all designer sliders", async () => {
        renderPage();

        // Open the designer via the empty-state CTA (the single entry while empty).
        fireEvent.click(screen.getByRole("button", { name: "Tone designer" }));

        // 9 designer sliders + master volume, each named from its visible
        // label key and exposing a unit-bearing valuetext (V1).
        await screen.findByText(/Build your own tone/);
        expect(screen.getAllByRole("slider")).toHaveLength(10);
        const inputGain = screen.getByRole("slider", { name: "Input gain" });
        expect(inputGain).toHaveAttribute("aria-valuetext", "1x");
        expect(screen.getByRole("slider", { name: "Drive" })).toHaveAttribute("aria-valuetext", "0 %");
        expect(screen.getByRole("slider", { name: "Bass" })).toHaveAttribute("aria-valuetext", "0 dB");
        expect(screen.getByRole("slider", { name: "Output gain" })).toHaveAttribute("aria-valuetext", "1x");
    });

    it("shows the Ready line only on the active card when the engine reports ready for it", () => {
        useSoundStore.setState({
            engine: { presetId: "classic-acoustic", status: "ready" },
        });
        renderPage();

        const activeCard = screen
            .getByRole("heading", { name: "Classic acoustic" })
            .closest(".bg-card") as HTMLElement;
        expect(within(activeCard).getByText("Ready")).toBeInTheDocument();
        const otherCard = screen
            .getByRole("heading", { name: "Lead JCM800" })
            .closest(".bg-card") as HTMLElement;
        expect(within(otherCard).queryByText("Ready")).not.toBeInTheDocument();
    });

    it("renders the same preset names in Polish", async () => {
        await i18n.changeLanguage("pl");
        renderPage();

        expect(screen.getByRole("heading", { level: 1, name: "Dźwięk" })).toBeInTheDocument();
        for (const name of ["Klasyczna akustyka", "Czysty JC-120", "Lead JCM800"]) {
            expect(await screen.findByRole("heading", { name })).toBeInTheDocument();
        }
        expect(screen.getAllByRole("button", { name: "Wybierz" })).toHaveLength(5);
        expect(screen.getAllByRole("button", { name: "Posłuchaj" })).toHaveLength(6);
    });
});

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/lib/i18n";
import { neutralChainParams, neutralGlobals } from "@/audio/presets";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useSoundStore } from "@/stores/useSoundStore";
import Sound from "../../../pages/Sound";

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
        hasContext: () => false,
        getCurrentPreset: () => null,
        getAudioContext: vi.fn(() => {
            throw new Error("AudioContext is not available in tests");
        }),
        getVoiceBus: vi.fn(),
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
    useSoundStore.setState({ customPresets: [], isLoaded: false });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("Sound Studio page", () => {
    it("opens on the chain with the Sound Studio title and the active preset loaded", async () => {
        renderPage();

        expect(screen.getByRole("heading", { level: 1, name: "Sound Studio" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Classic guitar", pressed: true })).toBeInTheDocument();
        const chain = screen.getByTestId("signal-chain");
        expect(within(chain).getByRole("button", { name: /Amp/ })).toBeInTheDocument();
        expect(chain.className).toContain("overflow-x-auto");
    });

    it("keeps the master volume slider and updates the setting from the keyboard", async () => {
        renderPage();
        const slider = screen.getByRole("slider", { name: "Volume" });
        expect(slider).toHaveAttribute("aria-valuenow", "80");
        expect(slider).toHaveAttribute("aria-valuetext", "80 %");
        fireEvent.keyDown(slider, { key: "ArrowLeft" });
        await waitFor(() => {
            expect(useSettingsStore.getState().full.audio.volume).toBeCloseTo(0.79, 5);
        });
    });

    it("loads the selected built-in into the chain", async () => {
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: "Lead JCM800" }));
        await waitFor(() => {
            expect(useSettingsStore.getState().full.audio.soundPreset).toBe("nam-lead-jcm");
        });
        expect(screen.getByRole("button", { name: "Lead JCM800", pressed: true })).toBeInTheDocument();
        expect(screen.getByTestId("signal-chain").querySelector("[data-chain-block='cab']")).not.toBeNull();
        expect(screen.getByTestId("signal-chain").querySelector("[data-chain-block='comp']")).not.toBeNull();
        expect(screen.getByRole("button", { name: "Marshall JCM800 (NAM)", pressed: true })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Fender Deluxe Reverb (NAM)" })).toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Amp" })).not.toBeInTheDocument();
    });

    it("inserts, moves, bypasses and removes a block from the chain", async () => {
        renderPage();
        const chain = screen.getByTestId("signal-chain");
        const addButtons = within(chain).getAllByRole("button", { name: "Add effect" });
        fireEvent.click(addButtons[addButtons.length - 1]);
        fireEvent.click(screen.getByRole("button", { name: "Delay" }));
        expect(chain.querySelector("[data-chain-block='delay']")).not.toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Move left" }));
        const blocks = chain.querySelectorAll("[data-chain-block]");
        expect(blocks[blocks.length - 1]?.getAttribute("data-chain-block")).not.toBe("delay");

        fireEvent.click(screen.getByRole("button", { name: "Bypass" }));
        expect(chain.querySelector("[data-chain-block='delay']")).toHaveClass("opacity-50");
        fireEvent.click(screen.getByRole("button", { name: "Remove block" }));
        expect(chain.querySelector("[data-chain-block='delay']")).toBeNull();
    });

    it("steps a global knob from the keyboard", () => {
        renderPage();
        const input = screen.getByRole("slider", { name: "Input" });
        expect(input).toHaveAttribute("aria-valuetext", "1x");
        fireEvent.keyDown(input, { key: "ArrowUp" });
        expect(input).toHaveAttribute("aria-valuenow", "1.05");
        fireEvent.keyDown(input, { key: "Home" });
        expect(input).toHaveAttribute("aria-valuenow", "0");
        fireEvent.keyDown(input, { key: "End" });
        expect(input).toHaveAttribute("aria-valuenow", "2");
    });

    it("deletes a saved rig", async () => {
        await useSoundStore.getState().saveCustomPreset({
            name: "Room clean",
            amp: "classic",
            params: neutralChainParams(),
            assembly: "blocks",
            chain: [],
            globals: neutralGlobals(0),
        });
        renderPage();
        expect(await screen.findByRole("button", { name: "Room clean" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Delete tone" }));
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        await waitFor(() => {
            expect(screen.queryByRole("button", { name: "Room clean" })).not.toBeInTheDocument();
        });
    });

    it("uses the Sound Studio title in Polish", async () => {
        await i18n.changeLanguage("pl");
        renderPage();
        expect(screen.getByRole("heading", { level: 1, name: "Sound Studio" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Klasyczna gitara" })).toBeInTheDocument();
    });
});

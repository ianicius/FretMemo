import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/lib/i18n";
import ScoreViewer from "../ScoreViewer";

vi.mock("@/lib/analytics", () => ({
    trackEvent: vi.fn(),
    trackFeatureOpened: vi.fn(),
}));

// Mock classes live in vi.hoisted: the vi.mock factory is hoisted above
// every const declaration in this file.
const { FakeAlphaTabApi, apiInstanceHolder } = vi.hoisted(() => {
    class FakeEmitter<T = unknown> {
        private handlers: Array<(arg: T) => void> = [];
        on(handler: (arg: T) => void): void {
            this.handlers.push(handler);
        }
        emit(arg?: T): void {
            this.handlers.forEach((handler) => handler(arg as T));
        }
    }

    class FakeAlphaTabApi {
        playerReady = new FakeEmitter();
        playerStateChanged = new FakeEmitter<{ state: number; stopped: boolean }>();
        playerPositionChanged = new FakeEmitter<{ currentTime: number; endTime: number }>();
        soundFontLoad = new FakeEmitter<{ loaded: number; total: number }>();
        playerFinished = new FakeEmitter();
        playedBeatChanged = new FakeEmitter<{ voice: { bar: { index: number } } }>();
        error = new FakeEmitter();
        player = {
            soundFontLoadFailed: new FakeEmitter(),
            soundFontLoaded: new FakeEmitter(),
            ready: new FakeEmitter(),
            stateChanged: new FakeEmitter(),
        };

        playerState = 0; // Paused
        playbackSpeed = 1;
        masterVolume = 1;
        metronomeVolume = 0;
        // Minimal rendered-track fixture for the chord prompter:
        // track.staves[0].bars[0].voices[0].beats[0] with an annotated chord.
        tracks: Array<Record<string, unknown>> = [
            {
                name: 'Guitar',
                isPercussion: false,
                staves: [
                    {
                        bars: [
                            {
                                voices: [
                                    {
                                        beats: [
                                            {
                                                chordId: 'c1',
                                                chord: { name: 'Em' },
                                                notes: [{ realValue: 40 }, { realValue: 47 }, { realValue: 52 }],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
                chords: { c1: { name: 'Em' } },
            },
        ];
        settings: { core: Record<string, unknown>; display: Record<string, unknown>; player: Record<string, unknown> };
        renderScoreCalls: Array<{ tracks: number[] }> = [];
        destroyed = false;

        constructor(
            _element: unknown,
            settings: { core: Record<string, unknown>; display: Record<string, unknown>; player: Record<string, unknown> },
        ) {
            this.settings = settings;
            apiInstanceHolder.current = this;
        }
        renderScore(_score: unknown, tracks: number[]): void {
            this.renderScoreCalls.push({ tracks });
        }
        play(): Promise<boolean> {
            this.playerState = 1;
            this.playerStateChanged.emit({ state: 1, stopped: false });
            return Promise.resolve(true);
        }
        pause(): void {
            this.playerState = 0;
            this.playerStateChanged.emit({ state: 0, stopped: false });
        }
        stop(): void {
            this.playerState = 0;
            this.playerStateChanged.emit({ state: 0, stopped: true });
            this.playerPositionChanged.emit({ currentTime: 0, endTime: 64000 });
        }
        destroy(): void {
            this.destroyed = true;
        }
    }

    const apiInstanceHolder: { current: FakeAlphaTabApi | null } = { current: null };
    return { FakeAlphaTabApi, apiInstanceHolder };
});

vi.mock("@coderline/alphatab", () => {
    return {
        synth: { PlayerState: { Paused: 0, Playing: 1 } },
        PlayerMode: { Disabled: 0, EnabledAutomatic: 1, EnabledSynthesizer: 2 },
        StaveProfile: { ScoreTab: 1 },
        importer: {
            ScoreLoader: {
                loadScoreFromBytes: () => ({
                    title: "Playback Test Song",
                    tempo: 96,
                    tracks: [{ name: "Guitar", isPercussion: false }],
                    masterBars: [{ id: 1 }, { id: 2 }, { id: 3 }],
                }),
            },
        },
        Settings: class {
            core: Record<string, unknown> = {};
            display: Record<string, unknown> = {};
            player: Record<string, unknown> = {};
        },
        AlphaTabApi: FakeAlphaTabApi,
    };
});

vi.mock("@/lib/scoreStore", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/scoreStore")>();
    return {
        ...actual,
        getScoreBytes: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
        listScoreMeta: vi.fn().mockResolvedValue([
            {
                id: "song-1",
                name: "song.gp5",
                addedAt: 1_700_000_000_000,
                sizeBytes: 8,
                format: "gp5",
                title: "Playback Test Song",
                trackCount: 1,
                tempoBpm: 96,
            },
        ]),
    };
});

function renderViewer(): void {
    render(
        <MemoryRouter initialEntries={["/scores?id=song-1"]}>
            <ScoreViewer />
        </MemoryRouter>,
    );
}

beforeEach(async () => {
    apiInstanceHolder.current = null;
    await i18n.changeLanguage("en");
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

async function waitForViewerLoading(): Promise<void> {
    await waitFor(() => {
        expect(screen.getByText(/Loading instrument sounds/)).toBeInTheDocument();
    });
}

describe("ScoreViewer playback", () => {
    it("renders transport in soundfont-loading state, then enables Play when ready", async () => {
        renderViewer();
        await waitForViewerLoading();
        expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();

        act(() => {
            apiInstanceHolder.current?.playerReady.emit();
        });

        expect(screen.queryByText(/Loading instrument sounds/)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    });

    it("applies the bundled soundfont URL and synth player mode to settings", async () => {
        renderViewer();
        await waitForViewerLoading();
        const api = apiInstanceHolder.current!;
        expect(api.settings.player.soundFont).toContain("soundfont/MuseScore_General_Lite.sf3");
        expect(api.settings.player.playerMode).toBe(2); // EnabledSynthesizer
    });

    it("routes Play/Pause through the AlphaTabApi and follows state events", async () => {
        renderViewer();
        await waitForViewerLoading();
        act(() => {
            apiInstanceHolder.current?.playerReady.emit();
        });

        fireEvent.click(screen.getByRole("button", { name: "Play" }));
        expect(apiInstanceHolder.current?.playerState).toBe(1);

        act(() => {
            apiInstanceHolder.current?.playerStateChanged.emit({ state: 1, stopped: false });
            apiInstanceHolder.current?.playerPositionChanged.emit({
                currentTime: 12_000,
                endTime: 64_000,
            });
        });
        expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
        expect(screen.getByText("0:12")).toBeInTheDocument();
        expect(screen.getByText("1:04")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Pause" }));
        expect(apiInstanceHolder.current?.playerState).toBe(0);
    });

    it("speed changes reach the api", async () => {
        renderViewer();
        await waitForViewerLoading();
        act(() => {
            apiInstanceHolder.current?.playerReady.emit();
        });
        const api = apiInstanceHolder.current!;
        fireEvent.change(screen.getByLabelText("Speed"), { target: { value: "0.5" } });
        expect(api.playbackSpeed).toBe(0.5);
    });

    it("renders the score for the first non-percussion track", async () => {
        renderViewer();
        await waitFor(() => {
            expect(apiInstanceHolder.current?.renderScoreCalls.length).toBeGreaterThan(0);
        });
        expect(apiInstanceHolder.current?.renderScoreCalls[0].tracks).toEqual([0]);
    });

    it("shows the error branch when the soundfont fails and recovers on retry", async () => {
        renderViewer();
        await waitForViewerLoading();
        const api = apiInstanceHolder.current!;

        act(() => {
            api.error.emit();
        });
        expect(screen.getByRole("alert")).toHaveTextContent("Playback could not start");
        expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Retry" }));

        // Effect re-runs: fresh loading state, error cleared, API recreated.
        await waitFor(() => {
            expect(apiInstanceHolder.current).not.toBe(api);
            expect(screen.getByText(/Loading instrument sounds/)).toBeInTheDocument();
        });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("re-applies metronome volume to a recreated player on retry", async () => {
        renderViewer();
        await waitForViewerLoading();
        let api = apiInstanceHolder.current!;
        act(() => {
            api.playerReady.emit();
        });
        fireEvent.click(screen.getByRole("switch", { name: "Metronome" }));
        expect(api.metronomeVolume).toBe(0.5);

        act(() => {
            api.error.emit();
        });
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        await waitFor(() => {
            expect(apiInstanceHolder.current).not.toBe(api);
        });
        api = apiInstanceHolder.current!;
        expect(api.metronomeVolume).toBe(0.5);
    });
});

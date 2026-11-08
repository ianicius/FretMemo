import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import { TabEditorPanel } from "../TabEditorPanel";

const SUMMARY = [0, null, null, 7, null, null];

const baseProps = {
    summary: SUMMARY,
    stringCount: 6,
    duration: 4,
    barCount: 2,
    barIndex: 0,
    tempo: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    dirty: false,
    canUndo: true,
    canRedo: false,
    onFretChange: vi.fn(),
    onDurationChange: vi.fn(),
    onRest: vi.fn(),
    onAppendBar: vi.fn(),
    onDuplicateBar: vi.fn(),
    onRemoveBar: vi.fn(),
    onTempoChange: vi.fn(),
    onTimeSignatureChange: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSave: vi.fn(),
    onDownload: vi.fn(),
};

beforeEach(async () => {
    await i18n.changeLanguage("en");
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("TabEditorPanel", () => {
    it("renders one fret input per string with current values", () => {
        render(<TabEditorPanel {...baseProps} />);
        const inputs = screen.getAllByLabelText(/Fret — string/);
        expect(inputs).toHaveLength(6);
        // Panel reverses: top row = string 6, bottom row = string 1.
        expect((inputs[5] as HTMLInputElement).value).toBe("0");
        expect((inputs[2] as HTMLInputElement).value).toBe("7");
        expect((inputs[0] as HTMLInputElement).value).toBe("");
    });

    it("shows the save button disabled when not dirty", () => {
        render(<TabEditorPanel {...baseProps} />);
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("enables save when dirty and fires onSave on click", () => {
        render(<TabEditorPanel {...baseProps} dirty />);
        const save = screen.getByRole("button", { name: "Save" });
        expect(save).toBeEnabled();
        fireEvent.click(save);
        expect(baseProps.onSave).toHaveBeenCalledTimes(1);
    });

    it("routes fret edits with 0-based string index (panel reversed, index preserved)", () => {
        render(<TabEditorPanel {...baseProps} />);
        const inputs = screen.getAllByLabelText(/Fret — string/);
        // Top row renders string 6 (panel reverses); index passed is 5.
        fireEvent.change(inputs[0], { target: { value: "12" } });
        expect(baseProps.onFretChange).toHaveBeenCalledWith(5, 12);
        // Bottom row renders string 1.
        fireEvent.change(inputs[5], { target: { value: "3" } });
        expect(baseProps.onFretChange).toHaveBeenLastCalledWith(0, 3);
    });

    it("routes a cleared input as null (note removal)", () => {
        render(<TabEditorPanel {...baseProps} />);
        const inputs = screen.getAllByLabelText(/Fret — string/);
        // inputs[5] = string 1 with fret 0 — clearing fires (0, null).
        fireEvent.change(inputs[5], { target: { value: "" } });
        expect(baseProps.onFretChange).toHaveBeenCalledWith(0, null);
    });

    it("fires duration and rest callbacks", () => {
        render(<TabEditorPanel {...baseProps} />);
        fireEvent.change(screen.getByLabelText("Duration"), {
            target: { value: "8" },
        });
        expect(baseProps.onDurationChange).toHaveBeenCalledWith(8);
        fireEvent.click(screen.getByRole("button", { name: "Rest" }));
        expect(baseProps.onRest).toHaveBeenCalledTimes(1);
    });

    it("disables undo/redo per flags", () => {
        render(<TabEditorPanel {...baseProps} canUndo={false} canRedo />);
        expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
    });
});

describe("TabEditorPanel — bar ops and tempo", () => {
    it("shows the bar position and fires append/duplicate/remove callbacks", () => {
        render(<TabEditorPanel {...baseProps} />);
        expect(screen.getByText("Bar 1/2")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Bar" }));
        expect(baseProps.onAppendBar).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
        expect(baseProps.onDuplicateBar).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        expect(baseProps.onRemoveBar).toHaveBeenCalledTimes(1);
    });

    it("disables duplicate/remove without a current bar and remove on the last bar", () => {
        render(<TabEditorPanel {...baseProps} barIndex={null} />);
        expect(screen.getByRole("button", { name: "Duplicate" })).toBeDisabled();
        cleanup();
        render(<TabEditorPanel {...baseProps} barCount={1} barIndex={0} />);
        expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    });

    it("routes tempo changes clamped to 10-400", () => {
        render(<TabEditorPanel {...baseProps} />);
        const tempo = screen.getByLabelText("Tempo");
        fireEvent.change(tempo, { target: { value: "145" } });
        expect(baseProps.onTempoChange).toHaveBeenCalledWith(145);
        fireEvent.change(tempo, { target: { value: "999" } });
        expect(baseProps.onTempoChange).toHaveBeenLastCalledWith(400);
        fireEvent.change(tempo, { target: { value: "" } });
        expect(baseProps.onTempoChange).toHaveBeenCalledTimes(2);
    });
});

describe("TabEditorPanel — meter and download", () => {
    it("shows the current meter and fires time signature changes", () => {
        render(<TabEditorPanel {...baseProps} />);
        const numerator = screen.getByLabelText("Meter");
        expect((numerator as HTMLSelectElement).value).toBe("4");
        fireEvent.change(numerator, { target: { value: "6" } });
        expect(baseProps.onTimeSignatureChange).toHaveBeenCalledWith(6, 4);
        fireEvent.change(screen.getByLabelText("Meter denominator"), {
            target: { value: "8" },
        });
        expect(baseProps.onTimeSignatureChange).toHaveBeenLastCalledWith(4, 8);
    });

    it("disables meter selects without a current bar and fires download", () => {
        render(<TabEditorPanel {...baseProps} timeSignature={null} />);
        expect(screen.getByLabelText("Meter")).toBeDisabled();
        cleanup();
        render(<TabEditorPanel {...baseProps} />);
        fireEvent.click(screen.getByRole("button", { name: "Download .gp" }));
        expect(baseProps.onDownload).toHaveBeenCalledTimes(1);
    });
});

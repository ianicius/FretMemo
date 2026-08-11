import { afterEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/lib/i18n";
import { useSettingsStore } from "@/stores/useSettingsStore";
import CircleOfFifths from "../CircleOfFifths";
import ChordLibrary from "../ChordLibrary";

function setSharpRootSelectors(): void {
    const { full } = useSettingsStore.getState();
    useSettingsStore.setState({
        full: {
            ...full,
            instrument: {
                ...full.instrument,
                notation: "sharps",
            },
        },
    });
}

afterEach(async () => {
    await act(async () => {
        await i18n.changeLanguage("en");
    });
});

describe("localized theory notation", () => {
    it("keeps B and Bb in the English Circle of Fifths", async () => {
        await act(async () => {
            await i18n.changeLanguage("en");
        });
        render(<CircleOfFifths />);
        expect(screen.getAllByText("B").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Bb").length).toBeGreaterThan(0);
        expect(screen.queryByText("H")).not.toBeInTheDocument();
    });

    it("uses H and B at the Polish Circle boundary", async () => {
        await act(async () => {
            await i18n.changeLanguage("pl");
        });
        render(<CircleOfFifths />);
        expect(screen.getAllByText("H").length).toBeGreaterThan(0);
        expect(screen.getAllByText("B").length).toBeGreaterThan(0);
    });

    it("keeps the selected B chord heading in English", async () => {
        await act(async () => {
            await i18n.changeLanguage("en");
        });
        render(<ChordLibrary />);
        fireEvent.click(screen.getByRole("button", { name: "B" }));
        expect(screen.getByRole("heading", { level: 3, name: "B" })).toBeInTheDocument();
    });

    it("renders the selected B chord heading as H in Polish", async () => {
        await act(async () => {
            await i18n.changeLanguage("pl");
        });
        render(<ChordLibrary />);
        fireEvent.click(screen.getByRole("button", { name: "H" }));
        expect(screen.getByRole("heading", { level: 3, name: "H" })).toBeInTheDocument();
    });

    it("keeps the selected Bb chord heading in English when root selectors use sharps", async () => {
        setSharpRootSelectors();
        await act(async () => {
            await i18n.changeLanguage("en");
        });
        render(<ChordLibrary />);
        fireEvent.click(screen.getByRole("button", { name: "A#" }));
        expect(screen.getByRole("heading", { level: 3, name: "Bb" })).toBeInTheDocument();
    });

    it("renders the selected Bb chord heading as B in Polish when root selectors use sharps", async () => {
        setSharpRootSelectors();
        await act(async () => {
            await i18n.changeLanguage("pl");
        });
        render(<ChordLibrary />);
        fireEvent.click(screen.getByRole("button", { name: "A#" }));
        expect(screen.getByRole("heading", { level: 3, name: "B" })).toBeInTheDocument();
    });
});

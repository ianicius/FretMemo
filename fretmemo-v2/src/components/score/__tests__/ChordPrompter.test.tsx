import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@/lib/i18n"; // side-effect: initializes i18next for t()
import { ChordPrompter } from "../ChordPrompter";

const TIMELINE = [
    { name: "C", source: "annotation" as const },
    { name: "G", source: "annotation" as const },
    { name: "Am", source: "derived" as const },
    { name: "F", source: "annotation" as const },
    { name: "Dm", source: "derived" as const },
];

afterEach(() => cleanup());

describe("ChordPrompter", () => {
    it("hides itself when the timeline has no chords", () => {
        const { container } = render(
            <ChordPrompter timeline={null} currentBar={null} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("hides itself when the cursor has not entered the song yet", () => {
        const { container } = render(
            <ChordPrompter timeline={TIMELINE} currentBar={null} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the current chord big and upcoming chords small", () => {
        render(<ChordPrompter timeline={TIMELINE} currentBar={1} />);
        expect(screen.getByLabelText("Current chord")).toHaveTextContent("G");
        expect(screen.getByText("Next")).toBeInTheDocument();
        expect(screen.getByText("Am")).toBeInTheDocument();
        expect(screen.getByText("F")).toBeInTheDocument();
        expect(screen.getByText("Dm")).toBeInTheDocument();
    });

    it("follows the cursor to the last bar with no upcoming cells", () => {
        render(<ChordPrompter timeline={TIMELINE} currentBar={4} />);
        expect(screen.getByLabelText("Current chord")).toHaveTextContent("Dm");
        expect(screen.queryByText("Next")).not.toBeInTheDocument();
    });

    it("marks the current chord as a polite live region", () => {
        render(<ChordPrompter timeline={TIMELINE} currentBar={0} />);
        expect(screen.getByRole("status")).toHaveTextContent("C");
    });
});

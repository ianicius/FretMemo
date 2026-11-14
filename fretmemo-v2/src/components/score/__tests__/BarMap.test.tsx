import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import { BarMap } from "../BarMap";

const baseProps = {
    ratios: [1, 0.25, null, 0.6, 0.1] as Array<number | null>,
    onLoopWeak: vi.fn(),
    onReset: vi.fn(),
};

beforeEach(async () => {
    await i18n.changeLanguage("en");
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("BarMap", () => {
    it("renders one colored cell per bar with its ratio", () => {
        render(<BarMap {...baseProps} />);
        const cells = screen.getAllByTestId("bar-map-cell");
        expect(cells).toHaveLength(5);
        expect(cells[0].getAttribute("data-ratio")).toBe("100");
        expect(cells[1].getAttribute("data-ratio")).toBe("25");
        expect(cells[2].getAttribute("data-ratio")).toBe("none");
        expect(cells[3].getAttribute("data-ratio")).toBe("60");
        expect(cells[4].getAttribute("data-ratio")).toBe("10");
    });

    it("fires the loop-weak action", () => {
        render(<BarMap {...baseProps} />);
        fireEvent.click(screen.getByRole("button", { name: "Loop weak bars" }));
        expect(baseProps.onLoopWeak).toHaveBeenCalledTimes(1);
    });

    it("disables loop-weak without scored data and hides reset", () => {
        render(<BarMap {...baseProps} ratios={[null, null]} />);
        expect(screen.getByRole("button", { name: "Loop weak bars" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
    });

    it("shows the reset action when data exists", () => {
        render(<BarMap {...baseProps} />);
        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        expect(baseProps.onReset).toHaveBeenCalledTimes(1);
    });
});

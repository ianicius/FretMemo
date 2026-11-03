import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FretHighway, highwayFallOffset } from "../FretHighway";
import type { Position } from "@/types/fretboard";

function pos(fret: number, stringIndex: number, note: Position["note"]): Position {
    return { fret, stringIndex, note };
}

const TARGET = pos(3, 0, "C");
const UP1 = pos(5, 1, "D");
const UP2 = pos(7, 2, "E");
const UP3 = pos(10, 4, "G");

beforeEach(() => {
    vi.stubGlobal(
        "matchMedia",
        vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("FretHighway", () => {
    it("fall offset grows downward with the beat fraction and clamps to one lane", () => {
        // Regression guard for the fall direction: the offset must RISE with
        // the fraction (0 → lane height), never fall.
        const laneHeight = 56;
        expect(highwayFallOffset(0, laneHeight)).toBe(0);
        expect(highwayFallOffset(0.5, laneHeight)).toBe(laneHeight / 2);
        expect(highwayFallOffset(1, laneHeight)).toBe(laneHeight);
        expect(highwayFallOffset(1.5, laneHeight)).toBe(laneHeight);
        expect(highwayFallOffset(-1, laneHeight)).toBe(0);
        expect(
            highwayFallOffset(0.8, laneHeight) > highwayFallOffset(0.2, laneHeight),
        ).toBe(true);
    });

    it("renders the landing cell and a falling dot per queued position", () => {
        render(
            <FretHighway
                target={TARGET}
                upcoming={[UP1, UP2, UP3]}
                beatMs={500}
                lastBeatAt={Date.now()}
                answered={false}
                missed={false}
                tuning={["E", "B", "G", "D", "A", "E"]}
            />,
        );

        const landing = screen.getByTestId("fret-highway-landing");
        expect(landing).toHaveAttribute("data-fret", "3");
        expect(landing).toHaveAttribute("data-string", "0");

        const dots = screen.getAllByTestId("fret-highway-dot");
        expect(dots).toHaveLength(4);
        const frets = dots.map((dot) => dot.getAttribute("data-fret"));
        expect(frets).toEqual(["3", "5", "7", "10"]);
    });

    it("marks the target dot as answered for the hit flash", () => {
        render(
            <FretHighway
                target={TARGET}
                upcoming={[UP1, UP2, UP3]}
                beatMs={500}
                lastBeatAt={Date.now()}
                answered={true}
                missed={false}
                tuning={["E", "B", "G", "D", "A", "E"]}
            />,
        );

        const dots = screen.getAllByTestId("fret-highway-dot");
        expect(dots[0].className).toContain("fret-highway__dot--hit");
    });

    it("runs without requestAnimationFrame in reduced-motion mode", () => {
        const rafSpy = vi.spyOn(window, "requestAnimationFrame");
        vi.stubGlobal(
            "matchMedia",
            vi.fn().mockImplementation((query: string) => ({
                matches: query.includes("reduce"),
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        );

        render(
            <FretHighway
                target={TARGET}
                upcoming={[UP1, UP2]}
                beatMs={500}
                lastBeatAt={Date.now()}
                answered={false}
                missed={false}
                tuning={["E", "B", "G", "D", "A", "E"]}
            />,
        );

        expect(rafSpy).not.toHaveBeenCalled();
        expect(screen.getAllByTestId("fret-highway-dot")).toHaveLength(3);
    });

    it("freezes the fall offset when the clock is not running", async () => {
        render(
            <FretHighway
                target={TARGET}
                upcoming={[UP1, UP2]}
                beatMs={500}
                lastBeatAt={Date.now() - 5000} // stale stamp, would clamp to 1
                clockRunning={false}
                answered={false}
                missed={false}
                tuning={["E", "B", "G", "D", "A", "E"]}
            />,
        );

        // rAF applies offset 0 when the clock is off — dots stay in their slots.
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        const dot = screen.getAllByTestId("fret-highway-dot")[0];
        expect(dot.style.transform).toBe("translateY(0px)");
    });
});

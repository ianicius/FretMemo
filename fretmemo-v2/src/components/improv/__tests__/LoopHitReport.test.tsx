import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import { LoopHitReport } from "../LoopHitReport";
import { loopChordReport } from "@/lib/improv/loopTools";

/** B3: per-chord hit/miss list rendered after a mic-checked loop. */
describe("LoopHitReport (plan B3)", () => {
    beforeAll(async () => {
        await i18n.changeLanguage("en");
    });
    afterEach(() => cleanup());

    it("renders one item per chord with hit/miss and the hit count", () => {
        render(<LoopHitReport results={loopChordReport(["Am", "C", "Em", "D"], [true, false, true, false])} />);
        expect(screen.getByText("Last loop: 2/4 chords hit")).toBeInTheDocument();
        const items = screen.getAllByRole("listitem");
        expect(items.map((item) => item.textContent)).toEqual(["Amhit", "Cmissed", "Emhit", "Dmissed"]);
        expect(within(items[0] as HTMLElement).getByText("hit")).toHaveClass("sr-only");
    });

    it("uses Polish note names in Polish (Bb → B, B → H)", async () => {
        await i18n.changeLanguage("pl");
        render(<LoopHitReport results={loopChordReport(["Bb7", "Bmaj7"], [true, false])} />);
        const items = screen.getAllByRole("listitem");
        expect(items.map((item) => item.textContent)).toEqual(["B7trafiony", "Hmaj7nietrafiony"]);
        expect(screen.getByText("Ostatni obieg: trafione akordy 1/2")).toBeInTheDocument();
        await i18n.changeLanguage("en");
    });
});

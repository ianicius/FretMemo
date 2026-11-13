import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/locales/en/translation.json";
import pl from "@/locales/pl/translation.json";
import { CURRICULUM, IMPROV_ORDER } from "@/data/improv/curriculum";

/**
 * E-IMPROV-I18N: every improv key must resolve in BOTH locales.
 * 1. full structural parity of the `improv` namespace,
 * 2. the module map (names/terms/theory) matches IMPROV_ORDER 1:1,
 * 3. every exercise id has name + desc entries,
 * 4. every static t("improv…") literal in the improv sources resolves.
 */

const IMPROV_SOURCES = [
    path.resolve(process.cwd(), "src/pages/ImprovTraining.tsx"),
    ...["TheoryCard", "ExerciseFrame", "FretboardQuiz", "ChoiceQuiz", "DiagramDrill", "BackingLoopExercise"]
        .map((name) => path.resolve(process.cwd(), `src/components/improv/${name}.tsx`)),
];

function flattenLeaves(node: unknown, prefix = ""): string[] {
    if (typeof node !== "object" || node === null) {
        return [prefix];
    }
    return Object.entries(node).flatMap(([key, value]) =>
        flattenLeaves(value, prefix ? `${prefix}.${key}` : key),
    );
}

function resolveKey(root: unknown, key: string): unknown {
    return key.split(".").reduce<unknown>((acc, part) => {
        if (typeof acc === "object" && acc !== null && part in (acc as Record<string, unknown>)) {
            return (acc as Record<string, unknown>)[part];
        }
        return undefined;
    }, root);
}

const PLURAL_SUFFIXES = ["_one", "_few", "_many", "_other"] as const;

function leafExists(root: unknown, key: string): boolean {
    const value = resolveKey(root, key);
    if (typeof value === "string" || typeof value === "object") {
        return true;
    }
    // i18next plural keys: a literal like t("improv.drill.threshold", { count })
    // resolves through its _one/_few/_many/_other variants (same suffix set in
    // both locales, enforced by the parity assertion above).
    const parentKey = key.split(".").slice(0, -1).join(".");
    const lastPart = key.split(".").slice(-1)[0];
    const parent = resolveKey(root, parentKey);
    if (typeof parent !== "object" || parent === null) {
        return false;
    }
    return PLURAL_SUFFIXES.some(
        (suffix) => typeof (parent as Record<string, unknown>)[`${lastPart}${suffix}`] === "string",
    );
}

describe("improv i18n parity (en + pl)", () => {
    it("the improv namespace has identical leaf keys in both locales", () => {
        const enKeys = flattenLeaves(en.improv).sort();
        const plKeys = flattenLeaves(pl.improv).sort();
        expect(enKeys.length).toBeGreaterThan(250);
        expect(plKeys).toEqual(enKeys);
    });

    it("module name/term/theory entries match IMPROV_ORDER 1:1 in both locales", () => {
        for (const locale of [en, pl]) {
            const modulesMap = locale.improv.modules as Record<string, { name: string; term: string; theory: string }>;
            const ids = Object.keys(modulesMap);
            expect(ids).toEqual(IMPROV_ORDER);
            for (const module of CURRICULUM) {
                const entry = modulesMap[module.id];
                expect(entry.name).toBeTruthy();
                expect(entry.term).toBeTruthy();
                expect(entry.theory.split(/[.!?]/).filter((sentence) => sentence.trim().length > 0).length).toBeGreaterThanOrEqual(3);
            }
        }
    });

    it("every curriculum exercise has name + desc entries in both locales", () => {
        const exerciseIds = CURRICULUM.flatMap((module) => module.exercises.map((exercise) => exercise.id));
        for (const locale of [en, pl]) {
            const exMap = locale.improv.ex as Record<string, { name: string; desc: string }>;
            const keys = Object.keys(exMap);
            expect(keys.sort()).toEqual([...exerciseIds].sort());
            for (const id of exerciseIds) {
                expect(exMap[id]?.name).toBeTruthy();
                expect(exMap[id]?.desc).toBeTruthy();
            }
        }
    });

    it("every static t() literal in the improv sources resolves in both locales", () => {
        const literal = /(?<![\w$.])t\(\s*["']([a-zA-Z0-9_.]+)["']/g;
        const used = new Set<string>();
        for (const file of IMPROV_SOURCES) {
            const source = readFileSync(file, "utf8");
            for (const match of source.matchAll(literal)) {
                if (match[1].startsWith("improv.")) used.add(match[1]);
            }
        }
        expect(used.size).toBeGreaterThan(30);
        for (const key of used) {
            expect(leafExists(en, key), `missing in en: ${key}`).toBe(true);
            expect(leafExists(pl, key), `missing in pl: ${key}`).toBe(true);
        }
    });
});

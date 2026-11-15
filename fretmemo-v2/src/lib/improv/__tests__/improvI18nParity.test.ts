import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/locales/en/translation.json";
import pl from "@/locales/pl/translation.json";
import { CURRICULUM, IMPROV_ORDER, STANDARDS, type BackingLoopParams } from "@/data/improv/curriculum";

/**
 * E-IMPROV-I18N: every improv key must resolve in BOTH locales.
 * 1. full structural parity of the `improv` namespace,
 * 2. the module map (names/terms/theory) matches IMPROV_ORDER 1:1,
 * 3. every exercise id has name + desc entries,
 * 4. every static t("improv…") literal in the improv sources resolves.
 */

const IMPROV_SOURCES = [
    path.resolve(process.cwd(), "src/pages/ImprovTraining.tsx"),
    ...["TheoryCard", "ExerciseFrame", "ChoiceQuiz", "DiagramDrill", "BackingLoopExercise", "PracticeLinkExercise", "LoopHitReport"]
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

describe("generator prompt keys (plan 5 audit)", () => {
    it("every generated question prompt resolves in both locales", async () => {
        const { generateChoiceQuiz, listChoiceGeneratorIds } = await import("@/lib/improv/questions");
        const en = (JSON.parse(readFileSync(process.cwd() + "/src/locales/en/translation.json", "utf8")) as { improv: { q: Record<string, unknown> } }).improv.q;
        const pl = (JSON.parse(readFileSync(process.cwd() + "/src/locales/pl/translation.json", "utf8")) as { improv: { q: Record<string, unknown> } }).improv.q;
        const hasLeaf = (node: Record<string, unknown> | undefined, key: string): boolean => {
            const parts = key.split(".");
            let cur: unknown = node;
            for (const part of parts.slice(0, -1)) {
                if (typeof cur !== "object" || cur === null || !(part in (cur as Record<string, unknown>))) return false;
                cur = (cur as Record<string, unknown>)[part];
            }
            if (typeof cur !== "object" || cur === null) return false;
            const box = cur as Record<string, unknown>;
            const last = parts[parts.length - 1];
            // i18next plural keys: countToKey_one/_other count as countToKey.
            if (last in box) return box[last] !== null && box[last] !== undefined;
            return Object.keys(box).some((child) => child.startsWith(last + "_"));
        };
        for (const generatorId of listChoiceGeneratorIds()) {
            const questions = generateChoiceQuiz({ generatorId, questionCount: 40, allowedGenerators: [generatorId] }, `promptkeys:${generatorId}`);
            for (const question of questions) {
                // promptKey is "improv.q.…" — walk from the improv.q node.
                const relative = question.promptKey.replace("improv.q.", "");
                expect(hasLeaf(en, relative), `EN missing: ${question.promptKey}`).toBe(true);
                expect(hasLeaf(pl, relative), `PL missing: ${question.promptKey}`).toBe(true);
            }
        }
    });
});

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
        const exerciseIds = [...CURRICULUM.flatMap((module) => module.exercises.map((exercise) => exercise.id)), STANDARDS.id];
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

    it("every loop goal/label/hint key of the curriculum resolves in both locales (plan B4)", () => {
        const keys = new Set<string>();
        for (const module of CURRICULUM) {
            for (const exercise of module.exercises) {
                if (exercise.engine !== "backing-improv") continue;
                const params = exercise.params as BackingLoopParams;
                const progressions = [params.progression, ...(params.variants ?? []).map((variant) => variant.progression)];
                keys.add(params.goalKey);
                for (const variant of params.variants ?? []) {
                    keys.add(variant.goalKey);
                    keys.add(variant.labelKey);
                }
                for (const entry of progressions.flat()) {
                    if (typeof entry !== "string" && entry.hintKey) keys.add(entry.hintKey);
                }
            }
        }
        for (const required of ["improv.hints.barPlay", "improv.hints.barRest", "improv.hints.barQuestion1", "improv.hints.barAnswer2", "improv.goals.playRestLabel", "improv.goals.callResponseLabel"]) {
            expect(keys.has(required), required).toBe(true);
        }
        for (const key of keys) {
            expect(typeof resolveKey(en, key), `missing in en: ${key}`).toBe("string");
            expect(typeof resolveKey(pl, key), `missing in pl: ${key}`).toBe("string");
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

# P1 Correctness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every known application route directly loadable on GitHub Pages, enforce the EN/PL B–H notation boundary, and remove the audited English leaks and Polish grammar errors from material practice paths.

**Architecture:** Keep `BrowserRouter` and generate a static HTML entry point for each concrete application route after Vite builds. Centralize locale-sensitive note-token formatting in `noteNotation.ts`, represent practice feedback as semantic data translated at render time, and use i18next plural categories for catalog counts.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, React Router 7, i18next 25, Zustand 5, Vitest 4, Testing Library, Node.js ESM, GitHub Pages.

## Global Constraints

- Keep readable path-based URLs and `BrowserRouter`; do not adopt hash URLs.
- Continue serving the application as static files from GitHub Pages on the custom domain `fretmemo.net`.
- Do not publish, push, or modify external hosting configuration in this change.
- Do not change blog, FAQ, legacy `/v1`, legacy `/v2`, or unrelated static pages.
- Implement behavioral changes test-first and observe each new regression test fail for the expected reason before editing production code.
- Preserve the existing user setting for sharps, flats, and random notation where it already applies.
- Do not run the repository's current `npm run build` directly during development because its configured output is the tracked repository root; use a disposable output directory for verification.
- Do not stage `.claude/` or `audits/gauntlet-fretmemo-2026-08-11/`.

---

### Task 1: Generate static entry points for all concrete application routes

**Files:**
- Create: `fretmemo-v2/app-route-entrypoints.json`
- Create: `fretmemo-v2/scripts/generate-spa-entrypoints.mjs`
- Create: `fretmemo-v2/scripts/__tests__/generate-spa-entrypoints.test.mjs`
- Modify: `fretmemo-v2/package.json:6-12`

**Interfaces:**
- Consumes: root application shell `<outDir>/index.html` produced by Vite.
- Produces: `validateSpaRoute(route: string): string` and `generateSpaEntrypoints({ outDir, routes? }): Promise<string[]>` from `scripts/generate-spa-entrypoints.mjs`.
- Produces: a manifest with exactly 27 non-root concrete entry paths.

- [ ] **Step 1: Add the route manifest and a failing generator test**

Create `fretmemo-v2/app-route-entrypoints.json` with this exact initial route set:

```json
{
  "routes": [
    "/train",
    "/practice",
    "/library",
    "/challenges",
    "/me",
    "/progress",
    "/settings",
    "/technique/spider",
    "/technique/permutation",
    "/technique/linear",
    "/technique/diagonal",
    "/technique/stringskip",
    "/technique/legato",
    "/theory/scales",
    "/theory/circle",
    "/theory/caged",
    "/theory/triads",
    "/theory/chords",
    "/theory/intervals",
    "/ear-training/sound-to-fret",
    "/ear-training/intervals",
    "/ear-training/chord-quality",
    "/ear-training/functional",
    "/rhythm/tap-beat",
    "/rhythm/strum-patterns",
    "/rhythm/rhythm-reading",
    "/rhythm/groove-lab"
  ]
}
```

Create `fretmemo-v2/scripts/__tests__/generate-spa-entrypoints.test.mjs` using real temporary files:

```js
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import routeManifest from "../../app-route-entrypoints.json" with { type: "json" };
import { generateSpaEntrypoints, validateSpaRoute } from "../generate-spa-entrypoints.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createOutputDirectory() {
  const path = await mkdtemp(join(tmpdir(), "fretmemo-entrypoints-"));
  temporaryDirectories.push(path);
  await writeFile(join(path, "index.html"), "<html><body>FretMemo shell</body></html>", "utf8");
  return path;
}

describe("generateSpaEntrypoints", () => {
  it("creates an identical application shell for every manifest route", async () => {
    const outDir = await createOutputDirectory();
    const generated = await generateSpaEntrypoints({ outDir });

    expect(routeManifest.routes).toHaveLength(27);
    expect(generated).toHaveLength(routeManifest.routes.length);
    for (const route of routeManifest.routes) {
      expect(await readFile(join(outDir, route.slice(1), "index.html"), "utf8"))
        .toBe("<html><body>FretMemo shell</body></html>");
    }
  });

  it("does not change excluded static surfaces", async () => {
    const outDir = await createOutputDirectory();
    for (const directory of ["blog", "v1", "v2"]) {
      await mkdir(join(outDir, directory), { recursive: true });
      await writeFile(join(outDir, directory, "index.html"), `${directory}-sentinel`, "utf8");
    }
    await writeFile(join(outDir, "faq.html"), "faq-sentinel", "utf8");

    await generateSpaEntrypoints({ outDir });

    expect(await readFile(join(outDir, "blog", "index.html"), "utf8")).toBe("blog-sentinel");
    expect(await readFile(join(outDir, "v1", "index.html"), "utf8")).toBe("v1-sentinel");
    expect(await readFile(join(outDir, "v2", "index.html"), "utf8")).toBe("v2-sentinel");
    expect(await readFile(join(outDir, "faq.html"), "utf8")).toBe("faq-sentinel");
  });

  it.each(["../escape", "/../escape", "/blog", "/faq", "/v1/tool", "/v2/tool"])(
    "rejects unsafe or excluded route %s",
    (route) => expect(() => validateSpaRoute(route)).toThrow(),
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
cd fretmemo-v2
npm test -- scripts/__tests__/generate-spa-entrypoints.test.mjs
```

Expected: FAIL because `scripts/generate-spa-entrypoints.mjs` does not exist.

- [ ] **Step 3: Implement the safe entry-point generator**

Create `fretmemo-v2/scripts/generate-spa-entrypoints.mjs`. The implementation must:

```js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, "..");
const manifest = JSON.parse(await readFile(resolve(packageDirectory, "app-route-entrypoints.json"), "utf8"));
const EXCLUDED_ROOTS = new Set(["blog", "faq", "v1", "v2"]);

export function validateSpaRoute(route) {
  if (typeof route !== "string" || !route.startsWith("/") || route === "/" || isAbsolute(route.slice(1))) {
    throw new Error(`Invalid SPA route: ${String(route)}`);
  }
  const segments = route.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Unsafe SPA route: ${route}`);
  }
  if (EXCLUDED_ROOTS.has(segments[0])) {
    throw new Error(`Excluded static route: ${route}`);
  }
  return `/${segments.join("/")}`;
}

export async function generateSpaEntrypoints({ outDir, routes = manifest.routes } = {}) {
  const resolvedOutDir = resolve(outDir ?? resolve(packageDirectory, ".."));
  const shell = await readFile(resolve(resolvedOutDir, "index.html"), "utf8");
  const generated = [];
  for (const rawRoute of routes) {
    const route = validateSpaRoute(rawRoute);
    const routeDirectory = resolve(resolvedOutDir, `.${route}`);
    const relativeTarget = relative(resolvedOutDir, routeDirectory);
    if (relativeTarget.startsWith(`..${sep}`) || relativeTarget === "..") {
      throw new Error(`Route escapes output directory: ${route}`);
    }
    await mkdir(routeDirectory, { recursive: true });
    const target = resolve(routeDirectory, "index.html");
    await writeFile(target, shell, "utf8");
    generated.push(target);
  }
  return generated;
}

function readOutDirArgument(argv) {
  const index = argv.indexOf("--out-dir");
  if (index === -1) return resolve(packageDirectory, "..");
  if (!argv[index + 1]) throw new Error("--out-dir requires a path");
  return resolve(packageDirectory, argv[index + 1]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const generated = await generateSpaEntrypoints({ outDir: readOutDirArgument(process.argv.slice(2)) });
  console.log(`Generated ${generated.length} SPA entry points.`);
}
```

- [ ] **Step 4: Verify GREEN and wire the production build**

Run the focused test again; expect 3 passing tests. Then change the build script in `fretmemo-v2/package.json` to:

```json
"build": "tsc -b && vite build && node scripts/generate-spa-entrypoints.mjs --out-dir .."
```

Run the focused test once more to prove the package change did not affect the generator.

- [ ] **Step 5: Commit Task 1**

```powershell
git add fretmemo-v2/app-route-entrypoints.json fretmemo-v2/scripts/generate-spa-entrypoints.mjs fretmemo-v2/scripts/__tests__/generate-spa-entrypoints.test.mjs fretmemo-v2/package.json
git commit -m "fix: generate static application route entries"
```

---

### Task 2: Centralize EN/PL note tokens and repair Circle, chords, and tunings

**Files:**
- Modify: `fretmemo-v2/src/lib/noteNotation.ts:1-190`
- Modify: `fretmemo-v2/src/lib/__tests__/noteNotation.test.ts:1-100`
- Create: `fretmemo-v2/src/components/theory/__tests__/localizedNotation.test.tsx`
- Modify: `fretmemo-v2/src/components/theory/CircleOfFifths.tsx:1-150`
- Modify: `fretmemo-v2/src/components/theory/ChordLibrary.tsx:1-220`
- Modify: `fretmemo-v2/src/pages/Settings.tsx:198-207`
- Modify: `fretmemo-v2/src/locales/pl/translation.json:810-824`

**Interfaces:**
- Produces: `formatLocalizedNoteToken(value: string, language: string | null | undefined): string`.
- Preserves: `formatPitchClass()` and `formatPitchClassWithEnharmonic()` signatures and notation-setting behavior.
- Consumes: `i18n.resolvedLanguage ?? i18n.language` in React components.

- [ ] **Step 1: Add failing pure formatter tests**

Extend `noteNotation.test.ts` imports with `formatLocalizedNoteToken`, add `import i18n from "@/lib/i18n";`, and add:

```ts
it.each([
  ["B", "en", "B"],
  ["Bb", "en", "Bb"],
  ["Bm7b5", "en", "Bm7b5"],
  ["Bbmaj7", "en", "Bbmaj7"],
  ["B", "pl", "H"],
  ["Bb", "pl", "B"],
  ["Bm7b5", "pl", "Hm7b5"],
  ["Bbmaj7", "pl-PL", "Bmaj7"],
  ["F#", "pl", "F#"],
])("formats %s for %s as %s", (input, language, expected) => {
  expect(formatLocalizedNoteToken(input, language)).toBe(expected);
});
```

- [ ] **Step 2: Run the note-notation test and verify RED**

```powershell
cd fretmemo-v2
npm test -- src/lib/__tests__/noteNotation.test.ts
```

Expected: FAIL because `formatLocalizedNoteToken` is not exported.

- [ ] **Step 3: Implement the pure locale boundary and reuse it internally**

Add to `noteNotation.ts`:

```ts
export function formatLocalizedNoteToken(
  value: string,
  language: string | null | undefined,
): string {
  const baseLanguage = language?.toLowerCase().split("-")[0];
  return baseLanguage === "pl" ? applyPolishNotation(value) : value;
}
```

Replace direct language branches inside `formatPitchClass()` and `formatPitchClassWithEnharmonic()` with calls to this function using `i18n.resolvedLanguage ?? i18n.language`. Re-run the focused test and expect all note-notation tests to pass.

- [ ] **Step 4: Add failing component tests for Circle and Chord Library**

Create `localizedNotation.test.tsx` with a language reset and real i18n:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/lib/i18n";
import CircleOfFifths from "../CircleOfFifths";
import ChordLibrary from "../ChordLibrary";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("localized theory notation", () => {
  it("keeps B and Bb in the English Circle of Fifths", async () => {
    await i18n.changeLanguage("en");
    render(<CircleOfFifths />);
    expect(screen.getAllByText("B").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bb").length).toBeGreaterThan(0);
    expect(screen.queryByText("H")).not.toBeInTheDocument();
  });

  it("uses H and B at the Polish Circle boundary", async () => {
    await i18n.changeLanguage("pl");
    render(<CircleOfFifths />);
    expect(screen.getAllByText("H").length).toBeGreaterThan(0);
    expect(screen.getAllByText("B").length).toBeGreaterThan(0);
  });

  it("keeps the selected B chord heading in English", async () => {
    await i18n.changeLanguage("en");
    render(<ChordLibrary />);
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    expect(screen.getByRole("heading", { level: 3, name: "B" })).toBeInTheDocument();
  });

  it("renders the selected B chord heading as H in Polish", async () => {
    await i18n.changeLanguage("pl");
    render(<ChordLibrary />);
    fireEvent.click(screen.getByRole("button", { name: "H" }));
    expect(screen.getByRole("heading", { level: 3, name: "H" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the component test and verify RED**

```powershell
npm test -- src/components/theory/__tests__/localizedNotation.test.tsx
```

Expected: English assertions fail because both components still apply Polish notation unconditionally.

- [ ] **Step 6: Migrate both theory components to the shared boundary**

In both components obtain the language from `useTranslation()`:

```ts
const { t, i18n } = useTranslation();
const language = i18n.resolvedLanguage ?? i18n.language;
```

In `CircleOfFifths.tsx`, replace every direct `applyPolishNotation(...)` display call with `formatLocalizedNoteToken(..., language)` and include `language` in the `keyData` memo dependencies. In `ChordLibrary.tsx`, replace:

```ts
const displayChordName = applyPolishNotation(chordData.symbol || chordName);
```

with:

```ts
const displayChordName = formatLocalizedNoteToken(chordData.symbol || chordName, language);
```

Remove the now-unused `applyPolishNotation` imports. Run the component and note-notation tests; both must pass.

- [ ] **Step 7: Add a failing tuning-boundary test**

Add to `noteNotation.test.ts` after changing i18n language in a `try/finally` block:

```ts
it("formats every note in a Polish tuning summary", async () => {
  const previousLanguage = i18n.resolvedLanguage ?? i18n.language;
  try {
    await i18n.changeLanguage("pl");
    expect(["E", "A", "D", "G", "B", "E"].map((note) => formatPitchClass(note)).join("-"))
      .toBe("E-A-D-G-H-E");
  } finally {
    await i18n.changeLanguage(previousLanguage || "en");
  }
});
```

This should pass at the helper level but exposes that `Settings.tsx` does not use the helper. Add `formatTuningSummary` to the import list and add this failing test:

```ts
it("builds a localized tuning summary through the shared formatter", async () => {
  const previousLanguage = i18n.resolvedLanguage ?? i18n.language;
  try {
    await i18n.changeLanguage("pl");
    expect(formatTuningSummary(["E", "A", "D", "G", "B", "E"], "sharps"))
      .toBe("E-A-D-G-H-E");
  } finally {
    await i18n.changeLanguage(previousLanguage || "en");
  }
});
```

Run the focused test and expect a module-export failure because `formatTuningSummary` does not exist yet.

- [ ] **Step 8: Implement and consume `formatTuningSummary`**

Add to `noteNotation.ts`:

```ts
export function formatTuningSummary(
  notesLowToHigh: readonly string[],
  notation: NoteDisplayMode = "sharps",
): string {
  return notesLowToHigh.map((note, index) => formatPitchClass(note, notation, `tuning:${index}:${note}`)).join("-");
}
```

In `Settings.tsx`, read the current notation setting and replace the raw join:

```ts
const selectedTuningSummary = formatTuningSummary(
  selectedTuning.slice().reverse(),
  full.instrument.notation,
);
```

Update only the Polish preset labels that contain B pitch classes:

```json
"standard": "Standard (E-A-D-G-H-E)",
"drop-d": "Drop D (D-A-D-G-H-E)",
"standard-7": "Standard 7 (H-E-A-D-G-H-E)",
"drop-a-7": "Drop A 7 (A-E-A-D-G-H-E)",
"standard-8": "Standard 8 (F#-H-E-A-D-G-H-E)",
"bass-standard-5": "Bas standard 5 (H-E-A-D-G)"
```

Run the note-notation and component tests again.

- [ ] **Step 9: Commit Task 2**

```powershell
git add fretmemo-v2/src/lib/noteNotation.ts fretmemo-v2/src/lib/__tests__/noteNotation.test.ts fretmemo-v2/src/components/theory/CircleOfFifths.tsx fretmemo-v2/src/components/theory/ChordLibrary.tsx fretmemo-v2/src/components/theory/__tests__/localizedNotation.test.tsx fretmemo-v2/src/pages/Settings.tsx fretmemo-v2/src/locales/pl/translation.json
git commit -m "fix: respect locale note notation across theory tools"
```

---

### Task 3: Store semantic practice feedback and translate it at render time

**Files:**
- Create: `fretmemo-v2/src/lib/practiceFeedback.ts`
- Create: `fretmemo-v2/src/lib/__tests__/practiceFeedback.test.ts`
- Modify: `fretmemo-v2/src/stores/useGameStore.ts:1-1280`
- Modify: `fretmemo-v2/src/pages/Practice.tsx:90-1080`
- Modify: `fretmemo-v2/src/locales/en/translation.json:576-730`
- Modify: `fretmemo-v2/src/locales/pl/translation.json:578-732`

**Interfaces:**
- Produces: discriminated union `PracticeFeedback` with `kind` values `prompt`, `correct`, `incorrect-note`, `incorrect-position`, `too-slow`, `incorrect-detected`, and `hint`.
- Produces: `getPromptFeedback(mode: PracticeMode): PracticeFeedback`.
- Produces: `translatePracticeFeedback(feedback, translate, formatNote?): string` and `getPracticeFeedbackTone(feedback): "success" | "error" | "neutral"`.
- Replaces: `GameState.feedbackMessage: string | null` with `GameState.feedback: PracticeFeedback | null`.

- [ ] **Step 1: Write failing pure feedback tests**

Create `practiceFeedback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import {
  getPracticeFeedbackTone,
  getPromptFeedback,
  translatePracticeFeedback,
  type PracticeFeedback,
} from "../practiceFeedback";

describe("practice feedback", () => {
  it.each([
    ["en", { kind: "prompt", mode: "fretboardToNote" }, "Identify the note!"],
    ["pl", { kind: "prompt", mode: "fretboardToNote" }, "Rozpoznaj nutę!"],
    ["en", { kind: "correct" }, "Correct!"],
    ["pl", { kind: "correct" }, "Poprawnie!"],
    ["pl", { kind: "incorrect-note", actualNote: "B" }, "Niepoprawnie! Prawidłowa nuta: H"],
    ["pl", { kind: "incorrect-position", stringNumber: 4, fret: 5 }, "Niepoprawnie! Prawidłowo: struna 4, próg 5"],
    ["pl", { kind: "too-slow" }, "Za wolno!"],
  ])("renders %s feedback", (language, feedback, expected) => {
    const t = i18n.getFixedT(language);
    const formatNote = (note: string) => language === "pl" && note === "B" ? "H" : note;
    expect(translatePracticeFeedback(feedback as PracticeFeedback, t, formatNote)).toBe(expected);
  });

  it("derives styling from semantic feedback rather than English text", () => {
    expect(getPracticeFeedbackTone({ kind: "correct" })).toBe("success");
    expect(getPracticeFeedbackTone({ kind: "too-slow" })).toBe("error");
    expect(getPracticeFeedbackTone(getPromptFeedback("playNotes"))).toBe("neutral");
  });
});
```

- [ ] **Step 2: Run the feedback test and verify RED**

```powershell
npm test -- src/lib/__tests__/practiceFeedback.test.ts
```

Expected: FAIL because `practiceFeedback.ts` does not exist.

- [ ] **Step 3: Implement the semantic feedback module and translation keys**

Define the union in `practiceFeedback.ts` using the existing exported `PracticeMode` type:

```ts
import type { PracticeMode } from "@/stores/useGameStore";

export type PracticeFeedback =
  | { kind: "prompt"; mode: PracticeMode }
  | { kind: "correct" }
  | { kind: "incorrect-note"; actualNote: string }
  | { kind: "incorrect-position"; stringNumber: number; fret: number }
  | { kind: "too-slow" }
  | { kind: "incorrect-detected"; note: string }
  | { kind: "hint"; note: string; penalty: number };
```

Use this exact translation-key mapping:

```ts
const PROMPT_KEYS: Record<PracticeMode, string> = {
  fretboardToNote: "practice.feedback.prompts.identifyNote",
  tabToNote: "practice.feedback.prompts.identifyNote",
  noteToTab: "practice.feedback.prompts.pickTab",
  playNotes: "practice.feedback.prompts.playNote",
  playTab: "practice.feedback.prompts.playSequence",
};
```

The translator switch must map semantic fields, not inspect rendered English:

```ts
export function translatePracticeFeedback(
  feedback: PracticeFeedback | null,
  translate: (key: string, options?: Record<string, unknown>) => string,
  formatNote: (note: string) => string = (note) => note,
): string {
  if (!feedback) return "";
  switch (feedback.kind) {
    case "prompt": return translate(PROMPT_KEYS[feedback.mode]);
    case "correct": return translate("practice.feedback.correct");
    case "incorrect-note": return translate("practice.feedback.incorrectNote", { note: formatNote(feedback.actualNote) });
    case "incorrect-position": return translate("practice.feedback.incorrectPosition", { string: feedback.stringNumber, fret: feedback.fret });
    case "too-slow": return translate("practice.feedback.tooSlow");
    case "incorrect-detected": return translate("practice.feedback.incorrectDetected", { note: formatNote(feedback.note) });
    case "hint": return translate("practice.feedback.hint", { note: formatNote(feedback.note), penalty: feedback.penalty });
  }
}
```

Add the exact semantic helpers used by the store and page:

```ts
export function getPromptFeedback(mode: PracticeMode): PracticeFeedback {
  return { kind: "prompt", mode };
}

export function getPracticeFeedbackTone(
  feedback: PracticeFeedback,
): "success" | "error" | "neutral" {
  if (feedback.kind === "correct") return "success";
  if (["incorrect-note", "incorrect-position", "too-slow", "incorrect-detected"].includes(feedback.kind)) {
    return "error";
  }
  return "neutral";
}
```

Add matching EN/PL catalog entries. Include exactly the expected strings from the test plus translations for the other prompt, detected-note, and hint cases.

- [ ] **Step 4: Verify GREEN for the pure feedback module**

Run the focused test. Expected: all cases pass without changing the store or page yet.

- [ ] **Step 5: Add a failing regression guard for the store literals**

Extend `practiceFeedback.test.ts` by reading `useGameStore.ts` with Node `readFileSync` and asserting that these user-visible literals are absent:

```ts
it("keeps user-visible feedback literals out of the game store", () => {
  const source = readFileSync(new URL("../../stores/useGameStore.ts", import.meta.url), "utf8");
  for (const literal of [
    "Identify the note!",
    "Pick the correct tab position!",
    "Play the note (mic)!",
    "Play the tab sequence (mic)!",
    "Correct!",
    "Incorrect! It was",
    "Too slow!",
  ]) {
    expect(source).not.toContain(literal);
  }
});
```

Run the test and confirm this new case fails against the current store.

- [ ] **Step 6: Replace store strings with semantic feedback**

In `useGameStore.ts`:

- import `PracticeFeedback` and `getPromptFeedback`;
- rename state property `feedbackMessage` to `feedback`;
- replace prompt strings with `getPromptFeedback(mode)`;
- replace success with `{ kind: "correct" }`;
- replace note errors with `{ kind: "incorrect-note", actualNote }`;
- replace position errors with `{ kind: "incorrect-position", stringNumber: targetPosition.stringIndex + 1, fret: targetPosition.fret }`;
- replace timeout with `{ kind: "too-slow" }`;
- replace detected-note errors with `{ kind: "incorrect-detected", note }`;
- replace hints with `{ kind: "hint", note: hintedNote, penalty: 5 }`.

Do not translate inside the Zustand store.

- [ ] **Step 7: Render semantic feedback in `Practice.tsx`**

Derive text and tone near the existing store destructure:

```ts
const feedbackText = translatePracticeFeedback(
  feedback,
  t,
  (note) => formatPitchClass(note, displayNotation, notationSeed, accidentalComplexity),
);
const feedbackTone = feedback ? getPracticeFeedbackTone(feedback) : null;
```

Replace every English-string comparison with `feedback.kind` or `feedbackTone`. Pass `feedbackText` to the visible status, `AriaLiveAnnouncer`, and timeout overlay. Keep session scoring and timing behavior unchanged.

- [ ] **Step 8: Run focused and full practice-related tests**

```powershell
npm test -- src/lib/__tests__/practiceFeedback.test.ts src/lib/__tests__/noteNotation.test.ts
```

Expected: all focused tests pass and the store-literal guard is green.

- [ ] **Step 9: Commit Task 3**

```powershell
git add fretmemo-v2/src/lib/practiceFeedback.ts fretmemo-v2/src/lib/__tests__/practiceFeedback.test.ts fretmemo-v2/src/stores/useGameStore.ts fretmemo-v2/src/pages/Practice.tsx fretmemo-v2/src/locales/en/translation.json fretmemo-v2/src/locales/pl/translation.json
git commit -m "fix: localize semantic practice feedback"
```

---

### Task 4: Localize remaining audited labels and correct Polish plurals

**Files:**
- Create: `fretmemo-v2/src/lib/__tests__/p1Localization.test.ts`
- Modify: `fretmemo-v2/src/components/layout/AppShell.tsx:107-116`
- Modify: `fretmemo-v2/src/components/layout/DarkModeToggle.tsx:1-34`
- Modify: `fretmemo-v2/src/components/ui/mastery-bar.tsx:1-44`
- Modify: `fretmemo-v2/src/components/fretboard/NoteDot.tsx:1-70`
- Modify: `fretmemo-v2/src/components/practice/AnswerButtons.tsx:1-210`
- Modify: `fretmemo-v2/src/components/practice/XPToast.tsx:1-90`
- Modify: `fretmemo-v2/src/pages/Practice.tsx:238-283`
- Modify: `fretmemo-v2/src/locales/en/translation.json`
- Modify: `fretmemo-v2/src/locales/pl/translation.json`

**Interfaces:**
- Consumes: existing `useTranslation()` hooks and i18next plural resolution.
- Produces: catalog keys whose base names resolve through `_one`, `_few`, `_many`, and `_other` suffixes as required by each locale.
- Produces: `accessibility.*`, `mastery.*`, `practice.answerAria`, `practice.positionAnswerAria`, `practice.milestones.*`, and `practice.xpToast.*` keys in both catalogs.

- [ ] **Step 1: Write failing pluralization and catalog-parity tests**

Create `p1Localization.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import en from "@/locales/en/translation.json";
import pl from "@/locales/pl/translation.json";
import i18n from "@/lib/i18n";

function flatten(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
}

function normalizePluralKey(key: string): string {
  return key.replace(/_(one|few|many|other|zero|two)$/, "");
}

describe("P1 localization", () => {
  it.each([
    ["library.summary.modes", 1, "1 tryb • 0% śr"],
    ["library.summary.modes", 2, "2 tryby • 0% śr"],
    ["library.summary.modes", 5, "5 trybów • 0% śr"],
    ["library.summary.modes", 22, "22 tryby • 0% śr"],
    ["library.summary.exercises", 1, "1 ćwiczenie • 0% śr"],
    ["library.summary.exercises", 2, "2 ćwiczenia • 0% śr"],
    ["library.summary.exercises", 5, "5 ćwiczeń • 0% śr"],
    ["library.theorySummary", 6, "6 narzędzi"],
    ["library.earSummary", 4, "4 tryby"],
  ])("renders %s count %i in Polish", (key, count, expected) => {
    expect(i18n.getFixedT("pl")(key, { count, avg: 0 })).toBe(expected);
  });

  it("keeps normalized EN and PL catalog keys in parity", () => {
    const enKeys = new Set(flatten(en).map(normalizePluralKey));
    const plKeys = new Set(flatten(pl).map(normalizePluralKey));
    expect([...enKeys].filter((key) => !plKeys.has(key))).toEqual([]);
    expect([...plKeys].filter((key) => !enKeys.has(key))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run localization tests and verify RED**

```powershell
npm test -- src/lib/__tests__/p1Localization.test.ts
```

Expected: plural cases fail with current `5 tryby`, `6 ćwiczenia`, and `4 tryby` forms.

- [ ] **Step 3: Add proper EN/PL plural categories**

Replace singular unsuffixed count keys with these forms:

```json
// English
"modes_one": "{{count}} mode • {{avg}}% avg",
"modes_other": "{{count}} modes • {{avg}}% avg",
"exercises_one": "{{count}} exercise • {{avg}}% avg",
"exercises_other": "{{count}} exercises • {{avg}}% avg"
```

```json
// Polish
"modes_one": "{{count}} tryb • {{avg}}% śr",
"modes_few": "{{count}} tryby • {{avg}}% śr",
"modes_many": "{{count}} trybów • {{avg}}% śr",
"modes_other": "{{count}} trybu • {{avg}}% śr",
"exercises_one": "{{count}} ćwiczenie • {{avg}}% śr",
"exercises_few": "{{count}} ćwiczenia • {{avg}}% śr",
"exercises_many": "{{count}} ćwiczeń • {{avg}}% śr",
"exercises_other": "{{count}} ćwiczenia • {{avg}}% śr"
```

Add equivalent `_one/_other` English forms and `_one/_few/_many/_other` Polish forms for `library.theorySummary` and `library.earSummary`. Run the localization test and expect pluralization plus parity to pass.

- [ ] **Step 4: Add failing guards for the remaining audited English literals**

Extend `p1Localization.test.ts` to read the affected source files and reject this map:

```ts
const forbiddenLiterals = {
  "components/layout/AppShell.tsx": ["Skip to main content"],
  "components/layout/DarkModeToggle.tsx": ["Switch to Light Mode", "Switch to Dark Mode", "Light Mode", "Dark Mode"],
  "components/ui/mastery-bar.tsx": ["Mastery progress", "% mastery"],
  "components/fretboard/NoteDot.tsx": ["Note at string"],
  "components/practice/AnswerButtons.tsx": ["Answer ${displayNote}"],
  "pages/Practice.tsx": ["5 streak! Keep it up!", "Amazing! 10 streak!", "Perfect Session! 20 streak!", "Streak broken at"],
};
```

Resolve each file relative to `src`, read it with `readFileSync`, and assert each literal is absent. Run the test and confirm the new guard fails.

- [ ] **Step 5: Migrate layout, theme, mastery, fretboard, and answer labels**

Use these translation contracts in both locale catalogs:

```json
"accessibility": {
  "skipToMain": "Skip to main content",
  "switchToLightMode": "Switch to Light Mode",
  "switchToDarkMode": "Switch to Dark Mode",
  "lightMode": "Light Mode",
  "darkMode": "Dark Mode",
  "noteAt": "Note at string {{string}}, fret {{fret}}{{note}}"
},
"mastery": {
  "progress": "Mastery progress",
  "value": "{{value}}% mastery"
}
```

The Polish catalog must use `Przejdź do głównej treści`, `Przełącz na jasny motyw`, `Przełącz na ciemny motyw`, `Jasny motyw`, `Ciemny motyw`, `Nuta na strunie {{string}}, próg {{fret}}{{note}}`, `Postęp opanowania`, and `Opanowanie: {{value}}%`.

Add `useTranslation()` to each affected component and replace literals with `t(...)`. In `NoteDot`, calculate the optional aria suffix from `formatLocalizedNoteToken(position.note, i18n.resolvedLanguage ?? i18n.language)` so B/H is correct for screen readers. In `AnswerButtons.tsx`, use:

```tsx
aria-label={t("practice.answerAria", { note: displayNote })}
```

and localize the position-answer aria label through `practice.positionAnswerAria` with string label and fret variables.

- [ ] **Step 6: Migrate milestone and XP-toast defaults**

Add these keys to both catalogs and use them in `Practice.tsx` and `XPToast.tsx`:

```json
"milestones": {
  "five": "5 streak! Keep it up!",
  "ten": "Amazing! 10 streak!",
  "twenty": "Perfect Session! 20 streak!",
  "broken": "Streak broken at {{count}}"
},
"xpToast": {
  "correct": "Correct!",
  "streak": "{{count}} streak!",
  "achievement": "Achievement Unlocked!",
  "levelUp": "Level Up!",
  "warning": "Streak lost"
}
```

Use natural Polish equivalents: `Seria 5! Tak trzymaj!`, `Niesamowita seria 10!`, `Idealna sesja! Seria 20!`, `Seria przerwana na {{count}}`, `Poprawnie!`, `Seria: {{count}}!`, `Osiągnięcie odblokowane!`, `Nowy poziom!`, and `Seria przerwana`.

- [ ] **Step 7: Verify localization guards and focused component behavior**

Run:

```powershell
npm test -- src/lib/__tests__/p1Localization.test.ts src/lib/__tests__/practiceFeedback.test.ts src/components/theory/__tests__/localizedNotation.test.tsx
```

Expected: all focused tests pass, normalized key parity is empty in both directions, and no forbidden literal remains in the affected source files.

- [ ] **Step 8: Commit Task 4**

```powershell
git add fretmemo-v2/src/lib/__tests__/p1Localization.test.ts fretmemo-v2/src/components/layout/AppShell.tsx fretmemo-v2/src/components/layout/DarkModeToggle.tsx fretmemo-v2/src/components/ui/mastery-bar.tsx fretmemo-v2/src/components/fretboard/NoteDot.tsx fretmemo-v2/src/components/practice/AnswerButtons.tsx fretmemo-v2/src/components/practice/XPToast.tsx fretmemo-v2/src/pages/Practice.tsx fretmemo-v2/src/locales/en/translation.json fretmemo-v2/src/locales/pl/translation.json
git commit -m "fix: complete Polish P1 localization"
```

---

### Task 5: Verify the complete P1 package without overwriting tracked deploy files

**Files:**
- Verify only; modify production files only if a failing verification identifies a P1 regression.

**Interfaces:**
- Consumes: all outputs from Tasks 1–4.
- Produces: fresh evidence for focused tests, full tests, lint, TypeScript, disposable production build, generated route count, and repository diff scope.

- [ ] **Step 1: Run all focused regression tests**

```powershell
cd fretmemo-v2
npm test -- scripts/__tests__/generate-spa-entrypoints.test.mjs src/lib/__tests__/noteNotation.test.ts src/components/theory/__tests__/localizedNotation.test.tsx src/lib/__tests__/practiceFeedback.test.ts src/lib/__tests__/p1Localization.test.ts
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 2: Run the complete native quality gates**

```powershell
npm test -- --reporter=verbose
npm run lint
npx tsc -b
```

Expected: every command exits 0; the full test count is at least the baseline 163 plus the new regression cases.

- [ ] **Step 3: Build into a unique disposable directory**

```powershell
$verifyOut = Join-Path ([System.IO.Path]::GetTempPath()) ("fretmemo-p1-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $verifyOut | Out-Null
npx vite build --outDir $verifyOut --emptyOutDir
node scripts/generate-spa-entrypoints.mjs --out-dir $verifyOut
$routeCount = @(Get-ChildItem -LiteralPath $verifyOut -Recurse -Filter index.html | Where-Object { $_.FullName -ne (Join-Path $verifyOut "index.html") }).Count
if ($routeCount -ne 27) { throw "Expected 27 generated route entries, got $routeCount" }
```

Expected: Vite exits 0, the generator reports 27 entries, and the count check passes.

- [ ] **Step 4: Inspect the disposable build and remove only its validated temporary path**

```powershell
$resolvedVerifyOut = (Resolve-Path -LiteralPath $verifyOut).Path
$resolvedTemp = (Resolve-Path -LiteralPath ([System.IO.Path]::GetTempPath())).Path
if (-not $resolvedVerifyOut.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to remove non-temporary path: $resolvedVerifyOut"
}
Remove-Item -LiteralPath $resolvedVerifyOut -Recurse
```

Expected: only the unique temporary build directory is removed.

- [ ] **Step 5: Verify diff scope and commit the verification-driven adjustments, if any**

```powershell
cd ..
git status --short
git diff --check
git diff --name-only HEAD~4..HEAD
```

Expected: no tracked blog, FAQ, `/v1`, `/v2`, audit, or `.claude` file appears. If verification required a source correction, stage only its P1 files and create a final `fix: close P1 verification gaps` commit; otherwise do not create an empty commit.

- [ ] **Step 6: Request a fresh code review before integration**

Invoke `superpowers:requesting-code-review` against the pre-implementation commit and require the reviewer to check:

- direct-route manifest completeness and static-surface exclusions;
- EN B/Bb and PL H/B behavior in Circle, chords, and tunings;
- absence of user-visible English in the audited Polish practice path;
- correct Polish plural categories;
- no changes outside the approved P1 scope.

Address review findings through `superpowers:receiving-code-review`, then repeat Steps 1–5 before claiming completion.

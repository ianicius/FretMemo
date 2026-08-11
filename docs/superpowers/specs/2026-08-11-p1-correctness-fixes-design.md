# P1 Correctness Fixes Design

**Date:** 2026-08-11
**Status:** Approved for implementation planning
**Scope:** F-01 routing, F-02 EN/PL note notation, F-03 Polish localization

## Goal

Eliminate the three P1 defects identified by the 2026-08-11 correctness audit without expanding the change into the P2 build, SEO, accessibility, XP, or documentation work.

## Constraints

- Keep readable path-based URLs and `BrowserRouter`; do not adopt hash URLs.
- Continue serving the application as static files from GitHub Pages on the custom domain `fretmemo.net`.
- Do not publish, push, or modify external hosting configuration in this change.
- Do not change blog, FAQ, legacy `/v1`, legacy `/v2`, or unrelated static pages.
- Implement behavioral changes test-first.
- Preserve the existing user setting for sharps, flats, and random notation where it already applies.

## 1. Static route entry points

### Problem

GitHub Pages serves the repository as static files. The application uses `BrowserRouter`, but only the root has an HTML entry point. Direct requests to application paths such as `/train`, `/practice`, and `/theory/circle` therefore return 404 before React can start.

### Design

Create a single machine-readable manifest of public application paths. It will contain:

- static application paths and aliases such as `/train`, `/practice`, `/library`, `/challenges`, `/me`, `/progress`, and `/settings`;
- every known concrete technique path;
- every known concrete theory-tool path;
- every known concrete ear-training path;
- every known concrete rhythm path.

A post-build Node script will receive the build output directory, read its root `index.html`, and copy that file to `<route>/index.html` for every manifest entry. GitHub Pages can then resolve the clean path to a real static entry point before `BrowserRouter` takes over.

The generator will reject unsafe entries that are absolute filesystem paths, contain traversal segments, or collide with excluded static surfaces. Its exclusion set will cover `/blog`, `/faq`, `/v1`, `/v2`, and their files. Unknown application URLs will continue to return a real 404.

The existing build-output relocation is not redesigned in this P1 package. Tests will invoke the route generator against a temporary directory so verification does not overwrite tracked production files.

### Success criteria

- Every route in the manifest receives an `index.html` identical to the root application shell.
- Existing blog, FAQ, legacy, and unrelated static files remain unchanged.
- All audited direct application paths resolve to the application shell after deploying generated artifacts.
- The application continues to use clean URLs with `BrowserRouter`.

## 2. Locale-aware note and chord symbols

### Problem

`CircleOfFifths` and the Chord Library heading call `applyPolishNotation()` unconditionally. This converts English `B` to `H` and English `Bb` to `B`. The lower-level pitch-class formatter already respects the active language, but it is not suitable for complete symbols such as `Bm7b5` or for preserving Tonal's key spelling.

### Design

Add a pure locale-aware formatter for complete note or chord tokens. The formatter will accept the value and language explicitly, preserving its accidental spelling and suffix while applying the Polish B/H boundary only for Polish:

| Input | EN output | PL output |
|---|---|---|
| `B` | `B` | `H` |
| `Bb` | `Bb` | `B` |
| `Bm7b5` | `Bm7b5` | `Hm7b5` |
| `Bbmaj7` | `Bbmaj7` | `Bmaj7` |
| `F#` | `F#` | `F#` |

`CircleOfFifths` will use this boundary for outer and inner keys, the selected key, relative minor, scale notes, and diatonic chord symbols. The Chord Library will use it for the selected chord heading. Pitch-class chips and selectors will continue using the existing notation-preference formatter.

Passing the language explicitly makes the function deterministic in tests and avoids hidden coupling to global i18n state. Existing public helpers remain compatible unless a test demonstrates that an API change is necessary.

### Success criteria

- No English Circle or Chord Library output contains Polish `H` for pitch class B.
- English `Bb` is not collapsed to `B`.
- Polish B/H behavior is consistent for simple notes and chord suffixes.
- Tonal calculations and selected roots remain unchanged; only displayed labels change.

## 3. Complete P1 Polish localization repair

### Problem

Material Polish paths contain English user-visible text and incorrect Polish count forms. Confirmed examples include session prompts and feedback, answer/location labels, the skip link, mastery and theme labels, and catalog summaries such as `5 tryby` and `6 ćwiczenia`.

### Design

Move every confirmed hard-coded user-visible string from the affected material paths into both locale catalogs. Components will request translation keys instead of branching on or embedding English text.

Count-dependent catalog and session labels will use i18next plural categories. Polish entries will provide the categories required by Polish grammar (`one`, `few`, `many`, and `other`); English will provide its applicable forms. Formatting will remain in the catalogs so components pass only semantic variables such as `count`, note, string, and fret.

The implementation scan will cover the source tree while excluding tests, generated output, developer diagnostics, identifiers, and non-user-visible musical constants. Every material match will either be migrated or explicitly demonstrated not to be user-visible.

### Success criteria

- The confirmed English leaks do not appear in rendered Polish material paths.
- Counts 1, 2, 5, and a larger representative value render grammatically correct Polish forms.
- The EN and PL catalogs expose the same base application keys, with locale-specific plural suffixes permitted.
- Changing language does not change exercise state or musical calculations.

## 4. Test strategy

Implementation follows red-green-refactor for each independent behavior.

### Route generation

- A temporary build directory containing a sentinel `index.html` is used as input.
- The first test asserts that every manifest route receives an identical shell.
- A second test seeds excluded/static files and asserts their contents are unchanged.
- Safety tests reject traversal and excluded-route collisions.

### Music notation

- Unit tests cover `B`, `Bb`, chord suffixes, unaffected notes, and explicit EN/PL languages.
- Component tests render Circle of Fifths and Chord Library in EN and PL and assert the visible labels at the B/Bb boundary.
- Existing pitch-class formatter tests remain green.

### Localization

- Translation tests cover the confirmed session and navigation leaks.
- Pluralization tests cover counts 1, 2, 5, and a larger value.
- A catalog parity test compares normalized base keys across EN and PL.
- Focused component tests prove that the affected Polish paths use translations rather than embedded English strings.

### Final verification

- Run the complete Vitest suite.
- Run ESLint.
- Run TypeScript compilation.
- Run the production build only in a disposable copy or explicitly redirected output directory.
- Inspect `git diff` to ensure blog, FAQ, legacy pages, audit artifacts, and unrelated tracked files did not change.

## 5. Non-goals

This package does not implement:

- the P2 build-output redesign;
- dynamic SEO metadata or canonical URLs;
- accessibility fixes;
- XP accounting changes;
- README modernization;
- deployment or production publication.

These remain separate, independently reviewable work.

## 6. Delivery boundary

The deliverable is a local, tested source change and its regression tests. Deployment remains a separate user-authorized action. The change must be reviewable as three independent behavior groups: route entry points, locale-aware notation, and Polish localization.

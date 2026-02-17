# FretMemo v3 UI/UX Blueprint

Date: 2026-02-17
Scope: `fretmemo-v2`
Objective: podniesienie UI/UX do poziomu "world-class" przy kontrolowanym ryzyku regresji i iteracyjnym wdrozeniu.

## 0. Execution Status (2026-02-17)

Zrealizowane (kod):
- `PR-06: Technique UX Modularization`
  - `Technique.tsx` rozbity na dedykowane komponenty ustawien/statusu.
  - nowe komponenty: `src/components/technique-settings/TechniqueSettingsCard.tsx`, `src/components/technique-settings/TechniqueStatusCard.tsx`.
- `PR-07: Train/Home/Challenges polish` (pass konsystencji + density tuning)
  - `Home`: dodany wyrazny blok `Continue Last Session`, usprawnione skróty `Explore` (Theory/Ear aktywne).
  - `Train`: bardziej informacyjne podsumowania sekcji (`avg mastery`), poprawa czytelnosci sekcji.
  - `Challenges`: bardziej konsekwentna hierarchia CTA w karcie featured.
  - wspolne komponenty: `ExerciseCard` i `SectionCollapse` otrzymaly korekty czytelnosci i spacingu.
- `PR-08: Mobile Navigation and Header Simplification` (wdrozone priorytetowo dla redukcji clutteru mobile)
  - uproszczony mobile header: mniej stale widocznych ikon, przeniesienie akcji pomocniczych do menu.
  - czytelniejszy mobile bottom nav (stabilny active state, bez pulsowania ikon).
  - pliki: `src/components/layout/Header.tsx`, `src/components/layout/BottomNav.tsx`.
- `Session Entry Consistency` (krok przejsciowy)
  - `Technique` otrzymal modal `Session Setup` przed startem sesji, aby ujednolicic wejscie z `Fretboard Drills`.
  - nowy plik: `src/components/technique-settings/TechniqueSetupDialog.tsx`.
  - `Start` na `Technique` uruchamia teraz najpierw preflight modal.
  - `Practice` i `Technique` korzystaja teraz ze wspolnego shellu modala:
    - `src/components/session-setup/session-setup-dialog-shell.tsx`.
- `PR-09: Cleanup and Dead Code Removal` (w toku)
  - usuniete nieuzywane legacy komponenty layout:
    - `src/components/layout/DesktopSideNav.tsx`
    - `src/components/layout/SettingsPanel.tsx`
  - usuniete nieuzywane, osierocone artefakty starego modelu cwiczen:
    - `src/components/fretboard/HeatMap.tsx`
    - `src/data/exercises.ts`
    - `src/data/patterns.ts`
    - `src/lib/generators.ts`
    - `src/types/exercise.ts`
  - cleanup nieuzywanych eksportow:
    - `src/lib/utils.ts` (`formatNumber`)
    - `src/rhythm/engine/InputEvaluator.ts` (`TIMING_WINDOWS_STANDARD`)

Walidacja:
- `npm run lint` -> pass
- `npm run build` -> pass

Nastepny etap:
- domkniecie `PR-09` (dalszy dead-code scan + porzadki po refaktorach setup/session).

## 1. Outcome i KPI

### Docelowe outcome
- Jedna, spójna architektura ustawien: global, modulowa, sesyjna.
- Jeden jezyk komponentow i formularzy (bez mieszania stylow natywnych i custom).
- Przewidywalny flow: `Train -> Setup -> Session -> Summary -> Next`.
- Lepsza czytelnosc i hierarchia informacji na desktop i mobile.

### KPI produktu (8-12 tygodni po wdrozeniu)
- `+15-25%` wzrost startu sesji z Home/Train.
- `-20%` spadek porzuconego setupu (otwarty setup bez startu sesji).
- `+10-15%` wzrost liczby powrotow do ustawien (lepsza discoverability i zaufanie).
- `+10%` wzrost completion rate dla Rhythm/Tap the Beat.
- Spadek support friction dotyczacego "gdzie to ustawic?".

## 2. Guiding Principles

- `Single Source of Truth`: user musi wiedziec czy zmienia:
  - `Global Defaults` (dla calej appki),
  - `Module Defaults` (np. Technique/Rhythm),
  - `Session Overrides` (tylko na dana sesje).
- `Progressive Disclosure`: podstawowe akcje widoczne od razu, zaawansowane parametry za foldem.
- `Consistent Control Language`: te same typy kontrolek dla tych samych klas ustawien.
- `Action Clarity`: kazdy ekran ma jedna glowna akcje.
- `Mode Safety`: podczas sesji brak przypadkowych zmian, ktore zrywaja kontekst.

## 3. Information Architecture v3

## 3.1 Struktura poziomu app
- `Home`:
  - Daily CTA,
  - Next Step,
  - Continue,
  - szybki access do ostatnich/ulubionych.
- `Train`:
  - katalog modulow i trybow,
  - pinning,
  - start setupu.
- `Challenges`:
  - daily/weekly/hunts,
  - skrot do setupu gotowych scenariuszy.
- `Me`:
  - `Progress`,
  - `Settings`.

## 3.2 Architektura ustawien (krytyczne)

### A. Global Defaults (`/me?section=settings`)
Przechowywane i opisane jako stale preferencje:
- Instrument,
- Display,
- Audio global,
- Learning behavior,
- Gamification,
- Data/Backup.

### B. Module Defaults
Domyslne per modul:
- Technique defaults (np. start BPM per exercise),
- Rhythm defaults (latency, preferowany tryb startowy),
- Ear/Theory module prefs (jezeli potrzebne).

### C. Session Setup
Tylko runtime parametry konkretnej sesji:
- tempo sesji,
- preset constraints,
- mode-specific toggles.
Zapisywanie tych wartosci jako "session override" albo "save as module default" jawnie przez usera.

## 4. UX Patterns i Standardy

## 4.1 Stronicowanie i hierarchia
- Ujednolicony shell:
  - naglowek strony,
  - subheader z contextem,
  - body,
  - sticky primary action (mobile).
- Jedna skala naglowkow:
  - `Page Title`,
  - `Section Title`,
  - `Card Title`,
  - `Body`,
  - `Meta`.

## 4.2 Formularze
- Wszystkie `select` i `input` przez wspolne komponenty ui.
- Standaryzacja:
  - label,
  - helper text,
  - current value,
  - error state,
  - disabled state.
- Grupowanie:
  - "Basics",
  - "Advanced",
  - "Danger Zone".

## 4.3 CTA i button hierarchy
- `Primary`: tylko jedna glowna akcja na sekcje.
- `Secondary`: alternatywa.
- `Tertiary/Ghost`: akcje pomocnicze.
- Koniec mieszania `control-btn--primary` z lokalnymi wariantami bez reguly.

## 4.4 Session UX
- Setup:
  - skompresowany,
  - czytelny podsumowujacy chip "co uruchamiasz".
- Active session:
  - stabilny HUD,
  - minimalny noise,
  - jasne stop/pause.
- Summary:
  - outcome,
  - next best action,
  - quick retry.

## 5. Target Component Architecture

## 5.1 Nowe/podniesione komponenty bazowe
- `FormField` (label + control + hint + error).
- `SelectField` (wrapper na wspolny select UI).
- `NumberField` (stepper/increment pattern).
- `SettingRow` (label, opis, control).
- `SettingGroupCard` (spojne sekcje ustawien).
- `PrimaryActionBar` (sticky mobile CTA).
- `SessionHeader` (mode, context, quick status).

## 5.2 Usuniecie duplikacji
- Jedna biblioteka "session setup sections" dla:
  - Practice preflight,
  - Practice setup page,
  - Rhythm mode setup.
- Wspolne renderer-y:
  - tempo block,
  - audio input block,
  - constraints block,
  - speed-up block.

## 6. Ekrany docelowe (spec skrócony)

## 6.1 Home
- Utrzymac premium hero.
- Zredukowac wizualny "noise" metadanych.
- Dodac wyrazny blok `Continue Last Session`.
- Pinned jako "quick launch", ale bez dominacji nad Next Step.

## 6.2 Train
- Zachowac collapsible katalog, ale:
  - wieksze targety klikalne,
  - mniej mikro-labels,
  - pin jako jeden powtarzalny pattern.
- Podsumowanie sekcji bardziej informacyjne (np. progress median).

## 6.3 Challenges
- Feature card zostaje.
- Weekly i Hunts:
  - mniej "list density",
  - lepsze CTA hierarchy.

## 6.4 Me > Progress
- Wzmocnic czytelnosc mini stat cards.
- Heatmap controls w jednym miejscu z jasnym statusem.
- Lepszy priorytet "what to do next" po wykryciu weak spots.

## 6.5 Me > Settings (najwieksza zmiana)
- Finalne grupy:
  - Profile & Instrument,
  - Learning & Session Behavior,
  - Audio & Input,
  - Appearance,
  - Gamification,
  - Data & Safety.
- Na gorze:
  - search/filter settings,
  - reset defaults z potwierdzeniem.
- Kazda sekcja: max 5-7 kontroli zanim pojawia sie fold "Advanced".

## 6.6 Practice
- Setup page i PreFlight musza uzywac wspolnych blokow.
- Jedna definicja "session defaults" vs "temporary overrides".
- Active mode:
  - zostawic immersyjny styl,
  - zredukowac liczbe rownoleglych sygnalow.

## 6.7 Technique
- Rozbicie ustawien per exercise type do plug-in sections.
- Ograniczyc "megapanel" do:
  - Basics,
  - Exercise specific,
  - Progression.
- Status card tylko z najwazniejszymi metrykami.

## 6.8 Rhythm (Tap/Strum/Reading/Groove)
- Ujednolicic setup layout (dzis kazdy mode ma inny flavor).
- Ujednolicic summary cards i stop controls.
- Lepsze wykorzystanie przestrzeni w trakcie sesji (mniej pustych obszarow).

## 6.9 Theory i Ear Training
- Ujednolicic page header i spacing.
- Dostosowac tytuly do tej samej skali typografii.

## 7. Roadmapa wdrozenia (PR-by-PR)

## PR-01: Foundations Tokens + Typography
Files (glownie):
- `src/index.css`
- `tailwind.config.js`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/tabs.tsx`

Zakres:
- finalizacja skali typografii i spacing tokens,
- porzadek button hierarchy,
- standaryzacja card/header paddings.

Acceptance:
- wszystkie page titles i section titles zgodne ze skala,
- brak pojedynczych "ad hoc" rozmiarow fontow dla core UI.

Estimate:
- 1-2 dni.

## PR-02: Unified Form Controls
Files:
- `src/components/ui/select.tsx` (new)
- `src/components/ui/number-input.tsx` (new)
- `src/components/ui/form-field.tsx` (new)
- migracja z natywnych `select/input` na wrappery.

Zakres:
- wspolny wyglad i zachowanie kontrolek,
- helper/error states.

Acceptance:
- brak bezposrednich natywnych kontrolek w kluczowych ekranach ustawien.

Estimate:
- 2-3 dni.

## PR-03: Settings IA v3
Files:
- `src/pages/Settings.tsx`
- `src/pages/Me.tsx`
- `src/stores/useSettingsStore.ts`

Zakres:
- nowy podzial sekcji,
- jasny podzial Global vs Module defaults,
- cleanup duplikatow.

Acceptance:
- user umie bezbłędnie wskazac gdzie zmienia dany typ ustawienia.

Estimate:
- 3-4 dni.

## PR-04: Session Setup Unification
Files:
- `src/components/practice/PreFlightModal.tsx`
- `src/pages/Practice.tsx`
- `src/rhythm/modes/*.tsx`
- nowe `src/components/session-setup/*`

Zakres:
- wspolne bloki konfiguracji sesji,
- mniejszy koszt utrzymania.

Acceptance:
- ten sam wzorzec UX dla Practice i Rhythm setup.

Estimate:
- 4-5 dni.

## PR-05: Practice Active HUD Cleanup
Files:
- `src/components/practice/FocusModeHUD.tsx`
- `src/pages/Practice.tsx`
- `src/components/practice/PracticeControls.tsx`

Zakres:
- redukcja przeciążenia,
- lepsza priorytetyzacja feedbacku.

Acceptance:
- test sesji 15 min bez "informational overload".

Estimate:
- 2-3 dni.

## PR-06: Technique UX Modularization
Files:
- `src/pages/Technique.tsx`
- nowe sekcje `src/components/technique-settings/*`

Zakres:
- modularny panel ustawien per typ cwiczenia,
- lepsza czytelnosc i mniejsza zlozonosc komponentu glownego.

Acceptance:
- skrocenie `Technique.tsx` o min. 30-40%,
- brak regresji funkcjonalnej.

Estimate:
- 4-6 dni.

## PR-07: Train/Home/Challenges polish
Files:
- `src/pages/Home.tsx`
- `src/pages/Library.tsx`
- `src/pages/Challenges.tsx`
- `src/components/ui/exercise-card.tsx`
- `src/components/ui/section-collapse.tsx`

Zakres:
- hierarchy polish,
- card density tuning,
- CTA consistency.

Acceptance:
- spojnosc naglowkow, cardow, CTA miedzy 3 ekranami.

Estimate:
- 3-4 dni.

## PR-08: Mobile Navigation and Header Simplification
Files:
- `src/components/layout/Header.tsx`
- `src/components/layout/BottomNav.tsx`
- `src/components/layout/AppShell.tsx`

Zakres:
- odchudzenie mobile top bar,
- czytelniejszy fokus na content.

Acceptance:
- mniej ikon stale widocznych,
- lepsza czytelnosc i mniejszy clutter na 360px.

Estimate:
- 1-2 dni.

## PR-09: Cleanup and Dead Code Removal
Files:
- usuniecie nieuzywanych komponentow i styli,
- porzadek w helperach.

Zakres:
- usuniecie driftu architektonicznego,
- przygotowanie pod kolejne feature'y.

Acceptance:
- brak nieuzywanych komponentow layout/settings,
- stabilny lint/build/test.

Estimate:
- 1-2 dni.

## 8. Ryzyka i Mitigacja

- Ryzyko: regresje behavior w setupach sesji.
  - Mitigacja: snapshot testy i testy integracyjne flow start/stop/restart.
- Ryzyko: utrata "premium look" przy standaryzacji.
  - Mitigacja: zachowac brand tokens, standaryzowac tylko semantyke i hierarchie.
- Ryzyko: zbyt duzy scope refaktoru.
  - Mitigacja: rollout etapami (PR 1-9), feature flag dla new setup flow.

## 9. Test Strategy

- Visual regression:
  - Home, Train, Challenges, Me(Settings/Progress), Practice, Technique, Rhythm.
- Functional regression:
  - start session,
  - preflight save/apply,
  - stop/pause/resume,
  - summary and retry.
- Responsive checks:
  - 360x800, 390x844, 768x1024, 1440x900.
- Accessibility checks:
  - focus order,
  - keyboard nav,
  - kontrast text/meta na dark mode.

## 10. Definition of Done (v3)

- Spójna architektura ustawien wdrozona i zrozumiala.
- Spójny zestaw kontrolek formularzy.
- Practice + Technique + Rhythm dzialaja na wspolnych wzorcach setup/session.
- Mobile i desktop bez widocznych konfliktow hierarchii.
- Brak krytycznych regresji w flow sesji i progresji.

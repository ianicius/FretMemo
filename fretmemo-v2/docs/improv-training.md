# Improv Training — architektura modułu

Date: 2026-11-14 (round 12 — wdrożona Faza 6 planu docs/improv-training-plan.md: etapy na mapie drogowej (Podstawy/Harmonia/Granie/Zaawansowane — tylko wyświetlanie), powtórki (quiz mieszany z generatorów zaliczonych modułów + harmonogram SM-2 per generator w reviewSRS), test na wejście (quiz per moduł, odblokowuje do pierwszego błędnego — ), warstwa basu w pętli (root oktawę niżej na starcie akordu i w połowie), blues 12-taktowy w modułach 3 i 12, karta postępu improvu w /progress; podkład bas+perkusja z multiTrackPlayback oceniony — perkusja wymagałaby zmian w src/audio (odroczone); round 11 — Faza 5 planu `docs/improv-training-plan.md`: szersze pule pytań — keySig +3 kierunki (typ znaków, podwyższone dźwięki, paralelna molowa), modes +3 kierunki (nuttryb od dźwięku, macierzysta majorowa, rozpoznanie ze słuchu przyciskiem Play), triadBuild + akordy septymowe, chordScaleMajor/chordScaleMM/chordScaleHM w kontekście konkretnego akordu i tonacji (wszystkie 12 tonacji; odpowiedź zawiera macierzystą mol melodiczną/harmoniczną), tritone ×12 dominant, secondaryDom per tonacja + V7/I z filmu, borrowed per tonacja, coltrane ii–V i transponowany cykl; kryterium odbioru: ≥3× questionCount unikalnych pytań na 300 losowań (coltrane ≥12, triadType ≥20 — ograniczenia puli odnotowane); round 10 — Faza 4 planu: weryfikacja mikrofonem — `ChordMicTargets { chord, pitchClasses }` w params/wariantach modułów 12/13/16/22, `micLoopPass` (≥3/4 trafień), toggle mikrofonu w BackingLoopExercise z oknem pierwszego uderzenia skorygowanym o `inputLatencyMs` z kalibracji rytmu, auto-zapis obiegu przy weryfikacji; round 9 — Faza 3 planu `docs/improv-training-plan.md`: pętle nad podkładem w modułach 3/4/6/7/9/11/13/14/18/19/20/21/22 wg tabeli planu, wpis `ProgressionEntry { chord, hintKey?, beats? }` (hint w prompterze, Am7 trzymane 4 takty), moduł 12 = drabinka pryma→tercja→kwinta→septyma + wolna improwizacja, moduł 14 = łatwiejsza pętla C→F, moduł 15 = wariant z filmu Bm7–Bb7–Am7–Ab7–Gmaj7, moduł 16 = pięć dominant, moduł 17 = dwa warianty 2-5-1 vs backdoor, moduł 22 = pełna 16-taktowa forma 2 uderzenia/akord od 60 BPM z trzema poziomami; round 8 — Faza 2 planu `docs/improv-training-plan.md`: silnik practice-link (moduły 1/5 + playNotes w 3/4/18/20), theory-embed (koło kwintowe/ScaleExplorer/ChordLibrary/TriadVisualizer z propsami początkowymi), okna drillów względem toniki (`offsetsFrom/offsetsTo`, `tonicAnchorFret`), arpeggia jako pełne kształty + maj7/m7b5-arp, usunięte FretboardQuiz + getChordShapePositions + kształt triad; round 7 — Fazy 0+1: `docs/improv-training-plan.md`: poprawki merytoryczne generatorów i treści, uczciwe zaliczanie; poprzednio round 6: deferred findings z integracji: XP-2 predykat zaliczenia tylko w `isModuleComplete`/`isExercisePassed` (store bez własnej kopii), XP-3 E4 przez `playChord` (strum 55 ms) zamiast własnego staggeru `playTone`, XP-4 `localizePromptValues` (notacja polska w treści pytań/podpowiedzi na polach notowych; matching nadal surowe tokeny), EN roadmapa ukrywa `.term` gdy == `.name`, SEO prefix dla `/improv/`, Improv w quick-actions headeru, sidebar label `text-xs` bez ucinania)
Scope: `fretmemo-v2` (`src/pages/ImprovTraining.tsx`, `src/components/improv/`, `src/lib/improv/`, `src/data/improv/`, `src/stores/useImprovStore.ts`)
Objective: kompletny system nauki improwizacji — 22 moduły w kolejności z wideo źródłowego
(Brandon D'Eon, "What To Learn For Guitar Improv (in Order)"), z ćwiczeniami zmapowanymi na
istniejącą architekturę aplikacji (trasy, store z persystencją, silnik audio, i18n PL/EN).

Źródło kanoniczne kolejności: `gauntlet/improv-training/sources/video-source-map.md`
(22 elementy, 1:1). Kolejność jest zabezpieczona testem
`src/data/improv/__tests__/curriculum.test.ts` (twarda lista `EXPECTED_ORDER`).

## 1. Co to jest

Moduł „Trening improwizacji / Improv Training" to nowa trasa `/improv` (mapa drogowa 22 modułów)
i `/improv/:moduleId` (szczegół modułu: teoria + ćwiczenia). Wejście: własna zakładka „Improv" w
nawigacji głównej — dolna belka mobilna (`BottomNav`) i sidebar desktopowy (`AppShell`), id
`improv` w `TabId`, etykieta `nav.improv` (PL/EN: „Improv"); od rundy 2 moduł **nie ma** karty
w bibliotece `/train` (sekcja i handler usunięte z `Library.tsx`).
Postęp jest persystowany (`localStorage`, klucz `fretmemo-improv-v1`); odblokowywanie sekwencyjne:
moduł N jest dostępny po zaliczeniu modułu N-1 (albo globalny przełącznik „Odblokuj wszystkie").

## 2. Mapa plików

| Plik | Rola |
| --- | --- |
| `src/data/improv/curriculum.ts` | KANONICZNA lista 22 modułów (`CURRICULUM`, `IMPROV_ORDER`): id, order, klucze i18n, ćwiczenia z parametrami silników i progami. Czyste funkcje pomocnicze: `isModuleUnlocked` (też `entranceUnlockCount`), `isModuleComplete` (pomija ćwiczenia `nonGating` — `isNonGating`), `isExercisePassed`, `isExerciseVerified` (próg na samych `verifiedRuns`, A2), `countCompletedModules`, `loopRunKey` (klucz obiegu per wariant), `micLoopPass` (≥3/4 trafień), `practiceLinkPositions`, `QUIZ_PASSED_ATTEMPTS`. |
| `src/lib/improv/scaleShapes.ts` | Geometria kształtów na gryfie: definicje (`SCALE_SHAPES`: pentatonika molowa i durowa, major, mol melodyczny/harmoniczny, arpeggia `m7-arp`/`dom7-arp`/`maj7-arp`/`m7b5-arp`), `getScaleShapePositions` (wszystkie dźwięki kształtu w oknie progów na każdej strunie; alias `getShapePositions`), `getShapePitchClasses`, `tonicAnchorFret` (próg toniki na niskiej strunie E, poniżej 3. progu +12), `coversAllDegrees`, `isStandardTuning` (sześć strun w stroju standardowym; dodatkowe niskie struny 7/8-strunowej gitary się nie liczą). Czyste funkcje; strój z opcji `tuning` (`ShapeRenderOptions`, domyślnie `STANDARD_TUNING`; `DiagramDrill` podaje strój z ustawień) + `getNoteAt` (bez tonal — arytmetyka chromatyczna). `notePitchClass` (wewnętrzna) obsługuje oba spellingi: ostre przez `NOTES` i bemolowe klucze `ImprovKey` (`Bb/Db/Eb/Gb/Ab` przez `FLAT_NAMES` — pattern z `questions.ts`). |
| `src/lib/improv/questions.ts` | Generatory pytań E2: seeded mulberry32 (`createRng`), `generateChoiceQuiz` z 12 generatorami (`listChoiceGeneratorIds`: `keySig`, `modes`, `triadBuild`, `chordScaleMajor`, `triadType`, `chordScaleMelodic`, `chordScaleHarmonic`, `tritone`, `secondaryDom`, `borrowed`, `pivot`, `coltrane`). Deterministyczne względem seeda; odpowiedź porównywana na surowych (niezlokalizowanych) stringach. Faza 0 planu: triady stackują 1-3-5 (`degree+3`, test tonal-oracle dla C-dur M m m M M m dim), subV rozwiązuje się do toniki kwintę w dół od dominanty (`subVResolutionTarget`), backdoor zawsze pyta o pełną sekwencję iv m7–bVII7–I wylosowanej tonacji (w C: Fm7–Bb7–C), Cmaj7→Ionian w danych, charakterystyki trybów bez prozy. Tryby od własnej prymy (`modeNotesFromRoot`), `tritoneSub`. |
| `src/lib/improv/chords.ts` | Dane akordowe do E4: `getChordInfo` (tonal `Chord.get`), `getChordMidis` (rosnące MIDI od `baseMidi`), `getChordPitchClasses`, `tonicMidi`; `getChordTonePositions` (B1: pozycje dźwięków akordu w oknie progów ze stopniem `label`, `isRoot`, `isTarget` dla celów mikrofonu). |
| `src/lib/improv/backingLoop.ts` | `BackingLoopScheduler` — lookahead scheduler pętli akordowej (wstrzykiwany `LoopClock` → testowalny z fake clockiem; warstwy callbacków: `onBeatSchedule` z dokładnym czasem audio, `onChordChange`/`onBeat`/`onLoopEnd` z `delayMs` dla UI i `playTone`). |
| `src/lib/improv/click.ts` | `MetronomeClicker` — minimalny lookahead scheduler klików (triangle, akcent na 1) prosto do `ctx.destination` (ta sama polityka co `playCountInClicks`); degraduje się do no-op bez AudioContext. |
| `src/lib/improv/loopTools.ts` | Czyste funkcje pętli (plan rozwoju, etap B): transpozycja (`transposeNote`, `transposeChord`, `transposeProgression`, `transposeTargets`, `loopKey`, `keyChoices`, `keyPitchClass`, `keyShiftInterval` — przez `tonal`), raport po obiegu (`loopChordReport`), rampa tempa (`rampBpmAfterPass`, `RAMP_STEP_BPM` = 5, `RAMP_EVERY_PASSES` = 2). Szczegóły w sekcji 8. |
| `src/components/improv/LoopHitReport.tsx` | B3: po obiegu z mikrofonem jeden element na akord progresji (z `loopChordReport`): trafiony (zielony, ✓) / nietrafiony (wyciszony, ✗), licznik w `improv.loop.reportTitle`, nazwy przez `localizeToken`. |
| `src/lib/improv/display.ts` | `ENGINE_LABEL_KEYS`, `IMPROV_FRETBOARD_ROWS` (wysokość rzędów strun gryfów improvu, sekcja 4), `localizeToken` (notacja polska B→H przez `formatLocalizedNoteToken`), `localizeAnswer` (tłumaczy odpowiedzi przez `improv.term.*` i nuty w sekwencjach), `localizePromptValues` (wartości prompt/hint: pola terminów `mode/label/type/parent` w obu językach przez `localizeAnswer` (np. `Dorian` → „dorycki (Dorian)”); w polskim notacja B→H na polach notowych `key/chord/sub/v/dominant/target/ii/first/second/source/root/offset`, listach `list/keys` i `notes/cycle`; pozostałe pola i liczby bez zmian; matching zawsze na surowych tokenach), `barCue` (rodzaj taktu pętli frazowej z `hintKey`: `play`/`rest`/`call`/`answer`, dla innych podpowiedzi `null`) — wydzielone, by pliki komponentów eksportowały wyłącznie komponenty (fast refresh). |
| `src/stores/useImprovStore.ts` | zustand + persist (`fretmemo-improv-v1`): `moduleState[id] = { exerciseRuns, verifiedRuns?, completed }`, `unlockAll`, `entranceUnlockCount` (test na wejście), `reviewSRS` (SM-2 per generator powtórek); akcje `recordQuizResult`, `recordDrillRun`, `recordLoopPass(moduleId, exerciseId, variantId?, verified = false)`, `recordPracticePass`, `updateReviewSR`, `setEntranceUnlockCount`, `resetModule`, `resetProgress`, `setUnlockAll`. Semantyka liczników (faza 1 planu): quiz = liczba ZALICZONYCH podejść (run liczy się tylko gdy `correct ≥ requiredCorrect`; próg ćwiczenia = `QUIZ_PASSED_ATTEMPTS` = 2 podejścia), drill = pełne przebiegi, loop = udane obiegi pod kluczem `loopRunKey` (osobno per wariant), practice-link = 1 po spełnieniu kryteriów. A2: `recordLoopPass` dolicza każdy obieg do `exerciseRuns`, a przy `verified = true` (obieg zaliczony mikrofonem) także do `verifiedRuns` pod tym samym kluczem. Flaga `completed` przeliczana przez `isModuleComplete` z curriculum. `merge` migruje legacy `quizBest` na 1 zaliczone podejście pierwszego quizu modułu i uzupełnia brakujące `verifiedRuns` jako `{}`. |
| `src/pages/ImprovTraining.tsx` | Dwa widoki na jednym komponencie strony: roadmapa (postęp, switch unlockAll, powtórki — quiz mieszany z generatorów zaliczonych modułów należnych wg `reviewSRS`, test na wejście → `setEntranceUnlockCount`, lista 22 ze statusami) i szczegół modułu (TheoryCard + ćwiczenia wg silnika: `ChoiceQuiz`, `DiagramDrill`, `BackingLoopExercise`, `PracticeLinkExercise`; blokada/404 jak w `EarTraining`). |
| `src/components/improv/TheoryCard.tsx` | Karta teorii (tekst z `improv.modules.<id>.theory`) + opcjonalne osadzenie narzędzia teorii (`TheoryEmbed`: `CircleOfFifths` / `ScaleExplorer` / `ChordLibrary` / `TriadVisualizer`, gryf z `IMPROV_FRETBOARD_ROWS`). |
| `src/components/improv/ExerciseFrame.tsx` | Wspólna rama ćwiczenia: badge silnika, badge progu, badge „Zaliczone”, a przy zaliczonym ćwiczeniu z propem `unverified` (przekazuje go tylko `BackingLoopExercise`) bursztynowa odznaka „Niezweryfikowane” z ikoną `MicOff` (`improv.status.unverified`, podpowiedź `improv.status.unverifiedHint`); tytuł + opis; +50 XP z toastem przy przejściu niezaliczone→zaliczone; `ScoreStrip`. |
| `src/components/improv/ChoiceQuiz.tsx` | E2 `choice-quiz` (1 poprawna z 2–4 opcji, feedback + podpowiedź, auto-advance, podsumowanie). |
| `src/components/improv/DiagramDrill.tsx` | E3 `diagram-drill`: diagram kształtu z etykietami stopni (pryma `emphasis: "strong"`), wybór kształtu/tonacji, okno progów od `tonicAnchorFret`, BPM slider, metronom (`MetronomeClicker`), root przy starcie i przyciskiem; przycisk przebiegu aktywny dopiero po tylu uderzeniach metronomu, ile nut ma przebieg góra–dół. A3: `leftHanded` (`full.instrument.leftHanded`) i `tuning` (`quick.tuning` przez `normalizeTuning`) z `useSettingsStore` idą do `Fretboard` i `getShapePositions`; gdy `isStandardTuning` zwraca false, pod gryfem `improv.drill.tuningNotice`. |
| `src/components/improv/PracticeLinkExercise.tsx` | Silnik `practice-link` (moduły 1 i 5): otwiera `/practice` ze stanem trasy (mode + constraints), pokazuje pokrycie okna z `useProgressStore.positionStats` (`practiceLinkPositions`; pozycje spełniające kryterium na zielono), po spełnieniu kryteriów przycisk zapisu (`recordPracticePass`); przy `nonGating` zamiast niego odznaka `improv.practiceLink.extra`. A3: `leftHanded`/`tuning` z `useSettingsStore` idą do `Fretboard`; komunikatu o stroju nie ma (`tuningNotice` pokazuje tylko `DiagramDrill`). |
| `src/components/improv/BackingLoopExercise.tsx` | E4 `backing-improv`: pętla progresji blokami akordowymi (`BackingLoopScheduler`, `playChord`), opcjonalny bas (`improv.loop.bass`), prompter „teraz/następny” z podpowiedzią taktu (`hintKey` — tak działają warianty B4 „takt gry, takt pauzy” i „pytanie–odpowiedź”; takty z `barCue` dostają etykietę-pigułkę, takt pauzy dodatkowo wygaszony prompter i gryf, sekcja 8 B4) i kropkami uderzeń, cel ćwiczenia, odznaka „dodatkowe” przy `nonGating`. Selektor wariantu (obiegi liczone osobno per wariant przez `loopRunKey`; zaliczenie wymaga każdego wariantu). B2: selektor tonacji `improv.loop.key` (12 tonacji z `keyChoices`; akordy i cele mikrofonu przesuwane przez `transposeProgression`/`transposeTargets`, po zmianie tonacji `improv.loop.transposedNotice` — cel i podpowiedzi dotyczą oryginalnej tonacji); zmiana wariantu lub tonacji zatrzymuje pętlę. B1: gryf z dźwiękami bieżącego akordu (`getChordTonePositions`, progi 1–12, pryma `emphasis: "strong"`, cele mikrofonu `status: "correct"`, `leftHanded`/`tuning` z `useSettingsStore`), przełącznik `improv.loop.fretboardToggle` (domyślnie włączony), legenda `improv.loop.fretboardLegend`. Weryfikacja mikrofonem (`usePitchDetector`; obieg z `micLoopPass` → `recordLoopPass(…, true)`) i B3 `LoopHitReport` po każdym obiegu z mikrofonem; ręczne oznaczenie obiegu → `recordLoopPass(…, false)` (niezweryfikowany). A2: `unverified` do `ExerciseFrame` (zaliczone, ale nie `isExerciseVerified`). B5: przełącznik `improv.loop.rampToggle` (`rampBpmAfterPass`), BPM slider. |

## 3. Kontrakt curriculum

```ts
interface ImprovModule { id; order: 1..22; theoryKey; exercises: ImprovExercise[] }
interface ImprovExercise { id: "<moduleId>.<eN>"; engine; nameKey; descKey; params }
```

Silniki i parametry:

- **E1 `fretboard-quiz` — USUNIĘTY (faza 2)**: moduły 1 i 5 używają `practice-link`; `FretboardQuiz.tsx`
  i `generateFretboardQuestions` usunięte, postęp z `useProgressStore.positionStats` (SM2, mikrofon).
- **E2 `choice-quiz`** — `ChoiceQuizParams { generatorId, questionCount, requiredCorrect,
  answerOptions, direction? }`. `direction` pinuje kierunek pytań generatora (np. `chord-to-mode`);
  brak = mieszane.
- **E3 `diagram-drill`** — `DiagramDrillParams { shapes: [{ shapeId, defaultKey, keys? }], offsetsFrom, offsetsTo,
  defaultBpm, requiredRuns }`. Okno liczone od toniki na niskim E (`tonicAnchorFret(key) + offset`; anchor < 3
  progu → +12), więc zmiana tonacji przesuwa ten sam kształt. Arpeggia to kształty typu scale (wszystkie
  dźwięki akordu w oknie na 6 strunach) — `m7/dom7/maj7/m7b5-arp`. Próg: liczba pełnych przebiegów (góra+dół).
- **E4 `backing-improv`** — `BackingLoopParams { progression (symbole akordów), goalKey,
  beatsPerChord, defaultBpm/minBpm/maxBpm, requiredPasses, variants? }`. `variants` (id, labelKey,
  progression, goalKey) obsługuje przełączniki typu „normal vs subV" (moduł 15) i „pryma / tercja / kwinta / septyma"
  (moduł 12 — warianty `root`/`third`/`fifth`/`seventh` ćwiczenia `target-chord-tones.e1`). Próg: liczba udanych obiegów.

Moduł jest zaliczony (`completed`), gdy **każde** jego ćwiczenie poza `nonGating` osiągnie własny próg
(quiz: `exerciseRuns[exerciseId] ≥ QUIZ_PASSED_ATTEMPTS` — 2 zaliczone podejścia; drill/loop: `exerciseRuns[exerciseId] ≥ requiredRuns/requiredPasses`,
  pętla z wariantami — każdy wariant pod kluczem `loopRunKey`;
  practice-link: `≥ 1` po spełnieniu kryteriów z `useProgressStore.positionStats`). Obiegi z włączoną weryfikacją mikrofonem
  zapisują się automatycznie przy ≥3/4 trafień (`micLoopPass`). Moduł 6 (faza 0.2): pięć boksów JEDNEJ pentatoniki (min-pent w G, okna 3–6/5–8/7–11/10–13/12–15); nazwy boksov (major/dorian/phrygian/mixo pent) pochodzą od stopnia, od którego boks się zaczyna.

## 4. Integracje

- **Routing**: `App.tsx` — lazy `ImprovTraining`, trasy `/improv` i `/improv/:moduleId` pod
  `<AppShell/>`; `app-route-entrypoints.json` — `/improv` + 22 tras modułów (deep-linki / SPA
  fallback allowlist; testy `scripts/__tests__` zaktualizowane o nową liczbę tras 52).
- **Practice** (faza 2 planu): silnik `practice-link` otwiera `/practice` ze stanem trasy (`PracticeRouteState`:
  mode + constraints `fretRange/enabledStrings/rootNote/scaleType`); kryterium zaliczenia czytane z
  `useProgressStore.positionStats` (≥ `minAnswers` odpowiedzi, trafność ≥ `minAccuracy` na każdej pozycji okna).
  `PracticeScaleType` rozszerzony o `melodicMinor`/`harmonicMinor` (interwały w `SCALE_INTERVAL_MAP`).
- **Nawigacja główna** (runda 2): pozycja `improv` w `NAV_ITEMS` w `src/components/layout/BottomNav.tsx`
  (ikona `Guitar` z lucide-react, trasa `/improv`, aktywność też dla `/improv/:moduleId`) i w
  `src/components/layout/AppShell.tsx` (sidebar desktopowy); typ `TabId` w `src/types/index.ts`
  rozszerzony o `'improv'`; etykieta `nav.improv` w obu locale. `SeoManager.getRouteMeta` ma meta
  dla `/improv` (tytuł + description wg wzorca pozostałych tras). Minimalna korekta dolnej belki:
  padding kontenera `px-2` → `px-1`, by 6 pozycji mieściło się na 390px bez zawijania.
- **Biblioteka `/train`**: brak karty — `Library.tsx` nie zawiera sekcji `improv` (`TrainSectionKey`,
  `DEFAULT_SECTIONS_OPEN`, `openImprov` i importy `useImprovStore`/`countCompletedModules` usunięte
  w rundzie 2); moduł jest osiągalny wyłącznie z nawigacji głównej. Klucze locale
  `library.improv`, `library.improvSummary`, `improv.libraryCard.*` zostały usunięte w rundzie 7 (patrz i18n).
- **E4 pętle** (faza 3 planu): pętle w modułach 3, 4, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22
  (spoza pętli pozostają 1, 2, 5, 8 — moduły wiedzy); wpisy progresji niosą opcjonalny `hintKey` (podpowiedź
  pod akordem w prompterze, np. „Skala D dorycka — celuj w H”) i `beats` (Am7 trzymane 4 takty w module 3); moduł 12
  ma drabinkę pryma→tercja→kwinta→septyma + wolną improwizację, moduł 22 pełną 16-taktową formę Giant Steps
  (2 lub 4 uderzenia na akord, od 60 BPM) z trzema poziomami trudności.
- **Audio**: E3 gra root przez `playTone` (sampler/synteza → voice bus silnika dźwięku);
  kliki metronomu (`MetronomeClicker`) w E3 idą bezpośrednio do `ctx.destination`; E4 gra
  bloki akordowe przez `playChord` (strum 55 ms, bez klika) — zgodnie z polityką z
  `docs/sound-engine.md`. Brak modyfikacji `src/audio/**` i `src/rhythm/**`.
- **Theory embed** (faza 2 planu): `TheoryEmbed { tool, root?, scaleType? }` w module — `TheoryCard` renderuje
  `CircleOfFifths` / `ScaleExplorer` / `ChordLibrary` / `TriadVisualizer` z propsami początkowymi (dodane opcjonalne
  `initialRoot`/`initialScaleType`/`initialKey`; rejestr `TheoryTool` przyjmuje komponenty z opcjonalnymi propsami).
  Moduły 3/4/7/10/11/18/20 mają dodatkowo linki do `/ear-training` (`supplementary`, bez wpływu na zaliczenie).
- **Fretboard**: reuse `src/components/fretboard/Fretboard.tsx` (props `activeNotes: NoteStatus[]`,
  `onNoteClick`, `fitContainer`) — plik niezmieniony. Diagramy skal oznaczają dźwięki przez
  `status: "active"` + `label` (stopień 1/b3/…) + `emphasis: "strong"` dla roota.
  Root jest wyróżniony statycznie (bez polegania na pulsie): `NoteDot` dodaje `note-dot--active-strong` (pełne
  bursztynowe wypełnienie, bez pierścienia) albo `note-dot--correct-strong` (cel mikrofonu: zielony + 1px pierścień
  `outline` na zewnątrz kropki, ciemny w jasnym motywie, jasny w ciemnym); obie bez obramowania, rozmiar kropki bez
  zmian. Pierścień wewnątrz kropki przecinał etykietę przy ~18 px (390 px), a szerszy zewnętrzny nachodziłby na
  markery na sąsiednich progach (odstęp ~1,4 px przy 390).
  Wysokość rzędów strun: każdy gryf improvu (`BackingLoopExercise`, `DiagramDrill`, `PracticeLinkExercise`,
  osadzenie w `TheoryCard`) dostaje klasę `IMPROV_FRETBOARD_ROWS` (`src/lib/improv/display.ts`):
  `.fret-cell` ma `min-height: clamp(1.75rem, 5.6vw, 2.75rem)`, czyli rząd rośnie razem z kropką
  (`clamp(16px, 4.6vw, 34px)`, ×1.12 aktywna) — przy 1280 px rząd 44 px na kropkę 38 px, bez nachodzenia
  znaczników na sąsiednich strunach; na telefonie rząd zostaje 28 px.
  Zmiany współdzielone (run improv-dev-run1, działają w całej aplikacji, nie tylko w improvie):
  `src/components/fretboard/NoteDot.tsx` (klasy `note-dot--active-strong`/`note-dot--correct-strong` dla
  `emphasis: "strong"` przy statusie `active`/`correct`) i reguły `.note-dot--active-strong`/`.note-dot--correct-strong`
  w `src/index.css` zmieniają wygląd każdej kropki z `emphasis: "strong"` — poza improvem pryma w `ScaleExplorer`,
  `CagedVisualizer`, `TriadVisualizer`, `IntervalFretboardTrainer` i aktywny palec w `Technique` (wszystkie ze statusem
  `active`, więc pełne bursztynowe wypełnienie); `src/components/ui/slider.tsx` ma w jasnym motywie tor `bg-stone-300`
  (w ciemnym nadal `bg-secondary`) w każdym `Slider` aplikacji. `Fretboard.tsx` bez zmian.
- **i18n**: top-level namespace `improv` w `src/locales/{en,pl}/translation.json` (505 liści każdy;
  parzystość testowana w `src/lib/improv/__tests__/improvI18nParity.test.ts`). Nazwy modułów: PL +
  termin EN (`.name` / `.term`); teoria 3–6 zdań PL z terminami EN (EN pełne tłumaczenie).
  Od rundy 2 dodatkowo `nav.improv` („Improv") w obu locale; klucze `library.improv` /
  `library.improvSummary` / `improv.libraryCard.*` pozostały wtedy w plikach (nieużywane po usunięciu
  karty z biblioteki; usunięte w rundzie 7). Runda 2 poprawiła też literówkę „przyuya" → „przykluczowe" (8 wystąpień
  PL: quiz keySig, nazwa i teoria modułu `key-signatures`, opisy ćwiczeń). Runda 3: klucze
  `improv.drill.threshold`, `improv.q.keySig.countToKey` i `improv.q.keySig.hintCount` używają
  form liczby mnogiej i18next zamiast „(s)" (w obu locale `_one`/`_few`/`_many`/`_other` — parzystość liści;
  EN korzysta tylko z `_one`/`_other` — `drill.threshold` interpoluje `{{count}}`, wywołanie w `DiagramDrill.tsx` przekazuje
  `{ count }`), a nagłówek widoku modułu renderuje termin EN (`.term`) tylko wtedy, gdy różni
  się od nazwy (w EN ukryty dla wszystkich 22 modułów, w PL dla `giant-steps`); od rundy 6 ta
  sama reguła obowiązuje wiersze roadmapy. Runda 6: treść pytań/podpowiedzi E2 interpoluje
  wartości przez `localizePromptValues` (Bb→B, B→H na polach notowych; surowe tokeny opcji
  bez zmian). Runda 7: nowe klucze `improv.quiz.attempts/attemptsValue` (licznik zaliczonych podejść),
  `improv.drill.runNeedsMetronome`, `improv.q.chordScale.chordToModeGeneric` (mol melodyczny/harmoniczny
  bez dopisku „w tonacji C major”); usunięte martwe klucze `library.improv`, `library.improvSummary`,
  `improv.libraryCard.*`.
- **Notacja polska**: nazwy nut/akordów przechodzą przez `localizeToken` (Bb→B, B→H) wyłącznie na
  warstwie wyświetlania; treść pytań przez `localizePromptValues`; logika odpowiedzi porównuje surowe tokeny.
- **XP i sesje** (faza 1.4 planu): pierwsze zaliczenie ćwiczenia daje +50 XP (`useProgressStore.addBonusXP`)
  z toastem `useXPToast` (w `ExerciseFrame`, tylko na przejściu niezaliczone→zaliczone); koniec podejścia quizowego
  zapisuje sesję (`recordSession`) z wynikiem i czasem trwania.
- **Weryfikacja mikrofonem** (faza 4 planu): `BackingLoopExercise` ma toggle „Sprawdzaj mikrofonem” (`usePitchDetector`);
  w oknie pierwszego uderzenia każdego akordu (skorygowanym o `inputLatencyMs` z kalibracji rytmu) wykryta klasa
  dźwięku musi należeć do `targets` akordu (`ChordMicTargets`); trafienie podświetla akord na zielono; obieg auto-zapisuje
  się przy ≥3/4 trafień; bez mikrofonu ćwiczenie działa jak wcześniej (samoocena) i nie blokuje użytkownika.
- **Uczciwe zaliczanie** (faza 1.2 planu): przycisk „Przebieg zaliczony” w E3 aktywuje się dopiero po tylu
  uderzeniach metronomu, ile nut ma przebieg góra–dół (`MetronomeClicker` ma opcję `onBeat`); bez uruchomienia
  metronomu przebiegu nie da się zapisać.

## 5. Testy (vitest, jsdom)

| Plik | Pokrycie |
| --- | --- |
| `src/data/improv/__tests__/curriculum.test.ts` | 22 moduły, kolejność 1:1 z mapą wideo (`EXPECTED_ORDER`), unikalne id, ≥2 ćwiczenia/moduł z progami, pokrycie 4 silników, `coversAllDegrees` dla każdego okna drillu, odblokowywanie sekwencyjne, warunki zaliczenia, `micLoopPass` (3/4), practice-link bez pustych strun i `nonGating`, brak duplikatów okien w module, forma Giant Steps; A2 (zaliczone samoocenianymi obiegami ≠ zweryfikowane), A4 (G7–F), A5 (cztery arpeggia w module 11), B4 (warianty play-rest i 2+2 z podpowiedziami taktów, `nonGating`). |
| `src/lib/improv/__tests__/scaleShapes.test.ts` | pcs i rooty boxów, dwie nuty na strunę w boksie A min-pent, transpozycja, okna bez „dziur" (`coversAllDegrees`), inwariancja kształtu względem przesunięcia toniki, klucze bemolowe (pcs/rooty dla Bb/Db/Eb/Gb/Ab), arpeggia jako kształty pełnego okna (m7, dom7, maj7, m7b5), rejestr kształtów (usunięte kształty 0.2); A3: pozycje w stroju drop-D i `isStandardTuning`. |
| `src/lib/improv/__tests__/questions.test.ts` | determinizm z seedem, 2–4 unikalne opcje + dokładnie 1 poprawny indeks dla wszystkich 12 generatorów, `tritoneSub` (G7→Db7, Bb7→E7, Ab7→D7), mapowania (Dm7←A7, 7alt→Altered, cykl Coltrane), tryby od własnej prymy, akordy na stopniach mola melodycznego/harmonicznego, id pytania z faktycznego generatora, pule fazy 5 (unikalne pytania na 300 losowań: ≥30 dla każdego generatora poza `coltrane` ≥12 i `triadType` ≥20 + kierunki per generator), testy muzyczne fazy 0 (tonal-oracle triad, subV→tonika, backdoor-sekwencja, Cmaj7→Ionian, charakterystyki bez prozy); A6: tonacja paralelna = `minorRelative`. |
| `src/lib/improv/__tests__/backingLoop.test.ts` | kolejność akordów/beatów na fake clocku (`vi.useFakeTimers` + kontrolowany `now()`), `onLoopEnd` po pełnej progresji z zawijaniem pętli, `setBpm`, `stop()`. |
| `src/stores/__tests__/useImprovStore.test.ts` | plan fazy 1: quiz attempt liczony tylko przy `correct ≥ requiredCorrect`, próg 2 podejść, migracja legacy `quizBest`; A2: obieg z przycisku tylko w `exerciseRuns`, z mikrofonem w obu licznikach, ćwiczenie zaliczone samymi samoocenianymi obiegami jest niezweryfikowane, stan bez `verifiedRuns` migruje jako niezweryfikowany. |
| `src/lib/improv/__tests__/improvI18nParity.test.ts` | parzystość liści `improv` PL/EN, `improv.modules` ≡ `IMPROV_ORDER`, `improv.ex` ≡ id ćwiczeń, skan statycznych `t("improv…")` w źródłach modułu, klucze celów/etykiet/podpowiedzi wszystkich pętli w obu językach. |
| `src/lib/improv/__tests__/display.test.ts` | `localizePromptValues` (EN: nuty i etykieta spoza `improv.term` niezmienione, PL notacja na polach notowych i w listach, pola nienotowe i liczby bez zmian), `localizeAnswer` (tryby, skale macierzyste, nuty w odpowiedziach), każdy akord pętli kursu gra ≥3 dźwięki (`getChordMidis`); `barCue` (mapowanie z `display.ts`: `improv.hints.barPlay` → `play`, `barRest` → `rest`, `barQuestion1`/`barQuestion2` → `call`, `barAnswer1`/`barAnswer2` → `answer`, inne podpowiedzi i brak podpowiedzi → `null`; test sprawdza wprost `barRest`, `barPlay`, `barQuestion2`, `barAnswer1`, `dorianDm7` → `null` i brak podpowiedzi; w kursie takty pauzy są w progresji bazowej i wariancie `play-rest`, nie w `call-response`, a znaczniki taktów mają tylko `pentatonic-scale.e6` i `target-chord-tones.e4`). |
| `src/lib/improv/__tests__/loopTools.test.ts` | B2: wszystkie pętle kursu × 11 przesunięć zachowują interwały między prymami akordów, rodzaj akordu i interwał cel–pryma; B3 raport; B5 rampa. |
| `src/lib/improv/__tests__/chords.test.ts` | B1: pozycje dźwięków akordu = dźwięki akordu z `tonal`, pryma i cele oznaczone, stopnie (1, b3, b5 …). |
| `src/components/improv/__tests__/LoopHitReport.test.tsx` | B3: render listy trafień (EN i PL, zapis H/B). |

## 6. Ograniczenia / świadome uproszczenia

- Ćwiczenia E3/E4: E3 wymaga metronomu (gating po uderzeniach), E4 ma opcjonalną weryfikację mikrofonem
  (faza 4 planu) — bez mikrofonu pozostaje samoocena. Uwaga z planu: przed dalszym wdrażaniem mikrofonu
  (poza modułem 12) sprawdzić na prawdziwej gitarze, czy detekcja jest wiarygodna, gdy podkład gra z głośnika;
  jeśli nie — weryfikacja wymaga słuchawek i trzeba to napisać w interfejsie.
- Parowanie Altered→m7b5 z wideo (moduł 19) jest opisane w teorii z notką; quiz używa standardowej
  pary 7alt→Altered.
- Diagramy skal to „okno progów" (wszystkie dźwięki skali w zakresie), a nie przypisanie palcowania
  (fingering pass istniejący w aplikacji nie jest tu podpięty).
- Sync wizualny promptera E4 odbywa się przez `setTimeout(delayMs)` względem zegara AudioContext —
  wystarczające dla ćwiczenia, bez twardego jitter-budgetu.

## 7. Runda 13 — poprawki po ponownym audycie (2026-11-14)

- **Generatory:** tryby od własnej prymy (`modeNotesFromRoot` obraca skalę — naprawia też odtwarzanie
  ze słuchu), V7/I = G7, ii–V i cykl Coltrane'a z poprawnej tonacji, akordy mola melodycznego
  i harmonicznego na właściwych stopniach, pytanie o skalę macierzystą bez tonacji w treści (była
  odpowiedzią), dim7 bez równoważnych dystraktorów, tonacja w pytaniach o dominanty poboczne
  i akordy pożyczone. Id pytania zaczyna się od faktycznego generatora (powtórki i test na wejście
  wcześniej widziały `mixed`); `sequential` = jedno pytanie na moduł w teście na wejście.
- **Zaliczanie:** pętla z wariantami wymaga udanych obiegów w każdym wariancie (`loopRunKey`
  → `exerciseRuns["<id>#<wariant>"]`); test na wejście odblokowuje moduły do pierwszego błędu
  włącznie; powtórki losują generatory należne wg SM-2 (`reviewSRS`); `noteToTab` w modułach 1/5
  jest dodatkowe (te same `positionStats` co `fretboardToNote`). Mikrofon i bas przełączane
  w trakcie pętli (refy); cele mikrofonu w modułach 13/16 to tercje (i septymy), nie całe akordy.
- **Pętle:** prawdziwa 16-taktowa forma Giant Steps z trzema poziomami; `m(maj7)` parsowane
  (`getChordInfo`); test sprawdza, że każdy akord pętli gra ≥3 dźwięki. Drugi diagram w modułach
  3/18/20 to inna pozycja (test: brak duplikatów okien w module).
- **Teksty:** `localizeAnswer` (`display.ts`) tłumaczy odpowiedzi (`improv.term.*`: tryby, rodzaje
  akordów, „X-moll melodyczna”) i przelicza nuty w sekwencjach na zapis polski. Teksty PL
  przepisane jednym słownikiem (terminy jak w `ScaleExplorer`, nuty w zapisie H/B zgodnym
  z prompterem); usunięte nieużywane klucze `fretQuiz`, `loop.loop.*`.

## 8. Plan rozwoju — wydania 1 i 2 (etapy A i B, run improv-dev-run1)

Źródło: `docs/improv-development-plan.md`. A1 (test mikrofonu na gitarze) pozostaje otwarty.

- **A2 — zaliczenia niezweryfikowane.** `ImprovModuleProgress.verifiedRuns?: Record<string, number>`
  (`src/stores/useImprovStore.ts`) liczy obiegi potwierdzone mikrofonem, pod tym samym kluczem co
  `exerciseRuns` (`loopRunKey`). `recordLoopPass(moduleId, exerciseId, variantId?, verified = false)`:
  obieg zapisany przyciskiem trafia tylko do `exerciseRuns`, obieg zaliczony mikrofonem (`micLoopPass`)
  do obu liczników. Reguły zaliczania się nie zmieniły (`isExercisePassed` czyta `exerciseRuns`).
  `isExerciseVerified` (`curriculum.ts`) sprawdza próg na samych `verifiedRuns`; gdy ćwiczenie jest
  zaliczone, a nie zweryfikowane, `ExerciseFrame` (prop `unverified`) pokazuje obok „Zaliczone”
  bursztynową odznakę „Niezweryfikowane” (`improv.status.unverified`, podpowiedź `unverifiedHint`).
  Dotyczy wszystkich pętli, także tych bez celów mikrofonu. Stan zapisany przed A2 nie ma
  `verifiedRuns` — `merge` uzupełnia `{}`, więc wcześniejsze obiegi liczą się jako niezweryfikowane.
- **A3 — ustawienia gryfu.** `DiagramDrill` i `PracticeLinkExercise` czytają
  `useSettingsStore` (`full.instrument.leftHanded`, `quick.tuning` przez `normalizeTuning`, jak
  `ScaleExplorer`) i przekazują `leftHanded`/`tuning` do `Fretboard`; `getShapePositions` dostaje strój
  z ustawień. `isStandardTuning` (`scaleShapes.ts`) porównuje sześć strun ze strojem standardowym;
  przy innym stroju diagram pokazuje `improv.drill.tuningNotice` (kotwica toniki zakłada niską strunę E).
- **A4.** Wariant miksolidyjski modułu 7: `G7–F` (podpowiedź `improv.hints.mixolydianF`).
- **A5.** Moduł 11: drille `arpeggios.e4` (Cmaj7, `maj7-arp`, progi 7–11) i `arpeggios.e5`
  (Hm7b5, `m7b5-arp`, progi 7–11); teoria modułu wymienia cztery rodzaje arpeggiów.
- **A6.** `keySig` ma kierunek `relative-minor` (tonacja paralelna = VI stopień, odpowiedź
  `Key.majorKey(k).minorRelative + "m"`, dystraktor: tonacja jednoimienna), losowany w mieszanym quizie
  `key-signatures.e1`. Klucze `improv.q.keySig.relativeMinor`, `hintRelative`.
- **A7.** Usunięty martwy `improvTotalXP` w `src/pages/Progress.tsx`. Pliki wdrożeniowe w `app/` nie są
  przebudowywane w tym runie (decyzja przy scaleniu gałęzi).
- **B1 — gryf z dźwiękami akordu.** `getChordTonePositions(chord, { tuning, fretFrom, fretTo, targets? })`
  (`chords.ts`) zwraca pozycje dźwięków akordu ze stopniem (`label`: 1, b3, 5, b7, #11 …), `isRoot`,
  `isTarget`. `BackingLoopExercise` pokazuje pod prompterem `Fretboard` (progi 1–12, `fitContainer`,
  `leftHanded`/`tuning` z ustawień) dla bieżącego akordu: pryma `emphasis: "strong"`, cele mikrofonu
  bieżącego akordu na zielono (`status: "correct"`). Przełącznik `improv.loop.fretboardToggle`
  (domyślnie włączony); gryf zmienia się razem z `currentChordIndex`.
- **B2 — tonacja pętli.** `BackingLoopParams.key?` / `BackingLoopVariant.key?` (np. `"C"`, `"Am"`);
  bez pola tonacją jest pryma pierwszego akordu (+ `m` dla akordu molowego, `loopKey`). Pola ustawione
  tam, gdzie pierwszy akord nie jest toniką: moduły 9, 11, 13 (e3), 15 (wariant z filmu: G), 17, 19
  (Cm; vamp D7#11: D), 21 (Am). Selektor `improv.loop.key` oferuje 12 tonacji tego samego trybu;
  akordy, cele mikrofonu, gryf, dźwięk podkładu i bas są przesuwane tym samym interwałem
  (`keyShiftInterval` = `Interval.distance` między tonikami). Po transpozycji w karcie celu pojawia się
  `improv.loop.transposedNotice` (cel i podpowiedzi dotyczą oryginalnej tonacji). Zmiana tonacji lub
  wariantu zatrzymuje pętlę; obiegi liczą się do tego samego ćwiczenia/wariantu.
- **B3 — wynik po obiegu.** Gdy mikrofon jest włączony i pętla ma cele, po każdym obiegu
  `loopChordReport` (jeden wiersz na akord progresji, w kolejności) zasila `LoopHitReport`
  (`improv.loop.reportTitle`, trafiony/nietrafiony).
- **B4 — fraza i pauza.** Nowe ćwiczenia `pentatonic-scale.e6` (Am7–Am7–Dm7–Em7) i
  `target-chord-tones.e4` (Am–C–Em–D) z wariantami `play-rest` („Takt gry, takt pauzy”) i
  `call-response` („Pytanie–odpowiedź (2+2 takty)”); każdy takt ma `hintKey`
  (`improv.hints.barPlay/barRest/barQuestion1/2/barAnswer1/2`). Zgodnie z zasadą 3 planu ćwiczenia są
  dodatkowe: `BackingLoopParams.nonGating = true`, a `isModuleComplete` pomija każde ćwiczenie z
  `nonGating` (`isNonGating`), więc moduły 3 i 12 nie są trudniejsze do zaliczenia.
  Wygląd taktów (statyczny, bez animacji, więc działa też przy reduced motion): `barCue(hintKey)`
  (`display.ts`) zamienia podpowiedź taktu na `play`/`rest`/`call`/`answer`, a prompter ustawia
  `data-bar-cue`. Podpowiedź takiego taktu to pigułka `text-lg` pogrubiona wersalikami w miejscu
  szarego `text-xs`: „Graj” i takty pytania — bursztynowa (`bg-primary/15 text-primary`), takty
  odpowiedzi — zielona (`emerald`), „Pauza — słuchaj” — odwrócona (`bg-foreground text-background`).
  Tylko w takcie pauzy prompter ma przerywaną ramkę i tło `bg-muted/60`, nazwa akordu traci bursztyn
  (`text-muted-foreground`, nadal 36 px i czytelna — gracz słucha i planuje), a gryf z legendą ma
  `opacity-40`. Kropki uderzeń bez zmian. Pętle bez tych podpowiedzi (np. inne `hintKey` ze skalami
  czy tonacjami albo bez `hintKey`) wyglądają jak wcześniej.
- **B5 — rampa tempa.** Przełącznik `improv.loop.rampToggle` („+5 BPM co 2 udane obiegi”, domyślnie
  wyłączony). Każdy udany obieg (mikrofon albo przycisk) zwiększa licznik sesji;
  `rampBpmAfterPass(bpm, n, maxBpm)` podnosi tempo o 5 BPM przy co drugim obiegu, najwyżej do `maxBpm`
  ćwiczenia, i ustawia je w schedulerze (`setBpm`). Licznik zeruje się przy starcie i włączeniu rampy.

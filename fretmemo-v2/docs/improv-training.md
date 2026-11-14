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
| `src/data/improv/curriculum.ts` | KANONICZNA lista 22 modułów (`CURRICULUM`, `IMPROV_ORDER`): id, order, klucze i18n, ćwiczenia z parametrami silników i progami. Czyste funkcje pomocnicze: `isModuleUnlocked`, `isModuleComplete`, `isExercisePassed`, `countCompletedModules`. |
| `src/lib/improv/scaleShapes.ts` | Geometria kształtów na gryfie: definicje (`SCALE_SHAPES`: pentatoniki, major, mol melodyczny/harmoniczny, triada, m7/dom7 arp), `getScaleShapePositions` (box w oknie progów) i `getChordShapePositions` (jedna nuta na strunę, backtracking + wybór najciaśniejszego voicingu), `coversAllDegrees`. Czyste funkcje na `STANDARD_TUNING` + `getNoteAt` (bez tonal — arytmetyka chromatyczna). `notePitchClass` obsługuje oba spellingi: ostre przez `NOTES` i bemolowe klucze `ImprovKey` (`Bb/Db/Eb/Gb/Ab` przez `FLAT_NAMES` — pattern z `questions.ts`). |
| `src/lib/improv/questions.ts` | Generatory pytań (E1 + E2): seeded mulberry32 (`createRng`), `generateFretboardQuestions` (quiz gryfowy w obu kierunkach), `generateChoiceQuiz` z 12 generatorami (`keySig`, `modes`, `triadBuild`, `chordScaleMajor`, `triadType`, `chordScaleMelodic`, `chordScaleHarmonic`, `tritone`, `secondaryDom`, `borrowed`, `pivot`, `coltrane`). Deterministyczne względem seeda; odpowiedź porównywana na surowych (niezlokalizowanych) stringach. Faza 0 planu: triady stackują 1-3-5 (`degree+3`, test tonal-oracle dla C-dur M m m M M m dim), subV rozwiązuje się do toniki kwintę w dół od dominanty (`subVResolutionTarget`), backdoor zawsze pyta o sekwencję Fm7–Bb7–C, Cmaj7→Ionian w danych, charakterystyki trybów bez prozy. |
| `src/lib/improv/chords.ts` | Dane akordowe do E4: `getChordInfo` (tonal `Chord.get`), `getChordMidis` (rosnące MIDI od `baseMidi`), `getChordPitchClasses`, `tonicMidi`. |
| `src/lib/improv/backingLoop.ts` | `BackingLoopScheduler` — lookahead scheduler pętli akordowej (wstrzykiwany `LoopClock` → testowalny z fake clockiem; warstwy callbacków: `onBeatSchedule` z dokładnym czasem audio, `onChordChange`/`onBeat`/`onLoopEnd` z `delayMs` dla UI i `playTone`). |
| `src/lib/improv/click.ts` | `MetronomeClicker` — minimalny lookahead scheduler klików (triangle, akcent na 1) prosto do `ctx.destination` (ta sama polityka co `playCountInClicks`); degraduje się do no-op bez AudioContext. |
| `src/lib/improv/display.ts` | `ENGINE_LABEL_KEYS`, `localizeToken` (notacja polska B→H przez `formatLocalizedNoteToken`), `localizePromptValues` (lokalizuje wyłącznie pola notowe prompt/hint: `key/chord/sub/v/dominant/target/ii/first/second/source` + listy `list/keys` i `notes/cycle`; matching zawsze na surowych tokenach) — wydzielone, by pliki komponentów eksportowały wyłącznie komponenty (fast refresh). |
| `src/stores/useImprovStore.ts` | zustand + persist (`fretmemo-improv-v1`): `moduleState[id] = { exerciseRuns, completed }`, `unlockAll`; akcje `recordQuizResult`, `recordDrillRun`, `recordLoopPass`, `resetModule`, `resetProgress`, `setUnlockAll`. Semantyka liczników (faza 1 planu): quiz = liczba ZALICZONYCH podejść (run liczy się tylko gdy `correct ≥ requiredCorrect`; próg ćwiczenia = `QUIZ_PASSED_ATTEMPTS` = 2 podejścia), drill = pełne przebiegi, loop = udane obiegi. Flaga `completed` przeliczana przez `isModuleComplete` z curriculum. `merge` migruje legacy `quizBest` na 1 zaliczone podejście pierwszego quizu modułu. |
| `src/pages/ImprovTraining.tsx` | Dwa widoki na jednym komponencie strony: roadmapa (postęp, switch unlockAll, lista 22 ze statusami) i szczegół modułu (TheoryCard + ćwiczenia wg silnika; blokada/404 jak w `EarTraining`). |
| `src/components/improv/TheoryCard.tsx` | Karta teorii (tekst z `improv.modules.<id>.theory`). |
| `src/components/improv/ExerciseFrame.tsx` | Wspólna rama ćwiczenia: badge silnika, badge progu, badge „zaliczone", tytuł + opis; `ScoreStrip`. |
| `src/components/improv/FretboardQuiz.tsx` | E1 `fretboard-quiz` (pozycja→nuta na przyciskach; nuta→pozycja na klikalnym `Fretboard`). |
| `src/components/improv/ChoiceQuiz.tsx` | E2 `choice-quiz` (1 z 4, feedback + podpowiedź, auto-advance, podsumowanie). |
| `src/components/improv/DiagramDrill.tsx` | E3 `diagram-drill` (diagram kształtu z etykietami stopni, wybór kształtu/tonacji, BPM slider, metronom, root przy starcie, ręczne oznaczanie przebiegu). |
| `src/components/improv/BackingLoopExercise.tsx` | E4 `backing-improv` (loop progresji blokami akordowymi, prompter „teraz/następny", cel ćwiczenia, warianty, BPM, ręczne oznaczanie udanych obiegów). |

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
  progression, goalKey) obsługuje przełączniki typu „normal vs subV" (moduł 15) i „tercja vs kwinta"
  (moduł 12 — jako dwa osobne ćwiczenia). Próg: liczba udanych obiegów.

Moduł jest zaliczony (`completed`), gdy **każde** jego ćwiczenie osiągnie własny próg
(quiz: `exerciseRuns[exerciseId] ≥ QUIZ_PASSED_ATTEMPTS` — 2 zaliczone podejścia; drill/loop: `exerciseRuns[exerciseId] ≥ requiredRuns/requiredPasses`;
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
  `library.improv`, `library.improvSummary`, `improv.libraryCard.*` pozostały w plikach tłumaczeń
  (nierozwiązane, bez wpływu na UI).
- **E4 pętle** (faza 3 planu): pętle w modułach 3, 4, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22
  (spoza pętli pozostają 1, 2, 5, 8 — moduły wiedzy); wpisy progresji niosą opcjonalny `hintKey` (podpowiedź
  pod akordem w prompterze, np. „D dorian — celuj w B”) i `beats` (Am7 trzymane 4 takty w module 3); moduł 12
  ma drabinkę pryma→tercja→kwinta→septyma + wolną improwizację, moduł 22 pełną 16-taktową formę Giant Steps
  (2 uderzenia/akord, od 60 BPM) z trzema poziomami trudności.
- **Audio**: E3 gra root przez `playTone` (sampler/synteza → voice bus silnika dźwięku);
  kliki metronomu (`MetronomeClicker`) w E3 idą bezpośrednio do `ctx.destination`; E4 gra
  bloki akordowe przez `playChord` (strum 55 ms, bez klika) — zgodnie z polityką z
  `docs/sound-engine.md`. Brak modyfikacji `src/audio/**` i `src/rhythm/**`.
- **Theory embed** (faza 2 planu): `TheoryEmbed { tool, root?, scaleType? }` w module — `TheoryCard` renderuje
  `CircleOfFifths` / `ScaleExplorer` / `ChordLibrary` / `TriadVisualizer` z propsami początkowymi (dodane opcjonalne
  `initialRoot`/`initialScaleType`/`initialKey`; rejestr `TheoryTool` przyjmuje komponenty z opcjonalnymi propsami).
  Moduły 7/10/11 mają dodatkowo linki do `/ear-training` (`supplementary`, bez wpływu na zaliczenie).
- **Fretboard**: reuse `src/components/fretboard/Fretboard.tsx` (props `activeNotes: NoteStatus[]`,
  `onNoteClick`, `fitContainer`) — plik niezmieniony. Diagramy skal oznaczają dźwięki przez
  `status: "active"` + `label` (stopień 1/b3/…) + `emphasis: "strong"` dla roota.
- **i18n**: top-level namespace `improv` w `src/locales/{en,pl}/translation.json` (291 liście każdy;
  parzystość testowana w `src/lib/improv/__tests__/improvI18nParity.test.ts`). Nazwy modułów: PL +
  termin EN (`.name` / `.term`); teoria 3–6 zdań PL z terminami EN (EN pełne tłumaczenie).
  Od rundy 2 dodatkowo `nav.improv` („Improv") w obu locale; klucze `library.improv` /
  `library.improvSummary` / `improv.libraryCard.*` pozostały w plikach (nieużywane po usunięciu
  karty z biblioteki). Runda 2 poprawiła też literówkę „przyuya" → „przykluczowe" (8 wystąpień
  PL: quiz keySig, nazwa i teoria modułu `key-signatures`, opisy ćwiczeń). Runda 3: klucze
  `improv.drill.threshold`, `improv.q.keySig.countToKey` i `improv.q.keySig.hintCount` używają
  form liczby mnogiej i18next zamiast „(s)" (EN `_one`/`_other`, PL `_one`/`_few`/`_many`/`_other`
  — `drill.threshold` interpoluje `{{count}}`, wywołanie w `DiagramDrill.tsx` przekazuje
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
| `src/data/improv/__tests__/curriculum.test.ts` | 22 moduły, kolejność 1:1 z mapą wideo (`EXPECTED_ORDER`), unikalne id, ≥2 ćwiczenia/moduł z progami, pokrycie 4 silników, `coversAllDegrees` dla każdego okna drillu, odblokowywanie sekwencyjne, warunki zaliczenia. |
| `src/lib/improv/__tests__/scaleShapes.test.ts` | pcs i rooty boxów, transpozycja, okna bez „dziur", najciaśniejsze voicingi triad/arp (jedna nuta na strunę, wszystkie dźwięki akordu), klucze bemolowe (pcs/rooty dla Bb/Db/Eb/Gb/Ab). |
| `src/lib/improv/__tests__/questions.test.ts` | determinizm z seedem, 4 unikalne opcje + 1 poprawna dla wszystkich 12 generatorów, `tritoneSub` (G7→Db7, Bb7→E7, Ab7→D7), mapowania (Dm7→A7, 7alt→Altered, cykl Coltrane), E1 (kierunki, opcje, determinizm), testy muzyczne fazy 0 (tonal-oracle triad, subV→tonika, backdoor-sekwencja, Cmaj7→Ionian, charakterystyki bez prozy), inwariancja kształtu względem przesunięcia toniki, usunięte kształty 0.2, arps jako skale + maj7/m7b5. |
| `src/lib/improv/__tests__/backingLoop.test.ts` | kolejność akordów/beatów na fake clocku (`vi.useFakeTimers` + kontrolowany `now()`), `onLoopEnd` po pełnej progresji z zawijaniem pętli, `setBpm`, `stop()`. |
| `src/stores/__tests__/useImprovStore.test.ts` | plan fazy 1: quiz attempt liczony tylko przy `correct ≥ requiredCorrect`, próg 2 podejść, migracja legacy `quizBest`. |
| `src/lib/improv/__tests__/improvI18nParity.test.ts` | parzystość liści `improv` PL/EN, `improv.modules` ≡ `IMPROV_ORDER`, `improv.ex` ≡ id ćwiczeń, skan statycznych `t("improv…")` w źródłach modułu. |

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

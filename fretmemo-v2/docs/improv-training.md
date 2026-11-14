# Improv Training — architektura modułu

Date: 2026-11-13 (round 5 update — fix flat keys w scaleShapes: `notePitchClass` resolvuje spellingi bemolowe `Bb/Db/Eb/Gb/Ab` z `ImprovKey` zamiast mapować je na pitch class C; testy pcs/rootów dla Bb/Db/Eb oraz weryfikacja pcs per defaultKey w curriculum.test.ts)
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
| `src/lib/improv/questions.ts` | Generatory pytań (E1 + E2): seeded mulberry32 (`createRng`), `generateFretboardQuestions` (quiz gryfowy w obu kierunkach), `generateChoiceQuiz` z 12 generatorami (`keySig`, `modes`, `triadBuild`, `chordScaleMajor`, `triadType`, `chordScaleMelodic`, `chordScaleHarmonic`, `tritone`, `secondaryDom`, `borrowed`, `pivot`, `coltrane`). Deterministyczne względem seeda; odpowiedź porównywana na surowych (niezlokalizowanych) stringach. |
| `src/lib/improv/chords.ts` | Dane akordowe do E4: `getChordInfo` (tonal `Chord.get`), `getChordMidis` (rosnące MIDI od `baseMidi`), `getChordPitchClasses`, `tonicMidi`. |
| `src/lib/improv/backingLoop.ts` | `BackingLoopScheduler` — lookahead scheduler pętli akordowej (wstrzykiwany `LoopClock` → testowalny z fake clockiem; warstwy callbacków: `onBeatSchedule` z dokładnym czasem audio, `onChordChange`/`onBeat`/`onLoopEnd` z `delayMs` dla UI i `playTone`). |
| `src/lib/improv/click.ts` | `MetronomeClicker` — minimalny lookahead scheduler klików (triangle, akcent na 1) prosto do `ctx.destination` (ta sama polityka co `playCountInClicks`); degraduje się do no-op bez AudioContext. |
| `src/lib/improv/display.ts` | `ENGINE_LABEL_KEYS`, `localizeToken` (notacja polska B→H przez `formatLocalizedNoteToken`) — wydzielone, by pliki komponentów eksportowały wyłącznie komponenty (fast refresh). |
| `src/stores/useImprovStore.ts` | zustand + persist (`fretmemo-improv-v1`): `moduleState[id] = { quizBest, drillsDone, loopPasses, exerciseRuns, completed }`, `unlockAll`; akcje `recordQuizResult`, `recordDrillRun`, `recordLoopPass`, `resetModule`, `resetProgress`, `setUnlockAll`. Flaga `completed` przeliczana z progu każdego ćwiczenia modułu. |
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

- **E1 `fretboard-quiz`** — `FretboardQuizParams { direction: position-to-note|note-to-position|both,
  stringIndices (0 = cienka E … 5 = gruba E), fretFrom, fretTo, pitchClasses, questionCount,
  requiredCorrect, answerOptions }`. Próg: `requiredCorrect/questionCount` (np. 10/10).
- **E2 `choice-quiz`** — `ChoiceQuizParams { generatorId, questionCount, requiredCorrect,
  answerOptions, direction? }`. `direction` pinuje kierunek pytań generatora (np. `chord-to-mode`);
  brak = mieszane.
- **E3 `diagram-drill`** — `DiagramDrillParams { shapes: [{ shapeId, defaultKey, keys?, triadQuality? }],
  fretFrom, fretTo, defaultBpm, requiredRuns }`. Próg: liczba pełnych przebiegów (góra+dół).
- **E4 `backing-improv`** — `BackingLoopParams { progression (symbole akordów), goalKey,
  beatsPerChord, defaultBpm/minBpm/maxBpm, requiredPasses, variants? }`. `variants` (id, labelKey,
  progression, goalKey) obsługuje przełączniki typu „normal vs subV" (moduł 15) i „tercja vs kwinta"
  (moduł 12 — jako dwa osobne ćwiczenia). Próg: liczba udanych obiegów.

Moduł jest zaliczony (`completed`), gdy **każde** jego ćwiczenie osiągnie własny próg
(quiz: `quizBest ≥ requiredCorrect`; drill/loop: `exerciseRuns[exerciseId] ≥ requiredRuns/requiredPasses`).

## 4. Integracje

- **Routing**: `App.tsx` — lazy `ImprovTraining`, trasy `/improv` i `/improv/:moduleId` pod
  `<AppShell/>`; `app-route-entrypoints.json` — `/improv` + 22 tras modułów (deep-linki / SPA
  fallback allowlist; testy `scripts/__tests__` zaktualizowane o nową liczbę tras 52).
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
- **Audio**: E3/E4 grają przez `playTone` (sampler/synteza → voice bus silnika dźwięku);
  kliki metronomu (`MetronomeClicker`) w E3 idą bezpośrednio do `ctx.destination`; E4 gra
  wyłącznie bloki akordowe przez `playTone` (bez klika) — zgodnie z polityką z
  `docs/sound-engine.md`. Brak modyfikacji `src/audio/**` i `src/rhythm/**`.
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
  się od nazwy (w EN ukryty dla wszystkich 22 modułów, w PL dla `giant-steps`).
- **Notacja polska**: nazwy nut/akordów przechodzą przez `localizeToken` (Bb→B, B→H) wyłącznie na
  warstwie wyświetlania; logika odpowiedzi porównuje surowe tokeny.

## 5. Testy (vitest, jsdom)

| Plik | Pokrycie |
| --- | --- |
| `src/data/improv/__tests__/curriculum.test.ts` | 22 moduły, kolejność 1:1 z mapą wideo (`EXPECTED_ORDER`), unikalne id, ≥2 ćwiczenia/moduł z progami, pokrycie 4 silników, `coversAllDegrees` dla każdego okna drillu, odblokowywanie sekwencyjne, warunki zaliczenia. |
| `src/lib/improv/__tests__/scaleShapes.test.ts` | pcs i rooty boxów, transpozycja, okna bez „dziur", najciaśniejsze voicingi triad/arp (jedna nuta na strunę, wszystkie dźwięki akordu), klucze bemolowe (pcs/rooty dla Bb/Db/Eb/Gb/Ab). |
| `src/lib/improv/__tests__/questions.test.ts` | determinizm z seedem, 4 unikalne opcje + 1 poprawna dla wszystkich 12 generatorów, `tritoneSub` (G7→Db7, Bb7→E7, Ab7→D7), mapowania (Dm7→A7, 7alt→Altered, cykl Coltrane), E1 (kierunki, opcje, determinizm). |
| `src/lib/improv/__tests__/backingLoop.test.ts` | kolejność akordów/beatów na fake clocku (`vi.useFakeTimers` + kontrolowany `now()`), `onLoopEnd` po pełnej progresji z zawijaniem pętli, `setBpm`, `stop()`. |
| `src/lib/improv/__tests__/improvI18nParity.test.ts` | parzystość liści `improv` PL/EN, `improv.modules` ≡ `IMPROV_ORDER`, `improv.ex` ≡ id ćwiczeń, skan statycznych `t("improv…")` w źródłach modułu. |

## 6. Ograniczenia / świadome uproszczenia

- Ćwiczenia E3/E4 są „guided practice bez mikrofonu": użytkownik sam oznacza pełny przebieg/obieg
  (przyciski aktywują się po pełnym obiegu schedulerów). Rozpoznawanie dźwięku z mikrofonu jest poza
  zakresem kontraktu.
- Parowanie Altered→m7b5 z wideo (moduł 19) jest opisane w teorii z notką; quiz używa standardowej
  pary 7alt→Altered.
- Diagramy skal to „okno progów" (wszystkie dźwięki skali w zakresie), a nie przypisanie palcowania
  (fingering pass istniejący w aplikacji nie jest tu podpięty).
- Sync wizualny promptera E4 odbywa się przez `setTimeout(delayMs)` względem zegara AudioContext —
  wystarczające dla ćwiczenia, bez twardego jitter-budgetu.

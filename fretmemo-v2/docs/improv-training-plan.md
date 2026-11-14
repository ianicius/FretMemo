# Improv Training — plan naprawy i rozwoju

Data: 2026-11-14
Dotyczy: `src/data/improv/`, `src/lib/improv/`, `src/components/improv/`, `src/stores/useImprovStore.ts`, `src/pages/ImprovTraining.tsx`
Stan wyjściowy: opisany w `docs/improv-training.md`. Ten plan wynika z audytu, w którym pytania i diagramy zostały wygenerowane z kodu i porównane z klatkami filmu źródłowego.

## Cel

Użytkownik, który przejdzie 22 moduły, ma umieć zagrać to, czego moduł uczy, a nie tylko rozpoznać nazwę. Trzy zasady, które z tego wynikają:

1. Każdy moduł kończy się graniem na gitarze nad podkładem, nie quizem.
2. Zaliczenie odzwierciedla umiejętność: tam, gdzie da się to sprawdzić mikrofonem, sprawdzamy mikrofonem.
3. Nowy kod powstaje tylko tam, gdzie aplikacja nie ma jeszcze narzędzia. Kolejność 22 modułów z filmu zostaje bez zmian.

## Kolejność prac

| Faza | Zakres | Rozmiar | Efekt |
|---|---|---|---|
| 0 | Błędy merytoryczne | S | Moduł nie uczy błędnych rzeczy |
| 1 | Uczciwe zaliczanie | S | Postęp coś znaczy |
| 2 | Podpięcie istniejących narzędzi | M | Mniej własnego kodu, lepsze ćwiczenia |
| 3 | Granie nad podkładem w każdym module | M | Każdy moduł ma zastosowanie |
| 4 | Weryfikacja mikrofonem | M | Granie jest sprawdzane |
| 5 | Treść i pule pytań | M | Quizów nie da się zdać z pamięci |
| 6 | Rozwój | L | Powtórki, etapy, lepszy podkład |

Fazy 0 i 1 blokują wydanie. Fazy 2–5 można wydawać moduł po module.

---

## Faza 0 — błędy merytoryczne

Każda poprawka dostaje test sprawdzający poprawność muzyczną. Obecne testy sprawdzają tylko „4 opcje, 1 poprawna" i dlatego przepuściły poniższe błędy.

| # | Błąd | Miejsce | Poprawka | Test |
|---|---|---|---|---|
| 0.1 | Kwinta triady liczona jako kwarta; każda odpowiedź to „major" | `questions.ts:469` | `scale[(degree + 3) % 7]` | Dla C-dur stopnie 1–7 dają: major, minor, minor, major, major, minor, diminished |
| 0.2 | Moduł 6 definiuje pięć różnych skal zamiast pięciu boksów jednej pentatoniki | `scaleShapes.ts:48-50`, `curriculum.ts:282-286` | Usunąć `dorian-pent`, `phrygian-pent`, `mixo-pent`. Wszystkie pięć ćwiczeń to `min-pent` w G w oknach 3–6, 5–8, 7–11, 10–13, 12–15 | Każde okno zawiera wyłącznie G, Bb, C, D, F i po dwie nuty na strunę |
| 0.3 | Pętla subV gra Ab7 zamiast Db7 | `curriculum.ts:452`, `goals.tritoneSubV` | `Dm7–Db7–Cmaj7`; cel: tercja Db7 (F) i septyma (Cb/B) | `tritoneSub("G7")` równa się akordowi w wariancie `subv` |
| 0.4 | Quiz podaje złe rozwiązanie subV (Gb7 → C) | `questions.ts:573` | Cel to kwinta w dół od oryginalnej dominanty: `FLAT_NAMES[(pc(dominant) + 5) % 12]` | Db7 → C, Gb7 → F, Ab7 → G |
| 0.5 | Podpowiedzi „Db7 rozwiązuje się do G" | `questions.ts:569,595` | Ta sama wartość co w 0.4 | Jak wyżej |
| 0.6 | Pytanie „Sekwencja Abmaj7 w tonacji C to: backdoor" | `questions.ts:630-644` | Kierunek `backdoor` zawsze pyta o `Fm7–Bb7–C` | W pytaniu nie występuje pojedynczy akord |
| 0.7 | Dopisek „w tonacji C major" przy molu melodycznym i harmonicznym | `improv.q.chordScale.chordToMode` | Osobny klucz bez dopisku dla generatorów `chordScaleMelodic` i `chordScaleHarmonic` | — |
| 0.8 | Brak pary Cmaj7 → Ionian | `CHORD_SCALE_MAJOR` | Dodać | — |
| 0.9 | Polski tekst w danych („podwyższona szóstka") | `questions.ts:206` | Zostawić „6", opis przenieść do tłumaczeń | Test parzystości i18n |

Teksty do poprawy w `locales/pl` i `locales/en`:

- `pentatonic-positions.theory`: pięć pozycji tej samej skali; nazwy „dorian/phrygian/mixo pent" to nazwy boksów zaczynających się od kolejnych dźwięków G-moll pent.
- `borrowed-chords.theory` i `goals.borrowedBackdoor`: nad Fm7 F dorian, nad Bb7 Bb lydian dominant (albo Bb mixolydian); Bb rozwiązuje się o ton w górę do C.
- `chord-construction.theory`: dim to tercja mała i kwinta zmniejszona, aug to tercja wielka i kwinta zwiększona.
- `major-scale.theory`: „trzy dźwięki na strunę" zamiast „grupy po 6".
- `pentatonic-scale.theory`: „folkiem" zamiast „flekiem".
- Wszystkie wystąpienia „progsach" → „progach"; „charakerystycznym", „dominantie", „ta kontrast", „jazzowy zejście", „ląduj na TERCIĘ".

## Faza 1 — uczciwe zaliczanie

| # | Problem | Poprawka |
|---|---|---|
| 1.1 | `quizBest` jest jeden na moduł, więc zdany quiz zalicza wszystkie quizy modułu (`curriculum.ts:604`, `useImprovStore.ts:79`) | Zapisywać najlepszy wynik w `exerciseRuns[exerciseId]`, tak jak drille i pętle. Pole `quizBest` usunąć; w `merge` przenieść starą wartość na pierwsze ćwiczenie quizowe modułu |
| 1.2 | Przycisk „przebieg wykonany" w `DiagramDrill` działa bez uruchomienia metronomu (`DiagramDrill.tsx:97`) | Aktywny dopiero po tylu uderzeniach metronomu, ile nut ma przebieg góra–dół. Docelowo zastąpiony weryfikacją z fazy 4 |
| 1.3 | Jedno szczęśliwe podejście zalicza quiz na zawsze | Zaliczenie quizu wymaga dwóch zdanych podejść z różnymi seedami |
| 1.4 | Moduł nie daje XP i nie zapisuje sesji | Po zaliczeniu ćwiczenia `useProgressStore.addBonusXP`, po sesji `recordSession`; toast przez `useXPToast` |
| 1.5 | Martwe klucze `library.improv`, `improv.libraryCard.*` i pola `drillsDone`, `loopPasses` | Usunąć |

## Faza 2 — podpięcie istniejących narzędzi

Dwa nowe typy ćwiczeń w `curriculum.ts`. Oba są cienkie: nie zawierają własnej logiki ćwiczenia.

**`practice-link`** — przycisk otwierający `/practice` ze stanem trasy, który `Practice.tsx` już obsługuje (`PracticeRouteState`: `mode`, `constraints.enabledStrings`, `fretRange`, `rootNote`, `scaleType`). Zaliczenie czytane z `useProgressStore.getPositionAccuracy`: każda pozycja z zakresu ma co najmniej 3 odpowiedzi i trafność co najmniej 80%. Dzięki temu moduły 1 i 5 korzystają z powtórek SM2, mapy ciepła i trybu z mikrofonem, a `FretboardQuiz.tsx` i `generateFretboardQuestions` można usunąć.

**`theory-embed`** — osadzenie istniejącego komponentu z `src/components/theory/` w karcie teorii modułu. Komponenty nie przyjmują dziś propsów, więc trzeba dodać im opcjonalne wartości początkowe (tonacja, typ skali).

| Moduły | Narzędzie | Co trzeba zrobić |
|---|---|---|
| 1, 5 | Practice: `fretboardToNote`, `noteToTab`, `playNotes` | `practice-link` z ograniczeniem strun i progów |
| 2 | `CircleOfFifths` | `theory-embed` |
| 3, 4, 6, 18, 20 | `ScaleExplorer` (ma już minor pentatonic, major, melodic minor, harmonic minor i tryby) | `theory-embed` z początkową skalą i tonacją |
| 7 | `ScaleExplorer` z dorian, phrygian, lydian, mixolydian, locrian | `theory-embed`; tryby od tego samego dźwięku |
| 8 | `ChordLibrary` | `theory-embed` |
| 10 | `TriadVisualizer` (inwersje i grupy strun już policzone w `computeShapes`) | `theory-embed`; własny kształt `triad` w `scaleShapes.ts` usunąć |
| 7, 10, 11 | `ChordQualityTrainer`, `FunctionalEarTrainer` | Link do `/ear-training` jako ćwiczenie uzupełniające, bez wpływu na zaliczenie |
| 3, 4, 18, 20 | Practice `playNotes` ze `scaleType` i `rootNote` | `practice-link`: granie dźwięków skali sprawdzane mikrofonem zamiast samooceny |

Poprawki we własnych diagramach, które zostają (`DiagramDrill`):

- **Okno progów liczone od toniki.** Zamiast stałych `fretFrom`/`fretTo` parametry `offsetFrom`/`offsetTo` względem progu toniki na strunie E. Zmiana tonacji przesuwa wtedy ten sam kształt. Test: kształt w A i w C ma identyczny układ po odjęciu przesunięcia.
- **Arpeggia jako pełne kształty.** `m7-arp` i `dom7-arp` zmienić na `kind: "scale"`, co pokaże wszystkie dźwięki akordu w oknie na sześciu strunach (tak jak w filmie: Cm7 na 8. progu). Dodać `maj7-arp` i `m7b5-arp`. Funkcję `getChordShapePositions` można wtedy usunąć.

## Faza 3 — granie nad podkładem w każdym module

Silnik `backing-improv` już istnieje i jest sprawny. Dziś pierwsza pętla pojawia się w module 12; poniżej docelowy zestaw. Dla modułów bez pętli wystarczy dopisać wpis w `curriculum.ts` i dwa klucze tłumaczeń.

Jedno rozszerzenie silnika: opcjonalne pole `hint` przy akordzie w progresji, wyświetlane w prompterze pod nazwą akordu (np. „D dorian — celuj w B"). Potrzebne od modułu 7 wzwyż.

| # | Moduł | Pętla do dodania | Cel ćwiczenia |
|---|---|---|---|
| 3 | Pentatonika | Am7 (4 takty) – Dm7 – Em7 | Improwizuj tylko w boksie 1; pierwsza improwizacja w programie |
| 4 | Skala majorowa | C – Am – F – G | Frazy ze skali C-dur, kończ na dźwięku C |
| 6 | Pozycje pentatoniki | Gm7 – Cm7 | Co obieg przejdź do sąsiedniego boksu |
| 7 | Tryby | Cztery warianty: Dm7–G7 (dorian), Em–F (phrygian), F–G/F (lydian), G–F (mixolydian) | Podkreśl stopień charakterystyczny trybu |
| 9 | Akordy a skala | Dm7 – G7 – Cmaj7 z podpowiedzią trybu | Na każdym akordzie zagraj jego dźwięk charakterystyczny |
| 10 | Triady | Am – C – Em – D | Graj wyłącznie triady, zmieniając inwersję o najmniejszy ruch |
| 11 | Arpeggia | Dm7 – G7 – Cmaj7 | Graj wyłącznie arpeggia akordów |
| 12 | Celowanie w dźwięki | (jest) | Dodać stopnie trudności: pryma → tercja → kwinta → septyma → dowolny dźwięk akordu |
| 13 | Prowadzenie głosów | (jest) + Dm7 – G7 – Cmaj7 | Tercje i septymy: F→F→E oraz C→B→B. Dla Gm→Bbm dopisać ruch D→Db, który pokazuje film |
| 14 | Zmiana tonacji | Przed obecną pętlą G→B dodać łatwiejszą: C → F (jedna zmieniona nuta) | Prompter pokazuje aktualną tonację |
| 15 | Zamiany trytonowe | Poprawiona + progresja z filmu: Bm7 – Bb7 – Am7 – Ab7 – Gmaj7 | Chromatyczne zejście basu |
| 16 | Dominanty poboczne | Dodać wariant z pięcioma dominantami: C – E7 – Am – C7 – F – D7 – G7 | Tercja akordu docelowego |
| 17 | Akordy pożyczone | Dwa warianty jak w filmie: 2-5-1 i backdoor 2-5-1 | Porównaj brzmienie obu dróg do C |
| 18 | Mol melodyczny | Am6 – Am(maj7) | Podkreśl 6 i 7 |
| 19 | Akordy a mol melodyczny | Dm7b5 – G7alt – Cm(maj7); wariant: D7#11 (vamp) | Podpowiedź skali przy akordzie |
| 20 | Mol harmoniczny | Am – E7 | Nad E7 graj G# |
| 21 | Akordy a mol harmoniczny | Bm7b5 – E7 – Am | Phrygian dominant nad E7 |
| 22 | Giant Steps | Pełna forma 16 taktów, 2 uderzenia na akord, od 60 BPM | Trzy stopnie: prymy → wzór 1-2-3-5 → arpeggia |

Moduły 1, 2, 5 i 8 nie dostają pętli: uczą wiedzy, którą kolejne moduły od razu zużywają.

## Faza 4 — weryfikacja mikrofonem

Jedno rozszerzenie `BackingLoopExercise`, zbudowane na `usePitchDetector` z `src/services/pitch.ts` i kalibracji z `src/lib/micLatency.ts`.

- Ćwiczenie w `curriculum.ts` dostaje opcjonalne `targets`: dla każdego akordu zbiór dozwolonych klas dźwięków (np. tercje: C, E, G, F#).
- W oknie pierwszego uderzenia każdego akordu (skorygowanym o zmierzoną latencję) wykryta klasa dźwięku musi należeć do zbioru.
- Obieg jest udany, gdy trafione są co najmniej 3 z 4 zmian. Prompter pokazuje trafienie od razu, kolorem na nazwie akordu.
- Bez mikrofonu ćwiczenie działa jak dziś (samoocena), a zaliczenie jest oznaczone jako niezweryfikowane. Nie blokujemy użytkowników bez mikrofonu.

Kolejność wdrażania: moduł 12 (na nim zależy cała druga połowa programu), potem 13, 16, 22. Granie skal (moduły 3, 4, 18, 20) jest już pokryte przez `practice-link` z fazy 2.

Do sprawdzenia na prawdziwej gitarze przed wdrożeniem dalej niż moduł 12: czy detekcja jest wiarygodna, gdy z głośnika gra podkład. Jeśli nie, weryfikacja wymaga słuchawek i trzeba to napisać w interfejsie.

## Faza 5 — treść i pule pytań

Zasada: pytanie ma wymagać policzenia odpowiedzi, a pula ma być większa niż liczba pytań w podejściu.

| Moduł | Dziś | Docelowo |
|---|---|---|
| 2 | Tylko liczba znaków, tylko dur | Dodać: krzyżyki czy bemole, które dźwięki są podwyższone, tonacja paralelna molowa, „które dźwięki ma tonacja D-dur" |
| 7 | 7 pytań o numer, 6 o stopień | Dodać: tryb od podanego dźwięku („D dorian ma dźwięki…"), macierzysta skala durowa trybu („E phrygian to dźwięki…"), rozpoznanie trybu ze słuchu (`playTone` sekwencją) |
| 8 | Triady w ośmiu tonacjach | Dodać akordy septymowe i kierunek „wskaż dźwięki akordu na gryfie" |
| 9 | 9 par, tylko C-dur | Wszystkie 12 tonacji; pytanie podaje tonację i akord |
| 15 | 6 dominant | Wszystkie 12 |
| 16 | 5 par, tylko C-dur | Wszystkie 12 tonacji; dodać V7/I jako notkę z filmu |
| 17 | 5 akordów w C | Co najmniej 4 tonacje |
| 19, 21 | Typy akordów bez prymy („7", „m7") | Konkretne akordy w kontekście („G7alt w tonacji C-moll → skala?"), odpowiedź zawiera też macierzysty mol melodyczny („Ab melodic minor") |
| 22 | 4 różne pytania | ii–V do każdej z trzech tonacji, cykl transponowany od innych dźwięków, „jaki akord następuje po…" |

## Faza 6 — rozwój

W kolejności wartości dla użytkownika. Żadna pozycja nie jest potrzebna do wydania.

1. **Etapy na mapie drogowej.** Podział 22 modułów na cztery grupy bez zmiany kolejności: Podstawy (1–6), Harmonia (7–11), Granie po zmianach (12–17), Zaawansowane (18–22). Sama warstwa wyświetlania.
2. **Powtórki.** Mieszany quiz z modułów już zaliczonych, dostępny z mapy drogowej. Wykorzystuje istniejące generatory; harmonogram z `src/lib/sm2.ts` na poziomie generatora.
3. **Test na wejście.** Krótki quiz, który odblokowuje moduły do pierwszego niezdanego, zamiast globalnego przełącznika „Odblokuj wszystkie".
4. **Lepszy podkład.** Bas i perkusja zamiast samych akordów blokowych. W aplikacji jest `src/audio/multiTrackPlayback.ts` i silnik rytmu; do oceny, czy da się ich użyć bez zmian w `src/audio/`.
5. **Postęp w `/progress`.** Karta z ukończonymi modułami i czasem gry nad podkładem.
6. **Wersje molowe i blues.** 12-taktowy blues jako pętla w module 3 i 12; to najczęstszy realny kontekst improwizacji na gitarze, a film go nie wymienia.

## Kryteria odbioru

- Testy muzyczne z fazy 0 przechodzą; dla każdego generatora test porównuje odpowiedź z wartością policzoną niezależnie (przez `tonal`).
- Nie da się zaliczyć żadnego modułu samym klikaniem bez czekania: quiz wymaga dwóch zdanych podejść na ćwiczenie, drill i pętla wymagają odegrania.
- Każdy moduł poza 1, 2, 5 i 8 ma co najmniej jedno ćwiczenie nad podkładem.
- Moduł 12 z mikrofonem rozpoznaje trafienie w tercję na prawdziwej gitarze w co najmniej 9 z 10 prób.
- Liczba różnych pytań na 300 losowań jest co najmniej trzykrotnie większa od `questionCount` dla każdego generatora.
- `FretboardQuiz.tsx`, `getChordShapePositions` i trzy kształty pentatoniki z fazy 0.2 są usunięte.
- `docs/improv-training.md` zaktualizowany.

# Improv Training — plan rozwoju

Data: 2026-11-14
Stan wyjściowy: plan naprawczy (`improv-training-plan.md`, fazy 0–6) i poprawki po dwóch audytach są wdrożone; opis w `improv-training.md`, sekcja 7. Ten dokument opisuje, co dalej.

## Cel

Dziś moduł uczy, **jakie dźwięki** pasują do akordu. Po wdrożeniu tego planu ma uczyć także tego, czego wymaga prawdziwa improwizacja: grania ze słuchu, rytmu i frazy, gotowego języka (zagrywek) oraz swobodnego poruszania się po gryfie. Na końcu użytkownik ma umieć improwizować nad własnym utworem, nie tylko nad pętlami z kursu.

## Zasady

1. Kolejność 22 modułów z filmu źródłowego zostaje. Wszystko poniżej to nowe ćwiczenia wewnątrz modułów albo dodatki poza nimi.
2. Każde nowe ćwiczenie korzysta z istniejących części aplikacji; nowy silnik powstaje tylko tam, gdzie nie ma odpowiednika.
3. Nic nowego nie blokuje zaliczenia modułu, dopóki nie zostanie sprawdzone na prawdziwej gitarze. Nowe ćwiczenia wchodzą jako dodatkowe (`nonGating`) i stają się wymagane w osobnym kroku.
4. Każda pozycja ma mierzalne kryterium odbioru i test sprawdzający poprawność muzyczną, nie tylko strukturę danych.

## Na czym można budować (sprawdzone w kodzie)

| Potrzeba | Co już jest | Uwaga |
|---|---|---|
| Kolorowanie dźwięków na gryfie | `NoteStatus.color`, `label`, `emphasis` w `Fretboard` | Dwa kolory na diagramie nie wymagają zmian w komponencie |
| Gryf dla leworęcznych i inny strój | `Fretboard` ma `leftHanded` i `tuning`; ustawienia w `useSettingsStore` | Moduł improv ich nie przekazuje i ma strój standardowy wpisany na sztywno |
| Detekcja dźwięku | `usePitchDetector` zwraca nazwę dźwięku i częstotliwość | Częstotliwość wystarcza do sprawdzania podciągnięć |
| Kalibracja opóźnienia mikrofonu | `useRhythmDojoStore.inputLatencyMs` | Już używana w pętlach |
| Klikalny gryf | `Fretboard.onNoteClick` | |
| Akordy z wczytanego utworu | `buildChordTimeline` w `src/lib/chords.ts`, `ChordPrompter` | Podstawa trybu improwizacji nad własnym utworem |
| Metronom i rytm | `src/rhythm/engine` (`MetronomeScheduler`, `InputEvaluator`), `groovePresets` | |
| Zadania dzienne | `useQuestStore` (typy `gain_xp`, `correct_streak`, `play_mode`) | Nowy typ zadania dla improv |
| Eksport dźwięku do WAV | `src/lib/audioExport.ts` | Samego nagrywania z mikrofonu **nie ma** (brak `MediaRecorder` w kodzie) |
| Tabulatura | `TabView` pokazuje jedną pozycję | Nie nadaje się do zagrywek; zagrywki pokazujemy na gryfie z numerami kolejności |
| Ćwiczenia techniki | `techniqueExercises.ts` ma legato | Podciągnięć i vibrato nie ma |

## Stan wdrożenia

- Wydanie 1 (etap A): A2–A7 zrobione (run `improv-dev-run1`, gałąź `improv/dev-run1`). A1 otwarty — test na gitarze należy do użytkownika. Przebudowa plików wdrożeniowych z A7 nastąpi przy scalaniu gałęzi.
- Wydanie 2 (etap B): B1–B5 zrobione w tym samym runie. Opis pól i plików: `improv-training.md`, sekcja 8.

## Etapy

Rozmiar: S do 1 dnia, M 2–4 dni, L tydzień lub więcej. Kolumna „#” oznacza wdrożone pozycje dopiskiem „zrobione”.

### Etap A — porządki i fundament (przed wszystkim innym)

| # | Co | Gdzie | Rozmiar | Odbiór |
|---|---|---|---|---|
| A1 | Test na gitarze: czy mikrofon nie zalicza dźwięków podkładu granego z głośnika | Pętle modułów 12, 13, 16, 22 | S | Protokół z 10 obiegów na głośniku i 10 na słuchawkach; decyzja, czy sprawdzanie wymaga słuchawek |
| A2 zrobione | Oznaczenie zaliczeń bez mikrofonu jako niezweryfikowanych | `useImprovStore`, `ExerciseFrame` | S | Obieg oznaczony przyciskiem ma inną odznakę niż zweryfikowany |
| A3 zrobione | Strój i tryb leworęczny z ustawień w diagramach i treningach | `DiagramDrill`, `PracticeLinkExercise`, `scaleShapes.ts` | S | Diagram w trybie leworęcznym jest lustrzany; przy innym stroju diagram pokazuje poprawne dźwięki albo komunikat, że kształty zakładają strój standardowy |
| A4 zrobione | Wariant miksolidyjski w module 7: G7–F zamiast G7–Cmaj7 (obecny brzmi jak zwykłe C-dur) | `curriculum.ts` | S | Test: progresja wariantu nie zawiera akordu toniki durowej |
| A5 zrobione | Diagramy arpeggiów maj7 i m7b5 (kształty istnieją, nie są użyte), bo pętla ii–V–I ich wymaga | `curriculum.ts`, moduł 11 | S | Moduł 11 ma cztery diagramy |
| A6 zrobione | Tonacja paralelna w quizie modułu 2 (a-moll dla C-dur); dziś jest tylko jednoimienna | `questions.ts` | S | Test z biblioteką `tonal`: dla każdej tonacji durowej odpowiedź to jej VI stopień |
| A7 zrobione | Usunięcie martwego kodu (`improvTotalXP` w `Progress.tsx`), commit zmian, przebudowa plików wdrożeniowych | — | S | Czysty `git status` po buildzie |

### Etap B — lepsze pętle (małe zmiany, które poprawiają każde ćwiczenie)

| # | Co | Po co | Gdzie | Rozmiar | Odbiór |
|---|---|---|---|---|---|
| B1 zrobione | Gryf pod prompterem: dźwięki aktualnego akordu, pryma wyróżniona, przełącza się z akordem, da się wyłączyć | Uczeń widzi cel, zanim zacznie go słyszeć | `BackingLoopExercise`, `getChordPitchClasses` | S | Po zmianie akordu gryf pokazuje nowe dźwięki w tym samym momencie co prompter |
| B2 zrobione | Przełącznik tonacji w pętlach: transpozycja akordów, celów mikrofonu i podpowiedzi | ii–V–I trzeba umieć w dwunastu tonacjach | `BackingLoopExercise`, `curriculum.ts`; transpozycja przez `tonal` | M | Test: transpozycja o n półtonów zachowuje interwały między akordami i między akordem a jego celem |
| B3 zrobione | Wynik po obiegu: które akordy trafione, które nie | Samo „3 z 4" nie mówi, co poprawić | `BackingLoopExercise` | S | Lista akordów z oznaczeniem trafienia po każdym obiegu |
| B4 zrobione | Podpowiedź „graj" / „pauza" przy akordzie | Nauka zostawiania przestrzeni i frazy pytanie–odpowiedź | `ProgressionEntry.hintKey` (już jest), nowe warianty w modułach 3 i 12 | S | Dwa nowe warianty: „takt gry, takt pauzy" i „pytanie 2 takty, odpowiedź 2 takty" |
| B5 zrobione | Stopniowe przyspieszanie tempa co kilka obiegów | Standardowa metoda dochodzenia do tempa | `BackingLoopScheduler.setBpm` (już jest) | S | Opcja „+5 BPM co 2 udane obiegi" |

### Etap C — układ gryfu: prostokąt i stos, tryby z pentatoniki

Źródło: dwie lekcje Fret Science („Two Simple Shapes UNLOCK the Pentatonic Scale", „Stop Memorizing Modes"). Wykorzystujemy sposób myślenia; diagramy i teksty są własne, a w module jest podane źródło z linkiem. Nie kopiujemy płatnych ściąg autora.

Zasada metody: w pentatonice każda struna ma dwa dźwięki, odległe o 3 progi (prostokąt, dwie sąsiednie struny) albo o 2 progi (stos, trzy sąsiednie struny). Kształty występują na zmianę, a między strunami G i H całość przesuwa się o próg.

| # | Co | Gdzie | Rozmiar | Odbiór |
|---|---|---|---|---|
| C1 zrobione | Diagramy pentatoniki w dwóch kolorach: prostokąt i stos, pryma zaznaczona w obu | `DiagramDrill`; kolor liczony z odstępu progów na strunie, moduły 3 i 6 | S | Test: w każdym boksie każda struna należy do dokładnie jednego kształtu; kształty występują na zmianę |
| C2 zrobione | Przełącznik na diagramie: pentatonika → bluesowa (z b5) → heksatoniczna (z sekundą) | `scaleShapes.ts` (dwie definicje), moduł 3 | S | Dodany dźwięk ma osobny kolor |
| C3 zrobione | Dźwięki do podciągania oznaczone na diagramie: b3, kwarta, b7 | `DiagramDrill`, moduł 3 | S | — |
| C4 zrobione | „Zbuduj skalę od prymy": aplikacja wskazuje jedno A na strunach G, H lub E i palec; uczeń klika albo gra pozostałe dźwięki | Nowe ćwiczenie w module 6; klikalny gryf i mikrofon | M | Sześć pozycji startowych z lekcji odtwarza pięć boksów; test porównuje wynik z `getShapePositions` |
| C5 zrobione | Ruch po przekątnej: diagram trzech sąsiednich boksów, podświetlone stosy połączone o oktawę | `DiagramDrill` z szerszym oknem, moduł 6 | S | — |
| C6 zrobione | Pentatonika na jednej strunie | `DiagramDrill`, moduł 6 | S | — |
| C7 zrobione | „Pentatonika + 2 dźwięki = tryb": dźwięki pentatoniki w jednym kolorze, dwa dopisane w drugim; trzy wypełnienia (dorycki/lidyjski, eolski/joński, frygijski/miksolidyjski) | Nowe definicje trybów w `scaleShapes.ts`, moduł 7 | M | Test: każdy tryb to pentatonika molowa lub durowa od tej samej prymy plus dokładnie dwa dźwięki |
| C8 zrobione | Pętla z przełączaniem: dwa obiegi pentatoniką, dwa obiegi trybem nad tym samym akordem | Warianty pętli w module 7 | S | — |
| C9 zrobione | Kształty CAGED przy triadach i arpeggiach | Osadzenie `CagedVisualizer` w modułach 10 i 11 | S | — |

Stan 2026-11-15: C1–C3, C7, C8 i C9 są wdrożone. C8 jest osobną, dodatkową pętlą (`modes.e5`), a nie wariantem pętli `modes.e3`, bo każdy wariant pętli jest wymagany do zaliczenia i nowy cofnąłby zaliczenie modułu. C9: `CagedVisualizer` jest osadzony w module 11, a moduł 10 (który ma już osadzony `TriadVisualizer`) dostał odnośnik do narzędzia CAGED. C4–C6 doszły tego samego dnia jako ćwiczenia dodatkowe modułu 6 (`pentatonic-positions.e9`, `.e7`, `.e8`); w C4 odpowiedzi są tylko klikane, bez mikrofonu.

Pięć diagramów boksów w module 6 zostaje: boksy pokazują wynik, prostokąt i stos tłumaczą, skąd się bierze. Tryb lokryjski nie powstaje z wypełnienia prostokąta i zostaje tylko w quizie.

### Etap D — słuch, rytm, język

| # | Co | Po co | Gdzie | Rozmiar | Odbiór |
|---|---|---|---|---|---|
| D1 | Zagraj to, co słyszysz: aplikacja gra frazę 3–5 dźwięków z ćwiczonego boksu, uczeń odgrywa ją z mikrofonem | Improwizacja to granie tego, co się słyszy | Nowy silnik `call-response`; `playTone`, `usePitchDetector`; moduły 3, 6, 12 | L | Trzy poziomy: 3 dźwięki ze wskazaną pierwszą nutą, 4 dźwięki, 5 dźwięków bez podpowiedzi; fraza zaliczona, gdy kolejność klas dźwięków się zgadza |
| D2 zrobione | Zagrywki: 2–3 frazy na moduł pokazane na gryfie z numerami kolejności, z odsłuchem i transpozycją | Skale to alfabet, zagrywki to słowa | Nowy typ ćwiczenia `lick`; dane w `src/data/improv/licks.ts`; moduły 3, 6, 11, 12 na początek | L | 10 zagrywek; każda ma test, że jej dźwięki należą do skali lub akordu modułu |
| D3 zrobione | Zagrywka nad pętlą: prompter przypomina, w którym takcie ją zagrać | Przeniesienie zagrywki do muzyki | Wariant pętli z podpowiedzią | S | — |
| D4 zrobione | Dźwięki dojścia: pół tonu z dołu, potem z góry i z dołu | Brakujący krok między celowaniem a językiem jazzowym | Warianty pętli w modułach 12 i 13; mikrofon sprawdza lądowanie jak dziś | S | Dwa nowe poziomy w drabince modułu 12 |
| D5 zrobione | Ćwiczenia z ograniczeniem: tylko 3 dźwięki, tylko jedna struna, zadany rytm | Wymusza pracę nad rytmem i frazą zamiast nad doborem dźwięków | Warianty pętli z celem tekstowym; odnośnik do Rhythm Dojo | S | Trzy warianty w module 3 |
| D6 zrobione | Blues: pentatonika durowa i molowa nad tym samym akordem dominantowym | Najczęstszy realny kontekst na gitarze | Warianty pętli bluesowej w modułach 3 i 6 | S | — |
| D7 | Podciągnięcia sprawdzane mikrofonem: z b3 w stronę tercji, z kwarty do kwinty, z b7 do prymy | Artykulacja decyduje o brzmieniu bardziej niż dobór dźwięków | Nowe ćwiczenie w module 3 albo na stronie Technique; częstotliwość z `usePitchDetector` | M | Podciągnięcie zaliczone, gdy częstotliwość dojdzie do celu z tolerancją 30 centów; próg do ustalenia w teście na gitarze |
| D8 zrobione | Tryby od tej samej prymy nad jednym dźwiękiem basu | Tryb słychać dopiero na tle stałej prymy | Nowa pętla w module 7 (jeden akord lub sam bas) | S | — |

Stan 2026-11-15: D4, D5, D6 i D8 są zrobione jako osobne pętle dodatkowe (`nonGating`), nie jako warianty istniejących pętli: każdy wariant pętli wymaganej jest potrzebny do jej zaliczenia, więc dopisanie wariantu cofnęłoby zaliczenie modułu. „Dwa nowe poziomy w drabince modułu 12” (D4) to warianty „Poziom 5” i „Poziom 6” pętli `target-chord-tones.e5`. Zostają D1, D2, D3 i D7.

### Etap E — zastosowanie

| # | Co | Po co | Gdzie | Rozmiar | Odbiór |
|---|---|---|---|---|---|
| E1 zrobione | Progresje ze standardów po etapie III: blues jazzowy, blues molowy, Autumn Leaves, rhythm changes, ii–V–I po kole kwartowym | Sprawdzenie umiejętności na prawdziwym materiale | Sekcja „Standardy" na ścieżce nauki, poza 22 modułami; istniejący silnik pętli | M | Pięć progresji; test, że każdy akord się odtwarza |
| E2 | Egzamin etapu: jedna improwizacja z mikrofonem po każdym z czterech etapów | Zaliczenie etapu ma znaczyć, że uczeń gra | Ścieżka nauki; pętla z celami mikrofonu | M | Wynik: trafienia w dźwięki akordu na zmianach; próg ustalony po teście A1 |
| E3 | Odsetek dźwięków ze skali w swobodnej improwizacji | Informacja zwrotna tam, gdzie nie ma stałego celu | `BackingLoopExercise`; próbkowanie `usePitchDetector` | M | Po obiegu: procent dźwięków ze skali i z akordu |
| E4 zrobione | Improwizacja nad własnym utworem: prompter z podpowiedzią skali nad wczytanym plikiem Guitar Pro | Narzędzie używane po ukończeniu kursu | `ScoreViewer`, `buildChordTimeline`, pary akord–tryb z `questions.ts` | L | Dla utworu z rozpoznanymi akordami prompter pokazuje akord, następny akord i skalę; gdy akordów nie da się rozpoznać, tryb jest niedostępny z wyjaśnieniem |
| E5 | Nagraj i odsłuchaj obieg; samoocena w trzech punktach (rytm, cele, fraza) zamiast jednego przycisku | Odsłuch własnej gry to podstawowa metoda nauki | Nowe: `MediaRecorder` na strumieniu mikrofonu; `BackingLoopExercise` | M | Nagranie ostatniego obiegu dostępne do odsłuchu; nie jest zapisywane na stałe |

### Etap F — nawyk i podkład

| # | Co | Gdzie | Rozmiar | Odbiór |
|---|---|---|---|---|
| F1 zrobione | Sesja dnia, 15 minut: powtórka, jeden diagram, jedna pętla z bieżącego modułu | Strona główna; nowy typ zadania w `useQuestStore` | M | Jedno kliknięcie ze strony głównej prowadzi przez trzy ćwiczenia po kolei |
| F2 zrobione | Karta „Kontynuuj" na stronie głównej z następnym niezaliczonym ćwiczeniem | `Home.tsx` | S | — |
| F3 zrobione | Czas gry nad podkładem w statystykach | `Progress.tsx`, `recordSession` | S | — |
| F4 zrobione (perkusja; akordy nadal jedno uderzenie na zmianę) | Perkusja i style podkładu (swing, shuffle, bossa) | Wymaga zmian w `src/audio`; wcześniej odłożone | L | Osobna decyzja po ocenie kosztu; nie blokuje niczego powyżej |

## Co zyskuje każdy moduł

| Moduł | Dochodzi |
|---|---|
| 1, 5 Dźwięki na gryfie | A3 |
| 2 Tonacje | A6 |
| 3 Pentatonika | C1, C2, C3, D1, D2, D5, D6, D7, B4 |
| 4 Skala durowa | krótkie powiązanie z C7 w teorii |
| 6 Pozycje pentatoniki | C1, C4, C5, C6, D1, D2, D6 |
| 7 Tryby | A4, C7, C8, D8 |
| 9 Akordy i skale | B1, B2 |
| 10 Trójdźwięki | C9 |
| 11 Arpeggia | A5, C9, D2 |
| 12 Celowanie w dźwięki akordu | B1–B5, D1, D2, D3, D4 |
| 13 Prowadzenie głosów | D4 |
| 14–17 Harmonia | B1, B2, B3 |
| 18–21 Skale molowe | B1, B2 |
| 22 Giant Steps | B1, B3, B5 |
| Poza modułami | E1, E2, E4, F1, F2 |

## Kolejność wydań

1. **Wydanie 1 — fundament:** etap A w całości. Bez A1 nie wiadomo, czy sprawdzaniu mikrofonem można ufać, a opiera się na nim połowa dalszych pozycji.
2. **Wydanie 2 — lepsze pętle:** etap B. Małe zmiany, widoczne w każdym module.
3. **Wydanie 3 — układ gryfu:** C1–C3, C7, C8 (same diagramy i warianty), potem C4–C6 i C9.
4. **Wydanie 4 — słuch i język:** D4, D5, D6, D8 (warianty pętli, tanie), potem D1, na końcu D2 i D3, bo wymagają napisania treści.
5. **Wydanie 5 — zastosowanie:** E1, E2, E3, potem E5 i E4.
6. **Wydanie 6 — nawyk:** F1–F3. F4 osobno.

## Ryzyka

| Ryzyko | Skutek | Jak ograniczyć |
|---|---|---|
| Mikrofon słyszy podkład z głośnika | Fałszywe zaliczenia w pętlach, D1, E2 i E3 | A1 przed wszystkim; w razie potrzeby wymóg słuchawek albo wyciszanie podkładu na czas pierwszej miary |
| Detekcja zakłada jeden dźwięk naraz | Dwudźwięki i akordy nie będą rozpoznane | Wszystkie ćwiczenia z mikrofonem są jednogłosowe; triady w module 10 zostają na samoocenie |
| Próg dla podciągnięć (D7) i odsetka dźwięków (E3) dobrany na oko | Ćwiczenie za łatwe albo niemożliwe | Progi ustalane w teście na gitarze, przed tym ćwiczenia są dodatkowe |
| Zagrywki (D2) wymagają dobrej treści muzycznej | Słabe frazy uczą złych nawyków | Zacząć od 10 zagrywek w dwóch modułach; każdą odsłuchać przed wydaniem |
| Akordy z pliku Guitar Pro bywają nierozpoznane (E4) | Tryb działa tylko dla części utworów | Jasny komunikat i możliwość ręcznego wpisania progresji |
| Moduł 3 dostaje dziewięć nowych pozycji | Przeładowany pierwszy moduł grany | Nowe ćwiczenia zwinięte w sekcji „Więcej ćwiczeń", wymagane zostają obecne (zrobione 2026-11-15, we wszystkich modułach) |

## Czego ten plan nie obejmuje

- Nowych modułów spoza listy z filmu (skala całotonowa, zmniejszona, bebopowa). Mogą wejść później jako sekcja „Po kursie".
- Rozpoznawania akordów i dwudźwięków z mikrofonu.
- Kont użytkowników i synchronizacji postępu między urządzeniami.
- Oceny jakości wersji angielskiej tekstów; poprawiana była tylko tam, gdzie zmieniała się treść.

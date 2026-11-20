# Sound Studio — łańcuch, presety, głośność, wejście na żywo

Date: 2026-11-03
Scope: `fretmemo-v2` (`src/pages/Sound.tsx`, `src/components/sound/`, `src/stores/useSoundStore.ts`, nawigacja, `src/locales`)
Objective: interfejs użytkownika dla sound engine (node silnika: `docs/sound-engine.md`) —
wybór i odsłuch brzmienia gitary, wizualny projektant własnych presetów, integracja z ustawieniami.
Backend dźwięku jest wyłącznie zweryfikowanym silnikiem z `src/audio/` — ten dokument opisuje wyłącznie warstwę UI.

## 1. Co to jest

Sound Studio (`/sound`) to miejsce, w którym układasz brzmienie gitary używane przez
**wszystkie** ćwiczenia (cokolwiek gra przez `src/lib/audio.ts` → voice bus).
Etykieta nawigacji i nagłówek strony to „Sound Studio” (en i pl).

Na stronie od razu widać:

- przeglądarkę presetów (wbudowane + własne brzmienia); wybór ustawia aktywny preset
  i wczytuje jego łańcuch do edytora,
- łańcuch sygnału: bloki połączone w rzędzie, przycisk „+” przed, między i za blokami,
  wybór typu, zaznaczenie bloku, ominięcie, przesunięcie w lewo/prawo, usunięcie,
- pasek globalny: Input, Gate (włącznik + próg), Bass, Middle, Treble, Output — pokrętła
  `role="slider"` (strzałki, PageUp/PageDown, Home/End),
- nazwę, odsłuch frazy i zapis brzmienia (własne id da się nadpisać; wbudowanego
  zapis tworzy nowy preset),
- głośność główną (`full.audio.volume`) i wejście na żywo (mikrofon przez aktywny tor)
  na tej samej powierzchni, nie w zwiniętych sekcjach,
- link „Więcej ustawień audio” do `/me?section=settings`.

Zmiana pokrętła jest wysyłana do silnika z krótkim opóźnieniem (`setPreset` z `force`),
więc słychać ją bez zapisu. Zapisany preset (`assembly: 'blocks'`) jest tym, co ćwiczenie
odtworzy po pełnym przeładowaniu strony — także gdy użytkownik wejdzie od razu w ćwiczenie.

## 2. Jak dojść

- Desktop: pozycja **Sound Studio** w lewym pasku (`AppShell`). Widoczna etykieta to `nav.sound` — w en i pl ten sam napis „Sound Studio”.
- Mobile: ta sama etykieta w dolnym pasku (`BottomNav`: Home, Train, Learn, Sound Studio, Challenges, Me).
- Adres URL: `/sound` (lazy-loaded chunk, punkt wejścia SPA).

## 3. Presety wbudowane

Rejestr: `BUILT_IN_PRESETS` w `src/audio/presets.ts` (właściciel: node silnika). Nazwy i opisy są
tlumaczone kluczami `sound.presets.<id>.name` / `.description` (en + pl).

| Preset (`id`) | Wzmacniacz | Charakter |
| --- | --- | --- |
| `classic-acoustic` — Klasyczna gitara | classic (nylon, próbki UIowa) | ciepły, klasyczny nylon |
| `nam-clean-jc` — Czysty JC-120 | NAM `nam-clean-jc` (Roland JC-120) | krystaliczny, uniwersalny clean |
| `nam-clean-deluxe` — Clean Deluxe | NAM `nam-deluxe-a2` (Fender Deluxe Reverb) | kremowy clean, połysk góry |
| `nam-crunch-ac10` — Crunch AC10 | NAM `nam-crunch-ac10` (Vox AC10) | brytyjski crunch, wyraźna środnica |
| `nam-lead-jcm` — Lead JCM800 | NAM `nam-lead-jcm` (Marshall JCM800) | klasyczny lead, śpiewny środek |
| `nam-high-gain-5153` — High Gain 5153 | NAM `nam-high-gain-5153` (Boosted EVH 5153) | nowoczesny, ciasny high-gain |
| `nam-lead-dumble` — Dumble ODS | NAM `nam-lead-dumble` (Dumble Overdrive Special) | śpiewny, responsywny lead |
| `nam-vintage-ampeg` — Ampeg V-2 | NAM `nam-vintage-ampeg` (Ampeg V-2) | ciepły, vintage'owy charakter |

### Twoje utwory — tryb „Dźwięk gitary"

W ScoreViewer przełącznik **Dźwięk gitary** renderuje wczytany utwór offline
(`AlphaTabApi.exportAudio`, własny soundfont) do bufora i odtwarza go przez
ten sam łańcuch silnika — aktywny preset (classic lub NAM) barwi całe
aranżacje. alphaTab pozostaje wstrzymany; kursory nut prowadzi nasz zegar
(`api.timePosition`). Suwak głośności w tym trybie steruje głośnością
silnika (ustawienie `audio.volume`); tempo i metronom są wyłączone (wspierane
tylko przez transport soundfontu). Zmiana ścieżki unieważnia wyrenderowany
bufor — kolejny play renderuje ponownie. Moduł: `src/audio/songPlayback.ts`.

### Źródło dźwięku: dwa zestawy próbek (sampler)

Suchym sygnałem zasilającym łańcuch (i NAM) nie jest już syntezator, tylko
**próbki prawdziwej gitary** z dwóch zestawów (`src/audio/sampler.ts`):

| Zestaw | Preset | Instrument | Zakres | Pliki |
| --- | --- | --- | --- | --- |
| `nylon` | classic („Klasyczna gitara") | Raimundo 118 (nylon, UIowa) | **chromatycznie E2–B5** (42 nuty) | `samples/nylon/<midi>.mp3` |
| `electric` | wszystkie NAM | Gretsch Anniversary (Karoryfer, CC0) | naturals E2–D6 (28 nut) | `samples/electric/<midi+12>.mp3` (pliki nazwane oktawę wyżej niż brzmią — `ELECTRIC_FILE_OFFSET`, pomiar 2026-11-16) |

- **Wybór zestawu**: preset z `amp: 'classic'` → nylon; każdy preset NAM →
  electric (patrz `resolveSampleSetId` w `lib/audio.ts`).
- **Strojenie**: nuty nylonowe są skorygowane do concert pitch przez
  `playbackRate = midiToFreq(midi) / NYLON_DETECTED_F0[sampleMidi]`
  (nagrania z 1961 były do ~45 cents płaskie; mapa: `src/audio/nylonTuning.ts`,
  generowana przez `gauntlet/sound/tools/verify-nylon-pitch.py`). Electric:
  przesunięcia ±1 półton do najbliższej naturalnej ( upstream bez krzyżyków).
- **Normalizacja**: każda nuta jest normalizowana do peaka 0.30 przy dekodowaniu
  (`SET_TARGET_PEAK`) — oba zestawy grają z jedną głośnością.
- **Ładowanie**: leniwe per zestaw, idempotentne, z ponawianiem; syntezator
  addytywny zostaje fallbackiem aż do skutecznego dekodowania.
- Poniżej E2 powyżej B5: skoki o ±półton od skrajnych próbek (C6+ schodzi w dół
  z B5 — rzadkie w praktyce).

### Import własnych modeli `.nam`

W kreatorze (sekcja wzmacniacza) przycisk **Importuj .nam** przyjmuje plik
modelu (np. z tone3000.com). Walidacja: wyłącznie format **A2
SlimmableContainer** (starsze pliki A1/WaveNet/LSTM są odrzucane z czytelnym
komunikatem), limit 15 MB. Zaimportowane modele:

- zapisywane lokalnie w IndexedDB (`fretmemo-user-models-v1`) — **zostają na
  urządzeniu użytkownika** i nie są objęte licencjami dołączonych plików
  (`public/sound/LICENSES.md` dotyczy wyłącznie modeli dołączonych przez nas),
- widoczne w selektorze wzmacniacza z dopiskiem „(user)", usuwalne
  (przy większej liczbie własnych modeli zapas place rośnie — hard limit 15 MB
  na plik),
- używane przez presety własne jak każdy model NAM; silnik czyta je z blob URL
  (`loadNamNode(ctx, id, modelUrl)`), a po usunięciu modelu presety, które go
  używały, wracają do brzmienia classic.
Moduł: `src/audio/userModels.ts`; testy: `src/audio/__tests__/userModels.test.ts`.

Karta presetu pokazuje: badge kategorii (Akustyczna / NAM / Własny), nazwę, opis charakteru,
status silnika dla swojego modelu („Ładowanie modelu…” / błąd z przyciskiem „Ponów”),
podświetlenie aktywnego presetu oraz dwie akcje: **Wybierz** i **Posłuchaj**.
Linia „Gotowy” jest deterministyczna: pokazuje się wyłącznie na karcie **aktywnego** presetu
i tylko wtedy, gdy silnik zgłasza `ready` dokładnie dla tego presetu — tak samo na każdej
ścieżce (przywrócenie po odświeżeniu strony: ekran po hydratacji własnych presetów wywołuje
idempotentne `initSoundEngine()`; jawny wybór; powrót do defaultu po usunięciu). Gdy silnik
zgłasza `loading`/`error` dla aktywnego presetu, zamiast niej renderuje się odpowiedni stan.

Odsłuch („Posłuchaj”) = wybór + fraza: karta najpierw ustawia preset (persist + silnik),
a potem gra stałą frazę testową (akord A + krótki lick a-moll pentatoniczna) przez prawdziwy łańcuch.
Odsłuchy nie mogą się nałożyć — jedna w toku na cały ekran (`useAudition`).

## 4. Invariant przełączania presetu

Każde przełączenie idzie przez jedną funkcję (`selectSoundPreset` w `src/components/sound/useAudition.ts`):

1. zapis `full.audio.soundPreset` w store ustawień (persist przez zustand persist),
2. `soundEngine.setPreset(preset)` — przebudowa łańcucha z crossfade ~20 ms.

W spoczynku zapisany preset i łańcuch silnika są zawsze zgodne. Własne presety trafiają do silnika
przez `toEnginePreset` (adaptacja `kind: 'custom'` → `'classic' | 'nam'`, bo silnik decyduje o NAM
na podstawie `kind`; zapisany model danych nie jest zmieniany).

## 5. Edytor łańcucha (StudioBoard)

Edytor jest widoczny od razu (`src/components/sound/StudioBoard.tsx`). Nie ma zwijanej sekcji.

- **Przeglądarka**: wbudowane + własne. Na wąskim ekranie łańcuch jest nad listą.
- **Łańcuch**: rząd bloków, przycisk „+” przed, między i za nimi (maks. 10, duplikaty dozwolone).
  Chip **EQ** stoi w `globals.toneStackIndex` i nie jest blokiem. Na klocku widać numer, typ i pełną
  nazwę sprzętu (dwie linie). Pod łańcuchem paleta jest pogrupowana: wzmacniacz i kolumna, gain,
  modulacja, czas. Zaznaczenie otwiera inspektor: dla amp, cab i reverb karty sprzętu (nie lista
  rozwijana), dla reszty pokrętła, oraz bypass, przesunięcie i usunięcie. Import `.nam` jest przy
  kartach wzmacniacza i zostaje w IndexedDB `fretmemo-user-models-v1`.
- **Pasek globalny**: Input, Gate (włącznik + próg), Bass, Middle, Treble, Output. Pokrętła
  `role="slider"` (strzałki, PageUp/PageDown, Home/End, przeciąganie). Głośność główna zostaje
  suwakiem `SoundSlider` (`aria-label` + `aria-valuetext`).
- **Typy bloków**: amp (`classic`, modele `NAM_MODELS`, import `user-*`), cab (`filter` / `ir` / `none`),
  drive (`soft` historyczny, plus `screamer`, `transparent`, `hard`, `fuzz` — własne układy,
  nie capture’e), comp, chorus, tremolo, phaser (4 allpass + LFO), flanger (krótki delay + LFO),
  wah (filtr pasmowy sterowany obwiednią nuty), eq (przesuwalny korektor, osobno od chipu EQ),
  delay, reverb. Brak `character` na starym bloku zostaje przy `soft`. Phaser, flanger, wah i eq
  istnieją tylko w grafie bloków.

Nietknięty preset wbudowany brzmi grafem historycznym (`assembly` inne niż `'blocks'`). Pierwsza
edycja łańcucha albo pokrętła oznacza projekt jako brudny i od tej chwili dźwięk idzie grafem bloków.
Sam zapis nazwy nie brudzi projektu. Zmiana jest wysyłana do silnika z opóźnieniem ~120 ms
(`setPreset`, id `studio-draft`, `force`). „Posłuchaj frazy” gra frazę testową przez aktualny tor.

Zapis wymaga nazwy. Wbudowany preset zapisuje się jako nowy `custom-<uuid>`; własny id da się nadpisać.
`nameKey` trzyma **nazwę dosłowną**, nie klucz i18n. Usunięcie aktywnego własnego presetu wraca do
`classic-acoustic`. Zakresy liczbowe parametrów zostają w `CHAIN_PARAM_RANGES`.

## 6. Trwałość własnych presetów

IndexedDB `fretmemo-sound-presets-v1` (store `customPresets`, klucz `id`), wrapper w
`src/stores/useSoundStore.ts` (wzorzec: `src/lib/scoreStore.ts`). Store jest pamięciowym cachem
(`loadCustomPresets` przy montażu ekranu), rekordy zawierają dodatkowo `updatedAt` (sortowanie
od najnowszych). Walidacja przy odczycie:

- rekord uszkodzony/niekompletny (zły `params` poza `CHAIN_PARAM_RANGES`, brak nazwy…) → **pominięty**,
- nieznane `amp` (np. model usunięty z rejestru w nowszej wersji) → renderowanie **classic**
  + naprawa zapisanego rekordu (self-heal),
- pusta nazwa → rekord odrzucony.

Stan aktywnego presetu żyje **wyłącznie w ustawieniach** (`full.audio.soundPreset`) — store Dźwięku
trzyma tylko listę własnych presetów i mirror statusu silnika (`engine.presetId/status/error`).
Po odświeżeniu `App` woła `loadCustomPresets()`, a `playTone` / `playChord` czekają na
`ensureActiveRigReady()`, zanim powstanie AudioContext, gdy aktywne id nie jest presetem
wbudowanym. Ćwiczenie nie wymaga wcześniejszej wizyty w `/sound`. Jeśli silnik zdąży
zgłosić `Unknown sound preset`, store nadal naprawia ten błąd raz na preset na sesję.

## 7. Integracja z ustawieniami

Sekcja Audio w Ustawieniach (`/me?section=settings`): dotychczasowe martwe pole
`instrumentSound` (Select akustyczna/elektryczna/clean) zostało zastąpione wierszem
„Brzmienie gitary” — nazwa aktywnego presetu + przycisk otwierający `/sound`.
Pole `instrumentSound` pozostaje w typach/store jako deprecated (mapowanie legacy w
`normalizeSoundPreset`), nic go nie zapisuje. Głośność nadal live (silnik subskrybuje store ustawień).
Klucze: `settingsPage.audio.soundPreset`, `settingsPage.audio.soundPresetHint`.

## 8. i18n

Wszystkie napisy przez `t()` (react-i18next, pełna parzystość en + pl):

- `nav.sound`,
- `sound.*` (ekran, statusy, akcje, projektant, pusty stan własnych presetów, potwierdzenie usunięcia),
- `sound.presets.<id>.name` / `.description` dla 6 wbudowanych (klucze deklarowane w `src/audio/presets.ts`),
- `settingsPage.audio.soundPreset` (+ hint).

Parzystość pilnuje test `src/components/sound/__tests__/i18nParity.test.ts`: strukturalna parzystość
namespace `sound`, lista kluczy obowiązkowych + skan literalnych `t("...")` w źródłach ekranu.

## 9. Testy

`src/components/sound/__tests__/`:

- `useSoundStore.test.ts` — CRUD na realnym wrapperze (fake-indexeddb), sortowanie newest-first,
  odrzucanie uszkodzonych rekordów, fallback nieznanych amp + self-heal, `toEnginePreset`,
- `i18nParity.test.ts` — jak wyżej,
- `Sound.test.tsx` — render ekranu: 6 kart wbudowanych z akcjami, aktywny preset, suwak głośności
  (live update `full.audio.volume`), wybór presetu (persist + `engine.setPreset`), pusty stan
  własnych presetów, PL nazwy presetów. Moduły `@/audio/engine` i `@/lib/audio` są mockowane;
  IndexedDB działa na fake-indexeddb.

## 10. IA note (piąta zakładka najwyższego poziomu)

Zatwierdzone przez użytkownika (plan sesji 2026-11-03, run `sound-ui`): aplikacja ma **piątą
zakładkę najwyższego poziomu — Dźwięk (Sound)**, umieszczoną między „Trening” a „Wyzwania”.
Blueprint `docs/ui-ux-v3-blueprint.md` (sekcja 3.1 wymienia cztery pozycje: Home / Train /
Challenges / Me) jest **poza zakresem zapisu tego node’a** — synchronizację blueprintu z
zatwierdzonym IA wykonuje node integrate (jego zakres obejmuje `app/fretmemo-v2/docs`).
Poza tym blueprint pozostał zachowany: ustawienia globalne nadal w `/me?section=settings`
(architektura ustawień 3.2 bez zmian), Design System v3 (tokeny, kontrolki) użyty bez odchyleń.

## 11. Ograniczenia

- Import własnych plików `.nam` jest opisany w sekcji 3 (IndexedDB, tylko A2, limit 15 MB).
- Cache PWA dla `/sound/**` (CacheFirst `sound-assets`) jest skonfigurowany w `vite.config.ts`
  przez node silnika; chunk `/sound` wchodzi do standardowego precache SPA. `vite.config.ts` nie
  był modyfikowany w tym node’ie.
- Panel wejścia live (mikrofon) — zaimplementowany w run `live-input` (sekcja 12 powyżej);
  wcześniejsze ograniczenie („osobny node") nie obowiązuje. Brak kalibracji opóźnienia ścieżki
  live (poza zakresem), a `engine.ts`/`chain.ts` pozostały nietknięte — mikrofon wchodzi przez
  publiczne API voiceBus.

## 12. Wejście na żywo (Live input)

Karta na dole Sound Studio (`LiveInputPanel` z `embedded`, bez zwijania), renderowana przez
`src/components/sound/LiveInputPanel.tsx`; logika życia w `src/audio/liveInput.ts` (kontroler
`liveInput` ze stanem `{ status: 'off' | 'starting' | 'on' | 'error', errorKind?, muted }` i
`subscribe()`).

- **Włączenie**: przycisk „Włącz wejście na żywo" (gest użytkownika) → `liveInput.start()`:
  `initSoundEngine()` (idempotentne utworzenie/wznowienie współdzielonego AudioContext) →
  `getUserMedia` z dokładnie takimi constraintami:
  `{ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }` —
  żadne DSP przeglądarki nie dotyka sygnału (echo cancellation dodatkowo ucina długie sustainy).
- **Ścieżka sygnału**: `MediaStreamAudioSourceNode → inputGain (0.9) → voiceBus silnika` — to samo
  wejście łańcucha, do którego podłączają się głosy z `lib/audio.ts` (publiczne API silnika),
  więc mikrofon płynie przez aktywny preset. Nietknięty preset idzie grafem historycznym;
  zapisany rig (`assembly: 'blocks'`) — kolejnością bloków (`docs/sound-engine.md`, 4b).
  Równolegle `inputGain → AnalyserNode`
  (`fftSize = 256`) zasila wskaźnik poziomu w panelu (pętla rAF, sprzątana przy stopie/odmontowaniu;
  szerokość słupka pisana bezpośrednio do DOM, bez re-renderów).
- **Odsłuch i słuchawki**: przed włączeniem panel pokazuje krótką podpowiedź, a cały czas gdy
  wejście jest włączone — ostrzeżenie o sprzężeniu (słuchawki!).
- **Mute awaryjne**: przycisk odłącza `inputGain` od voiceBus (edycja grafu — natychmiastowa);
  strumień, source i analizator pozostają żywe, więc „Wznów odsłuch" jest natychmiastowy, a
  wskaźnik poziomu dalej pokazuje sygnał wejściowy. Preferencja mute przetrwa wyłączenie/włączenie
  (ponowne włączenie nigdy nie uruchamia odsłuchu samo z siebie).
- **Wyłączenie (teardown)**: `stop()` zatrzymuje KAŻDY track strumienia (`track.stop()`),
  odłącza wszystkie utworzone węzły (`source`, `inputGain`, `analyser`), zwalnia referencje i
  ustawia status `off` (no-op gdy już wyłączone). Stop wywołany w trakcie oczekiwania na zgodę
  (prompt uprawnień) unieważnia start licznikiem generacji — świeży strumień jest natychmiast
  zwalniany, aplikacja nie zostaje w stanie „starting".
- **Nawigacja**: moduł `liveInput` jest singletonem (`src/audio/liveInput.ts`), więc przejście
  z ekranu Dźwięk do innej zakładki NIE wyłącza wejścia na żywo — strumień mikrofonu i odsłuch
  działają dalej, a wskaźnik mikrofonu w systemie operacyjnym pozostaje aktywny. Aby zatrzymać
  mikrofon, wróć na ekran Dźwięk i wyłącz wejście (pełny teardown); natychmiastowe odcięcie
  odsłuchu od łańcucha zapewnia mute awaryjny (powyżej).
- **Stany błędów** (mapowanie odrzuceń `getUserMedia`): `NotAllowedError`/`SecurityError` →
  „denied" (jak odblokować mikrofon w przeglądarce), `NotFoundError`/`DevicesNotFoundError` →
  „notfound" (podłącz mikrofon/interfejs), pozostałe → „unknown". Każdy błąd ma czytelny opis
  i akcję „Spróbuj ponownie"; brak nieobsłużonych rejections (brak `mediaDevices` też jest
  obsłużony jako `unknown`).
- **i18n**: klucze `sound.live.*` (pełna parzystość en + pl, test strukturalnej parzystości
  `sound` w `i18nParity.test.ts` obejmuje nową gałąź automatycznie).
- **Testy**: `src/audio/__tests__/liveInput.test.ts` (dokładne constrainty, routowanie do
  voiceBus, mute, teardown, mapowanie błędów, guardy podwójnego startu i „stop w trakcie") oraz
  `liveInput-panel.test.tsx` (stany UI: zwinięta sekcja, starting, ostrzeżenie + mute, błędy
  denied/notfound). `getUserMedia` i węzły audio są mockowane na granicy modułu — testy nie
  wymagają mikrofonu ani sprzętu audio.

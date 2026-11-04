# Ekran Dźwięk (Sound) — presety, projektant brzmienia, własne presety

Date: 2026-11-03
Scope: `fretmemo-v2` (`src/pages/Sound.tsx`, `src/components/sound/`, `src/stores/useSoundStore.ts`, nawigacja, `src/locales`)
Objective: interfejs użytkownika dla sound engine (node silnika: `docs/sound-engine.md`) —
wybór i odsłuch brzmienia gitary, wizualny projektant własnych presetów, integracja z ustawieniami.
Backend dźwięku jest wyłącznie zweryfikowanym silnikiem z `src/audio/` — ten dokument opisuje wyłącznie warstwę UI.

## 1. Co to jest

Dźwięk to piąty, najwyższego poziomu zakładka aplikacji: użytkownik wybiera brzmienie gitary używane
przez **wszystkie** ćwiczenia (trening słuchu, dźwięk→prog, itd. — wszystko, co gra przez
`src/lib/audio.ts` → voice bus silnika). Ekran udostępnia:

- siatkę kart presetów (6 wbudowanych + własne), każda z odsłuchem i przełączeniem jednym kliknięciem,
- suwak głośności głównej (`full.audio.volume`, live — silnik sam śledzi zmiany ustawień),
- Projektanta brzmienia (Tone Designer): wybór wzmacniacza + suwaki wszystkich parametrów `ChainParams`,
  odsłuch frazy testowej, zapis własnego presetu, usuwanie własnych presetów,
- link „Więcej ustawień audio” do `/me?section=settings`.

## 2. Jak dojść

- Desktop: pozycja **Dźwięk** w lewym pasku nawigacji (`AppShell`, między „Trening” a „Wyzwania”).
- Mobile: pozycja **Dźwięk** w dolnym pasku (`BottomNav`, 5 pozycji, etykieta „Dźwięk”).
- Menu mobilne (hamburger) również zawiera pozycję Dźwięk.
- Adres URL: `/sound` (lazy-loaded chunk, dostępny jako punkt wejścia SPA).

## 3. Presety wbudowane

Rejestr: `BUILT_IN_PRESETS` w `src/audio/presets.ts` (właściciel: node silnika). Nazwy i opisy są
tlumaczone kluczami `sound.presets.<id>.name` / `.description` (en + pl).

| Preset (`id`) | Wzmacniacz | Charakter |
| --- | --- | --- |
| `classic-acoustic` — Klasyczna gitara | classic (próbki Karoryfer, CC0) | ciepłe, czyste brzmienie gitary z próbek |
| `nam-clean-jc` — Czysty JC-120 | NAM `nam-clean-jc` (Roland JC-120) | krystaliczny, uniwersalny clean |
| `nam-clean-deluxe` — Clean Deluxe | NAM `nam-deluxe-a2` (Fender Deluxe Reverb) | kremowy clean, połysk góry |
| `nam-crunch-ac10` — Crunch AC10 | NAM `nam-crunch-ac10` (Vox AC10) | brytyjski crunch, wyraźna środnica |
| `nam-lead-jcm` — Lead JCM800 | NAM `nam-lead-jcm` (Marshall JCM800) | klasyczny lead, śpiewny środek |
| `nam-high-gain-5153` — High Gain 5153 | NAM `nam-high-gain-5153` (Boosted EVH 5153) | nowoczesny, ciasny high-gain |
| `nam-lead-dumble` — Dumble ODS | NAM `nam-lead-dumble` (Dumble Overdrive Special) | śpiewny, responsywny lead |
| `nam-vintage-ampeg` — Ampeg V-2 | NAM `nam-vintage-ampeg` (Ampeg V-2) | ciepły, vintage'owy charakter |

### Źródło dźwięku: próbki (sampler)

Suchym sygnałem zasilającym łańcuch (i NAM) nie jest już syntezator, tylko
**próbki prawdziwej gitary** — 28 nut z biblioteki Karoryfer „Black and Green Guitars"
(Gretsch Anniversary, CC0; szczegóły licencji w `public/sound/LICENSES.md`).

- **Pliki**: `public/sound/samples/<midi>.mp3` (mono 44.1 kHz, łącznie ~1.2 MB),
  kod MIDI w nazwie; zakres E3–D7, tylko dźwięki naturalne (tak nagrano upstream).
- **Mapowanie**: requested note → najbliższa próbka naturalna + pitch-shift przez
  `playbackRate` (±1 półton w obrębie zakresu; poniżej E3 próg E3 jest zsuwany
  w dół, maks. do −12 półtonów dla E2) — konwencja jak w soundfontach.
- **Ładowanie**: leniwe i idempotentne (`ensureSamplerLoaded` przy pierwszym
  odtworzeniu — zawsze w geście użytkownika). Dopóki bufory się dekodują,
  gra syntezator addytywny jako fallback; jeśli pobieranie się nie powiedzie,
  następnym razem jest ponawiane.
- **Poziom**: trim ×2.2 dopasowuje peak próbki (−16.8 dBFS) do charakteru
  syntezatora, dla którego była strojona gain-staging łańcucha.
- Klasyczny stage (lowpass) został podniesiony z 4 do 8 kHz, żeby prawdziwe
  nagrania zachowały powietrze (patrz `docs/sound-engine.md`).

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

## 5. Projektant brzmienia (Tone Designer)

Sekcja zwijana pod siatką presetów (`SectionCollapse`, wzorzec spójny z Ustawieniami).
Gdy lista własnych presetów jest **pusta**, zwinięta sekcja jest ukryta — jedynym punktem
wejścia jest CTA w pustym stanie, które rozwija sekcję i przewija do niej; po rozwinięciu
lub gdy istnieje choć jeden własny preset, sekcja zachowuje się standardowo.

- **Wzmacniacz**: `classic` + 5 modeli z rejestru `NAM_MODELS` (klucze `sound.designer.amps.<id>`).
- **Suwaki**: wszystkie 9 pól `ChainParams`, zakresy z `CHAIN_PARAM_RANGES`, etykiety
  `sound.designer.params.<pole>` i jednostki (`dB`, `%`, `x`). Każdy suwak (jak i suwak
  głośności) wystawia dostępną nazwę (`aria-label` z tego samego klucza i18n co widoczna
  etykieta) oraz `aria-valuetext` z jednostką (np. `1.95x`, `0 dB`, `99 %`) — przez lokalny
  wrapper `SoundSlider`, bo thumb Radixa nie przyjmuje asocjacji `htmlFor`/`id`.

| Parametr | Zakres | Krok | Znaczenie |
| --- | --- | --- | --- |
| `inputGain` | 0–2 | 0.05 | wzmocnienie wejścia (x, 1 = neutralnie) |
| `drive` | 0–1 | 0.01 | siła waveshapera (tylko stage classic; 0 = wyłączony) |
| `bass` | −12…+12 dB | 0.5 | lowshelf 200 Hz |
| `mid` | −12…+12 dB | 0.5 | peaking 1 kHz |
| `treble` | −12…+12 dB | 0.5 | highshelf 3.2 kHz |
| `comp` | 0–1 | 0.01 | siła kompresora |
| `delayMix` | 0–1 | 0.01 | wet delayu (~280 ms, feedback 0.35) |
| `reverbMix` | 0–1 | 0.01 | wet pogłosu (syntetyczny IR) |
| `outputGain` | 0–2 | 0.05 | wzmocnienie wyjścia (x) |

Odsłuch live: projektant **nie dotyka silnika** dopóki nic nie zmienisz. Pierwsza zmiana zaznacza
projekt jako „brudny”; każda zmiana (debounce ~180 ms) aplikuje projekt do silnika jako przejściowy
preset (`custom-draft-*`), więc ruchy suwaków słychać od razu. Przycisk „Posłuchaj frazy” domyka
oczekującą zmianę i gra frazę testową. Odrzucenie (zamknięcie bez zapisu) przywraca łańcuch
aktywnego presetu; zapis ustawia nowy preset jako aktywny (persist + silnik) i zamyka projektant.

Zapis: nazwa (wymagana, walidowana) + aktualny wzmacniacz/parametry → `saveCustomPreset`.
Własne presety mają `id: custom-<uuid>`, `kind: 'custom'`, a pole `nameKey` przechowuje **nazwę
dosłowną** (wpisaną przez użytkownika — to nie jest klucz i18n; interfejs renderuje ją wprost).
Usuwanie własnego presetu: ikona kosza na karcie + `ConfirmDialog` (wzorzec aplikacji). Usunięcie
aktywnego presetu wraca do `classic-acoustic` (persist + silnik).

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
Po odświeżeniu strony z aktywnym własnym presetem pierwszy start silnika nie zna własnych presetów
(rejestr wbudowanych) i fall backuje do classic ze statusem błędu `Unknown sound preset: …`;
`useSoundStore` nasłuchuje tego błędu i **naprawia** go, aplikując zapisany własny preset
(max 1 naprawa na preset na sesję — nie tworzy pętli przy naprawdę zepsutym modelu).

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

- Import własnych plików `.nam` — poza zakresem tego node’a (rejestrowane wcześniej jako przyszła
  funkcja; projektant używa wyłącznie modeli z rejestru `NAM_MODELS`).
- Cache PWA dla `/sound/**` (CacheFirst `sound-assets`) jest skonfigurowany w `vite.config.ts`
  przez node silnika; chunk `/sound` wchodzi do standardowego precache SPA. `vite.config.ts` nie
  był modyfikowany w tym node’ie.
- Panel wejścia live (mikrofon) — zaimplementowany w run `live-input` (sekcja 12 powyżej);
  wcześniejsze ograniczenie („osobny node") nie obowiązuje. Brak kalibracji opóźnienia ścieżki
  live (poza zakresem), a `engine.ts`/`chain.ts` pozostały nietknięte — mikrofon wchodzi przez
  publiczne API voiceBus.

## 12. Wejście na żywo (Live input)

Sekcja zwijana na ekranie Dźwięk (pod projektantem brzmienia, `SectionCollapse`), renderowana przez
`src/components/sound/LiveInputPanel.tsx`; logika życia w `src/audio/liveInput.ts` (kontroler
`liveInput` ze stanem `{ status: 'off' | 'starting' | 'on' | 'error', errorKind?, muted }` i
`subscribe()`).

- **Włączenie**: przycisk „Włącz wejście na żywo" (gest użytkownika) → `liveInput.start()`:
  `initSoundEngine()` (idempotentne utworzenie/wznowienie współdzielonego AudioContext) →
  `getUserMedia` z dokładnie takimi constraintami:
  `{ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }` —
  żadne DSP przeglądarki nie dotyka sygnału (echo cancellation dodatkowo ucina długie sustainy).
- **Ścieżka sygnału**: `MediaStreamAudioSourceNode → inputGain (0.9) → voiceBus silnika` — to samo
  wejście łańcucha, do którego podłączają się głosy z `lib/audio.ts` (publiczne API silnika,
  bez edycji `engine.ts`), więc mikrofon płynie przez aktualnie wybrany preset: wzmacniacz →
  drive → EQ → comp → delay → reverb → master. Równolegle `inputGain → AnalyserNode`
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

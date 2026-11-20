# Sound Engine — architektura i presety

Date: 2026-11-03
Scope: `fretmemo-v2` (`src/audio`, `src/lib/audio.ts`, `public/sound`, `full.audio.soundPreset`)
Objective: jeden, przełączalny tor odtwarzania gitary ("sound engine") dla wszystkich ćwiczeń
(note/ear-training, ChordLibrary), z presetami classic (synteza Web Audio) oraz NAM
(Neural Amp Modeler, WASM), bez zmian w miejscach wywołań (`lib/audio.ts` zachowuje API).

## 1. Co to jest

Sound engine to singleton w `src/audio/engine.ts`, który posiada jedyny `AudioContext`
aplikacji (przeniesiony z `src/lib/audio.ts`) i jeden węzeł `voiceBus`, do którego podłączają
się **wszystkie głosy gitarowe**. Silnik buduje na nim łańcuch efektów zależny od aktywnego
presetu i wyprowadza dźwięk przez `masterGain` do `ctx.destination`.

Poza torem zostają (świadomie, per kontrakt):

- kliknięcia count-in / metronom (`playCountInClicks`, `useGameStore`) — lecą dalej bezpośrednio
  na `ctx.destination`,
- rhythm drums, alphaTab/ScoreViewer (AlphaSynth), kalibracja latencji mikrofonu.

## 2. Mapa modułów

| Plik | Rola |
| --- | --- |
| `src/audio/presets.ts` | Typy (`ChainParams`, `SoundPreset`), rejestr `BUILT_IN_PRESETS`, rejestr modeli `NAM_MODELS`, `DEFAULT_PRESET_ID`, helpery `getBuiltinPresets()` / `getPresetById(id)`. Czysty moduł (bez Web Audio), importowalny też przez store. |
| `src/audio/chain.ts` | Budowniczowie węzłów: input gain, waveshaper drive, EQ 3-pasmowy, kompresor, delay (parallel dry/wet), reverb (syntetyczny IR), klasyczny stage wzmacniacza, `assembleChain()`. |
| `src/audio/nam.ts` | Loader NAM: leniwy `import('neural-amp-modeler-wasm/engine')`, jedna instancja `NamEngine` na AudioContext, pula węzłów LRU (max 3), walidacja formatu A2, typowane błędy ładowania. |
| `src/audio/engine.ts` | Singleton `soundEngine`: AudioContext, `voiceBus`, `masterGain`, `setPreset()` z crossfade ~20 ms, statusy (`idle/loading/ready/error`) + subskrypcje, synchronizacja głośności z ustawieniami, `initSoundEngine()`. |
| `src/audio/index.ts` | Barrel (eksporty modułu). |
| `src/lib/audio.ts` | Publiczne API odtwarzania (bez zmian sygnatur): `playTone`, `playChord`, `playInterval`, `playIntervalPrompt`, `playCadence`, `playFunctionalPrompt`, `playCountInClicks`, `initAudio`, `midiToFrequency`. Wewnętrznie głosy kończą się na `soundEngine.voiceBus`. |

## 3. Model danych

### ChainParams

```ts
interface ChainParams {
    inputGain: number;  // 0..2, mnożnik liniowy (1 = neutralnie)
    drive: number;      // 0..1, siła waveshapera (0 = krzywa neutralna)
    bass: number;       // -12..+12 dB, lowshelf 200 Hz
    mid: number;        // -12..+12 dB, peaking 1 kHz (Q 0.9)
    treble: number;     // -12..+12 dB, highshelf 3.2 kHz
    comp: number;       // 0..1, siła kompresora (0 = brak)
    delayMix: number;   // 0..1, wet delay (~280 ms, feedback 0.35)
    reverbMix: number;  // 0..1, wet reverberacji (syntetyczny IR)
    outputGain: number; // 0..2, mnożnik liniowy (1 = neutralnie)
}
```

Zakresy zadeklarowane w `CHAIN_PARAM_RANGES` i testowane w `presets.test.ts`.

### SoundPreset

```ts
interface SoundPreset {
    id: string;                    // trwałe id (zapisywane w ustawieniach)
    kind: 'classic' | 'nam' | 'custom';
    amp: 'classic' | string;       // 'classic' albo id z NAM_MODELS
    params: ChainParams;
    nameKey: string;               // klucz i18n (tlumaczenia: node sound-ui)
    descriptionKey?: string;
    builtIn: boolean;
}
```

Preset NAM trzyma `drive: 0` — modele NAM mają własny gain/przester; waveshaper przed
modelem dublowałby przester. Zapisany rig ze studia ma `kind: 'custom'` i, gdy użytkownik
go edytował, `assembly: 'blocks'` plus `chain` / `globals`. Silnik dostaje adaptację
`toEnginePreset` (`kind` wraca do `'classic' | 'nam'`).

## 4. Kolejność stage'ów łańcucha

Presety wbudowane i nietknięte presety własne (`assembly` inne niż `'blocks'`)
składane są grafem historycznym poniżej. Dzięki temu brzmią tak samo jak przed
Sound Studio. Edycja w studio zapisuje `assembly: 'blocks'`.

### 4a. Graf historyczny (`assembly: 'legacy'`)

```
voices (lib/audio.ts; źródło: próbki nylon/electric z `src/audio/sampler.ts`,
         fallback: syntezator addytywny)
  → voiceBus
    → inputGain
    → drive (waveshaper; neutralny przy 0)
    → amp stage:  classic: peaking 280 Hz Q1.2 +6 dB → lowpass 8 kHz Q0.7
                  nam:     AudioWorkletNode z modelem NAM (mono)
    → kolumna:    IR (`preset.cab`, ConvolverNode) | krzywa filtrów (bundlowane NAM)
                  | brak (`cab: 'none'`, modele użytkownika bez IR)
    → EQ: lowshelf 200 → peaking 1k → highshelf 3.2k
    → compressor (DynamicsCompressorNode)
    → chorus  (tylko gdy chorusMix > 0: dry + delay 12 ms modulowany LFO 0.8 Hz)
    → tremolo (tylko gdy tremoloDepth > 0: gain modulowany LFO tremoloRate)
    → delay block  (parallel: dry przelot + delay→wet; delayTime, delayFeedback)
    → reverb block (parallel: dry przelot + convolver→wet; IR `preset.reverb`
                    albo syntetyczny pokój o długości reverbDecay)
    → chain output (outputGain)
    → fadeGain (crossfade przy zmianie presetu)
    → masterGain (volume × VOICE_BUS_TRIM)
    → ctx.destination
```

Uwagi:

- **Klasyczny stage** odtwarza parę filtrów body/brightness z per-woice'owego kodu
  historycznego (`peaking 280 Hz Q1.2 +6 dB`), z jednym utwornionym cutoffem lowpass 8 kHz (pierwotnie 4 kHz dla głosu
  addytywnego; od wprowadzenia próbek Karoryfer podniesiony do 8 kHz, żeby prawdziwe
  nagrania zachowały powietrze w transjencie).
- **Reverb** domyślnie używa syntetycznej odpowiedzi impulsowej (stereo, `reverbDecay`
  s, domyślnie 1.6 s, zanikający szum `pow(1-t, 2.5)`) generowanej w runtime. Opcjonalnie
  IR plate/spring z `public/sound/irs/` (licencje: `public/sound/LICENSES.md`).
- **IR** (kolumny i pogłosy) ładuje `src/audio/irs.ts`: fetch + decode raz na kontekst,
  przed złożeniem łańcucha; błąd → null i łańcuch wraca do domyślnej kolumny/pokoju.
- **VOICE_BUS_TRIM = 0.40**: historyczny per-wykrowany master gain 0.40 z `lib/audio.ts`
  przeniesiony jednorazowo do silnika. `masterGain = full.audio.volume × 0.40` — skala
  głosów bez zmian, głośność ogólna zbliżona (przy volume = 1 identyczna z dawną).

### 4b. Graf studio (`assembly: 'blocks'`)

```
inputGain
  → noise gate (tylko gdy globals.gateEnabled; worklet public/sound/engine/gate-worklet.js,
    próg globals.gateThresholdDb, atak 1 ms, zwolnienie 80 ms)
  → bloki chain[0 .. toneStackIndex) w kolejności listy
  → EQ (bass → mid → treble) wstawione pod indeksem globals.toneStackIndex
  → bloki chain[toneStackIndex ..] 
  → outputGain
```

Blok wyłączony (`enabled: false`) nie wchodzi do grafu — poprzedni stage łączy się
z następnym. Pusty `chain` łączy wejście wprost z EQ i wyjściem. Ten sam typ może
wystąpić dwa razy (osobne węzły; dwa wzmacniacze NAM dostają osobny klucz puli).
Maks. 10 bloków.

Typy: `amp` (classic | id z `NAM_MODELS` | `user-*`), `cab` (`filter` | `ir` | `none`),
`drive`, `comp`, `eq`, `chorus`, `tremolo`, `phaser`, `flanger`, `wah`, `delay`, `reverb`.
Blok `eq` to drugi, przesuwalny korektor (półka 200 Hz, środek 1 kHz, półka 3,2 kHz). Pasek EQ w łańcuchu zostaje osobno.
Wah to filtr pasmowy sterowany obwiednią nuty. Istnieje tylko w grafie bloków.
Drive bez `character` albo z `soft` zostaje przy historycznym `tanh`. `screamer`,
`transparent`, `hard` i `fuzz` to osobne krzywe (plus filtr przy screamer/hard/fuzz).
Amount 0 jest krzywą identyczności dla każdego charakteru. Graf 4a tych charakterów nie używa.

`deriveLegacyStudio()` buduje podgląd łańcucha dla starego rekordu (bez pedałów
o mixie 0) i ustawia `toneStackIndex` za amp/cab, czyli tam, gdzie historyczny
graf miał EQ. Dźwięk takiego rekordu idzie nadal grafem 4a, dopóki użytkownik
nie zapisze edycji jako `assembly: 'blocks'`.

Zestaw próbek: nylon, gdy włączony amp to `classic` albo ampów nie ma; electric
dla każdego innego modelu (także `user-*`). Rozstrzyga `sampleSetForPreset`.
Własne presety są wczytywane przy starcie aplikacji (`App`) i ponownie przed
pierwszą nutą, jeśli aktywne id nie jest presetem wbudowanym
(`ensureActiveRigReady`), więc ćwiczenie po przeładowaniu nie czeka na wizytę
w `/sound`.

## 5. Integracja NAM + strategia zasobów

- Pakiet: `neural-amp-modeler-wasm` (MIT, v3.0.7, TONE3000). Używamy podścieżki
  `neural-amp-modeler-wasm/engine` (API bez Reacta): `NamEngine.attach(ctx, { assetBaseUrl })`,
  `engine.createNode()`, `node.loadModel(json)`, `NamNodePool` (LRU wbudowany w pakiet).
- **Instalacja wymaga `--legacy-peer-deps`**: pakiet deklaruje peer `react@^18` (dla swojego
  playera UI), a aplikacja używa React 19. Podścieżka `/engine` nie używa Reacta — konflikt
  jest pozorny; future `npm ci/install` w tym repo musi używać `--legacy-peer-deps` (patrz
  Known limitations).
- Aktywa silnika (`nam-worklet.js`, `nam-engine.wasm`) są kopiowane z
  `node_modules/neural-amp-modeler-wasm/dist/engine/` do `public/sound/engine/` i wskazywane
  jawnie przez `assetBaseUrl = ${BASE_URL}sound/engine/` — rozwiązywanie nie zależy od
  tego, jak bundler przepisze `new URL(..., import.meta.url)` w node_modules.
- Modele (`.nam`, format **A2 SlimmableContainer**, tylko takie są akceptowane; legacy
  single-arch jest odrzucany) leżą w `public/sound/models/` i są ładowane przez
  `fetch(...)` → `text` → `node.loadModel(text)`. Licencje: `public/sound/LICENSES.md`.
- Pula węzłów: max 3 (`MAX_LOADED_NAM_NODES`); ponowny wybór modelu trzymanego w puli
  przełącza natychmiast (bez ponownego parsowania). Wyrzucony węzeł jest disposable'owany
  przez pakiet; pool `onEvict` czyści mapę załadowanych modeli.
- Walidacja przed `loadModel`: `isSlimmableContainerJson()` — `architecture ===
  'SlimmableContainer'`. Błędy mapowane na typy: `unknown-model | network | invalid-model |
  legacy-format | engine-unavailable | model-load`.
- Głośność: modele z metadaną `loudness` są normalizowane przez silnik NAM do −18 dB
  (robione w worklecie; nie dotyczy naszego masterGain).

## 6. Statusy i zdarzenia

```ts
interface SoundEngineState {
    presetId: string;
    status: 'idle' | 'loading' | 'ready' | 'error';
    error?: string;
}
soundEngine.subscribe(listener) → unsubscribe  // proste eventy dla UI
soundEngine.getState()
```

UI (node `sound-ui`) może podpiąć te stany do własnego store'a zustand; tutaj celowo bez
zależności od UI.

Startup: przy pierwszym `getAudioContext()` silnik czyta `full.audio.soundPreset` ze store'a
(ten sam store co volume) — zwalidowany id startuje od razu; nieznany id → klasyczny stage +
`status: 'error'` (spójnie z polityką fallbacku `setPreset`).

## 7. Migracja ustawień: `instrumentSound` → `soundPreset`

- `FullSettings['audio']` ma nowe pole `soundPreset: string` (id presetu).
- `instrumentSound` zostaje w typie jako **deprecated** — pole przetrwało w typach/store
  wyłącznie dla kompatybilności migracji; sam selektor w ekranie Settings został (w node
  `sound-ui`) zastąpiony wierszem „Brzmienie gitary" prowadzącym do `/sound`.
- Domyślnie `soundPreset: 'classic-acoustic'` (`DEFAULT_PRESET_ID`); silnik czyta to pole
  przy starcie (sekcja 6), więc migracja działa bez zmian w UI.
- Sanityzacja w `merge` persist store'a (`useSettingsStore.ts`):
  1. niepusty string `soundPreset` → zostaje,
  2. brak/śmieć + legacy `instrumentSound === 'acoustic'` → `'classic-acoustic'`,
  3. pozostałe wartości legacy (`'electric'`, `'clean'`) → `DEFAULT_PRESET_ID`,
  4. nic nie persisted → default.

## 8. Presety wbudowane (6)

| id | kind | amp | charakter |
| --- | --- | --- | --- |
| `classic-acoustic` | classic | classic | neutralny — odtwarza dotychczasowy dźwięk nylonowy (drive 0, bez FX) |
| `nam-clean-jc` | nam | `nam-clean-jc` | Roland JC-120 — czysty, lekki reverb |
| `nam-clean-deluxe` | nam | `nam-deluxe-a2` | Fender Deluxe Reverb — czysty, treble +1, reverb |
| `nam-crunch-ac10` | nam | `nam-crunch-ac10` | Vox AC10 — crunch, mid +1.5, delay/reverb |
| `nam-lead-jcm` | nam | `nam-lead-jcm` | Marshall JCM800 — lead, comp 0.2, mid +2 |
| `nam-high-gain-5153` | nam | `nam-high-gain-5153` | EVH 5153 — high gain, comp 0.15 |

Fallback policy: preset NAM, którego model się nie załaduje (brak pliku, legacy format,
błąd silnika) **nie wyłącza dźwięku** — silnik przełącza się na klasyczny stage (parametry
presetu `classic-acoustic`) i ustawia `status: 'error'` z komunikatem; `presetId` zostaje
ten, o który proszono. Unknown model id → błąd `unknown-model`, ścieżka identyczna.

## 9. Service worker / offline

`vite.config.ts`: reguła runtimeCaching **CacheFirst** dla `/sound/**` (`cacheName:
'sound-assets'`, maxEntries 12, 1 rok, statuses [0, 200]) — wzorowana na regule soundfontów.
Modele i pliki worklet/wasm **nie wchodzą do precache manifestu** (zbyt duże); łapią się
przy pierwszym użyciu, więc po jednej sesji online działają offline.

## 10. Testy

`src/audio/__tests__/` (vitest + jsdom, mocki na granicach modułów; zero prawdziwego audio):

- `presets.test.ts` — rejestr (≥4 presety, unikalne id, default classic, zakresy parametrów,
  obecność plików modeli ≤5 MB i format A2 na dysku),
- `chain.test.ts` — mapowanie parametrów na węzły (krzywa neutralna drive 0, dB EQ, wet gainy,
  kompresor 0 = neutralny, kolejność stage'ów, dispose),
- `nam.test.ts` — loader z mockiem pakietu + fetch: format A2 vs legacy/invalid, typowane
  błędy, cache silnika per context,
- `settings-migration.test.ts` — merge legacy `instrumentSound` → `soundPreset`, śmieciowe
  wartości → default (styl `useScoresStore.test.ts`),
- `engine-wiring.test.ts` — głosy z `lib/audio` wpadają do `voiceBus` (nie do destination),
  count-in zostaje na destination, masterGain reaguje na `full.audio.volume`, fallback przy
  błędnym modelu NAM,
- `fixtures/audioStubs.ts` — lekkie fake'i AudioContext/parametrów z rejestracją połączeń.

Stan: 47 plików / 550 testów na zielono (bazowy stan: 24 / 316); `npm run build` przechodzi.

## 11. Known limitations

1. **`npm install` wymaga `--legacy-peer-deps`** (peer react@^18 w pakiecie NAM; podścieżka
   `/engine` Reacta nie używa). Wpływa to tylko na świeże instalacje zależności.
2. Klasyczny stage używa jednego stałego cutoffu lowpass (8 kHz, pierwotnie 4 kHz) zamiast historycznego
   per-głosowego `min(freq*6, 6000)` — niskie dźwięki są odrobinę jaśniejsze niż kiedyś.
   Chordy używają parametrów stage'u (280 Hz Q1.2 +6 dB, 8 kHz) zamiast dawnej pary
   (280 Hz Q1.0 +4 dB, `min(freq*5, 5000)`) — jeden kanoniczny stage dla wszystkich głosów.
3. Modele NAM są trenowane przy 48 kHz; silnik raportuje `expectedSampleRate`, a kontekst
   audio działa z rate przeglądarki/urządzenia (zwykle 44.1/48 kHz). Worklet NAM obsługuje
   mismatrate wewnętrznie, ale przy bardzo egzotycznych rate'ach jakość może się różnić.
4. Klucze i18n presetów (`sound.presets.*`) są zdefiniowane, ale tłumaczenia w plikach
   locale doda node `sound-ui` (locale są poza zakresem tej iteracji).
5. Import własnych plików `.nam` przez użytkownika — poza zakresem (non-goal kontraktu);
   `kind: 'custom'` i parametr `modelUrl` w loaderze są na to przygotowane.

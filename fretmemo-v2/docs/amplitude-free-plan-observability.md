# FretMemo + Amplitude (Free Plan) - plan obserwowalnosci

## 1. Stan obecny (audyt)
- Amplitude Browser SDK + Session Replay sa juz podlaczone w `index.html`.
- Istnieje tracking kluczowych sesji: `practice`, `ear-training`, `rhythm`, questy, import/export progresu, route views.
- Brakowalo pelnego pokrycia dla `technique` (otwarcie i start/stop sesji).
- Session Replay bylo ustawione na `sampleRate: 1`, co ryzykuje szybkie wyczerpanie darmowego limitu.

## 2. Co zostalo rozszerzone
- Konfiguracja Session Replay pod Free plan:
  - domyslny sampling ustawiony na `0.2`,
  - mozliwosc nadpisania przez env: `VITE_AMPLITUDE_REPLAY_SAMPLE_RATE`,
  - mozliwosc nadpisania API key przez `VITE_AMPLITUDE_API_KEY`.
- Dodano runtime context do eventow:
  - `replay_sample_rate`,
  - `browser_language`.
- Dodano nowy event warstwy produktu:
  - `fm_v2_feature_opened` (obszary: `practice`, `technique`, `theory`, `ear_training`, `rhythm`).
- Dodano brakujace eventy `technique`:
  - `fm_v2_technique_session_started`,
  - `fm_v2_technique_session_ended`.
- Dodano funnel PWA:
  - `fm_v2_pwa_install_available`,
  - `fm_v2_pwa_install_prompt_result`,
  - `fm_v2_pwa_installed`.
- Dodano event nawigacji:
  - `fm_v2_navigation_clicked` (quick actions + bottom nav).
- Dodano propagacje `entrySource` z Home/Train do stron funkcjonalnych (lepsze analizy funneli).

## 3. Rekomendowane dashboardy (Amplitude)
- Adoption Funnel:
  - `fm_v2_feature_opened` (`feature_area=practice`) -> `fm_v2_practice_session_started` -> `fm_v2_practice_session_ended`.
- Cross-feature usage:
  - breakdown `fm_v2_feature_opened` po `feature_area`, `entry_source`.
- Technique performance:
  - `fm_v2_technique_session_started` vs `fm_v2_technique_session_ended`,
  - mediana `duration_seconds`, `final_bpm`, `completed_steps`.
- PWA conversion:
  - `fm_v2_pwa_install_available` -> `install_prompt_clicked` -> `fm_v2_pwa_install_prompt_result(outcome=accepted)` -> `fm_v2_pwa_installed`.
- Replay triage:
  - filtruj sesje z niska skutecznoscia (`accuracy`) i odtwarzaj je przez Session Replay.

## 4. Guardrails dla Free plan
- Trzymaj niska kardynalnosc:
  - kontrolowane wartosci dla `feature_area`, `entry_source`, `mode`.
- Nie wysylaj eventow per klik/per beat; trzymaj sie zdarzen sesyjnych i zmian intencji.
- Kontroluj sampling replay:
  - start od `0.2`, podnos tylko jesli miesieczny wolumen sesji jest niski.

## 5. Minimalna konfiguracja env
- `VITE_AMPLITUDE_API_KEY=<api_key>`
- `VITE_AMPLITUDE_REPLAY_SAMPLE_RATE=0.2`


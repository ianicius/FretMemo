# Sound assets — licenses & provenance

Every audio asset bundled under `public/sound/` is recorded here with its source,
license and verification date. Nothing may be added to this directory without a
verified redistributable license entry below.

**Project policy (from orfeo-analysis, binding):** GPL-licensed audio assets are
**banned**. NonCommercial / NoDerivs assets are avoided; if a needed asset is only
available under such terms, that is a human-checkpoint decision, not a builder decision.

## NAM engine runtime (`public/sound/engine/`)

Files: `nam-worklet.js`, `nam-engine.wasm`

- Source: copied from `node_modules/neural-amp-modeler-wasm/dist/engine/`
  (npm package `neural-amp-modeler-wasm@3.0.7`)
- Upstream: https://github.com/tone-3000/neural-amp-modeler-wasm (directory `ui`, built dist)
- License: **MIT** (package LICENSE, copyright TONE3000) —
  https://github.com/tone-3000/neural-amp-modeler-wasm/blob/main/LICENSE
- Verified: 2026-11-03 (npm package metadata + repository LICENSE inspected)

## NAM models (`public/sound/models/`)

All five models are NAM **A2 `SlimmableContainer`** captures (version 0.7.0, 48 kHz,
two submodels at sizes 0.5/1.0, loudness metadata), trained and published by TONE3000
in the demo model set of the MIT-licensed `tone-3000/neural-amp-modeler-wasm` repository
(`ui/public/models/`, documented in its `README.md`).

License basis for redistribution: the repository root **LICENSE (MIT, "TONE3000",
2026)** applies to the repository contents including `ui/public/models/`; it contains
no carve-outs or separate terms for model/data files. The models' JSON metadata credit
`modeled_by: "tone3000"`, `trainer: "TONE3000"`. Files were downloaded from the
repository on 2026-11-03 and their JSON headers parsed to confirm the A2 format.
Attribution: the upstream MIT license notice accompanies this project via this file;
model authors are credited below.

| File | Modeled gear | Model author / trainer | Source URL | License | SHA-256 (first 16) | Verified |
| --- | --- | --- | --- | --- | --- | --- |
| `deluxe-a2.nam` | Fender Deluxe Reverb | tone3000 (TONE3000) | https://raw.githubusercontent.com/tone-3000/neural-amp-modeler-wasm/main/ui/public/models/deluxe-a2.nam | MIT (repo LICENSE, no model carve-outs) | `0ed18bf86d79a132` | 2026-11-03 |
| `jc.nam` | Roland JC-120 | tone3000 (TONE3000) | https://raw.githubusercontent.com/tone-3000/neural-amp-modeler-wasm/main/ui/public/models/jc.nam | MIT (repo LICENSE, no model carve-outs) | `7df7cf05849dd4bb` | 2026-11-03 |
| `ac10.nam` | Vox AC10 | tone3000 (TONE3000) | https://raw.githubusercontent.com/tone-3000/neural-amp-modeler-wasm/main/ui/public/models/ac10.nam | MIT (repo LICENSE, no model carve-outs) | `76cc07f56dbc1cc8` | 2026-11-03 |
| `jcm.nam` | Marshall JCM800 | tone3000 (TONE3000) | https://raw.githubusercontent.com/tone-3000/neural-amp-modeler-wasm/main/ui/public/models/jcm.nam | MIT (repo LICENSE, no model carve-outs) | `3b2f7abf8963f73b` | 2026-11-03 |
| `5153.nam` | Boosted EVH 5153 | pippress (contributed; trainer TONE3000) | https://raw.githubusercontent.com/tone-3000/neural-amp-modeler-wasm/main/ui/public/models/5153.nam | MIT (repo LICENSE, no model carve-outs) | `d8f4fcde724e33a6` | 2026-11-03 |

Full SHA-256 checksums (SHA256, computed 2026-11-03):

```
d8f4fcde724e33a6eef2a54d69d81ba6af2996ff7395a4dc26e8425cb0f73e98  models/5153.nam
76cc07f56dbc1cc8c81034a37da11556b1ac006c721eb2011445d87376e184a1  models/ac10.nam
0ed18bf86d79a132c3d8682d96261dd7f78b7d8613412d3d623e9949c98bd8da  models/deluxe-a2.nam
7df7cf05849dd4bb7652813b9d39de67de45e0e1a22f540069e109af8dafbb2b  models/jc.nam
3b2f7abf8963f73bf9518b942707fffc5fdea8b54f1091b1c92e12419a7a10bf  models/jcm.nam
a477f51681c26eb27a791b18447010481bd4ceb5cee65fce0376772f2d5f4c81  engine/nam-engine.wasm
999c8d50e0216d44b7fa6afba8e8394e236992f88f8d4228880cf67f0687ef32  engine/nam-worklet.js
```

MIT license text (applies to the engine runtime files and the bundled models):

```
MIT License

Copyright (c) 2026 TONE3000

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Verification notes (2026-11-03)

- Model format confirmed by parsing each file's JSON header: top-level
  `architecture: "SlimmableContainer"`, `config.submodels` with `max_value` 0.5 / 1.0,
  per-submodel `model.architecture: "WaveNet"`, `version: "0.7.0"`,
  `sample_rate: 48000`, `metadata.loudness` present.
- The upstream `ui/public/models/README.md` documents these files as the repository's
  official demo model set (deluxe-a2, jcm, ac10, dumble, ampeg, 5153, jc; `deluxe.nam`
  is a legacy A1 fixture that the player rejects and was NOT bundled).
- `tone3000.com` model pages show licenses per model in an interactive UI; the bundled
  set relies on the repository-level MIT LICENSE (no carve-outs) as the redistribution
  basis, which is the license under which the upstream project itself distributes these
  files.

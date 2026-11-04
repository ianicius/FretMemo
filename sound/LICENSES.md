# Sound assets — licenses & provenance

Every audio asset bundled under `public/sound/` is recorded here with its source,
license and verification date. Nothing may be added to this directory without a
verified redistributable license entry below.

**Project policy (from orfeo-analysis, binding):** GPL-licensed audio assets are
**banned**. NonCommercial / NoDerivs assets are avoided; if a needed asset is only
available under such terms, that is a human-checkpoint decision, not a builder decision.

## Guitar note samples (`public/sound/samples/`)

Files: `<midi>.mp3` — 28 mono MP3 notes (E3–D7 naturals, mf dynamic, round-robin 1),
transcoded from the source WAVs with ffmpeg (44.1 kHz mono, VBR q≈4).

- Source library: **Karoryfer „Black and Green Guitars"** — green Gretsch
  Anniversary, ordinary plucked articulation (`Samples/green/ord/`, files
  `twang_<note>_mf_rr1.wav`)
- Sampled/recorded by: Brian Wood; published by Karoryfer Lecolds (Karoryfer
  Samples), 2022
- Upstream: https://github.com/sfzinstruments/karoryfer.black-and-green-guitars
- License: **CC0 1.0** ("Royalty-free for all commercial and non-commercial use",
  per the repository readme; CC0-1.0 license marker on the repository) —
  https://github.com/sfzinstruments/karoryfer.black-and-green-guitars/blob/main/LICENSE
- Verified: 2026-11-04 (repository readme + license inspected; subset downloaded
  and transcoded; no attribution required by CC0, credited here anyway)
- Only the subset needed by the app was bundled (one dynamic layer, one
  round-robin per note); unused articulations (fingerboard, hammer-on,
  staccato, release) remain upstream.

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

CC0 1.0 summary (applies to `public/sound/samples/`; full text at
https://creativecommons.org/publicdomain/zero/1.0/legalcode): the samples are
dedicated to the public domain — no attribution required, no restrictions on
use or redistribution, no warranty.

SHA-256 of the bundled sample subset (computed 2026-11-04):

```
24f1f000a5a3437c645ed183bf21044929ab7c0a4ec5c64c7100d5028b95bd1b  samples/52.mp3
dabb1dd920c57b5745e9c5139a498bbf281c954bf70059eee750ad2fcac902cf  samples/53.mp3
c407ecba46d52429daa77395769c37396ee673469fedb3d53546bbe5772082e6  samples/55.mp3
0a7c051154957ccfdf9f9bb32ea67e603ba7f6fb552fa831e3c4a08a2955bd9b  samples/57.mp3
c9f114290f42105f6c33254649fcd1f4a78090ce1e5453073cde596561595bca  samples/59.mp3
a37f98fbf76bb63fdc5ab9ed57e47d26e4c638ffd82c525c40777e9991039f42  samples/60.mp3
e31557fe8803d8f696105c00fe9c4cdcaefc4619928670fc3d055a3fc83900cf  samples/62.mp3
d4c39c930b1dd4c5792ee93e3b5e30bbe30a5e9507c2fb9a63963f8783ae3418  samples/64.mp3
ae47baa12fe546ae82d50050188dc7cdadb0177bfd3c181cbbd487ce775ffcf6  samples/65.mp3
4641dd3088d2c1bfe1a72895ebb1197ad1e672e845018616441d2d8764cee587  samples/67.mp3
3ffab5be75a595660d519f9184782acd730924c800222df3319a30a05b6260e4  samples/69.mp3
eda1a0fcea13815df618d9d0b9eb0bb11386f46bdbecca894375fe138808b169  samples/71.mp3
31043bfcd8e505df2071d13ef65d9247e9b7ff1cf95253a7b230017c0edf2d9a  samples/72.mp3
f50666895c182b35247cdf7263b7d58e47ecc6eea52657cc6087f2f912c3310a  samples/74.mp3
bd672cb131d60a0bb8cf746b24c9e9c5c8a854c24c200689e527ceb67888955a  samples/76.mp3
257b47a6852e3e24f3a4349a3765ba9c99c725c9482e0b2823e2bc18f4b8ee40  samples/77.mp3
b9d88204f5fbea5ae2767c02efd694166a9eb24e634b3d25ddc0419070f7b664  samples/79.mp3
1c8873a28e7150043e8148f035e961450b65c46840f62f3a46a0b9e54f8bf2da  samples/81.mp3
d39c4cf36cd5ce124e110d1d24eee2a36cd664f95ae2457c68ed0985923f7ada  samples/83.mp3
df3a485c134863041d6e8df53236e461773fc085c9eb93ef968b78e935ca2c85  samples/84.mp3
4da2aafe2deb6aaa39faf15fb65dede2ad78c49de4b1efaa1d6c09ea1a836204  samples/86.mp3
e421059b95ca45790d300ed7ab325d10fd96a18aa2c1bdd6323f0c048f31bd01  samples/88.mp3
ac7aacdcd75bfb34ee174c65cfb48eefc368770b50f212cd074c68134223bfe7  samples/89.mp3
70d8b24006174a5afa00e9ba887b66a77472a32d3d99a63177205a42223f251d  samples/91.mp3
c38eb1d8ee099ea9b24a9e5a419350191a9d98c7b02d3d615edfc7ae6c2ff348  samples/93.mp3
370a2ba7a6f87da681eb955beba1848f5c627a8795d992a6b18bb9425bee2da0  samples/95.mp3
55be4d9bac5c999643b75ef73d71f9b7956436546e378f676652ed93787a738a  samples/96.mp3
e63df7f81d630ab9742b79cc96e9774c5e5c198e7c40b5dc0d3e1d3b2e5fe654  samples/98.mp3
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

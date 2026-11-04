# Sound assets — licenses & provenance

Every audio asset bundled under `public/sound/` is recorded here with its source,
license and verification date. Nothing may be added to this directory without a
verified redistributable license entry below.

**Project policy (from orfeo-analysis, binding):** GPL-licensed audio assets are
**banned**. NonCommercial / NoDerivs assets are avoided; if a needed asset is only
available under such terms, that is a human-checkpoint decision, not a builder decision.

## Guitar note samples (`public/sound/samples/`)

Two sets, one subdirectory each (the sampler picks per active preset):

### `samples/nylon/` — classical nylon guitar (UIowa)

Files: `<midi>.mp3` — 42 mono MP3 notes, chromatic E2–B5, mf dynamic,
extracted from two-note bundle recordings by energy segmentation with
per-note pitch verification (every shipped note's detected fundamental is
within ±45 cents and is pitch-corrected at playback via
`src/audio/nylonTuning.ts`).

- Source: **University of Iowa Electronic Music Studios** — Musical Instrument
  Samples, Raimundo 118 classical guitar, performed by Brian Penkrot (2011)
- Upstream: http://theremin.music.uiowa.edu/MISguitar.html
  (bundles `Guitar.mf.sul*.aif`, mono 16-bit 44.1 kHz archive
  `Guitar.mono.1644.1.zip`)
- License: the UIowa MIS page states the recordings "may be downloaded and
  used for any projects, without restrictions" (no formal CC declaration).
  Redistribution basis: that unconditional permission statement, recorded
  here. **Recommended follow-up:** written confirmation from
  lawrence-fritts@uiowa.edu.
- Verified: 2026-11-04 (page + license statement inspected; bundles
  downloaded, split, pitch-verified)
- Segmentation/transcode tooling: `gauntlet/sound/tools/split-uiowa.py`,
  `verify-nylon-pitch.py` (pitch report: `gauntlet/sound/nylon-tuning.json`)

### `samples/electric/` — clean electric guitar (Karoryfer, CC0)

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
| `dumble.nam` | Dumble Overdrive Special | tone3000 (TONE3000) | https://raw.githubusercontent.com/tone-3000/neural-amp-modeler-wasm/main/ui/public/models/dumble.nam | MIT (repo LICENSE, no model carve-outs) | `365c41bca03fb3f4` | 2026-11-04 |
| `ampeg.nam` | Ampeg V-2 | tone3000 (TONE3000) | https://raw.githubusercontent.com/tone-3000/neural-amp-modeler-wasm/main/ui/public/models/ampeg.nam | MIT (repo LICENSE, no model carve-outs) | `e3a450c68f2e29b1` | 2026-11-04 |

Full SHA-256 checksums (SHA256, computed 2026-11-03 / 2026-11-04):

```
d8f4fcde724e33a6eef2a54d69d81ba6af2996ff7395a4dc26e8425cb0f73e98  models/5153.nam
76cc07f56dbc1cc8c81034a37da11556b1ac006c721eb2011445d87376e184a1  models/ac10.nam
0ed18bf86d79a132c3d8682d96261dd7f78b7d8613412d3d623e9949c98bd8da  models/deluxe-a2.nam
7df7cf05849dd4bb7652813b9d39de67de45e0e1a22f540069e109af8dafbb2b  models/jc.nam
3b2f7abf8963f73bf9518b942707fffc5fdea8b54f1091b1c92e12419a7a10bf  models/jcm.nam
365c41bca03fb3f480dba2503d540d95a29bb31a2c153ffc4fc317e3645e1dcb  models/dumble.nam
e3a450c68f2e29b18864f0b4856382fec34cd246167d0a79119a1c9f4abb473d  models/ampeg.nam
a477f51681c26eb27a791b18447010481bd4ceb5cee65fce0376772f2d5f4c81  engine/nam-engine.wasm
999c8d50e0216d44b7fa6afba8e8394e236992f88f8d4228880cf67f0687ef32  engine/nam-worklet.js
```

CC0 1.0 summary (applies to `public/sound/samples/`; full text at
https://creativecommons.org/publicdomain/zero/1.0/legalcode): the samples are
dedicated to the public domain — no attribution required, no restrictions on
use or redistribution, no warranty.

SHA-256 of the bundled sample subset (computed 2026-11-04; paths relative to
`public/sound/`):

```
24f1f000a5a3437c645ed183bf21044929ab7c0a4ec5c64c7100d5028b95bd1b  samples/electric/52.mp3
dabb1dd920c57b5745e9c5139a498bbf281c954bf70059eee750ad2fcac902cf  samples/electric/53.mp3
c407ecba46d52429daa77395769c37396ee673469fedb3d53546bbe5772082e6  samples/electric/55.mp3
0a7c051154957ccfdf9f9bb32ea67e603ba7f6fb552fa831e3c4a08a2955bd9b  samples/electric/57.mp3
c9f114290f42105f6c33254649fcd1f4a78090ce1e5453073cde596561595bca  samples/electric/59.mp3
a37f98fbf76bb63fdc5ab9ed57e47d26e4c638ffd82c525c40777e9991039f42  samples/electric/60.mp3
e31557fe8803d8f696105c00fe9c4cdcaefc4619928670fc3d055a3fc83900cf  samples/electric/62.mp3
d4c39c930b1dd4c5792ee93e3b5e30bbe30a5e9507c2fb9a63963f8783ae3418  samples/electric/64.mp3
ae47baa12fe546ae82d50050188dc7cdadb0177bfd3c181cbbd487ce775ffcf6  samples/electric/65.mp3
4641dd3088d2c1bfe1a72895ebb1197ad1e672e845018616441d2d8764cee587  samples/electric/67.mp3
3ffab5be75a595660d519f9184782acd730924c800222df3319a30a05b6260e4  samples/electric/69.mp3
eda1a0fcea13815df618d9d0b9eb0bb11386f46bdbecca894375fe138808b169  samples/electric/71.mp3
31043bfcd8e505df2071d13ef65d9247e9b7ff1cf95253a7b230017c0edf2d9a  samples/electric/72.mp3
f50666895c182b35247cdf7263b7d58e47ecc6eea52657cc6087f2f912c3310a  samples/electric/74.mp3
bd672cb131d60a0bb8cf746b24c9e9c5c8a854c24c200689e527ceb67888955a  samples/electric/76.mp3
257b47a6852e3e24f3a4349a3765ba9c99c725c9482e0b2823e2bc18f4b8ee40  samples/electric/77.mp3
b9d88204f5fbea5ae2767c02efd694166a9eb24e634b3d25ddc0419070f7b664  samples/electric/79.mp3
1c8873a28e7150043e8148f035e961450b65c46840f62f3a46a0b9e54f8bf2da  samples/electric/81.mp3
d39c4cf36cd5ce124e110d1d24eee2a36cd664f95ae2457c68ed0985923f7ada  samples/electric/83.mp3
df3a485c134863041d6e8df53236e461773fc085c9eb93ef968b78e935ca2c85  samples/electric/84.mp3
4da2aafe2deb6aaa39faf15fb65dede2ad78c49de4b1efaa1d6c09ea1a836204  samples/electric/86.mp3
e421059b95ca45790d300ed7ab325d10fd96a18aa2c1bdd6323f0c048f31bd01  samples/electric/88.mp3
ac7aacdcd75bfb34ee174c65cfb48eefc368770b50f212cd074c68134223bfe7  samples/electric/89.mp3
70d8b24006174a5afa00e9ba887b66a77472a32d3d99a63177205a42223f251d  samples/electric/91.mp3
c38eb1d8ee099ea9b24a9e5a419350191a9d98c7b02d3d615edfc7ae6c2ff348  samples/electric/93.mp3
370a2ba7a6f87da681eb955beba1848f5c627a8795d992a6b18bb9425bee2da0  samples/electric/95.mp3
55be4d9bac5c999643b75ef73d71f9b7956436546e378f676652ed93787a738a  samples/electric/96.mp3
e63df7f81d630ab9742b79cc96e9774c5e5c198e7c40b5dc0d3e1d3b2e5fe654  samples/electric/98.mp3
```

Nylon set SHA-256 (computed 2026-11-04):

```
a54554a70d5d7c90c27256fbbc96069fe6256bcbd4632f7a4476b16cd6f8396a *nylon/40.mp3
28110d7c210c034a6a95554a9af53bfd221630a39c321325b25d72c2f98a6cfe *nylon/41.mp3
e62b3c69711a2b7f48a4dcc49a4784505064c6ebc8de8c345628c6aa2937e6ee *nylon/42.mp3
2f16210b94cd7b35b9606fe18b62fdbe7b311b1f9933fe3eb9cb4ad5112e03bc *nylon/43.mp3
9aa470e2799484a6558da2b6f14ee9bda00ca0245b2f40a22949e01d402a220d *nylon/44.mp3
6568e11f8eee5b15275f79bc3eaaaaaee2becf2129d77d9644448fb16f7d72b0 *nylon/45.mp3
8278091471daf15971d63dbf5aca0795a41141fdeab970576178000533ae01b9 *nylon/46.mp3
bde79fb6ad2c75a4f0d9ec05ddb92260394cc897270e1488734c91822e363b00 *nylon/47.mp3
58d46782305464db11670c79d75292e15cecb1772a63806ded8dada865128143 *nylon/48.mp3
2fd20e22ae572aba66e5bc3522c54c9c0e6b35034b745e242b3af83097be5d7c *nylon/49.mp3
f0e0675eb79a19489d5c2a5eac3ed67704bcc7b80ffc50376c00d4f434e25f9b *nylon/50.mp3
9e126534c0012b9144141341acabccc05e74476043ef0b50930c697b27fa56bb *nylon/51.mp3
1e82af1b138212d6bd599a720d7a70e97aba7b30f98dd35706b16e2ec480e892 *nylon/52.mp3
605c6080090365595a95a278f2b74ea157cfecf6918f64c7be333e52fc769b2c *nylon/53.mp3
5aaeb59636769f186e6e10126e8b4af90b0d9d8681bf3c71794c989722f81e04 *nylon/54.mp3
535debaa1e88bc20f4bffd9bbf249dc4907f858735f6682e168e8651fca91265 *nylon/55.mp3
a4a420b81eabeec66bac8ee5e78fa5cac4979ef6482b20ca66f89b860b0fb233 *nylon/56.mp3
36c5ce0cf6e793c79effeb7fdaa88d29dda16b8a14241dd5e59b3a9528f7e79b *nylon/57.mp3
409a6a038c29ec960849d63a327f60f8febab1dcf4f4d8c9b1305c8b8d0f9ea5 *nylon/58.mp3
fc55fac90105571b158eb957a3f4544c6b8eb0bb2e0b8d34a36b57caa22f1cf6 *nylon/59.mp3
c41d53897b8fa54ff6ba7ed411012202c0349517fbcec441519b54d1db8fc20b *nylon/60.mp3
f430716403f68cbbb6ac6dcb2fa3edf2d6e456efc611351bbd1bf3e337b8238c *nylon/61.mp3
023889016676ef0ed1a5f2821ae6341e35642760d105561fec327fea3a3ab252 *nylon/62.mp3
e752409fe919393aebd9855dceadd96967e49aa51b3d441b04ebd660dcc533be *nylon/63.mp3
996a3b7a71782029a51a2af9e7d89c04ee8097d15b1ee67b57357fc026780113 *nylon/64.mp3
467bb307fcc2d057c87c811d72140d5cdadef5f009127536389d8eac3536b305 *nylon/65.mp3
d6c9f8f4cf5ba0ce0090c479a6f3a61b9cb43fee802849fd79c5d8902fa2e187 *nylon/66.mp3
d72efb5229383f827a622955a69c7e068030db6482d5e6f315687d853257a1be *nylon/67.mp3
e402cfd1800a6da3cb7ece37fc3951960b03c62dbfcfea1ca2c3dca671852831 *nylon/68.mp3
71477bc3ec2e6a42ac7f9e1913e689411492083f7228649fffaab5e34c076791 *nylon/69.mp3
7c6f10b3ad024eafa59041a6dbe101a9327676b51fbab1bf30f2857b5d5fa284 *nylon/70.mp3
bf59fcd29ce64663e67a7c22ab6bad0450768c589336dcb6547e1fc0498f5d15 *nylon/71.mp3
d02e38318e10dd317f6943eb6820d56070ac9aa7ee3411144fd29c5851be6538 *nylon/72.mp3
26c9e0e232f341b760de44c829c9e6227e724f2dbeb80e4afc5647f21cfa5175 *nylon/73.mp3
665eabf02c7727b69bc25ab0b165a9f9feb95699c2ac66a6c93578938650581a *nylon/74.mp3
0ea1e4946fba50e5e0d123f88bde0816f23236d822bc7ae9044d2e1cea8ce036 *nylon/75.mp3
a16bb3821224c8e90d4b857b17c23c2a40c4f49199ed8c12dd26ddd5a193e7ab *nylon/76.mp3
0e0743a85eb70e1531e8ce2e21e848433978a8f87eac35ccadb5b00b06086926 *nylon/78.mp3
fc24c5001621ecaadc5a1a585c4a929023046e908951f5935f29e5e4bbd107f4 *nylon/80.mp3
f25b7de8b0398ad864087c149ffc83e9e98402b259d31023a30bfb19a629ab43 *nylon/81.mp3
42739701182000882dcc3b04faf863b48b6976f3120e7141a0ad58743df032c0 *nylon/82.mp3
1c9e4f687cc8d5f5b616c3a2119bf3398c7e3dd45b008a799326d9870f90a13d *nylon/83.mp3
```

Detection values (Hz per note): `gauntlet/sound/nylon-tuning.json`.

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

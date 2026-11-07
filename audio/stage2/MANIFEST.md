# 《弹壳轮回》Stage 2 (Desert) audio — MANIFEST

All files: MP3, 44.1 kHz, CBR (SFX mono ~112 kbps; music/ambience joint-stereo 128 kbps) — iPhone Safari compatible.
Durations are ffprobe values (include ~25–50 ms MP3 encoder padding). SFX silence-trimmed, 1 ms fade-in, short fade-out.
Loudness (same scheme as stage 1): SFX max-momentary ≈ -14 LUFS (footsteps/land/throw 3–4 dB lower since they repeat);
music ≈ -18/-19 LUFS integrated; ambience -24 LUFS integrated. Decoded peaks ≤ -1 dBFS.
Music v2 (Nov 7): Egyptian/Middle-Eastern rework — hand percussion (darbuka dum/tek/ka, riq jingles, bendir, finger cymbals) is synthesised procedurally and layered on the GM render.
Stage-1 sounds (guns, explosions, pickups, dash, hurt) are reused from `../` — not duplicated here.

## SFX
| File | Duration | Format | Purpose / suggested trigger | Loop | Volume |
|---|---|---|---|---|---|
| `camel_groan_1.mp3` | 1.384 s | 1 ch / 44100 Hz / 114 kbps | Camel cavalry idle/hurt groan; play randomly every 4-8 s while mounted, or on camel hit | no | 0.7 |
| `camel_groan_2.mp3` | 1.202 s | 1 ch / 44100 Hz / 114 kbps | Angrier bellow: camel charge start / camel death (rider dismounts) | no | 0.8 |
| `camel_step_1.mp3` | 0.287 s | 1 ch / 44100 Hz / 122 kbps | Single heavy padded footfall in sand (walk); per step, ±8% random rate | no | 0.5 |
| `camel_step_2.mp3` | 0.601 s | 1 ch / 44100 Hz / 116 kbps | 3-hit gallop burst for the charge; loop-trigger every ~0.33 s while charging | no | 0.6 |
| `grenade_explode.mp3` | 1.489 s | 1 ch / 44100 Hz / 113 kbps | Grenade detonates (blast + falling sand debris) | no | 1.0 |
| `grenade_land.mp3` | 0.679 s | 1 ch / 44100 Hz / 116 kbps | Grenade hits sand, 2 small bounces, fuse fizz (show landing circle here) | no | 0.7 |
| `grenade_throw.mp3` | 0.496 s | 1 ch / 44100 Hz / 117 kbps | Grenadier throws (pin + grunt + whoosh); also usable for player throw | no | 0.8 |
| `jump_land.mp3` | 0.313 s | 1 ch / 44100 Hz / 121 kbps | Jump trooper lands / roll ends (sand thud) | no | 0.6 |
| `jump_takeoff.mp3` | 0.705 s | 1 ch / 44100 Hz / 116 kbps | Jump trooper takeoff/leap (jetpack burst + whoosh); sync to end of warning anim | no | 0.8 |

## Music & ambience (loops)
| File | Duration | Format | Purpose / suggested trigger | Loop | Volume |
|---|---|---|---|---|---|
| `amb_desert_wind.mp3` | 32.026 s | 2 ch / 44100 Hz / 128 kbps | Desert wind/sand ambience bed for all stage-2 rooms; loop under BGM (exact loop 32.000 s) | yes | 0.5 |
| `bgm_boss_desert.mp3` | 76.826 s | 2 ch / 44100 Hz / 128 kbps | Boss 沙鲸·流沙之喉 full suite: 150 BPM, E double-harmonic; P1 bars 1-16 / P2 17-32 / P3 33-48 (25.6 s each); 48 bars, exact loop 76.800 s | yes | 0.5-0.6 |
| `bgm_boss_desert_p1.mp3` | 25.626 s | 2 ch / 44100 Hz / 128 kbps | Boss phase 1 潜沙 (HP 100-66%): sparse stalking groove, low drone, taiko + saidi darbuka, ney; 16 bars, exact loop 25.600 s | yes | 0.5-0.6 |
| `bgm_boss_desert_p2.mp3` | 25.626 s | 2 ch / 44100 Hz / 128 kbps | Boss phase 2 沙暴 (66-33%): string 16ths, koto+oud, brass pushes, fast maqsum + 16th riq; 16 bars, exact loop 25.600 s | yes | 0.5-0.6 |
| `bgm_boss_desert_p3.mp3` | 25.626 s | 2 ch / 44100 Hz / 128 kbps | Boss phase 3 开膛 (33-0%): full climax, distorted guitar, choir, orchestra hits, trumpets; 16 bars, exact loop 25.600 s | yes | 0.5-0.6 |
| `bgm_desert.mp3` | 58.227 s | 2 ch / 44100 Hz / 128 kbps | Stage 2 desert BGM (v2, Egyptian): 132 BPM, D Hijaz; oud (shamisen+nylon), ney (shakuhachi/flute), strings, D-A drone, procedural darbuka/riq/bendir + kit; 32 bars, exact loop 58.182 s | yes | 0.5-0.6 |

**Exact loop lengths** (sample-exact in the WAV masters): bgm_desert **58.182 s** (2,565,818 samples = 32 bars @132), bgm_boss_desert **76.800 s** (3,386,880 samples = 48 bars @150),
bgm_boss_desert_p1/p2/p3 **25.600 s** each (1,128,960 samples = 16 bars @150),
amb_desert_wind **32.000 s** (1,411,200 samples).
BGMs were rendered as 3 continuous cycles and the middle cycle cut, so reverb/release tails carry over the seam; the ambience uses a 4 s
equal-power crossfade of its tail into its head. Use `loop: true`. If an MP3 decoder leaves a tiny gap at the seam, set loop markers to the exact
lengths above or use the WAVs in `_src/wav/`.

## Boss phase guidance (沙鲸·流沙之喉, story/stage2.json)
All boss files share 150 BPM, E double-harmonic, 4/4, so one bar = 1.6 s and every phase file is exactly 16 bars.
- **Recommended**: play `bgm_boss_desert_p1` looped; when HP crosses 66% switch to `_p2`, at 33% to `_p3`. Switch on the next bar
  (multiple of 1.6 s in the current loop position, or wait for loop end) with a ~0.3-0.5 s crossfade — the start of p2/p3 opens with a crash+downbeat,
  so a bar-synced cut sounds intentional. Per-phase loudness rises on purpose: p1 ≈ -20, p2 ≈ -19, p3 ≈ -18 LUFS.
- **Simple option**: loop `bgm_boss_desert` (P1→P2→P3 in one file) and, on a phase change, `seek` to 0 / 25.6 / 51.2 s. Looping the whole file goes P3→P1.
- Death: fade out over ~1 s, then stage clear jingle/dialogue.

v1 versions (pre-Egyptian rework) are kept in `_src/old/`.

## License
All SFX and ambience were synthesised procedurally on this machine (numpy/scipy/sox; scripts in `_src/`); no third-party samples or downloads.
BGM is original composition rendered with FluidSynth using the FluidR3_GM SoundFont (MIT license). Free for commercial use.

## Regenerate
```
source /opt/audio-venv/bin/activate && cd _src
python sfx.py      # SFX + amb_desert_wind
python bgm.py      # bgm_desert, bgm_boss_desert, _p1/_p2/_p3 (600 s fluidsynth timeout + zero-length-note guard)
python check.py && python manifest.py
```

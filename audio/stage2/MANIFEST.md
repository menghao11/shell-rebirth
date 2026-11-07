# 《弹壳轮回》Stage 2 (Desert) audio — MANIFEST

All files: MP3, 44.1 kHz, CBR (SFX mono ~112 kbps; music/ambience joint-stereo 128 kbps) — iPhone Safari compatible.
Durations are ffprobe values (include ~25–50 ms MP3 encoder padding). SFX silence-trimmed, 1 ms fade-in, short fade-out.
Loudness (same scheme as stage 1): SFX max-momentary ≈ -14 LUFS (footsteps/land/throw 3–4 dB lower since they repeat);
music ≈ -18/-19 LUFS integrated; ambience -24 LUFS integrated. Decoded peaks ≤ -1 dBFS.
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
| `bgm_boss_desert.mp3` | 34.325 s | 2 ch / 44100 Hz / 128 kbps | Desert boss (sandstorm) BGM: 168 BPM, E hijaz, chug + taiko + darbuka; 24 bars, exact loop 34.286 s | yes | 0.5-0.6 |
| `bgm_desert.mp3` | 53.368 s | 2 ch / 44100 Hz / 128 kbps | Stage 2 desert BGM: 144 BPM, D hijaz, shanai/trumpet/sitar + darbuka + guitar; 32 bars, exact loop 53.333 s | yes | 0.5-0.6 |

**Exact loop lengths** (sample-exact in the WAV masters): bgm_desert **53.333 s** (2,352,000 samples), bgm_boss_desert **34.286 s** (1,512,000 samples),
amb_desert_wind **32.000 s** (1,411,200 samples).
BGMs were rendered as 3 continuous cycles and the middle cycle cut, so reverb/release tails carry over the seam; the ambience uses a 4 s
equal-power crossfade of its tail into its head. Use `loop: true`. If an MP3 decoder leaves a tiny gap at the seam, set loop markers to the exact
lengths above or use the WAVs in `_src/wav/`.

## License
All SFX and ambience were synthesised procedurally on this machine (numpy/scipy/sox; scripts in `_src/`); no third-party samples or downloads.
BGM is original composition rendered with FluidSynth using the FluidR3_GM SoundFont (MIT license). Free for commercial use.

## Regenerate
```
source /opt/audio-venv/bin/activate && cd _src
python sfx.py      # SFX + amb_desert_wind
python bgm.py      # bgm_desert, bgm_boss_desert (600 s fluidsynth timeout + zero-length-note guard)
python check.py && python manifest.py
```

# 《弹壳轮回》Stage 1 audio — MANIFEST

All files: MP3, 44.1 kHz, CBR (SFX mono ~112 kbps, BGM joint-stereo 128 kbps) — plays on iPhone Safari / all browsers.
Durations are ffprobe values (include ~25–50 ms MP3 encoder padding). Silence trimmed; 1 ms fade-in, short fade-out.

Loudness: SFX normalised to max-momentary ≈ -14 LUFS (frequent sounds deliberately lower: mg -2 dB, enemy_hit -3 dB, scrap -3 dB, sniper_warn -4 dB);
BGM ≈ -18/-19 LUFS integrated so music sits under SFX. Decoded peaks ≤ -1 dBFS.
Suggested Phaser volumes: SFX 0.8–1.0, BGM 0.5–0.6. For machine-gun spam, alternate mg_1/mg_2 and add `detune` ±50–100 cents.

## SFX
| File | Duration | Format | Purpose / suggested trigger | Loop |
|---|---|---|---|---|
| `dash.mp3` | 0.392 s | 1 ch / 44100 Hz / 119 kbps | Space dash | no |
| `dry_fire.mp3` | 0.131 s | 1 ch / 44100 Hz / 134 kbps | Trigger with empty mag | no |
| `enemy_hit.mp3` | 0.209 s | 1 ch / 44100 Hz / 125 kbps | Bullet hits enemy (keep quiet, very frequent) | no |
| `explosion_large.mp3` | 1.489 s | 1 ch / 44100 Hz / 113 kbps | Large explosion: Q grenade, 爆炸桶 barrel, boss phase break/death | no |
| `explosion_small.mp3` | 1.097 s | 1 ch / 44100 Hz / 114 kbps | Small explosion: enemy death burst, mine, small bullet blast | no |
| `explosion_steam.mp3` | 1.489 s | 1 ch / 44100 Hz / 113 kbps | Steam explosion reaction (燃烧+冰冻) | no |
| `freeze.mp3` | 0.888 s | 1 ch / 44100 Hz / 115 kbps | Ice reaches 4 stacks -> frozen 1.5s | no |
| `grenade_throw.mp3` | 0.470 s | 1 ch / 44100 Hz / 118 kbps | Q grenade: pin + throw whoosh (explosion_large on detonation) | no |
| `hostage_rescue.mp3` | 0.888 s | 1 ch / 44100 Hz / 115 kbps | Hostage freed in 人质房 | no |
| `ignite.mp3` | 0.940 s | 1 ch / 44100 Hz / 115 kbps | Burn ammo procs / target catches fire | no |
| `pickup_health.mp3` | 0.784 s | 1 ch / 44100 Hz / 115 kbps | Health / armor pickup | no |
| `pickup_powerup.mp3` | 1.123 s | 1 ch / 44100 Hz / 114 kbps | Room-clear 3-choose-1 reward taken; buy 装甲+10 in base | no |
| `pickup_scrap.mp3` | 0.549 s | 1 ch / 44100 Hz / 117 kbps | Pick up 废铁 scrap currency | no |
| `pickup_weapon.mp3` | 0.627 s | 1 ch / 44100 Hz / 116 kbps | Pick up / swap weapon or ammo type | no |
| `player_death.mp3` | 1.489 s | 1 ch / 44100 Hz / 113 kbps | Player dies (before death-echo/result screen) | no |
| `player_hurt.mp3` | 0.575 s | 1 ch / 44100 Hz / 117 kbps | Player takes damage | no |
| `reload.mp3` | 0.653 s | 1 ch / 44100 Hz / 116 kbps | Magazine reload (mag out / in / rack) | no |
| `shield_block.mp3` | 0.575 s | 1 ch / 44100 Hz / 117 kbps | Bullet blocked by 重装兵 front shield (ricochet) | no |
| `shoot_mg_1.mp3` | 0.366 s | 1 ch / 44100 Hz / 119 kbps | Machine-gun shot (机枪, 10/s); alternate with mg_2 + ±5% random pitch | no |
| `shoot_mg_2.mp3` | 0.366 s | 1 ch / 44100 Hz / 119 kbps | Machine-gun shot variant B | no |
| `shoot_pistol.mp3` | 0.470 s | 1 ch / 44100 Hz / 118 kbps | Pistol shot (手枪, 4/s). Play per shot | no |
| `shoot_pistol_power.mp3` | 0.601 s | 1 ch / 44100 Hz / 116 kbps | First shot after reload (+50% dmg, 马克中士 passive) | no |
| `shoot_split.mp3` | 0.366 s | 1 ch / 44100 Hz / 119 kbps | Split-ammo (分裂) proc: shot + 3 diverging zips | no |
| `sniper_warn.mp3` | 1.437 s | 1 ch / 44100 Hz / 114 kbps | Sniper 1.5s red-line telegraph (start with the line, stop if interrupted) | no |
| `tank_cannon.mp3` | 1.489 s | 1 ch / 44100 Hz / 113 kbps | Boss 铁砧 main cannon (phase 1 straight shot) | no |

## Music
| File | Duration | Format | Purpose / suggested trigger | Loop |
|---|---|---|---|---|
| `bgm_boss.mp3` | 33.933 s | 2 ch / 44100 Hz / 128 kbps | Boss 铁砧 BGM, 170 BPM E phrygian, 24 bars (loop = 33.882 s exactly) | yes |
| `bgm_stage1.mp3` | 50.573 s | 2 ch / 44100 Hz / 128 kbps | Stage 1 废弃前线 BGM, 152 BPM E minor, 32 bars (loop = 50.526 s exactly) | yes |

**Looping**: each BGM was rendered as 3 continuous cycles and the middle cycle cut out, so reverb tails wrap into the start seamlessly.
Use `this.sound.add('bgm_stage1', { loop: true })`. MP3 has encoder delay; LAME gapless info is written, but if a tiny gap is
audible on some browser, use Web Audio (Phaser default) and/or set loop markers to 0 – 50.526 s (stage1) / 0 – 33.882 s (boss).
Lossless WAV masters are in `_src/wav/` if OGG/WAV is ever preferred.


## Revision (2026-11-11) — loop seam
`bgm_stage1` and `bgm_boss` were post-processed in place (exact sample counts unchanged: 50.526 s / 33.882 s). The old limiter faded the first and last ≈ 8 ms of each loop; that edge fade is gone, the seam sample jump is 0, and residual DC is 0. Pre-fix copies are in `_src/old/`. The remaining last-50 ms vs first-50 ms level difference is musical (downbeat at the start of the loop), not an artifact — over a 500 ms window `bgm_stage1` is actually +1.5 dB at the end. Details and the same fix for the desert loops are in `stage2/MANIFEST.md`.

## License
All sound effects were synthesised procedurally on this machine (numpy/scipy/sox; scripts in `_src/`). No third-party samples or downloads.
BGM is original composition rendered with FluidSynth using the FluidR3_GM SoundFont (MIT license).
Everything here is free for commercial use.

## Regenerate
```
source /opt/audio-venv/bin/activate && cd _src
python sfx.py            # all SFX (or: python sfx.py dash explosion_large)
python bgm.py            # bgm_stage1, bgm_boss
python check.py          # ffprobe + loudness verification
python manifest.py       # rebuild this file
```

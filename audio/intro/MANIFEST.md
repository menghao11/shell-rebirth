# 《弹壳轮回》Boot intro + title screen audio — MANIFEST

All files: MP3, 44.1 kHz, CBR (SFX mono ~112 kbps; intro_full and BGM joint-stereo 128 kbps) — iPhone Safari compatible.
Durations are ffprobe values (include ~25–50 ms MP3 encoder padding). SFX silence-trimmed; intro_full is a fixed 5.500 s sequence.
Loudness: SFX max-momentary ≈ -14 LUFS (heartbeat is 1 dB lower so repeated pulses don’t pile up); intro_full max-momentary -14 LUFS (integrated ≈ -16 to -18, lots of head/tail silence);
title BGM ≈ -19 LUFS integrated. Decoded peaks ≤ -1 dBFS.

## Storyboard cues (intro_full, t = 0 at first sample)

| Time | File used | On-screen beat |
|---|---|---|
| 0.00 s | pulse_heartbeat | Black; echo-pod LED blink 1 + heartbeat |
| 0.65 s | pulse_heartbeat | LED blink 2 + heartbeat |
| 1.30 s | pulse_heartbeat | LED blink 3 + heartbeat (slightly stronger) |
| 1.70 s | hatch_hiss | Hatch latch opens; depressurization / steam |
| 2.50 s | casing_clink_1 | First shell casing lands |
| 2.78 s | casing_clink_2 | Second casing |
| 3.04 s | casing_clink_1 | Third casing |
| 3.30 s | casing_clink_2 | Fourth casing |
| 3.58 s | casing_clink_1 | Fifth casing, last bounce |
| 4.00 s | logo_hit | Casings settle into the logo「弹壳轮回」/ SHELL REBIRTH; whoosh into a heavy hit + metal shine (~4.18 s) |
| 5.50 s | (end) | Sequence over; show “点击开始” and start `bgm_title` (short crossfade optional) |

Total length of the WAV master is exactly **5.500 s**. Skip (click / touch / any key) should fade this out immediately and go to the title screen.

## SFX and premix
| File | Duration | Format | Purpose / suggested trigger | Loop | Volume |
|---|---|---|---|---|---|
| `casing_clink_1.mp3` | 0.470 s | 1 ch / 44100 Hz / 118 kbps | Shell casing hits the floor (brighter). intro_full: 2.50, 3.04, 3.58 s | no | 0.85-1.0 |
| `casing_clink_2.mp3` | 0.418 s | 1 ch / 44100 Hz / 118 kbps | Shell casing hits the floor (darker, with bounce). intro_full: 2.78, 3.30 s | no | 0.85-1.0 |
| `hatch_hiss.mp3` | 1.489 s | 1 ch / 44100 Hz / 113 kbps | Hatch latch clank + depressurization hiss + steam. Starts at 1.70 s | no | 0.9 |
| `intro_full.mp3` | 5.538 s | 2 ch / 44100 Hz / 128 kbps | Pre-mixed 5.50 s boot sequence, storyboard-timed (see cues below). Play once, skippable | no | 1.0 |
| `logo_hit.mp3` | 1.489 s | 1 ch / 44100 Hz / 113 kbps | Logo reveal: short reverse whoosh, heavy hit, metal shine. Starts at 4.00 s (hit at ~4.18 s) | no | 1.0 |
| `pulse_heartbeat.mp3` | 0.366 s | 1 ch / 44100 Hz / 119 kbps | Single echo-pod LED blink + lub-dub heartbeat (retriggerable). In intro_full at 0.00, 0.65, 1.30 s | no | 0.7-0.9 |

## Music
| File | Duration | Format | Purpose / suggested trigger | Loop | Volume |
|---|---|---|---|---|---|
| `bgm_title.mp3` | 30.041 s | 2 ch / 44100 Hz / 128 kbps | Title-screen BGM, 128 BPM E minor, 16 bars, military/arcade (trumpet hook, guitar, brass, kit). Exact loop 30.000 s | yes | 0.5-0.6 |

**Exact loop length** for `bgm_title`: **30.000 s** (1,323,000 samples = 16 bars at 128 BPM). Rendered as 3 continuous cycles with the middle cycle cut out, then wrap-around limited, so reverb/release tails carry over the seam and there is no edge fade. Use `loop: true`. If an MP3 decoder leaves a tiny gap, set the loop marker to 0–30.000 s or use `_src/wav/bgm_title.wav`.

## License
All SFX were synthesised procedurally on this machine (numpy/scipy/sox; scripts in `_src/`). No third-party samples or downloads.
BGM is an original composition rendered with FluidSynth using the FluidR3_GM SoundFont (MIT license). Free for commercial use.

## Regenerate
```
source /opt/audio-venv/bin/activate && cd _src
python sfx.py      # individual SFX + intro_full
python bgm.py      # bgm_title (wrap-around limiter, 600 s fluidsynth timeout)
python check.py
```

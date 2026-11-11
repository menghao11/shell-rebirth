# frames_v2 — expected keys (final pack, 2026-11-11)

Source of truth: `art/frames_v2/FRAME_TABLE.md`, `art/frames_v2/manifest.json`,
and `art/frames_v2/stage2/manifest.json`. Comparison GIFs live in
`art/frames_v2/previews/<key>_v1_vs_v2.gif`.

The v2 sheets have been merged into `art/manifest.json` / `art/stage2/manifest.json`
(same keys, canvas sizes, and anchors). Web copies are rebuilt by
`tools/build_web_art.py` and `tools/build_web_art2.py` into `game/assets/art_web/`
and `game/assets/art_web2/`. The game prefers a web copy when `src_sig` matches.
`applyFramesV2` will **not** overlay the raw 5120px source if the main manifest
already carries the v2 `frame_count` (iPhone / WebGL textures must stay ≤4096).

`finalize.py` wipes `art/` and must not be run as part of a v2 drop-in. If it is
run, follow it with `art_src/fixes_build.py` (wall tiles, turrets, grenade circle).

Do **not** change gameplay numbers (speed, damage, HP, `dashTime`) when adding frames.

## Play rates

| key | v1 | v2 frames | suggested fps | play fps in game | why |
|---|---:|---:|---:|---:|---|
| `hero_run` | 8 @ 14 (0.57 s) | 16 | 24 | **28** | Lock the v1 stride (8/14 s) so feet match `PLAYER.speed = 215`. 16 @ 24 would be 0.67 s / ~143 px per cycle vs the old ~123. |
| `hero_shoot` | 6 @ 16 | 9 | 30 | 30 | Fire frame is still **01**. |
| `hero_shoot_mg` | 4 @ 15 | 9 | 30 | 30 | Baked muzzle flash was removed; the code-side `muzzleFlash()` in `Player.fire()` still runs. |
| `hero_dash` | 6 @ 18 (0.33 s) | 12 | 36 | **~70.6** (`n / dashTime`) | `dashTime` stays **0.17 s**. 36 fps would take 0.33 s and get cut off. A short visual tail finishes any leftover frame; movement / i-frames still follow `dashT` only. |
| `hero_idle` | 4 @ 6 | 8 | 8 | 8 | |
| `hero_reload` | 4 @ 8 | 10 | 9 | 9 | |
| `laoqiang_idle` | 4 @ 6 | 8 | 8 | 8 | |
| `lingjian_idle` | 4 @ 6 | 8 | 8 | 8 | |
| `merchant_idle` | 4 @ 6 | 8 | 8 | 8 | |
| `hostage_tied` | 2 @ 4 | 6 | 6 | 6 | |
| `camel_mounted_idle` | 4 @ 6 | 8 | 8 | 8 | Source sheet is 5120×512; web is 0.4× (2048×205), ≤4096. |
| `camel_foot_idle` | 4 @ 6 | 8 | 8 | 8 | |
| `jumper_idle` | 4 @ 6 | 8 | 8 | 8 | |
| `grenadier_idle` | 4 @ 6 | 8 | 8 | 8 | |

Enemy **move** anims are unchanged (8 frames). `hero_throw`, `hero_hurt`, `hero_death` are not in the v2 pack (v1 kept).

Hero sheets stay 320×320, feet anchor (160, 300). Web copies in `art_web/` are 0.7× (224²). `hero_run` web sheet is 3584×224 (16×1), under the 4096 cap. Multi-row packing is wired in `build_web_art.py` (`MAXW = 4096`) if a future sheet would exceed it.

`build_web_art2.py` keeps `walls/` at 1:1: `wall_desert` 256, `wall_desert_128` 128.

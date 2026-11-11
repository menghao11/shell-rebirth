# Stage 2 Desert — Full requested asset inventory

All 23 previously missing animation keys are present. Base delivery originally excluded the boss; Sandwhale is now added below. Raster/coverage acceptance is in verify_report.json; game-code integration is not performed here.

## Animation integration contracts

- Human poses: 320x320 / (160,300); death: 512x320 / (256,300). Mounted + dismount: 640x512 / (320,490).
- All frames carry embedded PNG anchor metadata, plus measured pixel grounding in alignment.json.
- jumper_windup final crouch may be held before jumper_jump. Jump uses per-frame render_y_offsets for VISUAL height only; gameplay ground coordinates remain unchanged. Then play jumper_landing.
- camel_dismount frame09 is exact camel_foot_idle_00 re-framed at the same world origin. At detach_mount spawn s2_camel_corpse behind the actor at the same ground origin. Detached dismount frames contain only the rider; replace actor with foot actor on frame09. Original generated transition is retained in art_src.
- camel/foot/jumper firing events: frames 02/03/04. Grenadier_throw releases on 05. Explosion damage on 01.

## MANIFEST

| key | frames | frame size | anchor | fps | loop | file |
|---|---:|---|---|---:|---|---|
| tile_sand_a_256 | 1 | [256, 256] | [0, 0] | - | False | `tiles/tile_sand_a_256.png` |
| tile_sand_a_128 | 1 | [128, 128] | [0, 0] | - | False | `tiles/tile_sand_a_128.png` |
| tile_sand_b_256 | 1 | [256, 256] | [0, 0] | - | False | `tiles/tile_sand_b_256.png` |
| tile_sand_b_128 | 1 | [128, 128] | [0, 0] | - | False | `tiles/tile_sand_b_128.png` |
| tile_sand_c_256 | 1 | [256, 256] | [0, 0] | - | False | `tiles/tile_sand_c_256.png` |
| tile_sand_c_128 | 1 | [128, 128] | [0, 0] | - | False | `tiles/tile_sand_c_128.png` |
| tile_sand_d_256 | 1 | [256, 256] | [0, 0] | - | False | `tiles/tile_sand_d_256.png` |
| tile_sand_d_128 | 1 | [128, 128] | [0, 0] | - | False | `tiles/tile_sand_d_128.png` |
| s2_bones_scatter | 1 | [178, 129] | [89, 126] | - | False | `props/s2_bones_scatter.png` |
| s2_bones_skull | 1 | [167, 135] | [83, 132] | - | False | `props/s2_bones_skull.png` |
| s2_cactus_cluster | 1 | [152, 154] | [76, 151] | - | False | `props/s2_cactus_cluster.png` |
| s2_cactus_tall | 1 | [115, 176] | [57, 173] | - | False | `props/s2_cactus_tall.png` |
| s2_dune_large | 1 | [233, 124] | [116, 121] | - | False | `props/s2_dune_large.png` |
| s2_dune_small | 1 | [211, 104] | [105, 101] | - | False | `props/s2_dune_small.png` |
| s2_oil_drum | 1 | [98, 156] | [49, 153] | - | False | `props/s2_oil_drum.png` |
| s2_oil_tank | 1 | [180, 143] | [90, 140] | - | False | `props/s2_oil_tank.png` |
| s2_rocks | 1 | [197, 154] | [98, 151] | - | False | `props/s2_rocks.png` |
| s2_sign | 1 | [174, 149] | [87, 146] | - | False | `props/s2_sign.png` |
| s2_supplies | 1 | [181, 129] | [90, 126] | - | False | `props/s2_supplies.png` |
| s2_tent | 1 | [238, 164] | [119, 161] | - | False | `props/s2_tent.png` |
| grenadier_reference | 1 | [320, 320] | [160, 300] | - | False | `references/grenadier_reference.png` |
| jumper_reference | 1 | [320, 320] | [160, 300] | - | False | `references/jumper_reference.png` |
| camel_foot_reference | 1 | [320, 320] | [160, 300] | - | False | `references/camel_foot_reference.png` |
| camel_mounted_reference | 1 | [640, 512] | [320, 490] | - | False | `references/camel_mounted_reference.png` |
| grenadier_idle | 4 | [320, 320] | [160, 300] | 6 | True | `enemies/grenadier/grenadier_idle_sheet.png` |
| grenadier_throw | 8 | [320, 320] | [160, 300] | 10 | False | `enemies/grenadier/grenadier_throw_sheet.png` |
| s2_landing_target | 8 | [256, 128] | [128, 64] | 12 | True | `fx/s2_landing_target_sheet.png` |
| s2_sand_grain | 1 | [32, 16] | [16, 8] | - | False | `fx/s2_sand_grain.png` |
| s2_sand_streak | 1 | [64, 24] | [32, 12] | - | False | `fx/s2_sand_streak.png` |
| s2_blowing_sand | 12 | [256, 128] | [128, 64] | 12 | True | `fx/s2_blowing_sand_sheet.png` |
| s2_grenade_spin | 8 | [64, 64] | [32, 32] | 16 | True | `projectiles/s2_grenade_spin_sheet.png` |
| s2_explosion | 8 | [256, 256] | [128, 128] | 16 | False | `fx/s2_explosion_sheet.png` |
| camel_mounted_idle | 4 | [640, 512] | [320, 490] | 6 | True | `enemies/camel_mounted/camel_mounted_idle_sheet.png` |
| camel_mounted_move | 8 | [640, 512] | [320, 490] | 14 | True | `enemies/camel_mounted/camel_mounted_move_sheet.png` |
| camel_mounted_charge | 8 | [640, 512] | [320, 490] | 18 | True | `enemies/camel_mounted/camel_mounted_charge_sheet.png` |
| camel_mounted_shoot | 6 | [640, 512] | [320, 490] | 14 | False | `enemies/camel_mounted/camel_mounted_shoot_sheet.png` |
| camel_mounted_hurt | 3 | [640, 512] | [320, 490] | 12 | False | `enemies/camel_mounted/camel_mounted_hurt_sheet.png` |
| camel_mounted_death | 8 | [640, 512] | [320, 490] | 10 | False | `enemies/camel_mounted/camel_mounted_death_sheet.png` |
| camel_dismount | 10 | [640, 512] | [320, 490] | 12 | False | `enemies/camel_mounted/camel_dismount_sheet.png` |
| camel_foot_idle | 4 | [320, 320] | [160, 300] | 6 | True | `enemies/camel_foot/camel_foot_idle_sheet.png` |
| camel_foot_move | 8 | [320, 320] | [160, 300] | 12 | True | `enemies/camel_foot/camel_foot_move_sheet.png` |
| camel_foot_attack | 6 | [320, 320] | [160, 300] | 14 | False | `enemies/camel_foot/camel_foot_attack_sheet.png` |
| camel_foot_hurt | 3 | [320, 320] | [160, 300] | 12 | False | `enemies/camel_foot/camel_foot_hurt_sheet.png` |
| camel_foot_death | 8 | [512, 320] | [256, 300] | 10 | False | `enemies/camel_foot/camel_foot_death_sheet.png` |
| jumper_idle | 4 | [320, 320] | [160, 300] | 6 | True | `enemies/jumper/jumper_idle_sheet.png` |
| jumper_move | 8 | [320, 320] | [160, 300] | 16 | True | `enemies/jumper/jumper_move_sheet.png` |
| jumper_attack | 6 | [320, 320] | [160, 300] | 14 | False | `enemies/jumper/jumper_attack_sheet.png` |
| jumper_hurt | 3 | [320, 320] | [160, 300] | 12 | False | `enemies/jumper/jumper_hurt_sheet.png` |
| jumper_death | 8 | [512, 320] | [256, 300] | 10 | False | `enemies/jumper/jumper_death_sheet.png` |
| jumper_windup | 4 | [320, 320] | [160, 300] | 8 | False | `enemies/jumper/jumper_windup_sheet.png` |
| jumper_jump | 8 | [320, 320] | [160, 300] | 14 | False | `enemies/jumper/jumper_jump_sheet.png` |
| jumper_landing | 4 | [320, 320] | [160, 300] | 12 | False | `enemies/jumper/jumper_landing_sheet.png` |
| grenadier_move | 8 | [320, 320] | [160, 300] | 12 | True | `enemies/grenadier/grenadier_move_sheet.png` |
| grenadier_hurt | 3 | [320, 320] | [160, 300] | 12 | False | `enemies/grenadier/grenadier_hurt_sheet.png` |
| grenadier_death | 8 | [512, 320] | [256, 300] | 10 | False | `enemies/grenadier/grenadier_death_sheet.png` |
| s2_camel_corpse | 1 | [960, 512] | [640, 490] | - | False | `props/s2_camel_corpse.png` |

## Source / build

Grounded windup/landing are editorial phases from the clean full jump, not the rejected original isolated takes. Dismount uses an isolated leap plus the same rider foot hurt/idle for recovery. Preserve metadata-driven visual offsets for both jump and dismount. See DELIVERY_REPORT.md for weak spots and integration mapping.

Grok subscription sprite-gen video-set, video-frames and video-loop (with RIFE installed). Existing first-pass image/native-video assets retained. Editorial frame selection, explicit dismount endpoint composite, and per-frame feet registration documented in alignment.json and video2/editorial_picks.json.

finalize.py -> p27_assets.py -> stage-1 documentation/preview/verification -> stage2_build.py -> stage2_enemies.py -> stage2_verify.py -> stage2_delivery.py

Frames/sheets are relative to art/stage2; prefix stage2/ when merging into the root manifest. Existing root manifest and game code are not modified.

## Weak spots / required visual checks

- Dismount endpoint is an explicit editorial composite, not claimed as an untouched video frame. Corpse continuity requires drawing the supplied s2_camel_corpse as a separate entity at the same origin.
- Jump vertical movement is metadata-driven; a renderer ignoring render_y_offsets will show only the tucked-leg poses.
- Current game DK.SKINS uses camel_* / camelrider_* / jumper_crouch: see integration_aliases.json for exact remap; runtime does not yet consume render_y_offsets / landing / corpse layer. Art raster QA passing does not mean game integration is complete.
- Character faces remain somewhat frontal; native-scale and in-game review recommended.
- Numeric grounding measures lowest opaque silhouette band, not anatomical foot recognition. Death / dismount grounding is a registration convention; semantic motion still needs visual review.

## Preview

`preview.png`, `native_scale_preview.png`; `camel_mounted.gif`, `camel_foot.gif`, `jumper.gif`, `grenadier.gif`.

## Sandwhale boss addition

# 沙鲸·流沙之喉 / Sandwhale — Art delivery

18 keys / 149 frames. Full stage2: 79 keys / 376 frames. Raster verification: True; complete-scope coverage: True.

## Lore and visual lock

Sand Scorpion legion mechanical sandworm: drill-petal head, three welded dorsal turrets, ochre/rust armor with hazard stripes and scorpion insignia. P1 underground/surfaced ram and fan shots; P2 minion spit and sand streams; P3 armor opens to reveal a glowing cyan Echo Pod, then rolling debris rings. The drop is an intact Echo Pod bearing the exact label **马克·0号**. Source: story/stage2.json → boss_sandwhale. Anvil and approved desert art were style references.

## MANIFEST

| key | frames | canvas | anchor | fps | file |
|---|---:|---|---|---:|---|
| sandwhale_move | 8 | [1024, 640] | [512, 610] | 8 | `boss/body/sandwhale_move_sheet.png` |
| sandwhale_burrow | 8 | [1024, 640] | [512, 610] | 12 | `boss/body/sandwhale_burrow_sheet.png` |
| sandwhale_emerge | 10 | [1024, 640] | [512, 610] | 14 | `boss/body/sandwhale_emerge_sheet.png` |
| sandwhale_ram | 8 | [1024, 640] | [512, 610] | 14 | `boss/body/sandwhale_ram_sheet.png` |
| sandwhale_turret | 8 | [1024, 640] | [512, 610] | 14 | `boss/body/sandwhale_turret_sheet.png` |
| sandwhale_spit | 8 | [1024, 640] | [512, 610] | 12 | `boss/body/sandwhale_spit_sheet.png` |
| sandwhale_spray | 12 | [1024, 640] | [512, 610] | 16 | `boss/body/sandwhale_spray_sheet.png` |
| sandwhale_open | 10 | [1024, 640] | [512, 610] | 12 | `boss/body/sandwhale_open_sheet.png` |
| sandwhale_roll | 12 | [1024, 640] | [512, 610] | 16 | `boss/body/sandwhale_roll_sheet.png` |
| sandwhale_hurt | 4 | [1024, 640] | [512, 610] | 14 | `boss/body/sandwhale_hurt_sheet.png` |
| sandwhale_hurt_open | 4 | [1024, 640] | [512, 610] | 14 | `boss/body/sandwhale_hurt_open_sheet.png` |
| sandwhale_destroy | 12 | [1024, 640] | [512, 610] | 10 | `boss/body/sandwhale_destroy_sheet.png` |
| sandwhale_bulge | 12 | [640, 256] | [320, 230] | 12 | `boss/ground_fx/sandwhale_bulge_sheet.png` |
| sandwhale_echo_pod_idle | 8 | [320, 320] | [160, 300] | 8 | `boss/items/sandwhale_echo_pod_idle_sheet.png` |
| sandwhale_portrait | 1 | [512, 512] | [256, 512] | - | `boss/portraits/sandwhale_portrait.png` |
| sandwhale_debris_shard | 6 | [96, 96] | [48, 48] | 16 | `boss/projectiles/sandwhale_debris_shard_sheet.png` |
| sandwhale_sand_bullet | 6 | [128, 64] | [64, 32] | 18 | `boss/projectiles/sandwhale_sand_bullet_sheet.png` |
| sandwhale_storm | 12 | [640, 256] | [320, 230] | 12 | `boss/ground_fx/sandwhale_storm_sheet.png` |

## Runtime contracts

- EVERY boss body state uses 1024×640 and anchor (512,610), including burrow, emerge, open, roll, both hit reactions and death. Belly/ground registration is measured independently from opaque pixels, not assumed from metadata.
- Actual cross-state body contact range: 1.0 px; pod: 0.0 px. Requirement ≤2px. Empty hidden-body poses are not substituted for measurable contact.
- Large body sheets use **4-column row-major grids**, up to 4096×1920, rather than 12,288px horizontal strips. frame_size/frame_count stay unchanged; Phaser’s current spritesheet loader slices this grid without game-code changes. Ignore unused final grid cells.
- sandwhale_move is the surfaced idle/breathing loop. Existing game hooks sandwhale_burrow, emerge, ram, spit, open, roll and destroy match these keys. New turret, spray and hurt_open states need explicit hookups; map the stage2 boss dialogue speaker to sandwhale_portrait. No game files were edited.
- Burrow is a one-shot ending at the tiny exposed back ridge/turret; hold that pose or hide the body and draw sandwhale_bulge. Invulnerable from burrow frame 00 (all frames 00–07, matching the game: body disabled at burrow start) and throughout the underground state. Emerge shares that exact drawing at frame00; surface_hittable marks the suggested vulnerability change.
- Shared exact body drawings connect surfaced actions and idle, burrow→emerge, emerge→idle, open→roll, open-core hit→roll, and roll→death. No change of canvas or origin at any boundary.
- At ram_active move the gameplay actor; its sprite performance is an in-place impact. Do not translate the body merely to compensate for an origin change.
- Turret fan_shots spawn independent bullets; spit spawn_minions spawns the existing jumper/grenadier; sand_stream spawns sandwhale_sand_bullet. No minions are baked into body frames.
- Phase2: tile/translate sandwhale_storm at low opacity plus the existing desert sand particles. Visibility reduction is gameplay code, not a baked full-screen gray haze.
- core_weakpoint_frames records per-frame cyan-core visibility/centroids on open, roll, hurt_open and destroy; inspect at runtime before using the approximate centroid as a hit box.
- On destroy.drop_echo_pod spawn sandwhale_echo_pod_idle once near the head. Loot is an independent item, not baked into the wreck; its shell and exact nameplate are pixel-static, only cyan window illumination pulses.

## Verification

- strict `stage2_verify.py`: errors=[]; missing=[].
- Checked RGBA, per-frame embedded anchors, canonical sizes, sheet/frame pixel equality including grid layouts, distinct drawings, opaque whole-body ground contact within/across boss states (all legitimate articulated pieces; human checks retain the stage1 main-component method), exact transition pixels, canvas-border clipping, chroma fringe and distant faint haze.
- Existing 32 mixed sand tile-pair tests remain zero-delta.
- Boss GIFs and native-scale/contact previews are art review, not claims of gameplay verification. No boss fight playtest or mobile GPU/memory test performed.

## Provenance / explicit editorial work

- Grok subscription via sprite-gen; video reports auth_source=grok-login and model=grok-imagine-video-1.5. No credential was read, printed or changed. Native images and raw/keyed video, engine reports and rejected takes remain under art_src/stage2/boss/.
- Initial ref edits returned black backdrops despite the requested key. Their automatic magenta mattes were empty; sanctioned cutout --key auto measured the observed black background, then the valid cutouts were composited onto true magenta before filming. No empty matte was shipped.
- The initial custom move loop failed the seam gate; a pinned idle take was filmed, but its shell wrap still visibly redrew. Final mechanical idle holds the generated shell pixel-static and pulses only sensor/vent lighting, explicitly instead of claiming a repaired moving-shell loop. Initial roll was tail-rocking rather than a full roll and also failed periodicity; replaced by a pinned roll retake (stylized axial rolling; see limitations). Ram edge warnings were inspected in the actual flagged frames: the whole primary worm remained inside the canvas, but the model invented a detached secondary drill/jaw projectile that left the image. A wider retake repeated this defect; 1080p was also refused for reference-to-video. The original intact body was therefore re-extracted with the sanctioned subject-edge override, then the disconnected distant projectile components were explicitly excluded from body export. No clipped body anatomy was accepted; final body borders are strictly checked. The original refusal reports and source projectiles remain archived. Initial death slumped only ~18% and the generic destroy detector cut too early; the death-specific recut refused it (0.821 vs 0.8), so a new sideways-wreck death was filmed. Its visibly flattened held wreck was still marginally above the biped-style 0.8 height rule (0.807), so the legless collapse was cut with the engine’s generic held-action detector; exact source times and that exception remain documented. A separately generated detached cyan orb is removed from the body frames; the labeled capsule is spawned separately. Rejected sources were not silently accepted and thresholds were not widened.
- The early black-key reference had lost dark recessed chassis paint, inherited by filmed motion. A 16px local closing/enclosed-gap matte restoration adds opaque dark-brown undercarriage behind the original colored armor. Large curved-tail negative space stays open. This is explicit matte repair, not untouched generation.
- The complete submerge/emerge clip is split editorially at its minimum nonempty silhouette. One-shots use equal-pose-change sampling; loops uniform sampling. All body clips share one extra global scale before rigid grounding, so an extreme pose cannot cause per-state size changes.
- Body boundary drawings are explicit canonical endpoint composites; they are not misrepresented as untouched video frames. The original video and selection indices are retained.
- The pod video’s pinned wrap redrew part of the casing. Final loot uses its generated casing held pixel-static, with video-referenced low-amplitude cyan-window illumination baked as a smooth periodic layer. Exact CJK typography is added with NotoSansCJK; it is not model-generated lettering.
- The shard is generated from the worm’s armor and rigidly rotated into six centered frames. Sand-stream bullets are hand-authored 4× supersampled smooth cartoon vectors, not pixelfx/pixel art. Storm reuses the approved cartoon blowing-sand family.

## Weak spots / integration work

- Per-frame boss grounding measures the lowest 10% band across the whole opaque segmented body after artifact removal, not just its largest connected component. Articulated armor rings are legitimately disconnected; using only the largest piece initially chose the wrong ground line and made the uniform fit shrink excessively. That draft was rejected and rebuilt. This remains a belly/ground convention rather than semantic anatomy; moving segments can still change the upper-body silhouette.
- Small rivet/armor/turret details may vary in fast generated motion. The roll is stylized axial rocking/rolling, not a physically precise pair of complete 360-degree barrel rotations. Its rotational readability and exposed-core hit timing need in-game review.
- Core centroid metadata is a color-derived artist guide, not a validated collision shape. Projectile scale/speed, storm opacity and minion spawn timing remain designer-tunable.
- Native large boss animations consume substantial texture memory; grid sheets avoid oversized strip dimensions, but mobile/downscaled-web-art packing still needs testing.
- sandwhale_portrait is now a HEAD close-up (游戏王 fix): a crop of the generated 3/4 portrait master showing the drill maw, red eyes and front dorsal turret; the body continues past the left edge as part of the bust framing (drill tip and turret top are inside the frame). Full-body frames are separately checked for unclipped edges.

## Build order

`finalize.py` → `p27_assets.py` → stage1 docs/verify → `stage2_enemies.py` → `stage2_boss_build.py` → `stage2_verify.py` → `stage2_delivery.py` → `stage2_boss_delivery.py`. Do not run the baseline stage2 builder after adding boss art unless you rebuild the boss next. No publishing or external notifications were performed.

## Preview paths

- art/stage2/preview.png (overall combined)
- art/stage2/boss/preview.png
- art/stage2/boss/native_scale_preview.png
- art/stage2/boss/sandwhale_all.gif
- art/stage2/boss/sandwhale_phase1.gif
- art/stage2/boss/sandwhale_phase2.gif
- art/stage2/boss/sandwhale_phase3.gif
- art/stage2/boss/echo_pod.gif

## 游戏王 integration fixes (2026-11-11)

| key | file | canvas | anchor | notes |
|---|---|---|---|---|
| sandwhale_portrait (same key, replaced) | `stage2/boss/portraits/sandwhale_portrait.png` | 512×512 | (256,512) | Head close-up: drill maw, red eyes, front dorsal turret; top/right edges clear, bust continues off the left edge ({'top_row_px': 0, 'right_col_px': 0, 'left_col_px': 343}) |
| grenade_target_circle (new) | `stage2/fx/grenade_target_circle_sheet.png` | 256×256 ×8 | (128,128) | True circle r=107.5 px = the ellipse's horizontal radius; same 8 frames / 12 fps / loop / colours. s2_landing_target kept. |
| wall_desert (+ wall_desert_128) | `stage2/walls/wall_desert.png` | 256² / 128² opaque | (0,0) | Seamless sandstone running bond + rusty riveted brackets; game key wall_desert (64×64 logical). Wrap seam/interior ratio 0.914 / 0.747 (≤1 = no visible seam) |
| sw_turret (new) | `stage2/parts/sw_turret.png` | 240×104 | (60,52) | Sandwhale turret placeholder replacement, top-down, barrels right; anchor = game origin (0.25,0.5), aspect = 60×26 |
| sw_core (new) | `stage2/parts/sw_core.png` | 208×208 | (104,104) | Exposed Echo Pod core, game draws 52×52 centred and pulses/tints it |

- Burrow annotation corrected: `sandwhale_burrow.event_frames = {invulnerable:[0..7], invulnerable_from:0}` (game disables the body at burrow start).
- Note: the game only shows boss_turret / sw_turret / sw_core when the body art is missing (real skins hide them; the P3 sw_core image is shown only for the placeholder body). Art is delivered so the fallbacks are no longer code placeholders. There is no separate Anvil "core" key in game code; the core art delivered is the Sandwhale sw_core.
- Verify: `art_src/intro_fixes_verify.py` (also checks these) + stage2_verify.py. Preview: `stage2/fixes_preview.png`. Built by `art_src/fixes_build.py` (run after stage2_boss_build.py). After art changes the game's downscaled web copies need `tools/build_web_art.py` (not run; game files untouched).

// 《弹壳轮回》 game data — every tunable number lives here.
window.DK = window.DK || {};
(function (DK) {
  DK.VERSION = '0.1.0-stage1';
  DK.W = 960; DK.H = 540;           // logical play-field size (one room = one screen)
  DK.M = 32;                        // 1 meter (design doc) = 32 logical px
  DK.R = Math.min(window.devicePixelRatio || 1, 2); // render scale for crisp text on retina
  DK.FONT = '-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif';
  DK.WALL = 28;                     // arena wall thickness

  // ---- paths (relative to game/index.html). Missing files fall back to placeholders.
  DK.PATHS = { art: '../art/', artWebDir: 'assets/art_web/', audio: '../audio/', story: '../story/story.json' };

  // ---- touch controls (logical px; iPhone landscape ≈ 1.4 logical px per pt). Buttons are laid out in run.js / base.js.
  DK.TOUCH = { stickR: 95, knobR: 40, hitPad: 8, fireAimDead: 18, aimDead: 16, fullAt: 0.75, fireAssist: 620, ghost: [150, 150] };

  // ---- player (马克中士)
  DK.PLAYER = {
    hp: 100, speed: 215, radius: 13,
    dashSpeed: 640, dashTime: 0.17, dashCd: 0.75, dashCharges: 1, dashGrace: 0.07, // 70 ms i-frame grace after a dash (review P2-9)
    hurtIframes: 0.6, grenades: 3,
    passiveMul: 1.5,               // 马克被动：换弹后下一发 +50%
    critMul: 2.0
  };
  DK.GRENADE = { range: 280, radius: 72, dmg: 45, selfDmg: 10, flight: 0.55 };

  // ---- weapons (design doc: dmg / shots per sec / magazine)
  DK.WEAPONS = {
    pistol: { name: '手枪', dmg: 10, rate: 4, mag: 12, reload: 1.1, spread: 1.5, crit: 0.10, procMul: 1.5, speed: 760, sfx: 'shoot_pistol', art: 'gun_pistol', bullet: 9 },
    mg:     { name: '机枪', dmg: 6, rate: 10, mag: 40, reload: 1.6, spread: 8,   crit: 0.0,  procMul: 0.5, speed: 800, sfx: 'shoot_mg',     art: 'gun_mg',     bullet: 7 }
  };
  // Design doc: "触发率乘武器系数：机枪 0.5，手枪 1.5". Set false to use raw 30%/35%.
  DK.USE_PROC_MUL = false; // BRIEF.md is the authority: burn 30% / freeze 35% flat for every weapon (design doc's ×1.5 pistol / ×0.5 MG is off)

  // ---- ammo types (弹种)
  DK.AMMO = {
    burn:   { name: '燃烧弹', chance: 0.30, dps: 4, dur: 3, maxStacks: 3, color: 0xff7a1a },
    freeze: { name: '冰冻弹', chance: 0.35, slowPer: 0.15, stacks: 4, freezeDur: 1.5, immune: 4, color: 0x6fd6ff },
    split:  { name: '分裂弹', count: 3, ratio: 0.35, fan: 28, color: 0xe6e05a }
  };
  DK.STEAM = { radius: 2.5 * 32, dmg: 30, knock: 280 }; // 蒸汽爆炸 = 燃烧 + 冰冻

  // ---- enemies
  DK.ENEMIES = {
    charger: { name: '冲锋兵', hp: 30,  speed: 150, radius: 14, contact: 0,  fuse: 0.45, boomDmg: 15, boomRadius: 58, scrap: 1 },
    rifle:   { name: '步枪兵', hp: 40,  speed: 85,  radius: 14, contact: 8,  range: [200, 320], burst: 3, burstGap: 0.12, cd: 2.2, dmg: 5, bulletSpeed: 300, scrap: 1 },
    sniper:  { name: '狙击手', hp: 35,  speed: 70,  radius: 13, contact: 8,  aim: 1.5, lockAt: 1.15, cd: 1.3, dmg: 20, bulletSpeed: 950, scrap: 2 },
    heavy:   { name: '重装兵', hp: 100, speed: 55,  radius: 20, contact: 12, shieldArc: 45, turn: 70, cd: 3.0, dmg: 6, bulletSpeed: 220, scrap: 4 }
  };
  DK.BARREL = { hp: 20, radius: 82, dmg: 35 };

  // ---- boss 铁砧
  DK.BOSS = {
    name: '铁砧', hp: 1500, phase2At: 1000, phase3At: 500, contact: 20, radius: 58,
    cannonDmg: 22, cannonSpeed: 620, cannonTele: 0.9,
    mgDmg: 5, mgSpeed: 300,
    mineDmg: 20, mineMax: 8, minionMax: 4,
    ringDmg: 8, ringSpeed: 135, ringCount: 26, ringGap: 4, ringEvery: 0.95,
    phaseInvuln: 1.6,
    // sprite top ≈ y − 162 (640x512 frame × 0.45, feet anchor): keep y ≥ minY so the tank + barrage smoke stay under the HUD
    dpsSoftCap: 30, overCapMul: 0.2, // see Boss.softCap (review P2-2: MG+burn was under the 60 s floor)
    homeY: 195, minY: 178, p3X: 480, p3Y: 215, p2MinY: 205
  };

  // ---- meta progression (改装台：装甲 +10 血)
  DK.ARMOR = { hpPer: 10, prices: [20, 40, 80, 150, 250] };
  DK.DEATH_KEEP = 0.7;   // 死亡保留 70% 本轮废铁
  DK.WIN_BONUS = 50;

  // ---- rooms: 3 combat + hostage + merchant/rest, then boss
  DK.ROOMS = [
    { type: 'combat',  name: '前线壕沟', waves: [{ charger: 3, rifle: 1 }, { charger: 2, rifle: 2 }] },
    { type: 'combat',  name: '弹坑地带', waves: [{ rifle: 2, sniper: 1, charger: 2 }, { heavy: 1, charger: 3 }] },
    { type: 'hostage', name: '俘虏营',   waves: [{ rifle: 2, charger: 2, sniper: 1 }, { heavy: 1, rifle: 2 }] },
    { type: 'combat',  name: '雷区边缘', waves: [{ heavy: 1, sniper: 2, rifle: 1 }, { charger: 4, heavy: 1, rifle: 2 }] },
    { type: 'shop',    name: '军火商 / 休息站' },
    { type: 'boss',    name: '铁砧' }
  ];
  DK.ROOM_SCRAP = 10;      // 每清一个房间
  DK.HOSTAGE_SCRAP = 15;

  // ---- reward pool (房间清完三选一)
  DK.REWARDS = [
    { id: 'ammo_burn',   name: '燃烧弹',   icon: 'icon_burn',    desc: '30%×武器系数 点燃\n每秒4伤，持续3秒，最多3层', can: r => !r.ammoTypes.includes('burn') },
    { id: 'ammo_freeze', name: '冰冻弹',   icon: 'icon_freeze',  desc: '35%×武器系数 叠冰\n每层减速15%，4层冻结1.5秒', can: r => !r.ammoTypes.includes('freeze') },
    { id: 'ammo_split',  name: '分裂弹',   icon: 'icon_split',   desc: '命中后裂成3颗\n各35%伤害', can: r => !r.ammoTypes.includes('split') },
    { id: 'weapon_mg',   name: '机枪',     icon: 'icon_mg',      desc: '6伤 10发/秒 弹匣40\n按 1/2 或滚轮切换', can: r => !r.weapons.includes('mg') },
    { id: 'mod_bigcal',  name: '大口径',   icon: 'icon_mod',     desc: '伤害 +40%\n射速 -25%', can: r => !r.mods.bigcal },
    { id: 'mod_fifth',   name: '第五发',   icon: 'icon_mod',     desc: '每第5发子弹\n必定暴击', can: r => !r.mods.fifth },
    { id: 'mod_recycle', name: '弹壳回收', icon: 'icon_mod',     desc: '击杀返还2发\n弹匣 -20%', can: r => !r.mods.recycle },
    { id: 'mod_frenzy',  name: '狂热扳机', icon: 'icon_mod',     desc: '连续射击3秒后\n射速 +50%', can: r => !r.mods.frenzy },
    { id: 'mod_ring',    name: '换弹爆环', icon: 'icon_mod',     desc: '换弹时向四周射出8发\n换弹 +0.3秒', can: r => !r.mods.ring },
    { id: 'hp_up',       name: '战地装甲', icon: 'icon_armor',   desc: '最大生命 +20\n并回复20', can: r => true },
    { id: 'heal',        name: '急救包',   icon: 'icon_heal',    desc: '回复 50% 生命', can: r => r.hp < r.maxHp },
    { id: 'grenade',     name: '手雷补给', icon: 'icon_grenade', desc: '手雷 +2', can: r => true },
    { id: 'dash',        name: '冲刺推进器', icon: 'icon_dash',  desc: '冲刺次数 +1', can: r => r.dashCharges < 3 },
    { id: 'dmg_up',      name: '火力强化', icon: 'icon_mod',     desc: '所有伤害 +15%', can: r => (r.dmgUps || 0) < 3 }
  ];

  // ---- art: logical display sizes (gameplay size, independent of image resolution).
  // Override per asset in art/manifest.json:  { "player": { "file": "mark.png", "size": [48,48] } }
  DK.ART = {
    player:        { size: [46, 46], flip: true },
    gun_pistol:    { size: [26, 10] },
    gun_mg:        { size: [38, 12] },
    enemy_charger: { size: [36, 36], flip: true },
    enemy_rifle:   { size: [38, 38], flip: true },
    enemy_sniper:  { size: [36, 36], flip: true },
    enemy_heavy:   { size: [52, 52], flip: true },
    shield:        { size: [14, 50] },
    enemy_gun:     { size: [24, 8] },
    boss_anvil:    { size: [170, 130] },
    boss_turret:   { size: [110, 44] },
    bullet_player: { size: [16, 8] },
    bullet_fire:   { size: [18, 12] },
    bullet_ice:    { size: [16, 12] },
    bullet_split:  { size: [18, 14] },
    bullet_enemy:  { size: [14, 10] },
    bullet_boss:   { size: [16, 12] },
    ring_bullet:   { size: [12, 12] },  // code-drawn phase-3 ring bullet (high contrast)
    shell_cannon:  { size: [34, 17] },
    grenade:       { size: [14, 16] },
    mine:          { size: [26, 23] },
    explosion:     { size: [128, 128] },
    muzzle:        { size: [32, 24] },
    spark:         { size: [26, 26] },
    casing:        { size: [7, 5] },
    floor:         { size: [128, 128] },
    floor_base:    { size: [128, 128] },
    floor_boss:    { size: [128, 128] },
    floor_shop:    { size: [128, 128], fallback: 'floor_base' },
    wall:          { size: [64, 64] },
    cover:         { size: [64, 40] },
    barrel:        { size: [30, 34] },
    door:          { size: [28, 100] },
    hostage:       { size: [36, 36] },
    npc_laoqiang:  { size: [46, 46] },
    npc_lingjian:  { size: [40, 44] },
    npc_merchant:  { size: [44, 44] },
    echo_pod:      { size: [70, 90] },
    workbench:     { size: [80, 46] },
    campfire:      { size: [40, 40] },
    icon_burn:     { size: [44, 44] }, icon_freeze: { size: [44, 44] }, icon_split: { size: [44, 44] },
    icon_mg:       { size: [44, 44] }, icon_mod:    { size: [44, 44] }, icon_armor: { size: [44, 44] },
    icon_heal:     { size: [44, 44] }, icon_grenade:{ size: [44, 44] }, icon_dash:  { size: [44, 44] },
    icon_scrap:    { size: [22, 22] }, icon_hp:     { size: [22, 22] },
    portrait_mark: { size: [96, 96] }, portrait_laoqiang: { size: [96, 96] }, portrait_lingjian: { size: [96, 96] },
    portrait_anvil:{ size: [96, 96] }, portrait_system: { size: [96, 96] }
  };

  // Game key -> art-team asset name (art/manifest.json). The placeholder stays as the fallback.
  DK.ART_ALIAS = {
    bullet_boss: 'bullet_enemy', shell_cannon: 'shell_boss', mine: 'landmine', casing: 'shell_casing',
    muzzle: 'fx_muzzle_flash', explosion: 'fx_explosion', spark: 'fx_impact_spark',
    floor: 'tile_ground_dirt_256', floor_base: 'tile_ground_concrete_256', floor_boss: 'tile_ground_concrete_256', floor_shop: 'tile_ground_concrete_256',
    icon_burn: 'icon_ammo_fire', icon_freeze: 'icon_ammo_ice', icon_split: 'icon_ammo_split', icon_mg: 'icon_weapon_mg',
    icon_mod: 'icon_chip', icon_heal: 'icon_medkit', icon_hp: 'icon_health'
  };
  // Origins for single images whose art anchor is not the centre (muzzle flash anchors at the muzzle).
  DK.ART.muzzle.origin = [4 / 128, 0.5];
  DK.ART.bullet_fire.fallback = 'bullet_player'; DK.ART.bullet_ice.fallback = 'bullet_player'; DK.ART.bullet_split.fallback = 'bullet_player';
  // Cover props (art key -> logical display scale of the original px, footprint hitbox [w,h] in logical px)
  DK.COVERS = {
    cover_sandbags:          { scale: 0.42, hit: [80, 30], hp: 0 },
    cover_concrete_barrier:  { scale: 0.42, hit: [56, 30], hp: 0 },
    cover_brick_wall_broken: { scale: 0.42, hit: [60, 30], hp: 0 },
    cover_crate_wood:        { scale: 0.42, hit: [44, 30], hp: 60, debris: 'debris_crate_broken' },
    cover_crate_ammo:        { scale: 0.42, hit: [44, 28], hp: 0 },
    obstacle_tank_hedgehog:  { scale: 0.42, hit: [42, 24], hp: 0 },
    obstacle_tires:          { scale: 0.42, hit: [28, 26], hp: 0 }
  };
  DK.BARREL_ART = { scale: 0.22 }; // barrel sheet: 0 intact, 1 damaged, 2 about to blow, 3-7 explosion
  // Animated characters. scale = logical px per ORIGINAL art px (320px frames, hero ≈200px tall -> ≈66px).
  // lift = logical px from the feet anchor up to the gameplay centre (where the hitbox sits).
  // NPC / hub entries load automatically when the art team adds <name> sheets to the manifest.
  DK.SKINS = {
    player:        { scale: 0.33, lift: 22, anims: { idle: 'hero_idle', run: 'hero_run', shoot: 'hero_shoot', shoot_mg: 'hero_shoot_mg', reload: 'hero_reload', dash: 'hero_dash', throw: 'hero_throw', hurt: 'hero_hurt', death: 'hero_death' } },
    enemy_charger: { scale: 0.32, lift: 20, anims: { move: 'charger_move', attack: 'charger_attack', hurt: 'charger_hurt', death: 'charger_death' } },
    enemy_rifle:   { scale: 0.33, lift: 22, anims: { move: 'rifleman_move', attack: 'rifleman_attack', hurt: 'rifleman_hurt', death: 'rifleman_death' } },
    enemy_sniper:  { scale: 0.33, lift: 22, anims: { move: 'sniper_move', attack: 'sniper_attack', hurt: 'sniper_hurt', death: 'sniper_death' } },
    enemy_heavy:   { scale: 0.34, lift: 26, anims: { move: 'heavy_move', attack: 'heavy_attack', hurt: 'heavy_hurt', death: 'heavy_death' } },
    hostage:       { scale: 0.33, lift: 18, anims: { idle: 'hostage_tied', freed: 'hostage_freed' } },
    boss_anvil:    { scale: 0.45, lift: 58, anims: { move: 'boss_move', cannon: 'boss_cannon', mg: 'boss_mg', deploy: 'boss_deploy', barrage: 'boss_barrage', damaged: 'boss_damaged', destroy: 'boss_destroy' } },
    npc_laoqiang:  { scale: 0.33, lift: 30, anims: { idle: 'laoqiang_idle', talk: 'laoqiang_talk' } },
    npc_lingjian:  { scale: 0.33, lift: 30, anims: { idle: 'lingjian_idle', talk: 'lingjian_talk' } },
    npc_lingjian_dock: { scale: 0.52, lift: 30, anims: { idle: 'lingjian_idle', talk: 'lingjian_talk' } },
    npc_merchant:  { scale: 0.36, lift: 30, anims: { idle: 'merchant_idle' } }
  };

  // Dialogue portraits: [art asset, frame, scale of original px]. An asset named portrait_<speaker> wins if the art team adds one.
  // The first entry whose art exists is used; '<speaker>_portrait' busts (512px, bottom anchor) come from the art team.
  DK.PORTRAIT_ART = { mark: [['mark_portrait', 0, 0.22], ['hero_idle', 0, 0.55]], anvil: [['anvil_portrait', 0, 0.22], ['boss_move', 0, 0.3]],
    hostage: [['hostage_portrait', 0, 0.22], ['hostage_freed', 1, 0.55]],
    laoqiang: [['laoqiang_portrait', 0, 0.22], ['laoqiang_idle', 0, 0.55]], lingjian: [['lingjian_portrait', 0, 0.22], ['lingjian_idle', 0, 0.55]],
    merchant: [['merchant_portrait', 0, 0.22], ['merchant_idle', 0, 0.55]] };
  // 铁皮屋 hub layout for art/scenes/base_tinshack_bg.png (1920x1080 painted room, shown at 960x540).
  // Rects are [x, y, w, h] in logical px, measured off the painting.
  DK.TINSHACK = {
    walls: [[0, 0, 960, 118], [0, 0, 34, 540], [906, 0, 54, 540], [0, 522, 960, 18],
      [96, 110, 114, 84], [246, 110, 258, 72], [528, 110, 70, 66], [627, 110, 182, 54], [748, 150, 160, 140], [700, 248, 165, 52],
      [0, 188, 106, 136], [34, 300, 196, 200], [574, 362, 386, 178]],
    door: { x0: 615, x1: 885, y: 342 },          // walk onto the garage door's front edge to sortie
    start: [300, 300],
    npcs: { laoqiang: { x: 718, feet: 214, flip: true }, lingjian: { x: 562, feet: 179, skin: 'npc_lingjian_dock', flip: false } },
    labels: [['回响舱', 153, 206, '#6fd6ff'], ['改装台', 375, 196, '#cfcfcf'], ['出击 ⬇', 750, 322, '#7ee07a']]
  };
  // The art manifest's hotspots (1920x1080 px) are authoritative; the table above is the fallback.
  DK.MERCHANT_STALL_SCALE = 0.45; // stall 238x304 → ~107x137 logical px
  DK.tinshackLayout = function () {
    const L = JSON.parse(JSON.stringify(DK.TINSHACK)), a = DK.ARTX && DK.ARTX.base_tinshack_bg, h = a && a.hotspots;
    if (!h) return L;
    const k = DK.W / ((a.src_frame_size || a.frame_size || [1920])[0] / (a.res_scale || 1)), P = v => [v[0] * k, v[1] * k];
    if (h.player_spawn) L.start = P(h.player_spawn);
    if (h.lingjian_bench_upgrade) { const [x, y] = P(h.lingjian_bench_upgrade); Object.assign(L.npcs.lingjian, { x, feet: y - 16 }); }
    if (h.laoqiang_counter_weapons) { const [x, y] = P(h.laoqiang_counter_weapons); Object.assign(L.npcs.laoqiang, { x, feet: y + 10 }); }
    if (h.sortie_door_exit) { const [x, y] = P(h.sortie_door_exit); L.door = { x0: x - 135, x1: x + 128, y: y - 8 }; L.labels[2] = ['出击 ⬇', x, y - 28, '#7ee07a']; }
    if (h.echo_pod_respawn) { const [x, y] = P(h.echo_pod_respawn); L.labels[0] = ['回响舱', x, y - 4, '#6fd6ff']; }
    if (h.walkable_floor_rect) { // outer walls from the walkable rect (props keep their own rects)
      const [x0, y0, x1, y1] = h.walkable_floor_rect.map(v => v * k);
      L.walls.splice(0, 4, [0, 0, DK.W, y0 - 6], [0, 0, Math.max(30, x0 - 80), DK.H], [x1, 0, DK.W - x1, DK.H], [0, y1, DK.W, DK.H - y1]);
    }
    return L;
  };

  DK.SPEAKERS = {
    mark: { name: '马克中士', color: '#7ee07a' }, laoqiang: { name: '老枪', color: '#f2c14e' },
    lingjian: { name: '零件', color: '#6fd6ff' }, anvil: { name: '铁砧', color: '#ff5a4e' },
    system: { name: '', color: '#cfcfcf' }, hostage: { name: '人质', color: '#e0e0e0' }, merchant: { name: '军火商', color: '#d9a7ff' }
  };
})(window.DK);

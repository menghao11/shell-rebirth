// 第二关 · 沙海 (desert): stage plumbing, growth scaling, desert arena/props/wind, placeholders, and the three
// 沙蝎军团 enemies — 骆驼骑兵 camel (+ dismounted camel_rider), 跳兵 jumper, 掷弹兵 grenadier (enemy grenades).
// Every number lives in DK.STAGE2 (data.js). Real art drops into art/stage2/manifest.json under the names in DK.SKINS / DK.ART.
(function (DK) {
  const S2 = DK.STAGE2, PI2 = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
  Object.assign(DK.ENEMIES, S2.enemies); // spawnEnemy / spawnWithTelegraph read DK.ENEMIES[type]

  // ------------------------------------------------------------ stage plumbing
  DK.roomsFor = run => (run && run.stage === 2 ? S2.rooms : DK.ROOMS);
  DK.stageOf = scene => (scene && scene.run && !scene.tutorial && scene.run.stage === 2 ? 2 : 1);

  // ------------------------------------------------------------ growth scaling (enemy HP follows ~65 % of the player's power)
  DK.playerGrowth = function (run) {
    if (!run) return 1;
    const G = S2.growth, m = run.mods || {};
    let best = 0;
    for (const id of run.weapons || ['pistol']) {
      const w = DK.WEAPONS[id]; if (!w) continue;
      let dmg = w.dmg, rate = w.rate, crit = w.crit;
      if (m.bigcal) { dmg *= 1.4; rate *= 0.75; }
      if (m.frenzy) rate *= 1.3;          // +50 % after 3 s of fire, averaged
      if (m.fifth) crit = Math.min(1, crit + 0.2);
      best = Math.max(best, dmg * rate * (1 + crit * (DK.PLAYER.critMul - 1)));
    }
    let dps = best * (run.dmgMul || 1);
    let ammo = 1; for (const a of run.ammoTypes || []) ammo += G.ammoBonus[a] || 0;
    dps = dps * ammo + (m.ring ? G.ringDps : 0);
    return Math.min(G.cap, Math.max(1, dps / G.baseDps));
  };
  DK.enemyHpMul = function (scene) {
    if (DK.stageOf(scene) !== 2) return 1;
    return 1 + S2.growth.ratio * (DK.playerGrowth(scene.run) - 1);
  };

  // ------------------------------------------------------------ placeholders (only drawn when no art/stage2 file exists)
  const P = DK.PLACEHOLDERS;
  const sand = (base, dark, light, seed) => (g, W, H, q) => {
    g.fillStyle(base).fillRect(0, 0, W, H);
    for (let i = 0; i < 22; i++) { const x = ((i * 47 + seed * 13) % 97) / 97 * W, y = ((i * 71 + seed * 29) % 89) / 89 * H; g.fillStyle(i % 3 ? dark : light, 0.55).fillCircle(x, y, (1 + (i % 3)) * q); }
    g.lineStyle(1.2 * q, dark, 0.35); for (let i = 0; i < 3; i++) { const y = H * (0.2 + i * 0.3 + seed * 0.03); g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += W / 8) g.lineTo(x, y + Math.sin(x / W * PI2 + seed) * 4 * q); g.strokePath(); }
  };
  Object.assign(P, {
    floor_sand: sand(0xc9a96b, 0xb08e52, 0xe0c58a, 0),
    floor_sand_b: sand(0xc4a264, 0xa8864a, 0xdcbf84, 1),
    floor_sand_c: sand(0xceb072, 0xb39255, 0xe4cb92, 2),
    floor_sand_d: (g, W, H, q) => { sand(0xc7a668, 0xab8a4e, 0xdfc388, 3)(g, W, H, q); g.fillStyle(0x8f7a55, 0.6).fillCircle(W * .3, H * .6, 5 * q).fillCircle(W * .36, H * .64, 3 * q).fillCircle(W * .72, H * .3, 4 * q); }, // pebbles
    wall_desert: (g, W, H, q) => { g.fillStyle(0x8a6a3e).fillRect(0, 0, W, H); g.lineStyle(2 * q, 0x6b5030); for (let y = 0; y < H; y += H / 4) g.lineBetween(0, y, W, y); g.fillStyle(0xa8834e); for (let i = 0; i < 6; i++) g.fillRect((i * 23 % 57) / 57 * W, (i * 31 % 41) / 41 * H, 6 * q, 3 * q); },
    sand_mote: (g, W, H) => { g.fillStyle(0xf0dca8).fillEllipse(W / 2, H / 2, W, H); },
    prop_dune: (g, W, H, q) => { g.fillStyle(0xb8975a, 0.9).fillEllipse(W / 2, H * .62, W, H * .76); g.fillStyle(0xd8bb7e, 0.9).fillEllipse(W * .44, H * .52, W * .74, H * .5); g.lineStyle(1.5 * q, 0x9c7c45, .6).beginPath().arc(W * .5, H * 1.2, W * .45, -2.4, -0.8).strokePath(); },
    prop_cactus: (g, W, H, q) => { g.fillStyle(0x000000, .2).fillEllipse(W / 2, H * .94, W * .9, H * .12); g.fillStyle(0x4f8a3a).fillRoundedRect(W * .36, H * .08, W * .28, H * .86, 6 * q).fillRoundedRect(W * .06, H * .3, W * .22, H * .3, 5 * q).fillRoundedRect(W * .72, H * .2, W * .22, H * .3, 5 * q); g.fillStyle(0x4f8a3a).fillRect(W * .2, H * .5, W * .2, H * .1).fillRect(W * .6, H * .42, W * .2, H * .1); g.lineStyle(1.2 * q, 0x2f5a22).strokeRoundedRect(W * .36, H * .08, W * .28, H * .86, 6 * q); },
    prop_bones: (g, W, H, q) => { g.fillStyle(0xeee4cc); g.fillEllipse(W * .25, H * .5, W * .36, H * .5); g.fillRect(W * .4, H * .42, W * .5, H * .14); for (let i = 0; i < 4; i++) g.fillRect(W * (.48 + i * .11), H * .18, W * .04, H * .66); g.fillStyle(0x6a5a40).fillCircle(W * .2, H * .44, 2 * q).fillCircle(W * .3, H * .44, 2 * q); },
    prop_oiltank: (g, W, H, q) => { g.fillStyle(0x000000, .25).fillEllipse(W / 2, H * .9, W, H * .2); g.fillStyle(0x7a4a2a).fillRoundedRect(W * .04, H * .2, W * .92, H * .7, 10 * q); g.fillStyle(0x5c3620).fillRect(W * .04, H * .42, W * .92, H * .06).fillRect(W * .04, H * .66, W * .92, H * .06); g.fillStyle(0x8f5c34).fillEllipse(W / 2, H * .22, W * .92, H * .22); g.fillStyle(0xffd23f).fillTriangle(W * .5, H * .44, W * .4, H * .62, W * .6, H * .62); g.lineStyle(1.5 * q, 0x2a160a).strokeRoundedRect(W * .04, H * .2, W * .92, H * .7, 10 * q); },
    prop_tent: (g, W, H, q) => { g.fillStyle(0x000000, .25).fillEllipse(W / 2, H * .93, W, H * .14); g.fillStyle(0x9a7b4f).fillTriangle(W * .02, H * .92, W * .5, H * .08, W * .98, H * .92); g.fillStyle(0x7d6240).fillTriangle(W * .38, H * .92, W * .5, H * .4, W * .62, H * .92); g.lineStyle(2 * q, 0x4a3a22).lineBetween(W * .5, H * .02, W * .5, H * .4); g.fillStyle(0xc0392b).fillTriangle(W * .5, H * .02, W * .66, H * .08, W * .5, H * .14); },
    enemy_camel: (g, W, H, q) => { // camel (side view) + rider
      g.fillStyle(0x000000, .2).fillEllipse(W / 2, H * .94, W * .8, H * .1);
      g.fillStyle(0xb88a50); g.fillEllipse(W * .48, H * .55, W * .62, H * .34); g.fillEllipse(W * .4, H * .38, W * .2, H * .16);
      g.fillRect(W * .2, H * .64, W * .07, H * .3).fillRect(W * .32, H * .64, W * .07, H * .3).fillRect(W * .58, H * .64, W * .07, H * .3).fillRect(W * .7, H * .64, W * .07, H * .3);
      g.fillRect(W * .76, H * .28, W * .08, H * .32); g.fillEllipse(W * .86, H * .26, W * .18, H * .13);
      g.fillStyle(0x3a2a1a).fillCircle(W * .9, H * .24, 1.6 * q);
      g.fillStyle(0x5a2a2a).fillRoundedRect(W * .4, H * .06, W * .14, H * .28, 3 * q); g.fillStyle(0xd9b38c).fillCircle(W * .47, H * .07, W * .06); g.fillStyle(0xc0392b).fillRect(W * .41, H * .02, W * .12, H * .05);
    },
    enemy_camel_rider: (g, W, H, q) => { g.fillStyle(0x000000, .2).fillEllipse(W / 2, H * .9, W * .7, H * .14); g.fillStyle(0x5a2a2a).fillRoundedRect(W * .28, H * .3, W * .44, H * .5, 5 * q); g.fillStyle(0xd9b38c).fillCircle(W * .5, H * .22, W * .17); g.fillStyle(0xc0392b).fillRect(W * .3, H * .06, W * .4, H * .1); g.fillStyle(0x3a2a1a).fillRect(W * .32, H * .8, W * .12, H * .14).fillRect(W * .56, H * .8, W * .12, H * .14); },
    enemy_jumper: (g, W, H, q) => { g.fillStyle(0x000000, .2).fillEllipse(W / 2, H * .9, W * .7, H * .14); g.fillStyle(0xd0a040).fillRoundedRect(W * .3, H * .32, W * .4, H * .42, 5 * q); g.fillStyle(0xd9b38c).fillCircle(W * .5, H * .22, W * .15); g.fillStyle(0x222).fillRect(W * .36, H * .18, W * .28, H * .07); g.fillStyle(0x3a2a1a).fillRect(W * .26, H * .72, W * .16, H * .2).fillRect(W * .58, H * .72, W * .16, H * .2); g.fillStyle(0xffd23f).fillTriangle(W * .14, H * .5, W * .3, H * .38, W * .3, H * .62); },
    enemy_grenadier: (g, W, H, q) => { g.fillStyle(0x000000, .2).fillEllipse(W / 2, H * .9, W * .74, H * .14); g.fillStyle(0x7a6a3a).fillRoundedRect(W * .24, H * .3, W * .52, H * .5, 6 * q); g.fillStyle(0xd9b38c).fillCircle(W * .5, H * .2, W * .15); g.fillStyle(0x3f5a2a); for (let i = 0; i < 3; i++) g.fillCircle(W * (.34 + i * .16), H * .56, W * .06); g.fillStyle(0x3a2a1a).fillRect(W * .3, H * .8, W * .14, H * .14).fillRect(W * .56, H * .8, W * .14, H * .14); },
    enemy_grenade: (g, W, H, q) => { g.fillStyle(0x6b2a20).fillCircle(W / 2, H / 2, W * .45); g.lineStyle(1.2 * q, 0x111).strokeCircle(W / 2, H / 2, W * .45); g.fillStyle(0xffd23f).fillRect(W * .42, 0, W * .16, H * .3); },
    boss_sandwhale: (g, W, H, q) => {
      g.fillStyle(0x000000, .25).fillEllipse(W / 2, H * .9, W * .9, H * .16);
      g.fillStyle(0x9c7a4a).fillEllipse(W * .5, H * .55, W * .92, H * .66); g.fillStyle(0xb8955e).fillEllipse(W * .5, H * .45, W * .78, H * .4);
      g.fillStyle(0x7a5a34); for (let i = 0; i < 5; i++) g.fillRoundedRect(W * (.2 + i * .12), H * .26, W * .08, H * .08, 3 * q); // armour plates
      g.fillStyle(0x3a2412).fillEllipse(W * .9, H * .6, W * .14, H * .26); g.fillStyle(0xeee4cc); for (let i = 0; i < 4; i++) g.fillTriangle(W * .85, H * (.5 + i * .06), W * .9, H * (.52 + i * .06), W * .85, H * (.54 + i * .06)); // maw
      g.fillStyle(0x222).fillCircle(W * .78, H * .42, 3 * q); g.fillStyle(0xff3030).fillCircle(W * .78, H * .42, 1.5 * q);
      g.fillStyle(0x5a6b3a).fillRoundedRect(W * .4, H * .1, W * .16, H * .16, 4 * q); g.fillStyle(0x222).fillRect(W * .5, H * .15, W * .12, H * .05); // back turret
      g.lineStyle(2 * q, 0x4a321a).strokeEllipse(W * .5, H * .55, W * .92, H * .66);
    },
    sw_core: (g, W, H, q) => { g.fillStyle(0x2a1a10).fillCircle(W / 2, H / 2, W * .5); g.fillStyle(0xff8a2a).fillCircle(W / 2, H / 2, W * .38); g.fillStyle(0xfff0b0).fillCircle(W / 2, H / 2, W * .18); g.lineStyle(2 * q, 0x6fd6ff).strokeCircle(W / 2, H / 2, W * .44); },
    sw_turret: (g, W, H, q) => { g.fillStyle(0x5a6b3a).fillRoundedRect(0, H * .2, W * .5, H * .6, 4 * q); g.fillStyle(0x222).fillRect(W * .45, H * .38, W * .55, H * .24); },
    portrait_boss: (g, W, H, q) => { g.fillStyle(0x1e1e22).fillRoundedRect(0, 0, W, H, 10 * q); P.boss_sandwhale(g, W, H, q); }
  });
  DK.ART.portrait_boss = DK.ART.portrait_boss || { size: [96, 96] };

  // ------------------------------------------------------------ desert arena
  DK.buildDesert = function (scene, room) {
    return DK.buildArena(scene, { door: room.type !== 'boss', floor: 'floor_sand', floorMix: DK.FLOOR2, floorWeights: [0.4, 0.2, 0.2, 0.2], wall: 'wall_desert', tint: room.type === 'boss' ? 0xf0dcc0 : null });
  };
  // a prop: optional invisible footprint body in scene.covers + a visual anchored bottom-centre at the footprint bottom
  DK.addProp = function (scene, x, y, name) {
    const C = DK.PROPS2[name]; let v;
    const hit = C.hit, footY = hit ? y + hit[1] / 2 : y;
    if (DK.hasArt(name)) { const a = DK.ARTX[name]; v = scene.add.image(x, footY, name).setOrigin(a.anchor[0] / a.frame_size[0], a.anchor[1] / a.frame_size[1]).setScale(C.scale / (a.res_scale || 1)); }
    else { v = scene.add.image(x, footY, C.ph); DK.applyArt(v, C.ph); v.setOrigin(0.5, C.ph === 'cover' ? 0.8 : 0.96); }
    if (!hit) { v.setDepth(-60); return { visual: v, decor: true }; }
    v.setDepth(footY);
    const body = scene.add.rectangle(x, y, hit[0], hit[1], 0, 0); scene.covers.add(body);
    Object.assign(body, { visual: v, kind: name, hp: 0 });
    return body;
  };
  DK.layoutDesert = function (scene, opts) {
    opts = opts || {};
    const W = DK.W, H = DK.H, G = DK.PROPS2_GROUPS, pick = g => Phaser.Utils.Array.GetRandom(G[g]);
    const place = (group, n, pad) => {
      for (let i = 0, t = 0; i < n && t < 90; t++) {
        const name = pick(group), C = DK.PROPS2[name], [w, h] = C.hit || [90, 40];
        const x = Phaser.Math.Between(C.hit ? 200 : 110, W - (C.hit ? 180 : 110)), y = Phaser.Math.Between(C.hit ? 110 : 70, H - (C.hit ? 90 : 50));
        if (C.hit) {
          if (Math.abs(y - H / 2) < 80 && x > W - 260) continue; // door lane
          if (x < 170 && Math.abs(y - H / 2) < 90) continue;      // entry
          if (opts.hostage && Math.hypot(x - W * 0.62, y - H / 2) < 120) continue;
          if (opts.center && Math.hypot(x - W / 2, y - H / 2) < 150) continue;
          if (!scene.rectFree(x, y, w, h, pad)) continue;
        }
        DK.addProp(scene, x, y, name); i++;
      }
    };
    place('dune', 2, 0); place('bones', 2, 0);
    if (opts.boss) { place('cactus', 2, 80); place('rock', 1, 90); return; }
    place('tank', Phaser.Math.Between(1, 2), 60); place('tent', Phaser.Math.Between(0, 1), 70); place('cactus', Phaser.Math.Between(2, 3), 50); place('rock', Phaser.Math.Between(0, 1), 60);
    for (let i = 0, t = 0; i < 1 && t < 60; t++) { const x = Phaser.Math.Between(220, W - 160), y = Phaser.Math.Between(80, H - 80); if (!scene.rectFree(x, y, 30, 34, 50)) continue; scene.addBarrel(x, y); i++; }
  };
  // wind-blown sand: a light constant stream (heavier in the boss's 沙暴 phase)
  DK.desertWind = function (scene) {
    const real = DK.hasArt('s2_sand_streak'), tk = real ? 's2_sand_streak' : 'sand_mote', k = real ? 0.14 : 1; scene.moteK = k; scene.moteTex = tk;
    const em = scene.add.particles(0, 0, tk, {
      x: { min: -40, max: DK.W * 0.7 }, y: { min: -20, max: DK.H + 20 }, lifespan: { min: 2600, max: 4200 },
      speedX: { min: 130, max: 240 }, speedY: { min: 5, max: 45 }, alpha: { start: 0.55, end: 0 }, scale: { min: 0.7 * k, max: 1.6 * k },
      frequency: 70, quantity: 1, maxAliveParticles: 90
    }).setDepth(880);
    scene.windFx = em; scene.stormFx = null;
    if (DK.hasArt('s2_blowing_sand')) { // drifting sand gusts (12-frame sheet)
      scene.time.addEvent({ delay: 2600, loop: true, callback: () => {
        if (scene.isPaused && scene.isPaused()) return;
        const g = scene.add.sprite(Phaser.Math.Between(60, DK.W - 200), Phaser.Math.Between(60, DK.H - 60), 's2_blowing_sand').setDepth(879).setAlpha(0.55).setScale(0.7);
        g.play('s2_blowing_sand'); scene.tweens.add({ targets: g, x: g.x + 120, duration: 1000 }); g.once('animationcomplete', () => g.destroy());
      } });
    }
    return em;
  };
  DK.setSandstorm = function (scene, on) {
    if (on && !scene.stormFx) {
      scene.stormVeil = scene.add.rectangle(DK.W / 2, DK.H / 2, DK.W, DK.H, 0xc9a060, 0).setDepth(890);
      scene.tweens.add({ targets: scene.stormVeil, fillAlpha: S2.boss.stormAlpha, duration: 900 });
      const k = scene.moteK || 1; scene.stormFx = scene.add.particles(0, 0, scene.moteTex || 'sand_mote', { x: { min: -60, max: DK.W }, y: { min: -20, max: DK.H + 20 }, lifespan: { min: 1400, max: 2400 }, speedX: { min: 320, max: 520 }, speedY: { min: 10, max: 80 }, alpha: { start: 0.8, end: 0 }, scale: { min: 1.2 * k, max: 2.6 * k }, frequency: 18, quantity: 2, maxAliveParticles: 160 }).setDepth(891);
    } else if (!on && scene.stormFx) {
      const v = scene.stormVeil; scene.tweens.add({ targets: v, fillAlpha: 0, duration: 700, onComplete: () => v.destroy() });
      scene.stormFx.stop(); const f = scene.stormFx; scene.time.delayedCall(2500, () => f.destroy()); scene.stormFx = null; scene.stormVeil = null;
    }
  };

  // ------------------------------------------------------------ test/debug logs (game time, seconds)
  DK.s2log = { camel: [], jumper: [], grenade: [] };
  const T = scene => scene.gameT || 0;

  // ------------------------------------------------------------ enemy init / AI / fx
  DK.ENEMY_INIT = DK.ENEMY_INIT || {}; DK.ENEMY_AI = DK.ENEMY_AI || {}; DK.ENEMY_FX = DK.ENEMY_FX || {};
  DK.ENEMY_INIT.camel = (s, e) => { e.chargeT = 1.6 + Math.random(); e.groanT = rnd(...e.cfg.groanEvery); e.stepT = 0; e.chargeLog = []; e.gun.setVisible(!e.realSkin); };
  DK.ENEMY_INIT.camel_rider = (s, e) => { e.t = 0.9; };
  DK.ENEMY_INIT.jumper = (s, e) => { e.dodgeCd = e.cfg.dodgeFirst; e.dodges = 0; e.dodged = 0; e.hitsTaken = 0; e.threats = 0; e.dodgeLog = []; e.seen = new WeakSet(); e.airborne = false;
    e.onFrozen = () => { if (e.state === 'jtell' || e.state === 'jump') { e.airborne = false; e.holdFrame = null; e.state = 'move'; e.animOverride = null; e.setScale(e.baseSX || e.scaleX, e.baseSY || e.scaleY); } }; };
  DK.ENEMY_INIT.grenadier = (s, e) => { e.gun.setVisible(false); e.throwT = 1.4 + Math.random() * 0.8; };

  // shared ranged-move helper (keep a ring distance, strafe)
  function ranged(e, a, r0, r1) {
    const { p, dx, dy, dist } = a; let tx = e.x, ty = e.y;
    if (dist > r1) { tx = p.x; ty = p.y; } else if (dist < r0) { tx = e.x - dx; ty = e.y - dy; }
    else { tx = e.x - dy / dist * 60 * e.side; ty = e.y + dx / dist * 60 * e.side; if (Math.random() < 0.005) e.side *= -1; }
    return [tx, ty];
  }
  function burstFire(scene, e, a, dt, src) {
    const c = e.cfg;
    if (e.state === 'move' && e.t <= 0 && a.dist < 520) { e.state = 'tell'; e.t = 0.3; e.flashT = 0.08; }
    else if (e.state === 'tell' && e.t <= 0) { e.state = 'burst'; e.shots = c.burst; e.t = 0; }
    else if (e.state === 'burst' && e.t <= 0) {
      scene.enemyShoot(e.x + Math.cos(a.ang) * 20, e.y + 4 + Math.sin(a.ang) * 20, a.ang + Phaser.Math.FloatBetween(-0.06, 0.06), c.bulletSpeed, c.dmg, src);
      e.shots--; e.t = c.burstGap; if (e.shots <= 0) { e.state = 'move'; e.t = c.cd + Math.random() * 0.6; }
    }
    if (e.state === 'tell') e.atkFrame = e.t > 0.15 ? 0 : 1; else if (e.state === 'burst') e.atkFrame = 2;
  }

  // ---- 骆驼骑兵: shoots while mounted; telegraphed charge (red lane ≥ 500 ms) that rams once; on death the rider dismounts
  DK.ENEMY_AI.camel = function (scene, e, dt, a) {
    const c = e.cfg, { p, dist, ang, sp, steer } = a;
    e.chargeT -= dt * a.slow; e.groanT -= dt;
    if (e.groanT <= 0 && e.state !== 'charge') { e.groanT = rnd(...c.groanEvery); DK.sfx(scene, 's2_camel_groan_1', { minGap: 400 }); }
    if (e.state === 'ctell') {
      e.setVelocity(0); e.tellT -= dt; e.animOverride = 'charge'; e.atkFrame = 0;
      if (e.tellT <= 0) { e.state = 'charge'; e.chargeLeft = c.chargeTime; e.hitDone = false; e.contactDmgNow = c.chargeDmg; e.stepT = 0; e.chargeLog[e.chargeLog.length - 1].chargeAt = T(scene); }
      return;
    }
    if (e.state === 'charge') {
      e.chargeLeft -= dt; e.stepT -= dt; e.animOverride = 'charge';
      if (e.stepT <= 0) { e.stepT = 0.33; DK.sfx(scene, 's2_camel_step_2', { minGap: 200 }); } // gallop, every 0.33 s
      e.setVelocity(Math.cos(e.chargeAng) * c.chargeSpeed, Math.sin(e.chargeAng) * c.chargeSpeed);
      if (e.flipX !== (Math.cos(e.chargeAng) < 0)) e.setFlipX(Math.cos(e.chargeAng) < 0);
      const b = e.body, hitWall = b.blocked.left || b.blocked.right || b.blocked.up || b.blocked.down || b.touching.left || b.touching.right || b.touching.up || b.touching.down;
      if (e.chargeLeft <= 0 || (hitWall && e.chargeLeft < c.chargeTime - 0.08) || e.hitDone) {
        e.state = 'stun'; e.stunLeft = hitWall ? c.stunT : c.stunT * 0.5; e.contactDmgNow = 0; e.setVelocity(0);
        if (hitWall) { scene.cameras.main.shake(120, 0.005); scene.spark(e.x + Math.cos(e.chargeAng) * 26, e.y + Math.sin(e.chargeAng) * 20, 0xc89a5a, 6); }
      }
      return;
    }
    if (e.state === 'stun') { e.setVelocity(0); e.stunLeft -= dt; e.animOverride = null; if (e.stunLeft <= 0) { e.state = 'move'; e.t = 0.8; e.chargeT = c.chargeCd + Math.random(); } return; }
    e.animOverride = null;
    if (e.chargeT <= 0 && dist < c.chargeRange && dist > 90 && e.state === 'move') {
      e.state = 'ctell'; e.tellT = c.chargeTell; e.chargeAng = ang; e.flashT = 0.1;
      e.chargeLog.push({ tellAt: T(scene), chargeAt: null }); DK.s2log.camel.push(e.chargeLog[e.chargeLog.length - 1]);
      DK.sfx(scene, 's2_camel_groan_2', { minGap: 200 });
      const bark = DK.enemyBark && DK.enemyBark('camel'); if (bark && Math.random() < 0.35) DK.speech(scene, { speaker: 'camel_rider', text: DK.fmt(DK.pick(bark)) }, 1600, e);
      return;
    }
    const [tx, ty] = ranged(e, a, c.range[0], c.range[1]);
    if (e.state === 'burst') e.setVelocity(0); else steer(e, tx, ty, sp, dt);
    e.stepT -= dt; if (e.state === 'move' && e.stepT <= 0) { e.stepT = 0.55; DK.sfx(scene, 's2_camel_step_1', { minGap: 300, volume: 0.6 }); }
    burstFire(scene, e, a, dt, 'camel');
  };
  DK.ENEMY_FX.camel = function (scene, g, e) {
    if (e.state !== 'ctell') return;
    const k = 1 - e.tellT / e.cfg.chargeTell, L = e.cfg.chargeSpeed * e.cfg.chargeTime, ca = Math.cos(e.chargeAng), sa = Math.sin(e.chargeAng);
    const blink = Math.floor((scene.gameT || 0) * 12) % 2;
    g.lineStyle(2 * e.radius, 0xff2020, 0.12 + 0.18 * k).lineBetween(e.x, e.y, e.x + ca * L, e.y + sa * L);
    g.lineStyle(3, 0xff3030, blink ? 0.95 : 0.6).lineBetween(e.x, e.y, e.x + ca * L, e.y + sa * L);
    const hx = e.x + ca * L, hy = e.y + sa * L, n = 16; // arrow head
    g.fillStyle(0xff3030, 0.85).fillTriangle(hx + ca * n, hy + sa * n, hx - sa * n * 0.7, hy + ca * n * 0.7, hx + sa * n * 0.7, hy - ca * n * 0.7);
  };

  // ---- 跳兵: sees a bullet that will hit → 0.30 s crouch tell (still hittable) → sideways leap (bullets pass) → cooldown
  function jumperThreat(scene, e, c) {
    let threat = null;
    scene.pBullets.getChildren().forEach(b => {
      if (threat || !b.active || e.seen.has(b) && b._jSeenBorn === b.born) return;
      const vx = b.body.velocity.x, vy = b.body.velocity.y, v2 = vx * vx + vy * vy; if (!v2) return;
      const rx = e.x - b.x, ry = e.y - b.y, tca = (rx * vx + ry * vy) / v2;
      if (tca < 0 || tca > c.dodgeLook) return;
      const mx = rx - vx * tca, my = ry - vy * tca;
      if (mx * mx + my * my > (e.radius + 5) * (e.radius + 5)) return;
      e.seen.add(b); b._jSeenBorn = b.born; // decide once per bullet
      e.threats++;
      if (Math.random() < c.dodgeChance) threat = { vx, vy };
    });
    return threat;
  }
  DK.ENEMY_AI.jumper = function (scene, e, dt, a) {
    const c = e.cfg, { dist, sp, steer } = a;
    e.dodgeCd -= dt;
    if (e.state === 'jtell') {
      e.setVelocity(0); e.tellLeft -= dt; e.animOverride = 'tell';
      if (e.realSkin) e.holdFrame = ['tell', Math.floor((1 - e.tellLeft / c.dodgeTell) * 4)]; // jumper_windup 00-03 over the tell
      else e.setScale(e.baseSX * 1.12, e.baseSY * 0.82); // crouch
      if (e.tellLeft <= 0) {
        e.state = 'jump'; e.airborne = true; e.jumpLeft = c.dodgeTime; e.animOverride = 'jump';
        e.setVelocity(e.jdx * c.dodgeDist / c.dodgeTime, e.jdy * c.dodgeDist / c.dodgeTime);
        e.dodgeLog[e.dodgeLog.length - 1].jumpAt = T(scene);
        DK.sfx(scene, 's2_jump_takeoff', { minGap: 80 }); // synced to the end of the tell
      }
      return;
    }
    if (e.state === 'jump') {
      e.jumpLeft -= dt; const k = 1 - e.jumpLeft / c.dodgeTime, lift = Math.sin(Math.min(1, k) * Math.PI);
      if (e.realSkin) e.holdFrame = ['jump', 1 + Math.floor(Math.min(0.999, k) * 7)]; // jumper_jump 01-07 (+ render_y_offsets) over the leap
      else e.setScale(e.baseSX * (1 + 0.25 * lift), e.baseSY * (1 + 0.25 * lift));
      e.setVelocity(e.jdx * c.dodgeDist / c.dodgeTime, e.jdy * c.dodgeDist / c.dodgeTime);
      if (e.jumpLeft <= 0) {
        e.airborne = false; e.state = 'recover'; e.recLeft = c.recoverT; e.dodgeCd = c.dodgeCd; e.setVelocity(0); e.animOverride = null;
        if (!e.realSkin) e.setScale(e.baseSX, e.baseSY);
        if (!scene.spawnOk(e.x, e.y, e.radius)) { const q = scene.findSpawn(e.radius, e.x, e.y); e.body.reset(q.x, q.y); e.landFix = (e.landFix || 0) + 1; } // never land inside cover
        const L = e.dodgeLog[e.dodgeLog.length - 1]; L.landAt = T(scene); L.x = e.x; L.y = e.y;
        DK.sfx(scene, 's2_jump_land', { minGap: 80 }); scene.spark(e.x, e.y + 12, 0xe0c58a, 5);
      }
      return;
    }
    if (e.state === 'recover') { e.recLeft -= dt; e.setVelocity(0); if (e.realSkin) e.holdFrame = e.recLeft > 0 ? ['landing', Math.floor((1 - e.recLeft / c.recoverT) * 4)] : null; if (e.recLeft <= 0) e.holdFrame = null; if (e.recLeft <= 0) { e.state = 'move'; e.t = Math.max(e.t, 0.3); } return; }
    e.animOverride = null; e.holdFrame = null;
    if (e.dodgeCd <= 0 && (e.state === 'move' || e.state === 'tell')) {
      const th = jumperThreat(scene, e, c);
      if (th) {
        const l = Math.hypot(th.vx, th.vy), px = -th.vy / l, py = th.vx / l, sides = Math.random() < 0.5 ? [1, -1] : [-1, 1];
        for (const sd of sides) {
          const x1 = e.x + px * sd * c.dodgeDist, y1 = e.y + py * sd * c.dodgeDist;
          let ok = scene.spawnOk(x1, y1, e.radius); // landing must be free; the path must not cross a wall/cover either
          for (let k = 0.33; ok && k < 1; k += 0.33) ok = scene.spawnOk(e.x + px * sd * c.dodgeDist * k, e.y + py * sd * c.dodgeDist * k, e.radius * 0.8);
          if (!ok) continue;
          e.state = 'jtell'; e.tellLeft = c.dodgeTell; e.jdx = px * sd; e.jdy = py * sd; e.baseSX = e.baseSX || e.scaleX; e.baseSY = e.baseSY || e.scaleY;
          e.dodges++; e.dodgeLog.push({ tellAt: T(scene), jumpAt: null, landAt: null, x0: e.x, y0: e.y }); DK.s2log.jumper.push(e.dodgeLog[e.dodgeLog.length - 1]);
          return;
        }
      }
    }
    const [tx, ty] = ranged(e, a, c.range[0], c.range[1]);
    if (e.state === 'burst') e.setVelocity(0); else steer(e, tx, ty, sp, dt);
    burstFire(scene, e, a, dt, 'jumper');
  };
  DK.ENEMY_FX.jumper = function (scene, g, e) {
    if (e.state === 'jtell') { const k = 1 - e.tellLeft / e.cfg.dodgeTell; g.lineStyle(2, 0xffd23f, 0.9).strokeCircle(e.x, e.y + 10, e.radius + 6 - 4 * k); g.fillStyle(0xffd23f, 0.6).fillTriangle(e.x + e.jdx * 30, e.y + e.jdy * 30, e.x + e.jdx * 18 - e.jdy * 7, e.y + e.jdy * 18 + e.jdx * 7, e.x + e.jdx * 18 + e.jdy * 7, e.y + e.jdy * 18 - e.jdx * 7); }
    if (e.state === 'jump') g.fillStyle(0x000000, 0.25).fillEllipse(e.x, e.y + 16, e.radius * 2, e.radius * 0.7);
  };

  // ---- 掷弹兵: wind-up → lob at the player's position (locked on release); warning circle == blast radius from the throw
  DK.ENEMY_AI.grenadier = function (scene, e, dt, a) {
    const c = e.cfg, { p, dist, sp, steer } = a;
    e.throwT -= dt * a.slow;
    if (e.state === 'windup') {
      e.setVelocity(0); e.windLeft -= dt; if (!e.realSkin) e.atkFrame = 0; else e.atkT = 0.2;
      if (e.windLeft <= 0) {
        const live = (scene.eGrenades || []).filter(g => g.alive).length;
        if (live < c.maxLive) DK.enemyGrenade(scene, e, p.x, p.y);
        e.state = 'move'; e.throwT = c.throwCd + Math.random() * 0.6; e.atkT = e.realSkin ? 0.3 : 0.3;
      }
      return;
    }
    const [tx, ty] = ranged(e, a, c.range[0], c.range[1]);
    steer(e, tx, ty, sp, dt);
    if (e.throwT <= 0 && dist < 460) { e.state = 'windup'; e.windLeft = c.windup; e.flashT = 0.06; if (e.realSkin) { DK.anim(e, 'attack', { restart: true }); e.atkT = 0.9; } } // grenadier_throw: 10 fps, release on 05 = windup 0.5 s
  };

  // ------------------------------------------------------------ enemy grenades
  DK.enemyGrenade = function (scene, e, tx, ty, o) {
    o = o || {};
    const c = DK.ENEMIES.grenadier, r = o.radius || c.blastRadius, m = DK.WALL + 12;
    const x1 = Phaser.Math.Clamp(tx, m, DK.W - m), y1 = Phaser.Math.Clamp(ty, m, DK.H - m); // inside the arena (over cover is fine: it lands on top)
    const x0 = e.x, y0 = e.y - 10, now = T(scene);
    const spr = scene.add.sprite(x0, y0, 'enemy_grenade').setDepth(870); DK.applyArt(spr, 'enemy_grenade'); const spin = DK.hasArt('s2_grenade_spin'); if (spin) spr.play('s2_grenade_spin');
    const sh = scene.add.ellipse(x0, y0 + 8, 12, 5, 0x000000, 0.35).setDepth(1);
    const gr = { alive: true, spr, sh, x0, y0, x1, y1, x: x0, y: y0, t0: now, flight: o.flight || c.flight, fuse: o.fuse || c.fuse, radius: r, dmg: Math.min(o.dmg || c.dmg, c.maxHpFrac * scene.run.maxHp), landed: false, src: o.src || 'grenadier', shootable: c.shootable && o.shootable !== false, spin };
    gr.log = { thrownAt: now, warnAt: now, explodeAt: null, landAt: null, x: x1, y: y1, radius: r, blast: r, fuse: gr.fuse, early: false, playerHit: false, playerDist: null };
    DK.s2log.grenade.push(gr.log);
    (scene.eGrenades = scene.eGrenades || []).push(gr);
    DK.sfx(scene, 's2_grenade_throw', { minGap: 60 });
    return gr;
  };
  DK.detonateEnemyGrenade = function (scene, gr, early) {
    if (!gr.alive) return; gr.alive = false;
    const x = early ? gr.x : gr.x1, y = early ? gr.y : gr.y1;
    gr.spr.destroy(); gr.sh.destroy();
    gr.log.explodeAt = T(scene); gr.log.early = !!early; if (early) { gr.log.x = x; gr.log.y = y; }
    DK.sfx(scene, 's2_grenade_explode', { minGap: 40 });
    // shot down: hurts the 沙蝎 around it (reward for shooting it), never the player at full strength
    scene.explode(x, y, gr.radius, early ? gr.dmg : 0, { src: early ? 'grenade_shot' : 'enemy_grenade', hurtPlayer: false, hurtEnemies: !!early, size: 0.8, quiet: true, art: 's2_explosion' });
    const p = scene.player, d = Math.hypot(p.x - x, p.y - y); gr.log.playerDist = Math.round(d);
    if (d <= gr.radius && !early) gr.log.playerHit = scene.hurtPlayer(Math.round(gr.dmg), gr.src + '_grenade'); // centre inside the circle = hit; outside = 0 damage
  };
  DK.updateEnemyGrenades = function (scene, dt) {
    const list = scene.eGrenades; if (!list || !list.length) return;
    const now = T(scene);
    for (const gr of list) {
      if (!gr.alive) continue;
      const k = Math.min(1, (now - gr.t0) / gr.flight);
      gr.x = gr.x0 + (gr.x1 - gr.x0) * k; gr.y = gr.y0 + (gr.y1 - gr.y0) * k;
      const h = Math.sin(k * Math.PI) * 80;
      gr.spr.setPosition(gr.x, gr.y - h); if (!gr.spin) gr.spr.setAngle(k * 600); else if (gr.landed && gr.spr.anims) gr.spr.anims.pause(); gr.sh.setPosition(gr.x, gr.y + 8);
      if (k >= 1 && !gr.landed) { gr.landed = true; gr.log.landAt = now; gr.spr.setDepth(gr.y1); DK.sfx(scene, 's2_grenade_land', { minGap: 60 }); }
      if (gr.landed) gr.spr.setAlpha(Math.floor(now * 10) % 2 ? 1 : 0.55);
      if (now - gr.t0 >= gr.fuse) { DK.detonateEnemyGrenade(scene, gr, false); continue; }
      if (gr.shootable) { // a player bullet that touches it sets it off early, where it is
        const gy = gr.y - h;
        for (const b of scene.pBullets.getChildren()) if (b.active && Math.abs(b.x - gr.x) < 12 && Math.abs(b.y - gy) < 12) { scene.killBullet(b); DK.detonateEnemyGrenade(scene, gr, true); break; }
      }
    }
    scene.eGrenades = list.filter(g => g.alive);
  };
  DK.drawEnemyGrenades = function (scene, g) {
    const list = scene.eGrenades; if (!list) return;
    const now = T(scene);
    for (const gr of list) {
      if (!gr.alive) continue;
      const k = Math.min(1, (now - gr.t0) / gr.fuse), blink = Math.floor(now * (k > 0.7 ? 16 : 8)) % 2;
      g.fillStyle(0xff3030, 0.10 + 0.18 * k).fillCircle(gr.x1, gr.y1, gr.radius);
      g.lineStyle(3, 0xff3030, blink ? 0.95 : 0.6).strokeCircle(gr.x1, gr.y1, gr.radius); // == blast radius
      g.lineStyle(2, 0xffd0a0, 0.8).strokeCircle(gr.x1, gr.y1, Math.max(2, gr.radius * (1 - k))); // countdown ring closes in
    }
  };
  DK.clearEnemyGrenades = function (scene) { (scene.eGrenades || []).forEach(gr => { if (gr.alive) { gr.alive = false; gr.spr.destroy(); gr.sh.destroy(); } }); scene.eGrenades = []; };

  // ------------------------------------------------------------ 骆驼 dismount (art: camel_dismount 10 f @12 fps; corpse at 04, foot actor at 09)
  DK.camelDismount = function (scene, e, spawnRider) {
    const A = DK.ARTX.camel_dismount;
    if (!e.realSkin || !DK.hasArt('camel_dismount')) return spawnRider(e.x, e.y);
    const sk = DK.SKINS.enemy_camel, x = e.x, y = e.y, flip = e.flipX, ev = A.event_frames || { spawn_corpse: 4, switch_to_foot: 9 };
    const t = scene.add.sprite(x, y, 'camel_dismount', 0).setFlipX(flip); t.skin = sk; t.realSkin = true; t.setDepth(e.depth);
    scene.pending++; let corpse = null, f0 = -1;
    const setF = f => { t.renderDY = (A.render_y_offsets || [])[f] * sk.scale || 0; t._skinAnim = null; DK.skinOrigin(t, 'camel_dismount'); t.setTexture('camel_dismount', f); };
    setF(0);
    const tick = scene.time.addEvent({ delay: 1000 / (A.fps || 12), repeat: A.frame_count - 1, callback: () => {
      const f = Math.min(A.frame_count - 1, ++f0 + 1);
      setF(f); DK.s2log.camel.push({ t: scene.gameT, ev: 'dismount_f' + f, feetY: Math.round(t.getBounds().bottom), dy: Math.round(t.renderDY) });
      if (f === ev.spawn_corpse && DK.hasArt('s2_camel_corpse') && !corpse) { // independent fallen camel, same ground origin, behind the rider
        const C = DK.ARTX.s2_camel_corpse; corpse = scene.add.image(x, y + sk.lift, 's2_camel_corpse').setOrigin((flip ? C.frame_size[0] - C.anchor[0] : C.anchor[0]) / C.frame_size[0], C.anchor[1] / C.frame_size[1]).setFlipX(flip).setScale(sk.scale * (C.recommended_render_scale_multiplier || 0.9) / (C.res_scale || 1)).setDepth(y - 1);
        scene.tweens.add({ targets: corpse, alpha: 0, delay: 6000, duration: 800, onComplete: () => corpse.destroy() });
      }
      if (f >= (ev.switch_to_foot || A.frame_count - 1)) { tick.remove(); t.destroy(); scene.pending--; if (scene.state !== 'won' && scene.state !== 'dead') spawnRider(x, y + sk.lift - DK.SKINS.enemy_camel_rider.lift, flip); } // keep world feet
    } });
  };

  // ------------------------------------------------------------ per-frame stage-2 hook (run.update)
  DK.updateStage2 = function (scene, dt) { DK.updateEnemyGrenades(scene, dt); };
  DK.drawStage2 = function (scene, g) { DK.drawEnemyGrenades(scene, g); };
})(window.DK);

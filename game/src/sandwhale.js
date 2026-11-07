// Boss 沙鲸·流沙之喉 (stage 2). Same interface as DK.Boss (spr/isBoss/bossRef, hp, phase, alive, active, invulnT,
// damage(), armorLocked(), armorLeft(), plateRed, plateLost, update(), drawFx(), turret) — armour plate + phase lock are shared.
//  P1 潜沙: dive → sand-mound trail (lane warning) → burst out and ram; back-turret fan while surfaced. Hittable only above ground.
//  P2 沙暴: sandstorm veil; spits 跳兵/掷弹兵 from its maw; sweeping sand-stream bullets (still dives and rams, less often).
//  P3 开膛: plates burst open — the glowing 回响舱 core is the weak point (×coreMul, shell ×shellMul); rolls; shard rings.
(function (DK) {
  const PI2 = Math.PI * 2, rnd = Phaser.Math.FloatBetween;
  DK.SandWhale = class {
    constructor(scene, x, y) {
      const B = this.cfg = DK.STAGE2.boss; this.scene = scene;
      this.spr = scene.physics.add.sprite(x, y, 'boss_sandwhale'); DK.applySkin(this.spr, 'boss_sandwhale');
      DK.setRectBody(this.spr, 170, 80); this.spr.setImmovable(true); this.spr.body.pushable = false;
      this.spr.isBoss = true; this.spr.bossRef = this;
      this.turret = scene.add.image(x, y, 'sw_turret'); DK.applyArt(this.turret, 'sw_turret'); this.turret.setOrigin(0.25, 0.5);
      if (this.spr.realSkin) this.turret.setVisible(false);
      const fx = (k, sc) => { if (!DK.hasArt(k)) return null; const A = DK.ARTX[k], o = scene.add.sprite(x, y, k, 0).setOrigin(A.anchor[0] / A.frame_size[0], A.anchor[1] / A.frame_size[1]).setScale(sc / (A.res_scale || 1)).setVisible(false); if (scene.anims.exists(k)) o.play(k); return o; };
      this.bulge = fx('sandwhale_bulge', 0.4); this.storm = fx('sandwhale_storm', 0.6); if (this.storm) this.storm.setAlpha(0.8);
      this.core = scene.add.image(x, y, 'sw_core'); DK.applyArt(this.core, 'sw_core'); this.core.setVisible(false); this.coreBase = [this.core.scaleX, this.core.scaleY];
      this.hp = B.hp; this.maxHp = B.hp; this.phase = 1; this.alive = true; this.invulnT = 0; this.active = false; this.targetable = true;
      this.st = { burn: 0, burnT: 0, burnTick: 0, frz: 0, frozenT: 0, immuneT: 0, steamCd: 0 };
      this.radius = B.radius; this.hitW = 95; this.hitH = 50; this.flashT = 0;
      this.startTime = 0; this.phaseT = 0; this.armorHits = 0; this.plateD = 0; this.plateT = 0; this.plateRed = 0; this.plateLost = 0;
      this.mode = 'surface'; this.modeT = 1.2; this.t = { fan: 1.0, minion: 3, stream: 2, ring: 1, taunt: 14 }; this.turretAng = Math.PI / 2;
      this.log = []; this.coreHits = 0; this.shellHits = 0; this.minionsSpat = 0; this.streamShots = 0; this.ringsFired = 0; this.rams = 0; this.burrowBlocks = 0;
      this.lockTxt = DK.txt(scene, x, y, '', { fontSize: '20px', color: '#cfe6ff', fontStyle: 'bold', stroke: '#1b2b3a', strokeThickness: 5 }).setOrigin(0.5).setVisible(false);
    }
    get x() { return this.spr.x; } get y() { return this.spr.y; }
    get name() { return this.cfg.name; }
    T() { return this.scene.gameT || 0; }
    contactNow() { // ram / roll hits hard once; otherwise normal contact
      if ((this.mode === 'ram' || this.mode === 'roll') && !this.ramHit) { this.ramHit = true; return this.cfg.ramDmg; }
      return this.mode === 'burrow' || this.mode === 'trail' || this.mode === 'emerge' ? 0 : this.cfg.contact;
    }
    setBurrowed(on) {
      const spr = this.spr; this.targetable = !on; spr.body.enable = !on;
      if (spr.realSkin) { // burrow one-shot (invulnerable from its start), body hidden underground → sandwhale_bulge; emerge drawn by animate()
        if (on) { this.oneShot('burrow'); this.scene.tweens.add({ targets: spr, alpha: 0, delay: 520, duration: 150 }); }
        else { this.scene.tweens.killTweensOf(spr); spr.setAlpha(1); }
        return;
      }
      this.scene.tweens.add({ targets: [spr, this.turret], alpha: on ? 0 : 1, duration: on ? 300 : 120 });
    }
    setPhase(n) {
      if (n <= this.phase) return;
      const s = this.scene, B = this.cfg; this.phase = n; this.phaseT = 0; this.invulnT = B.phaseInvuln;
      if (!this.targetable) { this.setBurrowed(false); }
      this.mode = 'surface'; this.modeT = 1.5; this.trail = null; this.lane = null; this.spr.setVelocity(0);
      s.cameras.main.shake(400, 0.01); DK.sfx(s, 'explosion_large');
      s.explode(this.x + rnd(-50, 50), this.y + rnd(-30, 30), 50, 0, { src: 'fx', visualOnly: true });
      const P = (DK.story2.boss_sandwhale.phases || [])[n - 1];
      DK.banner(s, n === 2 ? '第二阶段 · ' + (P ? P.name : '沙暴') + ' · 视野降低' : '第三阶段 · ' + (P ? P.name : '开膛') + ' · 打发光的核心！', { color: '#ffb04e', size: 28, dur: 1800 });
      DK.lines(DK.story2.boss_sandwhale[n === 2 ? 'phase2' : 'phase3'] || []).forEach((l, i) => s.time.delayedCall(600 + i * 2300, () => { if (s.scene.isActive() && this.alive) DK.speech(s, l, 2100); }));
      DK.logDamage({ src: 'boss', tgt: 'phase', amt: 0, note: 'phase ' + n, hp: this.hp });
      this.log.push({ ev: 'phase', n, at: this.T() });
      if (DK.musicPhase && s.cache.audio.exists('s2_bgm_boss_desert_p' + n)) DK.musicPhase(s, 's2_bgm_boss_desert_p' + n, 1.6); // music follows the REAL phase change
      if (n === 2) { DK.setSandstorm(s, true); DK.ambient(s, 's2_amb_desert_wind'); }
      if (n === 3) {
        DK.setSandstorm(s, false);
        s.spawnGen = (s.spawnGen || 0) + 1; // the duel: leftover spit minions and grenades fizzle out
        s.enemies.getChildren().slice().forEach(e => { if (e.alive) { s.explode(e.x, e.y, 30, 0, { src: 'fx', visualOnly: true }); s.killEnemy(e, 'phase3'); } });
        DK.clearEnemyGrenades(s);
        this.oneShot('open'); const exp = this.spr.realSkin ? ((DK.ARTX.sandwhale_open.event_frames || {}).expose_core || 7) / (DK.ARTX.sandwhale_open.fps || 12) * 1000 : 0;
        this.coreOpen = !this.spr.realSkin; s.time.delayedCall(exp, () => { this.coreOpen = true; if (!this.spr.realSkin) { this.core.setVisible(true).setAlpha(0); s.tweens.add({ targets: this.core, alpha: 1, duration: 600 }); } });
        for (let i = 0; i < 6; i++) s.time.delayedCall(i * 120, () => s.spark(this.x + rnd(-70, 70), this.y + rnd(-30, 30), 0xffa040, 6)); // plates burst open
      }
    }
    emergeT() { const a = DK.ARTX.sandwhale_emerge; return a ? ((a.event_frames || {}).surface_hittable || 6) / (a.fps || 14) : 0.43; }
    coreXY() { // art: per-frame cyan-core centroid (core_weakpoint_frames), else the last open/roll frame's; placeholder: fixed offset
      const spr = this.spr;
      if (spr.realSkin) {
        const a = DK.ARTX[spr.texture.key], fr = a && a.core_weakpoint_frames && a.core_weakpoint_frames[+spr.frame.name];
        if (fr && fr.visible && fr.center && fr.cyan_pixels > 100) this._coreC = fr.center;
        const c = this._coreC || [478, 487], sx = spr.scaleX, ox = spr.displayOriginX, oy = spr.displayOriginY;
        return { x: spr.x + (spr.flipX ? -(c[0] - ox) : c[0] - ox) * sx, y: spr.y + (c[1] - oy) * spr.scaleY };
      }
      return { x: spr.x + (spr.flipX ? 10 : -10), y: spr.y - 4 };
    }
    oneShot(state, ms) { // play a one-shot body state; animate() leaves it alone until it ends
      const spr = this.spr; if (!spr.realSkin || !spr.skin.anims[state]) return;
      const a = DK.ARTX[spr.skin.anims[state]]; DK.anim(spr, state, { restart: true });
      this.shotUntil = this.T() + (ms != null ? ms : a.frame_count / (a.fps || 12)) / (ms != null ? 1000 : 1); this.shotState = state;
    }
    damage(amount, info) {
      if (!this.alive) return 0;
      info = info || {};
      if (!this.targetable && info.src !== 'dbg') { // under the sand: nothing reaches it
        const s = this.scene, now = this.T() * 1000; this.burrowBlocks++;
        if (now - (this._sandT || 0) > 500) { this._sandT = now; DK.floatText(s, this.x, this.y - 30, '沙下', '#e0c58a', 15); }
        DK.logDamage({ src: info.src, tgt: 'boss', amt: 0, note: 'burrowed', hp: this.hp }); return 0;
      }
      if (this.phase === 3 && info.src !== 'dbg') { // 回响舱 core weak point
        const c = this.coreXY(), hx = info.x != null ? info.x : this.x, hy = info.y != null ? info.y : this.y;
        const onCore = this.coreOpen !== false && info.x != null && Math.hypot(hx - c.x, hy - c.y) <= this.cfg.coreR + 6;
        const dot = info.src === 'burn' || info.src === 'steam';
        if (!dot) { amount *= onCore ? this.cfg.coreMul : this.cfg.shellMul; if (onCore) { this.coreHits++; this.coreFlash = 0.08; } else this.shellHits++; }
      }
      if (amount > 0 && info.src !== 'burn' && info.src !== 'steam' && this.mode === 'surface' && this.T() > (this.shotUntil || 0) + 0.6) this.oneShot(this.phase === 3 ? 'hurt_open' : 'hurt');
      return DK.Boss.prototype.damage.call(this, amount, info);
    }
    update(dt) {
      if (!this.alive) return;
      const s = this.scene, p = s.player, B = this.cfg, spr = this.spr, st = this.st;
      if (st.burnT > 0) { st.burnT -= dt; st.burnTick += dt; if (st.burnTick >= 0.5) { st.burnTick -= 0.5; s.damage(spr, DK.AMMO.burn.dps * st.burn * 0.5, { src: 'burn', noFlash: true, color: '#ff9a3a' }); } if (st.burnT <= 0) st.burn = 0; }
      if (st.frozenT > 0) { st.frozenT -= dt; if (st.frozenT <= 0) st.immuneT = DK.AMMO.freeze.immune; } else if (st.immuneT > 0) st.immuneT -= dt;
      if (st.steamCd > 0) st.steamCd -= dt;
      const slow = st.frozenT > 0 ? 0.35 : Math.max(0.4, 1 - 0.08 * st.frz);
      if (this.flashT > 0) { this.flashT -= dt; spr.setTintFill(0xffffff); }
      else { this.plateRed = this.plateNow(); const armour = this.active && (this.armorLocked() || this.plateRed >= 0.15); // armour tint wins over burn/freeze
        const tint = armour ? 0x8fb0d0 : st.frozenT > 0 ? 0x9fe8ff : st.burn > 0 ? 0xffc090 : this.invulnT > 0 && Math.floor(this.T() * 1000 / 90) % 2 ? 0x888888 : null;
        if (tint) { spr.setTint(tint); this.turret.setTint(tint); } else { spr.clearTint(); this.turret.clearTint(); } }
      if (this.coreFlash > 0) { this.coreFlash -= dt; this.core.setTintFill(0xffffff); } else this.core.clearTint();
      spr.setDepth(spr.y + (spr.skin ? spr.skin.lift : 50));
      const face = Math.cos(Math.atan2(p.y - spr.y, p.x - spr.x)) < 0;
      if (this.mode !== 'ram' && this.mode !== 'roll') spr.setFlipX(face);
      this.turret.setPosition(spr.x + (spr.flipX ? 12 : -12), spr.y - 38).setDepth(spr.depth + 1).setAlpha(spr.alpha);
      const c = this.coreXY(); this.core.setPosition(c.x, c.y).setDepth(spr.depth + 2).setScale(this.coreBase[0] * (1 + 0.08 * Math.sin(this.T() * 8)), this.coreBase[1] * (1 + 0.08 * Math.sin(this.T() * 8)));
      if (spr.realSkin && this.mode === 'trail' && this.T() >= (this.shotUntil || 0)) spr.setAlpha(0); // underground: only the bulge shows
      this.animate();
      if (!this.active) return;
      this.phaseT += dt;
      const lk = this.armorLocked();
      this.lockTxt.setVisible(lk).setPosition(this.x, this.y - 110).setDepth(2000);
      if (lk) this.lockTxt.setText(`装甲锁定 ${Math.ceil(this.armorLeft())}s` + (this.phase === 3 ? ' 后可击毁' : ' 后进入下一阶段'));
      const aim = Math.atan2(p.y - (spr.y - 38), p.x - spr.x);
      this.turretAng += Phaser.Math.Clamp(DK.angDiff(aim, this.turretAng), -2.2 * dt, 2.2 * dt); this.turret.setRotation(this.turretAng);
      if (this.invulnT > 0) { this.invulnT -= dt; spr.setVelocity(0); return; }
      for (const k in this.t) this.t[k] -= dt * slow;
      this.modeT -= dt * slow;
      const W = DK.W, H = DK.H;
      switch (this.mode) {
        case 'surface': {
          if (this.phase === 3) { // roll toward the player periodically; rings
            spr.setVelocity(0);
            if (this.modeT <= 0) { this.mode = 'rtell'; this.modeT = 0.6; this.laneAng = Math.atan2(p.y - spr.y, p.x - spr.x); this.lane = { x: spr.x, y: spr.y, a: this.laneAng, len: B.rollSpeed * B.rollTime, t0: this.T() }; this.log.push({ ev: 'rtell', at: this.T() }); }
          } else {
            const tx = Phaser.Math.Clamp(p.x, 140, W - 140), ty = Phaser.Math.Clamp(p.y - 140, B.minY, H - 120);
            const dx = tx - spr.x, dy = ty - spr.y, d = Math.hypot(dx, dy) || 1, v = this.phase === 2 ? 55 : 35;
            spr.setVelocity(d > 20 ? dx / d * v * slow : 0, d > 20 ? dy / d * v * slow : 0);
            if (this.modeT <= 0 && this.phase <= 2) { this.mode = 'burrow'; this.modeT = 0.45; spr.setVelocity(0); this.setBurrowed(true); DK.sfx(s, 'explosion_small', { volume: 0.5 }); s.spark(spr.x, spr.y + 20, 0xe0c58a, 10); this.log.push({ ev: 'burrow', at: this.T() }); }
          }
          this.attacks(dt, aim);
          break;
        }
        case 'burrow': { spr.setVelocity(0); if (this.modeT <= 0) { this.mode = 'trail'; this.modeT = B.trailTell; this.trail = { x: spr.x, y: spr.y + 20, pts: [], locked: false }; this.log.push({ ev: 'trail', at: this.T() }); } break; }
        case 'trail': { // the mound travels to a spot ~260 px from the player; the last 0.5 s the ram lane is locked and drawn
          const tr = this.trail, dx = tr.x - p.x, dy = tr.y - p.y, d = Math.hypot(dx, dy) || 1;
          const gx = Phaser.Math.Clamp(p.x + dx / d * 260, 120, W - 120), gy = Phaser.Math.Clamp(p.y + dy / d * 260, B.minY, H - 90);
          const mx = gx - tr.x, my = gy - tr.y, md = Math.hypot(mx, my);
          if (md > 4) { const k = Math.min(1, B.trailSpeed * dt / md); tr.x += mx * k; tr.y += my * k; }
          if ((tr.pts.length === 0 || Math.hypot(tr.x - tr.pts[tr.pts.length - 1].x, tr.y - tr.pts[tr.pts.length - 1].y) > 14)) { tr.pts.push({ x: tr.x, y: tr.y }); if (tr.pts.length > 40) tr.pts.shift(); }
          spr.body.reset(tr.x, tr.y - 20);
          if (!tr.locked && this.modeT <= 0.55) { tr.locked = true; this.laneAng = Math.atan2(p.y - tr.y, p.x - tr.x); this.lane = { x: tr.x, y: tr.y, a: this.laneAng, len: B.ramSpeed * B.ramTime, t0: this.T() }; DK.sfx(s, 'sniper_warn', { volume: 0.5 }); this.log.push({ ev: 'lane', at: this.T() }); }
          if (this.modeT <= 0) { // burst out: emerge (not hittable until the art's surface_hittable frame), then ram
            this.mode = 'emerge'; this.modeT = this.emergeT(); this.trail = null; spr.setAlpha(1); this.oneShot('emerge');
            s.explode(spr.x, spr.y + 20, 46, 0, { src: 'fx', visualOnly: true, size: 0.6 }); s.cameras.main.shake(220, 0.01); DK.sfx(s, 'explosion_small');
            this.log.push({ ev: 'ram', at: this.T() });
          }
          break;
        }
        case 'emerge': { spr.setVelocity(0); if (this.modeT <= 0) { this.mode = 'ram'; this.modeT = B.ramTime; this.ramHit = false; this.setBurrowed(false); this.rams++; this.oneShot('ram', B.ramTime * 1000); this.log.push({ ev: 'surface', at: this.T() }); } break; }
        case 'rtell': { spr.setVelocity(0); if (this.modeT <= 0) { this.mode = 'roll'; this.modeT = B.rollTime; this.ramHit = false; this.log.push({ ev: 'roll', at: this.T() }); } this.attacks(dt, aim); break; }
        case 'ram': case 'roll': {
          const sp = this.mode === 'ram' ? B.ramSpeed : B.rollSpeed;
          spr.setVelocity(Math.cos(this.laneAng) * sp, Math.sin(this.laneAng) * sp); spr.setFlipX(Math.cos(this.laneAng) < 0);
          if (this.mode === 'roll' && !spr.realSkin) spr.setAngle(spr.angle + (Math.cos(this.laneAng) < 0 ? -1 : 1) * 540 * dt);
          const out = spr.x < 110 || spr.x > W - 110 || spr.y < B.minY || spr.y > H - 70;
          if (this.modeT <= 0 || out) {
            spr.setVelocity(0); spr.setAngle(0); this.lane = null;
            spr.body.reset(Phaser.Math.Clamp(spr.x, 110, W - 110), Phaser.Math.Clamp(spr.y, B.minY, H - 70));
            if (out) { s.cameras.main.shake(160, 0.008); s.spark(spr.x, spr.y, 0xc89a5a, 8); }
            this.mode = 'surface'; this.modeT = this.phase === 3 ? B.rollEvery : this.phase === 2 ? B.surfaceT * 1.8 : B.surfaceT;
          }
          break;
        }
      }
      if (this.t.taunt <= 0) { this.t.taunt = 16 + Math.random() * 8; const tt = DK.pick(DK.story2.boss_sandwhale.taunts); if (tt) DK.speech(s, { speaker: 'boss', text: DK.fmt(tt) }, 2200); }
    }
    attacks(dt, aim) {
      const s = this.scene, B = this.cfg, spr = this.spr, tx = spr.x + (spr.flipX ? 12 : -12), ty = spr.y - 38;
      if (this.phase <= 2 && this.t.fan <= 0) { // back turret fan
        this.t.fan = this.phase === 1 ? B.fanEvery : B.p2FanEvery;
        for (let i = 0; i < B.fanN; i++) s.enemyShoot(tx, ty, aim + (i - (B.fanN - 1) / 2) * B.fanSpread, B.fanSpeed, B.fanDmg, 'boss_fan', { noFlash: i !== (B.fanN >> 1) });
        DK.sfx(s, 'shoot_mg', { volume: 0.5, minGap: 80 }); if (this.mode === 'surface') this.oneShot('turret');
      }
      if (this.phase === 2) {
        if (this.t.minion <= 0) { // spit 跳兵 / 掷弹兵 from the maw
          this.t.minion = B.minionEvery;
          const alive = s.enemies.getChildren().filter(e => e.alive).length, n = Math.min(2, B.minionMax - alive);
          const mx = spr.x + (spr.flipX ? -80 : 80);
          for (let i = 0; i < n; i++) { s.spawnWithTelegraph((this.minionsSpat + i) % 2 ? 'grenadier' : 'jumper', Phaser.Math.Clamp(mx + rnd(-40, 40), 80, DK.W - 80), Phaser.Math.Clamp(spr.y + 70 + i * 40, 90, DK.H - 80)); }
          if (n > 0) { this.oneShot('spit'); this.minionsSpat += n; DK.sfx(s, 's2_camel_groan_2', { volume: 0.6 }); this.log.push({ ev: 'spit', n, at: this.T() }); }
        }
        if (this.t.stream <= 0 && !this.stream) { this.t.stream = B.streamEvery + B.streamSweep; this.stream = { i: 0, t: 0, a0: aim - 0.75, dir: Math.random() < 0.5 ? 1 : -1 }; this.oneShot('spray', B.streamSweep * 1000); this.log.push({ ev: 'stream', at: this.T() }); }
      }
      if (this.stream) { // sand stream: a sweeping arc of slow sand bullets from the maw
        const st = this.stream, gap = B.streamSweep / B.streamN; st.t -= dt;
        while (st.t <= 0 && st.i < B.streamN) {
          st.t += gap; const k = st.i / (B.streamN - 1), a = st.dir > 0 ? st.a0 + 1.5 * k : st.a0 + 1.5 * (1 - k);
          s.enemyShoot(spr.x + (spr.flipX ? -80 : 80), spr.y + 6, a, B.streamSpeed, B.streamDmg, 'boss_stream', { art: 'sandwhale_sand_bullet', artScale: 0.25 }); st.i++; this.streamShots++;
        }
        if (st.i >= B.streamN || this.phase !== 2) this.stream = null;
      }
      if (this.phase === 3 && this.t.ring <= 0) { // 回响舱 shard ring with a dodge gap
        this.t.ring = B.ringEvery; const n = B.ringN, gapStart = Math.floor(Math.random() * n); this.ringOff = (this.ringOff || 0) + 0.23;
        const c = this.coreXY();
        for (let i = 0; i < n; i++) { if (((i - gapStart + n) % n) < B.ringGap) continue; const a = this.ringOff + i / n * PI2; s.enemyShoot(c.x + Math.cos(a) * 50, c.y + Math.sin(a) * 40, a, B.ringSpeed, B.ringDmg, 'boss_ring', { boss: true, art: 'sandwhale_debris_shard', artScale: 0.3 }); }
        this.ringsFired++; DK.sfx(s, 'shoot_split', { volume: 0.6, minGap: 100 });
        if (this.ringsFired % 3 === 0) this.markGhost();
      }
    }
    markGhost() { // the shards flash an after-image of 马克 (story: 舱体落地会短暂闪出马克的残影)
      const s = this.scene, x = Phaser.Math.Between(150, DK.W - 150), y = Phaser.Math.Between(200, DK.H - 100);
      const gh = s.add.sprite(x, y, s.player.spr.texture.key, s.player.spr.frame.name).setScale(s.player.spr.scaleX, s.player.spr.scaleY).setTintFill(0x9fe8ff).setAlpha(0).setDepth(y);
      s.tweens.add({ targets: gh, alpha: 0.55, yoyo: true, duration: 350, hold: 250, onComplete: () => gh.destroy() });
    }
    animate() {
      const spr = this.spr; if (!spr.realSkin) return;
      if (this.T() < (this.shotUntil || 0) || this.mode === 'burrow' || this.mode === 'trail' || this.mode === 'emerge') return; // one-shot playing / underground
      if (this.mode === 'roll') return DK.anim(spr, 'roll');
      if (this.phase === 3) { const A = DK.ARTX.sandwhale_open; return DK.animFrame(spr, 'open', A.frame_count - 1); } // armour stays open (open→roll share drawings)
      DK.anim(spr, 'move');
    }
    drawFx(g) {
      if (this.bulge && !this.trail) this.bulge.setVisible(false);
      if (this.storm) { const on = this.alive && this.phase === 2 && this.targetable; this.storm.setVisible(on); if (on) this.storm.setPosition(this.spr.x, this.spr.y + 40).setDepth(this.spr.depth - 1); }
      if (!this.alive) return;
      const now = this.T();
      if (this.trail) { // the sand mound + its wake
        const tr = this.trail;
        tr.pts.forEach((q, i) => g.fillStyle(0x9c7c45, 0.15 + 0.5 * i / tr.pts.length).fillEllipse(q.x, q.y, 26 + i, 10 + i * 0.3));
        if (this.bulge) this.bulge.setPosition(tr.x, tr.y + 12).setDepth(tr.y).setVisible(true);
        else { g.fillStyle(0xb8955e, 0.95).fillEllipse(tr.x, tr.y, 90, 32); g.lineStyle(2, 0x7a5a34, 0.9).strokeEllipse(tr.x, tr.y, 90, 32); }
        g.fillStyle(0x5a6b3a, 0.9).fillTriangle(tr.x - 10, tr.y - 10, tr.x + 14, tr.y - 10, tr.x + 2, tr.y - 34); // dorsal fin
      }
      if (this.lane) { // locked ram / roll lane
        const L = this.lane, k = Math.min(1, (now - L.t0) / 0.55), blink = Math.floor(now * 12) % 2, ex = L.x + Math.cos(L.a) * L.len, ey = L.y + Math.sin(L.a) * L.len;
        g.lineStyle(100, 0xff2020, 0.08 + 0.12 * k).lineBetween(L.x, L.y, ex, ey);
        g.lineStyle(3, 0xff3030, blink ? 0.95 : 0.55).lineBetween(L.x, L.y, ex, ey);
      }
      if (this.phase === 3 && this.coreOpen) { const c = this.coreXY(); g.lineStyle(2, 0x6fd6ff, 0.5 + 0.4 * Math.sin(now * 6)).strokeCircle(c.x, c.y, this.cfg.coreR + 6); }
    }
    destroy() { this.bulge && this.bulge.destroy(); this.storm && this.storm.destroy(); this.turret.destroy(); this.core.destroy(); this.spr.destroy(); }
  };
  // shared armour plate + phase lock (boss.js)
  ['armorFloor', 'armorLeft', 'armorLocked', 'plateDecay', 'plateCurve', 'plateMul', 'plateNow'].forEach(k => { DK.SandWhale.prototype[k] = DK.Boss.prototype[k]; });
})(window.DK);

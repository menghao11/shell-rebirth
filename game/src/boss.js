// Boss 铁砧 (Anvil) — 1500 HP, 3 phases:
//  P1 主炮直线(红线预警) + 机枪点射   P2 放小兵 + 铺地雷   P3 履带损坏，原地 360° 弹幕（留缺口可躲）
(function (DK) {
  const PI2 = Math.PI * 2;
  DK.Boss = class {
    constructor(scene, x, y) {
      const B = DK.BOSS; this.scene = scene; this.cfg = B;
      this.spr = scene.physics.add.sprite(x, y, 'boss_anvil'); DK.applySkin(this.spr, 'boss_anvil');
      DK.setRectBody(this.spr, this.spr.realSkin ? 170 : 150, this.spr.realSkin ? 96 : 104); this.spr.setImmovable(true); this.spr.body.pushable = false;
      this.spr.isBoss = true; this.spr.bossRef = this;
      this.turret = scene.add.image(x, y, 'boss_turret'); DK.applyArt(this.turret, 'boss_turret'); this.turret.setOrigin(0.3, 0.5);
      if (this.spr.realSkin) this.turret.setVisible(false); // the tank art has its own turret
      this.actT = 0; this.act = null;
      this.hp = B.hp; this.maxHp = B.hp; this.phase = 1; this.alive = true; this.invulnT = 0; this.active = false;
      this.turretAng = Math.PI / 2; this.t = { cannon: 2.2, mg: 1.4, mine: 1.5, minion: 3, ring: 1, taunt: 12, move: 0 };
      this.dir = 1; this.cannonTele = null; this.ringOff = 0; this.flashT = 0;
      this.st = { burn: 0, burnT: 0, burnTick: 0, frz: 0, frozenT: 0, immuneT: 0, steamCd: 0 };
      this.radius = B.radius; this.x0 = x;
      this.startTime = 0; this.phaseT = 0; this.armorHits = 0; this.plateD = 0; this.plateT = 0; this.plateRed = 0; this.plateLost = 0;
      this.lockTxt = DK.txt(scene, x, y, '', { fontSize: '20px', color: '#cfe6ff', fontStyle: 'bold', stroke: '#1b2b3a', strokeThickness: 5 }).setOrigin(0.5).setVisible(false);
    }
    get x() { return this.spr.x; } get y() { return this.spr.y; }
    setPhase(n) {
      if (n <= this.phase) return;
      const s = this.scene; this.phase = n; this.phaseT = 0; this.invulnT = this.cfg.phaseInvuln; this.cannonTele = null;
      s.cameras.main.shake(400, 0.01); DK.sfx(s, 'explosion_large');
      s.explode(this.x + Phaser.Math.Between(-50, 50), this.y + Phaser.Math.Between(-30, 30), 50, 0, { src: 'fx', visualOnly: true });
      DK.banner(s, n === 2 ? '第二阶段 · 补充兵员 / 铺设地雷' : '第三阶段 · 履带损坏 · 全方位弹幕', { color: '#ff5a4e', size: 28, dur: 1800 });
      const lines = DK.lines(DK.story.boss_anvil[n === 2 ? 'phase2' : 'phase3']);
      lines.forEach((l, i) => s.time.delayedCall(600 + i * 2300, () => { if (s.scene.isActive() && this.alive) DK.speech(s, l, 2100); }));
      DK.logDamage({ src: 'boss', tgt: 'phase', amt: 0, note: 'phase ' + n, hp: this.hp });
      if (n === 3) {
        this.spr.setVelocity(0);
        // phase 3 is the bullet-hell duel: leftover phase-2 minions and mines fizzle out (review P2-4)
        s.spawnGen = (s.spawnGen || 0) + 1; // cancel minion telegraphs still on the ground
        s.enemies.getChildren().slice().forEach(e => { if (e.alive) { s.explode(e.x, e.y, 30, 0, { src: 'fx', visualOnly: true }); s.killEnemy(e, 'phase3'); } });
        if (s.mines) { s.mines.slice().forEach(m => { if (m.active) { s.spark && s.spark(m.x, m.y, 0xffe08a); m.destroy(); } }); s.mines.length = 0; }
      }
    }
    // 装甲锁 (N1): HP floor while the current phase is younger than this.cfg.phaseMinT (game time, this.phaseT)
    armorFloor() {
      const B = this.cfg, g = (B.phaseMinT || [])[this.phase - 1];
      if (!g || this.phaseT >= g) return null;
      return this.phase === 1 ? B.phase2At + 1 : this.phase === 2 ? B.phase3At + 1 : 1;
    }
    armorLeft() { const g = (this.cfg.phaseMinT || [])[this.phase - 1]; return g ? Math.max(0, g - this.phaseT) : 0; }
    armorLocked() { const f = this.armorFloor(); return f != null && this.hp <= f; }
    // 装甲板: exponential average of raw DPS (game time); returns the multiplier for a hit of `amount`
    plateDecay() { const B = this.cfg, now = this.scene.gameT || 0, dt = now - (this.plateT || 0); this.plateT = now; this.plateD = (this.plateD || 0) * Math.exp(-Math.max(0, dt) / B.plateTau); return this.plateD; }
    plateCurve(d) { const B = this.cfg; return d <= B.plateDps ? 1 : Math.pow(B.plateDps / d, 1 - B.platePow); }
    plateMul(amount) { if (!this.cfg.plateDps) return 1; this.plateDecay(); this.plateD += amount / this.cfg.plateTau; return this.plateCurve(this.plateD); }
    plateNow() { if (!this.cfg.plateDps) return 0; return 1 - this.plateCurve(this.plateDecay()); }
    damage(amount, info) {
      if (!this.alive) return 0;
      if (this.invulnT > 0 || !this.active) {
        DK.logDamage({ src: info.src, tgt: 'boss', amt: 0, note: 'invulnerable', hp: this.hp });
        const s = this.scene, now = (s.gameT || 0) * 1000; // visible "immune" feedback, throttled on game time (review P2-3)
        if (this.active && now - (this._immT || 0) > 350) { this._immT = now; this.immuneShown = (this.immuneShown || 0) + 1; DK.floatText(s, this.x + Phaser.Math.Between(-30, 30), this.y - 70, '免疫', '#b8c0c8', 16); s.spark && s.spark(this.x + Phaser.Math.Between(-40, 40), this.y - 20, 0xcfe8ff); }
        return 0;
      }
      const dbg = info && info.src === 'dbg';
      if (dbg && amount >= this.hp) { this.hp = 0; this.alive = false; this.lockTxt.setVisible(false); this.scene.onBossDead(this); return amount; } // __dbg.win(): one call, any phase (N3)
      if (!dbg) { const raw = amount; amount *= this.plateMul(raw); this.plateLost += raw - amount; }
      const floor = dbg ? null : this.armorFloor();
      if (floor != null && this.hp - amount < floor) {
        const s = this.scene, now = (s.gameT || 0) * 1000;
        amount = Math.max(0, this.hp - floor); this.armorHits++;
        if (now - (this._armT || 0) > 450) { this._armT = now; DK.floatText(s, this.x + Phaser.Math.Between(-30, 30), this.y - 80, '装甲 ' + Math.ceil(this.armorLeft()) + 's', '#9fd3ff', 16); s.spark && s.spark(this.x + Phaser.Math.Between(-40, 40), this.y - 20, 0x9fd3ff); }
        if (amount <= 0) return 0;
      }
      this.hp -= amount; this.flashT = 0.06;
      if (this.hp <= this.cfg.phase3At && this.phase < 3) { this.hp = Math.max(this.hp, 1); this.setPhase(3); }
      else if (this.hp <= this.cfg.phase2At && this.phase < 2) this.setPhase(2);
      if (this.hp <= 0) { this.hp = 0; this.alive = false; this.lockTxt.setVisible(false); this.scene.onBossDead(this); }
      return amount;
    }
    update(dt) {
      if (!this.alive) return;
      const s = this.scene, p = s.player, B = this.cfg, spr = this.spr;
      const st = this.st;
      if (st.burnT > 0) { st.burnT -= dt; st.burnTick += dt; if (st.burnTick >= 0.5) { st.burnTick -= 0.5; s.damage(spr, DK.AMMO.burn.dps * st.burn * 0.5, { src: 'burn', noFlash: true, color: '#ff9a3a' }); } if (st.burnT <= 0) st.burn = 0; }
      if (st.frozenT > 0) { st.frozenT -= dt; if (st.frozenT <= 0) st.immuneT = DK.AMMO.freeze.immune; } else if (st.immuneT > 0) st.immuneT -= dt;
      if (st.steamCd > 0) st.steamCd -= dt;
      const slow = st.frozenT > 0 ? 0.35 : Math.max(0.4, 1 - 0.08 * st.frz);
      if (this.flashT > 0) { this.flashT -= dt; spr.setTintFill(0xffffff); this.turret.setTintFill(0xffffff); }
      else { this.plateRed = this.plateNow(); const armour = this.active && (this.armorLocked() || this.plateRed >= 0.15); // armour tint wins over burn/freeze (retest 2)
        const tint = armour ? 0x8fb0d0 : st.frozenT > 0 ? 0x9fe8ff : st.burn > 0 ? 0xffc090 : this.invulnT > 0 && Math.floor((s.gameT || 0) * 1000 / 90) % 2 ? 0x888888 : null; if (tint) { spr.setTint(tint); this.turret.setTint(tint); } else { spr.clearTint(); this.turret.clearTint(); } }
      spr.setDepth(spr.y + (spr.skin ? spr.skin.lift : 52)); this.turret.setDepth(spr.depth + 1);
      this.animate(dt);
      const tx = spr.x + 8, ty = spr.y - 6;
      this.turret.setPosition(tx, ty);
      const aim = Math.atan2(p.y - ty, p.x - tx);
      if (!this.active) { this.turret.setRotation(this.turretAng); return; }
      this.phaseT += dt; // game time in the current phase (装甲锁, N1)
      const lk = this.armorLocked(); // big on-boss hint while the lock holds HP (esp. phase 3 at 1 HP)
      this.lockTxt.setVisible(lk).setPosition(this.x, this.y - 130).setDepth(2000);
      if (lk) this.lockTxt.setText(`装甲锁定 ${Math.ceil(this.armorLeft())}s` + (this.phase === 3 ? ' 后可击毁' : ' 后进入下一阶段'));
      if (this.invulnT > 0) { this.invulnT -= dt; spr.setVelocity(0, spr.y < B.homeY ? Math.min(80, (B.homeY - spr.y) * 3) : 0); /* keep easing down off the HUD while invulnerable */ this.turret.setRotation(this.turretAng); return; }
      // turret tracking (slower while the cannon is locked)
      const turnRate = (this.cannonTele ? 0 : 1.6) * slow * dt;
      this.turretAng += Phaser.Math.Clamp(DK.angDiff(aim, this.turretAng), -turnRate, turnRate);
      this.turret.setRotation(this.turretAng);
      for (const k in this.t) this.t[k] -= dt * slow;
      // movement
      if (this.phase === 1) {
        spr.setVelocity(45 * this.dir * slow, Phaser.Math.Clamp((B.homeY - spr.y) * 3, -80, 80)); // settles on homeY within ~1 s of the entrance
        if (spr.x > DK.W - 220) this.dir = -1; if (spr.x < 220) this.dir = 1;
      } else if (this.phase === 2) {
        // top edge stays below the HUD title (review P2-6): sway between p2MinY and p2MinY+90, ease in fast from the phase-1 line
        const ty2 = B.p2MinY + 45 + Math.sin(s.time.now / 2400) * 45;
        spr.setVelocity(70 * this.dir * slow, Phaser.Math.Clamp((ty2 - spr.y) * 2.5, -80, 80));
        if (spr.y >= B.p2MinY) this.p2In = true;
        if (this.p2In && spr.y < B.p2MinY) { spr.y = B.p2MinY; if (spr.body.velocity.y < 0) spr.setVelocity(spr.body.velocity.x, 0); }
        if (spr.x > DK.W - 200) this.dir = -1; if (spr.x < 200) this.dir = 1;
      } else { // phase 3: roll to a spot where the whole barrage sprite is on screen, then stay put
        const dx = B.p3X - spr.x, dy = B.p3Y - spr.y;
        spr.setVelocity(Math.abs(dx) > 3 ? Phaser.Math.Clamp(dx * 1.5, -90, 90) : 0, Math.abs(dy) > 3 ? Phaser.Math.Clamp(dy * 1.5, -90, 90) : 0);
      }
      if (spr.y >= B.minY) this.arrived = true; // (the entrance drives in from above, so clamp only after arriving)
      if (this.arrived && spr.y < B.minY) { spr.y = B.minY; if (spr.body.velocity.y < 0) spr.setVelocity(spr.body.velocity.x, 0); } // never let the sprite top leave the screen
      // cannon: red line telegraph then a fast straight shell
      if (this.phase < 3) {
        if (!this.cannonTele && this.t.cannon <= 0) { this.cannonTele = { t: B.cannonTele }; DK.sfx(s, 'sniper_warn', { volume: 0.5 }); }
        if (this.cannonTele) {
          this.cannonTele.t -= dt;
          const cf = 1 / ((DK.ARTX.boss_cannon && DK.ARTX.boss_cannon.fps) || 12); // start the sheet one frame early so 01 = the shot
          if (!this.cannonTele.anim && this.cannonTele.t <= cf) { this.cannonTele.anim = true; this.doAct('cannon', 0.5 + cf); }
          if (this.cannonTele.t <= 0) {
            const a = this.turretAng, mx = tx + Math.cos(a) * 80, my = ty + Math.sin(a) * 80;
            s.enemyShoot(mx, my, a, B.cannonSpeed, B.cannonDmg, 'boss_cannon', { cannon: true });
            DK.sfx(s, 'tank_cannon'); s.cameras.main.shake(180, 0.008); s.muzzleFlash(mx, my, a, true, 2.2);
            this.cannonTele = null; this.t.cannon = this.phase === 1 ? 3.0 : 4.6;
          }
        }
        // MG bursts
        if (this.t.mg <= 0 && !this.cannonTele) {
          this.mgShots = this.phase === 1 ? 8 : 5; this.t.mg = this.phase === 1 ? 2.8 : 3.6; this.mgT = 0; this.doAct('mg', this.mgShots * 0.09 + 0.1);
        }
        if (this.mgShots > 0) {
          this.mgT -= dt;
          if (this.mgT <= 0) { this.mgT = 0.09; this.mgShots--; const a = aim + Phaser.Math.FloatBetween(-0.1, 0.1); s.enemyShoot(spr.x - 40 * this.dir, spr.y + 10, a, B.mgSpeed, B.mgDmg, 'boss_mg'); DK.sfx(s, 'shoot_mg', { volume: 0.5, minGap: 60 }); }
        }
      }
      if (this.phase === 2) {
        if (this.t.mine <= 0) {
          this.t.mine = 2.2; this.doAct('deploy', 0.75);
          const px = p.x, py = p.y; // boss_deploy drops the mine on frame 02
          this.onActFrame('deploy', 2, () => { s.layMine(this.spr.x - 70 * this.dir + Phaser.Math.Between(-20, 20), this.spr.y + Phaser.Math.Between(-30, 30)); if (Math.random() < 0.5) s.layMine(Phaser.Math.Clamp(px + Phaser.Math.Between(-120, 120), 60, DK.W - 60), Phaser.Math.Clamp(py + Phaser.Math.Between(-120, 120), 60, DK.H - 60), true); });
        }
        if (this.t.minion <= 0) {
          this.t.minion = 11; this.doAct('deploy', 0.75);
          this.onActFrame('deploy', 2, () => {
            if (this.phase !== 2 || !this.alive) return; // deploy frame landed after the switch to phase 3
            const alive = s.enemies.getChildren().filter(e => e.alive).length;
            for (let i = 0; i < Math.min(2, B.minionMax - alive); i++) s.spawnWithTelegraph(Math.random() < 0.6 ? 'charger' : 'rifle', Phaser.Math.Clamp(this.spr.x + (i ? 110 : -110), 80, DK.W - 80), Phaser.Math.Clamp(this.spr.y + 90, 80, DK.H - 80));
          });
        }
      }
      if (this.phase === 3) {
        if (this.t.ring <= 0) {
          this.t.ring = B.ringEvery; const n = B.ringCount, gapStart = Math.floor(Math.random() * n);
          this.ringOff += 0.21;
          for (let i = 0; i < n; i++) {
            if (((i - gapStart + n) % n) < B.ringGap) continue; // dodge gap
            const a = this.ringOff + i / n * PI2;
            s.enemyShoot(spr.x + Math.cos(a) * 60, spr.y + Math.sin(a) * 50, a, B.ringSpeed, B.ringDmg, 'boss_ring', { boss: true });
          }
          DK.sfx(s, 'shoot_split', { volume: 0.6, minGap: 100 });
        }
        if (this.t.mg <= 0) { this.t.mg = 3.2; for (let i = -1; i <= 1; i++) s.enemyShoot(tx, ty, aim + i * 0.12, 210, B.mgDmg, 'boss_mg'); }
      }
      if (this.t.taunt <= 0) { this.t.taunt = 16 + Math.random() * 8; const tt = DK.pick(DK.story.boss_anvil.taunts); if (tt) DK.speech(s, { speaker: 'anvil', text: DK.fmt(tt) }, 2200); }
    }
    // one-shot "acts" (cannon / mg / deploy) override the phase's base loop for a moment
    // run fn on the given frame of a one-shot act (e.g. boss_deploy drops its mine on 02)
    onActFrame(name, frame, fn) {
      const a = DK.ARTX['boss_' + name], d = this.spr.realSkin && a ? frame * 1000 / (a.fps || 8) : 0;
      if (!d) return fn();
      this.scene.time.delayedCall(d, () => { if (this.alive) fn(); });
    }
    doAct(name, secs) { this.act = name; this.actT = secs; if (this.spr.realSkin) DK.anim(this.spr, name, { restart: name !== 'mg' }); }
    animate(dt) {
      const spr = this.spr; if (!spr.realSkin) return;
      spr.setFlipX(this.scene.player.x < spr.x);
      this.actT -= dt;
      if (this.actT > 0 && this.act) return void DK.anim(spr, this.act);
      if (this.phase >= 3) DK.anim(spr, this.active && this.invulnT <= 0 ? 'barrage' : 'damaged');
      else DK.anim(spr, this.hp < this.maxHp * 0.5 ? 'damaged' : 'move');
    }
    drawFx(g) {
      if (!this.alive) return;
      if (this.cannonTele) {
        const a = this.turretAng, tx = this.spr.x + 8, ty = this.spr.y - 6, k = 1 - this.cannonTele.t / DK.BOSS.cannonTele;
        g.lineStyle(2 + k * 10, 0xff2020, 0.25 + 0.5 * k).lineBetween(tx, ty, tx + Math.cos(a) * 1300, ty + Math.sin(a) * 1300);
      }
    }
    destroy() { this.turret.destroy(); this.spr.destroy(); }
  };
})(window.DK);

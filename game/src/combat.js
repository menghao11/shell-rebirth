// Shared: camera, arena building, the player (马克中士) controller, and combat helpers installed on scenes.
(function (DK) {
  const PI2 = Math.PI * 2;
  DK.setupCamera = function (scene) {
    const cam = scene.cameras.main;
    cam.setOrigin(0, 0).setZoom(DK.R).setScroll(0, 0);
    // no cam.setBounds(): Phaser clamps scroll assuming a centred origin, which shifts the world by W/2 when zoom (DPR) > 1
    scene.physics && scene.physics.world && scene.physics.world.setBounds(0, 0, DK.W, DK.H);
  };
  DK.angDiff = (a, b) => Phaser.Math.Angle.Wrap(a - b);

  // ------------------------------------------------------------ arena
  // opts: { floor:'floor', door:true }  -> returns { walls(staticGroup), door }
  DK.buildArena = function (scene, opts) {
    opts = opts || {};
    const W = DK.W, H = DK.H, T = DK.WALL;
    const fk = opts.floor || 'floor', fs = DK.artSize(fk), ftex = (DK.ART[fk] && DK.ART[fk].tex) || fk;
    let floor;
    const mix = /^tile_ground_concrete/.test(ftex) ? ['tile_ground_concrete_256', 'tile_ground_concrete_b_256', 'tile_ground_concrete_c_256'].filter(k => scene.textures.exists(k)) : [];
    if (mix.length > 1) {
      // concrete: pick a variant per cell (60/20/20) so the slabs don't repeat; baked into one RenderTexture
      const R = DK.R; // bake at device resolution so it stays sharp on retina
      floor = scene.add.renderTexture(0, 0, W * R, H * R).setOrigin(0).setScale(1 / R).setDepth(-100);
      const cw = fs[0], ch = fs[1], stamp = scene.make.image({ x: 0, y: 0, key: mix[0], add: false }).setOrigin(0);
      for (let y = 0; y < H; y += ch) for (let x = 0; x < W; x += cw) {
        const r = Math.random(), k = r < 0.6 ? mix[0] : r < 0.8 ? mix[1] : mix[mix.length - 1];
        stamp.setTexture(k).setDisplaySize(cw * R, ch * R); floor.draw(stamp, x * R, y * R);
      }
      stamp.destroy();
    } else {
      floor = scene.add.tileSprite(0, 0, W, H, ftex).setOrigin(0).setDepth(-100);
      const ft = scene.textures.get(ftex).getSourceImage();
      floor.setTileScale(fs[0] / ft.width, fs[1] / ft.height);
    }
    if (opts.tint) floor.setTint(opts.tint);
    const walls = scene.physics.add.staticGroup();
    const wk = 'wall', ws = DK.artSize(wk), wt = scene.textures.get(wk).getSourceImage();
    const addWall = (x, y, w, h) => {
      const v = scene.add.tileSprite(x, y, w, h, wk).setOrigin(0).setDepth(-50);
      v.setTileScale(ws[0] / wt.width, ws[1] / wt.height);
      const r = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
      walls.add(r); return r;
    };
    const gap = 110, gy = H / 2 - gap / 2;
    addWall(0, 0, W, T); addWall(0, H - T, W, T); addWall(0, 0, T, H);
    if (opts.door) { addWall(W - T, 0, T, gy); addWall(W - T, gy + gap, T, H - gy - gap); }
    else addWall(W - T, 0, T, H);
    let door = null;
    if (opts.door) {
      const img = scene.add.image(W - T / 2, H / 2, 'door').setDepth(-40); DK.applyArt(img, 'door'); img.setDisplaySize(T, gap);
      const body = scene.add.rectangle(W - T / 2, H / 2, T, gap, 0, 0); walls.add(body);
      const arrow = DK.txt(scene, W - T - 40, H / 2, '➜', { fontSize: '34px', color: '#7ee07a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(5).setVisible(false);
      door = { img, body, arrow, open: false, y0: gy, y1: gy + gap };
      door.setOpen = function (on) {
        if (on === door.open) return; door.open = on;
        img.setVisible(!on); arrow.setVisible(on);
        body.body.enable = !on;
        if (on) scene.tweens.add({ targets: arrow, x: arrow.x + 12, yoyo: true, repeat: -1, duration: 420 });
      };
    }
    return { walls, door, floor };
  };

  // ------------------------------------------------------------ player
  DK.Player = class {
    constructor(scene, x, y, opts) {
      opts = opts || {};
      this.scene = scene; this.run = opts.run || null; this.canFight = !!opts.canFight;
      const P = DK.PLAYER;
      this.spr = scene.physics.add.sprite(x, y, 'player'); DK.applySkin(this.spr, 'player');
      DK.setCircleBody(this.spr, P.radius); this.spr.setCollideWorldBounds(true);
      this.radius = P.radius;
      this.gun = scene.add.image(x, y, 'gun_pistol').setOrigin(0.2, 0.5);
      this.aimG = DK.touchMode ? scene.add.graphics() : null; // touch: aim-direction indicator on the player
      this.aimAng = 0; this.dashT = 0; this.dashDir = { x: 1, y: 0 }; this.dashCdT = 0; this.iframes = 0; this.fireCd = 0;
      this.reloadT = 0; this.empowered = false; this.shots = 0; this.firingFor = 0; this.idleFire = 0;
      this.charges = this.run ? this.run.dashCharges : P.dashCharges;
      this.grenadeAim = false; this.dead = false; this.god = !!DK.god;
      this.moveDir = { x: 1, y: 0 };
      const kb = scene.input.keyboard;
      this.keys = kb ? kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Q,R,E,ONE,TWO,SHIFT,F') : null;
      if (kb) kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
      scene.input.on('wheel', (p, o, dx, dy) => { if (this.canFight && !this.paused()) this.swap(dy > 0 ? 1 : -1); });
      this.ghosts = []; this.hurtT = 0; this.throwT = 0; this.shootT = 0;
      this.updateGun();
    }
    paused() { return this.scene.isPaused && this.scene.isPaused(); }
    get x() { return this.spr.x; } get y() { return this.spr.y; }
    weapon() {
      const r = this.run, id = r ? r.weapon : 'pistol', b = DK.WEAPONS[id];
      const w = Object.assign({ id }, b);
      if (!r) return w;
      if (r.mods.bigcal) { w.dmg *= 1.4; w.rate *= 0.75; }
      if (r.mods.recycle) w.mag = Math.max(1, Math.round(w.mag * 0.8));
      if (r.mods.ring) w.reload += 0.3;
      if (r.mods.frenzy && this.firingFor >= 3) w.rate *= 1.5;
      w.dmg *= r.dmgMul;
      return w;
    }
    updateGun() { const k = this.run ? DK.WEAPONS[this.run.weapon].art : 'gun_pistol'; DK.applyArt(this.gun, k); this.gun.setOrigin(0.2, 0.5); this.gun.setVisible(!this.spr.realSkin); }
    // hero_throw: wind-up 00-02, grenade leaves the hand on frame 03
    throwGrenadeTimed() {
      const s = this.scene, a = DK.ARTX.hero_throw, real = this.spr.realSkin && a;
      const fps = (a && a.fps) || 14, delay = real ? 3 * 1000 / fps : 0;
      this.throwT = real ? (a.frame_count || 6) / fps : 0.35;
      if (real) DK.anim(this.spr, 'throw', { restart: true });
      s.time.delayedCall(delay, () => { if (this.dead || !s.scene.isActive()) return; const t = this.grenadeTarget(); s.throwGrenade(this.x, this.y - 10, t.x, t.y); });
    }
    // depth sorts by the feet line so the 3/4 view overlaps correctly
    feetY() { return this.spr.y + (this.spr.skin ? this.spr.skin.lift : DK.PLAYER.radius); }
    animate(moving) {
      const spr = this.spr; if (!spr.realSkin) return;
      const mg = this.run && this.run.weapon === 'mg';
      const st = this.dead ? 'death' : this.dashT > 0 ? 'dash' : this.throwT > 0 ? 'throw' : this.hurtT > 0 ? 'hurt'
        : this.reloadT > 0 ? 'reload' : this.shootT > 0 ? (mg ? 'shoot_mg' : 'shoot') : moving ? 'run' : 'idle';
      DK.anim(spr, st);
    }
    swap(dir) {
      const r = this.run; if (!r || r.weapons.length < 2) return;
      const i = r.weapons.indexOf(r.weapon); r.weapon = r.weapons[(i + (dir || 1) + r.weapons.length) % r.weapons.length];
      this.reloadT = 0; this.updateGun(); DK.sfx(this.scene, 'pickup_weapon', { volume: 0.5 });
      DK.floatText(this.scene, this.x, this.y - 34, DK.WEAPONS[r.weapon].name, '#f2e6c9', 14);
    }
    startReload() {
      const w = this.weapon(), r = this.run;
      if (!r || this.reloadT > 0 || r.mag[w.id] >= w.mag) return;
      this.reloadT = w.reload; this.reloadTotal = w.reload; DK.sfx(this.scene, 'reload');
      if (r.mods.ring) for (let i = 0; i < 8; i++) this.scene.fireBullet(this.x, this.y, i / 8 * PI2, { dmg: w.dmg, speed: w.speed, procMul: w.procMul, src: 'ring' });
    }
    input() {
      const k = this.keys, tc = this.scene.touch;
      let mx = 0, my = 0;
      if (k) { mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0); my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0); }
      if (tc && (tc.move.x || tc.move.y)) { mx = tc.move.x; my = tc.move.y; }
      const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
      return { mx, my };
    }
    nearestEnemy(maxD) {
      const list = this.scene.targets ? this.scene.targets() : []; let best = null, bd = maxD * maxD;
      for (const e of list) { const d = (e.x - this.x) ** 2 + (e.y - this.y) ** 2; if (d < bd) { bd = d; best = e; } }
      return best;
    }
    drain() { if (this.keys) for (const key of Object.values(this.keys)) Phaser.Input.Keyboard.JustDown(key); }
    update(dt) {
      const s = this.scene, P = DK.PLAYER, spr = this.spr;
      this.spr.setDepth(this.feetY()); this.gun.setDepth(this.feetY() + 1);
      this.hurtT -= dt; this.throwT -= dt; this.shootT -= dt;
      if (this.dead) { spr.setVelocity(0); this.animate(false); return; }
      if (this.paused() || (s.inputBlockUntil && s.time.now < s.inputBlockUntil)) { spr.setVelocity(0); this.drain(); this.grenadeAim = false; this.animate(false); return; }
      const k = this.keys, tc = this.scene.touch, mouse = s.input.mousePointer;
      const { mx, my } = this.input();
      if (mx || my) { const l = Math.hypot(mx, my); this.moveDir = { x: mx / l, y: my / l }; }
      // ---- aim
      let wantFire = false;
      if (DK.touchMode && tc) {
        // 开火 joystick only: no auto-aim, no auto-fire on touch (user request)
        if (tc.fireHeld) { wantFire = true; if (tc.fireAim.active) this.aimAng = Math.atan2(tc.fireAim.y, tc.fireAim.x); }
        else if (mx || my) this.aimAng = Math.atan2(my, mx); // not firing: face where you walk
      } else if (mouse) {
        this.aimAng = Math.atan2(mouse.y / DK.R - this.y, mouse.x / DK.R - this.x);
        wantFire = mouse.isDown && mouse.leftButtonDown && mouse.leftButtonDown();
      }
      if (DK.autoFire) { const t = this.nearestEnemy(900); if (t) { this.aimAng = Math.atan2(t.y - this.y, t.x - this.x); wantFire = true; } } // debug/test helper
      // ---- dash
      this.dashCdT -= dt;
      if (this.dashCdT <= 0 && this.charges < (this.run ? this.run.dashCharges : P.dashCharges)) { this.charges++; this.dashCdT = this.charges < (this.run ? this.run.dashCharges : P.dashCharges) ? P.dashCd : 0; }
      const dashPressed = (k && (Phaser.Input.Keyboard.JustDown(k.SPACE) || Phaser.Input.Keyboard.JustDown(k.SHIFT))) || (tc && tc.consume && tc.consume('dash'));
      if (dashPressed && this.dashT <= 0 && this.charges > 0) {
        this.charges--; if (this.dashCdT <= 0) this.dashCdT = P.dashCd;
        this.dashT = P.dashTime; this.dashDir = (mx || my) ? { x: this.moveDir.x, y: this.moveDir.y } : { x: Math.cos(this.aimAng), y: Math.sin(this.aimAng) };
        DK.sfx(s, 'dash');
      }
      if (this.dashT > 0) {
        this.dashT -= dt; if (this.dashT <= 0) this.iframes = Math.max(this.iframes, P.dashGrace || 0); spr.setVelocity(this.dashDir.x * P.dashSpeed, this.dashDir.y * P.dashSpeed);
        if (!this._gh || s.time.now - this._gh > 30) { this._gh = s.time.now; this.ghost(); }
      } else spr.setVelocity(mx * P.speed, my * P.speed);
      this.iframes -= dt;
      // ---- visuals
      const left = Math.cos(this.aimAng) < 0;
      if ((DK.ART.player || {}).flip !== false) spr.setFlipX(left);
      spr.setAlpha(this.iframes > 0 && !this.dashT && Math.floor(s.time.now / 70) % 2 ? 0.5 : 1);
      this.gun.setPosition(spr.x + Math.cos(this.aimAng) * 6, spr.y + 6 + Math.sin(this.aimAng) * 6).setRotation(this.aimAng).setFlipY(left);
      this.animate(!!(mx || my));
      if (this.aimG) this.drawAim(wantFire);
      if (!this.canFight || !this.run) return;
      // ---- weapon
      const r = this.run, w = this.weapon();
      if (k) { if (Phaser.Input.Keyboard.JustDown(k.ONE)) this.selectWeapon(0); if (Phaser.Input.Keyboard.JustDown(k.TWO)) this.selectWeapon(1); if (Phaser.Input.Keyboard.JustDown(k.F)) this.swap(1); }
      if (tc && tc.consume('swap')) this.swap(1);
      if ((k && Phaser.Input.Keyboard.JustDown(k.R)) || (tc && tc.consume('reload'))) this.startReload();
      if (this.reloadT > 0) {
        this.reloadT -= dt;
        if (this.reloadT <= 0) { this.reloadT = 0; r.mag[w.id] = w.mag; this.empowered = true; DK.sfx(s, 'reload', { volume: 0.6 }); }
      }
      this.fireCd -= dt;
      if (!wantFire || this.reloadT > 0) this.fireCd = Math.max(this.fireCd, 0); // no banked shots while idle
      if (wantFire) { this.firingFor += dt; this.idleFire = 0; } else { this.idleFire += dt; if (this.idleFire > 0.3) this.firingFor = 0; }
      if (wantFire && this.reloadT <= 0 && this.fireCd <= 0) {
        if (r.mag[w.id] > 0) this.fire(w);
        else { DK.sfx(s, 'dry_fire', { minGap: 200 }); this.startReload(); }
      }
      if (r.mag[w.id] > w.mag) r.mag[w.id] = w.mag;
      // ---- grenade (hold to preview, release to throw)
      const qDown = (k && k.Q.isDown) || (tc && tc.down.grenade);
      if (qDown && r.grenades > 0) this.grenadeAim = true;
      else if (this.grenadeAim) { this.grenadeAim = false; if (r.grenades > 0) { r.grenades--; this.throwGrenadeTimed(); } }
    }
    selectWeapon(i) { const r = this.run; if (r.weapons[i] && r.weapon !== r.weapons[i]) { r.weapon = r.weapons[i]; this.reloadT = 0; this.updateGun(); } }
    grenadeTarget() {
      const G = DK.GRENADE; let tx, ty;
      const mouse = this.scene.input.mousePointer;
      if (!DK.touchMode && mouse) { tx = mouse.x / DK.R; ty = mouse.y / DK.R; }
      else { tx = this.x + Math.cos(this.aimAng) * G.range * 0.8; ty = this.y + Math.sin(this.aimAng) * G.range * 0.8; }
      let dx = tx - this.x, dy = ty - this.y; const d = Math.hypot(dx, dy);
      if (d > G.range) { dx *= G.range / d; dy *= G.range / d; }
      return { x: Phaser.Math.Clamp(this.x + dx, 40, DK.W - 40), y: Phaser.Math.Clamp(this.y + dy, 40, DK.H - 40) };
    }
    fire(w) {
      const s = this.scene, r = this.run;
      r.mag[w.id]--; this.shots++; this.shootT = w.id === 'mg' ? 0.15 : 0.3;
      if (w.id !== 'mg' && this.spr.realSkin && this.dashT <= 0 && this.reloadT <= 0) DK.anim(this.spr, 'shoot', { restart: true, startFrame: 1 }); // hero_shoot fires on 01
      this.fireCd = Math.max(this.fireCd, -1 / w.rate) + 1 / w.rate; // accumulate so 4/s and 10/s are exact (review P1-2)
      let dmg = w.dmg, crit = Math.random() < w.crit || (r.mods.fifth && this.shots % 5 === 0);
      if (crit) dmg *= DK.PLAYER.critMul;
      const powered = this.empowered; if (powered) { dmg *= DK.PLAYER.passiveMul; this.empowered = false; }
      const a = this.aimAng + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-w.spread, w.spread));
      const reach = this.spr.realSkin ? 26 : 28, mx = this.x + Math.cos(this.aimAng) * reach, my = this.y + (this.spr.realSkin ? -2 : 6) + Math.sin(this.aimAng) * reach;
      s.fireBullet(mx, my, a, { dmg, crit, powered, speed: w.speed, procMul: w.procMul, src: w.id, size: w.bullet });
      DK.sfx(s, powered ? 'shoot_pistol_power' : w.sfx, { minGap: 40 });
      s.muzzleFlash(mx, my, this.aimAng, powered);
      s.ejectCasing(this.x, this.y, this.aimAng);
      s.cameras.main.shake(50, (powered ? 0.004 : w.id === 'mg' ? 0.0015 : 0.0025));
    }
    ghost() {
      const sp = this.spr, g = this.scene.add.image(this.x, this.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(sp.scaleX, sp.scaleY).setFlipX(sp.flipX).setTintFill(0x7ee07a).setAlpha(0.45).setDepth(sp.depth - 1);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
    }
    invulnerable() { return this.god || DK.god || this.dashT > 0 || this.iframes > 0 || this.dead; }
    drawAim(firing) { // grenade-style aim guide: row of bright dots (dark outline) shrinking/fading to a target ring; gold while firing
      const g = this.aimG; g.clear(); if (this.dead || !this.canFight) return;
      const c = Math.cos(this.aimAng), sn = Math.sin(this.aimAng), ox = this.x, oy = this.y + 2, col = firing ? 0xffd040 : 0xffffff, L = 250, n = 11;
      g.setDepth(this.spr.depth + 2);
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1), d = 32 + k * (L - 52), x = ox + c * d, y = oy + sn * d, r = 5.5 - k * 3, a = 1 - k * 0.55;
        g.fillStyle(0x101418, a * 0.8).fillCircle(x, y, r + 2); g.fillStyle(col, a).fillCircle(x, y, r);
      }
      const tx = ox + c * L, ty = oy + sn * L;
      g.lineStyle(6, 0x101418, 0.7).strokeCircle(tx, ty, 12); g.lineStyle(3, col, 0.9).strokeCircle(tx, ty, 12);
      g.fillStyle(0x101418, 0.7).fillCircle(tx, ty, 3.5); g.fillStyle(col, 0.95).fillCircle(tx, ty, 2);
    }
    destroy() { this.spr.destroy(); this.gun.destroy(); this.aimG && this.aimG.destroy(); }
  };
})(window.DK);

// Shared: camera, arena building, the player (马克中士) controller, and combat helpers installed on scenes.
(function (DK) {
  const PI2 = Math.PI * 2;
  DK.setupCamera = function (scene) {
    const cam = scene.cameras.main;
    cam.setOrigin(0, 0).setZoom(DK.R).setScroll(0, 0);
    if (DK.installNoShake) DK.installNoShake(cam);
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
    const mix = opts.floorMix ? opts.floorMix.map(k => (DK.ART[k] && DK.ART[k].tex) || k).filter(k => scene.textures.exists(k)) : /^tile_ground_concrete/.test(ftex) ? ['tile_ground_concrete_256', 'tile_ground_concrete_b_256', 'tile_ground_concrete_c_256'].filter(k => scene.textures.exists(k)) : [];
    if (mix.length > 1) {
      // concrete: pick a variant per cell (60/20/20) so the slabs don't repeat; baked into one RenderTexture
      const R = DK.R; // bake at device resolution so it stays sharp on retina
      floor = scene.add.renderTexture(0, 0, W * R, H * R).setOrigin(0).setScale(1 / R).setDepth(-100);
      const cw = fs[0], ch = fs[1], stamp = scene.make.image({ x: 0, y: 0, key: mix[0], add: false }).setOrigin(0);
      for (let y = 0; y < H; y += ch) for (let x = 0; x < W; x += cw) {
        const r = Math.random(), wts = opts.floorWeights || [0.6, 0.2, 0.2]; let acc = 0, k = mix[mix.length - 1];
        for (let i = 0; i < mix.length; i++) { acc += wts[i] != null ? wts[i] : 0; if (r < acc) { k = mix[i]; break; } }
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
    const wk = opts.wall || 'wall', ws = DK.artSize(wk), wt = scene.textures.get(wk).getSourceImage();
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
      this.aimG = scene.add.graphics(); // aim guide: short facing stub (touch) / dotted precision line while aiming a burst
      this.precise = false; this.preciseAng = 0; this.burstQ = 0; this.burstT = 0; this.burstCd = 0; this.burstAng = 0; this.bursts = 0; this.dashes = 0;
      this.aimAng = 0; this.dashT = 0; this.dashDir = { x: 1, y: 0 }; this.dashCdT = 0; this.iframes = 0; this.fireCd = 0;
      this.reloadT = 0; this.powerShots = 0; this.poweredFired = 0; this.recycleN = 0; this.recycled = 0; this.shots = 0; this.firingFor = 0; this.idleFire = 0;
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
      const t = this.grenadeTarget(); this.lastGrenade = { x: t.x, y: t.y }; // landing point locked at release; later aim/move/facing changes don't matter
      s.time.delayedCall(delay, () => { if (this.dead || !s.scene.isActive()) return; s.throwGrenade(this.x, this.y - 10, t.x, t.y); });
    }
    // depth sorts by the feet line so the 3/4 view overlaps correctly
    feetY() { return this.spr.y + (this.spr.skin ? this.spr.skin.lift : DK.PLAYER.radius); }
    animate(moving, dt) {
      const spr = this.spr; if (!spr.realSkin) return;
      const mg = this.run && this.run.weapon === 'mg';
      // Hold "moving" for 90ms so a one-frame input gap can't restart run or pop into the shoot pose.
      if (moving) this._moveHold = 0.09; else this._moveHold = Math.max(0, (this._moveHold || 0) - (dt || 0));
      const shown = !!(moving || this._moveHold > 0);
      this.shownMoving = shown;
      if (this._dashAnimT > 0) this._dashAnimT = Math.max(0, this._dashAnimT - (dt || 0));
      const dashKey = spr.skin && spr.skin.anims && spr.skin.anims.dash;
      const dashPlaying = !!(spr.anims && spr.anims.isPlaying && spr.anims.currentAnim && spr.anims.currentAnim.key === dashKey);
      const dashing = this.dashT > 0 || this._dashAnimT > 0 || dashPlaying;
      // moving always shows the run cycle (legs keep walking while auto-fire / aim / burst run); the shoot pose is for standing still
      const st = this.dead ? 'death' : dashing ? 'dash' : this.throwT > 0 ? 'throw' : this.hurtT > 0 ? 'hurt'
        : shown ? 'run' : this.reloadT > 0 ? 'reload' : this.shootT > 0 ? (mg ? 'shoot_mg' : 'shoot') : 'idle';
      DK.anim(spr, st);
    }
    swap(dir) {
      const r = this.run; if (!r || r.weapons.length < 2) return;
      const i = r.weapons.indexOf(r.weapon); r.weapon = r.weapons[(i + (dir || 1) + r.weapons.length) % r.weapons.length];
      this.reloadT = 0; this.updateGun(); DK.sfx(this.scene, 'pickup_weapon', { volume: 0.5 });
      DK.floatText(this.scene, this.x, this.y - 34, DK.WEAPONS[r.weapon].name, '#f2e6c9', 14);
    }
    ringBurst() { // 爆环 mod: 8 bullets all around every few seconds of combat (reload is gone)
      const w = this.weapon(); for (let i = 0; i < 8; i++) this.scene.fireBullet(this.x, this.y, i / 8 * PI2, { dmg: w.dmg, speed: w.speed, procMul: w.procMul, src: 'ring' });
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
      if (this.dead) { spr.setVelocity(0); this.animate(false, dt); return; }
      if (this.paused() || (s.inputBlockUntil && s.time.now < s.inputBlockUntil)) { spr.setVelocity(0); this.drain(); this.grenadeAim = false; this.precise = false; this.animate(false, dt); if (this.aimG) this.aimG.clear(); return; }
      const k = this.keys, tc = this.scene.touch, mouse = s.input.mousePointer;
      const { mx, my } = this.input(); this.moving = !!(mx || my);
      if (mx || my) { const l = Math.hypot(mx, my); this.moveDir = { x: mx / l, y: my / l }; }
      // ---- aim (user-approved scheme)
      // default: always firing in combat, along the 瞄准 stick while it is pushed, otherwise along the walk/facing direction
      // (desktop: the mouse), with soft aim assist (bullets bend toward an enemy within PLAYER.assistDeg). No lock-on.
      // precision: dragging 瞄准 (desktop: holding the left button) shows the dotted aim line; releasing fires a 5-shot burst.
      let wantFire = s.state === 'fight' || s.state === 'boss';
      let precise = false, released = false;
      if (DK.touchMode && tc) {
        if (tc.fireHeld && tc.fireAim.active) { this.aimAng = Math.atan2(tc.fireAim.y, tc.fireAim.x); precise = true; this.aimedOnce = true; }
        else if (mx || my) this.aimAng = Math.atan2(my, mx);
        released = this.precise && !tc.fireHeld; // lifted the thumb while aiming (sliding back to the centre first = cancel)
      } else if (mouse) {
        this.aimAng = Math.atan2(mouse.y / DK.R - this.y, mouse.x / DK.R - this.x);
        precise = !!(mouse.leftButtonDown && mouse.leftButtonDown()) && !(s.uiLock && s.uiLock());
        released = this.precise && !precise;
      }
      if (precise) this.preciseAng = this.aimAng;
      if (released && wantFire && this.canFight && this.run && this.burstCd <= 0 && this.burstQ <= 0) this.startBurst(this.preciseAng);
      this.precise = precise;
      if (this.burstQ > 0) this.aimAng = this.burstAng;
      if (DK.autoFire) { const t = this.nearestEnemy(900); if (t) { this.aimAng = Math.atan2(t.y - this.y, t.x - this.x); wantFire = true; } } // debug/test helper
      // ---- dash
      this.dashCdT -= dt;
      if (this.dashCdT <= 0 && this.charges < (this.run ? this.run.dashCharges : P.dashCharges)) { this.charges++; this.dashCdT = this.charges < (this.run ? this.run.dashCharges : P.dashCharges) ? P.dashCd : 0; }
      const dashPressed = (k && (Phaser.Input.Keyboard.JustDown(k.SPACE) || Phaser.Input.Keyboard.JustDown(k.SHIFT))) || (tc && tc.consume && tc.consume('dash'));
      if (dashPressed && this.dashT <= 0 && this.charges > 0) {
        this.charges--; if (this.dashCdT <= 0) this.dashCdT = P.dashCd;
        if (this.canFight) this.powerShots = P.passiveShots; // 马克被动: dash → next 3 shots +50 %
        this.dashT = P.dashTime; this.dashes++; this.dashDir = (mx || my) ? { x: this.moveDir.x, y: this.moveDir.y } : { x: Math.cos(this.aimAng), y: Math.sin(this.aimAng) };
        // Visual length of the dash sheet (play_fps is n/dashTime ≈ 70). If a frame
        // would still be in flight when dashT hits 0, a short tail finishes it; dashTime itself is unchanged.
        const da = DK.ARTX && DK.ARTX.hero_dash;
        const dn = (da && da.frame_count) || 12;
        const dfps = (da && da.play_fps) || (DK.animRate && DK.animRate(da)) || (dn / P.dashTime);
        this._dashAnimT = dn / dfps;
        if (spr.realSkin) DK.anim(spr, 'dash', { restart: true });
        DK.sfx(s, 'dash');
      }
      if (this.dashT > 0) {
        this.dashT -= dt; if (this.dashT <= 0) this.iframes = Math.max(this.iframes, P.dashGrace || 0); spr.setVelocity(this.dashDir.x * P.dashSpeed, this.dashDir.y * P.dashSpeed);
        if (!this._gh || s.time.now - this._gh > 30) { this._gh = s.time.now; this.ghost(); }
      } else spr.setVelocity(mx * P.speed, my * P.speed);
      this.iframes -= dt;
      // ---- visuals
      const ac = Math.cos(this.aimAng);
      if (ac < -0.18) this._faceLeft = true; else if (ac > 0.18) this._faceLeft = false;
      const left = this._faceLeft == null ? ac < 0 : this._faceLeft;
      if ((DK.ART.player || {}).flip !== false) spr.setFlipX(left);
      spr.setAlpha(this.iframes > 0 && !this.dashT && Math.floor(s.time.now / 70) % 2 ? 0.5 : 1);
      this.gun.setPosition(spr.x + Math.cos(this.aimAng) * 6, spr.y + 6 + Math.sin(this.aimAng) * 6).setRotation(this.aimAng).setFlipY(left);
      this.animate(this.moving, dt);
      if (this.aimG) this.drawAim(wantFire, precise);
      if (!this.canFight || !this.run) return;
      // ---- weapon
      const r = this.run, w = this.weapon();
      if (k) { if (Phaser.Input.Keyboard.JustDown(k.ONE)) this.selectWeapon(0); if (Phaser.Input.Keyboard.JustDown(k.TWO)) this.selectWeapon(1); if (Phaser.Input.Keyboard.JustDown(k.F)) this.swap(1); }
      if (tc && tc.consume('swap')) this.swap(1);
      this.fireCd -= dt;
      if (!wantFire) this.fireCd = Math.max(this.fireCd, 0); // no banked shots while idle
      if (wantFire) { this.firingFor += dt; this.idleFire = 0; } else { this.idleFire += dt; if (this.idleFire > 0.3) this.firingFor = 0; }
      this.burstCd -= dt;
      if (this.burstQ > 0) { // burst replaces the normal auto-fire while it plays
        this.burstT -= dt; this.fireCd = Math.max(this.fireCd, 0);
        while (this.burstT <= 0 && this.burstQ > 0) { this.fire(w, { burst: true, ang: this.burstAng }); this.burstQ--; this.burstT += DK.PLAYER.burst.gap; }
      } else if (wantFire && this.fireCd <= 0) this.fire(w);
      if (r.mods.ring && wantFire) { this.ringT = (this.ringT == null ? 4 : this.ringT) - dt; if (this.ringT <= 0) { this.ringT = 4; this.ringBurst(); } }
      // ---- grenade (hold to preview, release to throw)
      const qDown = (k && k.Q.isDown) || (tc && tc.down.grenade);
      if (qDown && r.grenades > 0) this.grenadeAim = true;
      else if (this.grenadeAim) { this.grenadeAim = false; if (r.grenades > 0) { r.grenades--; this.throwGrenadeTimed(); } }
    }
    startBurst(ang) {
      const B = DK.PLAYER.burst; this.burstQ = B.n; this.burstT = 0; this.burstAng = ang; this.burstCd = B.cd; this.bursts++;
      DK.sfx(this.scene, 'dash', { volume: 0.25, minGap: 0 });
    }
    // soft aim assist: the enemy closest to the shot line within assistDeg (+ a little for its size) and in reach, or null
    assistTarget(base, w) {
      const s = this.scene, P = DK.PLAYER, list = s.targets ? s.targets() : [], reach = Math.min(DK.W, (w.speed || 760) * 1.05), cone = Phaser.Math.DegToRad(P.assistDeg);
      let best = null, bs = 1e9;
      for (const e of list) {
        if (e.isBoss && e.bossRef && e.bossRef.invulnT > 0) continue;
        const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy); if (d > reach || d < 1) continue;
        const r = e.isBoss ? (e.body ? e.body.width / 2 : 50) : (e.radius || 14), ang = Math.atan2(dy, dx), diff = Math.abs(DK.angDiff(ang, base));
        if (diff > cone + Math.atan2(r, d) * 0.5) continue;
        const sc = diff + d / 2500; if (sc < bs) { bs = sc; best = { obj: e, ang }; }
      }
      return best;
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
    fire(w, o) {
      o = o || {};
      const s = this.scene, r = this.run, base = o.ang != null ? o.ang : this.aimAng;
      this.shots++; this.shootT = w.id === 'mg' ? 0.15 : 0.3;
      if (w.id !== 'mg' && this.spr.realSkin && this.dashT <= 0 && this.reloadT <= 0 && !this.moving && !this.shownMoving) DK.anim(this.spr, 'shoot', { restart: true, startFrame: 1 }); // hero_shoot fires on 01; no shoot-pose restart while walking
      if (!o.burst) this.fireCd = Math.max(this.fireCd, -1 / w.rate) + 1 / w.rate; // accumulate so 4/s and 10/s are exact (review P1-2)
      let dmg = w.dmg, crit = Math.random() < w.crit || (r.mods.fifth && this.shots % 5 === 0);
      if (crit) dmg *= DK.PLAYER.critMul;
      const powered = this.powerShots > 0; // 马克被动「冲锋射手」 (dash-charged shots)
      if (powered) { this.powerShots--; this.poweredFired++; dmg *= DK.PLAYER.passiveMul; }
      if (r.mods.recycle && ++this.recycleN >= 30) { // 弹壳回收: every 30 shots → +1 grenade (≤ 2 per room)
        this.recycleN = 0; if (this.recycled < 2) { this.recycled++; r.grenades++; DK.floatText(s, this.x, this.y - 34, '弹壳回收 手雷+1', '#f2c14e', 14); DK.sfx(s, 'pickup_scrap', { volume: 0.5 }); }
      }
      let a = base, home = null;
      if (!o.burst) { // auto-fire: weapon spread, then soft assist (start half-way toward the target and bend in flight)
        a += Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-w.spread, w.spread));
        const t = DK.PLAYER.assistDeg > 0 && this.assistTarget(base, w);
        if (t) { home = t.obj; a = base + DK.angDiff(t.ang, base) * 0.5 + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-w.spread, w.spread)) * 0.3; this.assisted = (this.assisted || 0) + 1; }
      }
      const reach = this.spr.realSkin ? 26 : 28, mx = this.x + Math.cos(base) * reach, my = this.y + (this.spr.realSkin ? -2 : 6) + Math.sin(base) * reach;
      s.fireBullet(mx, my, a, { dmg, crit, powered, speed: w.speed, procMul: w.procMul, src: w.id, size: w.bullet, home, burst: !!o.burst });
      DK.sfx(s, powered ? 'shoot_pistol_power' : w.sfx, { minGap: 40 });
      s.muzzleFlash(mx, my, base, powered);
      s.ejectCasing(this.x, this.y, base);
    }
    ghost() {
      const sp = this.spr, g = this.scene.add.image(this.x, this.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(sp.scaleX, sp.scaleY).setFlipX(sp.flipX).setTintFill(0x7ee07a).setAlpha(0.45).setDepth(sp.depth - 1);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
    }
    invulnerable() { return this.god || DK.god || this.dashT > 0 || this.iframes > 0 || this.dead; }
    aimTarget() { // first thing a bullet fired now along aimAng would hit: a damageable enemy (in reach, no wall/cover/barrel first, not a heavy's shield face)?
      const s = this.scene, c = Math.cos(this.aimAng), sn = Math.sin(this.aimAng), ox = this.x, oy = this.y, w = DK.WEAPONS[s.run ? s.run.weapon : 'pistol'] || DK.WEAPONS.pistol;
      let best = Math.min(DK.W + DK.H, (w.speed || 760) * 1.05), hit = null;
      const rayBox = b => { if (!b || !b.enable && b.enable !== undefined) return; let t0 = 0, t1 = best; // slab test vs an AABB body
        for (const [o, d, lo, hi] of [[ox, c, b.x, b.x + b.width], [oy, sn, b.y, b.y + b.height]]) {
          if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) return; continue; }
          let a1 = (lo - o) / d, a2 = (hi - o) / d; if (a1 > a2) [a1, a2] = [a2, a1]; t0 = Math.max(t0, a1); t1 = Math.min(t1, a2); if (t0 > t1) return; }
        if (t0 > 0 && t0 < best) { best = t0; hit = null; } };
      for (const g of [s.walls, s.covers, s.barrels]) if (g && g.getChildren) g.getChildren().forEach(o => o.active !== false && rayBox(o.body));
      const tryHit = (x, y, r, obj) => { const dx = x - ox, dy = y - oy, t = dx * c + dy * sn; if (t <= 0 || t >= best) return; const perp = Math.abs(dx * sn - dy * c); if (perp < r + 4) { best = t; hit = obj; } };
      if (s.enemies) s.enemies.getChildren().forEach(e => { if (e.active && e.alive) tryHit(e.x, e.y, (e.cfg && e.cfg.radius) || 14, e); });
      const bo = s.boss; if (bo && bo.alive && bo.spr && bo.spr.active) tryHit(bo.spr.x, bo.spr.y, (bo.spr.body ? bo.spr.body.width / 2 : 50), bo.spr);
      if (!hit) return null;
      if (hit.isBoss) { const B = hit.bossRef; return B && B.active && !(B.invulnT > 0) ? hit : null; }
      if (hit.etype === 'heavy' && DK.shieldBlocks(hit, c, sn, ox + c * best, oy + sn * best)) return null;
      return hit;
    }
    drawAim(firing, precise) { // precision (dragging 瞄准 / holding the mouse): grenade-style dotted line, light red on a damageable target, blue-grey while the burst recharges; otherwise a short facing stub (touch)
      const g = this.aimG; g.clear(); if (this.dead || !this.canFight) return;
      this.aimHot = !!this.aimTarget();
      const c = Math.cos(this.aimAng), sn = Math.sin(this.aimAng), ox = this.x, oy = this.y + 2;
      g.setDepth(this.spr.depth + 2);
      if (!precise) {
        if (!DK.touchMode) return;
        for (let i = 0; i < 3; i++) { const d = 30 + i * 16, x = ox + c * d, y = oy + sn * d, r = 4 - i * 0.8; g.fillStyle(0x101418, 0.45).fillCircle(x, y, r + 1.5); g.fillStyle(this.aimHot ? 0xff9e9e : 0xffffff, 0.55 - i * 0.12).fillCircle(x, y, r); }
        return;
      }
      const cd = this.burstCd > 0, col = cd ? 0x9fb4c8 : this.aimHot ? (firing ? 0xff8a78 : 0xff9e9e) : firing ? 0xffd040 : 0xffffff, L = 250, n = 11;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1), d = 32 + k * (L - 52), x = ox + c * d, y = oy + sn * d, r = 5.5 - k * 3, a = 1 - k * 0.55;
        g.fillStyle(0x101418, a * 0.8).fillCircle(x, y, r + 2); g.fillStyle(col, a).fillCircle(x, y, r);
      }
      const tx = ox + c * L, ty = oy + sn * L;
      g.lineStyle(6, 0x101418, 0.7).strokeCircle(tx, ty, 12); g.lineStyle(3, col, 0.9).strokeCircle(tx, ty, 12);
      if (cd) g.lineStyle(3, 0xffffff, 0.9).beginPath().arc(tx, ty, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - this.burstCd / DK.PLAYER.burst.cd)).strokePath();
      g.fillStyle(0x101418, 0.7).fillCircle(tx, ty, 3.5); g.fillStyle(col, 0.95).fillCircle(tx, ty, 2);
    }
    destroy() { this.spr.destroy(); this.gun.destroy(); this.aimG && this.aimG.destroy(); }
  };
})(window.DK);

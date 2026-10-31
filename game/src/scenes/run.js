// Run scene: one room per scene start. DK.run holds the run state across rooms.
(function (DK) {
  const PI2 = Math.PI * 2;
  const rnd = Phaser.Math.FloatBetween;

  DK.RunScene = class extends Phaser.Scene {
    constructor() { super('Run'); }
    init() { if (!DK.run) DK.run = DK.newRun(); this.run = DK.run; }
    create() {
      // Phaser reuses the Scene instance on restart()/start(): reset ALL per-visit state here (review P0-1)
      Object.assign(this, { leaving: false, rewardOpen: false, restUsed: false, merchantTalked: false, sold: {}, hostage: null, hostageFreed: false,
        merchantSpr: null, _waveWait: false, sparkCount: 0, bossStart: 0, pauseUI: null, touch: null, modal: null, pausedFlag: false, _immuneT: 0, gameT: 0 });
      DK.setupCamera(this);
      const run = this.run, room = DK.ROOMS[run.room], W = DK.W, H = DK.H;
      this.room = room; this.state = 'start'; this.wave = -1; this.pending = 0; this.dlg = new DK.Dialogue(this);
      this.modal = null; this.pausedFlag = false; this.boss = null; this.interactables = [];
      this.cameras.main.fadeIn(250, 0, 0, 0);
      const arena = DK.buildArena(this, { door: room.type !== 'boss', floor: room.type === 'boss' ? 'floor_boss' : room.type === 'shop' ? 'floor_shop' : 'floor', tint: room.type === 'boss' ? 0xe8d8cc : null });
      this.walls = arena.walls; this.door = arena.door;
      // groups
      this.covers = this.physics.add.staticGroup();
      this.barrels = this.physics.add.staticGroup();
      this.enemies = this.physics.add.group();
      this.pBullets = this.physics.add.group({ maxSize: 260 });
      this.eBullets = this.physics.add.group({ maxSize: 400 });
      this.mines = [];
      this.fxG = this.add.graphics().setDepth(800);      // telegraphs, previews, hp bars
      this.player = new DK.Player(this, 70, H / 2, { run, canFight: true });
      // layout
      if (room.type === 'combat' || room.type === 'hostage') this.layoutCovers(room.type === 'hostage');
      if (room.type === 'boss') this.layoutBossRoom();
      // physics
      const P = this.player.spr;
      this.physics.add.collider(P, this.walls); this.physics.add.collider(P, this.covers); this.physics.add.collider(P, this.barrels);
      this.physics.add.collider(this.enemies, this.walls); this.physics.add.collider(this.enemies, this.covers); this.physics.add.collider(this.enemies, this.barrels);
      this.physics.add.collider(this.enemies, this.enemies);
      this.physics.add.overlap(this.pBullets, this.walls, b => this.killBullet(b));
      this.physics.add.overlap(this.pBullets, this.covers, (b, c) => { if (!b.active) return; this.spark(b.x, b.y, 0xffe08a); this.killBullet(b); this.hitCover(c, b.dmg); });
      this.physics.add.overlap(this.pBullets, this.barrels, (b, br) => { if (!b.active) return; this.killBullet(b); this.hitBarrel(br, b.dmg, b.src); });
      this.physics.add.overlap(this.pBullets, this.enemies, (b, e) => this.bulletHit(b, e));
      this.physics.add.overlap(this.eBullets, this.walls, b => this.killEBullet(b, true));
      this.physics.add.overlap(this.eBullets, this.covers, b => this.killEBullet(b, true));
      this.physics.add.overlap(this.eBullets, this.barrels, (b, br) => { if (!b.active) return; this.killEBullet(b, true); this.hitBarrel(br, b.dmg, 'enemy'); });
      this.physics.add.overlap(this.eBullets, P, (p, b) => { const bb = b === P ? p : b; if (!bb.active) return; if (this.hurtPlayer(bb.dmg, bb.src)) this.killEBullet(bb, false); });
      this.physics.add.overlap(this.enemies, P, (a, b) => { const e = a === P ? b : a; if (e.alive && e.cfg.contact) this.hurtPlayer(e.cfg.contact, e.etype + '_contact'); });
      if (this.boss) {
        this.physics.add.collider(P, this.boss.spr, () => { if (this.boss && this.boss.alive && this.boss.active) this.hurtPlayer(DK.BOSS.contact, 'boss_contact'); });
        this.physics.add.overlap(this.pBullets, this.boss.spr, (a, b) => { const bl = a === this.boss.spr ? b : a; this.bulletHit(bl, this.boss.spr); });
        this.physics.add.collider(this.enemies, this.boss.spr);
      }
      // controls
      this.setupControls();
      this.createHUD();
      // room start
      const label = room.type === 'boss' ? 'BOSS · 铁砧' : `房间 ${run.room + 1}/5 · ${room.type === 'shop' ? (run.shopType === 'merchant' ? '军火商' : '休息站') : room.name}`;
      DK.banner(this, label, { size: 30, color: room.type === 'boss' ? '#ff5a4e' : '#f2c14e', dur: 1400 });
      DK.music(this, room.type === 'boss' ? 'bgm_boss' : 'bgm_stage1');
      if (room.type === 'combat' || room.type === 'hostage') { this.door.setOpen(false); this.time.delayedCall(900, () => this.nextWave()); this.state = 'fight'; }
      else if (room.type === 'shop') { this.door.setOpen(true); this.setupShop(); this.state = 'open'; }
      else if (room.type === 'boss') this.startBoss();
      this.events.once('shutdown', () => { this.dlg.close(true); });
      DK.current = this;
    }

    // ------------------------------------------------------------- layout
    rectFree(x, y, w, h, pad) {
      pad = pad || 0;
      for (const o of this.covers.getChildren().concat(this.barrels.getChildren())) {
        const b = o.getBounds(); if (x + w / 2 + pad > b.left && x - w / 2 - pad < b.right && y + h / 2 + pad > b.top && y - h / 2 - pad < b.bottom) return false;
      }
      return true;
    }
    // Covers/barrels: an invisible footprint rectangle is the physics body; the art is a separate visual
    // (anchored bottom-centre at the footprint's bottom edge), so hitboxes never depend on image size.
    addCover(x, y, kind) {
      const kinds = Object.keys(DK.COVERS).filter(k => DK.hasArt(k));
      let body;
      if (kinds.length) {
        const k = kind && DK.hasArt(kind) ? kind : Phaser.Utils.Array.GetRandom(kinds), C = DK.COVERS[k], a = DK.ARTX[k];
        const [hw, hh] = C.hit;
        body = this.add.rectangle(x, y, hw, hh, 0, 0); this.covers.add(body);
        const v = this.add.image(x, y + hh / 2, k).setOrigin(a.anchor[0] / a.frame_size[0], a.anchor[1] / a.frame_size[1]).setScale(C.scale / (a.res_scale || 1)).setDepth(y + hh / 2);
        Object.assign(body, { visual: v, kind: k, hp: C.hp || 0, debris: C.debris });
      } else {
        const [w, h] = DK.artSize('cover');
        body = this.add.rectangle(x, y, w, h - 8, 0, 0); this.covers.add(body);
        const v = this.add.image(x, y, 'cover'); DK.applyArt(v, 'cover'); v.setDepth(y + h / 2);
        Object.assign(body, { visual: v, kind: 'cover', hp: 0 });
      }
      return body;
    }
    hitCover(c, dmg) {
      if (!c.active || !c.hp) return;
      c.hp -= dmg;
      if (c.hp > 0) { c.visual.setTintFill(0xffffff); this.time.delayedCall(50, () => c.visual.active && c.visual.clearTint()); return; }
      const x = c.x, y = c.y + c.height / 2;
      c.visual.destroy(); c.destroy();
      DK.sfx(this, 'explosion_small', { volume: 0.4 }); this.spark(x, y - 10, 0xc89a5a, 8);
      if (c.debris && DK.hasArt(c.debris)) { const a = DK.ARTX[c.debris]; this.add.image(x, y, c.debris).setOrigin(a.anchor[0] / a.frame_size[0], a.anchor[1] / a.frame_size[1]).setScale(DK.COVERS[c.kind].scale / (a.res_scale || 1)).setDepth(y - 30); }
    }
    addBarrel(x, y) {
      const b = this.add.rectangle(x, y, 24, 22, 0, 0); this.barrels.add(b); b.hp = DK.BARREL.hp;
      if (DK.hasArt('barrel')) {
        const a = DK.ARTX.barrel;
        b.visual = this.add.sprite(x, y + 11, 'barrel', 0).setOrigin(a.anchor[0] / a.frame_size[0], a.anchor[1] / a.frame_size[1]).setScale(DK.BARREL_ART.scale / (a.res_scale || 1)).setDepth(y + 11);
        b.sheet = true;
      } else { b.visual = this.add.image(x, y, 'barrel'); DK.applyArt(b.visual, 'barrel'); b.visual.setDepth(y + 11); }
      return b;
    }
    layoutCovers(hostage) {
      const W = DK.W, H = DK.H, n = Phaser.Math.Between(3, 5);
      let tries = 0, placed = 0;
      while (placed < n && tries++ < 80) {
        const x = Phaser.Math.Between(200, W - 180), y = Phaser.Math.Between(90, H - 90);
        if (Math.abs(y - H / 2) < 70 && x > W - 260) continue;
        if (hostage && Math.hypot(x - W * 0.62, y - H / 2) < 110) continue;
        if (!this.rectFree(x, y, 64, 40, 60)) continue;
        this.addCover(x, y); placed++;
      }
      for (let i = 0, t = 0; i < 2 && t < 60; t++) {
        const x = Phaser.Math.Between(220, W - 160), y = Phaser.Math.Between(80, H - 80);
        if (!this.rectFree(x, y, 30, 34, 50)) continue; this.addBarrel(x, y); i++;
      }
      if (hostage) {
        const hx = W * 0.62, hy = H / 2;
        this.hostage = this.add.sprite(hx, hy, 'hostage'); DK.applySkin(this.hostage, 'hostage'); this.hostage.setDepth(hy + 18);
        this.hostageFreed = false;
      }
    }
    layoutBossRoom() {
      const W = DK.W, H = DK.H;
      [[240, 380, 'cover_concrete_barrier'], [W - 240, 380, 'cover_concrete_barrier'], [W / 2, 455, 'cover_sandbags']].forEach(([x, y, k]) => this.addCover(x, y, k));
      this.addBarrel(140, 120); this.addBarrel(W - 140, 120);
      this.boss = new DK.Boss(this, W / 2, -90);
    }

    // ------------------------------------------------------------- controls & pause
    setupControls() {
      if (DK.touchMode) {
        this.touch = new DK.TouchControls(this, [
          { id: 'dash', label: '冲刺', x: DK.W - 70, y: DK.H - 80, r: 42 },
          { id: 'grenade', label: '手雷', x: DK.W - 165, y: DK.H - 52, r: 32 },
          { id: 'reload', label: '换弹', x: DK.W - 60, y: DK.H - 180, r: 28 },
          { id: 'swap', label: '切枪', x: DK.W - 130, y: DK.H - 140, r: 26 },
          { id: 'act', label: '互动', x: DK.W - 250, y: DK.H - 44, r: 30, hidden: true }
        ]);
        this.touch.on('press', id => { if (id === 'act') this.tryInteract(); });
      }
      const kb = this.input.keyboard;
      if (kb) {
        kb.on('keydown-E', () => { if (!this.isPaused()) this.tryInteract(); });
        kb.on('keydown-ESC', () => this.togglePause()); kb.on('keydown-P', () => this.togglePause());
      }
      this.game.events.on('blur', this._blur = () => { if (this.touch) this.touch.reset(); });
      this.events.once('shutdown', () => this.game.events.off('blur', this._blur));
    }
    isPaused() { return this.dlg.active || !!this.modal || this.pausedFlag || this.state === 'dead' || this.state === 'won'; }
    uiLock() { return this.dlg.active || !!this.modal || this.pausedFlag; }
    togglePause() {
      if (this.state === 'dead' || this.state === 'won' || this.dlg.active || (this.modal && !this.pauseUI)) return;
      if (this.pauseUI) { this.pauseUI.forEach(o => o.destroy()); this.pauseUI = null; this.modal = null; this.pausedFlag = false; this.physics.resume(); return; }
      this.pausedFlag = true; this.physics.pause(); if (this.touch) this.touch.reset();
      const W = DK.W, H = DK.H, objs = [];
      objs.push(this.add.rectangle(W / 2, H / 2, W, H, 0, 0.7).setScrollFactor(0).setDepth(1100).setInteractive());
      objs.push(DK.txt(this, W / 2, 120, '暂停', { fontSize: '40px', fontStyle: 'bold', color: '#f2c14e' }).setOrigin(0.5).setDepth(1101));
      objs.push(DK.button(this, W / 2, 210, 240, 50, '继续', () => this.togglePause(), { depth: 1102 }));
      objs.push(...DK.volumeControls(this, W / 2, 290, 1102));
      objs.push(DK.button(this, W / 2, 420, 240, 46, '放弃本轮（计为阵亡）', () => { this.togglePause(); this.playerDie('abandon'); }, { depth: 1102, fontSize: 16, stroke: 0xe74c3c }));
      if (!DK.touchMode) objs.push(DK.txt(this, W / 2, 490, 'WASD 移动 · 鼠标瞄准/左键射击 · 空格 冲刺 · 按住Q 手雷 · R 换弹 · 1/2/滚轮 切枪 · E 互动', { fontSize: '13px', color: '#aaa' }).setOrigin(0.5).setDepth(1101));
      this.pauseUI = objs; this.modal = 'pause';
    }

    // ------------------------------------------------------------- waves
    nextWave() {
      if (this.state !== 'fight') return;
      this.wave++;
      const waves = this.room.waves || [];
      if (this.wave >= waves.length) return this.roomCleared();
      const spec = waves[this.wave];
      Object.entries(spec).forEach(([type, n]) => { for (let i = 0; i < n; i++) this.time.delayedCall(i * 160, () => this.spawnWithTelegraph(type)); });
      if (this.wave > 0) DK.banner(this, `第 ${this.wave + 1} 波`, { size: 22, color: '#ffffff', dur: 900 });
    }
    findSpawn(r) {
      for (let t = 0; t < 40; t++) {
        const x = Phaser.Math.Between(120, DK.W - 80), y = Phaser.Math.Between(70, DK.H - 70);
        if (Math.hypot(x - this.player.x, y - this.player.y) < 240) continue;
        if (!this.rectFree(x, y, r * 2, r * 2, 8)) continue;
        if (this.hostage && Math.hypot(x - this.hostage.x, y - this.hostage.y) < 50) continue;
        return { x, y };
      }
      return { x: DK.W - 120, y: Phaser.Math.Between(80, DK.H - 80) };
    }
    spawnWithTelegraph(type, x, y) {
      if (x == null) ({ x, y } = this.findSpawn(DK.ENEMIES[type].radius + 4));
      this.pending++;
      const ring = this.add.circle(x, y, 22, 0xff3030, 0.25).setStrokeStyle(2, 0xff3030).setDepth(5);
      this.tweens.add({ targets: ring, scale: 0.4, alpha: 0.9, duration: 650, onComplete: () => {
        ring.destroy(); this.pending--;
        if (this.state === 'dead' || this.state === 'won') return;
        DK.spawnEnemy(this, type, x, y);
      } });
    }
    targets() {
      const t = this.enemies.getChildren().filter(e => e.alive);
      if (this.boss && this.boss.alive && this.boss.active) t.push(this.boss.spr);
      return t;
    }

    // ------------------------------------------------------------- bullets
    fireBullet(x, y, ang, o) {
      const b = this.pBullets.get(x, y, 'bullet_player'); if (!b) return null;
      b.setActive(true).setVisible(true); b.body.enable = true; b.body.reset(x, y);
      // art variant follows the newest ammo type (split shows on the fragments)
      const ammo = this.run.ammoTypes, last = ammo[ammo.length - 1];
      let key = o.frag ? 'bullet_split' : last === 'burn' ? 'bullet_fire' : last === 'freeze' ? 'bullet_ice' : 'bullet_player';
      if (!DK.ART[key].real) key = 'bullet_player';
      DK.applyArt(b, key); b.clearTint();
      const sz = o.size || 8, base = DK.artSize(key), k = sz / 8;
      b.setDisplaySize(base[0] * k * (o.frag ? 0.8 : 1), base[1] * k * (o.frag ? 0.8 : 1));
      DK.setCircleBody(b, 4 * k);
      b.setRotation(ang).setDepth(700);
      const real = DK.ART[key].real;
      const tint = o.powered ? 0xff8a4a : o.crit ? 0xffb0ff : (!real && o.frag) ? 0xfff07a : null;
      if (tint) b.setTint(tint);
      const sp = o.speed || 700; b.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
      Object.assign(b, { dmg: o.dmg, crit: !!o.crit, frag: !!o.frag, ignore: o.ignore || null, procMul: o.procMul || 1, src: o.src || 'gun', born: this.time.now, life: o.life || 1100 });
      return b;
    }
    killBullet(b) { if (b.active) { b.disableBody(true, true); } }
    enemyShoot(x, y, ang, speed, dmg, src, o) {
      o = o || {};
      const key = o.cannon ? 'shell_cannon' : o.boss ? 'bullet_boss' : 'bullet_enemy';
      const b = this.eBullets.get(x, y, key); if (!b) return;
      b.setActive(true).setVisible(true); b.body.enable = true; b.body.reset(x, y);
      DK.applyArt(b, key); b.setDepth(710).setRotation(ang); b.clearTint();
      if (o.boss) { // phase-3 ring: 1.5x, hot pink with a white rim so it reads on concrete (review P2-5)
        b.setTexture('ring_bullet').setDisplaySize(18, 18).setOrigin(0.5);
      }
      if (o.big) { const s0 = DK.artSize(key); b.setDisplaySize(s0[0] * 1.5, s0[1] * 1.1); b.setTint(0xffd0d0); }
      DK.setCircleBody(b, o.cannon ? 9 : o.boss ? 6 : 4.5);
      b.ring = !!o.boss;
      b.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
      b.dmg = dmg; b.src = src; b.cannon = !!o.cannon; b.born = this.time.now;
      const fl = { rifle: 0.8, sniper: 1.1, heavy: 1.0, boss_mg: 0.9 }[src]; // fx_muzzle_flash overlay at the muzzle
      if (fl && !o.noFlash) this.muzzleFlash(x, y, ang, false, fl);
    }
    killEBullet(b, hitWall) {
      if (!b.active) return;
      if (b.cannon) this.explode(b.x, b.y, 42, 10, { src: 'boss_cannon_blast', hurtPlayer: true, hurtEnemies: false, size: 0.6, quiet: true });
      else if (hitWall) this.spark(b.x, b.y, 0xff8a6a);
      b.disableBody(true, true);
    }
    bulletHit(b, e) {
      if (!b.active || !e.active) return;
      if (b.ignore === e) return;
      const isBoss = !!e.isBoss;
      if (!isBoss && !e.alive) return;
      // 重装兵 shield: blocks bullets arriving within ±shieldArc of its facing
      if (e.etype === 'heavy') {
        const from = Math.atan2(-b.body.velocity.y, -b.body.velocity.x);
        if (Math.abs(DK.angDiff(from, e.facing)) < Phaser.Math.DegToRad(e.cfg.shieldArc)) {
          this.spark(b.x, b.y, 0xbfe0ff, 6); DK.sfx(this, 'shield_block', { minGap: 70 });
          DK.logDamage({ src: b.src, tgt: 'heavy', amt: 0, note: 'shield', hp: e.hp });
          this.killBullet(b); return;
        }
      }
      const dmg = b.dmg, run = this.run;
      this.killBullet(b);
      this.damage(e, dmg, { src: b.src + (b.frag ? '_frag' : ''), crit: b.crit, x: b.x, y: b.y });
      DK.sfx(this, 'enemy_hit', { minGap: 45 });
      // ammo procs
      const target = isBoss ? e.bossRef : e;
      if (!target || (isBoss ? !target.alive : !e.alive && !target.st)) return;
      const mul = DK.USE_PROC_MUL ? b.procMul : 1;
      if (run.ammoTypes.includes('burn') && Math.random() < DK.AMMO.burn.chance * mul) this.addBurn(target, e);
      if (run.ammoTypes.includes('freeze') && Math.random() < DK.AMMO.freeze.chance * mul) this.addFreeze(target, e);
      if (run.ammoTypes.includes('split') && !b.frag) {
        const a0 = Math.atan2(b.body.velocity.y, b.body.velocity.x), A = DK.AMMO.split;
        for (let i = 0; i < A.count; i++) {
          const a = a0 + Phaser.Math.DegToRad((i - 1) * A.fan);
          this.fireBullet(b.x + Math.cos(a) * 4, b.y + Math.sin(a) * 4, a, { dmg: dmg * A.ratio, frag: true, ignore: e, procMul: b.procMul, speed: 560, src: b.src, life: 450, size: 7 });
        }
        DK.sfx(this, 'shoot_split', { minGap: 80, volume: 0.7 });
      }
    }

    // ------------------------------------------------------------- statuses & reactions
    addBurn(t, spr) {
      const st = t.st; if (!st) return;
      if ((st.frz > 0 || st.frozenT > 0) && st.steamCd <= 0) return this.steam(t, spr);
      const was = st.burn;
      st.burn = Math.min(DK.AMMO.burn.maxStacks, st.burn + 1); st.burnT = DK.AMMO.burn.dur;
      if (!was) DK.sfx(this, 'ignite', { minGap: 120, volume: 0.6 });
      DK.logDamage({ src: 'proc', tgt: this.tname(spr), amt: 0, note: 'burn x' + st.burn, hp: t.hp });
    }
    addFreeze(t, spr) {
      const st = t.st; if (!st || st.immuneT > 0 || st.frozenT > 0) return;
      if (st.burn > 0 && st.steamCd <= 0) return this.steam(t, spr);
      st.frz++;
      const need = DK.AMMO.freeze.stacks * (spr.isBoss ? 2 : 1);
      DK.logDamage({ src: 'proc', tgt: this.tname(spr), amt: 0, note: 'freeze ' + st.frz + '/' + need, hp: t.hp });
      if (st.frz >= need) { st.frz = 0; st.frozenT = DK.AMMO.freeze.freezeDur; DK.sfx(this, 'freeze'); DK.floatText(this, spr.x, spr.y - 30, '冻结', '#9fe8ff', 15); }
    }
    steam(t, spr) {
      const st = t.st; st.burn = 0; st.burnT = 0; st.frz = 0; st.steamCd = 0.5;
      const S = DK.STEAM;
      DK.logDamage({ src: 'reaction', tgt: this.tname(spr), amt: 0, note: 'steam explosion' });
      this.explode(spr.x, spr.y, S.radius, S.dmg, { src: 'steam', hurtPlayer: false, hurtEnemies: true, knock: S.knock, steam: true });
      DK.floatText(this, spr.x, spr.y - 40, '蒸汽爆炸!', '#e8fbff', 22);
    }
    tname(spr) { return spr.isBoss ? 'boss' : spr.etype || 'barrel'; }

    // ------------------------------------------------------------- damage
    damage(spr, amt, info) {
      info = info || {};
      if (!spr || !spr.active) return;
      amt = Math.round(amt * 10) / 10;
      if (spr.isBoss) {
        const dealt = spr.bossRef.damage(amt, info);
        if (dealt > 0) { DK.logDamage({ src: info.src, tgt: 'boss', amt: dealt, crit: !!info.crit, hp: Math.round(spr.bossRef.hp) }); this.dmgNumber(info.x || spr.x, info.y || spr.y - 40, dealt, info); }
        return;
      }
      if (!spr.alive) return;
      spr.hp -= amt; if (!info.noFlash) { spr.flashT = 0.06; spr.hurtT = 0.16; }
      DK.logDamage({ src: info.src, tgt: spr.etype, amt, crit: !!info.crit, hp: Math.max(0, Math.round(spr.hp * 10) / 10) });
      this.dmgNumber(info.x || spr.x, info.y || spr.y - 20, amt, info);
      if (spr.hp <= 0) this.killEnemy(spr, info.src);
    }
    dmgNumber(x, y, amt, info) {
      const big = info.crit; const v = amt % 1 ? amt.toFixed(1) : amt;
      DK.floatText(this, x + rnd(-6, 6), y, big ? v + '!' : String(v), info.color || (big ? '#ff8aff' : '#ffffff'), big ? 18 : 13);
    }
    killEnemy(e, src) {
      if (!e.alive) return;
      const run = this.run;
      if (src !== 'self') {
        run.kills++;
        if (run.mods.recycle) { const w = this.player.weapon(); run.mag[w.id] = Math.min(w.mag, run.mag[w.id] + 2); }
        if (e.realSkin) this.corpse(e); else this.explode(e.x, e.y, 24, 0, { src: 'fx', visualOnly: true, size: 0.45, quiet: true });
        DK.sfx(this, 'explosion_small', { volume: 0.55, minGap: 60 });
      }
      DK.logDamage({ src, tgt: e.etype, amt: 0, note: 'killed' });
      DK.removeEnemy(e);
      this.time.delayedCall(10, () => this.enemies.remove(e));
    }
    corpse(e) { // play the death sheet on a detached sprite, then fade it out
      const c = this.add.sprite(e.x, e.y, e.texture.key, e.frame.name).setFlipX(e.flipX);
      c.skin = e.skin; c.realSkin = true; c.setDepth(e.depth - 1);
      DK.anim(c, 'death'); c.clearTint();
      this.tweens.add({ targets: c, alpha: 0, delay: 1400, duration: 600, onComplete: () => c.destroy() });
    }
    hurtPlayer(amt, src) {
      const p = this.player;
      if (this.state === 'dead' || this.state === 'won' || this.isPaused()) return false;
      if (p.invulnerable()) { if (DK.god && !p.dead) DK.logDamage({ src, tgt: 'player', amt: 0, note: 'god', hp: this.run.hp }); return false; }
      const run = this.run; run.hp = Math.max(0, run.hp - amt);
      p.iframes = DK.PLAYER.hurtIframes;
      DK.logDamage({ src, tgt: 'player', amt, hp: run.hp });
      DK.sfx(this, 'player_hurt', { minGap: 80 });
      this.cameras.main.shake(140, 0.008); this.cameras.main.flash(90, 160, 0, 0);
      p.hurtT = 0.22; p.spr.setTintFill(0xffffff); this.time.delayedCall(80, () => p.spr.active && p.spr.clearTint());
      DK.floatText(this, p.x, p.y - 30, '-' + amt, '#ff6a6a', 16);
      if (run.hp <= 0) this.playerDie(src);
      return true;
    }

    // ------------------------------------------------------------- explosions & effects
    explode(x, y, r, dmg, o) {
      o = o || {};
      const size = o.size || 1;
      const img = this.add.sprite(x, y, 'explosion').setDepth(850);
      DK.applyArt(img, 'explosion'); const es = DK.artSize('explosion'); const s0 = (r * 2) / es[0];
      if (o.steam) img.setTint(0xe0f8ff);
      if (DK.ART.explosion.real) { // art-team sheet: play it at blast size
        img.setDisplaySize(es[0] * s0 * 1.25, es[1] * s0 * 1.25).setRotation(rnd(-0.4, 0.4));
        img.once('animationcomplete', () => img.destroy());
        this.time.delayedCall(1500, () => img.active && img.destroy());
      } else {
        img.setDisplaySize(es[0] * s0 * 0.4, es[1] * s0 * 0.4);
        this.tweens.add({ targets: img, displayWidth: es[0] * s0, displayHeight: es[1] * s0, alpha: 0, duration: o.steam ? 520 : 380, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
      }
      const ring = this.add.circle(x, y, r, 0xffffff, 0).setStrokeStyle(o.steam ? 5 : 3, o.steam ? 0xbff4ff : 0xffd27a, 0.9).setDepth(851).setScale(0.3);
      this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: o.steam ? 450 : 300, onComplete: () => ring.destroy() });
      if (o.steam) for (let i = 0; i < 10; i++) { const a = i / 10 * PI2, c = this.add.circle(x, y, rnd(8, 16), 0xffffff, 0.7).setDepth(852); this.tweens.add({ targets: c, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, alpha: 0, scale: 2, duration: 600, onComplete: () => c.destroy() }); }
      if (o.visualOnly) return;
      this.cameras.main.shake(o.steam ? 260 : 200, o.steam ? 0.012 : 0.008 * size);
      if (!o.quiet) DK.sfx(this, o.steam ? 'explosion_steam' : (r >= 60 ? 'explosion_large' : 'explosion_small'), { minGap: 50 });
      if (dmg <= 0) return;
      if (o.hurtEnemies !== false) {
        this.enemies.getChildren().slice().forEach(e => {
          if (!e.alive) return; const d = Math.hypot(e.x - x, e.y - y);
          if (d < r + e.radius) {
            this.damage(e, dmg, { src: o.src });
            if (e.alive && o.knock && e.body) { const a = Math.atan2(e.y - y, e.x - x); e.setVelocity(Math.cos(a) * o.knock, Math.sin(a) * o.knock); e.stuckT = 0; }
          }
        });
        if (this.boss && this.boss.alive) { const bx = this.boss.x, by = this.boss.y; if (Math.abs(x - bx) < 75 + r && Math.abs(y - by) < 52 + r) this.damage(this.boss.spr, dmg, { src: o.src }); }
        this.covers.getChildren().slice().forEach(c => { if (c.hp && Math.hypot(c.x - x, c.y - y) < r + 24) this.hitCover(c, dmg); });
      }
      this.barrels.getChildren().slice().forEach(br => { if (br.active && Math.hypot(br.x - x, br.y - y) < r + 14) this.time.delayedCall(90, () => this.hitBarrel(br, 999, 'chain')); });
      this.mines.slice().forEach(m => { if (m.active && Math.hypot(m.x - x, m.y - y) < r + 10) this.time.delayedCall(60, () => this.detonateMine(m)); });
      if (o.hurtPlayer) { const p = this.player; if (Math.hypot(p.x - x, p.y - y) < r + p.radius) this.hurtPlayer(o.playerDmg != null ? o.playerDmg : dmg, o.src); }
    }
    hitBarrel(br, dmg, src) {
      if (!br.active) return;
      br.hp -= dmg; const v = br.visual;
      if (br.hp > 0) {
        if (br.sheet) v.setFrame(br.hp <= DK.BARREL.hp * 0.5 ? 2 : 1);
        v.setTintFill(0xffffff); this.time.delayedCall(60, () => v.active && v.clearTint()); return;
      }
      const x = br.x, y = br.y; br.destroy();
      if (br.sheet) { v.clearTint(); v.play({ key: 'barrel', startFrame: 3 }); v.once('animationcomplete', () => v.destroy()); } else v.destroy();
      DK.logDamage({ src, tgt: 'barrel', amt: 0, note: 'barrel exploded' });
      this.explode(x, y, DK.BARREL.radius, DK.BARREL.dmg, { src: 'barrel', hurtPlayer: true, hurtEnemies: true, knock: 200 });
    }
    spark(x, y, col, n) {
      if (DK.ART.spark.real && (this.sparkCount || 0) < 24) {
        this.sparkCount = (this.sparkCount || 0) + 1;
        const s = this.add.sprite(x, y, 'spark').setDepth(860); DK.applyArt(s, 'spark'); s.setRotation(rnd(0, PI2));
        if (col && col !== 0xffe08a) s.setTint(col);
        s.once('animationcomplete', () => { s.destroy(); this.sparkCount--; });
        return;
      }
      for (let i = 0; i < (n || 3); i++) { const s = this.add.rectangle(x, y, 3, 3, col || 0xffe08a).setDepth(860); const a = rnd(0, PI2), d = rnd(8, 20); this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 160, onComplete: () => s.destroy() }); }
    }
    muzzleFlash(x, y, ang, big, scale) {
      const m = this.add.sprite(x, y, 'muzzle').setDepth(860);
      DK.applyArt(m, 'muzzle'); m.setRotation(ang); const k = (scale || 1) * (big ? 1.5 : 1); m.setDisplaySize(m.displayWidth * k, m.displayHeight * k);
      if (DK.ART.muzzle.real) { m.anims.stop(); m.setFrame(Phaser.Math.Between(0, 2)); } // 1-2 frames per shot
      if (big) m.setTint(0xffb070);
      this.time.delayedCall(DK.ART.muzzle.real ? 60 : 45, () => m.destroy());
    }
    ejectCasing(x, y, ang) {
      if (this.casings > 40) return; this.casings = (this.casings || 0) + 1;
      const c = this.add.image(x, y, 'casing').setDepth(y - 1); DK.applyArt(c, 'casing');
      const side = ang + Math.PI / 2 * (Math.cos(ang) < 0 ? -1 : 1), d = rnd(14, 26);
      this.tweens.add({ targets: c, x: x + Math.cos(side) * d - Math.cos(ang) * 6, y: y + Math.sin(side) * d + 10, angle: rnd(-360, 360), duration: 260, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: c, alpha: 0, delay: 900, duration: 400, onComplete: () => { c.destroy(); this.casings--; } });
    }
    throwGrenade(x0, y0, x1, y1) {
      const G = DK.GRENADE, g = this.add.image(x0, y0, 'grenade').setDepth(870); DK.applyArt(g, 'grenade');
      const sh = this.add.ellipse(x0, y0 + 8, 12, 5, 0x000000, 0.35).setDepth(1);
      DK.sfx(this, 'grenade_throw');
      const o = { t: 0 };
      this.tweens.add({ targets: o, t: 1, duration: G.flight * 1000, onUpdate: () => {
        const t = o.t, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, h = Math.sin(t * Math.PI) * 70;
        g.setPosition(x, y - h).setAngle(t * 540); sh.setPosition(x, y + 8);
      }, onComplete: () => {
        g.destroy(); sh.destroy();
        this.explode(x1, y1, G.radius, G.dmg, { src: 'grenade', hurtPlayer: true, playerDmg: G.selfDmg, knock: 160 });
      } });
    }
    layMine(x, y, thrown) {
      if (this.mines.length >= DK.BOSS.mineMax) return;
      const m = this.add.image(x, y, 'mine').setDepth(y - 10); DK.applyArt(m, 'mine');
      m.armT = thrown ? 1.2 : 0.8; this.mines.push(m);
      if (thrown) { m.setScale(m.scaleX * 0.3); this.tweens.add({ targets: m, scaleX: m.scaleX / 0.3, scaleY: m.scaleY / 0.3, duration: 300 }); }
    }
    detonateMine(m) {
      if (!m.active) return; const i = this.mines.indexOf(m); if (i >= 0) this.mines.splice(i, 1);
      const x = m.x, y = m.y; m.destroy();
      this.explode(x, y, 50, DK.BOSS.mineDmg, { src: 'mine', hurtPlayer: true, hurtEnemies: false, size: 0.7 });
    }

    // ------------------------------------------------------------- room flow
    roomCleared() {
      if (this.state !== 'fight') return;
      this.state = 'cleared';
      this.run.scrap += DK.ROOM_SCRAP; DK.sfx(this, 'pickup_scrap');
      DK.banner(this, `房间清除！ 废铁 +${DK.ROOM_SCRAP}`, { color: '#7ee07a', size: 28 });
      DK.logDamage({ src: 'room', tgt: '-', amt: 0, note: 'room ' + (this.run.room + 1) + ' cleared' });
      if (this.room.type === 'hostage') { this.state = 'hostage'; DK.banner(this, '去解救人质！', { y: 140, size: 20, color: '#ffffff', dur: 2000 }); return; }
      this.time.delayedCall(700, () => this.offerReward());
    }
    rescueHostage() {
      if (this.hostageFreed) return; this.hostageFreed = true;
      const run = this.run; run.scrap += DK.HOSTAGE_SCRAP; run.hp = Math.min(run.maxHp, run.hp + 20);
      DK.sfx(this, 'hostage_rescue'); DK.anim(this.hostage, 'freed');
      this.tweens.add({ targets: this.hostage, alpha: 0, y: this.hostage.y - 30, duration: 700, delay: 1600 });
      DK.speech(this, { speaker: 'hostage', text: '谢谢中士！铁砧就在前面……小心它的履带！' }, 2400);
      DK.banner(this, `人质获救 · 废铁 +${DK.HOSTAGE_SCRAP} · 生命 +20`, { color: '#7ee07a', size: 22 });
      this.state = 'cleared'; this.time.delayedCall(900, () => this.offerReward());
    }
    offerReward(title) {
      const picks = DK.rollRewards(this.run, 3);
      if (this.touch) this.touch.reset();
      this.modal = DK.cardChoice(this, title || '三选一 · 战利品', picks.map(r => ({ title: r.name, desc: r.desc, icon: r.icon, onPick: () => { DK.applyReward(this, r.id); this.modal = null; this.afterReward(); } })), { subtitle: '点击或按 1/2/3 选择', guardMs: 500 });
      this.rewardOpen = picks.map(r => r.id);
    }
    afterReward() {
      this.rewardOpen = null;
      if (this.room.type === 'shop') return;
      this.state = 'open'; this.door.setOpen(true);
      DK.banner(this, '前进 ➜', { color: '#7ee07a', size: 22, y: 140, dur: 1200 });
    }
    goNextRoom() {
      if (this.leaving) return; this.leaving = true;
      this.run.room++;
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());
    }
    setupShop() {
      const run = this.run, W = DK.W, H = DK.H;
      if (run.shopType === 'merchant') {
        // merchant_stall (238x304, anchor 119,302 → origin ≈ 0.5,0.993) behind; merchant stands in front, depth = feet y
        const sx = W / 2, sy = H / 2 - 6, st = DK.ARTX.merchant_stall;
        if (DK.hasArt('merchant_stall')) {
          const sc = DK.MERCHANT_STALL_SCALE / (st.res_scale || 1);
          this.add.image(sx, sy, 'merchant_stall').setOrigin(st.anchor[0] / st.frame_size[0], st.anchor[1] / st.frame_size[1]).setScale(sc).setDepth(sy);
          const fp = this.add.rectangle(sx, sy - 22, 92, 40, 0, 0); this.covers.add(fp); fp.hp = 0; // counter footprint (blocks walking + bullets)
        }
        const mFeet = sy + 16, mx = sx + 8;
        const m = this.add.sprite(mx, mFeet - 30, 'npc_merchant'); const real = DK.applySkin(m, 'npc_merchant');
        if (!real) m.setPosition(mx, sy + 20);
        m.setDepth(real ? mFeet : m.y + 20);
        this.merchantSpr = m;
        DK.txt(this, sx, DK.hasArt('merchant_stall') ? sy - 148 : mFeet - 118, '军火商', { fontSize: '14px', color: '#d9a7ff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(900).setScrollFactor(1);
        this.sold = {}; this.merchantTalked = false;
        this.interactables.push({ x: mx, y: mFeet + 10, r: 90, label: '交易', fn: () => this.talkMerchant() });
        this.time.delayedCall(500, () => DK.speech(this, { speaker: 'merchant', text: '有废铁就有货。没废铁……就看看。' }, 2400));
      } else {
        const c = this.add.image(W / 2, H / 2, 'campfire'); DK.applyArt(c, 'campfire'); c.setDepth(c.y);
        this.tweens.add({ targets: c, scaleY: c.scaleY * 1.08, yoyo: true, repeat: -1, duration: 300 });
        this.restUsed = false;
        this.interactables.push({ x: c.x, y: c.y, r: 80, label: '休息', fn: () => this.openRest() });
      }
    }
    talkMerchant() { // dialogue panel with merchant_portrait, then the shop
      if (this.dlg.active || this.modal) return;
      if (this.merchantTalked) return this.openMerchant();
      this.merchantTalked = true;
      const lines = ['老规矩：废铁换货，不赊账。', '这些宝贝可都是“捡”来的，别问哪儿捡的。', '急救包、手雷、还有点神秘改装……挑吧，兵哥。'];
      this.dlg.show([{ speaker: 'merchant', text: Phaser.Utils.Array.GetRandom(lines) }], () => this.openMerchant());
    }
    openMerchant() {
      const run = this.run, items = [
        { id: 'heal', name: '急救包', icon: 'icon_heal', desc: '回复 40 生命', cost: 12, can: () => run.hp < run.maxHp, buy: () => { run.hp = Math.min(run.maxHp, run.hp + 40); DK.sfx(this, 'pickup_health'); } },
        { id: 'gren', name: '手雷 ×2', icon: 'icon_grenade', desc: '手雷 +2', cost: 8, can: () => true, buy: () => { run.grenades += 2; DK.sfx(this, 'pickup_weapon'); } },
        { id: 'card', name: '神秘改装', icon: 'icon_mod', desc: '打开一次\n三选一奖励', cost: 22, can: () => true, buy: () => { this.time.delayedCall(150, () => this.offerReward('军火商 · 三选一')); } }
      ];
      if (this.touch) this.touch.reset();
      this.modal = DK.cardChoice(this, '军火商', items.map(it => ({ title: it.name, desc: it.desc + (this.sold[it.id] ? '\n（已售出）' : ''), icon: it.icon, cost: it.cost,
        disabled: this.sold[it.id] || run.scrap < it.cost || !it.can(),
        onPick: () => { run.scrap -= it.cost; this.sold[it.id] = true; DK.logDamage({ src: 'shop', tgt: '-', amt: 0, note: 'bought ' + it.id }); this.modal = null; it.buy(); } })),
        { subtitle: `本轮废铁：${run.scrap}`, skipLabel: '离开', onSkip: () => { this.modal = null; } });
    }
    openRest() {
      if (this.restUsed) { DK.banner(this, '篝火已经熄了', { size: 18, y: 140 }); return; }
      const run = this.run;
      if (this.touch) this.touch.reset();
      this.modal = DK.cardChoice(this, '休息站', [
        { title: '休息', desc: '回复 50% 生命', icon: 'icon_heal', onPick: () => { this.restUsed = true; this.modal = null; run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.5)); DK.sfx(this, 'pickup_health'); } },
        { title: '保养武器', desc: '打开一次\n三选一奖励', icon: 'icon_mod', onPick: () => { this.restUsed = true; this.modal = null; this.time.delayedCall(150, () => this.offerReward('保养武器 · 三选一')); } }
      ], { subtitle: '二选一', skipLabel: '离开', onSkip: () => { this.modal = null; } });
    }
    tryInteract() {
      if (this.isPaused()) return;
      const p = this.player;
      if (this.state === 'hostage' && this.hostage && Math.hypot(p.x - this.hostage.x, p.y - this.hostage.y) < 70) return this.rescueHostage();
      for (const it of this.interactables) if (Math.hypot(p.x - it.x, p.y - it.y) < it.r) return it.fn();
    }
    nearInteract() {
      const p = this.player;
      if (this.state === 'hostage' && this.hostage && Math.hypot(p.x - this.hostage.x, p.y - this.hostage.y) < 70) return { label: '解救', x: this.hostage.x, y: this.hostage.y };
      for (const it of this.interactables) if (Math.hypot(p.x - it.x, p.y - it.y) < it.r) return it;
      return null;
    }

    // ------------------------------------------------------------- boss
    startBoss() {
      const run = this.run, b = this.boss;
      this.state = 'bossintro';
      this.tweens.add({ targets: b.spr, y: 150, duration: 1600, ease: 'Sine.easeOut', onUpdate: () => b.update(0) });
      this.cameras.main.shake(1600, 0.004);
      const first = !DK.meta.bossSeen;
      DK.meta.bossSeen = (DK.meta.bossSeen || 0) + 1; DK.saveMeta();
      this.time.delayedCall(1700, () => {
        const lines = DK.lines(first ? DK.story.boss_anvil.intro : DK.story.boss_anvil.intro_short);
        this.dlg.show(lines, () => { this.state = 'boss'; b.active = true; b.startTime = this.time.now; this.bossStart = this.time.now; DK.banner(this, '铁砧 · 前线碾压者', { color: '#ff5a4e', size: 30 }); });
      });
    }
    onBossDead(b) {
      this.state = 'won';
      const secs = ((this.time.now - (this.bossStart || this.time.now)) / 1000).toFixed(1);
      DK.logDamage({ src: 'boss', tgt: 'boss', amt: 0, note: 'boss defeated in ' + secs + 's' });
      this.eBullets.getChildren().forEach(x => x.active && x.disableBody(true, true));
      this.enemies.getChildren().slice().forEach(e => e.alive && this.killEnemy(e, 'boss_dead'));
      this.mines.slice().forEach(m => m.destroy()); this.mines = [];
      b.spr.setVelocity(0); b.spr.clearTint(); DK.anim(b.spr, 'destroy');
      for (let i = 0; i < 7; i++) this.time.delayedCall(i * 220, () => this.explode(b.x + rnd(-70, 70), b.y + rnd(-50, 50), 60, 0, { src: 'fx', size: 1 }));
      this.time.delayedCall(1700, () => {
        if (!b.spr.realSkin) { b.spr.setTint(0x333333); b.turret.setTint(0x333333); }
        const lines = DK.lines(DK.story.boss_anvil.death).concat(DK.lines(DK.story.victory));
        this.dlg.show(lines, () => this.finishVictory(secs));
      });
    }
    finishVictory(bossSecs) {
      const run = this.run, gained = run.scrap + DK.WIN_BONUS;
      Object.assign(DK.meta, { scrap: DK.meta.scrap + gained, wins: (DK.meta.wins || 0) + 1, lastResult: 'victory', lastRunScrap: gained });
      DK.saveMeta();
      const stats = { type: 'victory', scrap: gained, kills: run.kills, time: Math.round((Date.now() - run.startTime) / 1000), bossSecs };
      DK.run = null; DK.music(this, null);
      this.scene.start('Result', stats);
    }
    playerDie(src) {
      if (this.state === 'dead' || this.state === 'won') return;
      this.state = 'dead'; this.player.dead = true;
      if (this.modal && this.modal.close) this.modal.close(); this.modal = null;
      DK.sfx(this, 'player_death');
      this.explode(this.player.x, this.player.y, 40, 0, { src: 'fx', visualOnly: true });
      if (!this.player.spr.realSkin) this.player.spr.setTint(0x444444); else this.player.spr.clearTint();
      this.player.gun.setVisible(false); this.player.animate(false);
      this.physics.pause(); this.player.spr.setVelocity(0);
      const run = this.run, kept = Math.floor(run.scrap * DK.DEATH_KEEP);
      DK.meta.deaths++; DK.meta.scrap += kept; DK.meta.lastRunScrap = kept; DK.meta.lastResult = 'death';
      DK.meta.pendingAfterDeath = { laoqiang: true, lingjian: true };
      DK.saveMeta();
      DK.logDamage({ src, tgt: 'player', amt: 0, note: 'player died' });
      const stats = { type: 'death', scrap: run.scrap, kept, kills: run.kills, room: run.room + 1, by: src, time: Math.round((Date.now() - run.startTime) / 1000) };
      DK.run = null;
      this.time.delayedCall(1300, () => { DK.music(this, null); this.scene.start('Result', stats); });
    }

    // ------------------------------------------------------------- HUD
    createHUD() {
      const D = 950, H = DK.H;
      this.hud = {};
      const g = this.hudG = this.add.graphics().setScrollFactor(0).setDepth(D);
      const h = this.hud;
      h.hp = DK.txt(this, 20, 30, '', { fontSize: '14px', fontStyle: 'bold' }).setDepth(D + 1);
      h.ammo = DK.txt(this, 20, 48, '', { fontSize: '16px', fontStyle: 'bold', color: '#f2e6c9', stroke: '#000', strokeThickness: 3 }).setDepth(D + 1);
      h.info = DK.txt(this, 20, 70, '', { fontSize: '13px', color: '#dddddd', stroke: '#000', strokeThickness: 3 }).setDepth(D + 1);
      h.room = DK.txt(this, DK.W / 2, 14, '', { fontSize: '14px', color: '#f2c14e', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(D + 1);
      h.scrap = DK.txt(this, DK.W - 20, 14, '', { fontSize: '15px', color: '#f2e6c9', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 0).setDepth(D + 1);
      h.boss = DK.txt(this, DK.W / 2, H - 52, '', { fontSize: '14px', color: '#ff8a7a', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 1);
      h.prompt = DK.txt(this, 0, 0, '', { fontSize: '14px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(D + 2).setVisible(false);
      h.pauseBtn = DK.button(this, DK.W - 40, 52, 56, 30, '暂停', () => this.togglePause(), { fontSize: 13, depth: D + 3 });
      if (DK.god) h.god = DK.txt(this, DK.W - 20, 74, 'GOD', { fontSize: '12px', color: '#ff0' }).setOrigin(1, 0).setDepth(D + 1);
    }
    updateHUD() {
      const run = this.run, p = this.player, g = this.hudG, h = this.hud, w = p.weapon();
      g.clear();
      // hp bar
      g.fillStyle(0x000000, 0.6).fillRoundedRect(16, 12, 204, 16, 4);
      g.fillStyle(run.hp / run.maxHp < 0.3 ? 0xe74c3c : 0x5fbf4a).fillRoundedRect(18, 14, 200 * Math.max(0, run.hp / run.maxHp), 12, 3);
      h.hp.setText(`${Math.ceil(run.hp)} / ${run.maxHp}`).setPosition(24, 12);
      // ammo / reload
      const mag = run.mag[w.id];
      h.ammo.setText(`${w.name}  ${p.reloadT > 0 ? '换弹中…' : mag + ' / ' + w.mag}${p.empowered ? '  ★+50%' : ''}`);
      if (p.reloadT > 0) { g.fillStyle(0x000000, 0.6).fillRect(18, 68 - 2, 120, 4); g.fillStyle(0xf2c14e).fillRect(18, 68 - 2, 120 * (1 - p.reloadT / p.reloadTotal), 4); }
      const ammoNames = run.ammoTypes.map(a => DK.AMMO[a].name.replace('弹', '')).join('+') || '普通';
      const mods = Object.keys(run.mods).length;
      h.info.setText(`弹种 ${ammoNames} · 手雷 ${run.grenades} · 冲刺 ${p.charges}/${run.dashCharges}${mods ? ' · 改造 ' + mods : ''}`).setPosition(20, p.reloadT > 0 ? 74 : 70);
      // dash pips under the player
      for (let i = 0; i < run.dashCharges; i++) g.fillStyle(i < p.charges ? 0x7ee07a : 0x333333, 0.9).fillCircle(p.x - (run.dashCharges - 1) * 5 + i * 10, p.y + 30, 3);
      if (p.charges < run.dashCharges && p.dashCdT > 0) g.lineStyle(2, 0x7ee07a, 0.8).beginPath().arc(p.x, p.y, 24, -Math.PI / 2, -Math.PI / 2 + PI2 * (1 - p.dashCdT / DK.PLAYER.dashCd)).strokePath();
      // room progress
      const total = DK.ROOMS.length;
      h.room.setText(this.room.type === 'boss' ? 'BOSS 铁砧' : `房间 ${run.room + 1}/5  ${this.room.type === 'shop' ? (run.shopType === 'merchant' ? '军火商' : '休息站') : this.room.name}${this.state === 'fight' ? '  · 敌人 ' + (this.targets().length + this.pending) : ''}`);
      for (let i = 0; i < total; i++) { const x = DK.W / 2 - (total - 1) * 11 + i * 22; g.fillStyle(i < run.room ? 0x7ee07a : i === run.room ? 0xf2c14e : 0x444444).fillCircle(x, 40, i === total - 1 ? 6 : 4); }
      h.scrap.setText(`废铁 ${run.scrap}   击杀 ${run.kills}`);
      // boss bar
      if (this.boss && this.boss.active && this.boss.alive) {
        const b = this.boss, bw = 420, x = DK.W / 2 - bw / 2, y = DK.H - 36;
        g.fillStyle(0x000000, 0.7).fillRect(x - 2, y - 2, bw + 4, 14);
        g.fillStyle(b.invulnT > 0 ? 0x888888 : 0xe74c3c).fillRect(x, y, bw * b.hp / b.maxHp, 10);
        g.fillStyle(0xffffff, 0.8).fillRect(x + bw * DK.BOSS.phase2At / b.maxHp, y - 2, 2, 14).fillRect(x + bw * DK.BOSS.phase3At / b.maxHp, y - 2, 2, 14);
        h.boss.setText(`铁砧  ${Math.ceil(b.hp)} / ${b.maxHp}   阶段 ${b.phase}`).setVisible(true);
      } else h.boss.setVisible(false);
      // interact prompt
      const it = !this.isPaused() && this.nearInteract();
      if (it) h.prompt.setText((DK.touchMode ? '' : '[E] ') + it.label).setPosition(it.x, it.y - 46).setVisible(true); else h.prompt.setVisible(false);
      if (this.touch) {
        const act = this.touch.buttons.find(b => b.id === 'act'); act.hidden = !it; if (it) act.label = it.label;
        this.touch.buttons.find(b => b.id === 'grenade').label = '手雷' + run.grenades;
        this.touch.buttons.find(b => b.id === 'swap').hidden = run.weapons.length < 2;
        const dash = this.touch.buttons.find(b => b.id === 'dash'); dash.cd = p.charges > 0 ? 0 : Math.max(0, p.dashCdT / DK.PLAYER.dashCd);
        this.touch.draw();
      }
      if (h.god) h.god.setVisible(!!DK.god);
    }

    // ------------------------------------------------------------- frame
    update(time, dtMs) {
      const dt = Math.min(dtMs, 50) / 1000 * (this.time.timeScale || 1); // __dbg.speed() scales all game logic
      this.gameT += dt; // logic clock (frames are capped at 50 ms, so this can run slower than wall time on a slow device)
      const paused = this.isPaused();
      this.player.update(paused ? 0 : dt);
      const g = this.fxG; g.clear();
      if (!paused) {
        this.enemies.getChildren().slice().forEach(e => e.alive && DK.updateEnemy(this, e, dt));
        if (this.boss) this.boss.update(dt);
        // bullet lifetimes
        const now = this.time.now;
        this.pBullets.getChildren().forEach(b => { if (b.active && (now - b.born > b.life || b.x < -20 || b.x > DK.W + 20 || b.y < -20 || b.y > DK.H + 20)) this.killBullet(b); });
        this.eBullets.getChildren().forEach(b => { if (b.active && (now - b.born > 6000 || b.x < -30 || b.x > DK.W + 30 || b.y < -30 || b.y > DK.H + 30)) b.disableBody(true, true); });
        // mines
        this.mines.slice().forEach(m => {
          if (!m.active) return; m.armT -= dt;
          if (m.armT <= 0) { m.setAlpha(Math.floor(now / 200) % 2 ? 1 : 0.6); if (Math.hypot(m.x - this.player.x, m.y - this.player.y) < 34) this.detonateMine(m); }
          else m.setAlpha(0.5);
        });
        // wave progression
        if (this.state === 'fight' && this.pending === 0 && this.wave >= 0 && this.enemies.getChildren().filter(e => e.alive).length === 0) {
          this.state = 'fight'; if (!this._waveWait) { this._waveWait = true; this.time.delayedCall(600, () => { this._waveWait = false; if (this.state === 'fight' && this.pending === 0 && !this.enemies.getChildren().some(e => e.alive)) this.nextWave(); }); }
        }
        // door
        if (this.door && this.door.open && this.state !== 'dead' && this.player.x > DK.W - DK.WALL - 18 && this.player.y > this.door.y0 && this.player.y < this.door.y1) this.goNextRoom();
      }
      // fx layer
      DK.drawEnemyFx(this, g);
      if (this.boss) this.boss.drawFx(g);
      this.mines.forEach(m => { if (m.active && m.armT <= 0) g.lineStyle(1, 0xff3030, 0.35).strokeCircle(m.x, m.y, 34); });
      if (this.state === 'hostage' && this.hostage) g.lineStyle(2, 0x7ee07a, 0.5 + 0.4 * Math.sin(this.time.now / 150)).strokeCircle(this.hostage.x, this.hostage.y, 30);
      const p = this.player;
      if (p.grenadeAim && !paused) {
        const t = p.grenadeTarget(); g.lineStyle(2, 0xffffff, 0.6);
        for (let i = 0; i <= 14; i++) { const k = i / 14, x = p.x + (t.x - p.x) * k, y = p.y + (t.y - p.y) * k - Math.sin(k * Math.PI) * 70; g.fillStyle(0xffffff, 0.7).fillCircle(x, y, 2); }
        g.lineStyle(2, 0xff6a3a, 0.9).strokeCircle(t.x, t.y, DK.GRENADE.radius).fillStyle(0xff6a3a, 0.12).fillCircle(t.x, t.y, DK.GRENADE.radius);
      }
      if (!DK.touchMode && !paused) { const m = this.input.mousePointer, mx = m.x / DK.R, my = m.y / DK.R; g.lineStyle(2, 0xffffff, 0.9).strokeCircle(mx, my, 8).lineBetween(mx - 13, my, mx - 5, my).lineBetween(mx + 5, my, mx + 13, my).lineBetween(mx, my - 13, mx, my - 5).lineBetween(mx, my + 5, mx, my + 13); }
      this.updateHUD();
    }
  };

  // ------------------------------------------------------------- rewards
  DK.rollRewards = function (run, n) {
    const pool = DK.REWARDS.filter(r => r.can(run));
    // weight: ammo types & mg a bit more likely early
    const out = [];
    while (out.length < n && pool.length) {
      const weights = pool.map(r => r.id.startsWith('ammo') || r.id === 'weapon_mg' ? 2 : 1);
      let t = Math.random() * weights.reduce((a, b) => a + b, 0), i = 0;
      while (t > weights[i]) { t -= weights[i]; i++; }
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  };
  DK.applyReward = function (scene, id) {
    const run = DK.run; if (!run) return;
    const p = scene.player;
    run.taken.push(id);
    switch (id) {
      case 'ammo_burn': run.ammoTypes.push('burn'); break;
      case 'ammo_freeze': run.ammoTypes.push('freeze'); break;
      case 'ammo_split': run.ammoTypes.push('split'); break;
      case 'weapon_mg': run.weapons.push('mg'); run.weapon = 'mg'; run.mag.mg = DK.WEAPONS.mg.mag; p && p.updateGun(); break;
      case 'mod_bigcal': run.mods.bigcal = true; break;
      case 'mod_fifth': run.mods.fifth = true; break;
      case 'mod_recycle': run.mods.recycle = true; break;
      case 'mod_frenzy': run.mods.frenzy = true; break;
      case 'mod_ring': run.mods.ring = true; break;
      case 'hp_up': run.maxHp += 20; run.hp = Math.min(run.maxHp, run.hp + 20); break;
      case 'heal': run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.5)); break;
      case 'grenade': run.grenades += 2; break;
      case 'dash': run.dashCharges += 1; if (p) p.charges++; break;
      case 'dmg_up': run.dmgMul *= 1.15; run.dmgUps = (run.dmgUps || 0) + 1; break;
      default: return false;
    }
    const r = DK.REWARDS.find(x => x.id === id);
    DK.sfx(scene, id === 'heal' || id === 'hp_up' ? 'pickup_health' : id.startsWith('ammo') || id === 'weapon_mg' ? 'pickup_weapon' : 'pickup_powerup');
    if (scene.add && r) DK.banner(scene, '获得：' + r.name, { color: '#f2c14e', size: 22, y: 140, dur: 1200 });
    DK.logDamage({ src: 'reward', tgt: '-', amt: 0, note: 'took ' + id });
    return true;
  };

  // static body sized in logical px (for covers/barrels drawn from any image resolution)
  DK.fitStatic = function (obj, w, h) {
    obj.body.setSize(w, h, true);
  };
})(window.DK);

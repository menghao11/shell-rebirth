// 铁皮屋 base: NPCs 老枪 / 零件, 改装台 (装甲 +10 血), exit door = 出击.
(function (DK) {
  DK.BaseScene = class extends Phaser.Scene {
    constructor() { super('Base'); }
    create() {
      Object.assign(this, { leaving: false, modal: null, touch: null, prompt: null, exitArrow: null, door: null }); // per-visit state (review P0-1)
      DK.setupCamera(this); DK.current = this; DK.run = null;
      const W = DK.W, H = DK.H, meta = DK.meta;
      this.cameras.main.fadeIn(300, 0, 0, 0);
      this.dlg = new DK.Dialogue(this); this.modal = null;
      this.painted = DK.hasArt('base_tinshack_bg');
      if (this.painted) this.buildPainted(); else this.buildPlaceholder();
      this.player = new DK.Player(this, this.startXY[0], this.startXY[1], { canFight: false });
      this.physics.add.collider(this.player.spr, this.walls);
      Object.values(this.npcs).forEach(n => n.body && n.body.enable && this.physics.add.collider(this.player.spr, n));
      this.afterBuild();
    }
    // painted 铁皮屋: one background image + invisible collision rects measured off the painting
    buildPainted() {
      const L = DK.tinshackLayout(), a = DK.ARTX.base_tinshack_bg;
      this.add.image(0, 0, 'base_tinshack_bg').setOrigin(0).setDisplaySize(DK.W, DK.H).setDepth(-100);
      this.walls = this.physics.add.staticGroup();
      L.walls.forEach(([x, y, w, h]) => this.walls.add(this.add.rectangle(x + w / 2, y + h / 2, w, h, 0, 0)));
      this.npcs = {};
      for (const [id, o] of Object.entries(L.npcs)) {
        const skinKey = o.skin && DK.hasArt(DK.SKINS[o.skin].anims.idle) ? o.skin : 'npc_' + id;
        const lift = DK.SKINS[skinKey] ? DK.SKINS[skinKey].lift : 0, y = o.feet - lift;
        const s = this.physics.add.staticSprite(o.x, y, 'npc_' + id); DK.applySkin(s, skinKey); s.setFlipX(!!o.flip && !!s.realSkin); s.setDepth(o.feet);
        s.body.enable = false; s.feetY = o.feet; // collide with an invisible footprint instead of the sprite box
        this.walls.add(this.add.rectangle(o.x, o.feet - 12, 40, 24, 0, 0));
        this.npcs[id] = s;
        const top = s.realSkin ? o.feet - (skinKey.endsWith('dock') ? 90 : 72) : y - 40;
        DK.txt(this, o.x, top, DK.SPEAKERS[id].name, { fontSize: '14px', color: DK.SPEAKERS[id].color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(900);
      }
      L.labels.forEach(([t, x, y, c]) => DK.txt(this, x, y, t, { fontSize: t.startsWith('出击') ? '18px' : '13px', fontStyle: t.startsWith('出击') ? 'bold' : 'normal', color: c, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(900));
      this.exitArrow = DK.txt(this, (L.door.x0 + L.door.x1) / 2, L.door.y + 2, '▼', { fontSize: '20px', color: '#7ee07a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(900);
      this.tweens.add({ targets: this.exitArrow, y: L.door.y + 10, yoyo: true, repeat: -1, duration: 500 });
      this.startXY = L.start;
      this.atExit = p => p.y > L.door.y - 4 && p.x > L.door.x0 && p.x < L.door.x1;
      DK.txt(this, DK.W / 2, 40, '铁皮屋', { fontSize: '24px', fontStyle: 'bold', color: '#f2c14e', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(900);
    }
    buildPlaceholder() {
      const W = DK.W, H = DK.H;
      const arena = DK.buildArena(this, { door: true, floor: 'floor_base' });
      this.walls = arena.walls; this.door = arena.door; this.door.setOpen(true);
      DK.txt(this, W / 2, 46, '铁皮屋', { fontSize: '26px', fontStyle: 'bold', color: '#f2c14e', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(900);
      // props
      const pod = this.add.image(110, 150, 'echo_pod'); DK.applyArt(pod, 'echo_pod'); pod.setDepth(pod.y);
      DK.txt(this, 110, 210, '回响舱', { fontSize: '13px', color: '#6fd6ff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(900);
      const bench = this.add.image(660, 150, 'workbench'); DK.applyArt(bench, 'workbench'); bench.setDepth(bench.y);
      DK.txt(this, 660, 186, '改装台', { fontSize: '13px', color: '#cfcfcf', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(900);
      this.npcs = {};
      [['laoqiang', 360, 170], ['lingjian', 590, 160]].forEach(([id, x, y]) => {
        const s = this.physics.add.staticSprite(x, y, 'npc_' + id); DK.applySkin(s, 'npc_' + id); s.setDepth(y + 20); s.body.setSize(36, 30, true);
        this.npcs[id] = s;
        DK.txt(this, x, y - 40, DK.SPEAKERS[id].name, { fontSize: '14px', color: DK.SPEAKERS[id].color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(900);
        this.tweens.add({ targets: s, y: y - 2, yoyo: true, repeat: -1, duration: 900 + Math.random() * 300 });
      });
      DK.txt(this, W - 80, H / 2 - 74, '出击 ➜', { fontSize: '18px', fontStyle: 'bold', color: '#7ee07a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(900);
      this.startXY = [130, 300];
      this.atExit = p => p.x > DK.W - DK.WALL - 18 && p.y > this.door.y0 && p.y < this.door.y1;
    }
    afterBuild() {
      const W = DK.W, H = DK.H, meta = DK.meta;
      // HUD
      this.stat = DK.txt(this, 20, 14, '', { fontSize: '15px', color: '#f2e6c9', stroke: '#000', strokeThickness: 3, lineSpacing: 4 }).setDepth(950);
      this.prompt = DK.txt(this, 0, 0, '', { fontSize: '14px', color: '#fff', backgroundColor: '#000000aa', padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(960).setVisible(false);
      if (DK.touchMode) DK.button(this, W - 62, 32, 100, 46, '设置', () => this.openSettings(), { fontSize: 18, depth: 1000 });
      else DK.button(this, W - 52, 24, 76, 32, '设置', () => this.openSettings(), { fontSize: 14, depth: 1000 });
      if (!DK.touchMode) DK.txt(this, W / 2, H - 22, 'WASD 移动 · E 交谈 · ' + (this.painted ? '走到右下车库门出击' : '走进右侧大门出击') + ' · 战斗中：鼠标瞄准（自动射击） / 空格冲刺 / 按住Q 手雷', { fontSize: '13px', color: '#bbb', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(950);
      if (DK.touchMode) {
        this.touch = new DK.TouchControls(this, [{ id: 'act', label: '交谈', x: W - 120, y: H - 120, r: 64, hidden: true }]);
        this.touch.on('press', id => { if (id === 'act') this.interact(); });
      }
      const kb = this.input.keyboard;
      kb && kb.on('keydown-E', () => { if (!this.isPaused()) this.interact(); });
      DK.music(this, 'bgm_stage1');
      // first launch -> intro
      if (!meta.introSeen) {
        this.time.delayedCall(400, () => this.dlg.show(DK.lines(DK.story.intro), () => { meta.introSeen = true; DK.saveMeta(); }));
      } else if (meta.lastResult === 'death') {
        this.time.delayedCall(500, () => { const q = DK.npcLine('lingjian', 'after_death'); if (q) DK.speech(this, q, 2600); DK.meta.pendingAfterDeath.lingjian = false; DK.saveMeta(); });
      }
    }
    isPaused() { return this.dlg.active || !!this.modal || this.leaving; }
    uiLock() { return this.isPaused(); }
    near() {
      const p = this.player;
      for (const [id, n] of Object.entries(this.npcs)) { const fy = n.feetY != null ? n.feetY - 10 : n.y; if (Math.hypot(p.x - n.x, p.y - fy) < 80) return { id, x: n.x, y: fy - 30, label: id === 'lingjian' ? '交谈 / 改装' : '交谈' }; }
      return null;
    }
    interact() {
      if (this.isPaused()) return;
      const n = this.near(); if (!n) return;
      if (n.id === 'laoqiang') this.talkLaoqiang(); else this.talkLingjian();
    }
    // one random line from the group that fits the situation
    talkLaoqiang() {
      const m = DK.meta; m.talked = m.talked || {};
      let line;
      if (!m.talked.laoqiang) { line = DK.npcLine('laoqiang', 'greet_first'); m.talked.laoqiang = true; }
      else if (m.pendingAfterDeath && m.pendingAfterDeath.laoqiang) { line = DK.npcLine('laoqiang', 'after_death'); m.pendingAfterDeath.laoqiang = false; }
      else if (m.deaths >= 3 && Math.random() < 0.15) line = DK.npcLine('laoqiang', 'lore_hidden');
      else line = DK.npcLine('laoqiang', Math.random() < 0.5 ? 'hints' : 'greet');
      DK.saveMeta();
      this.dlg.show([line || { speaker: 'laoqiang', text: '……' }]);
    }
    talkLingjian() {
      const m = DK.meta; m.talked = m.talked || {};
      let line;
      if (!m.talked.lingjian) { line = DK.npcLine('lingjian', 'greet_first'); m.talked.lingjian = true; }
      else if (m.pendingAfterDeath && m.pendingAfterDeath.lingjian) { line = DK.npcLine('lingjian', 'after_death'); m.pendingAfterDeath.lingjian = false; }
      else if (m.deaths >= 3 && Math.random() < 0.15) line = DK.npcLine('lingjian', 'lore_hidden');
      else line = DK.npcLine('lingjian', 'greet');
      DK.saveMeta();
      this.dlg.show([line || { speaker: 'lingjian', text: '滴。' }], () => this.openUpgrade());
    }
    openUpgrade() {
      const m = DK.meta, price = DK.armorPrice(), maxed = price == null;
      if (this.touch) this.touch.reset();
      this.modal = DK.cardChoice(this, '改装台', [{
        title: `装甲 +${DK.ARMOR.hpPer} 血`, icon: 'icon_armor', cost: maxed ? null : price,
        desc: `当前 Lv ${m.armor}/${DK.ARMOR.prices.length}\n最大生命 ${DK.maxHp()}${maxed ? '\n（已满级）' : ' → ' + (DK.maxHp() + DK.ARMOR.hpPer)}`,
        onPick: () => { this.modal = null; this.buyArmor(); }
      }], { subtitle: `废铁：${m.scrap}`, skipLabel: '离开', onSkip: () => { this.modal = null; }, guardMs: 300 });
    }
    buyArmor() {
      const m = DK.meta, price = DK.armorPrice();
      if (price != null && m.scrap >= price) {
        m.scrap -= price; m.armor++; DK.saveMeta();
        DK.sfx(this, 'pickup_powerup');
        this.dlg.show([DK.npcLine('lingjian', 'upgrade_buy') || { speaker: 'lingjian', text: '装甲已安装。' }]);
      } else {
        DK.sfx(this, 'dry_fire');
        this.dlg.show([price == null ? { speaker: 'lingjian', text: '装甲已经焊满了。再焊你就走不动了。' } : (DK.npcLine('lingjian', 'upgrade_poor') || { speaker: 'lingjian', text: '废铁不够。' })]);
      }
    }
    openSettings() {
      if (this.isPaused()) return;
      const W = DK.W, H = DK.H, objs = [];
      objs.push(this.add.rectangle(W / 2, H / 2, W, H, 0, 0.75).setScrollFactor(0).setDepth(1100).setInteractive());
      objs.push(DK.txt(this, W / 2, 120, '设置', { fontSize: '34px', fontStyle: 'bold', color: '#f2c14e' }).setOrigin(0.5).setDepth(1101));
      objs.push(...DK.volumeControls(this, W / 2, 210, 1102));
      objs.push(DK.button(this, W / 2, 340, 220, 44, '重看开场剧情', () => { close(); this.dlg.show(DK.lines(DK.story.intro)); }, { depth: 1102, fontSize: 16 }));
      objs.push(DK.button(this, W / 2, 400, 220, 44, '关闭', () => close(), { depth: 1102 }));
      const close = () => { objs.forEach(o => o.destroy()); this.modal = null; };
      this.modal = { close };
    }
    sortie() {
      if (this.leaving) return; this.leaving = true;
      const line = DK.npcLine('laoqiang', 'sortie');
      const go = () => { DK.run = DK.newRun(); this.cameras.main.fadeOut(250, 0, 0, 0); this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Run')); };
      if (line) { DK.speech(this, line, 1400); this.time.delayedCall(900, go); } else go();
    }
    update(t, dtMs) {
      const dt = Math.min(dtMs, 50) / 1000 * (this.time.timeScale || 1);
      this.player.update(this.isPaused() ? 0 : dt);
      const m = DK.meta;
      this.stat.setText(`废铁 ${m.scrap}   死亡 ${m.deaths}   最大生命 ${DK.maxHp()}（装甲 Lv${m.armor}）${m.wins ? '   通关 ' + m.wins : ''}`);
      const n = !this.isPaused() && this.near();
      if (n) this.prompt.setText((DK.touchMode ? '' : '[E] ') + n.label).setPosition(n.x, n.y - 62).setVisible(true); else this.prompt.setVisible(false);
      if (this.touch) { const b = this.touch.buttons[0]; b.hidden = !n; if (n) b.label = n.id === 'lingjian' ? '改装' : '交谈'; this.touch.draw(); }
      const p = this.player;
      if (!this.isPaused() && this.atExit(p)) this.sortie();
    }
  };
})(window.DK);

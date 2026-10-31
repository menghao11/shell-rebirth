// UI helpers: text, buttons, dialogue box, banners, card choices. All UI is scrollFactor(0) at high depth.
(function (DK) {
  const D_UI = 1000;
  DK.txt = function (scene, x, y, str, style) {
    style = Object.assign({ fontFamily: DK.FONT, fontSize: '16px', color: '#ffffff' }, style || {});
    const t = scene.add.text(x, y, str, style).setResolution(DK.R).setScrollFactor(0);
    return t;
  };

  DK.button = function (scene, x, y, w, h, label, onClick, opts) {
    opts = opts || {};
    const c = scene.add.container(x, y).setScrollFactor(0).setDepth(opts.depth || D_UI + 20);
    const bg = scene.add.rectangle(0, 0, w, h, opts.color || 0x2b2f27, opts.alpha != null ? opts.alpha : 0.95).setStrokeStyle(2, opts.stroke || 0xf2c14e);
    const t = DK.txt(scene, 0, 0, label, { fontSize: (opts.fontSize || 18) + 'px', color: opts.textColor || '#f2e6c9', align: 'center' }).setOrigin(0.5);
    c.add([bg, t]); c.bg = bg; c.label = t;
    // input guard: armed by a timer on the scene clock (scene.time.now is stale inside create(), review P1-1)
    let armed = !opts.guardMs;
    c.enabled = true;
    bg.setInteractive({ useHandCursor: true });
    let downOn = false;
    bg.on('pointerdown', () => { downOn = true; bg.setFillStyle(opts.colorDown || 0x4a5040, 1); });
    bg.on('pointerout', () => { downOn = false; bg.setFillStyle(opts.color || 0x2b2f27, opts.alpha != null ? opts.alpha : 0.95); });
    bg.on('pointerup', () => {
      bg.setFillStyle(opts.color || 0x2b2f27, opts.alpha != null ? opts.alpha : 0.95);
      if (!downOn) return; downOn = false;
      if (!c.enabled || !armed) return;
      onClick && onClick();
    });
    c.setEnabled = function (on) { c.enabled = on; c.setAlpha(on ? 1 : 0.45); return c; };
    if (opts.guardMs) { // input protection: dim until active
      c.setAlpha(0.45);
      scene.time.delayedCall(opts.guardMs, () => { armed = true; if (c.active && c.enabled) c.setAlpha(1); });
    }
    c.isArmed = () => armed;
    c.press = () => { if (c.enabled && armed) onClick && onClick(); };
    return c;
  };

  // ---------------------------------------------------------------- dialogue
  DK.Dialogue = class {
    constructor(scene) { this.scene = scene; this.active = false; this.objs = []; }
    show(lines, onDone) {
      lines = (lines || []).filter(Boolean);
      if (!lines.length) { onDone && onDone(); return; }
      this.close(true);
      const s = this.scene, W = DK.W, H = DK.H;
      this.lines = lines; this.i = 0; this.onDone = onDone; this.active = true; this.openedAt = s.time.now;
      const panelY = H - 118;
      this.shade = s.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.25).setScrollFactor(0).setDepth(D_UI + 50).setInteractive();
      this.panel = s.add.rectangle(W / 2, panelY + 52, W - 40, 112, 0x14161a, 0.94).setStrokeStyle(2, 0xf2c14e).setScrollFactor(0).setDepth(D_UI + 51);
      this.portrait = s.add.image(78, panelY + 52, 'portrait_system').setScrollFactor(0).setDepth(D_UI + 52);
      this.name = DK.txt(s, 136, panelY + 6, '', { fontSize: '18px', fontStyle: 'bold' }).setDepth(D_UI + 52);
      this.text = DK.txt(s, 136, panelY + 34, '', { fontSize: '20px', color: '#f2e6c9', wordWrap: { width: W - 200, useAdvancedWrap: true }, lineSpacing: 4 }).setDepth(D_UI + 52);
      this.hint = DK.txt(s, W - 34, panelY + 96, DK.touchMode ? '点击继续 ▶' : '空格/点击 继续 ▶', { fontSize: '13px', color: '#9a9a9a' }).setOrigin(1, 0.5).setDepth(D_UI + 52);
      this.skip = DK.button(s, W - 78, panelY - 4, 92, 30, '跳过 »', () => this.close(), { fontSize: 14, depth: D_UI + 53 }); // on the panel's top edge, clear of 暂停 (review P2-8)
      this.objs = [this.shade, this.panel, this.portrait, this.name, this.text, this.hint, this.skip];
      this.tw = s.tweens.add({ targets: this.hint, alpha: 0.3, yoyo: true, repeat: -1, duration: 500 });
      this.onKey = () => this.advance();
      this.shade.on('pointerup', this.onKey);
      s.input.keyboard && s.input.keyboard.on('keydown-SPACE', this.onKey);
      s.input.keyboard && s.input.keyboard.on('keydown-ENTER', this.onKey);
      s.input.keyboard && s.input.keyboard.on('keydown-E', this.onKey);
      this.render();
    }
    render() {
      const l = this.lines[this.i], sp = DK.SPEAKERS[l.speaker] || { name: l.speaker, color: '#fff' };
      const pk = 'portrait_' + l.speaker, pa = (DK.PORTRAIT_ART[l.speaker] || []).find(c => DK.hasArt(c[0])), panelY = DK.H - 118;
      this.portrait.clearTint();
      if (DK.ART[pk] && DK.ART[pk].real) { DK.applyArt(this.portrait, pk); this.portrait.setPosition(78, panelY + 52).setVisible(true); }
      else if (pa) { // full-body art standing on the dialogue panel
        const a = DK.ARTX[pa[0]], rs = a.res_scale || 1;
        this.portrait.setTexture(pa[0], pa[1]).setOrigin(a.anchor[0] / a.frame_size[0], a.anchor[1] / a.frame_size[1]).setScale(pa[2] / rs).setFlipX(false).setPosition(78, panelY + 104).setVisible(true);
      } else if (this.scene.textures.exists(pk) && l.speaker !== 'system') { DK.applyArt(this.portrait, pk); this.portrait.setPosition(78, panelY + 52).setVisible(true); }
      else this.portrait.setVisible(false);
      this.name.setText(sp.name || '').setColor(sp.color || '#fff');
      this.full = l.text; this.shown = 0; this.typing = true;
      this.text.setText('').setColor(l.speaker === 'system' ? '#cfcfcf' : '#f2e6c9');
      if (this.typeEv) this.typeEv.remove();
      this.typeEv = this.scene.time.addEvent({ delay: 28, loop: true, callback: () => {
        this.shown += 1; this.text.setText(this.full.slice(0, this.shown));
        if (this.shown >= this.full.length) { this.typing = false; this.typeEv.remove(); }
      } });
    }
    advance() {
      if (!this.active || this.scene.time.now - this.openedAt < 220) return;
      if (this.typing) { this.typing = false; this.typeEv && this.typeEv.remove(); this.text.setText(this.full); return; }
      this.i++;
      if (this.i >= this.lines.length) this.close(); else this.render();
    }
    close(silent) {
      if (!this.active) return;
      this.active = false;
      const s = this.scene;
      if (this.typeEv) this.typeEv.remove();
      if (this.tw) this.tw.remove();
      if (s.input.keyboard) { s.input.keyboard.off('keydown-SPACE', this.onKey); s.input.keyboard.off('keydown-ENTER', this.onKey); s.input.keyboard.off('keydown-E', this.onKey); }
      this.objs.forEach(o => o && o.destroy()); this.objs = [];
      s.inputBlockUntil = s.time.now + 250;
      const cb = this.onDone; this.onDone = null;
      if (!silent && cb) cb();
    }
  };

  // ---------------------------------------------------------------- banner / floating text
  DK.banner = function (scene, text, opts) {
    opts = opts || {};
    const y = opts.y || 92;
    const t = DK.txt(scene, DK.W / 2, y, text, { fontSize: (opts.size || 26) + 'px', color: opts.color || '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5, align: 'center' })
      .setOrigin(0.5).setDepth(D_UI + 30).setAlpha(0);
    scene.tweens.add({ targets: t, alpha: 1, y: y - 6, duration: 180 });
    scene.tweens.add({ targets: t, alpha: 0, delay: opts.dur || 1600, duration: 400, onComplete: () => t.destroy() });
    return t;
  };
  DK.speech = function (scene, line, dur) { // non-blocking subtitle
    const sp = DK.SPEAKERS[line.speaker] || { name: '', color: '#fff' };
    const str = (sp.name ? sp.name + '：' : '') + line.text;
    return DK.banner(scene, str, { y: DK.H - 70, size: 19, color: sp.color, dur: dur || 2200 });
  };
  DK.floatText = function (scene, x, y, str, color, size) {
    const t = scene.add.text(x, y, str, { fontFamily: DK.FONT, fontSize: (size || 14) + 'px', color: color || '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
      .setResolution(DK.R).setOrigin(0.5).setDepth(900);
    scene.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  };

  // ---------------------------------------------------------------- card choice (三选一 / shop)
  // cards: [{title, desc, icon, cost?, onPick, disabled?}]
  DK.cardChoice = function (scene, title, cards, opts) {
    opts = opts || {};
    const objs = [], W = DK.W, H = DK.H;
    const shade = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setScrollFactor(0).setDepth(D_UI + 40).setInteractive();
    const tt = DK.txt(scene, W / 2, 70, title, { fontSize: '30px', fontStyle: 'bold', color: '#f2c14e', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(D_UI + 41);
    objs.push(shade, tt);
    if (opts.subtitle) objs.push(DK.txt(scene, W / 2, 108, opts.subtitle, { fontSize: '16px', color: '#cfcfcf' }).setOrigin(0.5).setDepth(D_UI + 41));
    const cw = 230, ch = 270, gap = 26, n = cards.length, x0 = W / 2 - ((n - 1) * (cw + gap)) / 2;
    let done = false;
    const api = { objs, close() { if (api.closed) return; api.closed = true; objs.forEach(o => o.destroy()); keyOff(); }, buttons: [] };
    const pick = (i) => {
      if (done || api.closed) return; const c = cards[i]; if (!c || c.disabled) return;
      const keep = c.onPick && c.onPick();
      if (keep === 'keep') return; // shop: stay open
      done = true; api.close();
    };
    api.pick = pick;
    cards.forEach((c, i) => {
      const x = x0 + i * (cw + gap), y = H / 2 + 20;
      const b = DK.button(scene, x, y, cw, ch, '', () => pick(i), { depth: D_UI + 42, guardMs: opts.guardMs != null ? opts.guardMs : 450, color: 0x1d2024, stroke: c.disabled ? 0x555555 : 0xf2c14e });
      const ic = scene.add.image(0, -ch / 2 + 58, c.icon || 'icon_mod').setScrollFactor(0); DK.applyArt(ic, c.icon || 'icon_mod'); ic.setDisplaySize(72, 72);
      b.add(ic);
      if (DK.ART[c.icon] && !DK.ART[c.icon].real && DK.ICON_CHAR[c.icon]) b.add(DK.txt(scene, 0, -ch / 2 + 58, DK.ICON_CHAR[c.icon], { fontSize: '32px', fontStyle: 'bold' }).setOrigin(0.5));
      b.add(DK.txt(scene, 0, -ch / 2 + 116, c.title, { fontSize: '22px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5));
      b.add(DK.txt(scene, 0, -ch / 2 + 150, c.desc || '', { fontSize: '15px', color: '#cfcfcf', align: 'center', wordWrap: { width: cw - 24, useAdvancedWrap: true }, lineSpacing: 4 }).setOrigin(0.5, 0));
      if (c.cost != null) b.add(DK.txt(scene, 0, ch / 2 - 26, '废铁 ' + c.cost, { fontSize: '17px', color: c.disabled ? '#888' : '#f2c14e' }).setOrigin(0.5));
      if (!DK.touchMode) b.add(DK.txt(scene, -cw / 2 + 12, -ch / 2 + 10, String(i + 1), { fontSize: '14px', color: '#888' }));
      if (c.disabled) b.setEnabled(false);
      objs.push(b); api.buttons.push(b);
    });
    if (opts.skipLabel) {
      const sb = DK.button(scene, W / 2, H - 42, 180, 42, opts.skipLabel, () => { if (!api.closed) { api.close(); opts.onSkip && opts.onSkip(); } }, { depth: D_UI + 42, guardMs: 300 });
      objs.push(sb);
    }
    const onKey = (ev) => { const k = parseInt(ev.key, 10); if (k >= 1 && k <= cards.length && api.buttons[k - 1]) api.buttons[k - 1].press(); };
    const kb = scene.input.keyboard; kb && kb.on('keydown', onKey);
    function keyOff() { kb && kb.off('keydown', onKey); scene.inputBlockUntil = scene.time.now + 250; }
    return api;
  };
})(window.DK);
// Volume rows: 音乐 / 音效 with -/+ buttons. Returns created objects.
(function (DK) {
  DK.volumeControls = function (scene, x, y, depth) {
    const objs = [];
    [['music', '音乐'], ['sfx', '音效']].forEach(([k, label], i) => {
      const yy = y + i * 50;
      const t = DK.txt(scene, x, yy, '', { fontSize: '18px', color: '#f2e6c9' }).setOrigin(0.5).setDepth(depth);
      const upd = () => t.setText(`${label}  ${Math.round(DK.vol[k] * 100)}%`);
      upd();
      objs.push(t,
        DK.button(scene, x - 120, yy, 44, 38, '－', () => { DK.setVolume(k, DK.vol[k] - 0.1); upd(); if (k === 'sfx') DK.sfx(scene, 'pickup_scrap', { minGap: 0 }); }, { depth, fontSize: 20 }),
        DK.button(scene, x + 120, yy, 44, 38, '＋', () => { DK.setVolume(k, DK.vol[k] + 0.1); upd(); if (k === 'sfx') DK.sfx(scene, 'pickup_scrap', { minGap: 0 }); }, { depth, fontSize: 20 }));
    });
    return objs;
  };
})(window.DK);

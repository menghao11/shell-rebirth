// Twin-stick touch controls for iPhone: left = move (floating stick), right = aim + auto-fire, plus buttons.
(function (DK) {
  DK.touchMode = (function () {
    const q = new URLSearchParams(location.search);
    if (q.get('touch') === '1') return true;
    if (q.get('touch') === '0') return false;
    return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia && matchMedia('(pointer: coarse)').matches;
  })();

  DK.TouchControls = class {
    constructor(scene, buttons) {
      this.scene = scene; this.buttons = buttons; // [{id,label,x,y,r}]
      this.move = { x: 0, y: 0 }; this.aim = { x: 1, y: 0, active: false, mag: 0 };
      this.down = {}; this.ptrs = {}; this.queue = {}; this.R = 62;
      this.g = scene.add.graphics().setScrollFactor(0).setDepth(990);
      this.labels = buttons.map(b => DK.txt(scene, b.x, b.y, b.label, { fontSize: (b.r > 34 ? 18 : 15) + 'px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(991).setAlpha(0.9));
      scene.input.addPointer(3);
      this.onDown = p => this.handleDown(p); this.onMove = p => this.handleMove(p); this.onUp = p => this.handleUp(p);
      scene.input.on('pointerdown', this.onDown); scene.input.on('pointermove', this.onMove);
      scene.input.on('pointerup', this.onUp); scene.input.on('pointerupoutside', this.onUp);
      scene.events.once('shutdown', () => this.destroy());
      this.listeners = {};
    }
    on(ev, fn) { this.listeners[ev] = fn; }
    emit(ev, id) { this.listeners[ev] && this.listeners[ev](id); }
    lp(p) { return { x: p.x / DK.R, y: p.y / DK.R }; }
    handleDown(p) {
      if (this.scene.uiLock && this.scene.uiLock()) return;
      const { x, y } = this.lp(p);
      for (const b of this.buttons) {
        if (b.hidden) continue;
        if ((x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r + 10) ** 2) { this.ptrs[p.id] = { kind: 'btn', id: b.id }; this.down[b.id] = true; this.queue[b.id] = true; this.emit('press', b.id); return; }
      }
      if (x < DK.W * 0.45) this.ptrs[p.id] = { kind: 'move', ox: x, oy: y, x, y };
      else this.ptrs[p.id] = { kind: 'aim', ox: x, oy: y, x, y };
    }
    handleMove(p) {
      const s = this.ptrs[p.id]; if (!s || s.kind === 'btn') return;
      const { x, y } = this.lp(p); s.x = x; s.y = y;
      let dx = x - s.ox, dy = y - s.oy; const d = Math.hypot(dx, dy);
      if (d > this.R) { s.ox = x - dx / d * this.R; s.oy = y - dy / d * this.R; dx = x - s.ox; dy = y - s.oy; } // drag the base along
      this.update();
    }
    handleUp(p) {
      const s = this.ptrs[p.id]; if (!s) return;
      delete this.ptrs[p.id];
      if (s.kind === 'btn') { this.down[s.id] = false; this.emit('release', s.id); }
      this.update();
    }
    update() {
      this.move.x = this.move.y = 0; this.aim.active = false; this.aim.mag = 0;
      for (const s of Object.values(this.ptrs)) {
        if (s.kind === 'btn') continue;
        const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), m = Math.min(1, d / this.R);
        if (s.kind === 'move') { if (d > 6) { this.move.x = dx / d * m; this.move.y = dy / d * m; } }
        else if (d > 10) { this.aim.x = dx / d; this.aim.y = dy / d; this.aim.mag = m; this.aim.active = m > 0.25; }
      }
    }
    consume(id) { const v = this.queue[id]; this.queue[id] = false; return !!v; }
    reset() { this.ptrs = {}; this.down = {}; this.queue = {}; this.update(); }
    draw() {
      const g = this.g; g.clear();
      for (const b of this.buttons) {
        if (b.hidden) continue;
        const on = this.down[b.id];
        g.fillStyle(on ? 0xf2c14e : 0x000000, on ? 0.55 : 0.32).fillCircle(b.x, b.y, b.r);
        g.lineStyle(2, 0xffffff, b.disabled ? 0.25 : 0.6).strokeCircle(b.x, b.y, b.r);
        if (b.cd != null && b.cd > 0) g.fillStyle(0x000000, 0.45).slice(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.cd, false).fillPath();
      }
      this.labels.forEach((t, i) => { const b = this.buttons[i]; t.setVisible(!b.hidden).setText(b.label).setAlpha(b.disabled ? 0.4 : 0.95); });
      for (const s of Object.values(this.ptrs)) {
        if (s.kind === 'btn') continue;
        g.lineStyle(2, 0xffffff, 0.35).strokeCircle(s.ox, s.oy, this.R).fillStyle(0xffffff, 0.08).fillCircle(s.ox, s.oy, this.R);
        g.fillStyle(s.kind === 'aim' ? 0xff6a4a : 0xffffff, 0.5).fillCircle(s.x, s.y, 26);
      }
      if (!Object.values(this.ptrs).some(s => s.kind === 'move')) { // hint ghost sticks
        g.lineStyle(2, 0xffffff, 0.12).strokeCircle(130, DK.H - 110, this.R);
      }
    }
    destroy() {
      const i = this.scene.input;
      i.off('pointerdown', this.onDown); i.off('pointermove', this.onMove); i.off('pointerup', this.onUp); i.off('pointerupoutside', this.onUp);
    }
  };
})(window.DK);

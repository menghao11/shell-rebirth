// Touch controls for iPhone: left = move (floating stick), right = the 开火 aim joystick (kind:'fire') plus buttons.
// 开火 joystick: press + drag = fire continuously that way; hold without dragging = fire along the current aim line; release = stop.
// No auto-aim and no auto-fire on touch; free taps on the right half do nothing.
// Sizes are in logical px (960x540); on an iPhone in landscape 1 pt ≈ 1.4 logical px, so r 44 ≈ 62 pt finger target.
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
      this.move = { x: 0, y: 0 }; this.aim = { x: 1, y: 0, active: false, mag: 0 }; this.fireHeld = false; this.fireAim = { x: 1, y: 0, active: false };
      this.down = {}; this.ptrs = {}; this.queue = {}; this.R = DK.TOUCH.stickR; this.KNOB = DK.TOUCH.knobR;
      this.g = scene.add.graphics().setScrollFactor(0).setDepth(990);
      this.labels = buttons.map(b => DK.txt(scene, b.x, b.y, b.label, { fontSize: Math.round(Math.max(18, b.r * (b.kind === 'fire' ? 0.36 : 0.4))) + 'px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(991).setAlpha(0.9));
      scene.input.addPointer(3);
      this.onDown = p => this.handleDown(p); this.onMove = p => this.handleMove(p); this.onUp = p => this.handleUp(p);
      scene.input.on('pointerdown', this.onDown); scene.input.on('pointermove', this.onMove);
      scene.input.on('pointerup', this.onUp); scene.input.on('pointerupoutside', this.onUp);
      scene.events.once('shutdown', () => this.destroy());
      this.listeners = {};
      DK.TouchPad.attach(this);
    }
    on(ev, fn) { this.listeners[ev] = fn; }
    emit(ev, id) { this.listeners[ev] && this.listeners[ev](id); }
    lp(p) { return { x: p.x / DK.R, y: p.y / DK.R }; }
    handleDown(p) {
      if (this.scene.uiLock && this.scene.uiLock()) return;
      if (DK.portraitPad) return; // portrait: thumbs use the DOM pad below the game view
      const { x, y } = this.lp(p);
      for (const b of this.buttons) {
        if (b.hidden) continue;
        if ((x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r + DK.TOUCH.hitPad) ** 2) { this.ptrs[p.id] = b.kind === 'fire' ? { kind: 'fire', id: b.id, ox: b.x, oy: b.y, x, y, r: b.r } : { kind: 'btn', id: b.id }; this.down[b.id] = true; this.queue[b.id] = true; this.emit('press', b.id); this.update(); return; }
      }
      if (x < DK.W * 0.45) this.ptrs[p.id] = { kind: 'move', ox: x, oy: y, x, y };
    }
    handleMove(p) {
      const s = this.ptrs[p.id]; if (!s || s.kind === 'btn') return;
      const { x, y } = this.lp(p); s.x = x; s.y = y;
      if (s.kind === 'fire') { this.update(); return; } // fire button stays put; drag = aim
      let dx = x - s.ox, dy = y - s.oy; const d = Math.hypot(dx, dy);
      if (d > this.R) { s.ox = x - dx / d * this.R; s.oy = y - dy / d * this.R; dx = x - s.ox; dy = y - s.oy; } // drag the base along
      this.update();
    }
    handleUp(p) {
      const s = this.ptrs[p.id]; if (!s) return;
      delete this.ptrs[p.id];
      if (s.kind === 'btn' || s.kind === 'fire') { this.down[s.id] = false; this.emit('release', s.id); }
      this.update();
    }
    update() {
      this.move.x = this.move.y = 0; this.aim.active = false; this.aim.mag = 0; this.fireHeld = false; this.fireAim.active = false;
      for (const s of Object.values(this.ptrs)) {
        if (s.kind === 'btn') continue;
        if (s.kind === 'fire') {
          this.fireHeld = true; const fx = s.x - s.ox, fy = s.y - s.oy, fd = Math.hypot(fx, fy);
          if (fd > DK.TOUCH.fireAimDead) { this.fireAim.x = fx / fd; this.fireAim.y = fy / fd; this.fireAim.active = true; }
          continue;
        }
        const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), m = Math.min(1, d / (this.R * DK.TOUCH.fullAt)); // bigger ring, same thumb travel for full speed
        if (s.kind === 'move') { if (d > 6) { this.move.x = dx / d * m; this.move.y = dy / d * m; } }
        else if (d > 10) { this.aim.x = dx / d; this.aim.y = dy / d; this.aim.mag = m; this.aim.active = d > DK.TOUCH.aimDead; }
      }
    }
    // knob centre for the 开火 joystick (logical px), clamped to 60% of its radius
    fireKnob(b) {
      const s = Object.values(this.ptrs).find(q => q.kind === 'fire'); if (!s || !this.fireAim.active) return { x: b.x, y: b.y };
      const d = Math.min(b.r * 0.6, Math.hypot(s.x - s.ox, s.y - s.oy)); return { x: b.x + this.fireAim.x * d, y: b.y + this.fireAim.y * d };
    }
    consume(id) { const v = this.queue[id]; this.queue[id] = false; return !!v; }
    reset() { this.ptrs = {}; this.down = {}; this.queue = {}; this.update(); }
    draw() {
      const g = this.g; g.clear();
      if (DK.portraitPad) { this.labels.forEach(t => t.setVisible(false)); DK.TouchPad.sync(this); return; }
      for (const b of this.buttons) {
        if (b.hidden) continue;
        const on = this.down[b.id];
        if (b.kind === 'fire') {
          g.fillStyle(on ? 0xff5a3c : 0xc0392b, on ? 0.62 : 0.4).fillCircle(b.x, b.y, b.r);
          g.lineStyle(4, 0xffffff, on ? 0.95 : 0.75).strokeCircle(b.x, b.y, b.r);
          g.lineStyle(2, 0xffffff, 0.35).strokeCircle(b.x, b.y, b.r * 0.62);
          const k = b.r * 0.86, k2 = b.r * 0.66; // crosshair ticks
          g.lineStyle(3, 0xffffff, 0.6).lineBetween(b.x - k, b.y, b.x - k2, b.y).lineBetween(b.x + k2, b.y, b.x + k, b.y).lineBetween(b.x, b.y - k, b.x, b.y - k2).lineBetween(b.x, b.y + k2, b.x, b.y + k);
          const kp = this.fireKnob(b); // joystick knob: follows the thumb inside the button
          g.fillStyle(0xffffff, on ? 0.6 : 0.28).fillCircle(kp.x, kp.y, b.r * 0.4);
          continue;
        }
        g.fillStyle(on ? 0xf2c14e : 0x000000, on ? 0.55 : 0.36).fillCircle(b.x, b.y, b.r);
        g.lineStyle(3, 0xffffff, b.disabled ? 0.25 : 0.65).strokeCircle(b.x, b.y, b.r);
        if (b.cd != null && b.cd > 0) g.fillStyle(0x000000, 0.45).slice(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.cd, false).fillPath();
      }
      this.labels.forEach((t, i) => { const b = this.buttons[i]; t.setVisible(!b.hidden).setText(b.label).setAlpha(b.disabled ? 0.4 : 0.95); });
      for (const s of Object.values(this.ptrs)) {
        if (s.kind === 'btn') continue;
        if (s.kind === 'fire') continue; // knob drawn with the 开火 button
        g.lineStyle(3, 0xffffff, 0.4).strokeCircle(s.ox, s.oy, this.R).fillStyle(0xffffff, 0.08).fillCircle(s.ox, s.oy, this.R);
        g.fillStyle(s.kind === 'aim' ? 0xff6a4a : 0xffffff, 0.55).fillCircle(s.x, s.y, this.KNOB);
      }
      if (!Object.values(this.ptrs).some(s => s.kind === 'move')) { // hint ghost sticks
        const gx = DK.TOUCH.ghost[0], gy = DK.H - DK.TOUCH.ghost[1];
        g.lineStyle(3, 0xffffff, 0.16).strokeCircle(gx, gy, this.R).fillStyle(0xffffff, 0.12).fillCircle(gx, gy, this.KNOB);
      }
    }
    destroy() {
      DK.TouchPad.detach(this);
      const i = this.scene.input;
      i.off('pointerdown', this.onDown); i.off('pointermove', this.onMove); i.off('pointerup', this.onUp); i.off('pointerupoutside', this.onUp);
    }
  };

  // ---- portrait pad: DOM controls in the free area below the game view (iPhone held upright).
  // Touches are fed into the active scene's TouchControls as pointers in logical units (css px / s),
  // so move / aim / fire / buttons behave exactly like the landscape in-canvas controls.
  DK.TouchPad = {
    el: null, tc: null, w: 0, h: 0, s: 0.62, els: {}, rings: [], cache: {},
    // [offset from right, offset from bottom, radius] in landscape logical units (same arc as run.js); act sits top-centre
    POS: { fire: [120, 130, 82], dash: [285, 86, 60], grenade: [262, 232, 50], reload: [110, 300, 44], swap: [228, 362, 40] },
    init() {
      if (this.el || !DK.touchMode) return;
      this.el = document.getElementById('pad'); if (!this.el) return;
      const opt = { passive: false };
      this.el.addEventListener('touchstart', e => this.onTouch(e, 'start'), opt);
      this.el.addEventListener('touchmove', e => this.onTouch(e, 'move'), opt);
      this.el.addEventListener('touchend', e => this.onTouch(e, 'end'), opt);
      this.el.addEventListener('touchcancel', e => this.onTouch(e, 'end'), opt);
    },
    attach(tc) { this.init(); this.tc = tc; this.build(); },
    detach(tc) { if (this.tc === tc) { this.tc = null; this.build(); } },
    layout(w, h, changed) { this.init(); this.w = w; this.h = h; if (changed && this.tc) this.tc.reset(); this.build(); },
    geom(id) { // css px centre + radius inside the pad
      const s = this.s, b = this.tc && this.tc.buttons.find(x => x.id === id);
      if (id === 'act') return { x: this.w / 2, y: Math.max(48 * s + 10, 70 * s), r: 48 * s };
      const p = this.POS[id]; if (!p) return null;
      return { x: this.w - p[0] * s, y: this.h - p[1] * s, r: (b ? b.r : p[2]) * s };
    },
    build() {
      if (!this.el) return;
      this.el.innerHTML = ''; this.els = {}; this.rings = []; this.cache = {};
      if (!this.tc || !DK.portraitPad) return;
      this.s = Math.max(0.42, Math.min(0.66, (this.h - 16) / 420, this.w / 560));
      for (const b of this.tc.buttons) {
        const g = this.geom(b.id); if (!g) continue;
        const d = document.createElement('div'); d.className = 'pbtn' + (b.kind === 'fire' ? ' fire' : '');
        Object.assign(d.style, { left: (g.x - g.r) + 'px', top: (g.y - g.r) + 'px', width: 2 * g.r + 'px', height: 2 * g.r + 'px', fontSize: Math.round(Math.max(15, g.r * 0.42)) + 'px' });
        d.dataset.id = b.id; this.el.appendChild(d); this.els[b.id] = d;
      }
      const sc = this.tc.scene, menu = sc.togglePause ? ['暂停', () => sc.togglePause()] : sc.openSettings ? ['设置', () => sc.openSettings()] : null;
      if (menu) { // the in-canvas 暂停/设置 is tiny in portrait: mirror it as a big pad button (top-right)
        const m = document.createElement('div'); m.className = 'pbtn menu'; m.textContent = menu[0];
        Object.assign(m.style, { right: '12px', top: '10px', width: '84px', height: '44px', borderRadius: '10px', fontSize: '17px' });
        this.el.appendChild(m); this.menu = { el: m, fn: menu[1] };
      } else this.menu = null;
      for (let i = 0; i < 3; i++) { const r = document.createElement('div'), k = document.createElement('div'); r.className = 'ring'; k.className = 'knob'; this.el.appendChild(r); this.el.appendChild(k); this.rings.push([r, k]); }
      const fk = document.createElement('div'); fk.className = 'knob fireknob'; this.el.appendChild(fk); this.fireKnobEl = fk;
      this.sync(this.tc);
    },
    toLogical(t) { const r = this.el.getBoundingClientRect(); return { x: (t.clientX - r.left) / this.s, y: (t.clientY - r.top) / this.s }; },
    onTouch(e, kind) {
      e.preventDefault();
      const tc = this.tc; if (!tc) return;
      for (const t of e.changedTouches) {
        const key = 'pad' + t.identifier, q = this.toLogical(t);
        if (kind === 'start') {
          if (this.menu) { const r = this.menu.el.getBoundingClientRect(); if (t.clientX >= r.left - 6 && t.clientX <= r.right + 6 && t.clientY >= r.top - 6 && t.clientY <= r.bottom + 6) { if (!(tc.scene.dlg && tc.scene.dlg.active)) this.menu.fn(); continue; } }
          if (tc.scene.uiLock && tc.scene.uiLock()) continue;
          let hit = null;
          for (const b of tc.buttons) { if (b.hidden) continue; const g = this.geom(b.id); if (g && (q.x * this.s - g.x) ** 2 + (q.y * this.s - g.y) ** 2 <= (g.r + 8) ** 2) { hit = { b, g }; break; } }
          if (hit) {
            const b = hit.b;
            tc.ptrs[key] = b.kind === 'fire' ? { kind: 'fire', id: b.id, ox: hit.g.x / this.s, oy: hit.g.y / this.s, x: q.x, y: q.y, r: b.r } : { kind: 'btn', id: b.id };
            tc.down[b.id] = true; tc.queue[b.id] = true; tc.emit('press', b.id);
          } else if (q.x * this.s < this.w * 0.5) tc.ptrs[key] = { kind: 'move', ox: q.x, oy: q.y, x: q.x, y: q.y }; // right half: nothing (no aim/fire outside 开火)
          tc.update();
        } else if (kind === 'move') tc.handleMove({ id: key, x: q.x * DK.R, y: q.y * DK.R });
        else tc.handleUp({ id: key });
      }
    },
    sync(tc) {
      if (!this.el || tc !== this.tc) return;
      for (const b of tc.buttons) {
        const d = this.els[b.id]; if (!d) continue;
        const cls = 'pbtn' + (b.kind === 'fire' ? ' fire' : '') + (tc.down[b.id] ? ' on' : '') + (b.disabled ? ' off' : '') + (b.hidden ? ' hide' : '');
        if (this.cache[b.id + 'c'] !== cls) { d.className = cls; this.cache[b.id + 'c'] = cls; }
        if (this.cache[b.id + 'l'] !== b.label) { d.textContent = b.label; this.cache[b.id + 'l'] = b.label; }
        d.style.opacity = b.cd > 0 ? 0.55 : '';
      }
      const fb = tc.buttons.find(b => b.kind === 'fire'), fg = fb && this.geom(fb.id), fk = this.fireKnobEl;
      if (fk && fg) { const kp = tc.fireKnob({ x: fg.x / this.s, y: fg.y / this.s, r: fg.r / this.s }), kr = fg.r * 0.4;
        Object.assign(fk.style, { display: fb.hidden ? 'none' : 'block', left: (kp.x * this.s - kr) + 'px', top: (kp.y * this.s - kr) + 'px', width: 2 * kr + 'px', height: 2 * kr + 'px', opacity: tc.fireHeld ? 1 : 0.5 }); }
      const ps = Object.entries(tc.ptrs).filter(([k, p]) => k.startsWith('pad') && (p.kind === 'move' || p.kind === 'aim'));
      const s = this.s, R = tc.R * s, K = tc.KNOB * s;
      let ghost = !ps.some(([, p]) => p.kind === 'move');
      this.rings.forEach(([r, k], i) => {
        let p = ps[i] && ps[i][1], cx, cy, kx, ky, show = true;
        if (p) { cx = p.ox * s; cy = p.oy * s; kx = p.x * s; ky = p.y * s; k.className = 'knob' + (p.kind === 'aim' ? ' aim' : ''); }
        else if (ghost) { cx = Math.min(this.w * 0.25, R + 16); cy = this.h - R - 30; kx = cx; ky = cy; ghost = false; k.className = 'knob'; r.style.opacity = 0.5; }
        else show = false;
        r.style.display = k.style.display = show ? 'block' : 'none'; if (!show) return;
        if (p) r.style.opacity = 1;
        Object.assign(r.style, { left: (cx - R) + 'px', top: (cy - R) + 'px', width: 2 * R + 'px', height: 2 * R + 'px' });
        Object.assign(k.style, { left: (kx - K) + 'px', top: (ky - K) + 'px', width: 2 * K + 'px', height: 2 * K + 'px' });
      });
    }
  };
})(window.DK);

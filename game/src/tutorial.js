// 教学关: short, skippable first-run tutorial played inside the Run scene (scene.tutorial = 'first' | 'replay').
// Steps complete on doing the thing: move → auto-fire + aim assist → 瞄准 stick → drag-and-release burst → grenade → dash.
// Completion is stored in localStorage; replay from 铁皮屋 → 设置 → 重玩教学关.
(function (DK) {
  const KEY = 'dankelunhui_tutorial_v1';
  DK.tutorialDone = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } };
  DK.setTutorialDone = () => { try { localStorage.setItem(KEY, '1'); } catch (e) {} };
  const T = () => DK.touchMode;
  DK.TUTORIAL_STEPS = [
    { id: 'move', hl: 'move',
      text: () => T() ? '用左手拖动屏幕左侧的摇杆移动，走进绿色圆圈' : '用 WASD 移动，走进绿色圆圈' },
    { id: 'auto',
      text: () => (T() ? '自动射击：角色一直朝移动方向开火，' : '自动射击：一直朝鼠标方向开火，') + '子弹会轻微吸向枪口附近的敌人（不会自动锁定）。击倒 3 个靶子' },
    { id: 'aim', hl: 'fire',
      text: () => T() ? '不想转身？按住右下「瞄准」摇杆推向靶子，就朝那边射击（走路方向不变）。击倒身后 2 个靶子' : '移动鼠标就能朝任意方向射击（走路方向不变）。击倒身后 2 个靶子' },
    { id: 'burst', hl: 'fire',
      text: () => (T() ? '精准连发：拖动「瞄准」出现瞄准线，对准后松手' : '精准连发：按住鼠标左键出现瞄准线，对准后松开') + ' → 5 发精准连发（约 2 秒冷却）。蓝色靶子只吃连发，击倒 2 个' },
    { id: 'grenade', hl: 'grenade',
      text: () => (T() ? '手雷：按住「手雷」显示落点，松手投出。' : '手雷：按住 Q 显示落点，松开投出。') + '橙色靶子只怕手雷，炸掉扎堆的 3 个' },
    { id: 'dash', hl: 'dash',
      text: () => (T() ? '冲刺：点「冲刺」' : '冲刺：按空格') + '朝移动方向快速闪避，冲刺中不会受伤。躲开红色子弹，冲刺 2 次' }
  ];
  DK.Tutorial = class {
    constructor(scene, mode) {
      this.s = scene; this.mode = mode; this.i = -1; this.t = 0; this.kills = 0; this.done = false; this.goal = null; this.dummies = [];
      const W = DK.W, D = 1000;
      this.box = scene.add.rectangle(W / 2, 112, 860, 78, 0x000000, 0.66).setStrokeStyle(2, 0xf2c14e, 0.9).setScrollFactor(0).setDepth(D);
      this.stepTxt = DK.txt(scene, W / 2 - 418, 80, '', { fontSize: '14px', color: '#f2c14e', fontStyle: 'bold' }).setDepth(D + 1);
      this.txt = DK.txt(scene, W / 2, 118, '', { fontSize: '20px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: 820, useAdvancedWrap: true }, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 1);
      this.skipBtn = DK.button(scene, DK.touchMode ? W - 58 : W - 52, DK.touchMode ? 118 : 90, DK.touchMode ? 100 : 84, DK.touchMode ? 42 : 30, '跳过教学', () => this.finish(true), { fontSize: DK.touchMode ? 16 : 13, depth: D + 3 });
      this.tip = null;
      if (DK.touchMode) { // portrait: the canvas is small, so mirror the prompt in the pad area below it
        const el = document.createElement('div'); el.id = 'tuttip';
        Object.assign(el.style, { position: 'fixed', zIndex: 7, display: 'none', background: 'rgba(0,0,0,.72)', border: '2px solid #f2c14e', borderRadius: '12px', color: '#fff', font: 'bold 15px/1.45 sans-serif', padding: '8px 10px', boxSizing: 'border-box', pointerEvents: 'auto' });
        el.innerHTML = '<div class="tt-step" style="color:#f2c14e;font-size:13px"></div><div class="tt-text"></div><button class="tt-skip" style="margin-top:6px;font:bold 14px sans-serif;padding:5px 12px;border-radius:8px;border:2px solid #f2c14e;background:#2b2f27;color:#fff">跳过教学</button>';
        el.querySelector('.tt-skip').addEventListener('click', e => { e.preventDefault(); this.finish(true); });
        el.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
        document.body.appendChild(el); this.tip = el;
      }
      DK.banner(scene, '教学关 · 6 步学会操作', { size: 26, color: '#f2c14e', y: 200, dur: 1500 });
      this.next();
    }
    get step() { return DK.TUTORIAL_STEPS[this.i]; }
    setText() {
      const st = this.step, txt = st ? st.text() : '教学完成！以后可以在铁皮屋「设置」里重玩教学关', head = st ? `教学 ${this.i + 1}/${DK.TUTORIAL_STEPS.length}` : '完成';
      this.stepTxt.setText(head); this.txt.setText(txt);
      if (this.tip) { this.tip.querySelector('.tt-step').textContent = head; this.tip.querySelector('.tt-text').textContent = txt; }
      if (this.s.touch) this.s.touch.hl = st ? st.hl || null : null;
    }
    clearDummies() { this.dummies.forEach(e => e.alive && this.s.killEnemy(e, 'self')); this.dummies = []; }
    dummy(x, y, o) {
      const e = DK.spawnEnemy(this.s, 'rifle', x, y, Object.assign({ dummy: true, hp: 30, maxHp: 30, y0: y }, o || {}));
      this.dummies.push(e); return e;
    }
    tp(x, y) { const p = this.s.player; p.spr.body.reset(x, y); this.s.spark && this.s.spark(x, y, 0x7ee07a, 6); }
    next() {
      const s = this.s, W = DK.W, H = DK.H, p = s.player;
      this.clearDummies(); this.i++; this.t = 0; this.kills = 0; this.goal = null; this.turret = null;
      const st = this.step;
      if (!st) return this.complete();
      if (this.i > 0) { DK.sfx(s, 'pickup_powerup', { volume: 0.6 }); }
      switch (st.id) {
        case 'move': this.goals = [[340, 380], [600, 170]]; this.goal = this.goals.shift(); break;
        case 'auto': this.tp(520, H / 2); p.aimAng = 0; [[770, 236, 0], [850, 290, 1.8], [800, 346, 3.6]].forEach(([x, y, ph]) => this.dummy(x, y, { bob: 22, ph })); break;
        case 'aim': this.tp(650, H / 2); p.aimAng = 0; [[210, 170], [210, 380]].forEach(([x, y]) => this.dummy(x, y)); break;
        case 'burst': this.tp(210, H / 2); [[800, 205], [820, 390]].forEach(([x, y]) => this.dummy(x, y, { only: 'burst', hp: 40, maxHp: 40 })); break;
        case 'grenade': this.tp(330, H / 2); s.run.grenades = Math.max(s.run.grenades, 3); [[640, 270], [676, 244], [676, 298]].forEach(([x, y]) => this.dummy(x, y, { only: 'grenade' })); break;
        case 'dash': this.dash0 = p.dashes; this.tp(300, H / 2); this.turret = this.dummy(840, H / 2, { only: 'none', hp: 999, maxHp: 999 }); this.fireT = 0.6; break;
      }
      this.setText();
    }
    onKill(e) { if (e.dummy) this.kills++; }
    wrongHit(e) {
      if (e.only === 'none') return;
      const now = this.s.time.now; if (now - (this._wh || 0) < 700) return; this._wh = now;
      DK.floatText(this.s, e.x, e.y - 34, e.only === 'burst' ? '要用连发！' : e.only === 'grenade' ? '用手雷！' : '躲开它', e.only === 'burst' ? '#9fd3ff' : '#ffc08a', 15);
    }
    update(dt) {
      const s = this.s, p = s.player, st = this.step; this.t += dt;
      if (this.tip) { const pad = document.getElementById('pad'), r = pad && pad.getBoundingClientRect(), show = DK.portraitPad && r && r.height > 0;
        this.tip.style.display = show ? 'block' : 'none';
        if (show) Object.assign(this.tip.style, { left: (r.left + 10) + 'px', top: (r.top + 60) + 'px', width: (r.width - 20) + 'px' });
        [this.box, this.txt, this.stepTxt].forEach(o => o.setVisible(!DK.portraitPad)); this.skipBtn.setVisible(!DK.portraitPad); }
      this.dummies.forEach(e => { if (e.alive && e.bob) e.dvy = Math.cos(this.t * 1.6 + e.ph) * e.bob * 1.6; });
      if (this.done || !st) return;
      let ok = false;
      switch (st.id) {
        case 'move': if (this.goal && Math.hypot(p.x - this.goal[0], p.y - this.goal[1]) < 40) { DK.sfx(s, 'pickup_scrap'); this.goal = this.goals.shift() || null; ok = !this.goal; } break;
        case 'auto': ok = this.kills >= 3; break;
        case 'aim': ok = this.kills >= 2; break;
        case 'burst': ok = this.kills >= 2; break;
        case 'grenade': ok = this.kills >= 3; if (!ok && s.run.grenades < 1) s.run.grenades = 3; break;
        case 'dash': {
          this.fireT -= dt; const tu = this.turret;
          if (tu && tu.alive && this.fireT <= 0) { this.fireT = 1.3; const a = Math.atan2(p.y - tu.y, p.x - tu.x); for (let k = -1; k <= 1; k++) s.enemyShoot(tu.x - 20, tu.y, a + k * 0.16, 230, 0, 'tutorial'); }
          ok = p.dashes - this.dash0 >= 2; break;
        }
      }
      if (ok) { this.done = true; DK.banner(s, '完成！', { size: 30, color: '#7ee07a', y: 200, dur: 800 }); s.time.delayedCall(900, () => { this.done = false; if (s.tut === this) this.next(); }); }
    }
    draw(g) {
      if (this.goal) { const [x, y] = this.goal, k = 0.5 + 0.5 * Math.sin(this.s.time.now / 160); g.lineStyle(4, 0x7ee07a, 0.6 + 0.4 * k).strokeCircle(x, y, 30 + 4 * k).fillStyle(0x7ee07a, 0.18).fillCircle(x, y, 30); }
      this.dummies.forEach(e => { if (!e.alive || !e.only || e.only === 'none') return; g.lineStyle(3, e.only === 'burst' ? 0x9fd3ff : 0xffa050, 0.85).strokeCircle(e.x, e.y + 6, (e.radius || 14) + 9); });
    }
    complete() {
      const s = this.s; this.goal = null; this.setText(); DK.setTutorialDone();
      if (s.touch) s.touch.hl = null;
      DK.banner(s, '教学完成！', { size: 34, color: '#7ee07a', y: 220, dur: 1600 }); DK.sfx(s, 'pickup_powerup');
      s.time.delayedCall(2200, () => this.finish(false));
    }
    finish(skipped) {
      const s = this.s; if (this.leaving || s.tut !== this) return; this.leaving = true; DK.setTutorialDone();
      if (skipped) DK.logDamage({ src: 'tutorial', tgt: '-', amt: 0, note: 'skipped at step ' + (this.i + 1) });
      if (this.tip) this.tip.style.display = 'none';
      s.cameras.main.fadeOut(250, 0, 0, 0);
      s.cameras.main.once('camerafadeoutcomplete', () => {
        if (this.mode === 'first') { DK.run = DK.newRun(); s.scene.restart(); } // first sortie: straight into room 1
        else s.scene.start('Base');
      });
    }
    destroy() { this.clearDummies && (this.dummies = []); if (this.tip) { this.tip.remove(); this.tip = null; } if (this.s.touch) this.s.touch.hl = null; }
  };
})(window.DK);

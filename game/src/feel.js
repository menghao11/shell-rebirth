// Game-feel helpers: hit flash, hit-stop, mild flashes, hurt vignette.
// No screen shake — camera.shake is disabled (see DK.installNoShake).
(function (DK) {
  DK.installNoShake = function (cam) {
    if (!cam) return;
    try { if (cam.shakeEffect && cam.shakeEffect.reset) cam.shakeEffect.reset(); } catch (e) {}
    cam.shake = function () { return this; };
  };
  if (window.Phaser && Phaser.Cameras && Phaser.Cameras.Scene2D && Phaser.Cameras.Scene2D.Camera) {
    const proto = Phaser.Cameras.Scene2D.Camera.prototype;
    if (!proto._dkShake) {
      proto._dkShake = proto.shake;
      proto.shake = function () { return this; };
    }
  }

  // White tint for ~60ms (wall-clock so a 0 timeScale hit-stop still clears).
  DK.hitFlash = function (obj, ms) {
    if (!obj) return;
    const list = Array.isArray(obj) ? obj : [obj];
    ms = ms == null ? 60 : ms;
    list.forEach(o => { if (!o || !o.setTintFill) return; try { o.setTintFill(0xffffff); o._flashUntil = performance.now() + ms; } catch (e) {} });
    const clear = () => list.forEach(o => {
      if (!o || !o.active) return;
      if (o._flashUntil && performance.now() < o._flashUntil) return;
      try { if (o.clearTint) o.clearTint(); } catch (e) {}
    });
    if (typeof requestAnimationFrame === 'function') {
      const t0 = performance.now();
      const tick = () => { if (performance.now() - t0 < ms) requestAnimationFrame(tick); else clear(); };
      requestAnimationFrame(tick);
    } else setTimeout(clear, ms);
  };

  // Short freeze for bosses / big explosions only. Never stacks. 30–60ms, wall-clock end.
  DK.hitStop = function (scene, ms) {
    if (!scene || !scene.time) return;
    ms = Math.max(30, Math.min(60, ms == null ? 40 : ms));
    const now = performance.now();
    if (DK._hitStopUntil && now < DK._hitStopUntil) return;
    DK._hitStopUntil = now + ms;
    const t = scene.time, p = scene.physics && scene.physics.world, tw = scene.tweens;
    const prev = { t: t.timeScale || 1, p: p ? p.timeScale : 1, tw: tw ? tw.timeScale : 1, id: DK._hitStopUntil };
    t.timeScale = 0;
    if (p) p.timeScale = 0;
    if (tw) tw.timeScale = 0;
    setTimeout(() => {
      if (DK._hitStopUntil !== prev.id) return;
      try { t.timeScale = prev.t; } catch (e) {}
      try { if (p) p.timeScale = prev.p; } catch (e) {}
      try { if (tw) tw.timeScale = prev.tw; } catch (e) {}
      DK._hitStopUntil = 0;
    }, ms);
  };

  // Mild full-screen flash (low alpha, no strobe, no camera.flash).
  DK.impactFlash = function (scene, opts) {
    opts = opts || {};
    if (!scene || !scene.add) return;
    const now = performance.now();
    if (DK._flashAt && now - DK._flashAt < 80) return; // no strobing
    DK._flashAt = now;
    const color = opts.color != null ? opts.color : 0xffffff;
    const alpha = opts.alpha != null ? opts.alpha : 0.16;
    const ms = opts.ms != null ? opts.ms : 90;
    const W = DK.W || 960, H = DK.H || 540;
    const g = scene.add.rectangle(W / 2, H / 2, W + 8, H + 8, color, alpha).setScrollFactor(0).setDepth(12000);
    if (scene.tweens) scene.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => g.destroy() });
    else setTimeout(() => g.destroy(), ms);
  };

  // Brief red vignette on player hurt (replaces camera.flash + shake).
  DK.hurtVignette = function (scene, opts) {
    opts = opts || {};
    if (!scene || !scene.add) return;
    const W = DK.W || 960, H = DK.H || 540;
    const alpha = opts.alpha != null ? opts.alpha : 0.22;
    const ms = opts.ms != null ? opts.ms : 180;
    if (scene._hurtVig && scene._hurtVig.active) { scene._hurtVig.destroy(); scene._hurtVig = null; }
    const g = scene.add.graphics().setScrollFactor(0).setDepth(11900);
    g.fillStyle(0x8a1010, alpha);
    const t = 70;
    g.fillRect(0, 0, W, t); g.fillRect(0, H - t, W, t);
    g.fillRect(0, t, t, H - 2 * t); g.fillRect(W - t, t, t, H - 2 * t);
    scene._hurtVig = g;
    if (scene.tweens) scene.tweens.add({ targets: g, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => { g.destroy(); if (scene._hurtVig === g) scene._hurtVig = null; } });
    else setTimeout(() => { g.destroy(); if (scene._hurtVig === g) scene._hurtVig = null; }, ms);
  };
})(window.DK);

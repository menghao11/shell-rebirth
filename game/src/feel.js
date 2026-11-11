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

  const MIN_MS = 30, MAX_MS = 60, DEFAULT_MS = 40, SLACK_MS = 30;

  function setScale(obj, v) { if (!obj) return; try { obj.timeScale = v; } catch (e) {} }

  // feelScale is multiplied into the Run scene dt. Returns 0 during a live hit-stop
  // and self-clears if the wall-clock deadline has passed (safety clamp).
  DK.feelScale = function () {
    const st = DK._hitStop;
    if (!st) return 1;
    if (performance.now() >= st.until) { DK.endHitStop(true); return 1; }
    return 0;
  };

  DK.endHitStop = function (force) {
    const st = DK._hitStop;
    const now = performance.now();
    if (st && !force && now < st.until) return;
    if (!st) return;
    DK._hitStop = null;
    if (st.tid) try { clearTimeout(st.tid); } catch (e) {}
    // Resume physics only if we were the ones who paused it, and the scene
    // didn't independently pause (playerDie uses physics.pause()).
    try {
      const s = st.scene, w = st.world;
      const dead = !!(s && (s.state === 'dead' || s.state === 'won'));
      if (st.pausedPhys && w && !dead) w.isPaused = false;
      if (s && s._dkHitStopPaused) s._dkHitStopPaused = false;
    } catch (e) {}
  };

  DK.armHitStopWatchdog = function () {
    if (DK._hitStopWatchdog) return;
    DK._hitStopWatchdog = true;
    const onVis = () => { if (!document.hidden) { const st = DK._hitStop; if (st && performance.now() >= st.until) DK.endHitStop(true); } };
    try { document.addEventListener('visibilitychange', onVis); } catch (e) {}
    try { window.addEventListener('focus', onVis); } catch (e) {}
    // Worker timers are not clamped to 1s in a hidden tab the way window.setTimeout is.
    try {
      const src = 'onmessage=function(e){setTimeout(function(){postMessage(e.data);},e.data.ms);}';
      DK._hitStopWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      DK._hitStopWorker.onmessage = function () { DK.endHitStop(true); };
    } catch (e) { DK._hitStopWorker = null; }
  };

  // White tint for ~60ms (wall-clock so a frozen clock still clears).
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
    setTimeout(clear, ms);
  };

  // Short freeze for bosses / big explosions only. Never stacks. 30–60ms, wall-clock end.
  // NEVER set arcade world.timeScale to 0: Phaser 3.90 does `for(;_elapsed>=frameTimeMS*timeScale;)`
  // which infinite-loops when timeScale is 0 and any body exists. Pause the world instead.
  // Gameplay dt is also scaled by DK.feelScale() in Run.update (self-clears if overdue).
  DK.hitStop = function (scene, ms) {
    if (!scene) return;
    ms = Math.max(MIN_MS, Math.min(MAX_MS, ms == null ? DEFAULT_MS : ms));
    DK.armHitStopWatchdog();
    const now = performance.now();
    if (DK._hitStop && now < DK._hitStop.until) return; // never stack
    if (DK._hitStop) DK.endHitStop(true);
    const w = scene.physics && scene.physics.world;
    let pausedPhys = false;
    try {
      if (w && !w.isPaused) { w.isPaused = true; pausedPhys = true; scene._dkHitStopPaused = true; }
    } catch (e) {}
    const st = { started: now, until: now + ms, world: w, scene: scene, pausedPhys: pausedPhys };
    DK._hitStop = st;
    st.tid = setTimeout(() => DK.endHitStop(true), ms);
    try { if (DK._hitStopWorker) DK._hitStopWorker.postMessage({ ms: ms }); } catch (e) {}
    try {
      if (scene.events && !scene._dkHitStopBound) {
        scene._dkHitStopBound = true;
        const go = () => DK.endHitStop(true);
        scene.events.on('shutdown', go);
        scene.events.on('destroy', go);
      }
    } catch (e) {}
    const watch = () => {
      const cur = DK._hitStop;
      if (!cur || cur !== st) return;
      if (performance.now() >= st.until || performance.now() >= st.started + MAX_MS + SLACK_MS) DK.endHitStop(true);
      else requestAnimationFrame(watch);
    };
    try { requestAnimationFrame(watch); } catch (e) {}
  };

  function wallDestroy(obj, ms) {
    setTimeout(() => { try { if (obj && obj.active && obj.destroy) obj.destroy(); } catch (e) {} }, ms + 40);
  }

  DK.impactFlash = function (scene, opts) {
    opts = opts || {};
    if (!scene || !scene.add) return;
    const now = performance.now();
    if (DK._flashAt && now - DK._flashAt < 80) return;
    DK._flashAt = now;
    const color = opts.color != null ? opts.color : 0xffffff;
    const alpha = opts.alpha != null ? opts.alpha : 0.16;
    const ms = opts.ms != null ? opts.ms : 90;
    const W = DK.W || 960, H = DK.H || 540;
    const g = scene.add.rectangle(W / 2, H / 2, W + 8, H + 8, color, alpha).setScrollFactor(0).setDepth(12000);
    if (scene.tweens) scene.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => { try { g.destroy(); } catch (e) {} } });
    wallDestroy(g, ms);
  };

  DK.hurtVignette = function (scene, opts) {
    opts = opts || {};
    if (!scene || !scene.add) return;
    const W = DK.W || 960, H = DK.H || 540;
    const alpha = opts.alpha != null ? opts.alpha : 0.22;
    const ms = opts.ms != null ? opts.ms : 180;
    if (scene._hurtVig && scene._hurtVig.active) { try { scene._hurtVig.destroy(); } catch (e) {} scene._hurtVig = null; }
    const g = scene.add.graphics().setScrollFactor(0).setDepth(11900);
    g.fillStyle(0x8a1010, alpha);
    const t = 70;
    g.fillRect(0, 0, W, t); g.fillRect(0, H - t, W, t);
    g.fillRect(0, t, t, H - 2 * t); g.fillRect(W - t, t, t, H - 2 * t);
    scene._hurtVig = g;
    if (scene.tweens) scene.tweens.add({ targets: g, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => { try { g.destroy(); } catch (e) {} if (scene._hurtVig === g) scene._hurtVig = null; } });
    wallDestroy(g, ms);
    setTimeout(() => { if (scene._hurtVig === g) scene._hurtVig = null; }, ms + 40);
  };

  try { DK.armHitStopWatchdog(); } catch (e) {}
})(window.DK);

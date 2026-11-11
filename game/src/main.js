(function (DK) {
  const R = DK.R;
  DK.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: DK.W * R, height: DK.H * R,
    backgroundColor: '#0d0d0f',
    // Cartoon art: keep smoothing/antialiasing ON (no pixelArt mode).
    pixelArt: false, antialias: true, roundPixels: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { debug: new URLSearchParams(location.search).get('hitbox') === '1' } },
    input: { activePointers: 4, touch: { capture: true } },
    audio: { disableWebAudio: false },
    fps: { target: 60 },
    scene: [DK.BootScene, DK.IntroScene, DK.BaseScene, DK.RunScene, DK.ResultScene]
  });
  // Adaptive render resolution: only sustained low fps (foreground, active gameplay), never gameplay size.
  DK.renderLocked = localStorage.getItem('dk_render_lock') === '1';
  DK.renderHistory = []; let lowFor = 0, graceUntil = performance.now() + 5000;
  DK.setRenderScale = function (next) {
    next = Math.max(1, Math.min(2, next)); if (next === DK.R) return;
    const prev = DK.R; DK.R = next;
    DK.game.scale.resize(DK.W * next, DK.H * next);
    DK.game.scene.getScenes(true).forEach(scene => {
      scene.cameras.main.setSize(DK.W * next, DK.H * next).setOrigin(0, 0).setZoom(next).setScroll(0, 0);
    });
    DK.renderHistory.push({ from: prev, to: next, fps: DK.game.loop.actualFps });
    lowFor = 0; graceUntil = performance.now() + 3000;
    if (DK.layout) DK.layout();
  };
  DK.setRenderLock = function (on) { DK.renderLocked = !!on; localStorage.setItem('dk_render_lock', on ? '1' : '0'); lowFor = 0; };
  DK.game.events.on('poststep', (time, delta) => {
    const scene = DK.current;
    if (DK.renderLocked || DK.R <= 1 || document.hidden || performance.now() < graceUntil || !scene || (scene.isPaused && scene.isPaused())) { lowFor = 0; return; }
    lowFor = DK.game.loop.actualFps < 40 ? lowFor + Math.min(delta || 16.7, 250) : 0;
    if (lowFor >= 3000) DK.setRenderScale(DK.R > 1.5 ? 1.5 : 1);
  });
  // ---- screen fit: size #game (and the portrait touch pad) from the *visual* viewport minus safe-area insets,
  // then let Phaser FIT/CENTER_BOTH scale 960x540 inside it. Re-run on rotation and Safari toolbar show/hide.
  DK.layout = function () {
    const vv = window.visualViewport, vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(vv ? vv.height : window.innerHeight);
    const cs = getComputedStyle(document.getElementById('safe')), px = v => parseFloat(v) || 0;
    const t = px(cs.paddingTop), r = px(cs.paddingRight), b = px(cs.paddingBottom), l = px(cs.paddingLeft);
    const aw = Math.max(1, vw - l - r), ah = Math.max(1, vh - t - b);
    const portrait = !!(DK.touchMode && ah > aw * 1.05);
    const g = document.getElementById('game'), pad = document.getElementById('pad');
    let gh = ah;
    if (portrait) gh = Math.round(Math.min(aw * 9 / 16, ah * 0.55)); // game on top, controls below
    Object.assign(g.style, { left: l + 'px', top: t + 'px', width: aw + 'px', height: gh + 'px', right: 'auto', bottom: 'auto' });
    if (portrait) Object.assign(pad.style, { left: l + 'px', top: (t + gh) + 'px', width: aw + 'px', height: (ah - gh) + 'px' });
    const changed = DK.portraitPad !== portrait;
    DK.portraitPad = portrait; document.body.classList.toggle('portrait-pad', portrait);
    if (DK.TouchPad) DK.TouchPad.layout(aw, ah - gh, changed);
    DK.layoutInfo = { vw, vh, safe: [t, r, b, l], game: [aw, gh], portrait };
    try { window.scrollTo(0, 0); DK.game.scale.refresh(); } catch (e) {}
  };
  let lt = [];
  const relayout = () => { lt.forEach(clearTimeout); DK.layout(); lt = [120, 400, 900].map(ms => setTimeout(DK.layout, ms)); };
  window.addEventListener('resize', relayout); window.addEventListener('orientationchange', relayout);
  if (window.visualViewport) { visualViewport.addEventListener('resize', relayout); visualViewport.addEventListener('scroll', relayout); }
  document.getElementById('rotate-ok').addEventListener('click', relayout);
  relayout();
  // pause audio when the tab/app is hidden (iOS)
  document.addEventListener('visibilitychange', () => { try { DK.game.sound.mute = document.hidden || DK.muted; } catch (e) {} });
})(window.DK);

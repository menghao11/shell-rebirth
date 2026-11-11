// Intro/Boot cinematic: plays before the 铁皮屋 title (Base).
// Art: art/intro (web copies in game/assets/intro, see tools/build_web_intro.py).
// Audio: audio/intro (intro_full + SFX + bgm_title). Placeholder graphics only if a slot is missing.
(function (DK) {
  const KEY = 'dankelunhui_intro_v1';
  const FULL_MS = 5500;
  const SHORT_MS = 1250;
  const SKIP_FADE = 250; // fade intro_full 200–300 ms on skip, in parallel with the camera
  const END_FADE = 200;

  // Logical keys match 画图王 / 声音王 filenames (see INTRO_ASSETS.md).
  const SLOTS = {
    bg: 'intro_title_bg',
    logo: 'intro_logo',
    logoShine: 'intro_logo_shine',
    podBlink: 'intro_pod_blink',
    podOpen: 'intro_pod_open',
    shellSpin: 'intro_shell_spin',
    shellRest: 'intro_shell_rest',
    steamBurst: 'intro_steam_burst',
    steamLoop: 'intro_steam_loop',
    flash: 'intro_flash',
    glint: 'intro_glint',
    introFull: 'intro_full',
    sfxHeartbeat: 'pulse_heartbeat',
    sfxHatch: 'hatch_hiss',
    sfxClink1: 'casing_clink_1',
    sfxClink2: 'casing_clink_2',
    sfxLogo: 'logo_hit',
    bgmTitle: 'bgm_title'
  };
  // Storyboard cues for intro_full (t = 0 at first sample), in milliseconds.
  const CUES = {
    heart: [0, 650, 1300],
    hatch: 1700,
    unlock: 1700 + Math.round(1000 * 4 / 12), // intro_pod_open frame 4
    steam: 1700 + Math.round(1000 * 5 / 12),  // intro_pod_open frame 5
    clinks: [2500, 2780, 3040, 3300, 3580],
    logo: 4000,
    shine: 4180,
    end: 5500
  };

  DK.INTRO_KEY = KEY;
  DK.INTRO_SLOTS = SLOTS;
  DK.introProgress = 0;
  DK.introSeen = function () { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  DK.markIntroSeen = function () { try { localStorage.setItem(KEY, '1'); } catch (e) {} };
  DK.skipBootIntro = function () {
    DK._skipIntro = true;
    DK.markIntroSeen();
    const g = DK.game; if (!g) return;
    const s = g.scene.getScene('Intro');
    if (s && s.scene.isActive() && s.skip) s.skip();
  };

  async function listDir(url) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return null;
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('html')) return null;
      const html = await r.text(), files = [], dirs = [];
      html.replace(/href="([^"?#]+)"/g, (m, h) => {
        h = decodeURIComponent(h);
        if (h.includes('://') || h.startsWith('/')) return m;
        if (h.endsWith('/')) dirs.push(h.replace(/\/$/, ''));
        else files.push(h);
        return m;
      });
      return { files, dirs };
    } catch (e) { return null; }
  }
  async function fetchJson(url) {
    try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return null; return await r.json(); } catch (e) { return null; }
  }
  const base = f => f.replace(/\.[^.]+$/, '');
  const extOf = f => (f.split('.').pop() || '').toLowerCase();
  const IMG_EXT = { png: 1, webp: 1, jpg: 1, jpeg: 1 };
  const AUD_EXT = ['m4a', 'mp3', 'ogg', 'wav'];

  function introSig(a) {
    return JSON.stringify([a.sheet || null, (a.frames || [null])[0], a.frame_size, a.frame_count || 1, a.anchor]);
  }

  // Prefers game/assets/intro web copies (src_sig-guarded). Only lists art/intro
  // after the parent index shows the folder, so a missing drop never 404s.
  DK.discoverIntroAssets = async function () {
    const plan = { images: [], audio: [] }, seen = new Set();
    DK.assetReport.intro = { art: 'missing', audio: 'missing', web: { used: 0, stale: 0 } };
    const webRoot = (DK.PATHS && DK.PATHS.artIntroWeb) || 'assets/intro/';
    const srcRoot = (DK.PATHS && DK.PATHS.artIntro) || '../art/intro/';
    const web = await fetchJson(webRoot + 'manifest.json');
    const artParent = await listDir('../art/');
    let srcMan = null;
    if (artParent && artParent.dirs.indexOf('intro') >= 0) {
      const listing = await listDir(srcRoot);
      if (listing && listing.files.indexOf('manifest.json') >= 0) srcMan = await fetchJson(srcRoot + 'manifest.json');
    }
    const srcBy = {};
    if (srcMan && Array.isArray(srcMan.assets)) for (const a of srcMan.assets) if (a && a.name) srcBy[a.name] = a;
    const webList = web && Array.isArray(web.assets) ? web.assets : [];
    const srcList = srcMan && Array.isArray(srcMan.assets) ? srcMan.assets : [];
    const list = webList.length ? webList : srcList;
    for (const a0 of list) {
      if (!a0 || !a0.name) continue;
      const src = srcBy[a0.name];
      let a = a0, root = webList.length ? webRoot : srcRoot;
      if (webList.length) {
        if (src && a0.src_sig && a0.src_sig !== introSig(src)) {
          DK.assetReport.intro.web.stale++;
          a = src; root = srcRoot;
        } else {
          DK.assetReport.intro.web.used++;
          a = a0; root = webRoot;
        }
      } else if (src) { a = src; root = srcRoot; }
      const fs = a.frame_size || null, n = a.frame_count || 1;
      let url = null, frames = null;
      if (n > 1 && a.sheet && fs) { url = a.sheet; frames = { w: fs[0], h: fs[1] }; }
      else url = a.file || (a.frames && a.frames[0]) || a.sheet;
      if (!url) continue;
      DK.ARTX = DK.ARTX || {}; DK.ARTX[a.name] = a;
      plan.images.push({ key: a.name, url: root + url, frames }); seen.add(a.name);
    }
    DK.assetReport.intro.art = plan.images.length;

    const audParent = await listDir('../audio/');
    if (audParent && audParent.dirs.indexOf('intro') >= 0) {
      const root = (DK.PATHS && DK.PATHS.audioIntro) || '../audio/intro/';
      const listing = await listDir(root);
      const man = (listing && listing.files.indexOf('manifest.json') >= 0) ? await fetchJson(root + 'manifest.json') : null;
      const groups = {};
      if (man) for (const [key, v] of Object.entries(man)) {
        if (key.startsWith('_') || !v) continue;
        const spec = typeof v === 'string' ? { file: v } : v;
        if (spec.volume != null) DK.SFX_VOL[key] = spec.volume;
        const files = Array.isArray(spec.file) ? spec.file : [spec.file];
        groups[key] = files.map(f => root + f);
      }
      if (listing && listing.files) for (const f of listing.files) {
        if (AUD_EXT.indexOf(extOf(f)) < 0) continue;
        const key = base(f);
        if (man && man[key]) continue;
        (groups[key] = groups[key] || []).push(root + f);
      }
      for (const [key, urls] of Object.entries(groups)) {
        urls.sort((a, b) => AUD_EXT.indexOf(extOf(a)) - AUD_EXT.indexOf(extOf(b)));
        plan.audio.push({ key, urls });
      }
      DK.assetReport.intro.audio = plan.audio.length;
    }
    return plan;
  };

  function hasTex(scene, key) {
    return !!(key && scene.textures && scene.textures.exists(key) && key !== '__MISSING');
  }
  function hasAud(scene, key) {
    return !!(key && scene.cache && scene.cache.audio && scene.cache.audio.exists(key));
  }

  DK.IntroScene = class extends Phaser.Scene {
    constructor() { super('Intro'); }

    create() {
      DK.setupCamera(this);
      DK.current = this;
      DK.introProgress = 0;
      this.mode = DK.introSeen() ? 'short' : 'full';
      this.phase = this.mode === 'short' ? 'logo' : 'dark';
      this.skipped = false;
      this._finishing = false;
      this._wantFinish = false;
      this._cinematicDone = false;
      this._finalized = false;
      this.startedAt = performance.now();
      this.casings = [];
      this.steam = [];
      this.beats = [];
      this._hbTimer = null;
      this.isPaused = () => true; // don't let boot-load jank trip adaptive resolution

      const W = DK.W, H = DK.H;
      this.cx = W / 2; this.cy = H / 2 + 16;
      this.cameras.main.setBackgroundColor('#07080c');
      this.cameras.main.fadeIn(this.mode === 'short' ? 120 : 280, 0, 0, 0);

      this.buildPlaceholders();
      this.buildStage();
      this.bindInput();
      this.startLoads();
      if (DK._skipIntro) {
        this.skip();
      } else if (hasTex(this, SLOTS.podBlink) || hasTex(this, SLOTS.logo)) {
        // Boot already loaded the intro pack: start on real art (no placeholder flash).
        this.applyRealAssets();
        this.ensureIntroAnims();
        this._cineStarted = true;
        this.playCinematic();
        this.onIntroAudioReady();
      }

      DK.introInfo = () => this.info();
    }

    info() {
      return {
        mode: this.mode, phase: this.phase, skipped: !!this.skipped,
        elapsed: Math.round(performance.now() - this.startedAt),
        progress: DK.introProgress || 0, ready: !!DK.ready,
        finishing: !!this._finishing, seen: DK.introSeen()
      };
    }

    // ---------- placeholders (tiny generated textures, used until real slots load)
    buildPlaceholders() {
      if (!this.textures.exists('dk_intro_casing_ph')) {
        const g = this.add.graphics().setVisible(false);
        g.fillStyle(0x7a5a1a).fillRoundedRect(2, 1, 14, 26, 3);
        g.fillStyle(0xe2c15a).fillRoundedRect(3, 2, 12, 24, 3);
        g.fillStyle(0x9a7428).fillRoundedRect(4, 3, 10, 8, 2);
        g.fillStyle(0xf6e7a2, 0.85).fillRect(5, 10, 2, 12);
        g.lineStyle(1, 0x3a2a0c, 0.9).strokeRoundedRect(2, 1, 14, 26, 3);
        g.generateTexture('dk_intro_casing_ph', 18, 28);
        g.destroy();
      }
    }

    buildStage() {
      const W = DK.W, H = DK.H, cx = this.cx, cy = this.cy;
      // Dark void for the cinematic; title_bg is added in applyRealAssets() at alpha 0 and faded in at 5.5 s.
      const bg = this.add.graphics().setDepth(0);
      bg.fillStyle(0x07080c).fillRect(0, 0, W, H);
      bg.fillStyle(0x10131c, 1);
      bg.fillEllipse(cx, cy + 86, 420, 90);
      bg.fillStyle(0x0a0c12, 0.85);
      bg.fillEllipse(cx, cy + 96, 560, 140);
      bg.fillStyle(0x000000, 0.35).fillRect(0, 0, W, 70);
      bg.fillStyle(0x000000, 0.45).fillRect(0, H - 80, W, 80);
      this.bgGfx = bg;
      // drifting dust (very few, cheap)
      this.dust = [];
      for (let i = 0; i < 8; i++) {
        const d = this.add.circle(80 + Math.random() * 800, 60 + Math.random() * 400, 1 + Math.random() * 1.4, 0xb9d4e8, 0.12 + Math.random() * 0.16).setDepth(8);
        this.dust.push(d);
        this.tweens.add({ targets: d, y: d.y - (30 + Math.random() * 50), x: d.x + (Math.random() * 40 - 20), alpha: { from: d.alpha, to: 0.02 }, duration: 2800 + Math.random() * 2200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }

      this.podX = cx; this.podY = 450;
      this.podWrap = this.add.container(cx, cy).setDepth(20);
      this.podWrap.setVisible(false); // only shown if blink/open art is missing
      this.podGfx = this.add.graphics();
      this.podWrap.add(this.podGfx);
      this.doorL = this.add.graphics();
      this.doorR = this.add.graphics();
      this.podWrap.add([this.doorL, this.doorR]);
      this.podState = { open: 0, light: 0.25 };
      this.podOpen = 0;
      this.lightAmt = 0.25;
      this.drawPod();

      // Real pod / logo / title_bg sprites are attached in applyRealAssets() once the intro pack lands.

      this.ringGfx = this.add.graphics().setDepth(60);
      this.logoLayer = this.add.container(cx, cy - 20).setDepth(70).setAlpha(0);
      this.logoShadow = this.add.graphics();
      this.logoShadow.fillStyle(0x000000, 0.62);
      this.logoShadow.fillEllipse(0, 18, 760, 260);
      this.logoShadow.fillStyle(0x000000, 0.32);
      this.logoShadow.fillEllipse(0, 22, 900, 340);
      this.logoLayer.add(this.logoShadow);
      // Placeholder type until applyRealAssets() attaches intro_logo with a correct 0–1 origin.
      this.logoTxt = DK.txt(this, 0, 0, '弹壳轮回', { fontSize: '62px', fontStyle: 'bold', color: '#f2c14e', stroke: '#1a1204', strokeThickness: 8 }).setOrigin(0.5);
      this.subTxt = DK.txt(this, 0, 48, 'SHELL  REBIRTH', { fontSize: '18px', color: '#d8c48a', stroke: '#000', strokeThickness: 3, letterSpacing: 8 }).setOrigin(0.5);
      this.logoLayer.add([this.logoTxt, this.subTxt]);
      this.glint = this.add.rectangle(-420, 8, 46, 110, 0xffffff, 0.0).setAngle(-25).setBlendMode(Phaser.BlendModes.ADD).setDepth(80);
      this.cta = DK.txt(this, cx, H - 64, '点击开始', { fontSize: '22px', fontStyle: 'bold', color: '#f2e6c9', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(90).setAlpha(0);
      this.loadHint = DK.txt(this, cx, H - 42, '', { fontSize: '13px', color: '#7a8494' }).setOrigin(0.5).setDepth(90).setAlpha(0);
    }

    drawPod() {
      const g = this.podGfx, L = this.doorL, R = this.doorR, open = this.podOpen, light = this.lightAmt;
      g.clear(); L.clear(); R.clear();
      // isometric-ish echo pod: dark metal capsule, slightly above a floor ellipse
      g.fillStyle(0x05070a, 0.55).fillEllipse(0, 78, 210, 36);
      // body
      g.fillStyle(0x1a2430).fillRoundedRect(-78, -70, 156, 150, 48);
      g.fillStyle(0x243446).fillRoundedRect(-70, -62, 140, 132, 44);
      // side bevels (cheap iso read)
      g.fillStyle(0x151c28, 0.9).fillTriangle(-78, -10, -78, 70, -108, 40);
      g.fillStyle(0x2c3b4e, 0.7).fillTriangle(78, -10, 78, 70, 108, 40);
      // top cap
      g.fillStyle(0x2a3848).fillEllipse(0, -68, 150, 36);
      g.fillStyle(0x3d5166).fillEllipse(0, -72, 110, 20);
      // inner chamber glow
      const glow = 0.15 + light * 0.7 + open * 0.35;
      g.fillStyle(0x6fd6ff, 0.12 + glow * 0.35).fillEllipse(0, 8, 88, 100);
      g.fillStyle(0xc8f4ff, 0.08 + glow * 0.25).fillEllipse(0, -6, 40, 54);
      // frame ring
      g.lineStyle(3, 0x0e161e, 1).strokeRoundedRect(-78, -70, 156, 150, 48);
      g.lineStyle(2, 0x6fd6ff, 0.25 + light * 0.45).strokeEllipse(0, 8, 96, 108);
      // blinking status lamp on the crown
      const lamp = 0.2 + light;
      g.fillStyle(0x041018).fillCircle(0, -86, 9);
      g.fillStyle(0x6fd6ff, lamp).fillCircle(0, -86, 6);
      g.fillStyle(0xffffff, lamp * 0.7).fillCircle(-1.5, -88, 2.2);
      // doors (two leaves). open slides them outward + slightly back
      const dw = 46, dh = 110, dx = 22 + open * 58, tilt = open * 0.18;
      function leaf(og, side) {
        og.save();
        og.translateCanvas(side * dx, 6);
        og.rotateCanvas(side * tilt);
        og.fillStyle(0x1c2836, 1 - open * 0.15);
        og.fillRoundedRect(-dw, -dh / 2, dw * 2, dh, 16);
        og.fillStyle(0x2e4256, 0.9);
        og.fillRoundedRect(-dw + 6, -dh / 2 + 8, dw * 2 - 12, dh - 16, 12);
        og.lineStyle(2, 0x6fd6ff, 0.2 + light * 0.3);
        og.strokeRoundedRect(-dw + 4, -dh / 2 + 6, dw * 2 - 8, dh - 12, 12);
        og.fillStyle(0x6fd6ff, 0.15 + light * 0.35).fillCircle(side * 8, 0, 5);
        og.restore();
      }
      leaf(L, -1); leaf(R, 1);
    }

    drawRing() {
      const g = this.ringGfx, p = Math.max(0, Math.min(1, DK.introProgress || 0));
      g.clear();
      const cx = this.cx, cy = this.cy + 8, rad = 128;
      g.lineStyle(3, 0x6fd6ff, 0.12).strokeCircle(cx, cy, rad);
      if (p > 0.002) {
        const dim = (this.phase === 'logo' || this.phase === 'cta') ? 0.35 : 1;
        g.lineStyle(4, 0x8ae7ff, (0.55 + p * 0.35) * dim);
        g.beginPath();
        g.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p, false);
        g.strokePath();
      }
      if (p > 0 && p < 0.995 && this.phase !== 'logo' && this.phase !== 'cta') {
        this.loadHint.setText('载入 ' + Math.min(99, Math.round(p * 100)) + '%').setAlpha(0.7);
      } else {
        this.loadHint.setText('').setAlpha(0);
      }
    }

    bindInput() {
      const go = () => this.skip();
      this.input.on('pointerdown', go);
      if (this.input.keyboard) this.input.keyboard.on('keydown', go);
      // also catch keys/taps that land outside the canvas (mobile letterboxing)
      this._onWinKey = ev => { ev && ev.preventDefault && ev.preventDefault(); this.skip(); };
      window.addEventListener('keydown', this._onWinKey, { passive: false });
    }

    tryResumeAudio() {
      try {
        const ctx = this.sound && this.sound.context;
        if (ctx && ctx.state === 'suspended') ctx.resume();
      } catch (e) {}
    }

    // Wall-clock timer. Phaser delayedCall follows the capped scene delta, so a multi-second
    // texture/audio decode stall would drift the storyboard off intro_full.
    wallCall(ms, fn) {
      const id = setTimeout(() => { if (this.scene && this.scene.isActive() && !this._finishing && !this.skipped) fn(); }, Math.max(0, ms));
      this.beats.push({ remove: () => clearTimeout(id) });
      return id;
    }

    // ---------- cinematic
    puffSteam(n) {
      const key = hasTex(this, SLOTS.steam) ? SLOTS.steam : null;
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const dist = 20 + Math.random() * 30;
        const x = this.cx + Math.cos(ang) * dist, y = this.cy + 10 + Math.sin(ang) * dist * 0.4;
        let s;
        if (key) {
          s = this.add.image(x, y, key).setDepth(40).setAlpha(0.0).setScale(0.4 + Math.random() * 0.3);
          if (this.anims.exists(key)) s.play(key);
        } else {
          const r = 16 + Math.random() * 22;
          s = this.add.ellipse(x, y, r * 1.4, r, 0xd7eef7, 0).setDepth(40);
        }
        this.steam.push(s);
        this.tweens.add({
          targets: s,
          x: x + (Math.random() * 80 - 40),
          y: y - (50 + Math.random() * 70),
          alpha: { from: 0, to: 0.35 + Math.random() * 0.25 },
          scale: (s.scaleX || 1) * (1.6 + Math.random() * 0.8),
          duration: 900 + Math.random() * 700,
          ease: 'Sine.Out',
          onComplete: () => this.tweens.add({ targets: s, alpha: 0, duration: 600, onComplete: () => s.destroy() })
        });
      }
    }

    sweepGlint() {
      if (hasTex(this, SLOTS.glint)) {
        if (this.glint) this.glint.destroy();
        this.glint = this.add.image(this.cx - 280, this.cy - 20, SLOTS.glint).setDepth(80).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
      } else {
        this.glint.setPosition(this.cx - 300, this.cy - 16).setAlpha(0.9);
      }
      this.tweens.add({
        targets: this.glint, x: this.cx + 300, alpha: { from: 0.95, to: 0 },
        duration: 620, ease: 'Cubic.InOut'
      });
    }

    playCinematic() {
      this.startedAt = performance.now();
      if (this.mode === 'short') this.playShort(); else this.playFull();
    }

    ensureIntroAnims() {
      for (const [name, a] of Object.entries(DK.ARTX || {})) {
        if (!/^intro_/.test(name)) continue;
        if (!this.textures.exists(name)) continue;
        if ((a.frame_count || 1) > 1 && !this.anims.exists(name)) {
          this.anims.create({ key: name, frames: this.anims.generateFrameNumbers(name, { start: 0, end: a.frame_count - 1 }), frameRate: a.fps || 8, repeat: a.loop ? -1 : 0 });
        }
      }
    }

    placeArt(key, x, y, logicalW, depth) {
      const a = (DK.ARTX && DK.ARTX[key]) || {}, fs = a.frame_size || [1, 1];
      const ox = a.anchor ? a.anchor[0] / fs[0] : 0.5, oy = a.anchor ? a.anchor[1] / fs[1] : 0.5;
      const spr = this.add.sprite(x, y, key).setOrigin(ox, oy).setDepth(depth == null ? 20 : depth);
      if (logicalW) spr.setDisplaySize(logicalW, logicalW * (fs[1] / fs[0]));
      return spr;
    }

    playFull() {
      this.phase = 'dark';
      this.lightAmt = 0.15;
      this.drawPod();
      this.showPodBlink();
      // Visuals are clocked off the intro_full storyboard (wall clock), independent of autoplay.
      CUES.heart.forEach((ms, i) => this.wallCall(ms, () => {
        this.blinkLight(i === 2 ? 1 : 0.85);
        this.restartPodBlink();
      }));
      this.wallCall(CUES.hatch, () => {
        this.phase = 'open';
        this.openPod({ sfx: false }); // hiss is already in intro_full
      });
      this.wallCall(CUES.unlock, () => this.playFlash(this.podX, this.podY - 90));
      this.wallCall(CUES.steam, () => this.playSteam());
      const flight = 520;
      this.wallCall(Math.max(0, CUES.clinks[0] - flight), () => {
        this.phase = 'fall';
        this.dropCasings({ landAt: CUES.clinks, sfx: false });
      });
      this.wallCall(CUES.logo, () => {
        this.phase = 'logo';
        this.formLogo({ shineAt: CUES.shine - CUES.logo, sfx: false });
      });
      this.wallCall(CUES.end, () => {
        this.phase = 'cta';
        this._cinematicDone = true;
        this.revealTitleBg();
        this.showCta();
        this.startTitleBgm();
      });
    }

    playShort() {
      // Returning visit: abbreviated visuals with the individual SFX (not intro_full).
      this.phase = 'dark';
      this.podOpen = 0.2;
      this.lightAmt = 0.7;
      this.drawPod();
      this.showPodBlink();
      this.playSfx(SLOTS.sfxHeartbeat);
      this.blinkLight(0.95);
      this.wallCall(220, () => {
        this.phase = 'logo';
        this.playSfx(SLOTS.sfxLogo);
        this.formLogo({ shineAt: 180, sfx: false });
        this.tweens.add({ targets: this, podOpen: 1, duration: 280, onUpdate: () => this.drawPod() });
        if (this.podBlinkSpr) this.tweens.add({ targets: this.podBlinkSpr, alpha: 0.25, duration: 280 });
      });
      this.wallCall(SHORT_MS, () => {
        this.phase = 'cta';
        this._cinematicDone = true;
        this.revealTitleBg();
        this.showCta();
        this.startTitleBgm();
        this.wallCall(180, () => { if (!this.skipped && !this._finishing) this.finish({ fade: END_FADE }); });
      });
    }

    blinkLight(peak) {
      peak = peak == null ? 0.9 : peak;
      const start = this.lightAmt;
      this.tweens.add({
        targets: this, lightAmt: peak, duration: 90, yoyo: true, hold: 50,
        onUpdate: () => this.drawPod(),
        onComplete: () => { this.lightAmt = Math.max(0.2, start); this.drawPod(); }
      });
    }

    showPodBlink() {
      if (!hasTex(this, SLOTS.podBlink)) { this.podWrap.setVisible(true); return; }
      if (this.podBlinkSpr) { this.podBlinkSpr.setVisible(true).setAlpha(1); this.restartPodBlink(); return; }
      this.podBlinkSpr = this.placeArt(SLOTS.podBlink, this.podX, this.podY, 260, 21);
      if (this.anims.exists(SLOTS.podBlink)) this.podBlinkSpr.play(SLOTS.podBlink);
      this.podWrap.setVisible(false);
    }
    restartPodBlink() {
      if (this.podBlinkSpr && this.anims.exists(SLOTS.podBlink) && this.phase === 'dark') {
        this.podBlinkSpr.play(SLOTS.podBlink);
      }
    }

    playFlash(x, y) {
      if (this._finishing || this.skipped) return;
      if (!hasTex(this, SLOTS.flash)) return;
      const spr = this.placeArt(SLOTS.flash, x, y, 280, 35);
      spr.setBlendMode(Phaser.BlendModes.ADD);
      if (this.anims.exists(SLOTS.flash)) {
        spr.play(SLOTS.flash);
        spr.once('animationcomplete', () => spr.destroy());
      } else {
        this.tweens.add({ targets: spr, alpha: 0, duration: 350, onComplete: () => spr.destroy() });
      }
    }

    playSteam() {
      if (this._finishing || this.skipped) return;
      const x = this.podX, y = this.podY - 8;
      if (hasTex(this, SLOTS.steamBurst)) {
        const burst = this.placeArt(SLOTS.steamBurst, x, y, 280, 28);
        const goLoop = () => {
          burst.destroy();
          if (this._finishing || this.skipped) return;
          if (hasTex(this, SLOTS.steamLoop) && this.anims.exists(SLOTS.steamLoop)) {
            this.steamLoopSpr = this.placeArt(SLOTS.steamLoop, x, y, 260, 27);
            this.steamLoopSpr.play(SLOTS.steamLoop);
          }
        };
        if (this.anims.exists(SLOTS.steamBurst)) { burst.play(SLOTS.steamBurst); burst.once('animationcomplete', goLoop); }
        else this.time.delayedCall(800, goLoop);
      } else {
        this.puffSteam(18);
      }
    }

    revealTitleBg() {
      if (this.bgImg) this.tweens.add({ targets: this.bgImg, alpha: 1, duration: 400 });
      // The new title key art already shows the open pod; fade the cinematic stand-ins away.
      [this.podWrap, this.podSpr, this.podOpenSpr, this.podBlinkSpr, this.steamLoopSpr].forEach(s => {
        if (s) this.tweens.add({ targets: s, alpha: 0, duration: 350 });
      });
      this.casings.forEach(c => { if (c && c.active) this.tweens.add({ targets: c, alpha: 0, duration: 280 }); });
      (this.dust || []).forEach(d => { if (d && d.active) this.tweens.add({ targets: d, alpha: 0, duration: 350 }); });
    }

    openPod(opt) {
      opt = opt || {};
      if (opt.sfx !== false) this.playSfx(SLOTS.sfxHatch);
      this.tweens.add({
        targets: this, podOpen: 1, duration: 700, ease: 'Cubic.InOut',
        onUpdate: () => this.drawPod()
      });
      if (hasTex(this, SLOTS.podOpen)) {
        const spr = this.placeArt(SLOTS.podOpen, this.podX, this.podY, 260, 22);
        if (this.anims.exists(SLOTS.podOpen)) spr.play(SLOTS.podOpen);
        else spr.setFrame((DK.ARTX[SLOTS.podOpen].frame_count || 1) - 1);
        if (this.podBlinkSpr) this.podBlinkSpr.setVisible(false);
        if (this.podSpr) this.podSpr.setVisible(false);
        this.podWrap.setVisible(false);
        this.podOpenSpr = spr;
      } else {
        this.puffSteam(18);
      }
    }

    dropCasings(opt) {
      opt = opt || {};
      const landAt = opt.landAt || CUES.clinks;
      const useSfx = opt.sfx !== false;
      const spin = hasTex(this, SLOTS.shellSpin) ? SLOTS.shellSpin : (hasTex(this, SLOTS.shellRest) ? SLOTS.shellRest : 'dk_intro_casing_ph');
      const rest = hasTex(this, SLOTS.shellRest) ? SLOTS.shellRest : spin;
      const t0 = performance.now() - this.startedAt;
      const flight = 520;
      landAt.forEach((ms, i) => {
        const x = this.cx + ((i % 5) - 2) * 58 + (Math.random() * 16 - 8);
        let c;
        if (spin !== 'dk_intro_casing_ph') {
          c = this.placeArt(spin, x, -30 - Math.random() * 30, 42, 50);
          c.setAngle(Math.random() * 360);
          if (this.anims.exists(spin)) c.play(spin);
        } else {
          c = this.add.image(x, -30 - Math.random() * 30, spin).setDepth(50).setScale(0.95 + Math.random() * 0.3).setAngle(Math.random() * 360);
        }
        this.casings.push(c);
        const landY = this.podY - 8 + (i % 3) * 10;
        const delay = Math.max(0, ms - t0 - flight);
        const realShell = spin !== 'dk_intro_casing_ph';
        const tw = { targets: c, y: landY, duration: flight, delay, ease: 'Quad.In' };
        if (!realShell) tw.angle = c.angle + 180 + Math.random() * 160;
        this.tweens.add(Object.assign(tw, {
          onComplete: () => {
            if (useSfx) this.playSfx(i % 2 === 0 ? SLOTS.sfxClink1 : SLOTS.sfxClink2);
            if (rest !== spin && hasTex(this, rest)) { c.setTexture(rest); if (c.anims) c.anims.stop(); }
            const bounce = { targets: c, y: landY - 14, duration: 120, yoyo: true, ease: 'Quad.Out' };
            if (!realShell) bounce.angle = c.angle + 40;
            this.tweens.add(bounce);
            if (hasTex(this, SLOTS.glint)) {
              const g = this.placeArt(SLOTS.glint, c.x, landY - 8, 36, 55);
              if (this.anims.exists(SLOTS.glint)) { g.play(SLOTS.glint); g.once('animationcomplete', () => g.destroy()); }
              else this.tweens.add({ targets: g, alpha: 0, duration: 280, onComplete: () => g.destroy() });
            }
          }
        }));
      });
    }

    formLogo(opt) {
      opt = opt || {};
      if (opt.sfx !== false) this.playSfx(SLOTS.sfxLogo);
      this.casings.forEach((c, i) => {
        const ang = (i / Math.max(1, this.casings.length)) * Math.PI * 2;
        const tx = this.cx + Math.cos(ang) * 20, ty = this.cy - 20 + Math.sin(ang) * 10;
        this.tweens.add({
          targets: c, x: tx, y: ty, scale: 0.35, alpha: 0,
          duration: 620, delay: i * 18, ease: 'Cubic.In'
        });
      });
      this.logoLayer.setScale(0.86);
      this.tweens.add({ targets: this.logoLayer, alpha: 1, scale: 1, duration: 520, ease: 'Back.Out' });
      this.tweens.add({ targets: this.podWrap, alpha: 0.28, duration: 500 });
      if (this.podSpr) this.tweens.add({ targets: this.podSpr, alpha: 0.28, duration: 500 });
      if (this.podOpenSpr) this.tweens.add({ targets: this.podOpenSpr, alpha: 0.28, duration: 500 });
      if (this.podBlinkSpr) this.tweens.add({ targets: this.podBlinkSpr, alpha: 0.2, duration: 500 });
      if (this.steamLoopSpr) this.tweens.add({ targets: this.steamLoopSpr, alpha: 0.35, duration: 500 });
      const shineAt = opt.shineAt != null ? opt.shineAt : (opt.glintAt != null ? opt.glintAt : 180);
      this.wallCall(Math.max(0, shineAt), () => { if (!this._finishing) this.playLogoShine(); });
      this.playFlash(this.cx, this.cy - 20);
    }

    playLogoShine() {
      if (hasTex(this, SLOTS.logoShine) && this.logoImg) {
        const shine = this.add.sprite(0, 0, SLOTS.logoShine).setDepth(71);
        const a = (DK.ARTX && DK.ARTX[SLOTS.logoShine]) || {}, fs = a.frame_size || [1, 1];
        shine.setOrigin(a.anchor ? a.anchor[0] / fs[0] : 0.5, a.anchor ? a.anchor[1] / fs[1] : 0.5);
        shine.setDisplaySize(this.logoImg.displayWidth, this.logoImg.displayHeight);
        this.logoLayer.add(shine);
        const rest = () => { try { shine.destroy(); } catch (e) {} this.logoImg.setVisible(true); };
        if (this.anims.exists(SLOTS.logoShine)) { this.logoImg.setVisible(false); shine.play(SLOTS.logoShine); shine.once('animationcomplete', rest); }
        else this.tweens.add({ targets: shine, alpha: 0, duration: 500, onComplete: rest });
      } else {
        this.sweepGlint();
      }
    }

    showCta() {
      this.phase = 'cta';
      this.cta.setAlpha(0);
      this.tweens.add({ targets: this.cta, alpha: 1, duration: 280 });
      this.tweens.add({ targets: this.cta, y: this.cta.y - 5, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.InOut' });
    }

    // ---------- loading (tiny intro pack first, bgm_title + main game assets after the cinematic has started)
    startLoads() {
      const loadOnce = () => new Promise(resolve => {
        if (this.load.list.size === 0) { resolve(); return; }
        this.load.once('complete', resolve);
        this.load.start();
      });
      (async () => {
        const mainPlanP = DK.discoverAssets().catch(() => null);
        let titleItem = null;
        try {
          const introPlan = await DK.discoverIntroAssets();
          if (!this.scene.isActive()) return;
          if (introPlan) {
            const pack = { images: introPlan.images || [], audio: [] };
            (introPlan.audio || []).forEach(a => {
              if (a.key === SLOTS.bgmTitle) titleItem = a;
              else pack.audio.push(a);
            });
            pack.images = pack.images.filter(im => !hasTex(this, im.key));
            pack.audio = pack.audio.filter(a => !hasAud(this, a.key));
            if (pack.images.length || pack.audio.length) {
              DK.queueAssets(this, pack);
              await loadOnce();
              if (!this.scene.isActive()) return;
            }
            this.applyRealAssets();
            this.ensureIntroAnims();
            if (!this._cineStarted && !this.skipped && !this._finishing) {
              this._cineStarted = true;
              this.playCinematic();
            }
            this.onIntroAudioReady();
          }
        } catch (e) { /* intro pack is optional */ }
        if (!this._cineStarted && this.scene.isActive() && !this.skipped && !this._finishing) {
          this._cineStarted = true;
          this.playCinematic();
        }
        try {
          const plan = (await mainPlanP) || await DK.discoverAssets() || { images: [], audio: [] };
          if (!this.scene.isActive()) return;
          if (titleItem) plan.audio = [titleItem].concat(plan.audio || []); // load title BGM first among the rest, lazily after intro starts
          DK.queueAssets(this, plan);
          this.load.on('progress', v => { DK.introProgress = v; });
          this.load.on('loaderror', f => { DK.assetReport.errors = (DK.assetReport.errors || []).concat(f.key + ':' + f.src); });
          this.load.on('filecomplete-audio-' + SLOTS.bgmTitle, () => this.onTitleBgmLoaded());
          if (this.load.list.size === 0) this.onLoaded();
          else {
            this.load.once('complete', () => this.onLoaded());
            this.load.start();
          }
        } catch (e) {
          this.onLoaded();
        }
      })();
    }

    onIntroAudioReady() {
      if (this.mode !== 'full' || this.skipped || this._finishing) return;
      const t = (performance.now() - this.startedAt) / 1000;
      if (t < 5.45) this.playIntroFull(t);
    }

    playIntroFull(offset) {
      offset = Math.max(0, offset || 0);
      if (DK.muted || this.introSnd || this.skipped || this._finishing) return;
      this.tryResumeAudio();
      const key = SLOTS.introFull;
      if (!hasAud(this, key)) return;
      const snd = this.sound;
      if (snd && snd.locked) {
        this.audioBlocked = true;
        if (!this._waitUnlockFull) {
          this._waitUnlockFull = true;
          snd.once('unlocked', () => {
            this._waitUnlockFull = false;
            this.audioBlocked = false;
            if (this.skipped || this._finishing || this.mode !== 'full') return;
            const t = (performance.now() - this.startedAt) / 1000;
            if (t < 5.45) this.playIntroFull(t);
          });
        }
        return;
      }
      try {
        const vol = (DK.SFX_VOL[key] != null ? DK.SFX_VOL[key] : 1) * (DK.vol && DK.vol.sfx != null ? DK.vol.sfx : 0.9);
        const inst = snd.add(key, { volume: vol });
        inst.once('complete', () => { if (this.introSnd === inst) this.introSnd = null; try { inst.destroy(); } catch (e) {} });
        inst.play({ seek: offset });
        this.introSnd = inst;
        this.audioBlocked = false;
        DK.logAudio && DK.logAudio(key, 'intro' + (offset ? '@' + offset.toFixed(2) : ''));
      } catch (e) {
        this.audioBlocked = true;
      }
    }

    fadeIntroFull(ms) {
      const snd = this.introSnd;
      if (!snd) return;
      try {
        if (ms <= 0) { this.stopIntroSnd(); return; }
        this.tweens.add({
          targets: snd, volume: 0, duration: ms,
          onComplete: () => this.stopIntroSnd()
        });
      } catch (e) { this.stopIntroSnd(); }
    }

    stopIntroSnd() {
      const snd = this.introSnd; this.introSnd = null;
      if (!snd) return;
      try { if (snd.isPlaying) snd.stop(); snd.destroy(); } catch (e) {}
    }

    startTitleBgm() {
      if (this._titleBgmOn || DK.muted) return;
      this._wantTitleBgm = true;
      this.tryResumeAudio();
      if (!this.cache.audio.exists(SLOTS.bgmTitle)) return;
      if (this.sound && this.sound.locked) {
        if (!this._waitUnlockTitle) {
          this._waitUnlockTitle = true;
          this.sound.once('unlocked', () => { this._waitUnlockTitle = false; if (this._wantTitleBgm) this.startTitleBgm(); });
        }
        return;
      }
      this._titleBgmOn = true;
      try { DK.music(this, SLOTS.bgmTitle); } catch (e) {}
    }

    onTitleBgmLoaded() {
      if (this._wantTitleBgm || this.phase === 'cta') this.startTitleBgm();
    }

    applyRealAssets() {
      if (hasTex(this, SLOTS.bg) && !this.bgImg) {
        this.bgImg = this.add.image(0, 0, SLOTS.bg).setOrigin(0).setDisplaySize(DK.W, DK.H).setDepth(0).setAlpha(0);
      }
      if (hasTex(this, SLOTS.logo) && !this.logoImg) {
        const a = (DK.ARTX && DK.ARTX[SLOTS.logo]) || {}, fs = a.frame_size || [800, 320];
        this.logoImg = this.add.image(0, 0, SLOTS.logo);
        this.logoImg.setOrigin(a.anchor ? a.anchor[0] / fs[0] : 0.5, a.anchor ? a.anchor[1] / fs[1] : 0.5);
        this.logoImg.setDisplaySize(720, 720 * (fs[1] / fs[0]));
        if (this.logoTxt) { this.logoTxt.destroy(); this.logoTxt = null; }
        if (this.subTxt) { this.subTxt.destroy(); this.subTxt = null; }
        this.logoLayer.add(this.logoImg);
        if (this.logoShadow) this.logoLayer.sendToBack(this.logoShadow);
      }
    }

    onLoaded() {
      if (this._finalized) return; this._finalized = true;
      DK.finalizeAssets(this);
      DK.initStory(this);
      DK.ready = true;
      DK.introProgress = 1;
      this.onTitleBgmLoaded();
      if (this._wantFinish || (this._cinematicDone && this.mode === 'short' && !this._finishing)) this.finish();
    }

    skip() {
      if (this._finishing) return;
      this.tryResumeAudio();
      this.skipped = true;
      this._cinematicDone = true;
      this._skipAt = performance.now();
      this.finish({ fade: SKIP_FADE });
    }

    finish(opts) {
      if (this._finishing) return;
      if (!DK.ready) {
        this._wantFinish = true;
        if (this.logoLayer.alpha < 0.5) {
          this.tweens.add({ targets: this.logoLayer, alpha: 1, scale: 1, duration: 200 });
        }
        this.loadHint.setText('载入中…').setAlpha(0.8);
        return;
      }
      this._finishing = true;
      DK.markIntroSeen();
      this.stopFx();
      const fade = (opts && opts.fade != null) ? opts.fade : END_FADE;
      const go = () => {
        if (this._skipAt) DK.introSkipMs = performance.now() - this._skipAt;
        this.stopIntroSnd();
        this.startTitleBgm();
        if (DK.current === this) DK.current = null;
        this.scene.start('Base');
      };
      this.fadeIntroFull(fade);
      if (fade <= 0) go();
      else {
        let gone = false;
        const once = () => { if (gone) return; gone = true; go(); };
        try { this.cameras.main.fadeOut(fade, 0, 0, 0); } catch (e) {}
        // Wall clock, not the scene timer: skip must land in <0.5s even when frames hitch (headless iPhone / SwiftShader).
        setTimeout(once, fade);
        try { this.cameras.main.once('camerafadeoutcomplete', once); } catch (e) {}
      }
    }

    stopFx() {
      if (this._hbTimer) { this._hbTimer.remove(false); this._hbTimer = null; }
      (this.beats || []).forEach(ev => ev && ev.remove && ev.remove(false));
      this.beats = [];
      if (this._onWinKey) { window.removeEventListener('keydown', this._onWinKey); this._onWinKey = null; }
    }

    shutdown() { this.stopFx(); this.stopIntroSnd(); }

        // ---------- SFX: real files via DK.sfx; WebAudio synth only if a slot is missing.
    playSfx(key, opt) {
      opt = opt || {};
      if (DK.muted) return;
      this.tryResumeAudio();
      if (hasAud(this, key)) {
        try { DK.sfx(this, key, { volume: 0.9 }); } catch (e) {}
        return;
      }
      const ctx = this.sound && this.sound.context;
      if (!ctx || ctx.state !== 'running') return;
      const vol = (DK.vol && DK.vol.sfx != null ? DK.vol.sfx : 0.9);
      const t = ctx.currentTime;
      const kind = opt.synth || 'beep';
      try {
        if (kind === 'heart' || key === 'pulse_heartbeat') this._osc(ctx, t, 'sine', 72, 58, 0.14, 0.11 * vol);
        else if (kind === 'hatch' || key === 'hatch_hiss') this._noise(ctx, t, 0.45, 0.12 * vol, 900);
        else if (kind === 'clink' || key === 'casing_clink_1' || key === 'casing_clink_2') this._osc(ctx, t, 'triangle', 1800 + (opt.detune || 0) * 0.5, 900, 0.08, 0.07 * vol);
        else if (kind === 'logo' || key === 'logo_hit') {
          this._osc(ctx, t, 'sine', 196, 392, 0.35, 0.09 * vol);
          this._osc(ctx, t + 0.04, 'sine', 247, 494, 0.4, 0.07 * vol);
          this._osc(ctx, t + 0.08, 'triangle', 330, 660, 0.45, 0.06 * vol);
        }
      } catch (e) {}
    }
    _osc(ctx, t, type, f0, f1, dur, gain) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      g.gain.setValueAtTime(Math.max(0.0001, gain), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    }
    _noise(ctx, t, dur, gain, cutoff) {
      const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff || 1200;
      const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(lp); lp.connect(g); g.connect(ctx.destination); src.start(t); src.stop(t + dur);
    }

    update() {
      this.drawRing();
    }
  };
})(window.DK);

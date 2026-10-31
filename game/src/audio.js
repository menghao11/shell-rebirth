// Sound: plays loaded files by key (with _1/_2 variants), otherwise a tiny WebAudio synth placeholder.
(function (DK) {
  // Per-key base volume (audio/MANIFEST.md suggests SFX 0.8–1.0, BGM 0.5–0.6). Multiplied by the user's 音效/音乐 settings.
  DK.SFX_VOL = { shoot_pistol: 0.75, shoot_pistol_power: 0.9, shoot_mg: 0.6, shoot_mg_1: 0.6, shoot_mg_2: 0.6, shoot_split: 0.7, enemy_hit: 0.6, sniper_warn: 0.8, bgm_stage1: 0.55, bgm_boss: 0.6 };
  DK.SFX_DEFAULT_VOL = 0.9;
  DK.BGM_LOOP = { bgm_stage1: 50.526, bgm_boss: 33.882 }; // exact loop lengths from audio/MANIFEST.md
  DK.vol = { music: 0.8, sfx: 0.9 };
  try { const v = JSON.parse(localStorage.getItem('dankelunhui_vol') || 'null'); if (v) Object.assign(DK.vol, v); } catch (e) {}
  DK.setVolume = function (kind, v) {
    DK.vol[kind] = Math.max(0, Math.min(1, Math.round(v * 10) / 10));
    try { localStorage.setItem('dankelunhui_vol', JSON.stringify(DK.vol)); } catch (e) {}
    if (kind === 'music') DK.applyMusicVolume();
  };
  // Fallback synth recipes: [type, freqStart, freqEnd, dur, gain, noise?]
  const SYN = {
    shoot_pistol: ['square', 520, 120, 0.07, 0.12], shoot_pistol_power: ['square', 700, 90, 0.12, 0.16], shoot_mg: ['square', 420, 140, 0.05, 0.08],
    shoot_split: ['triangle', 900, 300, 0.06, 0.08], enemy_hit: ['square', 220, 90, 0.05, 0.08], dry_fire: ['square', 1400, 1300, 0.03, 0.05],
    explosion_small: ['noise', 0, 0, 0.3, 0.3], explosion_large: ['noise', 0, 0, 0.6, 0.4], explosion_steam: ['noise', 0, 0, 0.5, 0.35],
    player_hurt: ['sawtooth', 300, 80, 0.18, 0.15], player_death: ['sawtooth', 400, 40, 0.8, 0.18], dash: ['triangle', 200, 900, 0.12, 0.1],
    reload: ['square', 900, 1200, 0.06, 0.06], pickup_powerup: ['triangle', 500, 1200, 0.25, 0.12], pickup_health: ['sine', 500, 900, 0.25, 0.14],
    pickup_scrap: ['triangle', 1200, 1600, 0.08, 0.08], pickup_weapon: ['square', 300, 900, 0.2, 0.08], shield_block: ['square', 1800, 1500, 0.05, 0.07],
    sniper_warn: ['sine', 900, 1900, 1.2, 0.05], tank_cannon: ['noise', 0, 0, 0.45, 0.4], grenade_throw: ['triangle', 600, 300, 0.12, 0.06],
    freeze: ['sine', 1600, 2400, 0.15, 0.06], ignite: ['noise', 0, 0, 0.15, 0.1], hostage_rescue: ['triangle', 523, 1046, 0.4, 0.12]
  };
  let lastPlay = {};
  function ctxOf(scene) { const s = scene.sound; return s && s.context ? s.context : null; }
  function synth(scene, key, vol) {
    const r = SYN[key]; const ctx = ctxOf(scene);
    if (!r || !ctx || ctx.state !== 'running' || DK.muted) return;
    const [type, f0, f1, dur, gain] = r, t = ctx.currentTime, g = ctx.createGain();
    g.gain.setValueAtTime(gain * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(ctx.destination);
    if (type === 'noise') {
      const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = key === 'explosion_steam' ? 2500 : 900;
      src.connect(lp); lp.connect(g); src.start(t); src.stop(t + dur);
    } else {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      o.connect(g); o.start(t); o.stop(t + dur);
    }
  }
  DK.sfx = function (scene, key, opts) {
    opts = opts || {};
    const now = performance.now(), minGap = opts.minGap != null ? opts.minGap : 35;
    if (lastPlay[key] && now - lastPlay[key] < minGap) return null;
    lastPlay[key] = now;
    if (DK.muted) return null;
    const vol = (opts.volume != null ? opts.volume : 1) * (DK.SFX_VOL[key] != null ? DK.SFX_VOL[key] : DK.SFX_DEFAULT_VOL) * DK.vol.sfx;
    if (vol <= 0) return null;
    const cache = scene.cache.audio;
    let k = key;
    if (!cache.exists(k)) {
      const vars = (DK._variants[key] = DK._variants[key] || cache.getKeys().filter(x => new RegExp('^' + key + '_\\d+$').test(x)));
      k = vars.length ? vars[(Math.random() * vars.length) | 0] : null;
    }
    try {
      if (k) {
        if (scene.sound.locked) { DK.logAudio(key, 'locked'); return null; }
        const inst = scene.sound.add(k, { volume: vol, detune: opts.detune != null ? opts.detune : (key === 'shoot_mg' ? Phaser.Math.Between(-90, 90) : 0) });
        inst.once('complete', () => inst.destroy()); inst.play();
        DK.logAudio(k, 'file'); return inst;
      }
      DK.logAudio(key, 'missing');
      if (DK.synthFallback) synth(scene, key, vol);
    } catch (e) { /* audio is never fatal */ }
    return null;
  };
  DK.stopSfx = function (inst) { try { if (inst && inst.isPlaying) inst.stop(); if (inst) inst.destroy(); } catch (e) {} };
  DK._variants = {};
  // Background music. Sample-accurate WebAudio loop (source.loop + loopStart/loopEnd) using the exact loop
  // lengths from audio/MANIFEST.md, skipping any MP3 encoder-delay silence at the head. Safe before the iOS unlock.
  DK._bgm = null;
  function stopBgm() {
    const b = DK._bgm; DK._bgm = null; if (!b) return;
    try {
      if (b.src) { const t = b.ctx.currentTime; b.gain.gain.setTargetAtTime(0, t, 0.15); b.src.stop(t + 0.6); }
      else if (b.snd) { b.snd.stop(); b.snd.destroy(); }
    } catch (e) {}
  }
  function leadSilence(buf) {
    const d = buf.getChannelData(0), max = Math.min(d.length, Math.floor(buf.sampleRate * 0.08));
    for (let i = 0; i < max; i++) if (Math.abs(d[i]) > 0.0005) return i / buf.sampleRate;
    return 0;
  }
  DK.music = function (scene, key) {
    DK._wantBgm = key;
    if (DK._bgm && DK._bgm.key === key) return;
    stopBgm();
    if (!key) { DK.logAudio('bgm', 'stop'); return; }
    if (!scene.cache.audio.exists(key)) { DK.logAudio(key, 'missing'); return; } // missing -> silence
    const snd = scene.sound;
    if (snd.locked) {
      if (!DK._waitUnlock) { DK._waitUnlock = true; snd.once('unlocked', () => { DK._waitUnlock = false; const k = DK._wantBgm; DK._wantBgm = null; if (k) DK.music(scene, k); }); }
      return;
    }
    const base = DK.SFX_VOL[key] != null ? DK.SFX_VOL[key] : 0.55;
    try {
      const buf = scene.cache.audio.get(key);
      if (snd.context && buf && buf.getChannelData) {
        const ctx = snd.context, src = ctx.createBufferSource(), gain = ctx.createGain();
        src.buffer = buf; src.loop = true;
        const len = DK.BGM_LOOP[key], lead = leadSilence(buf);
        if (len && lead + len <= buf.duration + 0.001) { src.loopStart = lead; src.loopEnd = lead + len; }
        gain.gain.value = base * DK.vol.music;
        src.connect(gain); gain.connect(snd.destination || ctx.destination);
        src.start(0, src.loopStart || 0);
        DK._bgm = { key, src, gain, ctx, base, loopStart: src.loopStart, loopEnd: src.loopEnd };
      } else { // HTML5 audio fallback
        const s2 = snd.add(key, { loop: true, volume: base * DK.vol.music }); s2.play();
        DK._bgm = { key, snd: s2, base };
      }
      DK.logAudio(key, 'bgm');
    } catch (e) { DK.logAudio(key, 'error'); }
  };
  DK.applyMusicVolume = function () {
    const b = DK._bgm; if (!b) return;
    try { if (b.gain) b.gain.gain.value = b.base * DK.vol.music; else if (b.snd) b.snd.setVolume(b.base * DK.vol.music); } catch (e) {}
  };
  // audio event log (for testing): __dbg.audioLog()
  DK.audioLog = [];
  DK.logAudio = function (key, how) { DK.audioLog.push({ t: +(performance.now() / 1000).toFixed(2), key, how }); if (DK.audioLog.length > 500) DK.audioLog.shift(); };
  DK.muted = false;
  DK.synthFallback = false; // set true to hear beeps for missing SFX files (default: silent fallback)
})(window.DK);

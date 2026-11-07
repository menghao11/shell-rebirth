// Asset discovery + loading + placeholder fallback.
// Art:   ../art/<key>.png (or .webp/.jpg), or mapped via ../art/manifest.json
// Audio: ../audio/<key>.mp3|.m4a|.ogg|.wav  (variants: <key>_1, <key>_2 ... picked at random)
// Story: ../story/story.json
(function (DK) {
  const IMG_EXT = ['png', 'webp', 'jpg', 'jpeg'];
  const AUD_EXT = ['m4a', 'mp3', 'ogg', 'wav']; // Phaser picks the first the browser can play
  DK.assetReport = { art: {}, audio: {}, story: 'fallback', listing: {} };

  // python http.server (and most dev servers) return an HTML index for a directory.
  // Reading the index avoids requesting files that don't exist (=> no 404 console noise).
  async function listDir(url) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return null;
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('html')) return null;
      const html = await r.text();
      const out = [];
      html.replace(/href="([^"?#]+)"/g, (m, h) => { h = decodeURIComponent(h); if (!h.endsWith('/') && !h.includes('://') && !h.startsWith('/')) out.push(h); return m; });
      return out;
    } catch (e) { return null; }
  }
  async function fetchJson(url) {
    try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return null; return await r.json(); } catch (e) { return null; }
  }
  const base = f => f.replace(/\.[^.]+$/, '');
  const ext = f => (f.split('.').pop() || '').toLowerCase();

  // Returns { images:[{key,url,frames}], audio:[{key,urls}], story:url|null }
  DK.discoverAssets = async function () {
    const P = DK.PATHS, plan = { images: [], audio: [], story: null };
    // ---- art
    const artFiles = await listDir(P.art);
    DK.assetReport.listing.art = artFiles ? artFiles.length : 'no-index';
    let artManifest = null;
    if (artFiles === null || artFiles.includes('manifest.json')) artManifest = await fetchJson(P.art + 'manifest.json');
    const seen = new Set();
    DK.ARTX = {};
    if (artManifest && Array.isArray(artManifest.assets)) {
      // Art-team format: { assets:[{ name, frame_size:[w,h], frame_count, sheet, frames:[...], anchor:[x,y], fps, loop }] }
      // Prefer the downscaled build in game/assets/art_web/ (tools/build_web_art.py) when it matches the source entry.
      const webList = await listDir(P.artWebDir);
      const web = (webList === null || webList.includes('manifest.json')) ? await fetchJson(P.artWebDir + 'manifest.json') : null;
      const webBy = {}; if (web && Array.isArray(web.assets)) for (const w of web.assets) webBy[w.name] = w;
      DK.assetReport.web = { used: 0, stale: 0 };
      for (const a0 of artManifest.assets) {
        if (!a0 || !a0.name) continue;
        const sigv = JSON.stringify([a0.sheet || null, (a0.frames || [null])[0], a0.frame_size, a0.frame_count || 1, a0.anchor]);
        const w = webBy[a0.name];
        const useWeb = w && w.src_sig === sigv;
        if (w && !useWeb) DK.assetReport.web.stale++;
        if (useWeb) DK.assetReport.web.used++;
        const a = useWeb ? Object.assign({}, a0, w) : Object.assign({ res_scale: 1, x_offset: 0 }, a0);
        const root = useWeb ? P.artWebDir : P.art;
        const fs = a.frame_size || null, n = a.frame_count || 1;
        let url = null, frames = null;
        if (n > 1 && a.sheet && fs) { url = a.sheet; frames = { w: fs[0], h: fs[1] }; }
        else url = a.file || (a.frames && a.frames[0]) || a.sheet;
        if (!url) continue;
        DK.ARTX[a.name] = a;
        plan.images.push({ key: a.name, url: root + url, frames }); seen.add(a.name);
      }
    } else if (artManifest) {
      // Simple format: { key: "file.png" | { file, size:[w,h], scale, frames:{w,h,fps}, flip, origin } }
      for (const [key, v] of Object.entries(artManifest)) {
        if (key.startsWith('_') || !v) continue;
        if (typeof v === 'string' && !IMG_EXT.includes(ext(v))) continue;
        if (typeof v !== 'string' && typeof v !== 'object') continue;
        const spec = typeof v === 'string' ? { file: v } : v;
        DK.ART[key] = Object.assign({}, DK.ART[key] || {}, spec, { sizeFromManifest: !!spec.size });
        if (spec.file) { plan.images.push({ key, url: P.art + spec.file, frames: spec.frames }); seen.add(key); }
      }
    }
    if (artFiles) {
      // Loose files dropped next to the game keys (art/player.png, art/enemy_rifle.png ...)
      for (const f of artFiles) {
        if (!IMG_EXT.includes(ext(f))) continue;
        const key = base(f);
        if (seen.has(key) || !DK.ART[key]) continue;
        plan.images.push({ key, url: P.art + f, frames: DK.ART[key].frames }); seen.add(key);
      }
    }
    // ---- audio
    const audFiles = await listDir(P.audio);
    DK.assetReport.listing.audio = audFiles ? audFiles.length : 'no-index';
    let audManifest = null;
    if (audFiles === null || (audFiles && audFiles.includes('manifest.json'))) audManifest = await fetchJson(P.audio + 'manifest.json');
    const groups = {};
    if (audManifest) for (const [key, v] of Object.entries(audManifest)) {
      if (key.startsWith('_') || !v) continue;
      const spec = typeof v === 'string' ? { file: v } : v;
      if (spec.volume != null) DK.SFX_VOL[key] = spec.volume;
      const files = Array.isArray(spec.file) ? spec.file : [spec.file];
      groups[key] = files.map(f => P.audio + f);
    }
    if (audFiles) for (const f of audFiles) {
      if (!AUD_EXT.includes(ext(f))) continue;
      const key = base(f); if (audManifest && audManifest[key]) continue;
      (groups[key] = groups[key] || []).push(P.audio + f);
    }
    for (const [key, urls] of Object.entries(groups)) {
      urls.sort((a, b) => AUD_EXT.indexOf(ext(a)) - AUD_EXT.indexOf(ext(b)));
      plan.audio.push({ key, urls });
    }
    // ---- stage 2 (art/stage2/manifest.json in the art-team format, audio/stage2/*.mp3 + MANIFEST.md volumes, story/stage2.json)
    await discoverStage2(plan, seen);
    // ---- story
    const storyDir = P.story.replace(/[^/]+$/, ''), storyFile = P.story.split('/').pop();
    const stFiles = await listDir(storyDir);
    if (stFiles === null || stFiles.includes(storyFile)) plan.story = P.story;
    return plan;
  };

  async function discoverStage2(plan, seen) {
    const P = DK.PATHS; DK.assetReport.stage2 = { art: 0, audio: 0, story: false };
    const files = await listDir(P.art2);
    const man = (files === null || (files && files.includes('manifest.json'))) ? await fetchJson(P.art2 + 'manifest.json') : null;
    if (man && Array.isArray(man.assets)) for (const a0 of man.assets) {
      if (!a0 || !a0.name) continue;
      const a = Object.assign({ res_scale: 1, x_offset: 0 }, a0), fs = a.frame_size || null, n = a.frame_count || 1;
      const url = n > 1 && a.sheet && fs ? a.sheet : (a.file || (a.frames && a.frames[0]) || a.sheet); if (!url) continue;
      DK.ARTX[a.name] = a; plan.images.push({ key: a.name, url: P.art2 + url, frames: n > 1 && a.sheet && fs ? { w: fs[0], h: fs[1] } : null }); seen.add(a.name); DK.assetReport.stage2.art++;
    }
    if (files) for (const f of files) { // loose stage-2 images named after a game key (art/stage2/prop_cactus.png ...)
      if (!IMG_EXT.includes(ext(f))) continue; const key = base(f);
      if (seen.has(key) || !DK.ART[key]) continue; plan.images.push({ key, url: P.art2 + f }); seen.add(key); DK.assetReport.stage2.art++;
    }
    const af = await listDir(P.audio2);
    if (af) {
      const groups = {};
      for (const f of af) { if (!AUD_EXT.includes(ext(f))) continue; const key = P.audio2Prefix + base(f); (groups[key] = groups[key] || []).push(P.audio2 + f); }
      for (const [key, urls] of Object.entries(groups)) { urls.sort((a, b) => AUD_EXT.indexOf(ext(a)) - AUD_EXT.indexOf(ext(b))); plan.audio.push({ key, urls }); DK.assetReport.stage2.audio++; }
      if (af.includes('MANIFEST.md')) { // volumes + exact loop lengths straight from 声音王's table
        try { const md = await (await fetch(P.audio2 + 'MANIFEST.md', { cache: 'no-store' })).text();
          md.split('\n').forEach(line => { const m = line.match(/^\|\s*`([\w-]+)\.mp3`\s*\|.*\|\s*([\d.]+)(?:-[\d.]+)?\s*\|\s*$/); if (m) DK.SFX_VOL[P.audio2Prefix + m[1]] = parseFloat(m[2]); });
          const loopRe = /(\w+)\s*\*\*([\d.]+)\s*s\*\*/g; let m; while ((m = loopRe.exec(md))) DK.BGM_LOOP[P.audio2Prefix + m[1]] = parseFloat(m[2]);
        } catch (e) {}
      }
    }
    const sf = await listDir(P.story2.replace(/[^/]+$/, ''));
    if (sf === null || sf.includes(P.story2.split('/').pop())) { plan.story2 = P.story2; DK.assetReport.stage2.story = true; }
  }

  DK.queueAssets = function (scene, plan) {
    for (const im of plan.images) {
      if (im.frames && im.frames.w) scene.load.spritesheet(im.key, im.url, { frameWidth: im.frames.w, frameHeight: im.frames.h || im.frames.w });
      else scene.load.image(im.key, im.url);
    }
    for (const a of plan.audio) scene.load.audio(a.key, a.urls);
    if (plan.story) scene.load.json('story', plan.story);
    if (plan.story2) scene.load.json('story2', plan.story2);
  };

  // After loading: mark what's real, make animations, build placeholders for the rest.
  DK.finalizeAssets = function (scene) {
    // animations for every art-team sheet (key = asset name)
    for (const [name, a] of Object.entries(DK.ARTX || {})) {
      if (!scene.textures.exists(name)) { DK.assetReport.art[name] = 'failed'; continue; }
      DK.assetReport.art[name] = 'file';
      if ((a.frame_count || 1) > 1 && !scene.anims.exists(name)) {
        scene.anims.create({ key: name, frames: scene.anims.generateFrameNumbers(name, { start: 0, end: a.frame_count - 1 }), frameRate: a.fps || 8, repeat: a.loop ? -1 : 0 });
      }
    }
    for (const key of Object.keys(DK.ART)) {
      const spec = DK.ART[key];
      const alias = DK.ART_ALIAS[key];
      if (scene.textures.exists(key)) {
        spec.real = true; spec.tex = key; DK.assetReport.art[key] = 'file';
        const fr = spec.frames;
        if (fr && fr.w && !scene.anims.exists(key + '_anim') && !(DK.ARTX && DK.ARTX[key])) {
          scene.anims.create({ key: key + '_anim', frames: scene.anims.generateFrameNumbers(key, {}), frameRate: fr.fps || 8, repeat: fr.repeat == null ? -1 : fr.repeat });
        }
        if (spec.scale && !spec.sizeFromManifest) {
          const src = scene.textures.get(key).getSourceImage();
          const fw = fr && fr.w ? fr.w : src.width, fh = fr && fr.h ? fr.h : src.height;
          spec.size = [fw * spec.scale, fh * spec.scale];
        }
      } else if (alias && scene.textures.exists(alias)) {
        spec.real = true; spec.tex = alias; DK.assetReport.art[key] = 'file:' + alias;
        DK.makePlaceholder(scene, key); // keeps the key valid for add.image(x, y, key)
      } else {
        spec.real = false; spec.tex = key; DK.assetReport.art[key] = 'placeholder';
        DK.makePlaceholder(scene, key);
      }
      // Art-team sheets keep their aspect ratio inside the logical size box
      const ax = DK.ARTX && DK.ARTX[spec.tex];
      if (spec.real && ax && spec.size && !spec.sizeFromManifest) {
        const [fw, fh] = ax.frame_size || [scene.textures.get(spec.tex).getSourceImage().width, scene.textures.get(spec.tex).getSourceImage().height];
        const k = Math.min(spec.size[0] / fw, spec.size[1] / fh);
        spec.size = [fw * k, fh * k];
      }
    }
    for (const k of scene.cache.audio.getKeys()) DK.assetReport.audio[k] = 'file';
  };

  // Put a texture on a game object at its logical (gameplay) size.
  DK.applyArt = function (obj, key) {
    const spec = DK.ART[key] || {}, tex = spec.tex || key;
    obj.setTexture(tex, 0);
    const sz = spec.size || [obj.width, obj.height];
    obj.setDisplaySize(sz[0], sz[1]);
    const ax = DK.ARTX && DK.ARTX[tex];
    if (spec.origin) obj.setOrigin(spec.origin[0], spec.origin[1]);
    else obj.setOrigin(0.5, 0.5);
    if (spec.real && obj.anims) {
      if (ax && ax.frame_count > 1 && obj.scene.anims.exists(tex)) obj.play(tex);
      else if (spec.frames && obj.scene.anims.exists(key + '_anim')) obj.play(key + '_anim');
    }
    return obj;
  };
  DK.artSize = key => (DK.ART[key] && DK.ART[key].size) || [32, 32];
  DK.hasArt = name => !!(DK.ARTX && DK.ARTX[name] && DK.game && DK.game.textures.exists(name));

  // Animated characters from the art-team sheets (DK.SKINS in data.js). Origin = the art anchor (feet)
  // lifted by sk.lift logical px, so sprite.x/y stays the gameplay centre the hitbox is built around.
  DK.applySkin = function (obj, key) {
    const sk = DK.SKINS[key];
    const first = sk && (sk.anims.idle || sk.anims.move);
    if (!sk || !DK.hasArt(first)) { obj.skin = null; obj.realSkin = false; DK.applyArt(obj, key); return false; }
    obj.skin = sk; obj.realSkin = true;
    obj.setTexture(first, 0);
    DK.skinOrigin(obj, first);
    DK.anim(obj, sk.anims.idle ? 'idle' : 'move');
    return true;
  };
  // origin = art anchor (feet) lifted to the gameplay centre, shifted by the anim's x_offset; keeps the body glued.
  DK.skinOrigin = function (obj, name) {
    const a = DK.ARTX[name]; if (!a) return;
    const sk = obj.skin, rs = a.res_scale || 1, [fw, fh] = a.frame_size, [ax, ay] = a.anchor || [fw / 2, fh];
    const sc = sk.scale / rs;
    if (Math.abs(obj.scaleX - sc) > 1e-6) obj.setScale(sc);
    const dy = obj.renderDY || 0; // visual-only lift (art render_y_offsets: jump / dismount); the body stays on the ground point
    obj.setOrigin((ax - (a.x_offset || 0)) / fw, (ay - sk.lift / sc - dy / sc) / fh);
    if (obj._skinAnim === name && obj._skinDY === dy) return; obj._skinAnim = name; obj._skinDY = dy;
    if (obj.body && obj.bodyCircle) DK.setCircleBody(obj, obj.bodyCircle);
    else if (obj.body && obj.bodyRect) DK.setRectBody(obj, obj.bodyRect[0], obj.bodyRect[1]);
  };
  // Play a named state on a skinned sprite (no-op for placeholders / missing anims).
  DK.anim = function (obj, state, opts) {
    if (!obj || !obj.realSkin || !obj.anims) return false;
    const name = obj.skin.anims[state];
    if (!name || !obj.scene.anims.exists(name)) return false;
    const cur = obj.anims.currentAnim;
    if (cur && cur.key === name && !(opts && opts.restart)) {
      if (obj.anims.isPlaying || !(DK.ARTX[name] && DK.ARTX[name].loop)) return true;
    }
    DK.skinOrigin(obj, name);
    obj.play({ key: name, startFrame: (opts && opts.startFrame) || 0 });
    return true;
  };
  DK.animFrame = function (obj, state, frame) { // hold a single frame of a state (e.g. sniper aim)
    if (!obj || !obj.realSkin) return;
    const name = obj.skin.anims[state]; if (!name || !DK.hasArt(name)) return;
    const a = DK.ARTX[name], f = Math.max(0, Math.min((a.frame_count || 1) - 1, frame | 0)), off = a.render_y_offsets;
    obj.renderDY = off ? (off[f] || 0) * obj.skin.scale / (a.res_scale || 1) : 0;
    obj.anims.stop(); DK.skinOrigin(obj, name); obj.setTexture(name, f);
  };

  // Circle hitbox in logical px regardless of texture resolution.
  // Bodies are centred on the object's origin point (= sprite.x/y), in logical px.
  DK.setCircleBody = function (obj, r) {
    const sx = Math.abs(obj.scaleX) || 1;
    const rr = r / sx; obj.bodyCircle = r;
    obj.body.setCircle(rr, obj.displayOriginX - rr, obj.displayOriginY - rr);
  };
  DK.setRectBody = function (obj, w, h) {
    const sx = Math.abs(obj.scaleX) || 1, sy = Math.abs(obj.scaleY) || 1; obj.bodyRect = [w, h];
    obj.body.setSize(w / sx, h / sy, false);
    obj.body.setOffset(obj.displayOriginX - w / sx / 2, obj.displayOriginY - h / sy / 2);
  };

  // ------------------------------------------------------------- placeholders
  const Q = 3; // placeholder textures are drawn at 3x logical size so they stay smooth on retina
  function tex(scene, key, w, h, draw) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    draw(g, w * Q, h * Q, Q);
    g.generateTexture(key, Math.ceil(w * Q), Math.ceil(h * Q)); g.destroy();
  }
  function soldier(g, W, H, q, body, trim, extra) {
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.42;
    g.fillStyle(0x000000, 0.25).fillEllipse(cx, cy + r * 0.85, r * 1.6, r * 0.5);
    g.fillStyle(body).fillCircle(cx, cy, r);
    g.lineStyle(2.5 * q, 0x111111).strokeCircle(cx, cy, r);
    g.fillStyle(trim).fillRoundedRect(cx - r * 0.1, cy - r * 0.55, r * 0.95, r * 0.42, r * 0.15); // visor facing right
    g.fillStyle(0xffffff, 0.35).fillCircle(cx - r * 0.35, cy - r * 0.4, r * 0.22);
    if (extra) extra(g, cx, cy, r);
  }
  const P = {
    player: (g, W, H, q) => soldier(g, W, H, q, 0x4f8a3c, 0x1c2a14, (g, cx, cy, r) => { g.fillStyle(0xf2c14e).fillRect(cx - r * 0.7, cy + r * 0.15, r * 1.4, r * 0.18); }),
    enemy_charger: (g, W, H, q) => soldier(g, W, H, q, 0xd9502b, 0x2a0d06, (g, cx, cy, r) => { g.fillStyle(0xffe14a).fillTriangle(cx - r * .4, cy + r * .1, cx + r * .1, cy + r * .1, cx - r * .15, cy + r * .6); }),
    enemy_rifle: (g, W, H, q) => soldier(g, W, H, q, 0x9a8a55, 0x2e2a18),
    enemy_sniper: (g, W, H, q) => soldier(g, W, H, q, 0x7a4ea0, 0x1e1028, (g, cx, cy, r) => { g.fillStyle(0xff3030).fillCircle(cx + r * .55, cy - r * .35, r * .14); }),
    enemy_heavy: (g, W, H, q) => soldier(g, W, H, q, 0x6b6f75, 0x1a1c1e, (g, cx, cy, r) => { g.lineStyle(3 * q, 0x3a3d40).strokeCircle(cx, cy, r * 0.7); }),
    hostage: (g, W, H, q) => soldier(g, W, H, q, 0xd7c6a3, 0x5a4a30, (g, cx, cy, r) => { g.lineStyle(2 * q, 0x6b4a22).lineBetween(cx - r, cy + r * .2, cx + r, cy + r * .2).lineBetween(cx - r, cy + r * .45, cx + r, cy + r * .45); }),
    npc_laoqiang: (g, W, H, q) => soldier(g, W, H, q, 0x8a6d3b, 0x111111, (g, cx, cy, r) => { g.fillStyle(0x111111).fillCircle(cx + r * .3, cy - r * .32, r * .2); g.fillStyle(0xdddddd).fillRect(cx - r * .6, cy + r * .3, r * 1.2, r * .25); }),
    npc_lingjian: (g, W, H, q) => { const cx = W / 2, cy = H / 2; g.fillStyle(0x000000, .25).fillEllipse(cx, H * .9, W * .7, H * .15); g.fillStyle(0x8fa3b0).fillRoundedRect(W * .15, H * .2, W * .7, H * .62, 8 * q); g.lineStyle(2.5 * q, 0x1a2228).strokeRoundedRect(W * .15, H * .2, W * .7, H * .62, 8 * q); g.fillStyle(0x6fd6ff).fillCircle(cx - W * .14, cy - H * .04, W * .08).fillCircle(cx + W * .14, cy - H * .04, W * .08); g.lineStyle(2 * q, 0x1a2228).lineBetween(cx, H * .2, cx, H * .06); g.fillStyle(0xff5a4e).fillCircle(cx, H * .06, W * .05); },
    npc_merchant: (g, W, H, q) => soldier(g, W, H, q, 0x5b3f7a, 0xd9a7ff, (g, cx, cy, r) => { g.fillStyle(0xf2c14e).fillCircle(cx, cy + r * .4, r * .2); }),
    gun_pistol: (g, W, H, q) => { g.fillStyle(0x2b2b2b).fillRoundedRect(W * .35, H * .1, W * .65, H * .5, 2 * q).fillRect(W * .3, H * .4, W * .25, H * .55); g.lineStyle(1 * q, 0x000000).strokeRoundedRect(W * .35, H * .1, W * .65, H * .5, 2 * q); },
    gun_mg: (g, W, H, q) => { g.fillStyle(0x3a3a2a).fillRect(W * .2, H * .15, W * .8, H * .45).fillRect(W * .35, H * .5, W * .15, H * .5); g.fillStyle(0x1a1a1a).fillRect(W * .85, H * .25, W * .15, H * .25); g.lineStyle(1 * q, 0x000).strokeRect(W * .2, H * .15, W * .8, H * .45); },
    enemy_gun: (g, W, H, q) => { g.fillStyle(0x202020).fillRect(W * .3, H * .2, W * .7, H * .6); },
    shield: (g, W, H, q) => { g.fillStyle(0x9fb4c8).fillRoundedRect(0, 0, W, H, 4 * q); g.lineStyle(2 * q, 0x2a3540).strokeRoundedRect(q, q, W - 2 * q, H - 2 * q, 4 * q); g.fillStyle(0xffffff, .35).fillRect(W * .25, H * .1, W * .2, H * .8); },
    boss_anvil: (g, W, H, q) => {
      g.fillStyle(0x000000, .3).fillRoundedRect(W * .04, H * .1, W * .96, H * .92, 10 * q);
      g.fillStyle(0x2a2a24).fillRoundedRect(0, 0, W, H * .22, 6 * q).fillRoundedRect(0, H * .78, W, H * .22, 6 * q); // tracks
      g.fillStyle(0x444438); for (let i = 0; i < 10; i++) { g.fillRect(W * (i / 10) + 2 * q, H * .03, W * .05, H * .16); g.fillRect(W * (i / 10) + 2 * q, H * .81, W * .05, H * .16); }
      g.fillStyle(0x5d6b3a).fillRoundedRect(W * .06, H * .16, W * .88, H * .68, 12 * q);
      g.lineStyle(3 * q, 0x1b1f12).strokeRoundedRect(W * .06, H * .16, W * .88, H * .68, 12 * q);
      g.fillStyle(0x4a5530).fillRect(W * .12, H * .3, W * .18, H * .4); g.fillStyle(0xffd23f).fillTriangle(W * .7, H * .25, W * .9, H * .25, W * .8, H * .4);
    },
    boss_turret: (g, W, H, q) => { const cy = H / 2; g.fillStyle(0x1f2414).fillRect(W * .45, cy - H * .12, W * .55, H * .24); g.fillStyle(0x111).fillRect(W * .92, cy - H * .16, W * .08, H * .32); g.fillStyle(0x6f7d45).fillCircle(W * .3, cy, H * .48); g.lineStyle(3 * q, 0x1b1f12).strokeCircle(W * .3, cy, H * .48); g.fillStyle(0x3d4626).fillCircle(W * .3, cy, H * .2); },
    bullet_player: (g, W, H) => { g.fillStyle(0xfff3a0).fillEllipse(W / 2, H / 2, W, H); g.fillStyle(0xffffff).fillEllipse(W * .6, H / 2, W * .5, H * .5); },
    bullet_enemy: (g, W, H) => { g.fillStyle(0xff4a3a).fillCircle(W / 2, H / 2, W / 2); g.fillStyle(0xffd0c0).fillCircle(W / 2, H / 2, W / 4); },
    ring_bullet: (g, W, H, q) => { g.fillStyle(0x000000, 0.35).fillCircle(W / 2, H / 2 + q, W / 2 - q * 0.2); g.fillStyle(0xffffff).fillCircle(W / 2, H / 2, W / 2 - q * 0.6); g.fillStyle(0xff2f8f).fillCircle(W / 2, H / 2, W / 2 - q * 2.2); g.fillStyle(0xffe066).fillCircle(W / 2, H / 2, W / 6); },
    bullet_boss: (g, W, H) => { g.fillStyle(0xff2fa0).fillCircle(W / 2, H / 2, W / 2); g.fillStyle(0xffe0f0).fillCircle(W / 2, H / 2, W / 4.5); },
    shell_cannon: (g, W, H) => { g.fillStyle(0xffa020).fillEllipse(W / 2, H / 2, W, H); g.fillStyle(0xfff0b0).fillEllipse(W * .6, H / 2, W * .5, H * .5); },
    grenade: (g, W, H, q) => { g.fillStyle(0x3f5a2a).fillCircle(W / 2, H / 2, W * .45); g.lineStyle(1.5 * q, 0x111).strokeCircle(W / 2, H / 2, W * .45); g.fillStyle(0xbbbbbb).fillRect(W * .45, 0, W * .15, H * .3); },
    mine: (g, W, H, q) => { g.fillStyle(0x3a3a3a).fillCircle(W / 2, H / 2, W * .45); g.lineStyle(2 * q, 0x111).strokeCircle(W / 2, H / 2, W * .45); g.fillStyle(0xff3030).fillCircle(W / 2, H / 2, W * .14); },
    explosion: (g, W, H) => { const c = W / 2; [[0xff5a1a, .5], [0xff9a2a, .4], [0xffd84a, .28], [0xfff8d0, .14]].forEach(([col, r]) => g.fillStyle(col).fillCircle(c, c, W * r)); },
    muzzle: (g, W, H) => { g.fillStyle(0xffd24a).fillTriangle(0, H * .2, W, H / 2, 0, H * .8); g.fillStyle(0xffffff).fillTriangle(0, H * .35, W * .6, H / 2, 0, H * .65); },
    spark: (g, W, H) => { g.fillStyle(0xffe08a).fillTriangle(W * .5, 0, W * .62, H * .5, W * .38, H * .5).fillTriangle(W * .5, H, W * .62, H * .5, W * .38, H * .5).fillTriangle(0, H * .5, W * .5, H * .38, W * .5, H * .62).fillTriangle(W, H * .5, W * .5, H * .38, W * .5, H * .62); },
    casing: (g, W, H) => { g.fillStyle(0xd8a838).fillRect(0, 0, W, H); },
    floor: (g, W, H, q) => { g.fillStyle(0x6b5e45).fillRect(0, 0, W, H); g.fillStyle(0x5f533c); for (let i = 0; i < 7; i++) g.fillCircle((i * 37 % 61) / 61 * W, (i * 53 % 67) / 67 * H, 3 * q); g.lineStyle(1 * q, 0x574b35, .6).strokeRect(0, 0, W, H); },
    floor_base: (g, W, H, q) => { g.fillStyle(0x56534d).fillRect(0, 0, W, H); g.lineStyle(1.5 * q, 0x45423d).strokeRect(0, 0, W, H); g.fillStyle(0x625f58).fillCircle(W * .15, H * .15, 2 * q).fillCircle(W * .85, H * .15, 2 * q).fillCircle(W * .15, H * .85, 2 * q).fillCircle(W * .85, H * .85, 2 * q); },
    wall: (g, W, H, q) => { g.fillStyle(0x3b3a33).fillRect(0, 0, W, H); g.lineStyle(2 * q, 0x2a2924); for (let y = 0; y < H; y += H / 4) g.lineBetween(0, y, W, y); },
    cover: (g, W, H, q) => { g.fillStyle(0x000000, .25).fillRoundedRect(W * .04, H * .15, W * .96, H * .85, 6 * q); g.fillStyle(0xa48b5c); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.fillRoundedRect(i * W / 3 + (j ? W / 6 : 0) - (j ? W / 6 : 0), j * H * .42 + H * .02, W / 3 - q, H * .44, 5 * q); g.lineStyle(1.5 * q, 0x5a4a2c); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.strokeRoundedRect(i * W / 3, j * H * .42 + H * .02, W / 3 - q, H * .44, 5 * q); },
    barrel: (g, W, H, q) => { g.fillStyle(0xc0392b).fillRoundedRect(W * .08, 0, W * .84, H, 5 * q); g.fillStyle(0x8e2a20).fillRect(W * .08, H * .28, W * .84, H * .07).fillRect(W * .08, H * .68, W * .84, H * .07); g.fillStyle(0xffd23f).fillTriangle(W * .5, H * .38, W * .32, H * .64, W * .68, H * .64); g.lineStyle(1.5 * q, 0x3a0d08).strokeRoundedRect(W * .08, 0, W * .84, H, 5 * q); },
    door: (g, W, H, q) => { g.fillStyle(0x7a2a20).fillRect(0, 0, W, H); g.lineStyle(2 * q, 0x2a0a06).strokeRect(q, q, W - 2 * q, H - 2 * q); g.fillStyle(0xffd23f); for (let y = 0; y < H; y += H / 6) g.fillRect(0, y, W, H / 14); },
    echo_pod: (g, W, H, q) => { g.fillStyle(0x24343c).fillRoundedRect(0, 0, W, H, W / 2); g.fillStyle(0x6fd6ff, .6).fillRoundedRect(W * .18, H * .12, W * .64, H * .7, W * .32); g.lineStyle(3 * q, 0x0e1a20).strokeRoundedRect(q, q, W - 2 * q, H - 2 * q, W / 2); },
    workbench: (g, W, H, q) => { g.fillStyle(0x6a5232).fillRect(0, H * .2, W, H * .6); g.fillStyle(0x4a3a22).fillRect(W * .05, H * .8, W * .1, H * .2).fillRect(W * .85, H * .8, W * .1, H * .2); g.fillStyle(0x9aa0a6).fillRect(W * .2, H * .05, W * .25, H * .2); g.fillStyle(0xd0d0d0).fillCircle(W * .7, H * .35, H * .12); },
    campfire: (g, W, H) => { g.fillStyle(0x5a3a20).fillRect(W * .15, H * .7, W * .7, H * .12); g.fillStyle(0xff7a1a).fillTriangle(W * .2, H * .75, W * .5, H * .05, W * .8, H * .75); g.fillStyle(0xffd84a).fillTriangle(W * .35, H * .75, W * .5, H * .3, W * .65, H * .75); },
    icon_scrap: (g, W, H, q) => { g.fillStyle(0x9aa0a6).fillTriangle(W * .1, H * .9, W * .5, H * .1, W * .9, H * .9); g.fillStyle(0x6a7076).fillCircle(W * .5, H * .62, W * .14); },
    icon_hp: (g, W, H) => { g.fillStyle(0xe74c3c).fillRect(W * .38, H * .1, W * .24, H * .8).fillRect(W * .1, H * .38, W * .8, H * .24); }
  };
  const ICON = { icon_burn: [0xff7a1a, '火'], icon_freeze: [0x4fb6e6, '冰'], icon_split: [0xc9c23a, '裂'], icon_mg: [0x6b6b4a, '机'], icon_mod: [0x8a6dc0, '改'], icon_armor: [0x5c7a9a, '甲'], icon_heal: [0xc0392b, '+'], icon_grenade: [0x3f5a2a, '雷'], icon_dash: [0x2f9a8a, '冲'] };
  DK.ICON_CHAR = Object.fromEntries(Object.entries(ICON).map(([k, v]) => [k, v[1]]));
  const PORTRAIT = { portrait_mark: 'player', portrait_laoqiang: 'npc_laoqiang', portrait_lingjian: 'npc_lingjian', portrait_anvil: 'boss_turret', portrait_system: null };

  DK.placeholderTex = tex; DK.PLACEHOLDERS = P; // stage2.js adds its desert placeholders to P
  DK.makePlaceholder = function (scene, key) {
    const [w, h] = DK.artSize(key);
    if (P[key]) return tex(scene, key, w, h, P[key]);
    const fb = (DK.ART[key] || {}).fallback || { floor_boss: 'floor' }[key];
    if (fb && P[fb]) return tex(scene, key, w, h, (g, W, H, q) => P[fb](g, W, H, q, key));
    if (ICON[key]) {
      const [col, ch] = ICON[key];
      tex(scene, key, w, h, (g, W, H, q) => { g.fillStyle(col).fillRoundedRect(0, 0, W, H, 8 * q); g.lineStyle(2 * q, 0xffffff, .7).strokeRoundedRect(q, q, W - 2 * q, H - 2 * q, 8 * q); });
      return;
    }
    if (key in PORTRAIT) {
      const src = PORTRAIT[key];
      if (!src) return tex(scene, key, w, h, (g, W, H) => { g.fillStyle(0x333333).fillRect(0, 0, W, H); });
      return tex(scene, key, w, h, (g, W, H, q) => { g.fillStyle(0x1e1e22).fillRoundedRect(0, 0, W, H, 10 * q); P[src](g, W, H, q); });
    }
    // generic
    tex(scene, key, w, h, (g, W, H, q) => { g.fillStyle(0xff00ff).fillRect(0, 0, W, H); });
  };
})(window.DK);

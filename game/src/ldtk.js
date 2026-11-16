// LDtk 1.5.3 runtime: parse maps/shell-rebirth.ldtk (or the embedded copy), stitch a
// seeded variant, and build one scrolling room. Pure helpers also run under node tests.
// Phaser 3.90 — camera origin stays (0,0) with zoom DK.R, so scroll is applied by hand.
// setBounds() would shift the world when zoom isn't 1 (see DK.setupCamera).
(function (root) {
  const DK = root.DK || (root.DK = {});
  const TILE = 32;
  // Metrics measured from DK.PLAYER / DK.STAGE2 (data.js). Geometry in the project uses these.
  DK.MAP_METRICS = {
    viewport: [960, 540],
    tile: TILE,
    playerSpeed: 215,
    playerRadius: 13,
    dashPx: Math.round(640 * 0.17),
    grenadeRange: 280,
    grenadeRadius: 72,
    camelChargePx: Math.round(430 * 0.75),
    jumperDodgePx: 95,
    doorTiles: 8,
    activatePx: 640,
    sleepPx: 900
  };

  function fieldsOf(inst) {
    const o = {};
    const list = inst && inst.fieldInstances;
    if (!list) return o;
    for (let i = 0; i < list.length; i++) o[list[i].__identifier] = list[i].__value;
    return o;
  }

  DK.ldtkFields = fieldsOf;

  DK.ldtkRecipeKey = function (stage, role, variant) { return stage + ':' + role + ':' + (variant || 0); };

  DK.ldtkVariants = function (project, stage, role) {
    const set = {};
    const levels = (project && project.levels) || [];
    for (let i = 0; i < levels.length; i++) {
      const f = fieldsOf(levels[i]);
      if (f.stage === stage && f.role === role) set[f.variant || 0] = true;
    }
    return Object.keys(set).map(Number).sort((a, b) => a - b);
  };

  // stage + room index → LDtk MapRole. Order matches DK.ROOMS / DK.STAGE2.rooms.
  DK.roomRole = function (stage, index) {
    if (stage === 2) return ['Canyon', 'Ruins', 'Depot', 'Oasis', 'BossDesert'][index] || 'Canyon';
    return ['Trench', 'Crater', 'Camp', 'Mine', 'Shop', 'Boss'][index] || 'Trench';
  };

  function layerById(level, id) {
    const layers = level.layerInstances || [];
    for (let i = 0; i < layers.length; i++) if (layers[i].__identifier === id) return layers[i];
    return null;
  }

  DK.composeLdtk = function (project, stage, role, variant) {
    if (!project || !project.levels) return null;
    const want = DK.ldtkRecipeKey(stage, role, variant || 0);
    const levels = [];
    for (let i = 0; i < project.levels.length; i++) {
      const L = project.levels[i];
      const f = fieldsOf(L);
      if (DK.ldtkRecipeKey(f.stage, f.role, f.variant || 0) === want) levels.push(L);
    }
    if (!levels.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < levels.length; i++) {
      const L = levels[i];
      if (L.worldX < minX) minX = L.worldX;
      if (L.worldY < minY) minY = L.worldY;
      if (L.worldX + L.pxWid > maxX) maxX = L.worldX + L.pxWid;
      if (L.worldY + L.pxHei > maxY) maxY = L.worldY + L.pxHei;
    }
    const worldW = maxX - minX, worldH = maxY - minY;
    const cols = worldW / TILE, rows = worldH / TILE;
    if (cols !== (cols | 0) || rows !== (rows | 0) || cols < 1 || rows < 1) return null;
    const solid = new Uint8Array(cols * rows);
    const ground = new Uint8Array(cols * rows);
    solid.fill(1);
    const ents = [];
    const pieces = [];
    for (let li = 0; li < levels.length; li++) {
      const L = levels[li];
      const f = fieldsOf(L);
      const ox = (L.worldX - minX) / TILE, oy = (L.worldY - minY) / TILE;
      if (ox !== (ox | 0) || oy !== (oy | 0)) return null;
      pieces.push({
        id: L.identifier, x: L.worldX - minX, y: L.worldY - minY, w: L.pxWid, h: L.pxHei,
        region: f.region || L.identifier, optional: !!f.optional
      });
      const col = layerById(L, 'Collisions'), grd = layerById(L, 'Ground');
      if (col && col.intGridCsv) {
        const cw = col.__cWid, ch = col.__cHei, csv = col.intGridCsv;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const gx = ox + x, gy = oy + y;
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          solid[gy * cols + gx] = csv[y * cw + x] ? 1 : 0;
        }
      }
      if (grd && grd.intGridCsv) {
        const cw = grd.__cWid, ch = grd.__cHei, csv = grd.intGridCsv;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const v = csv[y * cw + x] || 0;
          if (!v) continue;
          const gx = ox + x, gy = oy + y;
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          ground[gy * cols + gx] = v;
        }
      }
      const layers = L.layerInstances || [];
      for (let a = 0; a < layers.length; a++) {
        const list = layers[a].entityInstances || [];
        for (let b = 0; b < list.length; b++) {
          const e = list[b];
          ents.push({
            id: e.__identifier,
            x: (L.worldX - minX) + e.px[0],
            y: (L.worldY - minY) + e.px[1],
            w: e.width, h: e.height,
            fields: fieldsOf(e),
            level: L.identifier,
            optional: !!f.optional
          });
        }
      }
    }
    const map = {
      stage, role, variant: variant || 0,
      worldW, worldH, cols, rows, tile: TILE,
      solid, ground, pieces, entities: ents,
      player: null, exit: null, boss: null, merchant: null, rest: null, hostage: null,
      spawns: [], supplies: [], props: [], barrels: [],
      levelsUsed: levels.map(L => L.identifier)
    };
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.id === 'PlayerStart') map.player = { x: e.x, y: e.y };
      else if (e.id === 'Exit') map.exit = { x: e.x, y: e.y, w: e.w, h: e.h, rect: { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h } };
      else if (e.id === 'Boss') map.boss = { x: e.x, y: e.y };
      else if (e.id === 'Merchant') map.merchant = { x: e.x, y: e.y };
      else if (e.id === 'Rest') map.rest = { x: e.x, y: e.y };
      else if (e.id === 'Hostage') map.hostage = { x: e.x, y: e.y };
      else if (e.id === 'EnemySpawn') map.spawns.push({ x: e.x, y: e.y, kind: String(e.fields.kind || '').toLowerCase(), wave: e.fields.wave | 0, optional: e.optional });
      else if (e.id === 'Supply') map.supplies.push({ x: e.x, y: e.y, kind: e.fields.kind || 'Heal', optional: e.optional });
      else if (e.id === 'Prop') map.props.push({ x: e.x, y: e.y, prop: e.fields.prop, optional: e.optional });
      else if (e.id === 'Barrel') map.barrels.push({ x: e.x, y: e.y, optional: e.optional });
    }
    map.fits = function (x, y, r, solidArr) { return circleFits(solidArr || solid, cols, rows, x, y, r); };
    map.cellSolid = function (x, y, solidArr) {
      const s = solidArr || solid;
      const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return true;
      return !!s[cy * cols + cx];
    };
    map.nearest = function (x, y, r, solidArr) {
      if (map.fits(x, y, r, solidArr)) return { x, y };
      for (let d = 16; d <= 480; d += 16) for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        const p = { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
        if (map.fits(p.x, p.y, r, solidArr)) return p;
      }
      return { x, y };
    };
    return map;
  };

  function circleFits(solid, cols, rows, x, y, r) {
    const worldW = cols * TILE, worldH = rows * TILE;
    if (x - r < 1 || y - r < 1 || x + r > worldW - 1 || y + r > worldH - 1) return false;
    const x0 = Math.max(0, Math.floor((x - r) / TILE)), x1 = Math.min(cols - 1, Math.floor((x + r) / TILE));
    const y0 = Math.max(0, Math.floor((y - r) / TILE)), y1 = Math.min(rows - 1, Math.floor((y + r) / TILE));
    const rr = r * r - 0.25;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      if (!solid[cy * cols + cx]) continue;
      const left = cx * TILE, top = cy * TILE, right = left + TILE, bot = top + TILE;
      const nx = x < left ? left : x > right ? right : x;
      const ny = y < top ? top : y > bot ? bot : y;
      const dx = nx - x, dy = ny - y;
      if (dx * dx + dy * dy < rr) return false;
    }
    return true;
  }
  DK.circleFits = circleFits;

  // 4-connected BFS over cell centres that fit `radius`. solidArr defaults to the map grid.
  DK.ldtkReachable = function (map, radius, solidArr) {
    const solid = solidArr || map.solid, cols = map.cols, rows = map.rows;
    const seen = new Uint8Array(cols * rows);
    const q = [];
    if (!map.player) return { cells: seen, has: function () { return false; } };
    const sx = Math.floor(map.player.x / TILE), sy = Math.floor(map.player.y / TILE);
    const startOk = circleFits(solid, cols, rows, map.player.x, map.player.y, radius);
    if (startOk) { seen[sy * cols + sx] = 1; q.push(sx, sy); }
    const dirs = [1, 0, -1, 0, 0, 1, 0, -1];
    for (let qi = 0; qi < q.length; qi += 2) {
      const x = q[qi], y = q[qi + 1];
      for (let d = 0; d < 8; d += 2) {
        const nx = x + dirs[d], ny = y + dirs[d + 1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const i = ny * cols + nx;
        if (seen[i]) continue;
        const cx = nx * TILE + TILE / 2, cy = ny * TILE + TILE / 2;
        if (!circleFits(solid, cols, rows, cx, cy, radius)) continue;
        seen[i] = 1; q.push(nx, ny);
      }
    }
    return {
      cells: seen,
      has: function (x, y) {
        const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
        return !!seen[cy * cols + cx];
      }
    };
  };

  // Drop optional pieces (hidden branches) so the main path can be tested without them.
  DK.ldtkWithoutOptional = function (map) {
    const solid = map.solid.slice();
    const cols = map.cols;
    for (let i = 0; i < map.pieces.length; i++) {
      const p = map.pieces[i];
      if (!p.optional) continue;
      const x0 = p.x / TILE, y0 = p.y / TILE, x1 = (p.x + p.w) / TILE, y1 = (p.y + p.h) / TILE;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) solid[y * cols + x] = 1;
    }
    return solid;
  };

  DK.ldtkMergeRects = function (solid, cols, rows, tile) {
    tile = tile || TILE;
    const seen = new Uint8Array(cols * rows);
    const rects = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!solid[i] || seen[i]) continue;
      let w = 1;
      while (x + w < cols && solid[i + w] && !seen[i + w]) w++;
      let h = 1, ok = true;
      while (ok && y + h < rows) {
        for (let k = 0; k < w; k++) if (!solid[(y + h) * cols + x + k] || seen[(y + h) * cols + x + k]) { ok = false; break; }
        if (ok) h++;
      }
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) seen[(y + yy) * cols + x + xx] = 1;
      rects.push({ x: x * tile, y: y * tile, w: w * tile, h: h * tile });
    }
    return rects;
  };

  DK.worldBox = function (scene) {
    return { w: (scene && scene.worldW) || DK.W, h: (scene && scene.worldH) || DK.H };
  };

  DK.worldPointer = function (scene, pointer) {
    const cam = scene.cameras.main, z = cam.zoom || 1;
    return { x: pointer.x / z + cam.scrollX, y: pointer.y / z + cam.scrollY };
  };

  DK.snapCamera = function (scene) {
    const cam = scene.cameras.main, p = scene.player;
    if (!p || !scene.worldW) { cam.setScroll(0, 0); return; }
    const tx = clamp(p.x - DK.W / 2, 0, Math.max(0, scene.worldW - DK.W));
    const ty = clamp(p.y - DK.H / 2, 0, Math.max(0, scene.worldH - DK.H));
    cam.setScroll(tx, ty);
  };

  DK.followCamera = function (scene) {
    const cam = scene.cameras.main, p = scene.player;
    if (!p || !scene.worldW) return;
    const tx = clamp(p.x - DK.W / 2, 0, Math.max(0, scene.worldW - DK.W));
    const ty = clamp(p.y - DK.H / 2, 0, Math.max(0, scene.worldH - DK.H));
    cam.scrollX += (tx - cam.scrollX) * 0.14;
    cam.scrollY += (ty - cam.scrollY) * 0.14;
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---- Phaser build. No-op in node (no Phaser).
  DK.installLdtkRoom = function (scene, map, stage) {
    if (!map || typeof Phaser === 'undefined') return null;
    scene.map = map;
    scene.worldW = map.worldW;
    scene.worldH = map.worldH;
    scene._arenaRect = new Phaser.Geom.Rectangle(4, 4, map.worldW - 8, map.worldH - 8);
    if (scene.physics && scene.physics.world) scene.physics.world.setBounds(0, 0, map.worldW, map.worldH);
    scene.cameras.main.setBackgroundColor(stage === 2 ? '#1a140c' : '#14110e');
    const floor = bakeFloor(scene, map, stage);
    const walls = scene.physics.add.staticGroup();
    const wallKey = stage === 2 ? 'wall_desert' : 'wall';
    const rects = DK.ldtkMergeRects(map.solid, map.cols, map.rows, TILE);
    const ws = DK.artSize(wallKey);
    let wt = null;
    try { wt = scene.textures.get(wallKey).getSourceImage(); } catch (e) { wt = null; }
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const v = scene.add.tileSprite(r.x, r.y, r.w, r.h, wallKey).setOrigin(0).setDepth(-50);
      if (wt) v.setTileScale(ws[0] / wt.width, ws[1] / wt.height);
      walls.add(scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0x000000, 0));
    }
    let door = null;
    if (map.exit) {
      const rc = map.exit.rect;
      const img = scene.add.image(map.exit.x, map.exit.y, 'door').setDepth(-40);
      DK.applyArt(img, 'door');
      img.setDisplaySize(Math.max(28, rc.w), rc.h);
      const body = scene.add.rectangle(map.exit.x, map.exit.y, Math.max(28, rc.w), rc.h, 0, 0);
      walls.add(body);
      const arrow = DK.txt(scene, map.exit.x - 36, map.exit.y, '➜', { fontSize: '34px', color: '#7ee07a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(5).setVisible(false);
      arrow.setScrollFactor(1);
      door = { img, body, arrow, open: false, y0: rc.y, y1: rc.y + rc.h, rect: rc };
      door.setOpen = function (on) {
        if (on === door.open) return;
        door.open = on;
        img.setVisible(!on);
        arrow.setVisible(on);
        if (body.body) body.body.enable = !on;
        if (on) scene.tweens.add({ targets: arrow, x: arrow.x + 12, yoyo: true, repeat: -1, duration: 420 });
      };
    }
    placeProps(scene, map);
    scene._regionsSeen = {};
    return { walls, door, floor, map, spawn: map.player || { x: 120, y: map.worldH / 2 } };
  };

  function bakeFloor(scene, map, stage) {
    const area = map.worldW * map.worldH;
    let scale = Math.min(DK.R || 1, 2);
    if (area * scale * scale > 6000000) scale = Math.max(1, Math.sqrt(6000000 / area));
    const rt = scene.add.renderTexture(0, 0, Math.max(1, Math.ceil(map.worldW * scale)), Math.max(1, Math.ceil(map.worldH * scale))).setOrigin(0).setScale(1 / scale).setDepth(-100);
    const keys = stage === 2
      ? ['floor_sand', 'floor_sand_b', 'floor_sand_c', 'floor_sand_d']
      : ['floor', 'floor_shop', 'tile_ground_grass_256'];
    const texOf = function (v) {
      const key = v === 2 ? keys[1] : v === 3 ? keys[2] : keys[0];
      const tex = (DK.ART[key] && DK.ART[key].tex) || key;
      return scene.textures.exists(tex) ? tex : (scene.textures.exists(keys[0]) ? ((DK.ART[keys[0]] && DK.ART[keys[0]].tex) || keys[0]) : null);
    };
    const stamp = scene.make.image({ x: 0, y: 0, key: texOf(1) || '__DEFAULT', add: false }).setOrigin(0);
    const step = 64;
    for (let y = 0; y < map.worldH; y += step) for (let x = 0; x < map.worldW; x += step) {
      const cx = Math.min(map.cols - 1, Math.floor((x + step / 2) / TILE));
      const cy = Math.min(map.rows - 1, Math.floor((y + step / 2) / TILE));
      const g = map.ground[cy * map.cols + cx];
      if (!g) continue;
      const key = texOf(g);
      if (!key) continue;
      stamp.setTexture(key);
      const dw = Math.min(step, map.worldW - x), dh = Math.min(step, map.worldH - y);
      stamp.setDisplaySize(dw * scale, dh * scale);
      rt.draw(stamp, x * scale, y * scale);
    }
    stamp.destroy();
    return rt;
  }

  function placeProps(scene, map) {
    const list = map.props || [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (DK.COVERS && DK.COVERS[p.prop] && scene.addCover) scene.addCover(p.x, p.y, p.prop);
      else if (DK.PROPS2 && DK.PROPS2[p.prop] && DK.addProp) DK.addProp(scene, p.x, p.y, p.prop);
    }
    const barrels = map.barrels || [];
    for (let i = 0; i < barrels.length; i++) if (scene.addBarrel) scene.addBarrel(barrels[i].x, barrels[i].y);
    scene.supplies = [];
    for (let i = 0; i < (map.supplies || []).length; i++) {
      const s = map.supplies[i];
      const key = s.kind === 'Grenade' ? 'icon_grenade' : 'icon_heal';
      const spr = scene.add.image(s.x, s.y, key);
      if (DK.applyArt) DK.applyArt(spr, key);
      spr.setDepth(s.y).setScale(0.55);
      scene.tweens.add({ targets: spr, y: s.y - 6, yoyo: true, repeat: -1, duration: 700 });
      scene.supplies.push({ x: s.x, y: s.y, kind: s.kind, spr, taken: false });
    }
  }

  DK.pickLdtkMap = function (run, roomIndex) {
    const project = DK.LDTK_PROJECT;
    if (!project || !run) return null;
    const stage = run.stage === 2 ? 2 : 1;
    const role = DK.roomRole(stage, roomIndex);
    const variants = DK.ldtkVariants(project, stage, role);
    if (!variants.length) return null;
    const seed = (run.mapSeed != null ? run.mapSeed : 1) >>> 0;
    const variant = variants[(seed + roomIndex * 3) % variants.length];
    run._mapPick = run._mapPick || {};
    run._mapPick[stage + ':' + roomIndex] = variant;
    return DK.composeLdtk(project, stage, role, variant);
  };

  if (typeof root.fetch === 'function' && root.document) {
    DK._ldtkReady = root.fetch('../maps/shell-rebirth.ldtk', { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (j) {
      if (j && j.jsonVersion && j.levels && j.levels.length) { DK.LDTK_PROJECT = j; DK._ldtkFrom = 'fetch'; }
      else DK._ldtkFrom = 'embed';
      return DK.LDTK_PROJECT || null;
    }).catch(function () { DK._ldtkFrom = 'embed'; return DK.LDTK_PROJECT || null; });
  }
})(typeof window !== 'undefined' ? window : globalThis);

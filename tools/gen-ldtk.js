#!/usr/bin/env node
// Build maps/shell-rebirth.ldtk (LDtk 1.5.3) from authored room modules.
// Re-running overwrites the project. After a hand edit, use tools/export-ldtk.js
// (validate + refresh game/src/ldtk-data.js) instead of this generator.
'use strict';
const fs = require('fs');
const path = require('path');

const TILE = 32, DOOR = 8, H = 20;
const ROOT = path.resolve(__dirname, '..');

function doorSpan(total) {
  const a = Math.floor((total - DOOR) / 2);
  const list = [];
  for (let i = 0; i < DOOR; i++) list.push(a + i);
  return list;
}
const ROWS = doorSpan(H);

function iid(n) {
  const h = n.toString(16).padStart(12, '0');
  return 'a1d00000-0000-4000-8000-' + h;
}

let uid = 1;
const nextUid = () => uid++;

// ---- grid -----------------------------------------------------------------
function Grid(w, h, mode) {
  this.w = w; this.h = h || H; this.mode = mode || 'open';
  this.solid = Array.from({ length: this.h }, () => Array(this.w).fill(false));
  this.ground = Array.from({ length: this.h }, () => Array(this.w).fill(1));
  this.doors = { n: false, e: false, s: false, w: false };
  this.entities = [];
  for (let x = 0; x < this.w; x++) { this.solid[0][x] = true; this.solid[this.h - 1][x] = true; }
  for (let y = 0; y < this.h; y++) { this.solid[y][0] = true; this.solid[y][this.w - 1] = true; }
}
Grid.prototype.open = function (sides) {
  const rows = doorSpan(this.h), cols = doorSpan(this.w);
  if (sides.includes('n')) { this.doors.n = true; for (const x of cols) this.solid[0][x] = false; }
  if (sides.includes('s')) { this.doors.s = true; for (const x of cols) this.solid[this.h - 1][x] = false; }
  if (sides.includes('w')) { this.doors.w = true; for (const y of rows) this.solid[y][0] = false; }
  if (sides.includes('e')) { this.doors.e = true; for (const y of rows) this.solid[y][this.w - 1] = false; }
  return this;
};
Grid.prototype.sacred = function () {
  const s = Array.from({ length: this.h }, () => Array(this.w).fill(false));
  const rows = doorSpan(this.h), cols = doorSpan(this.w);
  if (this.doors.w || this.doors.e) for (const y of rows) for (let x = 0; x < this.w; x++) s[y][x] = true;
  if (this.doors.n || this.doors.s) for (const x of cols) for (let y = 0; y < this.h; y++) s[y][x] = true;
  return s;
};
Grid.prototype.shape = function () {
  const sac = this.sacred();
  const setSolid = (x, y, on) => { if (x <= 0 || y <= 0 || x >= this.w - 1 || y >= this.h - 1) return; if (sac[y][x]) return; this.solid[y][x] = on; };
  if (this.mode === 'trench' || this.mode === 'canyon') {
    for (let y = 1; y < this.h - 1; y++) for (let x = 1; x < this.w - 1; x++) if (!sac[y][x]) this.solid[y][x] = true;
    const y0 = this.mode === 'canyon' ? 3 : 2, y1 = this.mode === 'canyon' ? this.h - 4 : 5;
    const x0 = 3, x1 = this.w - 4;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setSolid(x, y, false);
    if (this.mode === 'trench') {
      for (let y = this.h - 6; y <= this.h - 3; y++) for (let x = 4; x <= this.w - 5; x++) setSolid(x, y, false);
    }
  } else if (this.mode === 'endroom') {
    for (let y = 1; y < this.h - 1; y++) for (let x = 1; x < this.w - 1; x++) if (!sac[y][x]) this.solid[y][x] = true;
    for (let y = this.h - 6; y <= this.h - 2; y++) for (let x = 2; x <= this.w - 3; x++) setSolid(x, y, false);
  } else if (this.mode === 'ruins') {
    const blocks = [[3, 3, 2, 4], [this.w - 6, 4, 3, 2], [5, this.h - 6, 4, 2]];
    for (const [x, y, w, h] of blocks) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setSolid(xx, yy, true);
  } else if (this.mode === 'boss') {
    for (const [x, y] of [[3, 8], [4, 8], [3, 9], [this.w - 5, 8], [this.w - 4, 8], [this.w - 5, 9]]) setSolid(x, y, true);
  }
  // path colour on the sacred lane, accent in open bays, dirt/sand elsewhere
  for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
    if (this.solid[y][x]) { this.ground[y][x] = 0; continue; }
    this.ground[y][x] = sac[y][x] ? 2 : ((x + y) % 7 === 0 ? 3 : 1);
  }
  return this;
};
Grid.prototype.center = function (x, y) { return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }; };
Grid.prototype.fits = function (x, y, r) {
  const c = this.center(x, y);
  const x0 = Math.floor((c.x - r) / TILE), x1 = Math.floor((c.x + r) / TILE);
  const y0 = Math.floor((c.y - r) / TILE), y1 = Math.floor((c.y + r) / TILE);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    if (cy < 0 || cx < 0 || cy >= this.h || cx >= this.w || this.solid[cy][cx]) {
      const left = cx * TILE, top = cy * TILE;
      const nx = c.x < left ? left : c.x > left + TILE ? left + TILE : c.x;
      const ny = c.y < top ? top : c.y > top + TILE ? top + TILE : c.y;
      if ((nx - c.x) ** 2 + (ny - c.y) ** 2 < r * r - 0.25) return false;
    }
  }
  return c.x - r > 1 && c.y - r > 1 && c.x + r < this.w * TILE - 1 && c.y + r < this.h * TILE - 1;
};
Grid.prototype.add = function (kind, x, y, extra) {
  const c = this.center(x, y);
  this.entities.push(Object.assign({ kind, cx: c.x, cy: c.y, tw: 32, th: 32 }, extra || {}));
  return this;
};
Grid.prototype.placeSpawns = function (spec, wave, radii) {
  const cells = [];
  for (let y = 2; y < this.h - 2; y++) for (let x = 3; x < this.w - 3; x++) {
    if (this.solid[y][x]) continue;
    cells.push({ x, y });
  }
  const kinds = [];
  for (const [k, n] of Object.entries(spec)) for (let i = 0; i < n; i++) kinds.push(k);
  const used = [];
  for (const kind of kinds) {
    const r = (radii[kind] || 14) + 6;
    let best = null, bestScore = -1;
    for (const c of cells) {
      if (!this.fits(c.x, c.y, r)) continue;
      let minD = 1e9;
      for (const u of used) minD = Math.min(minD, Math.hypot(c.x - u.x, c.y - u.y));
      if (used.length && minD < 3) continue;
      // prefer the far side of the room (higher x, then lower y) so the player meets them after the door
      const edge = Math.min(c.x, this.w - 1 - c.x, c.y, this.h - 1 - c.y);
      const score = minD * 3 + edge;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best) throw new Error('no spawn cell for ' + kind + ' wave ' + wave + ' in ' + this.w + 'x' + this.h + ' ' + this.mode);
    used.push(best);
    this.add('EnemySpawn', best.x, best.y, { wave, enemy: kind });
  }
  return this;
};
Grid.prototype.dress = function (prop, pred) {
  for (let y = 1; y < this.h - 1; y++) for (let x = 1; x < this.w - 1; x++) {
    if (this.solid[y][x]) continue;
    if (pred && !pred(x, y)) continue;
    const c = this.center(x, y);
    if (this.entities.some(e => Math.hypot(e.cx - c.x, e.cy - c.y) < 88)) continue;
    this.add('Prop', x, y, { prop });
    return true;
  }
  return false;
};
Grid.prototype.tryProp = function (kind, x, y, extra) {
  if (this.fits(x, y, 18)) this.add(kind, x, y, extra);
  return this;
};
Grid.prototype.placeCover = function (prop) {
  const rows = doorSpan(this.h);
  const lane = new Set(rows);
  for (let y = 2; y < this.h - 2; y++) {
    if (lane.has(y)) continue;
    for (let x = 3; x < this.w - 3; x++) {
      if (this.solid[y][x] || !this.fits(x, y, 28)) continue;
      let near = false;
      for (const e of this.entities) {
        if (Math.hypot(e.cx - (x * TILE + 16), e.cy - (y * TILE + 16)) < 70) near = true;
      }
      if (near) continue;
      this.add('Prop', x, y, { prop });
      return true;
    }
  }
  return false;
};

let partN = 1;
function piece(w, h, mode, sides, region, extra) {
  extra = extra || {};
  const g = new Grid(w, h, mode).open(sides).shape();
  g.region = region;
  g.key = extra.key || ('M' + (partN++));
  g.optional = !!extra.optional;
  g.exit = !!extra.exit;
  g.exitSide = extra.exit ? (extra.exitSide || 'e') : null;
  return g;
}

const R = {
  charger: 14, rifle: 14, sniper: 13, heavy: 20, camel: 22, jumper: 13, grenadier: 14
};

const WAVES = {
  Trench: [{ charger: 3, rifle: 1 }, { charger: 2, rifle: 2 }],
  Crater: [{ rifle: 2, sniper: 1, charger: 2 }, { heavy: 1, charger: 3 }],
  Camp: [{ rifle: 2, charger: 2, sniper: 1 }, { heavy: 1, rifle: 2 }],
  Mine: [{ heavy: 1, sniper: 2, rifle: 1 }, { charger: 4, heavy: 1, rifle: 2 }],
  Canyon: [{ charger: 3, rifle: 1, jumper: 1 }, { jumper: 2, grenadier: 1, charger: 1 }, { charger: 3, rifle: 2, grenadier: 1 }],
  Ruins: [{ camel: 1, rifle: 2 }, { camel: 1, jumper: 1, grenadier: 1 }, { jumper: 2, rifle: 2, charger: 1 }],
  Depot: [{ grenadier: 2, jumper: 1, heavy: 1 }, { camel: 1, jumper: 2, grenadier: 1 }, { rifle: 2, jumper: 1 }],
  Oasis: [{ jumper: 1, grenadier: 1, charger: 1 }, { camel: 1, rifle: 1 }]
};

function cacheSupplies(g) {
  // two pickups in the end room, off the corridor centre line
  const y = g.h - 4;
  g.add('Supply', 3, y, { supply: 'Heal', kind: 'Supply' });
  g.add('Supply', g.w - 4, y, { supply: 'Grenade', kind: 'Supply' });
}

function buildRole(role) {
  if (role === 'Trench') {
    const entry = piece(16, H, 'trench', 'e', '出发壕');
    entry.add('PlayerStart', 3, ROWS[3]);
    const a = piece(24, H, 'trench', 'wes', '主壕交火');
    a.placeSpawns(WAVES.Trench[0], 1, R);
    a.placeCover('cover_sandbags'); a.placeCover('cover_crate_wood');
    const rest = piece(14, H, 'trench', 'we', '喘息壕', { key: 'Rest' });
    rest.placeCover('cover_crate_ammo');
    const b = piece(24, H, 'trench', 'we', '第二道防线', { key: 'FightB' });
    b.placeSpawns(WAVES.Trench[1], 2, R);
    b.placeCover('cover_concrete_barrier');
    b.tryProp('Barrel', 6, 4);
    const exit = piece(14, H, 'trench', 'we', '闸门', { exit: true, key: 'Exit' });
    const cache = piece(16, 14, 'endroom', 'n', '隐藏弹药库', { optional: true });
    cacheSupplies(cache);
    return layout([[entry, a, rest, b, exit], [null, cacheAlign(a, cache), null, null, null]]);
  }
  if (role === 'Crater') {
    const entry = piece(16, H, 'open', 'e', '坑缘入口');
    entry.add('PlayerStart', 3, ROWS[3]);
    const bowl = piece(28, H, 'open', 'wens', '主弹坑');
    bowl.placeSpawns(WAVES.Crater[0], 1, R);
    bowl.placeCover('cover_sandbags'); bowl.placeCover('obstacle_tires'); bowl.placeCover('cover_brick_wall_broken');
    const rim = piece(16, H, 'open', 'ws', '坑沿喘息');
    rim.placeCover('cover_crate_ammo');
    const pocket = piece(28, H, 'ruins', 'ne', '坑底');
    pocket.placeSpawns(WAVES.Crater[1], 2, R);
    pocket.placeCover('cover_concrete_barrier'); pocket.add('Barrel', 8, 4);
    const exit = piece(16, H, 'open', 'wne', '坑道出口', { exit: true, key: 'Exit' });
    const cache = piece(16, 14, 'endroom', 's', '坑壁暗仓', { optional: true });
    cacheSupplies(cache);
    // row0: entry bowl rim, row1: cache(above) is negative — handled by cacheNorth
    return stackCrater(entry, bowl, rim, pocket, exit, cache);
  }
  if (role === 'Camp') {
    const entry = piece(16, H, 'trench', 'es', '营门');
    entry.add('PlayerStart', 3, ROWS[3]);
    const yard = piece(26, H, 'open', 'wes', '俘虏营');
    yard.placeSpawns(WAVES.Camp[0], 1, R);
    yard.add('Hostage', yard.w - 5, ROWS[2]);
    yard.placeCover('cover_sandbags'); yard.placeCover('cover_crate_wood');
    const pen = piece(16, H, 'endroom', 'w', '人质棚');
    pen.add('Hostage', 8, 10);
    // hostage lives in the pen; remove the yard one if pen exists — keep pen only
    yard.entities = yard.entities.filter(e => e.kind !== 'Hostage');
    const lane = piece(26, H, 'ruins', 'ne', '营地巷战');
    lane.placeSpawns(WAVES.Camp[1], 2, R);
    lane.placeCover('cover_concrete_barrier'); lane.add('Barrel', 6, 16);
    const exit = piece(16, H, 'trench', 'we', '营后出口', { exit: true, key: 'Exit' });
    const cache = piece(16, 14, 'endroom', 'n', '暗补给', { optional: true });
    cacheSupplies(cache);
    return layout([
      [entry, yard, pen],
      [cacheAlign(entry, cache), lane, exitAlign(lane, exit)]
    ]);
  }
  if (role === 'Mine') {
    const entry = piece(16, H, 'trench', 'es', '雷区入口');
    entry.add('PlayerStart', 3, ROWS[3]);
    const lane = piece(22, H, 'trench', 'ws', '雷带');
    lane.placeSpawns(WAVES.Mine[0], 1, R);
    lane.placeCover('obstacle_tank_hedgehog'); lane.placeCover('cover_sandbags');
    const sw = piece(22, H, 'trench', 'ne', '折返战壕');
    sw.placeSpawns(WAVES.Mine[1], 2, R);
    sw.placeCover('cover_concrete_barrier'); sw.add('Barrel', 5, 4); sw.add('Barrel', sw.w - 5, 16);
    const rest = piece(14, H, 'trench', 'we', '喘息点');
    const exit = piece(14, H, 'trench', 'we', '雷区出口', { exit: true, key: 'Exit' });
    const cache = piece(16, 14, 'endroom', 'n', '侧壕补给', { optional: true });
    cacheSupplies(cache);
    return layout([
      [entry, lane],
      [cacheAlign(entry, cache), sw, rest, exit]
    ]);
  }
  if (role === 'Shop') {
    const yard = piece(18, H, 'open', 'e', '交易院');
    yard.add('PlayerStart', 4, ROWS[3]);
    const stall = piece(18, H, 'open', 'we', '摊位', { exit: true, key: 'Stall' });
    stall.add('Merchant', 8, 8);
    stall.add('Rest', 8, 13);
    stall.placeCover('cover_crate_ammo');
    return layout([[yard, stall]]);
  }
  if (role === 'Boss') {
    const g = piece(48, 18, 'boss', '', '铁砧场');
    g.add('PlayerStart', 24, 14);
    g.add('Boss', 24, 6);
    g.placeCover('cover_concrete_barrier');
    g.placeCover('cover_sandbags');
    return layout([[g]]);
  }
  if (role === 'Canyon') {
    const mouth = piece(16, H, 'canyon', 'es', '谷口');
    mouth.add('PlayerStart', 3, ROWS[3]);
    const slot = piece(24, H, 'canyon', 'wes', '窄谷');
    slot.placeSpawns(WAVES.Canyon[0], 1, R);
    slot.placeCover('s2_rocks');
    const rest = piece(14, H, 'endroom', 'w', '岩架');
    rest.add('Prop', 7, 10, { prop: 's2_cactus_tall' });
    const lower = piece(24, H, 'canyon', 'ns', '谷底');
    lower.placeSpawns(WAVES.Canyon[1], 2, R);
    lower.placeCover('s2_rocks'); lower.placeCover('s2_cactus_cluster');
    const spur = piece(24, H, 'canyon', 'ne', '谷深处');
    spur.placeSpawns(WAVES.Canyon[2], 3, R);
    spur.placeCover('s2_rocks');
    const exit = piece(14, H, 'canyon', 'we', '谷道出口', { exit: true, key: 'Exit' });
    const cache = piece(16, 14, 'endroom', 'n', '岩缝', { optional: true });
    cacheSupplies(cache);
    cache.add('Prop', 8, 10, { prop: 's2_bones_skull' });
    return layout([
      [mouth, slot, rest],
      [cacheAlign(mouth, cache), lower],
      [null, spur, exit]
    ]);
  }
  if (role === 'Ruins') {
    const gate = piece(16, H, 'ruins', 'e', '残门');
    gate.add('PlayerStart', 3, ROWS[4]);
    const court = piece(26, H, 'ruins', 'wens', '废墟庭院', { key: 'Court' });
    court.placeSpawns(WAVES.Ruins[0], 1, R);
    court.placeCover('cover_brick_wall_broken'); court.placeCover('s2_rocks');
    court.add('Prop', 6, 4, { prop: 's2_bones_scatter' });
    const rest = piece(14, H, 'open', 'w', '帐篷喘息');
    rest.add('Prop', 7, 8, { prop: 's2_tent' });
    rest.add('Prop', 7, 14, { prop: 's2_dune_small' });
    const hall = piece(26, H, 'ruins', 'ns', '残厅');
    hall.placeSpawns(WAVES.Ruins[1], 2, R);
    hall.placeCover('cover_brick_wall_broken'); hall.placeCover('s2_cactus_tall');
    const yard = piece(26, H, 'ruins', 'ne', '废墟后院');
    yard.placeSpawns(WAVES.Ruins[2], 3, R);
    yard.placeCover('s2_rocks'); yard.add('Barrel', 8, 4);
    const exit = piece(14, H, 'ruins', 'we', '废墟出口', { exit: true, key: 'Exit' });
    const cache = piece(16, 14, 'endroom', 's', '倒塌暗室', { optional: true });
    cacheSupplies(cache);
    return stackRuins(gate, court, rest, hall, yard, exit, cache);
  }
  if (role === 'Depot') {
    const entry = piece(16, H, 'open', 'es', '罐场入口', { key: 'Entry' });
    entry.add('PlayerStart', 3, ROWS[3]);
    const row = piece(26, H, 'open', 'wes', '油罐巷');
    row.placeSpawns(WAVES.Depot[0], 1, R);
    row.dress('s2_oil_tank', (x, y) => y <= 3);
    row.dress('s2_oil_tank', (x, y) => y <= 3 && x > row.w / 2);
    row.dress('s2_oil_drum', (x, y) => y >= row.h - 4);
    const rest = piece(14, H, 'open', 'w', '罐间喘息');
    rest.add('Prop', 7, 10, { prop: 's2_supplies' });
    const yard = piece(26, H, 'open', 'ns', '掷弹空地');
    yard.placeSpawns(WAVES.Depot[1], 2, R);
    yard.dress('s2_oil_drum', (x, y) => y <= 4);
    yard.dress('s2_oil_tank', (x, y) => y >= yard.h - 4);
    const lane = piece(26, H, 'open', 'ne', '驼道');
    lane.placeSpawns(WAVES.Depot[2], 3, R);
    lane.dress('s2_dune_large', (x, y) => y <= 3);
    lane.placeCover('s2_cactus_cluster');
    const exit = piece(14, H, 'open', 'we', '罐场出口', { exit: true, key: 'Exit' });
    const cache = piece(16, 14, 'endroom', 'n', '备用油桶', { optional: true });
    cacheSupplies(cache);
    cache.add('Prop', 8, 9, { prop: 's2_oil_drum' });
    return layout([
      [entry, row, rest],
      [cacheAlign(entry, cache), yard],
      [null, lane, exit]
    ]);
  }
  if (role === 'Oasis') {
    const gate = piece(16, H, 'open', 'es', '营地门');
    gate.add('PlayerStart', 3, ROWS[3]);
    const yard = piece(26, H, 'open', 'wes', '沙丘营地');
    yard.placeSpawns(WAVES.Oasis[0], 1, R);
    yard.add('Hostage', 18, 6);
    yard.add('Merchant', 10, 8);
    yard.add('Rest', 10, 14);
    yard.add('Prop', 6, 4, { prop: 's2_tent' });
    yard.add('Prop', 20, 15, { prop: 's2_tent' });
    yard.placeCover('s2_supplies');
    const annex = piece(26, H, 'open', 'n', '营地外圈');
    annex.placeSpawns(WAVES.Oasis[1], 2, R);
    annex.add('Prop', 8, 10, { prop: 's2_dune_small' });
    annex.placeCover('s2_cactus_tall');
    const exit = piece(14, H, 'open', 'we', '营地出口', { exit: true, key: 'Exit' });
    const cache = piece(16, 14, 'endroom', 'n', '补给帐', { optional: true });
    cacheSupplies(cache);
    cache.add('Prop', 8, 9, { prop: 's2_supplies' });
    return layout([
      [gate, yard, exit],
      [cacheAlign(gate, cache), annex]
    ]);
  }
  if (role === 'BossDesert') {
    const g = piece(48, 18, 'boss', '', '沙鲸坑');
    g.add('PlayerStart', 24, 14);
    g.add('Boss', 24, 6);
    g.add('Prop', 8, 10, { prop: 's2_rocks' });
    g.add('Prop', 40, 10, { prop: 's2_rocks' });
    g.add('Prop', 12, 4, { prop: 's2_dune_small' });
    g.add('Prop', 36, 4, { prop: 's2_dune_small' });
    return layout([[g]]);
  }
  throw new Error(role);
}

function cacheAlign(parent, cache) {
  // returned as a piece already positioned relative to parent by layout() if we encode dx
  cache._attach = { to: parent, side: cache.doors.n ? 's' : 'n' };
  return cache;
}
function exitAlign(lane, exit) { return exit; }

function layout(rows) {
  // Column widths are the max piece width in that column so a lower row lines up
  // with the piece above it (south doors meet north doors of the same width).
  const colsN = Math.max(...rows.map(r => r.length));
  const colW = Array(colsN).fill(0);
  for (const row of rows) for (let i = 0; i < row.length; i++) {
    const p = row[i];
    if (p && !p._attach) colW[i] = Math.max(colW[i], p.w);
  }
  const placed = [];
  const pending = [];
  let y = 0;
  for (const row of rows) {
    let x = 0, rowH = 0;
    for (let i = 0; i < colsN; i++) {
      const p = row[i];
      if (p && p._attach) pending.push(p);
      else if (p) { p.tx = x; p.ty = y; placed.push(p); rowH = Math.max(rowH, p.h); }
      x += colW[i];
    }
    y += rowH;
  }
  for (const p of pending) {
    const host = p._attach.to;
    const cols = doorSpan(host.w);
    const ccols = doorSpan(p.w);
    if (p._attach.side === 's') {
      p.tx = host.tx + cols[0] - ccols[0];
      p.ty = host.ty + host.h;
    } else {
      p.tx = host.tx + cols[0] - ccols[0];
      p.ty = host.ty - p.h;
    }
    placed.push(p);
  }
  return placed;
}

function stackCrater(entry, bowl, rim, pocket, exit, cache) {
  entry.tx = 0; entry.ty = 0;
  bowl.tx = entry.w; bowl.ty = 0;
  rim.tx = bowl.tx + bowl.w; rim.ty = 0;
  pocket.tx = bowl.tx; pocket.ty = H;
  exit.tx = pocket.tx + pocket.w; exit.ty = H;
  const cols = doorSpan(bowl.w), ccols = doorSpan(cache.w);
  cache.tx = bowl.tx + cols[0] - ccols[0];
  cache.ty = -cache.h;
  return [entry, bowl, rim, pocket, exit, cache];
}
function stackRuins(gate, court, rest, hall, yard, exit, cache) {
  gate.tx = 0; gate.ty = 0;
  court.tx = gate.w; court.ty = 0;
  rest.tx = court.tx + court.w; rest.ty = 0;
  hall.tx = court.tx; hall.ty = H;
  yard.tx = court.tx; yard.ty = H * 2;
  exit.tx = yard.tx + yard.w; exit.ty = H * 2;
  const cols = doorSpan(court.w), ccols = doorSpan(cache.w);
  cache.tx = court.tx + cols[0] - ccols[0];
  cache.ty = -cache.h;
  return [gate, court, rest, hall, yard, exit, cache];
}

function flipPiece(p) {
  const g = new Grid(p.w, p.h, p.mode);
  g.doors = { n: p.doors.n, s: p.doors.s, e: p.doors.w, w: p.doors.e };
  g.region = p.region; g.key = p.key; g.optional = p.optional; g.exit = p.exit;
  g.exitSide = p.exitSide === 'e' ? 'w' : p.exitSide === 'w' ? 'e' : p.exitSide;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    g.solid[y][p.w - 1 - x] = p.solid[y][x];
    g.ground[y][p.w - 1 - x] = p.ground[y][x];
  }
  const Wpx = p.w * TILE;
  for (const e of p.entities) {
    g.entities.push(Object.assign({}, e, { cx: Wpx - e.cx }));
  }
  g.tx = p.tx; g.ty = p.ty;
  return g;
}
function mirrorLayout(pieces) {
  let maxX = 0;
  for (const p of pieces) maxX = Math.max(maxX, p.tx + p.w);
  return pieces.map(p => {
    const f = flipPiece(p);
    f.tx = maxX - (p.tx + p.w);
    f.ty = p.ty;
    return f;
  });
}

// ---- LDtk document --------------------------------------------------------
const ENUM_UID = { MapRole: nextUid(), EnemyKind: nextUid(), SupplyKind: nextUid(), PropKind: nextUid() };
const LAYER_UID = { Ground: nextUid(), Collisions: nextUid(), Decor: nextUid(), Gameplay: nextUid() };
const ENT_UID = {
  PlayerStart: nextUid(), Exit: nextUid(), EnemySpawn: nextUid(), Merchant: nextUid(),
  Rest: nextUid(), Boss: nextUid(), Hostage: nextUid(), Supply: nextUid(), Prop: nextUid(), Barrel: nextUid()
};
const FIELD_UID = {
  stage: nextUid(), role: nextUid(), variant: nextUid(), optional: nextUid(), region: nextUid(),
  kind: nextUid(), wave: nextUid(), supply: nextUid(), prop: nextUid()
};

const PROPS = [
  'cover_sandbags', 'cover_concrete_barrier', 'cover_brick_wall_broken', 'cover_crate_wood', 'cover_crate_ammo',
  'obstacle_tank_hedgehog', 'obstacle_tires',
  's2_dune_large', 's2_dune_small', 's2_bones_scatter', 's2_bones_skull', 's2_sign',
  's2_cactus_tall', 's2_cactus_cluster', 's2_oil_tank', 's2_oil_drum', 's2_supplies', 's2_rocks', 's2_tent'
];
const ROLES = ['Trench', 'Crater', 'Camp', 'Mine', 'Shop', 'Boss', 'Canyon', 'Ruins', 'Depot', 'Oasis', 'BossDesert'];
const ENEMIES = ['charger', 'rifle', 'sniper', 'heavy', 'camel', 'jumper', 'grenadier'];

function enumDef(name, values) {
  return {
    identifier: name, uid: ENUM_UID[name],
    values: values.map((id, i) => ({ id, tileRect: null, color: 0x8D6E4C + i * 97, __tileSrcRect: null })),
    iconTilesetUid: null, externalRelPath: null, externalFileChecksum: null, tags: []
  };
}
function intField(id, uid, doc) { return field(id, uid, 'Int', 'F_Int', doc); }
function boolField(id, uid, doc) { return field(id, uid, 'Bool', 'F_Bool', doc); }
function strField(id, uid, doc) { return field(id, uid, 'String', 'F_String', doc); }
function enumField(id, uid, enumName, doc) {
  return field(id, uid, 'LocalEnum.' + enumName, 'F_Enum(' + ENUM_UID[enumName] + ')', doc);
}
function field(id, uid, type, ftype, doc) {
  return {
    identifier: id, doc: doc || null, __type: type, uid, type: ftype,
    isArray: false, canBeNull: false, arrayMinLength: null, arrayMaxLength: null,
    editorDisplayMode: 'NameAndValue', editorDisplayScale: 1, editorDisplayPos: 'Above',
    editorLinkStyle: 'StraightArrow', editorDisplayColor: null, editorAlwaysShow: true,
    editorShowInWorld: true, editorCutLongValues: true, editorTextSuffix: null, editorTextPrefix: null,
    useForSmartColor: false, exportToToc: false, searchable: false,
    min: null, max: null, regex: null, acceptFileTypes: null, defaultOverride: null,
    textLanguageMode: null, symmetricalRef: false, autoChainRef: false, allowOutOfLevelRef: false,
    allowedRefs: 'Any', allowedRefsEntityUid: null, allowedRefTags: [], tilesetUid: null
  };
}
function entityDef(name, color, w, h, fieldDefs, doc) {
  return {
    identifier: name, uid: ENT_UID[name], tags: [], exportToToc: false, allowOutOfBounds: false,
    doc: doc || null, width: w, height: h, resizableX: true, resizableY: true,
    minWidth: null, maxWidth: null, minHeight: null, maxHeight: null, keepAspectRatio: false,
    tileOpacity: 1, fillOpacity: 0.24, lineOpacity: 1, hollow: false, color,
    renderMode: 'Rectangle', showName: true, tilesetId: null, tileRenderMode: 'Cover',
    tileRect: null, uiTileRect: null, nineSliceBorders: [], maxCount: 0, limitScope: 'PerLevel',
    limitBehavior: 'MoveLastOne', pivotX: 0.5, pivotY: 0.5, fieldDefs
  };
}
function layerDef(name, type, values) {
  return {
    __type: type, identifier: name, type, uid: LAYER_UID[name],
    doc: name === 'Collisions' ? '1 = 墙。0 = 可走。门洞留 0。' : name === 'Ground' ? '1 土地/沙，2 主路，3 点缀。0 不铺（虚空）。' : null,
    uiColor: name === 'Collisions' ? '#E4A672' : name === 'Ground' ? '#8D6E4C' : '#7EE07A',
    gridSize: TILE, guideGridWid: 0, guideGridHei: 0, displayOpacity: 1, inactiveOpacity: 0.5,
    hideInList: false, hideFieldsWhenInactive: false, canSelectWhenInactive: true, renderInWorldView: true,
    pxOffsetX: 0, pxOffsetY: 0, parallaxFactorX: 0, parallaxFactorY: 0, parallaxScaling: true,
    requiredTags: [], excludedTags: [], autoTilesKilledByOtherLayerUid: null, uiFilterTags: [],
    useAsyncRender: false, intGridValues: values, intGridValuesGroups: [], autoRuleGroups: [],
    autoSourceLayerDefUid: null, tilesetDefUid: null, tilePivotX: 0, tilePivotY: 0, biomeFieldUid: null
  };
}
function ig(value, identifier, color) {
  return { value, identifier, color, tile: null, groupUid: 0 };
}

function fieldInst(id, uid, type, value, editorId) {
  return {
    __identifier: id, __type: type, __value: value, __tile: null, defUid: uid,
    realEditorValues: [{ id: editorId, params: [value] }]
  };
}

let iidN = 1;
function levelOf(stage, role, variant, piece, worldX, worldY) {
  const id = 'S' + stage + '_' + role + '_V' + variant + '_' + (piece.key || 'Part') + (piece.optional ? '_Opt' : '');
  const csvC = [], csvG = [];
  for (let y = 0; y < piece.h; y++) for (let x = 0; x < piece.w; x++) {
    csvC.push(piece.solid[y][x] ? 1 : 0);
    csvG.push(piece.ground[y][x] || 0);
  }
  const entsG = [], entsD = [];
  for (const e of piece.entities) {
    const inst = entInst(e);
    if (e.kind === 'Prop' || e.kind === 'Barrel') entsD.push(inst);
    else entsG.push(inst);
  }
  if (piece.exit) {
    const rows = doorSpan(piece.h);
    const cy = ((rows[0] + rows[rows.length - 1]) / 2) * TILE + TILE / 2;
    const cx = (piece.exitSide === 'w' ? 0 : piece.w - 1) * TILE + TILE / 2;
    entsG.push(entInst({ kind: 'Exit', cx, cy, tw: TILE, th: DOOR * TILE }));
  }
  const L = {
    identifier: id.replace(/\s/g, ''),
    iid: iid(iidN++),
    uid: nextUid(),
    worldX, worldY, worldDepth: 0,
    pxWid: piece.w * TILE, pxHei: piece.h * TILE,
    __bgColor: stage === 2 ? '#C4A46A' : '#6B5A3E',
    bgColor: null, useAutoIdentifier: false, bgRelPath: null, bgPos: null,
    bgPivotX: 0.5, bgPivotY: 0.5, __smartColor: '#B7A48A', __bgPos: null,
    externalRelPath: null,
    fieldInstances: [
      fieldInst('stage', FIELD_UID.stage, 'Int', stage, 'V_Int'),
      fieldInst('role', FIELD_UID.role, 'LocalEnum.MapRole', role, 'V_String'),
      fieldInst('variant', FIELD_UID.variant, 'Int', variant, 'V_Int'),
      fieldInst('optional', FIELD_UID.optional, 'Bool', !!piece.optional, 'V_Bool'),
      fieldInst('region', FIELD_UID.region, 'String', piece.region, 'V_String')
    ],
    layerInstances: [
      layerInst('Gameplay', 'Entities', LAYER_UID.Gameplay, piece.w, piece.h, [], entsG),
      layerInst('Decor', 'Entities', LAYER_UID.Decor, piece.w, piece.h, [], entsD),
      layerInst('Collisions', 'IntGrid', LAYER_UID.Collisions, piece.w, piece.h, csvC, []),
      layerInst('Ground', 'IntGrid', LAYER_UID.Ground, piece.w, piece.h, csvG, [])
    ],
    __neighbours: []
  };
  return L;
}
function layerInst(name, type, uid, w, h, csv, ents) {
  return {
    __identifier: name, __type: type, __cWid: w, __cHei: h, __gridSize: TILE, __opacity: 1,
    __pxTotalOffsetX: 0, __pxTotalOffsetY: 0, __tilesetDefUid: null, __tilesetRelPath: null,
    iid: iid(iidN++), levelId: 0, layerDefUid: uid, pxOffsetX: 0, pxOffsetY: 0,
    visible: true, optionalRules: [], intGridCsv: csv, autoLayerTiles: [], seed: uid * 17 + w,
    overrideTilesetUid: null, gridTiles: [], entityInstances: ents, intGrid: null
  };
}
function entInst(e) {
  const def = ENT_UID[e.kind];
  const w = e.tw || 32, h = e.th || 32;
  const fields = [];
  if (e.kind === 'EnemySpawn') {
    fields.push(fieldInst('kind', FIELD_UID.kind, 'LocalEnum.EnemyKind', e.enemy, 'V_String'));
    fields.push(fieldInst('wave', FIELD_UID.wave, 'Int', e.wave, 'V_Int'));
  } else if (e.kind === 'Supply') {
    fields.push(fieldInst('kind', FIELD_UID.supply, 'LocalEnum.SupplyKind', e.supply, 'V_String'));
  } else if (e.kind === 'Prop') {
    fields.push(fieldInst('prop', FIELD_UID.prop, 'LocalEnum.PropKind', e.prop, 'V_String'));
  }
  return {
    __identifier: e.kind, __grid: [Math.floor(e.cx / TILE), Math.floor(e.cy / TILE)],
    __pivot: [0.5, 0.5], __tags: [], __tile: null, __smartColor: '#FFFFFF',
    iid: iid(iidN++), width: w, height: h, defUid: def, px: [Math.round(e.cx), Math.round(e.cy)],
    fieldInstances: fields
  };
}

function project() {
  const levels = [];
  const stageOf = {
    Trench: 1, Crater: 1, Camp: 1, Mine: 1, Shop: 1, Boss: 1,
    Canyon: 2, Ruins: 2, Depot: 2, Oasis: 2, BossDesert: 2
  };
  let cursorY = 0;
  for (const role of ROLES) {
    const base = buildRole(role);
    const variants = role === 'Boss' || role === 'BossDesert' ? [base] : [base, mirrorLayout(base)];
    variants.forEach((pieces, variant) => {
      let minX = Infinity, minY = Infinity;
      for (const p of pieces) { minX = Math.min(minX, p.tx); minY = Math.min(minY, p.ty); }
      let maxY = 0;
      for (const p of pieces) {
        const wx = (p.tx - minX) * TILE, wy = cursorY + (p.ty - minY) * TILE;
        levels.push(levelOf(stageOf[role], role, variant, p, wx, wy));
        maxY = Math.max(maxY, wy + p.h * TILE);
      }
      cursorY = maxY + 96;
    });
  }
  // fix levelId to the level uid
  for (const L of levels) for (const layer of L.layerInstances) layer.levelId = L.uid;

  return {
    __header__: {
      fileType: 'LDtk Project JSON', app: 'LDtk', doc: 'https://ldtk.io/json',
      schema: 'https://ldtk.io/files/JSON_SCHEMA.json',
      appAuthor: "Sebastien 'deepnight' Benard", appVersion: '1.5.3', url: 'https://ldtk.io'
    },
    iid: iid(900000),
    jsonVersion: '1.5.3',
    appBuildId: 473702,
    nextUid: uid + 10,
    identifierStyle: 'Free',
    toc: [],
    worldLayout: 'Free',
    worldGridWidth: TILE, worldGridHeight: TILE,
    defaultLevelWidth: 640, defaultLevelHeight: 640,
    defaultPivotX: 0, defaultPivotY: 0, defaultGridSize: TILE,
    defaultEntityWidth: 32, defaultEntityHeight: 32,
    bgColor: '#1D1D28', defaultLevelBgColor: '#2B241C',
    minifyJson: false, externalLevels: false, exportTiled: false, simplifiedExport: false,
    imageExportMode: 'None', exportLevelBg: false, pngFilePattern: null,
    backupOnSave: true, backupLimit: 10, backupRelPath: null,
    levelNamePattern: 'Level_%idx', tutorialDesc: null, customCommands: [], flags: [],
    defs: {
      layers: [
        layerDef('Gameplay', 'Entities', []),
        layerDef('Decor', 'Entities', []),
        layerDef('Collisions', 'IntGrid', [ig(1, 'Solid', '#5C5346')]),
        layerDef('Ground', 'IntGrid', [ig(1, 'Dirt', '#8A7048'), ig(2, 'Path', '#C4A46A'), ig(3, 'Accent', '#6E8F55')])
      ],
      entities: [
        entityDef('PlayerStart', '#7EE07A', 32, 32, [], '玩家出生点（脚点/中心）。每张拼好的地图只放一个。'),
        entityDef('Exit', '#F2C14E', 32, 256, [], '出口触发区。通关后走到这里进入下一房间。'),
        entityDef('EnemySpawn', '#E74C3C', 28, 28, [enumField('kind', FIELD_UID.kind, 'EnemyKind', '敌人种类'), intField('wave', FIELD_UID.wave, '第几波，从 1 开始')], '敌人出生点。'),
        entityDef('Merchant', '#D9A7FF', 40, 40, [], '军火商。商店房会用到。'),
        entityDef('Rest', '#F2C14E', 40, 40, [], '休息站篝火。'),
        entityDef('Boss', '#FF5A4E', 80, 80, [], 'Boss 站位。'),
        entityDef('Hostage', '#E0E0E0', 36, 36, [], '人质。'),
        entityDef('Supply', '#7EE07A', 28, 28, [enumField('kind', FIELD_UID.supply, 'SupplyKind', 'Grenade 或 Heal')], '隐藏或沿途补给。'),
        entityDef('Prop', '#C4A46A', 40, 32, [enumField('prop', FIELD_UID.prop, 'PropKind', '封面/沙漠道具键')], '掩体或装饰。有碰撞体积的会挡人和子弹。'),
        entityDef('Barrel', '#C0392B', 24, 22, [], '爆炸桶。')
      ],
      tilesets: [],
      enums: [
        enumDef('MapRole', ROLES),
        enumDef('EnemyKind', ENEMIES),
        enumDef('SupplyKind', ['Heal', 'Grenade']),
        enumDef('PropKind', PROPS)
      ],
      externalEnums: [],
      levelFields: [
        intField('stage', FIELD_UID.stage, '1 前线 / 2 沙海'),
        enumField('role', FIELD_UID.role, 'MapRole', '这个模块属于哪种房间'),
        intField('variant', FIELD_UID.variant, '同角色的第几个随机变体，从 0 开始'),
        boolField('optional', FIELD_UID.optional, '支路。删掉后主路仍通'),
        strField('region', FIELD_UID.region, '走进这块时的区域名')
      ]
    },
    levels,
    worlds: [],
    dummyWorldIid: iid(900001)
  };
}

const doc = project();
const out = path.join(ROOT, 'maps', 'shell-rebirth.ldtk');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log('wrote', out, 'levels', doc.levels.length, 'bytes', fs.statSync(out).size);

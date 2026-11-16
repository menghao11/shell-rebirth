#!/usr/bin/env node
// Schema, reachability and spawn checks for maps/shell-rebirth.ldtk.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Ajv = require('/tmp/ajvdev/node_modules/ajv');

const ROOT = path.resolve(__dirname, '..');
const TILE = 32;
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL', msg); }
  return !!cond;
}

const schema = JSON.parse(fs.readFileSync('/tmp/ldtk-1.5.3.schema.json', 'utf8'));
const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'maps/shell-rebirth.ldtk'), 'utf8'));
delete schema.$schema;
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const schemaOk = validate(project);
if (!schemaOk) {
  console.error(validate.errors.slice(0, 12));
  check(false, 'LDtk 1.5.3 schema: ' + validate.errors.length + ' errors');
} else console.log('schema ok', project.jsonVersion, 'levels', project.levels.length);
check(project.jsonVersion === '1.5.3', 'jsonVersion 1.5.3');
check(project.defs.layers.map(l => l.identifier).join(',') === 'Gameplay,Decor,Collisions,Ground', 'layer order');

const context = { console, URLSearchParams, location: { search: '' }, devicePixelRatio: 1 };
context.window = context;
context.globalThis = context;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'game/src/data.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'game/src/ldtk.js'), 'utf8'), context);
const DK = context.DK;

check(DK.BOSS.hp === 3200 && DK.STAGE2.boss.hp === 2750, 'boss HP unchanged');
check(DK.STAGE2.growth.ratio === 0.65, 'growth ratio unchanged');
check(DK.PLAYER.speed === 215 && DK.PLAYER.radius === 13, 'player metrics unchanged');

const saveSrc = fs.readFileSync(path.join(ROOT, 'game/src/save.js'), 'utf8');
check(saveSrc.includes("const KEY = 'dankelunhui_meta_v1'"), 'save key unchanged');
const defLine = (saveSrc.match(/const DEF = \{.*\}/) || [''])[0];
check(defLine && !/map|ldtk|worldW/i.test(defLine), 'meta save fields unchanged');
check(saveSrc.includes('DK.storeSetJSON(KEY, DK.meta)'), 'only meta is written');

function hitOf(prop) {
  if (prop === 'barrel' || prop === 'Barrel') return [24, 22];
  if (DK.COVERS[prop]) return DK.COVERS[prop].hit;
  if (DK.PROPS2[prop]) return DK.PROPS2[prop].hit;
  return null;
}
function inflate(map) {
  const solid = map.solid.slice();
  const block = (x, y, hw, hh) => {
    if (!hw) return;
    const x0 = Math.floor((x - hw) / TILE), x1 = Math.floor((x + hw - 0.01) / TILE);
    const y0 = Math.floor((y - hh) / TILE), y1 = Math.floor((y + hh - 0.01) / TILE);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      if (cy < 0 || cx < 0 || cy >= map.rows || cx >= map.cols) continue;
      solid[cy * map.cols + cx] = 1;
    }
  };
  for (const p of map.props) {
    const hit = hitOf(p.prop);
    if (!hit) { check(DK.PROPS2[p.prop] || DK.COVERS[p.prop], 'unknown prop ' + p.prop); continue; }
    check(DK.COVERS[p.prop] || DK.PROPS2[p.prop], 'prop key exists ' + p.prop);
    block(p.x, p.y, hit[0] / 2, hit[1] / 2);
  }
  for (const b of map.barrels) block(b.x, b.y, 12, 11);
  return solid;
}
function hitsProp(map, x, y, r) {
  const touch = (px, py, hw, hh) => {
    const nx = Math.max(px - hw, Math.min(x, px + hw));
    const ny = Math.max(py - hh, Math.min(y, py + hh));
    return (nx - x) ** 2 + (ny - y) ** 2 < (r + 2) ** 2;
  };
  for (const p of map.props) {
    const hit = hitOf(p.prop);
    if (hit && touch(p.x, p.y, hit[0] / 2, hit[1] / 2)) return true;
  }
  for (const b of map.barrels) if (touch(b.x, b.y, 12, 11)) return true;
  return false;
}
function clearRect(map, solid, x, y, tw, th) {
  // Is there a tw by th block of cells whose centres fit radius 12, near (x,y)?
  const rad = 12;
  for (let cy = 1; cy < map.rows - th; cy++) for (let cx = 1; cx < map.cols - tw; cx++) {
    const ox = cx * TILE + TILE / 2, oy = cy * TILE + TILE / 2;
    if (Math.hypot(ox - x, oy - y) > 420) continue;
    let ok = true;
    for (let yy = 0; yy < th && ok; yy++) for (let xx = 0; xx < tw; xx++) {
      const px = (cx + xx) * TILE + TILE / 2, py = (cy + yy) * TILE + TILE / 2;
      if (!DK.circleFits(solid, map.cols, map.rows, px, py, rad)) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}
function dump(map, solid) {
  const lines = [];
  for (let y = 0; y < map.rows; y++) {
    let s = '';
    for (let x = 0; x < map.cols; x++) s += solid[y * map.cols + x] ? '#' : '.';
    lines.push(s);
  }
  return lines.join('\n');
}

const radii = {};
Object.assign(radii, { charger: 14, rifle: 14, sniper: 13, heavy: 20 });
for (const [k, v] of Object.entries(DK.STAGE2.enemies)) radii[k] = v.radius;

const expectWaves = {
  Trench: DK.ROOMS[0].waves, Crater: DK.ROOMS[1].waves, Camp: DK.ROOMS[2].waves, Mine: DK.ROOMS[3].waves,
  Canyon: DK.STAGE2.rooms[0].waves, Ruins: DK.STAGE2.rooms[1].waves, Depot: DK.STAGE2.rooms[2].waves,
  Oasis: DK.STAGE2.hostageWaves
};
const originalWalk = (960 - 56) * (540 - 56);
const report = [];

for (const role of Object.keys(expectWaves).concat(['Shop', 'Boss', 'BossDesert'])) {
  const stage = ['Canyon', 'Ruins', 'Depot', 'Oasis', 'BossDesert'].includes(role) ? 2 : 1;
  const variants = DK.ldtkVariants(project, stage, role);
  check(variants.length >= (role === 'Boss' || role === 'BossDesert' ? 1 : 2), role + ' variants ' + variants.join(','));
  for (const variant of variants) {
    const map = DK.composeLdtk(project, stage, role, variant);
    const tag = role + ' v' + variant;
    if (!check(!!map && !!map.player, tag + ' composes with a player start')) continue;
    const solid = inflate(map);
    const walkCells = [...map.solid].filter(v => !v).length;
    const walkPx = walkCells * TILE * TILE;
    report.push({ role, variant, px: map.worldW + 'x' + map.worldH, walkPx, ratio: +(walkPx / originalWalk).toFixed(2), regions: map.pieces.map(p => p.region).join(' / ') });
    check(map.fits(map.player.x, map.player.y, DK.PLAYER.radius + 4, solid), tag + ' spawn is clear');
    const reach = DK.ldtkReachable(map, DK.PLAYER.radius, solid);
    if (map.exit) check(reach.has(map.exit.x, map.exit.y), tag + ' exit reachable');
    else check(role === 'Boss' || role === 'BossDesert', tag + ' only bosses omit the exit');
    if (map.boss) check(map.fits(map.boss.x, map.boss.y, 48, solid) && reach.has(map.boss.x, map.boss.y), tag + ' boss pad reachable and clear');
    if (map.hostage) check(reach.has(map.hostage.x, map.hostage.y), tag + ' hostage reachable');
    if (map.merchant) check(reach.has(map.merchant.x, map.merchant.y), tag + ' merchant reachable');
    if (map.rest) check(reach.has(map.rest.x, map.rest.y), tag + ' rest reachable');
    for (const s of map.supplies) check(reach.has(s.x, s.y), tag + ' supply reachable ' + s.kind);
    for (const s of map.spawns) {
      const r = radii[s.kind] || 14;
      const ok = map.fits(s.x, s.y, r) && !hitsProp(map, s.x, s.y, r);
      check(ok, tag + ' spawn ' + s.kind + ' w' + s.wave + ' clear');
      check(Math.hypot(s.x - map.player.x, s.y - map.player.y) > 180, tag + ' spawn not on the player');
      if (s.kind === 'camel') check(clearRect(map, solid, s.x, s.y, 11, 6), tag + ' camel charge lane');
      if (s.kind === 'grenadier') check(clearRect(map, solid, s.x, s.y, 10, 6), tag + ' grenadier pocket');
      if (s.kind === 'jumper') check(clearRect(map, solid, s.x, s.y, 8, 6), tag + ' jumper dodge room');
    }
    const waves = expectWaves[role];
    if (waves) {
      waves.forEach((spec, i) => {
        for (const [k, n] of Object.entries(spec)) {
          const got = map.spawns.filter(s => s.wave === i + 1 && s.kind === k).length;
          check(got >= n, tag + ' wave ' + (i + 1) + ' ' + k + ' markers ' + got + ' < ' + n);
        }
      });
    }
    const optional = map.pieces.some(p => p.optional);
    if (!['Shop', 'Boss', 'BossDesert'].includes(role)) check(optional, tag + ' has an optional branch');
    if (optional && map.exit) {
      const main = DK.ldtkWithoutOptional(map);
      // props that sit on optional pieces must not stay in the mask
      for (const p of map.props) if (p.optional) {
        const hit = hitOf(p.prop); if (!hit) continue;
        // already in `main` as solid because the whole piece was filled
      }
      const mainReach = DK.ldtkReachable(map, DK.PLAYER.radius, main);
      check(mainReach.has(map.exit.x, map.exit.y), tag + ' main path ignores the branch');
      const hidden = map.supplies.filter(s => s.optional);
      check(hidden.length >= 1, tag + ' branch has a supply');
      check(hidden.some(s => !mainReach.has(s.x, s.y)), tag + ' supply is actually off the main path');
    }
    if (role !== 'Shop' && role !== 'Boss' && role !== 'BossDesert') {
      check(walkPx >= originalWalk * 1.8, tag + ' walkable ' + walkPx + ' vs original ' + originalWalk);
      check(walkPx <= originalWalk * 6.5, tag + ' not an empty blow-up ' + walkPx);
    }
    if (!reach.has(map.player.x, map.player.y)) {
      console.error(dump(map, solid).split('\n').slice(0, 24).join('\n'));
    }
  }
}

const regions = {};
for (const row of report) (regions[row.role] = regions[row.role] || row.regions);
check(regions.Canyon !== regions.Ruins && regions.Ruins !== regions.Depot, 'desert layouts are different regions');
check(/谷/.test(regions.Canyon) && /废墟/.test(regions.Ruins) && /罐/.test(regions.Depot) && /营地/.test(regions.Oasis), 'desert region names');

console.log('\nsize report (walkable px^2 / original ' + originalWalk + ')');
for (const row of report) if (row.variant === 0) console.log(row.role, row.px, 'walk', row.walkPx, 'x' + row.ratio, row.regions);
fs.writeFileSync(path.join(ROOT, 'maps/size-report.json'), JSON.stringify({ original: { viewport: [960, 540], walkable: originalWalk }, maps: report }, null, 2));

const phaser = fs.readFileSync(path.join(ROOT, 'game/vendor/phaser.min.js'), 'utf8');
check(phaser.includes('VERSION:"3.90.0"'), 'Phaser stays 3.90.0');

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nall map checks passed');

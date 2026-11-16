#!/usr/bin/env node
// Headless smoke: movement, shooting, collision, room change, death, old save, stage 2.
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('/tmp/pptr/node_modules/puppeteer-core');

const OUT = path.resolve(__dirname, '..', 'maps', 'preview');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.setViewport({ width: 1100, height: 700 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('dankelunhui_meta_v1', JSON.stringify({
      deaths: 4, scrap: 80, armor: 2, wins: 1, introSeen: true, bossSeen: 1,
      lastResult: 'victory', lastRunScrap: 10, talked: {},
      pendingAfterDeath: { laoqiang: false, lingjian: false }
    }));
  });
  await page.goto('http://127.0.0.1:8765/game/?touch=0', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DK && DK._ldtkReady && window.__dbg);
  await page.evaluate(() => DK._ldtkReady);
  await page.waitForFunction(() => DK.ready === true, { timeout: 90000 });
  const meta = await page.evaluate(() => ({ armor: DK.meta.armor, hp: DK.maxHp(), deaths: DK.meta.deaths, scrap: DK.meta.scrap, from: DK._ldtkFrom, levels: DK.LDTK_PROJECT && DK.LDTK_PROJECT.levels.length }));
  console.log('meta', meta);
  if (meta.armor !== 2 || meta.hp !== 120 || meta.deaths !== 4) throw new Error('old save not applied ' + JSON.stringify(meta));
  if (!meta.levels || meta.levels < 100) throw new Error('ldtk project missing');

  await page.evaluate(() => DK.skipBootIntro && DK.skipBootIntro());
  await page.waitForFunction(() => { const s = __dbg.state(); return s.scene === 'Base' || s.scene === 'Run'; });
  await page.evaluate(() => { DK.run = DK.newRun(); DK.run.mapSeed = 0; DK.run.stage = 1; __dbg.god(true); __dbg.room(1); });
  await page.waitForFunction(() => { const s = __dbg.state(); return s.scene === 'Run' && s.map && s.map.world; });
  await sleep(800);
  const entered = await page.evaluate(() => __dbg.state());
  console.log('room1', entered.map, entered.player);
  if (entered.map.role !== 'Trench' || entered.map.world[0] < 2000) throw new Error('stage1 map not expanded');
  const canvas = await page.$('canvas');
  await canvas.screenshot({ path: path.join(OUT, 's1-trench.png') });

  const inward = entered.player.x < entered.map.world[0] / 2 ? 'KeyD' : 'KeyA';
  const x0 = entered.player.x;
  await page.keyboard.down(inward);
  await sleep(700);
  await page.keyboard.up(inward);
  const moved = await page.evaluate(() => __dbg.state().player);
  console.log('moved', inward, moved);
  if (Math.abs(moved.x - x0) < 30) throw new Error('player did not move');

  const fight = await page.evaluate(() => {
    const scene = DK.game.scene.getScene('Run');
    if (!scene || !scene.map) return { err: 'no map', key: scene && scene.scene.key, has: scene && Object.prototype.hasOwnProperty.call(scene, 'map'), current: DK.current && DK.current.scene && DK.current.scene.key };
    const pts = scene.map.spawns.filter(p => p.wave === 1);
    let x = 0, y = 0;
    pts.forEach(p => { x += p.x; y += p.y; });
    scene.player.spr.body.reset(x / pts.length, y / pts.length);
    return { n: pts.length, x: x / pts.length, y: y / pts.length };
  });
  if (fight.err) throw new Error(JSON.stringify(fight));
  let wave = null;
  for (let i = 0; i < 8; i++) {
    await sleep(500);
    wave = await page.evaluate(() => {
      const scene = DK.game.scene.getScene('Run');
      if (!scene || !scene.enemies || !scene.enemies.getChildren) return { err: 'no enemies group' };
      const alive = scene.enemies.getChildren().filter(e => e.alive);
      const bad = alive.filter(e => scene.map && !scene.map.fits(e.x, e.y, (e.cfg && e.cfg.radius) || 12));
      return { enemies: alive.length, kills: scene.run.kills, pending: scene.pending, wave: scene.wave, hold: !!scene.holdWave, state: scene.state, bad: bad.length };
    });
    if (wave.enemies || wave.kills) break;
  }
  console.log('fight', fight, wave);
  if (!wave || wave.err) throw new Error(wave && wave.err || 'no wave');
  if (!wave.enemies && !wave.kills) throw new Error('no enemies spawned ' + JSON.stringify(wave));
  if (wave.bad) throw new Error('enemy inside a wall');
  await sleep(600);
  const shot = await page.evaluate(() => { const s = DK.game.scene.getScene('Run'); return s.pBullets.countActive(true) + (s.player.shots || 0); });
  console.log('shots', shot);
  if (shot < 1) throw new Error('player did not shoot');
  await canvas.screenshot({ path: path.join(OUT, 's1-fight.png') });

  const bumped = await page.evaluate(() => {
    const scene = DK.game.scene.getScene('Run');
    const m = scene.map;
    for (let y = 2; y < m.rows - 2; y++) for (let x = 2; x < m.cols - 2; x++) {
      if (!m.solid[y * m.cols + x] && m.solid[y * m.cols + x + 1]) {
        const px = x * 32 + 16, py = y * 32 + 16;
        scene.player.spr.body.reset(px, py);
        scene.player.spr.setVelocity(360, 0);
        return { x: px, y: py };
      }
    }
    return null;
  });
  await sleep(450);
  const after = await page.evaluate(() => {
    const scene = DK.game.scene.getScene('Run');
    const p = scene.player;
    return { x: Math.round(p.x), y: Math.round(p.y), inWall: scene.map.cellSolid(p.x, p.y) };
  });
  console.log('wall', bumped, after);
  if (!bumped || after.inWall) throw new Error('player entered a wall');
  if (after.x > bumped.x + 40) throw new Error('player passed through the wall');

  const skipped = await page.evaluate(() => __dbg.skip());
  console.log('skip', skipped);
  let cleared = null;
  for (let i = 0; i < 8; i++) {
    await sleep(500);
    cleared = await page.evaluate(() => {
      const s = DK.game.scene.getScene('Run');
      const st = __dbg.state();
      return { state: s && s.state, modal: !!(s && s.modal), dbgModal: st.modal, dbgScene: st.scene, door: !!(s && s.door && s.door.open), wave: s && s.wave, pending: s && s.pending, alive: s && s.enemies.getChildren().filter(e => e.alive).length, paused: s && s.isPaused() };
    });
    console.log('clear', i, cleared);
    if (cleared.modal || cleared.door) break;
  }
  if (!cleared || (!cleared.modal && !cleared.door)) throw new Error('room did not clear ' + JSON.stringify(cleared));
  await sleep(700);
  const picked = await page.evaluate(() => __dbg.state().modal ? __dbg.pick(1) : 'no modal');
  console.log('pick', picked);
  await sleep(800);
  const opened = await page.evaluate(() => {
    const s = DK.game.scene.getScene('Run');
    const r = s.door && s.door.rect;
    if (r) s.player.spr.body.reset(r.x + r.w / 2, r.y + r.h / 2);
    return { open: !!(s.door && s.door.open), room: s.run.room };
  });
  console.log('door', opened);
  if (!opened.open) throw new Error('door did not open');
  await sleep(500);
  const next = await page.evaluate(() => __dbg.state());
  console.log('next', next.scene, next.map && next.map.role, next.room);
  if (next.room !== 2 || !next.map || next.map.role !== 'Crater') throw new Error('did not enter room 2');
  await canvas.screenshot({ path: path.join(OUT, 's1-crater.png') });

  const deathsBefore = await page.evaluate(() => DK.meta.deaths);
  await page.evaluate(() => { __dbg.god(false); __dbg.die(); });
  await sleep(1800);
  const dead = await page.evaluate(() => ({ scene: __dbg.state().scene, deaths: DK.meta.deaths, armor: DK.meta.armor, scrap: DK.meta.scrap }));
  console.log('dead', dead);
  if (dead.scene !== 'Result') throw new Error('death did not reach result');
  if (dead.deaths !== deathsBefore + 1) throw new Error('death counter not saved');
  if (dead.armor !== 2) throw new Error('armor save overwritten');

  await page.evaluate(() => __dbg.stage(2, 1));
  await page.waitForFunction(() => { const s = __dbg.state(); return s.scene === 'Run' && s.map && s.map.role === 'Canyon'; });
  await sleep(600);
  const s2 = await page.evaluate(() => {
    const s = __dbg.state();
    const scene = DK.game.scene.getScene('Run');
    return { map: s.map, bodies: scene.walls.getChildren().length, tiles: scene.map.cols * scene.map.rows, shake: typeof scene.cameras.main.shake === 'function' };
  });
  console.log('stage2', s2);
  if (s2.bodies > s2.tiles / 5) throw new Error('wall bodies not merged: ' + s2.bodies + ' / ' + s2.tiles);
  await canvas.screenshot({ path: path.join(OUT, 's2-canyon.png') });

  const shakeCalls = await page.evaluate(() => {
    let n = 0;
    const cam = DK.game.scene.getScene('Run').cameras.main;
    const orig = cam.shake;
    cam.shake = function () { n++; return this; };
    try { cam.shake(0.01); } catch (e) {}
    cam.shake = orig;
    return n;
  });
  // installNoShake replaces shake with a no-op that does not call the real effect.
  // Calling it must not throw and must not move the camera.
  const shake = await page.evaluate(() => {
    const cam = DK.game.scene.getScene('Run').cameras.main;
    const before = cam.scrollX;
    cam.shake(200, 1);
    return { scroll: cam.scrollX, same: cam.scrollX === before };
  });
  console.log('shake', shake);
  if (!shake.same) throw new Error('camera shake moved the view');

  const realErrors = errors.filter(e => !/404|File not found|favicon/.test(e));
  if (realErrors.length) {
    console.log('page errors', realErrors.slice(0, 8));
    throw new Error('page errors: ' + realErrors[0]);
  }
  console.log('SMOKE_OK');
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });

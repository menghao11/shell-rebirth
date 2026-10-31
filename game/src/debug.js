// window.__dbg — reviewer/test commands. Type __dbg.help() in the browser console.
(function (DK) {
  const run = () => DK.run;
  const scene = () => DK.current;
  const inRun = () => { const s = scene(); return s && s.scene && s.scene.key === 'Run' && s.scene.isActive() ? s : null; };
  function startRoom(idx, shopType) {
    const g = DK.game;
    if (!DK.run) DK.run = DK.newRun();
    DK.run.room = Math.max(0, Math.min(DK.ROOMS.length - 1, idx));
    if (shopType) DK.run.shopType = shopType;
    ['Base', 'Result', 'Run'].forEach(k => { if (g.scene.isActive(k) && k !== 'Run') g.scene.stop(k); });
    if (g.scene.isActive('Run')) g.scene.getScene('Run').scene.restart(); else g.scene.start('Run');
    return `→ room ${DK.run.room + 1} (${DK.ROOMS[DK.run.room].type})`;
  }
  const dbg = {
    help() {
      const h = {
        'god(on=true)': '无敌（不扣血）', 'room(n, shop?)': '跳到第 n 个房间 1-5，6=Boss；shop 可选 "merchant"/"rest"', 'tutorial(mode?)': '进入教学关（first=完成后直接出击）', 'tutNext()': '教学关跳到下一步', 'jump(n)': '同 room(n)',
        'boss()': '直接打 Boss 铁砧', 'skip()': '清掉当前房间所有敌人（含后续波次）', 'wave()': '只清当前波', 'reward()': '立即弹出三选一', 'pick(i)': '选择当前三选一的第 i 张(1-3)',
        'give(id)': '直接获得奖励，id 见 rewards()', 'rewards()': '列出奖励 id', 'giveAll()': '获得全部弹种+机枪+改造', 'weapon("mg"|"pistol")': '获得并切换武器', 'ammo("burn"|"freeze"|"split")': '获得弹种',
        'heal()/hp(n)': '回满 / 设置血量', 'die()': '立即阵亡', 'win()': '立刻击败 Boss（需在 Boss 房）', 'bossHp(n)': '设置 Boss 血量（会触发阶段）', 'bossPhase(n)': '跳到 Boss 阶段 2/3',
        'spawn(type,n)': '刷怪 charger/rifle/sniper/heavy', 'grenades(n)': '设置手雷数', 'scrap(n)': '给永久废铁', 'deaths(n)': '设置死亡次数', 'armor(n)': '设置装甲等级',
        'dmgLog(n=30)': '打印最近 n 条伤害日志（console.table），返回数组', 'clearLog()': '清空伤害日志', 'logOn(bool)': '开/关伤害日志', 'audioLog(n)': '最近播放的声音',
        'autoFire(on)': '自动对最近的敌人开火（测试用）', 'speed(x)': '游戏速度倍率', 'state()': '当前状态快照', 'assets()': '素材加载报告', 'base()': '回基地（放弃本轮，不计死亡）', 'reset()': '清空存档'
      };
      console.table(h); return Object.keys(h);
    },
    god(on) { DK.god = on !== false; return 'god ' + DK.god; },
    room(n, shop) { return startRoom((n | 0) - 1, shop); }, jump(n, shop) { return startRoom((n | 0) - 1, shop); },
    boss() { return startRoom(DK.ROOMS.length - 1); },
    tutorial(mode) { const g = DK.game; DK.tutorialMode = mode || 'replay'; ['Base', 'Result', 'Run'].forEach(k => g.scene.isActive(k) && g.scene.stop(k)); g.scene.start('Run'); return 'tutorial ' + DK.tutorialMode; },
    tutStep() { const s = inRun(); return s && s.tut ? { i: s.tut.i, id: s.tut.step ? s.tut.step.id : 'done' } : null; },
    tutNext() { const s = inRun(); if (!s || !s.tut) return 'no tutorial'; s.tut.next(); return s.tut.step ? s.tut.step.id : 'done'; },
    base() { DK.run = null; const g = DK.game; ['Run', 'Result'].forEach(k => g.scene.isActive(k) && g.scene.stop(k)); g.scene.start('Base'); return 'base'; },
    skip() {
      const s = inRun(); if (!s) return 'not in a room';
      if (s.state === 'fight') { s.wave = (s.room.waves || []).length; }
      s.enemies.getChildren().slice().forEach(e => e.alive && s.killEnemy(e, 'dbg'));
      s.pending = 0; return 'room skipped';
    },
    wave() { const s = inRun(); if (!s) return 'not in a room'; s.enemies.getChildren().slice().forEach(e => e.alive && s.killEnemy(e, 'dbg')); return 'wave cleared'; },
    reward() { const s = inRun(); if (!s) return 'not in a room'; if (s.modal) return 'a modal is already open'; s.offerReward('调试 · 三选一'); return s.rewardOpen; },
    pick(i) { const s = scene(); if (!s || !s.modal || !s.modal.buttons) return 'no choice open'; const b = s.modal.buttons[(i || 1) - 1]; if (!b) return 'bad index'; b.press(); return 'picked ' + i; },
    rewards() { return DK.REWARDS.map(r => r.id); },
    give(id) { const s = inRun(); if (!run()) return 'no run'; return DK.applyReward(s || scene(), id) ? 'gave ' + id : 'unknown id'; },
    giveAll() { ['ammo_burn', 'ammo_freeze', 'ammo_split', 'weapon_mg', 'mod_fifth', 'mod_recycle', 'mod_frenzy'].forEach(id => { const r = DK.REWARDS.find(x => x.id === id); if (r.can(run())) dbg.give(id); }); return run() && run().taken; },
    weapon(id) { const r = run(); if (!r || !DK.WEAPONS[id]) return 'no'; if (!r.weapons.includes(id)) r.weapons.push(id); r.weapon = id; const s = inRun(); s && s.player.updateGun(); return id; },
    ammo(t) { const r = run(); if (!r || !DK.AMMO[t]) return 'no'; if (!r.ammoTypes.includes(t)) r.ammoTypes.push(t); return r.ammoTypes; },
    heal() { const r = run(); if (r) r.hp = r.maxHp; return r && r.hp; },
    hp(n) { const r = run(); if (r) r.hp = Math.max(1, Math.min(r.maxHp, n)); return r && r.hp; },
    die() { const s = inRun(); if (!s) return 'not in a room'; DK.god = false; s.playerDie('dbg'); return 'dead'; },
    win() { const s = inRun(); if (!s || !s.boss) return 'not in boss room'; s.boss.active = true; s.boss.invulnT = 0; s.boss.damage(s.boss.hp + 1, { src: 'dbg' }); return 'boss down'; },
    bossHp(n) { const s = inRun(); if (!s || !s.boss) return 'not in boss room'; const b = s.boss; b.invulnT = 0; b.active = true; if (n < b.hp) b.damage(b.hp - n, { src: 'dbg' }); else b.hp = n; return b.hp; },
    bossPhase(n) { return dbg.bossHp(n >= 3 ? DK.BOSS.phase3At : n === 2 ? DK.BOSS.phase2At : DK.BOSS.hp); },
    spawn(type, n) { const s = inRun(); if (!s || !DK.ENEMIES[type]) return 'no'; for (let i = 0; i < (n || 1); i++) s.spawnWithTelegraph(type); return type + ' x' + (n || 1); },
    grenades(n) { const r = run(); if (r) r.grenades = n; return n; },
    scrap(n) { DK.meta.scrap += n; DK.saveMeta(); return DK.meta.scrap; },
    deaths(n) { DK.meta.deaths = n; DK.saveMeta(); return n; },
    armor(n) { DK.meta.armor = Math.max(0, Math.min(DK.ARMOR.prices.length, n)); DK.saveMeta(); return DK.maxHp(); },
    dmgLog(n) { const rows = DK.dmgLog.slice(-(n || 30)); console.table(rows); return rows; },
    clearLog() { DK.dmgLog.length = 0; return 'cleared'; },
    logOn(on) { DK.dmgLogOn = on !== false; return DK.dmgLogOn; },
    audioLog(n) { return DK.audioLog.slice(-(n || 30)); },
    autoFire(on) { DK.autoFire = on !== false; return DK.autoFire; },
    speed(x) { const s = scene(); if (s) { s.time.timeScale = x; s.physics && (s.physics.world.timeScale = 1 / x); s.tweens.timeScale = x; } return x; },
    reset() { DK.resetMeta(); DK.run = null; return 'save cleared — reload the page'; },
    assets() { return DK.assetReport; },
    state() {
      const s = scene(), r = run(), key = s && s.scene ? s.scene.key : null, o = { scene: key, meta: Object.assign({}, DK.meta), god: !!DK.god };
      if (r) Object.assign(o, { room: r.room + 1, roomType: DK.ROOMS[r.room].type, hp: r.hp, maxHp: r.maxHp, weapon: r.weapon, mag: r.mag[r.weapon], ammoTypes: r.ammoTypes.slice(), mods: Object.keys(r.mods), grenades: r.grenades, scrap: r.scrap, kills: r.kills, taken: r.taken.slice() });
      if (key === 'Run') Object.assign(o, { state: s.state, wave: s.wave + 1, enemies: s.enemies.getChildren().filter(e => e.alive).length, pending: s.pending, doorOpen: !!(s.door && s.door.open), modal: !!s.modal, dialogue: s.dlg.active, player: { x: Math.round(s.player.x), y: Math.round(s.player.y) },
        tutorial: s.tut ? (s.tut.step ? s.tut.step.id : 'done') : null, aim: { precise: s.player.precise, bursts: s.player.bursts, burstCd: +s.player.burstCd.toFixed(2), assisted: s.player.assisted || 0 },
        boss: s.boss ? { hp: Math.round(s.boss.hp), phase: s.boss.phase, active: s.boss.active, alive: s.boss.alive } : null });
      if (key === 'Base') Object.assign(o, { dialogue: s.dlg.active, modal: !!s.modal, player: { x: Math.round(s.player.x), y: Math.round(s.player.y) } });
      return o;
    },
    // test helpers
    closeDialogue() { const s = scene(); if (s && s.dlg && s.dlg.active) { s.dlg.close(); return true; } return false; },
    teleport(x, y) { const s = scene(); if (s && s.player) { s.player.spr.body.reset(x, y); return [x, y]; } }
  };
  window.__dbg = dbg;
})(window.DK);

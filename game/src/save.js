// Persistent meta state (localStorage) — deaths, banked scrap, armor level, flags.
(function (DK) {
  const KEY = 'dankelunhui_meta_v1';
  const DEF = { deaths: 0, scrap: 0, armor: 0, wins: 0, introSeen: false, bossSeen: 0, lastResult: null, lastRunScrap: 0, talked: {}, pendingAfterDeath: { laoqiang: false, lingjian: false } };
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return Object.assign({}, DEF, s || {}); }
    catch (e) { return Object.assign({}, DEF); }
  }
  DK.meta = load();
  DK.saveMeta = function () { try { localStorage.setItem(KEY, JSON.stringify(DK.meta)); } catch (e) {} };
  DK.resetMeta = function () { DK.meta = JSON.parse(JSON.stringify(DEF)); DK.saveMeta(); };
  DK.maxHp = function () { return DK.PLAYER.hp + DK.meta.armor * DK.ARMOR.hpPer; };
  DK.armorPrice = function () { return DK.meta.armor < DK.ARMOR.prices.length ? DK.ARMOR.prices[DK.meta.armor] : null; };

  DK.newRun = function () {
    const mx = DK.maxHp();
    return {
      stage: 1, room: 0, hp: mx, maxHp: mx, weapons: ['pistol'], weapon: 'pistol',
      mag: { pistol: DK.WEAPONS.pistol.mag, mg: DK.WEAPONS.mg.mag },
      ammoTypes: [], mods: {}, grenades: DK.PLAYER.grenades, dashCharges: DK.PLAYER.dashCharges,
      dmgMul: 1, dmgUps: 0, scrap: 0, kills: 0, startTime: Date.now(), taken: [],
      shopType: Math.random() < 0.5 ? 'merchant' : 'rest', bossSeenThisRun: false
    };
  };
  DK.run = null;

  // damage log (debug)
  DK.dmgLog = []; DK.dmgLogOn = true;
  DK.logDamage = function (e) {
    if (!DK.dmgLogOn) return;
    e.t = +(performance.now() / 1000).toFixed(2);
    DK.dmgLog.push(e); if (DK.dmgLog.length > 3000) DK.dmgLog.shift();
  };
})(window.DK);

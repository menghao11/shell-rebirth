// Story text (../story/story.json) with a built-in fallback so the game runs without it.
(function (DK) {
  const FALLBACK = {
    intro: [{ speaker: 'system', text: '废弃前线。' }, { speaker: 'mark', text: '……又醒了。出发吧。' }],
    npcs: {
      laoqiang: { name: '老枪', greet_first: ['我是老枪。'], greet: ['回来啦？'], after_death: ['第 {deaths} 次了。'], sortie: ['出发！'], hints: ['火加冰会爆炸。'], lore_hidden: [] },
      lingjian: { name: '零件', greet_first: ['我是零件。'], greet: ['废铁带来了吗？'], upgrade_buy: ['装甲 +10 已安装。'], upgrade_poor: ['废铁不够。'], after_death: ['欢迎回家。'], lore_hidden: [] }
    },
    boss_anvil: { intro: [{ speaker: 'anvil', text: '【广播】碾压程序，启动。' }], intro_short: [{ speaker: 'anvil', text: '【广播】又是你。' }], phase2: [{ speaker: 'anvil', text: '【广播】铺设地雷。' }], phase3: [{ speaker: 'anvil', text: '【广播】全方位火力。' }], taunts: ['【广播】回响舱见。'], death: [{ speaker: 'anvil', text: '【广播】系统……崩溃……' }] },
    death_quips: ['又来？'],
    victory: [{ speaker: 'system', text: '第一关 完' }]
  };
  DK.story = FALLBACK;
  DK.initStory = function (scene) {
    const s = scene.cache.json.exists('story') ? scene.cache.json.get('story') : null;
    if (s && typeof s === 'object') {
      // shallow-merge so a partially written story.json still works
      DK.story = Object.assign({}, FALLBACK, s);
      DK.story.npcs = Object.assign({}, FALLBACK.npcs, s.npcs || {});
      DK.story.boss_anvil = Object.assign({}, FALLBACK.boss_anvil, s.boss_anvil || {});
      DK.assetReport.story = 'file';
    }
    // stage 2 (剧情王, story/stage2.json); built-in minimal fallback keeps the stage playable without it
    const s2 = scene.cache.json.exists('story2') ? scene.cache.json.get('story2') : null;
    DK.story2 = Object.assign({}, FALLBACK2, s2 || {});
    DK.story2.boss_sandwhale = Object.assign({}, FALLBACK2.boss_sandwhale, (s2 && s2.boss_sandwhale) || {});
    DK.story2.npcs = Object.assign({}, FALLBACK2.npcs, (s2 && s2.npcs) || {});
  };
  const FALLBACK2 = {
    intro: [{ speaker: 'system', text: '无名沙海。' }], faction: { name: '沙蝎军团', enemies: {} }, npcs: {},
    special_room: { hostage: [{ speaker: 'hostage', text: '别杀我！' }] },
    boss_sandwhale: { name: '沙鲸', title: '流沙之喉', intro: [{ speaker: 'boss', text: '【广播】检测完毕。' }], taunts: ['【嘶吼】咕噜。'], death: [{ speaker: 'system', text: '沙鲸倒下了。' }] },
    death_quips: ['我嘴里全是沙。'], victory: [{ speaker: 'system', text: '第二关 完' }]
  };
  // stage-aware helpers: the current stage's story / a merchant line (stage file first, then story.json)
  DK.storyFor = stage => (stage === 2 ? DK.story2 : DK.story);
  DK.merchantLine = function (group, stage) {
    const a = stage === 2 && DK.story2 && DK.story2.npcs.merchant && DK.story2.npcs.merchant[group];
    const b = DK.story.npcs && DK.story.npcs.merchant && DK.story.npcs.merchant[group];
    const t = DK.pick(a && a.length ? (b && b.length ? a.concat(b) : a) : b);
    return t ? { speaker: 'merchant', text: DK.fmt(t) } : null;
  };
  DK.enemyBark = function (etype) {
    const key = etype === 'camel' ? 'camel_rider' : etype, e = DK.story2 && DK.story2.faction && DK.story2.faction.enemies && DK.story2.faction.enemies[key];
    return e && e.barks ? e.barks : null;
  };
  DK.fmt = function (text, vars) {
    vars = vars || {};
    const scrap = vars.scrap != null ? vars.scrap : (DK.meta.lastRunScrap || DK.meta.scrap);
    return String(text).replace(/\{deaths\}/g, vars.deaths != null ? vars.deaths : DK.meta.deaths).replace(/\{scrap\}/g, scrap);
  };
  DK.pick = arr => (arr && arr.length ? arr[(Math.random() * arr.length) | 0] : null);
  // Normalise a list of {speaker,text} or strings to dialogue lines
  DK.lines = function (arr, speaker, vars) {
    return (arr || []).map(l => typeof l === 'string' ? { speaker: speaker || 'system', text: DK.fmt(l, vars) } : { speaker: l.speaker || speaker || 'system', text: DK.fmt(l.text, vars) });
  };
  // one random line from a NPC group -> dialogue line
  DK.npcLine = function (npc, group, vars) {
    const n = DK.story.npcs[npc] || {}; const t = DK.pick(n[group]);
    return t ? { speaker: npc, text: DK.fmt(t, vars) } : null;
  };
})(window.DK);

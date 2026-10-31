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

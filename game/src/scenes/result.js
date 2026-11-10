// Death / victory result screens (with input protection: buttons are inactive for 1.5s).
(function (DK) {
  DK.ResultScene = class extends Phaser.Scene {
    constructor() { super('Result'); }
    create(data) {
      this.leaving = false; this.btn = null; // per-visit state (review P0-1)
      DK.setupCamera(this); DK.current = this;
      const W = DK.W, H = DK.H, win = data.type === 'victory', m = DK.meta;
      this.cameras.main.fadeIn(400, 0, 0, 0);
      this.add.rectangle(W / 2, H / 2, W, H, win ? 0x1b2414 : 0x1a0f0f);
      const st2 = data.stage === 2;
      DK.txt(this, W / 2, 90, win ? (st2 ? '第二关 沙海 通关！' : '第一关 通关！') : '阵亡', { fontSize: '52px', fontStyle: 'bold', color: win ? '#f2c14e' : '#e74c3c', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
      const mm = Math.floor(data.time / 60), ss = String(data.time % 60).padStart(2, '0');
      let lines;
      if (win) lines = [`用时 ${mm}:${ss}   击杀 ${data.kills}`, `${st2 ? '沙鲸' : '铁砧'}战 ${data.bossSecs} 秒`, `带回废铁 +${data.scrap}（含通关奖励 ${DK.WIN_BONUS}）`, `总废铁 ${m.scrap}`];
      else lines = [`倒在第 ${data.room} 个房间   用时 ${mm}:${ss}   击杀 ${data.kills}`, `本轮废铁 ${data.scrap} → 回响舱回收 70% = +${data.kept}`, `总废铁 ${m.scrap}   ·   死亡次数 ${m.deaths}`];
      DK.txt(this, W / 2, 190, lines.join('\n'), { fontSize: '20px', color: '#f2e6c9', align: 'center', lineSpacing: 10 }).setOrigin(0.5, 0);
      if (!win) {
        const q = DK.pick(st2 && DK.story2.death_quips && DK.story2.death_quips.length ? DK.story2.death_quips : DK.story.death_quips) || '又来？';
        DK.txt(this, W / 2, 340, '马克中士：「' + DK.fmt(q, { deaths: m.deaths, scrap: data.kept }) + '」', { fontSize: '22px', color: '#7ee07a', wordWrap: { width: W - 120, useAdvancedWrap: true }, align: 'center' }).setOrigin(0.5);
        const price = DK.armorPrice();
        if (price != null) DK.txt(this, W / 2, 385, m.scrap >= price ? `可以去零件那里买「装甲 +10 血」了（${price} 废铁）` : `「装甲 +10 血」需要 ${price} 废铁`, { fontSize: '15px', color: '#aaa' }).setOrigin(0.5);
      }
      const label = win ? '返回基地' : '回到铁皮屋';
      const next = win && data.next === 2 && DK.pendingRun;
      const btn = DK.button(this, next ? W / 2 - 140 : W / 2, 450, 240, 54, label, () => this.back(), { guardMs: 1500, fontSize: 20 });
      if (next) { // carry the run on into 第二关 (full heal; scrap already banked)
        this.nextBtn = DK.button(this, W / 2 + 140, 450, 250, 54, '继续 · 第二关 沙海', () => this.continueStage2(), { guardMs: 1500, fontSize: 20, stroke: 0xf2c14e });
        this.input.keyboard && this.input.keyboard.on('keydown-SPACE', () => this.nextBtn.press());
      } else DK.pendingRun = null;
      this.btn = btn;
      this.input.keyboard && this.input.keyboard.on('keydown-ENTER', () => btn.press());
    }
    continueStage2() {
      if (this.leaving || !DK.pendingRun) return; this.leaving = true;
      DK.run = DK.pendingRun; DK.pendingRun = null; DK.run.startTime = Date.now();
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => { DK.stage2Intro = true; this.scene.start('Run'); });
    }
    back() { DK.pendingRun = null; if (this.leaving) return; this.leaving = true; this.cameras.main.fadeOut(250, 0, 0, 0); this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Base')); }
  };
})(window.DK);

// Boot: discover assets (art/audio/story), load them, then build placeholders for anything missing.
(function (DK) {
  DK.BootScene = class extends Phaser.Scene {
    constructor() { super('Boot'); }
    create() {
      DK.setupCamera(this);
      const W = DK.W, H = DK.H;
      this.add.rectangle(W / 2, H / 2, W, H, 0x0d0d0f);
      DK.txt(this, W / 2, H / 2 - 60, '弹壳轮回', { fontSize: '48px', fontStyle: 'bold', color: '#f2c14e', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
      DK.txt(this, W / 2, H / 2 - 14, '第一关 · 废弃前线', { fontSize: '20px', color: '#cfcfcf' }).setOrigin(0.5);
      const barBg = this.add.rectangle(W / 2, H / 2 + 40, 360, 12, 0x333333).setScrollFactor(0);
      const bar = this.add.rectangle(W / 2 - 180, H / 2 + 40, 2, 12, 0xf2c14e).setOrigin(0, 0.5).setScrollFactor(0);
      const status = DK.txt(this, W / 2, H / 2 + 70, '寻找素材…', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
      DK.discoverAssets().then(plan => {
        DK.queueAssets(this, plan);
        status.setText(`载入 ${plan.images.length} 张图片 · ${plan.audio.length} 段音频 · 剧情${plan.story ? '✓' : '(内置)'}`);
        this.load.on('progress', v => bar.width = 360 * v);
        this.load.on('loaderror', f => { DK.assetReport.errors = (DK.assetReport.errors || []).concat(f.key + ':' + f.src); });
        this.load.once('complete', () => this.done());
        if (this.load.list.size === 0) this.done(); else this.load.start();
      });
    }
    done() {
      if (this._done) return; this._done = true;
      DK.finalizeAssets(this);
      DK.initStory(this);
      DK.ready = true;
      this.scene.start('Base');
    }
  };
})(window.DK);

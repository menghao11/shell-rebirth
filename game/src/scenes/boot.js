// Boot: load the tiny intro pack (art + SFX, not bgm_title), then hand off to Intro.
// Main game assets still load during the cinematic so this is not a second loading screen.
(function (DK) {
  DK.BootScene = class extends Phaser.Scene {
    constructor() { super('Boot'); }
    create() {
      DK.setupCamera(this);
      this.cameras.main.setBackgroundColor('#07080c');
      const go = () => { if (!this._gone && this.scene.isActive()) { this._gone = true; this.scene.start('Intro'); } };
      (async () => {
        try {
          const plan = await DK.discoverIntroAssets();
          if (!this.scene.isActive()) return;
          if (plan) {
            const pack = {
              images: plan.images || [],
              audio: (plan.audio || []).filter(a => a.key !== 'bgm_title')
            };
            if (pack.images.length || pack.audio.length) {
              DK.queueAssets(this, pack);
              if (this.load.list.size) {
                this.load.once('complete', go);
                this.load.start();
                return;
              }
            }
          }
        } catch (e) { /* intro pack is optional; Intro will retry */ }
        go();
      })();
    }
  };
})(window.DK);

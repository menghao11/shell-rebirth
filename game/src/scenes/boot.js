// Boot: show a no-asset splash (CSS already on the page), launch the main-pack
// loader in parallel, and hand off immediately to Intro so the storyboard can
// start as soon as the tiny intro pack is in. MainLoad outlives Boot.
(function (DK) {
  DK.finishLoading = function (scene) {
    if (DK._finalized) {
      DK.ready = true;
      DK.introProgress = 1;
      return;
    }
    DK._finalized = true;
    try { DK.finalizeAssets(scene); } catch (e) {}
    try { DK.initStory(scene); } catch (e) {}
    DK.ready = true;
    DK.introProgress = 1;
  };

  DK.LoadScene = class extends Phaser.Scene {
    constructor() { super('MainLoad'); }
    create() {
      DK._mainLoading = true;
      (async () => {
        try {
          const plan = (await DK.discoverAssets()) || { images: [], audio: [] };
          if (!this.scene.isActive()) return;
          DK.queueAssets(this, plan);
          this.load.on('progress', v => { DK.introProgress = v; DK.mainProgress = v; DK.updateBootHint && DK.updateBootHint(); });
          this.load.on('loaderror', f => { DK.assetReport.errors = (DK.assetReport.errors || []).concat(f.key + ':' + f.src); });
          this.load.on('filecomplete-audio-bgm_title', () => { DK._titleBgmLoaded = true; });
          if (this.load.list.size === 0) this.done();
          else {
            this.load.once('complete', () => this.done());
            this.load.start();
          }
        } catch (e) { this.done(); }
      })();
    }
    done() {
      if (this._done) return; this._done = true;
      DK._mainLoading = false;
      DK.finishLoading(this);
      try { this.scene.stop(); } catch (e) {}
    }
  };

  DK.BootScene = class extends Phaser.Scene {
    constructor() { super('Boot'); }
    create() {
      DK.setupCamera(this);
      this.cameras.main.setBackgroundColor('#0d0d0f');
      if (!DK.ready && !this.scene.isActive('MainLoad')) this.scene.launch('MainLoad');
      this.scene.start('Intro');
    }
  };
})(window.DK);

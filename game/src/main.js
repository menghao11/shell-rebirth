(function (DK) {
  const R = DK.R;
  DK.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: DK.W * R, height: DK.H * R,
    backgroundColor: '#0d0d0f',
    // Cartoon art: keep smoothing/antialiasing ON (no pixelArt mode).
    pixelArt: false, antialias: true, roundPixels: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { debug: new URLSearchParams(location.search).get('hitbox') === '1' } },
    input: { activePointers: 4, touch: { capture: true } },
    audio: { disableWebAudio: false },
    fps: { target: 60 },
    scene: [DK.BootScene, DK.BaseScene, DK.RunScene, DK.ResultScene]
  });
  // pause audio when the tab/app is hidden (iOS)
  document.addEventListener('visibilitychange', () => { try { DK.game.sound.mute = document.hidden || DK.muted; } catch (e) {} });
})(window.DK);

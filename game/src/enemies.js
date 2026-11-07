// Enemies: 冲锋兵 charger / 步枪兵 rifle / 狙击手 sniper / 重装兵 heavy
(function () {
  // 重装兵 shield: the side-view art only faces left or right (flipX), so the shield covers exactly that side —
  // a front arc of ±shieldArc around 0 or π. Blocks only when the hit really comes from the front: the projectile's
  // own travel direction (curved/aim-assist bullets included) points into the shield AND the impact is on the shield side.
  // Anything else (sides, back, grenades, burn/freeze ticks, 爆环, fragments from behind) damages.
  DK.shieldDir = e => (Math.cos(e.facing) < 0 ? Math.PI : 0);
  DK.shieldBlocks = (e, vx, vy, x, y) => {
    if (!e || e.etype !== 'heavy' || !e.alive || (!vx && !vy)) return false;
    const d = DK.shieldDir(e), from = Math.atan2(-vy, -vx);
    if (Math.abs(DK.angDiff(from, d)) > Phaser.Math.DegToRad(e.cfg.shieldArc)) return false;
    return (x - e.x) * Math.cos(d) > -4; // impact on the shield half, not behind it
  };
})();
(function (DK) {
  const PI2 = Math.PI * 2;
  DK.spawnEnemy = function (scene, type, x, y, extra) {
    const c = DK.ENEMIES[type], key = 'enemy_' + type;
    const e = scene.physics.add.sprite(x, y, key); DK.applySkin(e, key);
    DK.setCircleBody(e, c.radius); e.setCollideWorldBounds(true);
    const hp = Math.round(c.hp * (DK.enemyHpMul ? DK.enemyHpMul(scene) : 1));
    Object.assign(e, { isEnemy: true, etype: type, cfg: c, hp, maxHp: hp, radius: c.radius, alive: true,
      st: { burn: 0, burnT: 0, burnTick: 0, frz: 0, frozenT: 0, immuneT: 0, steamCd: 0 },
      t: Math.random() * 1.5, state: 'move', facing: 0, flashT: 0, side: Math.random() < 0.5 ? 1 : -1, stuckT: 0 });
    e.gun = scene.add.image(x, y, 'enemy_gun').setOrigin(0.1, 0.5); DK.applyArt(e.gun, 'enemy_gun'); e.gun.setOrigin(0.1, 0.5);
    if (type === 'charger' || e.realSkin) e.gun.setVisible(false);
    if (type === 'heavy') { e.shieldImg = scene.add.image(x, y, 'shield'); DK.applyArt(e.shieldImg, 'shield'); e.shieldImg.setVisible(!e.realSkin); e.facing = Math.atan2(scene.player.y - y, scene.player.x - x); }
    if (type === 'sniper') e.t = 0.6 + Math.random() * 0.6;
    if (DK.ENEMY_INIT && DK.ENEMY_INIT[type]) DK.ENEMY_INIT[type](scene, e);
    if (extra) Object.assign(e, extra);
    scene.enemies.add(e);
    e.setAlpha(0); scene.tweens.add({ targets: e, alpha: 1, duration: 200 });
    return e;
  };

  DK.removeEnemy = function (e) {
    e.alive = false; if (e.warnSnd) { DK.stopSfx(e.warnSnd); e.warnSnd = null; } e.gun && e.gun.destroy(); e.shieldImg && e.shieldImg.destroy(); e.destroy();
  };

  function steer(e, tx, ty, speed, dt) {
    let dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const b = e.body;
    if (b.blocked.left || b.blocked.right || b.blocked.up || b.blocked.down || b.touching.left || b.touching.right || b.touching.up || b.touching.down) e.stuckT = 0.45;
    if (e.stuckT > 0) { e.stuckT -= dt; const ox = -dy * e.side, oy = dx * e.side; dx = dx * 0.3 + ox; dy = dy * 0.3 + oy; const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
    e.setVelocity(dx * speed, dy * speed);
  }

  DK.updateEnemy = function (scene, e, dt) {
    const p = scene.player, c = e.cfg, st = e.st;
    if (e.dummy) { // tutorial target: stands (or drifts) and never attacks
      if (e.flashT > 0) { e.flashT -= dt; e.setTintFill(0xffffff); } else if (e.only) e.setTint(e.only === 'burst' ? 0x9fd3ff : 0xffc08a); else e.clearTint();
      e.setVelocity(e.dvx || 0, e.dvy || 0); e.setDepth(e.y + (e.skin ? e.skin.lift : e.radius)); e.setFlipX(p.x < e.x);
      if (e.realSkin) DK.anim(e, 'move'); return;
    }
    const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    // ---- status
    if (st.burnT > 0) {
      st.burnT -= dt; st.burnTick += dt;
      if (st.burnTick >= 0.5) { st.burnTick -= 0.5; scene.damage(e, DK.AMMO.burn.dps * st.burn * 0.5, { src: 'burn', color: '#ff9a3a', noFlash: true }); if (!e.alive) return; }
      if (st.burnT <= 0) { st.burn = 0; st.burnTick = 0; }
    }
    if (st.frozenT > 0) { st.frozenT -= dt; if (st.frozenT <= 0) st.immuneT = DK.AMMO.freeze.immune; }
    else if (st.immuneT > 0) st.immuneT -= dt;
    if (st.steamCd > 0) st.steamCd -= dt;
    const frozen = st.frozenT > 0;
    const slow = frozen ? 0 : Math.max(0.2, 1 - DK.AMMO.freeze.slowPer * st.frz);
    // tint
    if (e.flashT > 0) { e.flashT -= dt; e.setTintFill(0xffffff); }
    else if (frozen) e.setTint(0x9fe8ff);
    else if (st.frz > 0) e.setTint(0xc8f0ff);
    else if (st.burn > 0) e.setTint(Math.floor(scene.time.now / 120) % 2 ? 0xffa060 : 0xffd0a0);
    else e.clearTint();
    e.setDepth(e.y + (e.skin ? e.skin.lift : e.radius));
    if (e.realSkin) {
      e.hurtT = (e.hurtT || 0) - dt; e.atkT = (e.atkT || 0) - dt;
      // attack frames are driven by the AI below (e.atkFrame) so shots land on the manifest's event frames
      if (!e.holdFrame && e.renderDY) e.renderDY = 0;
      if (e.holdFrame) DK.animFrame(e, e.holdFrame[0], e.holdFrame[1]);
      else if (e.animOverride && e.skin.anims[e.animOverride]) DK.anim(e, e.animOverride);
      else if (e.atkFrame != null) DK.animFrame(e, 'attack', e.atkFrame);
      else if (e.atkT > 0) DK.anim(e, 'attack');
      else if (e.hurtT > 0) DK.anim(e, 'hurt');
      else DK.anim(e, 'move');
      if (st.frozenT > 0) e.anims.pause(); else if (e.anims.isPaused) e.anims.resume();
    }
    const face = e.etype === 'heavy' ? e.facing : ang;
    if ((DK.ART['enemy_' + e.etype] || {}).flip !== false) e.setFlipX(Math.cos(face) < 0);
    if (e.gun.visible) e.gun.setPosition(e.x + Math.cos(face) * 6, e.y + 6 + Math.sin(face) * 6).setRotation(face).setFlipY(Math.cos(face) < 0).setDepth(e.y + 1);
    if (frozen) { e.setVelocity(0); if (e.onFrozen) e.onFrozen(); if (e.etype === 'sniper' && e.state === 'aim') { e.state = 'move'; e.t = 1; DK.stopSfx(e.warnSnd); e.warnSnd = null; } return; }
    const sp = c.speed * slow; e.atkFrame = null;
    e.t -= dt * slow;
    switch (e.etype) {
      case 'charger': {
        if (e.state === 'fuse') {
          e.setVelocity(0); e.fuse -= dt;
          e.atkFrame = Math.min(5, Math.floor((1 - e.fuse / c.fuse) * 6)); // wind-up 00-05, boom after 05
          if (!e.realSkin) { const f = 1 + 0.12 * Math.sin(scene.time.now / 30); e.setScale(e.baseScale[0] * f, e.baseScale[1] * f); }
          if (e.fuse <= 0) {
            scene.explode(e.x, e.y + (e.realSkin ? 8 : 0), c.boomRadius, c.boomDmg, { src: 'charger_boom', hurtPlayer: true, hurtEnemies: false, size: 0.7 });
            scene.killEnemy(e, 'self'); return;
          }
        } else {
          steer(e, p.x, p.y, sp * (dist < 160 ? 1.25 : 1), dt);
          if (dist < 42) { e.state = 'fuse'; e.fuse = c.fuse; e.baseScale = [e.scaleX, e.scaleY]; }
        }
        break;
      }
      case 'rifle': case 'camel_rider': {
        const [r0, r1] = c.range;
        let tx = e.x, ty = e.y;
        if (dist > r1) { tx = p.x; ty = p.y; }
        else if (dist < r0) { tx = e.x - dx; ty = e.y - dy; }
        else { tx = e.x - dy / dist * 60 * e.side; ty = e.y + dx / dist * 60 * e.side; if (Math.random() < 0.005) e.side *= -1; }
        if (e.state === 'burst') { e.setVelocity(0); }
        else steer(e, tx, ty, sp, dt);
        if (e.state === 'move' && e.t <= 0 && dist < 520) { e.state = 'tell'; e.t = 0.3; e.flashT = 0.08; }
        else if (e.state === 'tell' && e.t <= 0) { e.state = 'burst'; e.shots = c.burst; e.t = 0; }
        else if (e.state === 'burst' && e.t <= 0) {
          e.shotFrame = 2 + (c.burst - e.shots); // rifleman_attack shoots on 02/03/04
          scene.enemyShoot(e.x + Math.cos(ang) * 20, e.y + (e.realSkin ? -2 : 6) + Math.sin(ang) * 20, ang + Phaser.Math.FloatBetween(-0.06, 0.06), c.bulletSpeed, c.dmg, 'rifle');
          e.shots--; e.t = c.burstGap;
          if (e.shots <= 0) { e.state = 'move'; e.t = c.cd + Math.random() * 0.6; e.lowerT = 0.12; }
        }
        if (e.state === 'tell') e.atkFrame = e.t > 0.15 ? 0 : 1;
        else if (e.state === 'burst') e.atkFrame = Math.min(4, e.shotFrame || 1);
        else if ((e.lowerT -= dt) > 0) e.atkFrame = 5;
        break;
      }
      case 'sniper': {
        if (e.state === 'move') {
          let tx = e.x, ty = e.y;
          if (dist < 340) { tx = e.x - dx; ty = e.y - dy; } else { tx = e.x - dy / dist * 50 * e.side; ty = e.y + dx / dist * 50 * e.side; }
          steer(e, tx, ty, sp, dt);
          if (e.t <= 0) { e.state = 'aim'; e.aimT = 0; e.aimAng = ang; e.warnSnd = DK.sfx(scene, 'sniper_warn', { minGap: 0 }); }
        } else if (e.state === 'aim') {
          e.setVelocity(0); e.aimT += dt;
          if (e.aimT < c.lockAt) e.aimAng = ang; // tracks, then locks for the last ~0.35s
          e.atkFrame = e.aimT < 0.1 ? 0 : e.aimT < c.lockAt ? 1 : 2; // 00 shoulder, 01 HOLD during red line, 02 steady
          if (e.aimT >= c.aim) {
            scene.enemyShoot(e.x + Math.cos(e.aimAng) * 24, e.y + (e.realSkin ? -4 : 0) + Math.sin(e.aimAng) * 24, e.aimAng, c.bulletSpeed, c.dmg, 'sniper', { big: true });
            if (e.realSkin) { DK.anim(e, 'attack', { restart: true, startFrame: 3 }); e.atkT = 0.3; } // fire on 03, then 04-05
            e.state = 'move'; e.t = c.cd + Math.random() * 0.8; e.warnSnd = null;
          }
        }
        break;
      }
      case 'heavy': {
        const turn = Phaser.Math.DegToRad(c.turn) * dt * slow;
        const df = DK.angDiff(ang, e.facing); e.facing += Phaser.Math.Clamp(df, -turn, turn);
        if (dist > 70) steer(e, p.x, p.y, sp, dt); else e.setVelocity(0);
        // heavy_attack: 00-02 brace/raise/aim (0.25 s), BLAST on 03, 04-05 recoil/pump
        if (e.windT == null && e.t <= 0 && dist < 480) e.windT = 0;
        if (e.windT != null) {
          e.windT += dt; e.atkFrame = Math.min(2, Math.floor(e.windT * 12));
          if (e.windT >= 0.25) {
            e.windT = null; e.atkFrame = null;
            if (e.realSkin) { DK.anim(e, 'attack', { restart: true, startFrame: 3 }); e.atkT = 0.25; }
            for (let i = -2; i <= 2; i++) scene.enemyShoot(e.x + Math.cos(e.facing) * 26, e.y + Math.sin(e.facing) * 26, e.facing + i * 0.16, c.bulletSpeed, c.dmg, 'heavy', { noFlash: i !== 0 });
            e.t = c.cd + Math.random() * 0.8;
          }
        }
        const sd = DK.shieldDir(e); e.shieldImg.setPosition(e.x + Math.cos(sd) * (c.radius + 6), e.y).setRotation(sd).setDepth(e.y + 2); // fallback art: same side as the flipped sprite
        break;
      }
      default: if (DK.ENEMY_AI && DK.ENEMY_AI[e.etype]) DK.ENEMY_AI[e.etype](scene, e, dt, { p, dx, dy, dist, ang, sp, slow, steer });
    }
  };

  // Draw telegraphs (sniper red line etc.) into a shared graphics layer
  DK.drawEnemyFx = function (scene, g) {
    scene.enemies.getChildren().forEach(e => {
      if (!e.alive) return;
      if (e.etype === 'sniper' && e.state === 'aim') {
        const locked = e.aimT >= e.cfg.lockAt, len = 1200;
        const blink = locked && Math.floor(scene.time.now / 60) % 2;
        g.lineStyle(locked ? 3 : 1.5, 0xff2020, blink ? 1 : 0.4 + 0.5 * (e.aimT / e.cfg.aim));
        g.lineBetween(e.x, e.y, e.x + Math.cos(e.aimAng) * len, e.y + Math.sin(e.aimAng) * len);
      }
      if (DK.ENEMY_FX && DK.ENEMY_FX[e.etype]) DK.ENEMY_FX[e.etype](scene, g, e);
      if (e.etype === 'charger' && e.state === 'fuse') { g.lineStyle(2, 0xff3030, 0.7).strokeCircle(e.x, e.y, e.cfg.boomRadius); }
      if (e.hp < e.maxHp) {
        const w = Math.max(24, e.radius * 2), y = e.y - e.radius - 12;
        g.fillStyle(0x000000, 0.6).fillRect(e.x - w / 2 - 1, y - 1, w + 2, 5);
        g.fillStyle(0xe74c3c).fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 3);
      }
      const st = e.st;
      if (st.frz > 0 && st.frozenT <= 0) for (let i = 0; i < st.frz; i++) g.fillStyle(0x6fd6ff).fillCircle(e.x - 9 + i * 6, e.y + e.radius + 6, 2.2);
      if (st.frozenT > 0) { g.lineStyle(2, 0xbff4ff, 0.9).strokeCircle(e.x, e.y, e.radius + 4); }
    });
  };
})(window.DK);

#!/usr/bin/env node
// Validate maps/shell-rebirth.ldtk and refresh the embedded runtime copy.
// The game also fetches the .ldtk itself; this file is the fallback when fetch
// cannot run (file://). Re-run after every LDtk save before committing.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const test = spawnSync(process.execPath, [path.join(__dirname, 'test-maps.js')], { cwd: ROOT, stdio: 'inherit' });
if (test.status) process.exit(test.status);

const raw = fs.readFileSync(path.join(ROOT, 'maps/shell-rebirth.ldtk'));
const sha = crypto.createHash('sha256').update(raw).digest('hex');
const obj = JSON.parse(raw.toString('utf8'));
const js = 'window.DK=window.DK||{};DK.LDTK_SHA=' + JSON.stringify(sha) + ';DK.LDTK_PROJECT=' + JSON.stringify(obj) + ';\n';
fs.writeFileSync(path.join(ROOT, 'game/src/ldtk-data.js'), js);
fs.writeFileSync(path.join(ROOT, 'maps/build-info.json'), JSON.stringify({
  sha, bytes: raw.length, levels: obj.levels.length, jsonVersion: obj.jsonVersion, embedded: 'game/src/ldtk-data.js'
}, null, 2) + '\n');
console.log('embedded', sha.slice(0, 12), 'bytes', js.length);

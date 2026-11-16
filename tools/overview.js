#!/usr/bin/env node
// Paint variant-0 maps to maps/overview.png and maps/overview.svg.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'maps/shell-rebirth.ldtk'), 'utf8'));
const context = { console, URLSearchParams, location: { search: '' }, devicePixelRatio: 1 };
context.window = context; context.globalThis = context;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'game/src/data.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'game/src/ldtk.js'), 'utf8'), context);
const DK = context.DK;

const roles = [['Trench', 1], ['Crater', 1], ['Camp', 1], ['Mine', 1], ['Shop', 1], ['Boss', 1], ['Canyon', 2], ['Ruins', 2], ['Depot', 2], ['Oasis', 2], ['BossDesert', 2]];
const maps = roles.map(([role, stage]) => ({ role, stage, map: DK.composeLdtk(project, stage, role, 0) }));
const scale = 4; // source px per overview px... we'll sample every `step` source px
const step = 8;
const pad = 8, label = 16;
let sheetW = 0, sheetH = pad;
const cells = maps.map(({ role, stage, map }) => {
  const w = Math.ceil(map.worldW / step), h = Math.ceil(map.worldH / step);
  sheetW = Math.max(sheetW, w + pad * 2);
  const y = sheetH;
  sheetH += label + h + pad;
  return { role, stage, map, w, h, y };
});
sheetW = Math.max(sheetW, 280);

function png(w, h, rgba) {
  const crc32 = buf => zlib.crc32(buf) >>> 0;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}

const img = Buffer.alloc(sheetW * sheetH * 4);
function put(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= sheetW || y >= sheetH) return;
  const i = (y * sheetW + x) * 4;
  img[i] = r; img[i + 1] = g; img[i + 2] = b; img[i + 3] = a;
}
function fill(x, y, w, h, c) { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) put(x + xx, y + yy, c[0], c[1], c[2], 255); }
fill(0, 0, sheetW, sheetH, [18, 16, 14]);

const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" viewBox="0 0 ${sheetW} ${sheetH}">`,
  `<rect width="100%" height="100%" fill="#12100e"/>`];

for (const cell of cells) {
  const { map, w, h, y, role, stage } = cell;
  svg.push(`<text x="${pad}" y="${y + 12}" fill="#f2c14e" font-size="12" font-family="sans-serif">${stage === 2 ? '沙海' : '前线'} · ${role} ${map.worldW}×${map.worldH}</text>`);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const sx = Math.min(map.cols - 1, Math.floor(xx * step / map.tile));
    const sy = Math.min(map.rows - 1, Math.floor(yy * step / map.tile));
    const solid = map.solid[sy * map.cols + sx];
    const gnd = map.ground[sy * map.cols + sx];
    let c = solid ? [70, 62, 52] : gnd === 2 ? [196, 164, 106] : gnd === 3 ? [110, 143, 85] : stage === 2 ? [201, 169, 107] : [120, 104, 72];
    if (!gnd && solid) c = [22, 18, 14];
    put(pad + xx, y + label + yy, c[0], c[1], c[2], 255);
  }
  const dot = (px, py, col) => {
    const dx = Math.round(px / step), dy = Math.round(py / step);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) put(pad + dx + ox, y + label + dy + oy, col[0], col[1], col[2], 255);
  };
  if (map.player) dot(map.player.x, map.player.y, [126, 224, 122]);
  if (map.exit) dot(map.exit.x, map.exit.y, [242, 193, 78]);
  if (map.boss) dot(map.boss.x, map.boss.y, [255, 90, 78]);
  for (const s of map.spawns) dot(s.x, s.y, [231, 76, 60]);
  for (const s of map.supplies) dot(s.x, s.y, [126, 200, 255]);
  svg.push(`<image href="overview.png" />`);
}
svg.push('</svg>');
fs.writeFileSync(path.join(ROOT, 'maps/overview.png'), png(sheetW, sheetH, img));
fs.writeFileSync(path.join(ROOT, 'maps/overview.svg'), svg.filter(s => !s.includes('<image')).join('\n'));
console.log('overview', sheetW, sheetH);

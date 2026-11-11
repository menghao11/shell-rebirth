#!/usr/bin/env python3
"""Build mobile-friendly copies of the boot-intro art pack.

Reads  art/intro/manifest.json  and writes  game/assets/intro/

  - Every sheet / single sprite is downscaled (logo ≤ 1024 px wide; title_bg is a
    960×540 JPEG). Multi-frame sheets are packed into a Phaser-friendly grid
    whose width stays ≤ 4096 px.
  - manifest.json keeps frame_size / anchor scaled, plus
      res_scale : web px per original px (the game divides display scale by this)
      src_sig   : signature of the source entry; the game falls back to the
                  original file if the source changed
      sheet_columns / sheet_rows : packed layout

intro_title_bg and intro_pod_open will be replaced later with files that keep
the same key, size, and anchor. Re-run this script after any such drop:

    python3 tools/build_web_intro.py

Rebuild order (画图王, from art/intro/MANIFEST.md):

    stage2_boss_build.py → fixes_build.py → stage2_verify.py →
    stage2_delivery.py → stage2_boss_delivery.py → intro_build.py →
    intro_fixes_verify.py → intro_fixes_delivery.py → tools/build_web_intro.py

Important: if you re-run art_src/finalize.py you must run art_src/fixes_build.py
again before the intro delivery steps, otherwise later keys can be stale.
"""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) > 1:
    ROOT = os.path.abspath(sys.argv[1])
SRC = os.path.join(ROOT, 'art', 'intro')
DST = os.path.join(ROOT, 'game', 'assets', 'intro')
MAXW = 4096

# Per-key scale (web px / source px). Logo must stay ≤ 1024 wide.
FACT = {
    'intro_logo': 0.5,          # 1600→800
    'intro_logo_shine': 0.5,    # 1600→800, 4×4 grid = 3200 px wide
    'intro_pod_blink': 0.5,     # 640→320
    'intro_pod_open': 0.5,      # 640→320
    'intro_steam_burst': 0.5,   # 512→256
    'intro_steam_loop': 0.5,
    'intro_flash': 0.5,         # 512→256
    'intro_shell_spin': 0.75,   # 256→192 (small sprite; keep some detail)
    'intro_shell_rest': 0.75,
    'intro_glint': 1.0,         # already 128
    'intro_title_bg': 0.5,      # 1920×1080 → 960×540 JPEG
}

def sig(a):
    # must match JSON.stringify([...]) in game/src/scenes/intro.js
    return json.dumps(
        [a.get('sheet') or None, (a.get('frames') or [None])[0], a.get('frame_size'), a.get('frame_count') or 1, a.get('anchor')],
        separators=(',', ':'), ensure_ascii=False)

def crop_frames(im, fw, fh, n):
    cols = max(1, im.width // fw)
    rows = max(1, im.height // fh)
    out = []
    for i in range(n):
        c, r = i % cols, i // cols
        if r >= rows:
            # leftover: try remaining in last row or skip
            break
        out.append(im.crop((c * fw, r * fh, c * fw + fw, r * fh + fh)))
    if len(out) < n and n == 1:
        out = [im]
    return out

def pack(frames, nfw, nfh):
    n = len(frames)
    cols = max(1, min(n, MAXW // max(1, nfw)))
    rows = (n + cols - 1) // cols
    sheet = Image.new('RGBA', (nfw * cols, nfh * rows))
    for i, fr in enumerate(frames):
        sheet.paste(fr, ((i % cols) * nfw, (i // cols) * nfh))
    return sheet, cols, rows

def main():
    man_path = os.path.join(SRC, 'manifest.json')
    if not os.path.exists(man_path):
        sys.exit('missing ' + man_path)
    man = json.load(open(man_path))
    out = {k: v for k, v in man.items() if k != 'assets'}
    out['assets'] = []
    os.makedirs(DST, exist_ok=True)
    for a in man.get('assets') or []:
        name = a.get('name')
        if not name:
            continue
        n = a.get('frame_count') or 1
        fs = a.get('frame_size')
        rel = a['sheet'] if (n > 1 and a.get('sheet')) else (a.get('file') or (a.get('frames') or [None])[0] or a.get('sheet'))
        if not rel:
            print('no file', name); continue
        src = os.path.join(SRC, rel)
        if not os.path.exists(src):
            print('missing', name, rel); continue
        im = Image.open(src).convert('RGBA')
        fw, fh = fs if fs else im.size
        f = FACT.get(name, 0.5)
        # hard cap: logo frames ≤ 1024 wide
        if fw * f > 1024:
            f = 1024 / fw
        nfw, nfh = max(1, round(fw * f)), max(1, round(fh * f))
        frames = crop_frames(im, fw, fh, n)
        frames = [fr.resize((nfw, nfh), Image.LANCZOS) for fr in frames]
        if not frames:
            print('no frames', name); continue
        sheet, cols, rows = pack(frames, nfw, nfh)
        opaque = sheet.split()[3].getextrema()[0] == 255
        use_jpg = opaque and n <= 1 and fw * fh >= 512 * 512
        orel = os.path.splitext(rel)[0] + ('.jpg' if use_jpg else '.png')
        dst = os.path.join(DST, orel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if use_jpg:
            sheet.convert('RGB').save(dst, quality=86, optimize=True, progressive=True)
        else:
            sheet.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(dst, optimize=True)
        anc = a.get('anchor') or [fw / 2, fh / 2]
        b = dict(a)
        b.pop('frames', None)
        b.update({
            'sheet' if n > 1 else 'file': orel,
            'frame_size': [nfw, nfh],
            'anchor': [round(anc[0] * f, 2), round(anc[1] * f, 2)],
            'res_scale': f,
            'src_sig': sig(a),
            'sheet_columns': cols,
            'sheet_rows': rows,
        })
        if n <= 1:
            b.pop('sheet', None)
            b.pop('sheet_columns', None)
            b.pop('sheet_rows', None)
        out['assets'].append(b)
        print('  %s  %s  %dx%d×%d  scale=%.3f  %s  %d KB' % (
            name, orel, nfw, nfh, n, f, 'jpg' if use_jpg else 'png', os.path.getsize(dst) // 1024))
    json.dump(out, open(os.path.join(DST, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    # tiny listing so a Pages deploy can probe the folder
    files = sorted(f for f, d, fns in [(os.path.relpath(os.path.join(dp, fn), DST), dp, fn)
                                       for dp, _, fns in os.walk(DST) for fn in fns] if f != 'index.html')
    # simpler walk
    rels = []
    for dp, _, fns in os.walk(DST):
        for fn in fns:
            if fn == 'index.html':
                continue
            rels.append(os.path.relpath(os.path.join(dp, fn), DST).replace('\\', '/'))
    rels.sort()
    body = ''.join('<li><a href="%s">%s</a></li>\n' % (r, r) for r in rels)
    open(os.path.join(DST, 'index.html'), 'w').write(
        '<!doctype html><meta charset="utf-8"><title>game/assets/intro</title><ul>\n%s</ul>\n' % body)
    tot = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(DST) for fn in fns)
    print('assets', len(out['assets']), 'disk KB', tot // 1024)

if __name__ == '__main__':
    main()

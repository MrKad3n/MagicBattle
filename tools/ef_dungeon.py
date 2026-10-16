"""EmberFall dungeon dressing (c56): props and surface strips for the Fire, Ice and Earth dungeons, made from the
open world's painted flora so the dungeons share its look. Recolours existing sprites through new colour ramps
(basalt with glowing cracks, ember crystals, charred trees, ember-tipped dripstones, hanging roots) and paints a
few new ones (glowing cave mushrooms, cave crystals). Adds the entries to images/emberfall/flora/flora.json and
writes the strips images/emberfall/dg-ash.png and dg-moss.png.
Run from the repo root: python3 tools/ef_dungeon.py"""
import os
import json
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
import sys
sys.path.insert(0, os.path.dirname(__file__))
from ef_common import ramp, fbm

FL = 'images/emberfall/flora'
META = json.load(open(os.path.join(FL, 'flora.json')))


def load(name):
    im = np.asarray(Image.open(os.path.join(FL, name + '.png')).convert('RGBA')).astype(np.float64)
    return im[..., :3], im[..., 3] / 255.0


def lum(rgb):
    return (rgb[..., 0] * 0.3 + rgb[..., 1] * 0.55 + rgb[..., 2] * 0.15) / 255.0


def save(name, rgb, a, src=None, meta=None):
    im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(a, 0, 1) * 255]).astype(np.uint8), 'RGBA')
    im.save(os.path.join(FL, name + '.png'), optimize=True)
    m = dict(META[src]) if src else dict(meta)
    m['w'], m['h'] = im.width, im.height
    META[name] = m


def noise(h, w, seed, beta=2.0):
    s = max(h, w)
    s = 1 << int(np.ceil(np.log2(s)))
    return fbm(s, s, beta, seed)[:h, :w]


def cracks(h, w, seed, width=0.018):
    n = noise(h, w, seed, 2.6)
    n2 = noise(h, w, seed + 9, 2.2)
    c = np.clip(1 - np.abs(n - 0.5) / width, 0, 1) * (n2 > 0.42)
    return gaussian_filter(c, 0.7)


EMBER_GLOW = np.array([255, 120, 30], dtype=np.float64)
EMBER_HOT = np.array([255, 214, 120], dtype=np.float64)


def glow_onto(rgb, a, m, k=1.0):
    """Add molten light (a mask in [0,1]) onto a sprite, inside its alpha."""
    m = np.clip(m * a, 0, 1) * k
    halo = gaussian_filter(m, 3) * 0.7
    rgb = rgb * (1 - halo[..., None] * 0.6) + EMBER_GLOW * halo[..., None] * 0.6
    rgb = rgb * (1 - m[..., None]) + (EMBER_HOT * m[..., None] + EMBER_GLOW * (1 - m[..., None])) * m[..., None]
    return rgb


BASALT = [(0, '#07060a'), (0.25, '#141218'), (0.5, '#25212a'), (0.75, '#3c3640'), (1, '#6a6070')]


def basalt(src, name, seed):
    rgb, a = load(src)
    L = lum(rgb)
    out = ramp(L ** 1.1, BASALT)
    c = cracks(*a.shape, seed)
    # cracks glow more toward the bottom (heat from below)
    yy = np.linspace(0, 1, a.shape[0])[:, None]
    out = glow_onto(out, a, c * (0.45 + 0.55 * yy))
    save(name, out, a, src)


def ember_crystal(src, name):
    rgb, a = load(src)
    L = lum(rgb)
    out = ramp(L, [(0, '#3a0804'), (0.3, '#8a1c06'), (0.55, '#d4480c'), (0.8, '#ff9a2a'), (1, '#fff0b8')])
    save(name, out, a, src)


def charred(src, name, seed):
    rgb, a = load(src)
    L = lum(rgb)
    out = ramp(L, [(0, '#050405'), (0.4, '#17120f'), (0.7, '#2e241d'), (1, '#4e4036')])
    # embers smouldering at the tips (thin parts near the top)
    thin = np.clip(a - gaussian_filter(a, 3), 0, 1) * 3
    yy = np.linspace(1, 0, a.shape[0])[:, None]
    n = noise(*a.shape, seed, 1.6)
    out = glow_onto(out, a, np.clip(thin * yy * (n > 0.5), 0, 1), 0.9)
    save(name, out, a, src)


def dripstone(src, name, hot):
    rgb, a = load(src)
    L = lum(rgb)
    if hot:
        out = ramp(L, [(0, '#0a080a'), (0.5, '#2a2228'), (1, '#5a4c50')])
        # molten drops at the tips: the bottom of each spike
        bot = np.zeros_like(a)
        bot[:-4] = np.clip(a[:-4] - a[4:], 0, 1)
        out = glow_onto(out, a, gaussian_filter(bot, 1.2) * 3)
    else:
        out = ramp(L, [(0, '#2a2420'), (0.5, '#5a4e44'), (1, '#9a8c7a')])
    save(name, out, a, src)


def roots(src, name):
    rgb, a = load(src)
    L = lum(rgb)
    out = ramp(L, [(0, '#120c08'), (0.35, '#2e2016'), (0.7, '#5a4028'), (1, '#8c6c48')])
    save(name, out, a, src)


def cave_crystal(src, name, stops):
    rgb, a = load(src)
    out = ramp(lum(rgb), stops)
    save(name, out, a, src)


def mushroom(name, seed, caps, cap_col, stem_col, glow=True):
    """A clump of cave mushrooms: pale stems and domed caps with gills, lit from inside."""
    r = np.random.default_rng(seed)
    W, H = 260, 220
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    rgb = np.zeros((H, W, 3))
    a = np.zeros((H, W))
    n = noise(H, W, seed, 2.0)
    order = sorted(caps, key=lambda c: c[2])
    for (cx, ch, cr) in order:
        top = H - 6 - ch
        # stem: a slightly curved tapered column
        sw = cr * 0.28
        bend = (r.random() - 0.5) * 10
        t = np.clip((yy - top) / max(1, ch), 0, 1)
        sx = cx + bend * (1 - t) ** 2
        stem = (np.abs(xx - sx) < sw * (0.8 + 0.4 * t)) & (yy > top) & (yy < H - 4)
        sc = ramp(0.45 + 0.5 * np.clip((sx - xx) / sw * 0.5 + 0.5, 0, 1) * 0.6 + n * 0.15, stem_col)
        rgb = np.where(stem[..., None], sc, rgb)
        a = np.where(stem, 1.0, a)
        # cap: a dome (upper half ellipse) with a dark gill band under it
        cy = top
        e = ((xx - cx) / cr) ** 2 + ((yy - cy) / (cr * 0.62)) ** 2
        cap = (e < 1) & (yy < cy + 3)
        shade = np.clip(0.35 + 0.65 * (1 - e) ** 0.5 - (yy - (cy - cr * 0.62)) / (cr * 1.4) * 0.3 + (cx - xx) / cr * 0.12, 0, 1)
        spots = (noise(H, W, seed + int(cx), 1.4) > 0.72) & cap
        cc = ramp(shade + n * 0.1, cap_col)
        cc = np.where(spots[..., None], cc * 0.6 + 255 * 0.4, cc)
        rgb = np.where(cap[..., None], cc, rgb)
        a = np.where(cap, 1.0, a)
        gill = (np.abs(yy - (cy + 2)) < 3) & (np.abs(xx - cx) < cr * 0.92)
        rgb = np.where(gill[..., None], rgb * 0.45, rgb)
    if glow:
        # a soft glow bleeding out around the caps
        ga = gaussian_filter(a, 10) * 0.55
        gcol = ramp(np.ones_like(a), cap_col)[..., :3]
        rgb = np.where((a < 0.5)[..., None], gcol, rgb)
        a = np.maximum(a, np.clip(ga - 0.04, 0, 0.45) * (a < 0.5))
    a = gaussian_filter(a, 0.6)
    # crop and halve
    ys, xs = np.where(a > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb, a = rgb[y0:y1, x0:x1], a[y0:y1, x0:x1]
    im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(a, 0, 1) * 255]).astype(np.uint8), 'RGBA')
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(os.path.join(FL, name + '.png'), optimize=True)
    META[name] = {'w': im.width, 'h': im.height, 'ax': 0.5, 'base': im.height - 2}


def strip_ash():
    """The scorched crust on top of fire-dungeon floors: ash drifts with embers in them (from the snow strip)."""
    im = np.asarray(Image.open('images/emberfall/grass-snow.png').convert('RGBA')).astype(np.float64)
    rgb, a = im[..., :3], im[..., 3] / 255.0
    L = lum(rgb)
    out = ramp(np.clip((L - 0.55) / 0.45, 0, 1), [(0, '#0c0a0a'), (0.45, '#221d1d'), (0.8, '#3e3633'), (1, '#5e544e')])
    h, w = a.shape
    n = noise(h, w, 31, 1.2)
    specks = (n > 0.8) * (np.random.default_rng(3).random((h, w)) > 0.86)
    out = glow_onto(out, a, gaussian_filter(specks.astype(float), 0.8) * 2.5, 0.9)
    Image.fromarray(np.dstack([np.clip(out, 0, 255), a * 255]).astype(np.uint8), 'RGBA').save('images/emberfall/dg-ash.png', optimize=True)


def strip_moss():
    """Cave moss for Earth-dungeon floors: the meadow strip darkened and tinted toward wet moss."""
    im = np.asarray(Image.open('images/emberfall/grass-meadow.png').convert('RGBA')).astype(np.float64)
    rgb, a = im[..., :3], im[..., 3] / 255.0
    L = lum(rgb)
    out = ramp(L, [(0, '#060c06'), (0.4, '#1a3214'), (0.7, '#3c6a26'), (1, '#86b450')])
    Image.fromarray(np.dstack([np.clip(out, 0, 255), a * 255]).astype(np.uint8), 'RGBA').save('images/emberfall/dg-moss.png', optimize=True)


if __name__ == '__main__':
    basalt('rock2', 'basalt0', 11)
    basalt('rock4', 'basalt1', 12)
    basalt('boulder1', 'basalt2', 13)
    ember_crystal('ice0', 'ember0')
    ember_crystal('ice1', 'ember1')
    charred('dead1', 'charred0', 21)
    charred('dead0', 'charred1', 22)
    dripstone('icicles0', 'drip-fire0', True)
    dripstone('icicles0', 'drip-rock0', False)
    roots('vine0', 'roots0')
    roots('vine1', 'roots1')
    cave_crystal('ice1', 'crystal-green0', [(0, '#05200f'), (0.4, '#13603a'), (0.75, '#3cc47c'), (1, '#d8ffe4')])
    mushroom('shroom0', 5, [(70, 70, 34), (120, 110, 46), (170, 52, 26)], [(0, '#0a3a3a'), (0.5, '#1f9a8a'), (0.85, '#6fe8d0'), (1, '#e0fff6')], [(0, '#4a5048'), (1, '#d8dcc8')])
    mushroom('shroom1', 6, [(90, 60, 30), (140, 84, 38)], [(0, '#3a1030'), (0.5, '#9a3a8a'), (0.85, '#e88ad8'), (1, '#ffe8fa')], [(0, '#4a4448'), (1, '#dcd4d8')])
    mushroom('shroom2', 7, [(80, 46, 40), (150, 66, 52)], [(0, '#3a2410'), (0.5, '#a0642a'), (0.85, '#e0a860'), (1, '#fff0d8')], [(0, '#4a4438'), (1, '#e0d8c8')], glow=False)
    strip_ash()
    strip_moss()
    json.dump(META, open(os.path.join(FL, 'flora.json'), 'w'), indent=None, separators=(',', ':'))
    print('ok', len(META))

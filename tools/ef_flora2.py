"""EmberFall frontier flora (c55): frosted pines and spruces, dead trees, stumps and fallen logs, snowy rocks,
ice crystals, heather, snowy bushes and hanging icicles. Uses the painters in ef_flora.py and adds its entries
to images/emberfall/flora/flora.json."""
import os
import json
import math
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, distance_transform_edt
import ef_flora as F
from ef_flora import Canvas, grow, paint_branches, paint_foliage, fit_canvas, shift, finish, noise_at, hexc, LIGHT
from ef_common import ramp

SPRUCE_LEAF = [(0, '#081510'), (0.3, '#10251c'), (0.55, '#183a2a'), (0.78, '#245036'), (1, '#4c7a5c')]
LARCH_LEAF = [(0, '#1c2410'), (0.3, '#36461a'), (0.55, '#5f7224'), (0.78, '#93a43a'), (1, '#d2cc6a')]
HEATHER = [(0, '#1e2414'), (0.4, '#38452a'), (0.75, '#56663a'), (1, '#7c8a54')]
BARK_DEAD = [(0, '#211c18'), (0.35, '#4a423a'), (0.65, '#7a7064'), (0.9, '#a39888'), (1, '#c2b8a8')]


def frost(cv, seed, amount, up_only=True):
    """Snow / hoarfrost resting on every upward-facing edge of a sprite."""
    a = cv.a
    up = np.zeros_like(a)
    up[3:] = np.clip(a[3:] - a[:-3], 0, 1)
    up = gaussian_filter(up, 2.0) * 4
    n = noise_at(cv.h, cv.w, seed, 1.2)
    sn = np.clip(up * amount * (0.4 + n), 0, 1)
    col = ramp(np.clip(n, 0, 1), [(0, '#cfdae4'), (0.6, '#eef3f7'), (1, '#ffffff')])
    cv.rgb = cv.rgb * (1 - sn[..., None]) + col * sn[..., None]


def frost_cap(cv, seed, thick, slope_k=1.0):
    """A thick cap of snow over the top of a solid sprite (rocks, logs): every pixel within `thick` of the first
    opaque pixel of its column, thinner where the outline is steep, with a soft blue underside."""
    a = cv.a > 0.5
    h, w = a.shape
    first = np.where(a.any(0), a.argmax(0), h).astype(np.float64)
    sl = np.abs(np.gradient(gaussian_filter(first, 2)))
    th = thick * np.clip(1.2 - sl * 0.5 * slope_k, 0, 1.2) * (0.75 + 0.5 * noise_at(1, w, seed, 1.6)[0])
    d = cv.yy - first[None, :]
    m = np.clip((th[None, :] - d) / 2.0, 0, 1) * (d >= 0) * cv.a
    shade = np.clip(d / np.maximum(th[None, :], 1), 0, 1)
    col = ramp(shade, [(0, '#ffffff'), (0.6, '#e6eef5'), (1, '#b9cadb')])
    col *= (0.95 + 0.1 * noise_at(h, w, seed + 1, 1.0))[..., None]
    cv.rgb = cv.rgb * (1 - m[..., None]) + col * m[..., None]


def spruce(name, seed, W=380, H=1150, snow=0.0, pal=SPRUCE_LEAF):
    """A narrow, dense spruce: short drooping tiers right to the ground."""
    rng = np.random.default_rng(seed)
    tw = W * 0.04
    segs = [(0, 0, rng.normal(0, 2), -H * 0.97, tw, tw * 0.1)]
    clumps = []
    top = -H * 0.99
    n = 26
    for i in range(n):
        t = i / (n - 1)
        ty = top + (-H * 0.05 - top) * t ** 0.95
        half = W * (0.03 + 0.42 * t ** 0.85) * rng.uniform(0.85, 1.12)
        for side in (-1, 1):
            m = int(2 + t * 6)
            for k in range(m):
                u = (k + 0.5) / m
                x = side * u * half
                y = ty + u * u * H * (0.02 + 0.06 * t) + rng.normal(0, 2)
                r = W * (0.025 + 0.05 * t) * (1.1 - 0.5 * u) * rng.uniform(0.85, 1.15)
                clumps.append((x, y, r))
                clumps.append((x, y + r * 0.7, r * 0.5))
    cv, dx, dy = fit_canvas(segs, clumps, 0)
    segs, clumps = shift(segs, clumps, dx, dy)
    paint_branches(cv, segs, F.BARK_PINE, seed + 10)
    paint_foliage(cv, clumps, pal, seed + 20, leaf=3.8, holes=0.04, ao_floor=0.28, rim=0.14)
    if snow > 0:
        frost(cv, seed + 30, snow)
    return finish(cv, name, dx, ground_pad=16)


def frosted_pine(name, seed, H, amount):
    rng = np.random.default_rng(seed)
    # reuse the pine painter without its own snow, then frost it here (lighter, patchier than pine-snow)
    W = 440
    base_x, base_y = 0.0, 0.0
    tw = W * 0.035
    segs = [(base_x, base_y, base_x + rng.normal(0, 3), base_y - H * 0.95, tw, tw * 0.12)]
    clumps = []
    top = base_y - H * 0.97
    n = 18
    for i in range(n):
        t = i / (n - 1)
        ty = top + (base_y - H * 0.14 - top) * t ** 0.9
        half = W * (0.04 + 0.46 * t ** 0.9) * rng.uniform(0.85, 1.1)
        droop = H * (0.015 + 0.05 * t)
        for side in (-1, 1):
            m = int(3 + t * 7)
            for k in range(m):
                u = (k + 0.5) / m
                x = base_x + side * u * half
                y = ty + u * u * droop + rng.normal(0, 3)
                r = W * (0.02 + 0.05 * t) * (1.15 - 0.55 * u) * rng.uniform(0.85, 1.15)
                clumps.append((x, y, r))
                clumps.append((x, y + r * 0.6, r * 0.55))
    cv, dx, dy = fit_canvas(segs, clumps, base_y)
    segs, clumps = shift(segs, clumps, dx, dy)
    paint_branches(cv, segs, F.BARK_PINE, seed + 10)
    paint_foliage(cv, clumps, F.PINE_LEAF, seed + 20, leaf=4.2, holes=0.06, ao_floor=0.3, rim=0.16)
    frost(cv, seed + 30, amount)
    # a cooler cast overall
    cv.rgb = cv.rgb * np.array([0.93, 0.98, 1.04])[None, None, :]
    return finish(cv, name, base_x + dx, ground_pad=16)


def dead_tree(name, seed, W=640, H=900, snow=0.0):
    rng = np.random.default_rng(seed)
    segs, tips = [], []
    grow(rng, 0, 0, rng.normal(0, 0.08), H * 0.42, W * 0.045, 4, segs, tips, spread=0.7, decay=0.68, kinks=3)
    cv, dx, dy = fit_canvas(segs, [], 0, margin=30)
    segs, _ = shift(segs, [], dx, dy)
    paint_branches(cv, segs, BARK_DEAD, seed + 10)
    if snow > 0:
        frost(cv, seed + 30, snow)
    return finish(cv, name, dx, ground_pad=16)


def stump(name, seed, W=260, H=200, snow=0.0):
    """A sawn stump: bark sides, pale rings on top, roots spreading into the ground."""
    rng = np.random.default_rng(seed)
    cv = Canvas(W, H)
    cx = W / 2
    top = H * 0.35
    rx = W * 0.3
    X = (cv.xx - cx) / rx
    body = (np.abs(X) < 1 - 0.08 * (cv.yy - top) / H) & (cv.yy > top) & (cv.yy < H - 8)
    # flare at the base
    flare = (cv.yy > H * 0.7) & (np.abs(X) < 1.0 + (cv.yy - H * 0.7) / (H * 0.3) * 0.5) & (cv.yy < H - 8)
    m = body | flare
    nx = np.clip(X, -1, 1)
    lit = 0.55 + 0.45 * np.clip(-nx * 0.8 + 0.2, -0.5, 1)
    bark = ramp(noise_at(H, W, seed, 1.0) * 0.5 + (np.sin(cv.xx * 0.25 + noise_at(H, W, seed + 1, 1.5) * 6) * 0.5 + 0.5) * 0.5,
                F.BARK_OAK)
    cv.over(bark * lit[..., None], m.astype(float))
    # top: ellipse with rings
    Y = (cv.yy - top) / (rx * 0.32)
    d = np.sqrt(X * X + Y * Y)
    topm = (d < 1).astype(float)
    rings = 0.75 + 0.15 * np.sin(d * 40 + noise_at(H, W, seed + 2, 1.4) * 4)
    tcol = hexc('#c9a878')[None, None, :] * rings[..., None] * (1 - 0.35 * d)[..., None]
    cv.over(tcol, topm)
    if snow > 0:
        cap = (d < 1.08) & (cv.yy < top + 4)
        cv.over(np.broadcast_to(hexc('#eef3f7'), (H, W, 3)) * 1.0, cap.astype(float) * snow)
    cv.a[H - 8:, :] = 0
    return finish(cv, name, cx, ground_pad=8)


def log(name, seed, W=760, H=230, snow=0.0, moss=0.5):
    """A fallen trunk lying on its side: a lit cylinder with deep bark furrows, a broken pale end, patchy moss."""
    rng = np.random.default_rng(seed)
    cv = Canvas(W, H)
    cy = H * 0.56
    r = H * 0.36
    x0, x1 = W * 0.05, W * 0.95
    taper = 1 - 0.22 * (cv.xx - x0) / (x1 - x0)
    wob = (noise_at(1, W, seed + 9, 2.0)[0][None, :] - 0.5) * r * 0.12
    Y = (cv.yy - cy - wob) / (r * taper)
    m = (np.abs(Y) < 1) & (cv.xx > x0) & (cv.xx < x1 - r * 0.6 * (1 - np.sqrt(np.clip(1 - Y ** 2, 0, 1))))
    ny = np.clip(Y, -1, 1)
    nz = np.sqrt(np.clip(1 - ny * ny, 0, 1))
    lit = np.clip(0.18 + 0.95 * (nz * 0.62 - ny * 0.55), 0.12, 1.15)
    fur = noise_at(H, W, seed + 1, 1.2)
    furrow = np.abs(np.sin(cv.yy / (r * taper) * 9 + fur * 7 + cv.xx * 0.004)) ** 0.5
    bark = ramp(np.clip(furrow * 0.7 + noise_at(H, W, seed, 1.0) * 0.3, 0, 1), F.BARK_OAK)
    cv.over(bark * lit[..., None], m.astype(float))
    endx = (cv.xx - x0) / (r * 0.32)
    rr = np.sqrt(endx ** 2 + Y ** 2)
    endm = (rr < 1) & m
    cv.over(hexc('#b89a6c')[None, None, :] * ((0.78 + 0.18 * np.sin(rr * 22)) * (1.05 - 0.3 * rr))[..., None], endm.astype(float))
    if moss > 0:
        mm = np.clip((-ny - 0.55) * 3.0 + (noise_at(H, W, seed + 5, 1.8) - 0.5) * 2.2, 0, 1) * m * moss
        mc = ramp(noise_at(H, W, seed + 6, 1.0), [(0, '#2f4a1c'), (0.6, '#557a2a'), (1, '#86a446')]) * np.clip(lit, 0.5, 1.1)[..., None]
        cv.rgb = cv.rgb * (1 - mm[..., None]) + mc * mm[..., None]
    if snow > 0:
        frost_cap(cv, seed + 7, r * 0.42 * snow, slope_k=0.4)
    cv.a[H - 6:, :] = 0
    return finish(cv, name, W / 2, ground_pad=int(H * 0.16))


def snow_rock(name, seed, W, H, amount=1.0):
    im = F.rock(name, seed, W=W, H=H, moss=0.0, tone=('#3e444c', '#626a74', '#8e96a0', '#c3c9d0'))
    # rock() saved the sprite; reload it, frost it, save again
    p = os.path.join(F.OUT, name + '.png')
    arr = np.asarray(Image.open(p).convert('RGBA')).astype(np.float64)
    h, w = arr.shape[:2]
    cv = Canvas(w, h)
    cv.rgb = arr[..., :3]
    cv.a = arr[..., 3] / 255
    frost_cap(cv, seed + 40, max(10, h * 0.16) * amount)
    frost(cv, seed + 41, 0.8)
    Image.fromarray(np.dstack([np.clip(cv.rgb, 0, 255), cv.a * 255]).astype(np.uint8), 'RGBA').save(p, optimize=True)


def ice(name, seed, W=320, H=300):
    """A cluster of ice crystals: tall faceted prisms, translucent blue with bright edges."""
    rng = np.random.default_rng(seed)
    cv = Canvas(W, H)
    n = 7
    for k in range(n):
        ang = rng.normal(0, 0.35)
        L = H * rng.uniform(0.35, 0.92) * (1 - abs(k - n / 2) / n * 0.6)
        bx = W / 2 + rng.normal(0, W * 0.14)
        by = H - 10
        hw = L * rng.uniform(0.09, 0.15)
        # local coords along the crystal
        dx = math.sin(ang)
        dy = -math.cos(ang)
        U = (cv.xx - bx) * dx + (cv.yy - by) * dy          # along
        V = (cv.xx - bx) * dy - (cv.yy - by) * dx          # across
        tipk = np.clip((L - U) / (hw * 1.6), 0, 1)
        inside = (U > 0) & (U < L) & (np.abs(V) < hw * tipk)
        face = np.where(V < 0, 1.0, 0.62)
        t = np.clip(U / L, 0, 1)
        col = ramp(t * 0.6 + face * 0.4, [(0, '#5d8fb8'), (0.5, '#a9d6f0'), (1, '#f2fbff')])
        edge = np.clip(1 - np.abs(np.abs(V) - hw * tipk) / 1.6, 0, 1) * inside
        col = col * (1 - edge[..., None] * 0.7) + 255 * edge[..., None] * 0.7
        cv.over(col, inside.astype(float) * 0.88)
    cv.a[H - 8:, :] = 0
    return finish(cv, name, W / 2, ground_pad=6)


def icicles(name, seed, W=420, H=200):
    """A fringe of icicles hanging from a ledge top (anchored at the top)."""
    rng = np.random.default_rng(seed)
    cv = Canvas(W, H)
    shelf = (cv.yy < 10)
    cv.over(np.broadcast_to(hexc('#dfeaf2'), (H, W, 3)) * 1.0, shelf.astype(float))
    for k in range(28):
        x = rng.uniform(4, W - 4)
        L = H * rng.uniform(0.15, 0.95) ** 1.6
        w = rng.uniform(3, 8)
        m = (cv.yy < L) & (np.abs(cv.xx - x) < w * (1 - cv.yy / max(L, 1)))
        lit = 0.8 + 0.3 * np.clip(-(cv.xx - x) / w, -1, 1)
        col = ramp(cv.yy / max(L, 1), [(0, '#e9f4fb'), (1, '#8fbfe0')]) * lit[..., None]
        cv.over(col, m.astype(float) * 0.9)
    return finish(cv, name, W / 2, ground_pad=0)


if __name__ == '__main__':
    import sys
    only = sys.argv[1:] or None

    def want(n):
        return not only or any(n.startswith(o) for o in only)
    F.META.clear()
    if want('pine-frost'):
        frosted_pine('pine-frost0', 330, 1040, 0.55)
        frosted_pine('pine-frost1', 336, 1180, 0.45)
    if want('spruce'):
        spruce('spruce0', 340)
        spruce('spruce1', 345, H=1300)
        spruce('spruce-snow0', 350, snow=1.1)
    if want('dead'):
        dead_tree('dead0', 370)
        dead_tree('dead1', 371, W=560, H=1000)
        dead_tree('dead-snow0', 372, snow=1.0)
    if want('stump'):
        stump('stump0', 380)
        stump('stump-snow0', 381, snow=1.0)
    if want('log'):
        log('log0', 390)
        log('log1', 391, W=620, H=200, moss=0.8)
        log('log-snow0', 392, snow=1.0, moss=0.2)
    if want('rock-snow'):
        snow_rock('rock-snow0', 730, 320, 210)
        snow_rock('rock-snow1', 731, 420, 260)
        snow_rock('boulder-snow0', 732, 620, 480)
    if want('ice'):
        ice('ice0', 740)
        ice('ice1', 741, W=420, H=420)
    if want('icicles'):
        icicles('icicles0', 750)
    if want('heather'):
        F.bush('heather0', 760, W=360, H=200, pal=HEATHER, flowers=(90, ['#9a5aa8', '#c07ac8', '#7a4a90'], 3.5), leaf=4.5)
    if want('bush-snow'):
        F.bush('bush-snow0', 770, W=380, H=230, pal=[(0, '#0e1c12'), (0.4, '#1d3324'), (0.75, '#2f4a36'), (1, '#4f6a54')])
        p = os.path.join(F.OUT, 'bush-snow0.png')
        arr = np.asarray(Image.open(p).convert('RGBA')).astype(np.float64)
        cv = Canvas(arr.shape[1], arr.shape[0])
        cv.rgb = arr[..., :3]
        cv.a = arr[..., 3] / 255
        frost_cap(cv, 771, 22)
        Image.fromarray(np.dstack([np.clip(cv.rgb, 0, 255), cv.a * 255]).astype(np.uint8), 'RGBA').save(p, optimize=True)
    path = os.path.join(F.OUT, 'flora.json')
    old = json.load(open(path)) if os.path.exists(path) else {}
    old.update(F.META)
    json.dump(old, open(path, 'w'), indent=0, sort_keys=True)
    print('ok', len(F.META), sorted(F.META))

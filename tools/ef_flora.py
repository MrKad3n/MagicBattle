"""EmberFall flora: painted trees, bushes, flowers, rocks, reeds and ferns.
Rendered at 2x with per-pixel lighting (sun from the upper left), then downsampled.
Output: images/emberfall/flora/<name>.png, plus flora.json with each sprite's size and ground anchor."""
import os
import json
import math
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, distance_transform_edt
from ef_common import fbm, ramp, hexc, save_rgba, premul_resize, trim

OUT = os.path.join(os.path.dirname(__file__), '..', 'images', 'emberfall', 'flora')
os.makedirs(OUT, exist_ok=True)
META = {}
LIGHT = np.array([-0.55, -0.62, 0.56])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def noise_at(h, w, seed, beta=2.0):
    return fbm(h, w, beta, seed)


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.rgb = np.zeros((h, w, 3))
        self.a = np.zeros((h, w))
        self.yy, self.xx = np.mgrid[0:h, 0:w].astype(np.float64)

    def over(self, rgb, a, box=None):
        if box is None:
            self.rgb = self.rgb * (1 - a[..., None]) + rgb * a[..., None]
            self.a = a + self.a * (1 - a)
        else:
            y0, y1, x0, x1 = box
            R = self.rgb[y0:y1, x0:x1]
            A = self.a[y0:y1, x0:x1]
            self.rgb[y0:y1, x0:x1] = R * (1 - a[..., None]) + rgb * a[..., None]
            self.a[y0:y1, x0:x1] = a + A * (1 - a)


# ---------------------------------------------------------------- branches
def grow(rng, x, y, ang, length, width, depth, out, tips, spread=0.55, decay=0.72, kinks=3, droop=0.0):
    """Recursive branch skeleton. ang: radians, 0 = up. Appends segments (x0,y0,x1,y1,w0,w1) to out."""
    px, py = x, y
    a = ang
    seg_len = length / kinks
    pts = [(px, py, width)]
    for k in range(kinks):
        a += rng.normal(0, 0.16) + droop * math.sin(a) * 0.25
        nx = px + math.sin(a) * seg_len
        ny = py - math.cos(a) * seg_len
        wk = width * (1 - (k + 1) / kinks * 0.42)
        out.append((px, py, nx, ny, pts[-1][2], wk))
        pts.append((nx, ny, wk))
        px, py = nx, ny
    if depth <= 0 or width < 1.6:
        tips.append((px, py, length, a))
        return
    n = rng.integers(2, 4)
    for i in range(n):
        frac = rng.uniform(0.55, 1.0) if i else 1.0
        idx = min(len(pts) - 1, max(1, int(round(frac * kinks))))
        bx, by, bw = pts[idx]
        side = -1 if i % 2 == 0 else 1
        da = side * rng.uniform(0.25, 1.0) * spread * (1.0 if i else 0.5)
        grow(rng, bx, by, a + da, length * rng.uniform(decay - 0.1, decay + 0.06), bw * rng.uniform(0.62, 0.8),
             depth - 1, out, tips, spread, decay, kinks, droop)
    if rng.random() < 0.35:
        tips.append((px, py, length * 0.6, a))


def paint_branches(cv, segs, bark, seed, dark=0.0):
    """Cylinder-shaded branches with bark streaks."""
    streak = noise_at(cv.h, cv.w, seed, 1.0)
    streak2 = gaussian_filter(np.random.default_rng(seed + 1).random((cv.h, cv.w)), (6, 0.7), mode='wrap')
    streak2 = (streak2 - streak2.min()) / (np.ptp(streak2) + 1e-9)
    for (x0, y0, x1, y1, w0, w1) in segs:
        pad = max(w0, w1) + 3
        xa, xb = int(max(0, min(x0, x1) - pad)), int(min(cv.w, max(x0, x1) + pad + 1))
        ya, yb = int(max(0, min(y0, y1) - pad)), int(min(cv.h, max(y0, y1) + pad + 1))
        if xa >= xb or ya >= yb:
            continue
        X = cv.xx[ya:yb, xa:xb]
        Y = cv.yy[ya:yb, xa:xb]
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy + 1e-9
        t = np.clip(((X - x0) * dx + (Y - y0) * dy) / L2, 0, 1)
        cx, cy = x0 + t * dx, y0 + t * dy
        rad = w0 + (w1 - w0) * t
        ddx, ddy = X - cx, Y - cy
        d = np.sqrt(ddx * ddx + ddy * ddy)
        m = np.clip((rad - d) + 0.5, 0, 1)
        if not m.any():
            continue
        # perpendicular coordinate (-1 left .. 1 right relative to the segment's normal pointing right)
        L = math.sqrt(L2)
        nx, ny = dy / L, -dx / L
        s = (ddx * nx + ddy * ny) / np.maximum(rad, 1e-3)
        s = np.clip(s, -1, 1)
        nz = np.sqrt(np.clip(1 - s * s, 0, 1))
        lit = 0.32 + 0.85 * np.clip(-s * (nx * LIGHT[0] + ny * LIGHT[1]) * 0.9 + nz * LIGHT[2] * 0.8 - 0.1 * s, 0, 1.2)
        tex = 0.75 + 0.35 * streak2[ya:yb, xa:xb] + 0.15 * streak[ya:yb, xa:xb]
        col = ramp(np.clip(lit * tex * 0.8 - dark, 0, 1), bark)
        # keep the thickest (nearest) stroke on top: simple over
        cv.over(col, m, (ya, yb, xa, xb))


# ---------------------------------------------------------------- foliage
def paint_foliage(cv, clumps, pal, seed, leaf=7.0, holes=0.12, ao_floor=0.42, light_bias=0.0, rim=0.25,
                  dab_count=1.0, flowers=None, fruit=None, sheen=0.0):
    """clumps: list of (x, y, r). Builds a height field (union of spheres), perturbs it into leafy edges,
    lights it, then adds leaf dabs. pal: colour stops for the lit value."""
    h, w = cv.h, cv.w
    rng = np.random.default_rng(seed)
    ks = 7.0
    S = np.full((h, w), math.exp(-40))
    for i, (x, y, r) in enumerate(clumps):
        pad = r * 1.6 + 4
        xa, xb = int(max(0, x - pad)), int(min(w, x + pad + 1))
        ya, yb = int(max(0, y - pad)), int(min(h, y + pad + 1))
        if xa >= xb or ya >= yb:
            continue
        X = cv.xx[ya:yb, xa:xb] - x
        Y = cv.yy[ya:yb, xa:xb] - y
        d = np.sqrt(X * X + Y * Y) / r
        hh = np.where(d < 1, r * np.sqrt(np.clip(1 - d * d, 0, 1)), -(d - 1) * r * 2.2)
        S[ya:yb, xa:xb] += np.exp(np.clip(hh / ks, -40, 60))
    H = ks * np.log(S)
    inside = H > 0.5
    if not inside.any():
        return
    # leafy edge: erode/dilate the silhouette with noise
    n1 = noise_at(h, w, seed + 3, 0.9)
    n2 = noise_at(h, w, seed + 4, 2.4)
    dist_in = distance_transform_edt(inside)
    dist_out = distance_transform_edt(~inside)
    sd = dist_in - dist_out  # >0 inside
    jag = (n1 - 0.5) * leaf * 2.2 + (n2 - 0.5) * leaf * 1.6
    alpha = np.clip((sd + jag + 1.5) / 2.0, 0, 1)
    # interior holes for light to pass through
    if holes > 0:
        hn = noise_at(h, w, seed + 5, 1.3)
        hole = np.clip((hn - (1 - holes)) * 14, 0, 1) * np.clip(sd / (leaf * 3) - 0.5, 0, 1)
        alpha *= 1 - hole * 0.95
    Hs = np.where(inside, H, 0)
    Hs = gaussian_filter(Hs, 3.0)
    # leafy micro bumps
    bump = (noise_at(h, w, seed + 6, 0.5) - 0.5) * leaf * 1.2
    Hb = Hs + bump
    gy, gx = np.gradient(Hb)
    nz = np.ones_like(gx)
    nrm = np.sqrt(gx * gx + gy * gy + nz * nz)
    ndl = (-gx * LIGHT[0] * -1 * -1 + 0) / nrm  # placeholder (overwritten below)
    ndl = (gx * -LIGHT[0] * -1 + gy * -LIGHT[1] * -1 + nz * LIGHT[2]) / nrm
    ndl = (-gx * LIGHT[0] - gy * LIGHT[1] + nz * LIGHT[2]) / nrm
    # ambient occlusion: lower and deeper parts of the crown are darker
    top = cv.yy[inside].min()
    bot = cv.yy[inside].max()
    vert = np.clip((cv.yy - top) / max(1, bot - top), 0, 1)
    depth = np.clip(sd / (leaf * 8), 0, 1)
    ao = 1 - 0.45 * vert ** 1.6 - 0.22 * (1 - np.clip(Hs / (np.percentile(Hs[inside], 90) + 1e-6), 0, 1))
    ao = np.clip(ao, ao_floor, 1)
    val = np.clip(0.18 + 0.82 * np.clip(ndl, 0, 1), 0, 1) * ao + light_bias
    # rim light on the lit (upper-left) silhouette
    edge = np.clip(1 - sd / (leaf * 2.5), 0, 1) * inside
    rimmask = edge * np.clip(-(gx * 0.6 + gy * 0.8) / (nrm + 1e-6) * 3, 0, 1)
    val = val + rim * rimmask
    val += (noise_at(h, w, seed + 7, 1.8) - 0.5) * 0.16
    rgb = ramp(np.clip(val, 0, 1), pal)
    if sheen:
        rgb = rgb * (1 - sheen * edge[..., None]) + hexc('#c7d68a')[None, None, :] * sheen * edge[..., None] * np.clip(ndl, 0, 1)[..., None]
    # leaf dabs: small ellipses sampled from the shaded colour, brighter on the lit side
    ys, xs = np.nonzero(alpha > 0.4)
    nd = int(len(xs) / (leaf * leaf) * 0.9 * dab_count)
    if nd > 0:
        pick = rng.integers(0, len(xs), nd)
        order = np.argsort(cv.yy[ys[pick], xs[pick]] * -1 + rng.random(nd) * 40)
        for k in order:
            px, py = xs[pick[k]], ys[pick[k]]
            rl = leaf * rng.uniform(0.55, 1.05)
            rs = rl * rng.uniform(0.35, 0.6)
            th = rng.uniform(0, math.pi)
            # jitter outward at the edge so the silhouette is made of leaves
            ox = rng.normal(0, leaf * 0.4)
            oy = rng.normal(0, leaf * 0.4)
            cx, cy = px + ox, py + oy
            xa, xb = int(max(0, cx - rl - 1)), int(min(w, cx + rl + 2))
            ya, yb = int(max(0, cy - rl - 1)), int(min(h, cy + rl + 2))
            if xa >= xb or ya >= yb:
                continue
            X = cv.xx[ya:yb, xa:xb] - cx
            Y = cv.yy[ya:yb, xa:xb] - cy
            u = (X * math.cos(th) + Y * math.sin(th)) / rl
            v = (-X * math.sin(th) + Y * math.cos(th)) / rs
            dd = u * u + v * v
            m = np.clip((1 - dd) * 3, 0, 1)
            base = rgb[min(h - 1, py), min(w - 1, px)]
            var = rng.uniform(0.86, 1.16)
            leaf_shade = 0.92 + 0.16 * np.clip(-u * 0.5 - v * 0.6, -1, 1)
            col = base[None, None, :] * var * leaf_shade[..., None]
            rgb[ya:yb, xa:xb] = rgb[ya:yb, xa:xb] * (1 - m[..., None]) + col * m[..., None]
            alpha[ya:yb, xa:xb] = np.maximum(alpha[ya:yb, xa:xb], m * min(1.0, 0.4 + 0.6 * float(np.clip(sd[min(h - 1, py), min(w - 1, px)] / leaf + 0.6, 0, 1))))
    for spec in (flowers, fruit):
        if not spec:
            continue
        count, cols, size = spec
        ys2, xs2 = np.nonzero((alpha > 0.8) & (sd > leaf))
        if len(xs2) == 0:
            continue
        pick = rng.integers(0, len(xs2), count)
        for k in pick:
            cx, cy = xs2[k], ys2[k]
            rr = size * rng.uniform(0.75, 1.2)
            xa, xb = int(max(0, cx - rr - 1)), int(min(w, cx + rr + 2))
            ya, yb = int(max(0, cy - rr - 1)), int(min(h, cy + rr + 2))
            X = cv.xx[ya:yb, xa:xb] - cx
            Y = cv.yy[ya:yb, xa:xb] - cy
            d = np.sqrt(X * X + Y * Y)
            m = np.clip((rr - d) * 0.9, 0, 1)
            c = hexc(cols[rng.integers(len(cols))])
            sh = 0.75 + 0.45 * np.clip((-X - Y) / (rr * 1.4), -1, 1)
            lv = float(np.clip(val[cy, cx], 0.35, 1.1))
            col = c[None, None, :] * (sh * (0.55 + 0.5 * lv))[..., None]
            rgb[ya:yb, xa:xb] = rgb[ya:yb, xa:xb] * (1 - m[..., None]) + col * m[..., None]
    cv.over(rgb, np.clip(alpha, 0, 1))


def fit_canvas(segs, clumps, base_y, margin=40):
    """Size a canvas around a skeleton + crown and return (canvas, dx, dy) to shift coordinates by."""
    xs = [min(a[0], a[2]) - a[4] for a in segs] + [c[0] - c[2] * 1.4 for c in clumps]
    xe = [max(a[0], a[2]) + a[4] for a in segs] + [c[0] + c[2] * 1.4 for c in clumps]
    ys = [min(a[1], a[3]) - a[4] for a in segs] + [c[1] - c[2] * 1.4 for c in clumps]
    x0, x1 = min(xs) - margin, max(xe) + margin
    y0 = min(ys) - margin
    y1 = base_y + 30
    W = int(math.ceil(x1 - x0))
    H = int(math.ceil(y1 - y0))
    W += W % 2
    H += H % 2
    return Canvas(W, H), -x0, -y0


def shift(segs, clumps, dx, dy):
    segs2 = [(a[0] + dx, a[1] + dy, a[2] + dx, a[3] + dy, a[4], a[5]) for a in segs]
    cl2 = [(c[0] + dx, c[1] + dy, c[2]) for c in clumps]
    return segs2, cl2


def finish(cv, name, anchor_x=None, down=2, ground_pad=0):
    im = Image.fromarray(np.dstack([np.clip(cv.rgb, 0, 255), np.clip(cv.a, 0, 1) * 255]).astype(np.uint8), 'RGBA')
    im = premul_resize(im, (cv.w // down, cv.h // down))
    full_w, full_h = im.size
    im2, (ox, oy) = trim(im, 2)
    ax = (anchor_x if anchor_x is not None else cv.w / 2) / down - ox
    META[name] = {'w': im2.width, 'h': im2.height, 'ax': round(ax / im2.width, 4), 'base': im2.height - ground_pad}
    im2.save(os.path.join(OUT, name + '.png'), optimize=True)
    return im2


OAK_LEAF = [(0, '#13250f'), (0.22, '#1f3a14'), (0.45, '#33571c'), (0.65, '#4c7524'), (0.82, '#6e942f'), (1, '#a6bf55')]
OAK_LEAF_AUT = [(0, '#2a1a0b'), (0.25, '#4f2e10'), (0.5, '#86501a'), (0.7, '#b77a24'), (0.86, '#d9a23b'), (1, '#f0cd6b')]
BIRCH_LEAF = [(0, '#1d2f12'), (0.3, '#36561c'), (0.55, '#5a8128'), (0.78, '#86aa3a'), (1, '#c5d873')]
PINE_LEAF = [(0, '#0b1a12'), (0.3, '#142c1d'), (0.55, '#1f422a'), (0.78, '#2f5c36'), (1, '#5a8a52')]
APPLE_LEAF = [(0, '#152a10'), (0.3, '#2a4a18'), (0.55, '#41691f'), (0.8, '#62902c'), (1, '#9ec153')]
WILLOW_LEAF = [(0, '#1a2a12'), (0.3, '#30491c'), (0.55, '#4f6f28'), (0.8, '#7b9a3c'), (1, '#b3c86a')]
BARK_OAK = [(0, '#1c130d'), (0.35, '#3a2a1d'), (0.6, '#5b4532'), (0.85, '#7d6550'), (1, '#9a836b')]
BARK_BIRCH = [(0, '#3b3834'), (0.3, '#8f8b84'), (0.6, '#cfcac0'), (0.85, '#ece8df'), (1, '#fbf8f1')]
BARK_PINE = [(0, '#1e120c'), (0.4, '#43291a'), (0.7, '#6a4428'), (1, '#8a6040')]


def crown_tree(name, seed, W=760, H=900, trunk_frac=0.42, crown_w=1.0, crown_h=0.62, pal=OAK_LEAF, bark=BARK_OAK,
               fruit=None, flowers=None, leaf=9.0, lean=0.0, limbs=4, holes=0.1, birch_marks=False, trunk_w=0.05):
    """Deciduous tree: a trunk forking into a few limbs that reach into a domed crown envelope filled with leaf masses."""
    rng = np.random.default_rng(seed)
    base_x, base_y = 0.0, 0.0
    tw = W * trunk_w
    th = H * trunk_frac
    cw = W * 0.5 * crown_w           # crown half width
    ch = H * crown_h                 # crown height
    ccx = base_x + lean * W * 0.15
    ctop = base_y - th - ch * 0.92
    segs = []
    # trunk with a gentle S curve
    kinks = 4
    px, py = base_x, base_y
    for k in range(kinks):
        t1 = (k + 1) / kinks
        nx = base_x + (ccx - base_x) * t1 ** 1.5 + math.sin(t1 * 3.0 + seed) * tw * 0.35
        ny = base_y - th * t1
        w0 = tw * (1.25 - 0.45 * k / kinks) if k == 0 else tw * (1 - 0.35 * k / kinks)
        w1 = tw * (1 - 0.35 * (k + 1) / kinks)
        segs.append((px, py, nx, ny, w0 * (1.25 if k == 0 else 1), w1))
        px, py = nx, ny
    fork_x, fork_y = px, py
    # limbs into the crown, each with a few twigs
    clumps = []
    for i in range(limbs):
        u = (i + 0.5) / limbs * 2 - 1
        tx = ccx + u * cw * rng.uniform(0.55, 0.85)
        ty = ctop + ch * rng.uniform(0.25, 0.5) + abs(u) * ch * 0.18
        mx = fork_x + (tx - fork_x) * 0.45 + rng.normal(0, tw * 0.6)
        my = fork_y + (ty - fork_y) * 0.55
        lw = tw * rng.uniform(0.45, 0.6)
        segs.append((fork_x, fork_y, mx, my, lw, lw * 0.75))
        segs.append((mx, my, tx, ty, lw * 0.75, lw * 0.35))
        for k in range(3):
            ex = tx + rng.normal(0, cw * 0.18)
            ey = ty - rng.uniform(0, ch * 0.25)
            ex = ccx + np.clip(ex - ccx, -cw * 0.6, cw * 0.6)
            segs.append((tx, ty, ex, ey, lw * 0.35, lw * 0.15))
    # leaf masses: points inside a dome envelope, larger toward the middle
    N = int(26 * crown_w + 18)
    for k in range(N * 3):
        if len(clumps) >= N:
            break
        x = rng.uniform(-1, 1)
        y = rng.uniform(0, 1)  # 0 = top of crown, 1 = bottom
        # dome: wide at 55% height, rounded top, flatter bottom
        prof = math.sqrt(max(0.0, 1 - ((y - 0.55) / 0.6) ** 2)) if y < 0.55 else math.sqrt(max(0.0, 1 - ((y - 0.55) / 0.5) ** 2))
        if y > 0.8 and abs(x) < 0.25 and rng.random() < 0.7:
            continue  # leave the underside open so the limbs show
        if abs(x) > prof * 0.92:
            continue
        r = cw * rng.uniform(0.2, 0.34) * (1.0 - 0.35 * abs(x))
        clumps.append((ccx + x * cw, ctop + y * ch, r))
    # edge clusters break up the outline
    for k in range(int(14 * crown_w)):
        a = rng.uniform(-math.pi * 0.95, -math.pi * 0.05) if k % 3 else rng.uniform(0, math.pi)
        ex = ccx + math.cos(a) * cw * 0.95
        ey = ctop + ch * 0.55 + math.sin(a) * (ch * 0.58 if math.sin(a) < 0 else ch * 0.42)
        clumps.append((ex, ey, cw * rng.uniform(0.12, 0.2)))
    cv, dx, dy = fit_canvas(segs, clumps, base_y)
    segs, clumps = shift(segs, clumps, dx, dy)
    paint_branches(cv, segs, bark, seed + 10)
    if birch_marks:
        rng2 = np.random.default_rng(seed + 11)
        for (x0, y0, x1, y1, w0, w1) in segs[:kinks + limbs * 2]:
            for k in range(7):
                t = rng2.random()
                x = x0 + (x1 - x0) * t
                y = y0 + (y1 - y0) * t
                ww = (w0 + (w1 - w0) * t) * rng2.uniform(0.5, 1.0)
                X = cv.xx - x
                Y = cv.yy - y
                m = np.clip(1 - ((X / ww) ** 2 + (Y / (ww * 0.2)) ** 2), 0, 1) * (cv.a > 0.5)
                cv.rgb = cv.rgb * (1 - 0.8 * m[..., None]) + hexc('#2a2622')[None, None, :] * 0.8 * m[..., None]
    paint_foliage(cv, clumps, pal, seed + 20, leaf=leaf, holes=holes, fruit=fruit, flowers=flowers)
    return finish(cv, name, base_x + dx, ground_pad=16)


def oak(name, seed, W=760, H=900, trunk_h=0.36, crown=1.0, pal=OAK_LEAF, fruit=None, flowers=None, spread=0.62):
    rng = np.random.default_rng(seed)
    return crown_tree(name, seed, W=W, H=H, trunk_frac=trunk_h + 0.08, crown_w=crown, crown_h=0.6, pal=pal,
                      fruit=fruit, flowers=flowers, lean=rng.normal(0, 0.4), limbs=4 + int(crown > 1.05))


def birch(name, seed, W=520, H=980):
    rng = np.random.default_rng(seed)
    return crown_tree(name, seed, W=640, H=H, trunk_frac=0.5, crown_w=0.8, crown_h=0.52, pal=BIRCH_LEAF, bark=BARK_BIRCH,
                      leaf=6.0, lean=rng.normal(0, 0.4), limbs=3, holes=0.25, birch_marks=True, trunk_w=0.03)


def pine(name, seed, W=440, H=1100, snow=0.0):
    rng = np.random.default_rng(seed)
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
                # hanging needle fringe under the branch
                clumps.append((x, y + r * 0.6, r * 0.55))
    cv, dx, dy = fit_canvas(segs, clumps, base_y)
    segs, clumps = shift(segs, clumps, dx, dy)
    paint_branches(cv, segs, BARK_PINE, seed + 10)
    paint_foliage(cv, clumps, PINE_LEAF, seed + 20, leaf=4.2, holes=0.06, ao_floor=0.3, rim=0.16)
    if snow > 0:
        a = cv.a
        up = np.zeros_like(a)
        up[2:] = np.clip(a[2:] - a[:-2], 0, 1)
        up = gaussian_filter(up, 1.8) * 4
        sn = np.clip(up * snow * (noise_at(cv.h, cv.w, seed + 30, 1.2) > 0.3), 0, 1)
        cv.rgb = cv.rgb * (1 - sn[..., None]) + hexc('#eef3f7')[None, None, :] * sn[..., None]
    return finish(cv, name, base_x + dx, ground_pad=16)


def willow(name, seed, W=900, H=860):
    rng = np.random.default_rng(seed)
    segs, tips = [], []
    base_x, base_y = 0.0, 0.0
    tw = W * 0.045
    grow(rng, base_x, base_y, 0, H * 0.3, tw, 3, segs, tips, spread=0.9, decay=0.72, kinks=3)
    clumps = []
    for (x, y, ln, a) in tips:
        r = W * 0.07
        clumps.append((x, y, r))
        for k in range(10):
            yy = y + k * r * 0.42
            if yy > base_y - 40:
                break
            clumps.append((x + rng.normal(0, r * 0.25) + math.sin(k * 0.6) * 6, yy, r * (0.55 - k * 0.025)))
    cv, dx, dy = fit_canvas(segs, clumps, base_y)
    segs, clumps = shift(segs, clumps, dx, dy)
    paint_branches(cv, segs, BARK_OAK, seed + 10)
    paint_foliage(cv, clumps, WILLOW_LEAF, seed + 20, leaf=5.5, holes=0.18, light_bias=0.03)
    return finish(cv, name, base_x + dx, ground_pad=16)


def bush(name, seed, W=420, H=260, pal=OAK_LEAF, flowers=None, leaf=6.5, berries=None):
    rng = np.random.default_rng(seed)
    cv = Canvas(W, H)
    clumps = []
    for k in range(14):
        x = W / 2 + rng.normal(0, W * 0.2)
        r = H * rng.uniform(0.22, 0.38)
        y = H - 10 - r * rng.uniform(0.55, 1.1)
        clumps.append((x, y, r))
    paint_foliage(cv, clumps, pal, seed + 3, leaf=leaf, holes=0.04, flowers=flowers, fruit=berries)
    # flatten the base onto the ground
    cv.a[H - 8:, :] = 0
    return finish(cv, name, W / 2, ground_pad=4)


def flower_clump(name, seed, cols, W=220, H=140, stem='#3e6a24'):
    rng = np.random.default_rng(seed)
    cv = Canvas(W, H)
    # leaves (low)
    clumps = [(W / 2 + rng.normal(0, W * 0.2), H - 18 - rng.uniform(0, 14), rng.uniform(14, 24)) for _ in range(9)]
    paint_foliage(cv, clumps, APPLE_LEAF, seed + 1, leaf=4.0, holes=0.0)
    # stems and blooms
    for k in range(16):
        x = W / 2 + rng.normal(0, W * 0.22)
        top = H - rng.uniform(40, H - 10)
        segs = [(x, H - 12, x + rng.normal(0, 6), top, 1.6, 1.0)]
        paint_branches(cv, segs, [(0, '#1e3510'), (1, '#5c8a34')], seed + k)
        rr = rng.uniform(6, 10)
        c = hexc(cols[rng.integers(len(cols))])
        X = cv.xx - segs[0][2]
        Y = cv.yy - top
        d = np.sqrt(X * X + Y * Y)
        ang = np.arctan2(Y, X)
        petals = rr * (0.75 + 0.25 * np.cos(ang * 5 + k))
        m = np.clip(petals - d, 0, 1)
        sh = 0.8 + 0.35 * np.clip((-X - Y) / (rr * 1.5), -1, 1)
        cv.over(c[None, None, :] * sh[..., None], m)
        m2 = np.clip(rr * 0.3 - d, 0, 1)
        cv.over(np.broadcast_to(hexc('#f2cf55'), (H, W, 3)) * 1.0, m2)
    cv.a[H - 6:, :] = 0
    return finish(cv, name, W / 2, ground_pad=4)


def rock(name, seed, W=360, H=240, moss=0.5, tone=('#2e2b28', '#55504a', '#7e776c', '#aaa194')):
    from ef_textures import voronoi_plates
    rng = np.random.default_rng(seed)
    cv = Canvas(W, H)
    ang = np.linspace(0, 2 * np.pi, 11, endpoint=False)
    rad = rng.uniform(0.78, 1.0, len(ang))
    cx, cy = W / 2, H * 0.64
    rx, ry = W * 0.45, H * 0.56
    X = (cv.xx - cx) / rx
    Y = (cv.yy - cy) / ry
    th = np.arctan2(Y, X)
    rr = np.interp(th, np.concatenate([ang - 2 * np.pi, ang, ang + 2 * np.pi]), np.concatenate([rad, rad, rad]))
    d = np.sqrt(X * X + Y * Y) / rr
    inside = (d < 1) & (cv.yy < H - 6)
    sd = distance_transform_edt(inside)
    n = 9
    cell, edge = voronoi_plates(H, W, n, seed + 1, warp=18)
    tx = rng.normal(0, 0.5, n)
    ty = rng.normal(-0.35, 0.4, n)
    # dome normal + facet tilt
    hx = X / np.maximum(rr, 0.3)
    hy = Y / np.maximum(rr, 0.3)
    nx = hx * 0.9 + tx[cell] * 0.6
    ny = hy * 0.9 + ty[cell] * 0.6
    nz = np.sqrt(np.clip(1 - np.clip(d, 0, 1) ** 2, 0.05, 1)) + 0.3
    nrm = np.sqrt(nx * nx + ny * ny + nz * nz)
    ndl = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nrm
    val = 0.1 + 0.95 * np.clip(ndl, 0, 1) ** 1.2
    val *= 1 - 0.4 * np.clip((cv.yy - cy) / ry, 0, 1)
    bev = np.clip(1 - edge / 2.2, 0, 1)
    val = val * (1 - 0.35 * bev) + 0.12 * np.clip(1 - edge / 1.0, 0, 1) * (ty[cell] < -0.3)
    val += (noise_at(H, W, seed + 3, 1.4) - 0.5) * 0.1
    rgb = ramp(np.clip(val, 0, 1), [(0, tone[0]), (0.4, tone[1]), (0.75, tone[2]), (1, tone[3])])
    tex = np.asarray(Image.open(os.path.join(OUT, '..', 'cliff.png')).convert('L')).astype(np.float64) / 255.0
    oy, ox = rng.integers(0, 256), rng.integers(0, 256)
    tex = np.roll(np.roll(tex, oy, 0), ox, 1)
    reps_y = int(np.ceil(H / 512)) + 1
    reps_x = int(np.ceil(W / 512)) + 1
    tex = np.tile(tex, (reps_y, reps_x))[:H, :W]
    rgb *= (0.55 + 0.75 * tex)[..., None]
    a = np.clip(sd / 1.5, 0, 1)
    if moss > 0:
        up = np.clip(-(ny / nrm) * 2.2 - 0.3, 0, 1)
        mm = np.clip((up + (noise_at(H, W, seed + 5, 1.6) - 0.5) * 0.9) * moss * 1.4 - 0.3, 0, 1)
        mc = ramp(noise_at(H, W, seed + 6, 1.0), [(0, '#2f4a1c'), (0.6, '#557a2a'), (1, '#86a446')])
        mc *= (0.55 + 0.55 * np.clip(ndl, 0, 1))[..., None]
        rgb = rgb * (1 - mm[..., None]) + mc * mm[..., None]
    cv.over(rgb, a)
    return finish(cv, name, W / 2, ground_pad=8)


def reeds(name, seed, W=260, H=260):
    rng = np.random.default_rng(seed)
    cv = Canvas(W, H)
    for k in range(34):
        x = W / 2 + rng.normal(0, W * 0.18)
        top = H - rng.uniform(H * 0.45, H - 8)
        lean = rng.normal(0, 18)
        segs = [(x, H - 6, x + lean * 0.5, (H + top) / 2, 3.2, 2.4), (x + lean * 0.5, (H + top) / 2, x + lean, top, 2.4, 0.6)]
        paint_branches(cv, segs, [(0, '#2a3a14'), (0.5, '#5a7a2a'), (1, '#a8b85a')], seed + k)
        if rng.random() < 0.35:
            # cattail head
            X = cv.xx - (x + lean * 0.8)
            Y = cv.yy - (top + 26)
            m = np.clip(1 - ((X / 5.5) ** 2 + (Y / 16) ** 2), 0, 1) * 3
            m = np.clip(m, 0, 1)
            sh = 0.7 + 0.4 * np.clip(-X / 5.5, -1, 1)
            cv.over(hexc('#6a4022')[None, None, :] * sh[..., None], m)
    return finish(cv, name, W / 2, ground_pad=4)


def fern(name, seed, W=300, H=200):
    rng = np.random.default_rng(seed)
    cv = Canvas(W, H)
    for k in range(9):
        a = rng.uniform(-1.3, 1.3)
        L = rng.uniform(H * 0.6, H * 0.95)
        x0, y0 = W / 2 + rng.normal(0, 8), H - 6
        pts = []
        for i in range(12):
            t = i / 11
            ang = a * (0.4 + 0.9 * t)
            pts.append((x0 + math.sin(ang) * L * t, y0 - math.cos(ang * 0.8) * L * t + (t ** 2) * L * 0.25 * abs(a)))
        segs = [(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1.8, 1.4) for i in range(11)]
        paint_branches(cv, segs, [(0, '#1e3510'), (1, '#4c7a2a')], seed + k)
        clumps = [(px, py, 9 * (1 - i / 14)) for i, (px, py) in enumerate(pts[2:])]
        paint_foliage(cv, clumps, BIRCH_LEAF, seed + 40 + k, leaf=3.2, holes=0.0, rim=0.1)
    return finish(cv, name, W / 2, ground_pad=4)


def vine_drape(name, seed, W=360, H=420):
    """Ivy hanging from a wall top."""
    rng = np.random.default_rng(seed)
    cv = Canvas(W, H)
    clumps = []
    for k in range(7):
        x = rng.uniform(20, W - 20)
        L = rng.uniform(H * 0.35, H * 0.95)
        for i in range(int(L / 16)):
            clumps.append((x + math.sin(i * 0.5 + k) * 7, 12 + i * 16, 16 - i * 0.18))
    paint_foliage(cv, clumps, OAK_LEAF, seed + 3, leaf=4.5, holes=0.12, rim=0.15)
    return finish(cv, name, W / 2, ground_pad=0)


if __name__ == '__main__':
    import sys
    only = sys.argv[1:] or None

    def want(n):
        return not only or any(n.startswith(o) or o.startswith(n) for o in only)
    for i in range(4):
        if want('oak'):
            oak('oak%d' % i, 100 + i * 7, crown=1.0 + (i % 2) * 0.12, trunk_h=0.34 + (i % 3) * 0.03)
    if want('oak'):
        oak('oak-big', 140, W=1000, H=1100, crown=1.15, trunk_h=0.34)
        oak('oak-autumn', 150, pal=OAK_LEAF_AUT)
    for i in range(2):
        if want('apple'):
            oak('apple%d' % i, 160 + i, W=600, H=640, trunk_h=0.3, crown=1.05, pal=APPLE_LEAF, fruit=(70, ['#c8341f', '#d9542a', '#b82a1c'], 6.5), spread=0.8)
    if want('blossom'):
        oak('blossom0', 170, W=640, H=680, trunk_h=0.32, pal=[(0, '#3a1e2a'), (0.3, '#7a3e58'), (0.55, '#c27a96'), (0.8, '#eab3c4'), (1, '#fde6ee')], spread=0.8)
    for i in range(3):
        if want('birch'):
            birch('birch%d' % i, 200 + i * 3)
    for i in range(3):
        if want('pine'):
            pine('pine%d' % i, 300 + i * 5, H=1000 + i * 120)
            pine('pine-snow%d' % i, 320 + i * 5, H=1000 + i * 120, snow=1.0)
    if want('willow'):
        willow('willow0', 400)
    for i in range(4):
        if want('bush'):
            bush('bush%d' % i, 500 + i, W=360 + i * 40, H=220 + (i % 2) * 40)
    if want('bush'):
        bush('bush-flower0', 520, flowers=(60, ['#f4f1e8', '#f7d64a'], 5.5))
        bush('bush-flower1', 521, flowers=(70, ['#d8648c', '#f09ab4'], 5.5))
        bush('bush-berry0', 522, berries=(50, ['#3a2a78', '#2a1e5a'], 4.5))
        bush('hedge0', 523, W=520, H=240, leaf=5.0)
    if want('flowers'):
        flower_clump('flowers-white', 600, ['#f4f1e8', '#e8e4ff'])
        flower_clump('flowers-red', 601, ['#c8341f', '#e0503a'])
        flower_clump('flowers-blue', 602, ['#5b6fd0', '#8a9af0'])
        flower_clump('flowers-gold', 603, ['#f2c53a', '#f7da6a'])
        flower_clump('flowers-pink', 604, ['#e58bb0', '#f2b5cb'])
    if want('rock'):
        for i in range(5):
            rock('rock%d' % i, 700 + i, W=280 + i * 50, H=180 + (i % 3) * 40, moss=0.3 + (i % 2) * 0.4)
        rock('boulder0', 710, W=640, H=460, moss=0.6)
        rock('boulder1', 711, W=560, H=520, moss=0.2)
        rock('rock-cold0', 720, moss=0.0, tone=('#4a5058', '#6c737c', '#959ca5', '#c7ccd2'))
    if want('reeds'):
        reeds('reeds0', 800)
        reeds('reeds1', 801)
    if want('fern'):
        fern('fern0', 850)
        fern('fern1', 851)
    if want('vine'):
        vine_drape('vine0', 900)
        vine_drape('vine1', 901)
    path = os.path.join(OUT, 'flora.json')
    old = json.load(open(path)) if os.path.exists(path) else {}
    old.update(META)
    json.dump(old, open(path, 'w'), indent=0, sort_keys=True)
    print('ok', len(META))

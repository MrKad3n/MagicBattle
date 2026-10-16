"""EmberFall terrain textures: soil, cliff rock, deep rock, grass edge strips, moss.
All textures tile horizontally and vertically (spectral noise wraps)."""
import os
import numpy as np
from PIL import Image
from ef_common import fbm, fbm_aniso, ramp, save_rgb, save_rgba, blur_wrap, hexc

OUT = os.path.join(os.path.dirname(__file__), '..', 'images', 'emberfall')
os.makedirs(OUT, exist_ok=True)


def pebbles(h, w, n, rmin, rmax, seed, cols):
    """Scatter shaded pebbles (wrapping). Returns rgb overlay and alpha."""
    r = np.random.default_rng(seed)
    rgb = np.zeros((h, w, 3))
    a = np.zeros((h, w))
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    for _ in range(n):
        cx, cy = r.uniform(0, w), r.uniform(0, h)
        rx = r.uniform(rmin, rmax)
        ry = rx * r.uniform(0.55, 0.9)
        ang = r.uniform(0, np.pi)
        base = hexc(cols[r.integers(len(cols))]) * r.uniform(0.85, 1.1)
        x0, x1 = int(cx - rx - 2), int(cx + rx + 3)
        y0, y1 = int(cy - rx - 2), int(cy + rx + 3)
        for oy in (-h, 0, h):
            for ox in (-w, 0, w):
                xa, xb = max(0, x0 + ox), min(w, x1 + ox)
                ya, yb = max(0, y0 + oy), min(h, y1 + oy)
                if xa >= xb or ya >= yb:
                    continue
                X = xx[ya:yb, xa:xb] - (cx + ox)
                Y = yy[ya:yb, xa:xb] - (cy + oy)
                u = (X * np.cos(ang) + Y * np.sin(ang)) / rx
                v = (-X * np.sin(ang) + Y * np.cos(ang)) / ry
                d = u * u + v * v
                m = np.clip((1 - d) * 6, 0, 1)
                hgt = np.sqrt(np.clip(1 - d, 0, 1))
                light = 0.55 + 0.45 * np.clip(-0.55 * u - 0.75 * v + 0.6 * hgt, -1, 1)
                col = base[None, None, :] * light[..., None]
                sel = m > a[ya:yb, xa:xb]
                rgb[ya:yb, xa:xb][sel] = col[sel]
                a[ya:yb, xa:xb] = np.maximum(a[ya:yb, xa:xb], m)
    return rgb, a


def voronoi_plates(h, w, n, seed, sx=1.0, sy=1.0, warp=0.0):
    """Tileable Voronoi: returns cell id, distance to nearest edge (px) and the 2nd-1st distance."""
    from scipy.spatial import cKDTree
    r = np.random.default_rng(seed)
    pts = np.column_stack([r.uniform(0, w, n), r.uniform(0, h, n)])
    tiles = []
    ids = []
    for oy in (-h, 0, h):
        for ox in (-w, 0, w):
            tiles.append(pts + [ox, oy])
            ids.append(np.arange(n))
    P = np.vstack(tiles)
    I = np.concatenate(ids)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    if warp:
        wx = (fbm(h, w, 2.6, seed + 101) - 0.5) * warp
        wy = (fbm(h, w, 2.6, seed + 102) - 0.5) * warp
        xx = xx + wx
        yy = yy + wy
    Q = np.column_stack([xx.ravel() * sx, yy.ravel() * sy])
    tree = cKDTree(P * [sx, sy])
    d, k = tree.query(Q, k=2)
    cell = I[k[:, 0]].reshape(h, w)
    edge = ((d[:, 1] - d[:, 0]) / 2).reshape(h, w)
    return cell, edge


def soil():
    h = w = 512
    n1 = fbm(h, w, 2.4, 11)
    n2 = fbm(h, w, 1.1, 12)
    strata = fbm_aniso(h, w, 2.6, 13, sx=1.8, sy=0.25)
    clumps = fbm(h, w, 3.2, 17)
    t = 0.45 * n1 + 0.15 * strata + 0.2 * n2 + 0.2 * clumps
    rgb = ramp(t, [(0, '#24170e'), (0.3, '#3b2817'), (0.55, '#52391f'), (0.8, '#664a2c'), (1, '#7a5c3b')])
    g = fbm(h, w, 0.3, 14)
    rgb *= (0.85 + 0.28 * g)[..., None]
    # embedded stones: irregular, muted, half sunk (shaded by a bevel from the plate field)
    cell, edge = voronoi_plates(h, w, 700, 18, warp=26)
    r = np.random.default_rng(19)
    keep = r.random(700) < 0.11
    tone = r.uniform(0.7, 1.1, 700)
    stone = keep[cell] & (edge > 2.0)
    bevel = np.clip(edge / 6.0, 0, 1) ** 0.6
    sc = ramp(fbm(h, w, 1.4, 20), [(0, '#3f3a33'), (0.5, '#5a5248'), (1, '#736a5c')])
    gy, gx = np.gradient(bevel)
    lit = np.clip(0.8 + (-gx - gy * 1.3) * 5, 0.45, 1.35) * tone[cell]
    srgb = sc * lit[..., None]
    sa = np.clip((edge - 2.0) / 2.0, 0, 1) * stone
    rgb = rgb * (1 - sa[..., None]) + srgb * sa[..., None]
    # darker rim around stones (soil pressed in)
    rim = keep[cell] & (edge <= 2.0) & (edge > 0)
    rgb[rim] *= 0.7
    # root threads
    roots = np.exp(-((fbm(h, w, 2.0, 21) - 0.5) ** 2) / 0.00006)
    rgb = rgb * (1 - 0.35 * roots[..., None]) + hexc('#2a1a0e')[None, None, :] * 0.35 * roots[..., None]
    save_rgb(rgb, os.path.join(OUT, 'soil.png'))


def cliff():
    """Rock face built from bevelled plates (Voronoi), stretched into strata. Light from the upper left."""
    h = w = 512
    cell, edge = voronoi_plates(h, w, 60, 22, sx=0.6, sy=1.0, warp=60)
    r = np.random.default_rng(23)
    n = 60
    # per-plate plane: tilt and base tone
    tx, ty = r.normal(0, 0.35, n), r.normal(-0.2, 0.3, n)
    tone = r.uniform(0.0, 1.0, n)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    strata = fbm_aniso(h, w, 2.4, 24, sx=0.1, sy=2.0)
    base = 0.5 * tone[cell] + 0.3 * strata + 0.2 * fbm(h, w, 1.6, 25)
    rgb = ramp(base, [(0, '#4a443d'), (0.3, '#615a4f'), (0.6, '#7b7262'), (0.85, '#958a75'), (1, '#ab9f86')])
    # plane shading + bevel at the edges of each plate
    bev = np.clip(edge / 10.0, 0, 1)
    gy, gx = np.gradient(bev)
    light = 0.95 + (-tx[cell] * 0.22 - ty[cell] * 0.3) + (-gx * 0.9 - gy * 1.3) * 2.2 + (fbm(h, w, 2.0, 30) - 0.5) * 0.35
    rgb *= np.clip(light, 0.45, 1.5)[..., None]
    # crevices between plates
    crev = np.clip(1 - edge / 1.8, 0, 1)
    rgb *= (1 - 0.55 * crev)[..., None]
    # sub-cracks inside plates
    sub_cell, sub_edge = voronoi_plates(h, w, 260, 28, warp=30)
    sub = np.clip(1 - sub_edge / 1.0, 0, 1) * (fbm(h, w, 2.2, 29) > 0.45)
    rgb *= (1 - 0.25 * sub)[..., None]
    # surface grain and lichen spots
    grain = fbm(h, w, 0.6, 26)
    rgb *= (0.9 + 0.2 * grain)[..., None]
    lich = np.clip((fbm(h, w, 2.8, 27) - 0.72) * 6, 0, 1) * np.clip(edge / 6, 0, 1)
    rgb = rgb * (1 - 0.35 * lich[..., None]) + hexc('#8d9a62')[None, None, :] * 0.35 * lich[..., None]
    save_rgb(rgb, os.path.join(OUT, 'cliff.png'))


def deeprock():
    h = w = 512
    t = 0.6 * fbm(h, w, 2.4, 31) + 0.4 * fbm(h, w, 1.0, 32)
    rgb = ramp(t, [(0, '#1d1a19'), (0.4, '#2c2826'), (0.7, '#3b3532'), (1, '#4c4540')])
    prgb, pa = pebbles(h, w, 50, 5, 18, 33, ['#4d4641', '#3b3532', '#57504a'])
    rgb = rgb * (1 - pa[..., None] * 0.8) + prgb * pa[..., None] * 0.8
    save_rgb(rgb, os.path.join(OUT, 'deeprock.png'))


def grass_strip(name, seed, palette, height=96, w=1024, density=1.0, flowers=None, dry=0.0, frost=0.0):
    """A horizontally tiling band of grass blades. Ground line at y = height*0.62; blades rise above it,
    the turf (and roots) hang below it. Drawn at 2x then downsampled."""
    S = 2
    H, W = height * S, w * S
    base = int(H * 0.62)
    r = np.random.default_rng(seed)
    rgb = np.zeros((H, W, 3))
    a = np.zeros((H, W))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    # turf body: a soft dark band under the ground line with a ragged lower edge
    edge = fbm(1, W, 1.6, seed + 1)[0]
    lower = base + (8 + 20 * edge) * S
    turf = (yy >= base - 2 * S) & (yy <= lower[None, :])
    tcol = ramp(fbm(H, W, 1.2, seed + 2), [(0, palette[0]), (1, palette[1])])
    rgb[turf] = tcol[turf] * 0.7
    a[turf] = 1
    # soft fade at the bottom of the turf
    fade = np.clip((lower[None, :] - yy) / (6 * S), 0, 1)
    a = np.where(turf, fade, a)
    n = int(W * 0.9 * density)
    order = np.argsort(r.random(n))
    blades = []
    for i in range(n):
        x = r.uniform(0, W)
        hgt = r.uniform(0.25, 1.0) ** 1.4 * (H * 0.58) * (0.6 + 0.6 * fbm(1, 64, 1.5, seed + 3)[0][int(x / W * 64) % 64])
        lean = r.normal(0.15, 0.35)
        wid = r.uniform(1.6, 3.4) * S
        tone = r.random()
        blades.append((x, hgt, lean, wid, tone))
    blades.sort(key=lambda b: b[4])
    cols = [hexc(c) for c in palette[2:]]
    for (x, hgt, lean, wid, tone) in blades:
        steps = max(6, int(hgt / 3))
        t = np.linspace(0, 1, steps)
        px = x + lean * hgt * t ** 1.6
        py = base + 2 * S - hgt * t
        ci = min(len(cols) - 1, int(tone * len(cols)))
        c0 = cols[ci]
        for j in range(steps - 1):
            ww = wid * (1 - t[j]) + 0.4
            xa = int(px[j] - ww - 1)
            xb = int(px[j] + ww + 2)
            ya = int(min(py[j], py[j + 1])) - 1
            yb = int(max(py[j], py[j + 1])) + 2
            for ox in (-W, 0, W):
                xs, xe = max(0, xa + ox), min(W, xb + ox)
                if xs >= xe:
                    continue
                ys, ye = max(0, ya), min(H, yb)
                X = xx[ys:ye, xs:xe] - (px[j] + ox)
                d = np.abs(X) / ww
                m = np.clip((1 - d) * 2.5, 0, 1)
                shade = 0.55 + 0.55 * t[j] + 0.12 * (X / ww)
                col = c0[None, None, :] * shade[..., None]
                if dry > 0:
                    col = col * (1 - dry * t[j]) + hexc('#c9b36a')[None, None, :] * dry * t[j] * shade[..., None]
                if frost > 0 and t[j] > 0.55:
                    k = frost * min(1.0, (t[j] - 0.55) * 2.5)
                    col = col * (1 - k) + hexc('#eef4f6')[None, None, :] * k * np.clip(shade, 0.8, 1.1)[..., None]
                sel = m > 0.05
                blend = m[..., None]
                rgb[ys:ye, xs:xe] = np.where(sel[..., None], rgb[ys:ye, xs:xe] * (1 - blend) + col * blend, rgb[ys:ye, xs:xe])
                a[ys:ye, xs:xe] = np.maximum(a[ys:ye, xs:xe], m)
    a = np.where(yy <= lower[None, :] + 2 * S, a, 0)
    if flowers:
        for _ in range(int(w * flowers[0])):
            x = r.uniform(0, W)
            y = base - r.uniform(4, H * 0.3)
            rad = r.uniform(2.2, 4.2) * S
            col = hexc(flowers[1][r.integers(len(flowers[1]))])
            d = np.sqrt((xx - x) ** 2 + (yy - y) ** 2)
            for ox in (-W, W):
                d = np.minimum(d, np.sqrt((xx - x - ox) ** 2 + (yy - y) ** 2))
            m = np.clip((rad - d) / 1.5, 0, 1)
            lit = 0.8 + 0.3 * np.clip((y - yy) / rad, -1, 1)
            rgb = rgb * (1 - m[..., None]) + (col[None, None, :] * lit[..., None]) * m[..., None]
            a = np.maximum(a, m)
            c2 = np.clip((rad * 0.35 - d) / 1.2, 0, 1)
            rgb = rgb * (1 - c2[..., None]) + hexc('#f6d36a')[None, None, :] * c2[..., None]
    save_rgba(rgb, a, os.path.join(OUT, name + '.png'), down=S)


def moss():
    """Hanging moss/ivy fringe that tiles horizontally (draped over stone tops)."""
    S = 2
    H, W = 64 * S, 512 * S
    r = np.random.default_rng(41)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    rgb = np.zeros((H, W, 3))
    a = np.zeros((H, W))
    top = 10 * S
    edge = fbm(1, W, 1.8, 42)[0]
    drop = top + (6 + 46 * edge ** 2.2) * S
    m = (yy >= top) & (yy <= drop[None, :])
    t = fbm(H, W, 1.0, 43)
    col = ramp(t, [(0, '#2d4a1e'), (0.5, '#4b6e2a'), (1, '#7d9a3c')])
    rgb[m] = col[m]
    a[m] = 1
    shade = np.clip(1 - (yy - top) / (60 * S), 0.45, 1)
    rgb *= shade[..., None]
    save_rgba(rgb, a, os.path.join(OUT, 'moss.png'), down=S)


if __name__ == '__main__':
    soil()
    cliff()
    deeprock()
    grass_strip('grass-meadow', 51, ['#2f4a1c', '#3c5a22', '#3f6a24', '#4f7f2a', '#5f9131', '#78a63e', '#93b84c'], density=1.1,
                flowers=(0.012, ['#f2f0e6', '#f7d64a', '#d9708f', '#9a8ae0']))
    grass_strip('grass-town', 52, ['#2f4a1c', '#3c5a22', '#3d6424', '#4b7a2a', '#5d8c30', '#71a03a'], height=72, density=0.7)
    grass_strip('grass-dry', 53, ['#4a4422', '#5a5228', '#6f7a34', '#8a8a40', '#a39a4e', '#c0ac5c'], density=1.0, dry=0.4)
    grass_strip('grass-cold', 54, ['#2c3a2a', '#394a34', '#4a5e42', '#5f7350', '#7d8c66', '#a8b090'], height=80, density=0.8)
    moss()
    print('ok')

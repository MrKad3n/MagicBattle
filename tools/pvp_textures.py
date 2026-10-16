"""PvP arena textures (tileable 512x512): basalt (fire map), glacier ice (ice map), cloudstone (sky map).
Writes images/pvp/*.png. Light from the upper left."""
import os
import numpy as np
from PIL import Image
from ef_common import fbm, fbm_aniso, ramp, hexc
from ef_textures import voronoi_plates

OUT = os.path.join(os.path.dirname(__file__), '..', 'images', 'pvp')
os.makedirs(OUT, exist_ok=True)


def save(rgb, name):
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB').save(os.path.join(OUT, name), optimize=True)


def basalt():
    """Columnar basalt: tall hexagonal-ish columns, dark and glassy, a few cracks glowing with heat."""
    h = w = 512
    cell, edge = voronoi_plates(h, w, 46, 501, sx=1.0, sy=0.28, warp=10)      # columns: stretched vertically
    r = np.random.default_rng(502)
    tone = r.uniform(-1, 1, 46)[cell]
    tilt = r.normal(0, 0.25, 46)[cell]
    grain = fbm(h, w, 0.6, 503)
    broad = fbm(h, w, 2.4, 504)
    bands = fbm_aniso(h, w, 2.0, 505, sx=3.0, sy=0.2)          # horizontal joints across the columns
    t = 0.45 + 0.12 * tone + 0.2 * (broad - 0.5) + 0.1 * (grain - 0.5)
    rgb = ramp(t, [(0, '#0d0b0c'), (0.35, '#1c1819'), (0.6, '#2c2627'), (0.85, '#3e3433'), (1, '#54443f')])
    bev = np.clip(edge / 7.0, 0, 1)
    gy, gx = np.gradient(bev)
    light = 0.9 + (-gx * 1.1 - gy * 0.6) * 2.4 + tilt * 0.12
    joint = np.exp(-((bands - 0.5) / 0.012) ** 2) * (fbm(h, w, 1.5, 506) > 0.45)
    light -= 0.35 * joint
    rgb *= np.clip(light, 0.3, 1.6)[..., None]
    crev = np.clip(1 - edge / 1.6, 0, 1)
    rgb *= (1 - 0.7 * crev)[..., None]
    # glowing seams: some column edges carry magma light
    hot = (r.random(46) < 0.14)[cell] & (edge < 2.4)
    heat = np.clip(1 - edge / 2.4, 0, 1) * hot * (0.4 + 0.6 * fbm(h, w, 2.2, 507))
    glow = ramp(heat, [(0, '#000000'), (0.4, '#7a1a04'), (0.75, '#ff5a12'), (1, '#ffd27a')])
    rgb = rgb * (1 - heat[..., None] * 0.9) + glow * heat[..., None] * 0.9
    # glassy sheen
    sheen = np.clip((fbm(h, w, 1.2, 508) - 0.7) * 4, 0, 1) * bev
    rgb += sheen[..., None] * 26
    save(rgb, 'basalt.png')


def ice():
    """Glacier ice: deep blue body, pale fractures, frozen bubbles, a frosty bloom on top."""
    h = w = 512
    cell, edge = voronoi_plates(h, w, 34, 601, warp=30)
    r = np.random.default_rng(602)
    tone = r.uniform(-1, 1, 34)[cell]
    depth = fbm(h, w, 2.6, 603)
    veins = fbm_aniso(h, w, 2.2, 604, sx=0.6, sy=1.6)
    t = 0.5 + 0.18 * (depth - 0.5) * 2 + 0.08 * tone
    rgb = ramp(t, [(0, '#0f2f55'), (0.35, '#1f5687'), (0.65, '#4f93c4'), (0.85, '#9fd0ee'), (1, '#e6f6ff')])
    frac = np.exp(-(edge / 1.2) ** 2)
    rgb = rgb * (1 - frac[..., None] * 0.7) + hexc('#f2fbff')[None, None, :] * frac[..., None] * 0.7
    vein = np.exp(-((veins - 0.5) / 0.01) ** 2)
    rgb = rgb * (1 - vein[..., None] * 0.35) + hexc('#dff3ff')[None, None, :] * vein[..., None] * 0.35
    # bubbles
    yy, xx = np.mgrid[0:h, 0:w]
    for _ in range(90):
        cx, cy, rad = r.uniform(0, w), r.uniform(0, h), r.uniform(1.2, 4.5)
        dx = (xx - cx + w / 2) % w - w / 2
        dy = (yy - cy + h / 2) % h - h / 2
        d = np.sqrt(dx * dx + dy * dy)
        ring = np.exp(-((d - rad) / 0.8) ** 2) * 0.5 + np.exp(-((dx + rad * 0.35) ** 2 + (dy + rad * 0.35) ** 2) / 1.2) * 0.6
        rgb = rgb * (1 - ring[..., None] * 0.6) + 255 * ring[..., None] * 0.6
    save(rgb, 'ice.png')


def cloudstone():
    """Pale weathered limestone of the sky isles: soft plates, lichen, white streaks."""
    h = w = 512
    cell, edge = voronoi_plates(h, w, 70, 701, sx=0.55, warp=40)
    r = np.random.default_rng(702)
    tone = r.uniform(-1, 1, 70)[cell]
    broad = fbm(h, w, 2.4, 703)
    grain = fbm(h, w, 0.7, 704)
    t = 0.55 + 0.12 * tone + 0.22 * (broad - 0.5) + 0.1 * (grain - 0.5)
    rgb = ramp(t, [(0, '#4a4f5c'), (0.3, '#6c7280'), (0.6, '#959aa4'), (0.85, '#bdc0c4'), (1, '#dcdcd8')])
    bev = np.clip(edge / 9.0, 0, 1)
    gy, gx = np.gradient(bev)
    rgb *= np.clip(0.95 + (-gx - gy * 1.3) * 2.6, 0.45, 1.5)[..., None]
    rgb *= (1 - 0.55 * np.clip(1 - edge / 1.6, 0, 1))[..., None]
    li = np.clip((fbm(h, w, 2.6, 705) - 0.66) * 5, 0, 1) * bev
    rgb = rgb * (1 - li[..., None] * 0.45) + hexc('#9db06a')[None, None, :] * li[..., None] * 0.45
    st = np.clip((fbm_aniso(h, w, 2.0, 706, sx=0.15, sy=3.0) - 0.55) * 3, 0, 1)
    rgb = rgb * (1 - st[..., None] * 0.2) + hexc('#3b3f48')[None, None, :] * st[..., None] * 0.2
    save(rgb, 'cloudstone.png')


def sandstone():
    """Coliseum masonry: coursed ashlar in running bond, warm sandstone, worn arrises, chips and soot."""
    h = w = 512
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    r = np.random.default_rng(801)
    rows = 8
    rh = h / rows
    row = np.floor(yy / rh).astype(int)
    bw = np.array([r.choice([96, 128, 128, 160]) for _ in range(rows)], dtype=float)
    # every row tiles horizontally: block widths that divide 512
    bw = np.array([128, 128, 128, 128, 128, 128, 128, 128], dtype=float)
    off = np.array([(k % 2) * 64 + r.integers(-10, 10) for k in range(rows)], dtype=float)
    xr = (xx + off[row]) % w
    col = np.floor(xr / bw[row]).astype(int)
    lx = xr - col * bw[row]
    ly = yy - row * rh
    dx = np.minimum(lx, bw[row] - lx)
    dy = np.minimum(ly, rh - ly)
    edge = np.minimum(dx, dy)
    bid = (row * 31 + col * 7) % 97
    tone = np.random.default_rng(802).uniform(-1, 1, 97)[bid]
    broad = fbm(h, w, 2.4, 803)
    grain = fbm(h, w, 0.5, 804)
    strat = fbm_aniso(h, w, 2.2, 808, sx=4.0, sy=0.15)
    pits = np.clip((fbm(h, w, 0.3, 809) - 0.62) * 5, 0, 1)
    t = 0.55 + 0.17 * tone + 0.2 * (broad - 0.5) + 0.16 * (grain - 0.5) + 0.12 * (strat - 0.5) - 0.1 * pits
    rgb = ramp(t, [(0, '#5e4428'), (0.3, '#8c6a46'), (0.6, '#b38f61'), (0.85, '#cdb083'), (1, '#e3cb9c')])
    wear = 4.0 + 6.0 * fbm(h, w, 1.6, 805)
    bev = np.clip(edge / wear, 0, 1)
    light = 0.78 + 0.27 * bev - 0.12 * (ly / rh)
    light += 0.18 * np.exp(-ly / 2.5) * (dx > 3)      # lit top arris
    light -= 0.35 * np.exp(-(rh - ly) / 3.0)          # shadow under each course
    mortar = edge < (1.2 + 1.6 * fbm(h, w, 1.2, 810))
    rgb *= np.clip(light, 0.35, 1.4)[..., None]
    rgb[mortar] = rgb[mortar] * 0.45 + hexc('#3a2e22') * 0.55
    chips = np.clip((fbm(h, w, 0.8, 806) - 0.8) * 8, 0, 1) * (edge < 8)
    rgb *= (1 - 0.3 * chips)[..., None]
    soot = np.clip((fbm_aniso(h, w, 2.0, 807, sx=0.2, sy=3.0) - 0.6) * 2.5, 0, 1)
    rgb = rgb * (1 - soot[..., None] * 0.25) + hexc('#3b2f26')[None, None, :] * soot[..., None] * 0.25
    save(rgb, 'sandstone.png')


def arenasand():
    """The fighting floor: raked sand, faint ripples, scuffs and pebbles."""
    h = w = 512
    r = np.random.default_rng(901)
    fine = fbm(h, w, 0.2, 902)
    broad = fbm(h, w, 2.6, 903)
    rip = fbm_aniso(h, w, 2.0, 904, sx=4.0, sy=0.3)
    t = 0.55 + 0.25 * (broad - 0.5) + 0.12 * (rip - 0.5) + 0.15 * (fine - 0.5)
    rgb = ramp(t, [(0, '#8a6a42'), (0.35, '#b58d5c'), (0.65, '#d4ad78'), (1, '#ecd2a0')])
    yy, xx = np.mgrid[0:h, 0:w]
    for _ in range(45):
        cx, cy, rad = r.uniform(0, w), r.uniform(0, h), r.uniform(0.8, 2.6)
        dx = (xx - cx + w / 2) % w - w / 2
        dy = (yy - cy + h / 2) % h - h / 2
        d = np.sqrt(dx * dx + (dy * 1.3) ** 2)
        m = np.clip(rad - d, 0, 1)
        sh = np.clip(rad + 1.2 - np.sqrt((dx - 1) ** 2 + ((dy - 1.2) * 1.3) ** 2), 0, 1) * (1 - m)
        tone = r.uniform(0.45, 0.8)
        rgb = rgb * (1 - sh[..., None] * 0.35)
        rgb = rgb * (1 - m[..., None] * 0.8) + (hexc('#a8957c') * tone * 1.25)[None, None, :] * m[..., None] * 0.8
    scuff = np.clip((fbm_aniso(h, w, 2.2, 905, sx=2.0, sy=0.5) - 0.62) * 3, 0, 1)
    rgb = rgb * (1 - scuff[..., None] * 0.12)
    rgb += (fine[..., None] - 0.5) * 30
    save(rgb, 'arenasand.png')


def cavestone():
    """Cavern rock: dark slate with seams of glowing mineral (teal and violet) and crystal flecks."""
    h = w = 512
    cell, edge = voronoi_plates(h, w, 55, 951, sx=0.6, warp=50)
    r = np.random.default_rng(952)
    tone = r.uniform(-1, 1, 55)[cell]
    broad = fbm(h, w, 2.4, 953)
    grain = fbm(h, w, 0.6, 954)
    t = 0.45 + 0.1 * tone + 0.22 * (broad - 0.5) + 0.1 * (grain - 0.5)
    rgb = ramp(t, [(0, '#0d0f14'), (0.35, '#1a1d26'), (0.6, '#282c38'), (0.85, '#393d4a'), (1, '#4c5060')])
    bev = np.clip(edge / 8.0, 0, 1)
    gy, gx = np.gradient(bev)
    rgb *= np.clip(0.95 + (-gx - gy * 1.3) * 2.4, 0.4, 1.5)[..., None]
    rgb *= (1 - 0.6 * np.clip(1 - edge / 1.5, 0, 1))[..., None]
    v1 = fbm(h, w, 3.2, 955)
    vein = np.exp(-((v1 - 0.5) / 0.006) ** 2) * np.clip((fbm(h, w, 2.6, 956) - 0.45) * 6, 0, 1)
    from ef_common import blur_wrap as _bw
    vein = np.clip(vein + _bw(vein, 3.0) * 1.5, 0, 1)
    tint = np.where(fbm(h, w, 2.8, 957)[..., None] > 0.5, hexc('#52f0d0')[None, None, :], hexc('#b88cff')[None, None, :])
    rgb = rgb * (1 - vein[..., None] * 0.85) + tint * vein[..., None] * 0.85
    fl = (r.random((h, w)) > 0.99965).astype(float)
    from ef_common import blur_wrap
    fl = np.clip(blur_wrap(fl, 0.8) * 6, 0, 1)
    rgb = rgb * (1 - fl[..., None]) + hexc('#d6fff6')[None, None, :] * fl[..., None]
    save(rgb, 'cavestone.png')


if __name__ == '__main__':
    basalt()
    ice()
    cloudstone()
    sandstone()
    arenasand()
    cavestone()
    print('ok')

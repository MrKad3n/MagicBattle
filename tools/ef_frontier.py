"""EmberFall frontier art (the northern open world, c55): ground strips for snow and frost, and painted parallax
bands for the river valley, the pine forests and the high mountains. Everything tiles horizontally.
Writes images/emberfall/grass-snow.png, grass-frost.png and images/props/bg-*.png."""
import os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from ef_common import fbm, fbm_aniso, ramp, hexc, save_rgba
from ef_textures import grass_strip

HERE = os.path.dirname(__file__)
EF = os.path.join(HERE, '..', 'images', 'emberfall')
PROPS = os.path.join(HERE, '..', 'images', 'props')
FLORA = os.path.join(EF, 'flora')


def wrap1d(w, beta, seed):
    return fbm(8, w, beta, seed)[0]


def smooth1d(w, seed, base=3, octaves=4, rough=0.5):
    """A smooth, exactly periodic 1D profile in [0,1] (a sum of whole-period sines)."""
    r = np.random.default_rng(seed)
    x = np.arange(w) / w * 2 * np.pi
    v = np.zeros(w)
    amp = 1.0
    f = base
    for _ in range(octaves):
        for _k in range(2):
            v += amp * np.sin(x * (f + _k) + r.uniform(0, 2 * np.pi))
        amp *= rough
        f *= 2
    v -= v.min()
    return v / max(1e-9, v.max())


# ------------------------------------------------------------------ ground strips
def snow_strip():
    """Snow lying on the ground: a soft white body under the ground line (y = 62%), a lumpy drift edge rising a
    little above it, cool blue shadows in the hollows, sparkles, and a few dead grass stalks poking through."""
    S = 2
    H, W = 80 * S, 1024 * S
    base = int(H * 0.62)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    lump = smooth1d(W, 901, base=9, octaves=4, rough=0.45)
    top = base - (2 + 11 * lump) * S                     # drift surface above the ground line
    low = base + (14 + 10 * smooth1d(W, 903, base=7)) * S     # how deep the white goes before it melts into soil
    inside = (yy >= top[None, :]) & (yy <= low[None, :])
    d_top = yy - top[None, :]
    # lighting: drifts facing the upper-left are bright, their lee is blue
    slope = np.gradient(top)
    lit = np.clip(0.95 + slope[None, :] * 0.35, 0.7, 1.08)
    tone = ramp(np.clip(d_top / (22 * S), 0, 1), [(0, '#ffffff'), (0.25, '#eef3f8'), (0.6, '#d3dfea'), (1, '#b7c7d6')])
    tone *= lit[..., None]
    grain = gaussian_filter(fbm(H, W, 1.6, 904), 2)
    tone *= (0.95 + 0.07 * grain)[..., None]
    rgb = np.where(inside[..., None], tone, 0)
    a = np.where(inside, 1.0, 0)
    # soft bottom: snow thins into the turf below
    fade = np.clip((low[None, :] - yy) / (8 * S), 0, 1)
    a = np.where(inside, np.minimum(a, fade), a)
    # a crisp rim light on the very top
    rim = inside & (d_top < 2.2 * S)
    rgb[rim] = np.minimum(255, rgb[rim] * 1.06 + 6)
    # sparkles
    r = np.random.default_rng(905)
    for _ in range(int(W * 0.03)):
        x = int(r.uniform(0, W))
        y = int(top[x] + r.uniform(1, 10) * S)
        if 0 <= y < H:
            rgb[max(0, y - 1):y + 2, max(0, x - 1):x + 2] = 255
    # dead stalks poking through
    for _ in range(int(W * 0.012)):
        x = r.uniform(0, W)
        h = r.uniform(10, 30) * S
        lean = r.normal(0.2, 0.3)
        xi = int(x)
        y0 = top[xi % W] + 2 * S
        for k in range(int(h)):
            px = int(x + lean * k * 0.5) % W
            py = int(y0 - k)
            if 0 <= py < H:
                c = hexc('#8a7a52') * (0.7 + 0.4 * k / h)
                rgb[py, px] = c
                a[py, px] = 1
                if px + 1 < W:
                    rgb[py, px + 1] = c * 0.8
                    a[py, px + 1] = 1
    save_rgba(rgb, a, os.path.join(EF, 'grass-snow.png'), down=S)


def frost_strip():
    """Cold turf with hoarfrost on the blade tips."""
    grass_strip('grass-frost', 56, ['#2b3630', '#37443b', '#3f5040', '#4c5f48', '#5a6e52', '#6c7f62', '#8a9a80', '#c9d4d0'], height=80, density=0.75, frost=0.6)


# ------------------------------------------------------------------ painted bands
def light_profile(top, H, W, yy):
    """Per-pixel shading for a silhouette: bright on slopes that face the upper-left sun."""
    slope = np.gradient(gaussian_filter(top, 3, mode='wrap'))
    face = np.clip(-slope * 0.9, -1, 1)          # rising to the right (top decreasing) faces the sun
    return face


def band_canvas(W, H):
    rgb = np.zeros((H, W, 3))
    a = np.zeros((H, W))
    return rgb, a


def paint_layer(rgb, a, top, cols, yy, xx, seed, shade_amt=0.25, tex=0.12, haze=None):
    H, W = a.shape
    inside = yy >= top[None, :]
    depth = np.clip((yy - top[None, :]) / max(1, H * 0.6), 0, 1)
    n = fbm(H, W, 1.4, seed)
    col = ramp(np.clip(depth * 0.8 + (n - 0.5) * 0.35 + 0.1, 0, 1), cols)
    face = light_profile(top, H, W, yy)
    # light only near the ridge: deeper down the slope shading fades out
    k = np.exp(-(yy - top[None, :]) / (H * 0.25))
    col *= (1 + shade_amt * face[None, :] * k)[..., None]
    col *= (1 + tex * (fbm_aniso(H, W, 1.6, seed + 1, sx=0.4, sy=2.0) - 0.5))[..., None]
    if haze is not None:
        hz = hexc(haze[0])
        col = col * (1 - haze[1]) + hz[None, None, :] * haze[1]
    edge = np.clip((yy - top[None, :]) + 1.0, 0, 1)
    rgb[:] = np.where(inside[..., None], col * edge[..., None] + rgb * (1 - edge[..., None]), rgb)
    a[:] = np.maximum(a, np.where(inside, edge, 0))


def mountains(name, W, H, seed, peaks, ridge_h, snowline, rock, snow, haze, layers=3, jag=1.0):
    """Ridged peaks with snow on the sunlit slopes and above the snowline, in receding layers."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    rgb, a = band_canvas(W, H)
    for L in range(layers):
        k = L / max(1, layers - 1)              # 0 = farthest
        base = wrap1d(W, 1.6, seed + L * 7)
        ridged = 1 - np.abs(wrap1d(W, 2.2, seed + 50 + L) * 2 - 1)
        detail = wrap1d(W, 1.0, seed + 90 + L)
        prof = base * 0.45 + ridged ** (1.6 * jag) * 0.45 + detail * 0.1 * jag
        prof = (prof - prof.min()) / (prof.max() - prof.min())
        top = H * (0.08 + 0.18 * k) + (1 - prof) * H * ridge_h * (1 - 0.25 * k)
        far = 1 - k
        rcols = [(0, rock[0]), (0.5, rock[1]), (1, rock[2])]
        hz = (haze, 0.5 * far + 0.08)
        paint_layer(rgb, a, top, rcols, yy, xx, seed + 200 + L, shade_amt=0.55, tex=0.18, haze=hz)
        # snow: above the snowline and on slopes that face the sun, broken by rock ribs
        face = light_profile(top, H, W, yy)
        gul = fbm_aniso(H, W, 1.5, seed + 300 + L, sx=0.35, sy=2.2)
        below = (yy - top[None, :]) / (H * 0.55)
        sn = (snowline - below) * 3.0 + face[None, :] * 0.9 + (gul - 0.5) * 1.4
        sn = np.clip(sn, 0, 1) * (yy >= top[None, :])
        scol = ramp(np.clip(0.5 + face[None, :] * 0.6 + (gul - 0.5) * 0.3, 0, 1), [(0, snow[0]), (0.6, snow[1]), (1, snow[2])])
        scol = scol * (1 - hz[1]) + hexc(haze)[None, None, :] * hz[1]
        rgb[:] = rgb * (1 - sn[..., None]) + scol * sn[..., None]
    rgb = gaussian_filter(rgb, (0.7, 0.7, 0))
    save_rgba(rgb, a, os.path.join(PROPS, name + '.png'))


def hills(name, W, H, seed, cols, haze, layers=3, amp=0.4, river=None, clumps=None, conifer=0.0):
    """Rolling hills in receding layers, optionally with a river ribbon in the valley and tree clumps."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    rgb, a = band_canvas(W, H)
    r = np.random.default_rng(seed)
    for L in range(layers):
        k = L / max(1, layers - 1)
        prof = wrap1d(W, 2.0, seed + L * 11) * 0.8 + wrap1d(W, 1.2, seed + L * 11 + 3) * 0.2
        top = H * (0.05 + 0.3 * k) + (1 - prof) * H * amp * (1 - 0.3 * k)
        lc = cols[L]
        paint_layer(rgb, a, top, [(0, lc[0]), (0.5, lc[1]), (1, lc[2])], yy, xx, seed + 400 + L,
                    shade_amt=0.35, tex=0.16, haze=(haze, 0.45 * (1 - k) + 0.05))
        if conifer > 0:
            # a forest pelt: tiny pointed crowns along and below the ridge
            zone = (yy > top[None, :] - 18) & (yy < top[None, :] + H * 0.5)
            spikes = np.zeros((H, W))
            n = int(W * conifer * (0.6 + 0.6 * k))
            for _ in range(n):
                x = r.uniform(0, W)
                yb = top[int(x) % W] + r.uniform(-4, H * 0.45)
                h = (10 + 18 * k) * r.uniform(0.7, 1.3)
                w = h * 0.36
                x0, x1 = int(x - w), int(x + w) + 1
                y0, y1 = int(yb - h), int(yb) + 1
                if y1 <= 0 or y0 >= H:
                    continue
                ys, ye = max(0, y0), min(H, y1)
                for ox in (0, -W, W):
                    xs, xe = max(0, x0 + ox), min(W, x1 + ox)
                    if xs >= xe:
                        continue
                    X = xx[ys:ye, xs:xe] - (x + ox)
                    Y = yy[ys:ye, xs:xe] - y0
                    m = np.clip((Y / h) * w - np.abs(X) + 0.8, 0, 1)
                    sh = 0.55 + 0.45 * np.clip(-X / w, -1, 1) * 0.6 + 0.35
                    spikes[ys:ye, xs:xe] = np.maximum(spikes[ys:ye, xs:xe], m * sh)
            dark = ramp(np.full((H, W), 0.5), [(0, '#0f2418'), (1, '#1d3a26')])
            hz = 0.45 * (1 - k) + 0.05
            dark = dark * (1 - hz) + hexc(haze)[None, None, :] * hz
            m = spikes > 0
            lum = np.clip(spikes, 0.4, 1.3)
            rgb[:] = np.where(m[..., None], rgb * (1 - np.clip(spikes, 0, 1)[..., None]) + dark * lum[..., None] * np.clip(spikes, 0, 1)[..., None], rgb)
            a[:] = np.maximum(a, np.clip(spikes, 0, 1) * zone)
        if river is not None and L == layers - 2:
            # a meandering ribbon of water in this layer's valley floor
            y_r = H * (0.62 + 0.06 * np.sin(np.linspace(0, 4 * np.pi, W, endpoint=False)) + 0.04 * (wrap1d(W, 2.2, seed + 77) - 0.5))
            wid = 4 + 5 * wrap1d(W, 1.8, seed + 78)
            m = np.clip(wid[None, :] - np.abs(yy - y_r[None, :]), 0, 1) * (yy > top[None, :] + 6)
            wcol = ramp(np.clip((yy - y_r[None, :]) / 8 + 0.5, 0, 1), [(0, river[0]), (1, river[1])])
            glint = (fbm_aniso(H, W, 1.2, seed + 79, sx=3.0, sy=0.3) > 0.62) * 40
            wcol = wcol + glint[..., None]
            rgb[:] = rgb * (1 - m[..., None]) + wcol * m[..., None]
        if clumps and L >= layers - 2:
            # rounded tree clumps on the nearer layers
            for _ in range(int(W * clumps * (0.5 + k))):
                x = r.uniform(0, W)
                yb = top[int(x) % W] + r.uniform(6, H * 0.35)
                rr = (5 + 7 * k) * r.uniform(0.7, 1.4)
                xs, xe = int(x - rr * 2), int(x + rr * 2) + 1
                ys, ye = max(0, int(yb - rr * 2)), min(H, int(yb + rr))
                for ox in (0, -W, W):
                    a0, a1 = max(0, xs + ox), min(W, xe + ox)
                    if a0 >= a1 or ys >= ye:
                        continue
                    X = xx[ys:ye, a0:a1] - (x + ox)
                    Y = yy[ys:ye, a0:a1] - (yb - rr)
                    d = np.sqrt(X * X + Y * Y * 1.3)
                    m = np.clip(rr - d, 0, 1)
                    lit = np.clip(0.75 - (X + Y) / (rr * 2.2), 0.4, 1.15)
                    c = hexc('#2f4a20') * lit[..., None]
                    hz = 0.4 * (1 - k)
                    c = c * (1 - hz) + hexc(haze)[None, None, :] * hz
                    rgb[ys:ye, a0:a1] = rgb[ys:ye, a0:a1] * (1 - m[..., None]) + c * m[..., None]
                    a[ys:ye, a0:a1] = np.maximum(a[ys:ye, a0:a1], m)
    rgb = gaussian_filter(rgb, (0.6, 0.6, 0))
    save_rgba(rgb, a, os.path.join(PROPS, name + '.png'))


def treeline(name, W, H, seed, sprites, n, hmin, hmax, haze, ground):
    """A dense row of painted trees (the real flora sprites) with a hazy back row, standing on a dark ground strip."""
    r = np.random.default_rng(seed)
    S = 2
    cv = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    ims = [Image.open(os.path.join(FLORA, s + '.png')).convert('RGBA') for s in sprites]
    rows = [(0.6, int(n * 1.3), 0.8, 0.9), (0.3, n, 0.92, 0.45), (0.0, int(n * 0.8), 1.05, 0.0)]  # (haze, count, scale, y offset)
    for haze_k, cnt, sc, yoff in rows:
        items = []
        for i in range(cnt):
            x = (i + r.uniform(-0.4, 0.4)) / cnt * W
            h = r.uniform(hmin, hmax) * sc
            items.append((x, h, ims[r.integers(len(ims))], r.random() < 0.5))
        for x, h, im, fl in items:
            k = h * S / im.height
            w = int(im.width * k)
            hh = int(h * S)
            t = im.resize((max(1, w), max(1, hh)), Image.LANCZOS)
            if fl:
                t = t.transpose(Image.FLIP_LEFT_RIGHT)
            if haze_k > 0:
                arr = np.asarray(t).astype(np.float64)
                hz = hexc(haze)
                arr[..., :3] = arr[..., :3] * (1 - haze_k) + hz * haze_k
                t = Image.fromarray(arr.astype(np.uint8), 'RGBA')
            y = int((H - 10 - yoff * 30) * S - hh)
            for ox in (0, -W * S, W * S):
                px = int(x * S - w / 2) + ox
                if px + w < 0 or px >= W * S:
                    continue
                layer = Image.new('RGBA', cv.size, (0, 0, 0, 0))
                layer.paste(t, (px, y))
                cv = Image.alpha_composite(cv, layer)
    arr = np.asarray(cv).astype(np.float64)
    rgb, a = arr[..., :3], arr[..., 3] / 255
    yy = np.mgrid[0:H * S, 0:W * S][0]
    # the forest floor: the trunks sink into a dark band of undergrowth
    k = np.clip((yy - (H - 46) * S) / (34 * S), 0, 1)[..., None]
    rgb[:] = rgb * (1 - k) + hexc(ground) * k
    a[:] = np.maximum(a, k[..., 0])
    save_rgba(rgb, a, os.path.join(PROPS, name + '.png'), down=S)


if __name__ == '__main__':
    import sys
    only = sys.argv[1:] or None

    def want(n):
        return not only or n in only
    if want('snow'):
        snow_strip()
    if want('frost'):
        frost_strip()
    if want('valley'):
        hills('bg-mid-valley', 1280, 330, 31,
              [['#7f9a78', '#93ab83', '#a7ba90'], ['#6a8a4c', '#7d9a55', '#91a862'], ['#5a7d3a', '#6c8c42', '#83a04e']],
              '#c9d9dc', layers=3, amp=0.42, river=('#a9d0e2', '#5e8ea8'), clumps=0.05)
    if want('forest_old'):
        hills('bg-mid-forest', 1280, 300, 41,
              [['#6a8676', '#7a937f', '#8aa18a'], ['#3e5a44', '#4a6650', '#5b765c'], ['#2c4632', '#36523a', '#456448']],
              '#bccfd6', layers=3, amp=0.45, conifer=0.5)
    if want('pines'):
        treeline('bg-near-pines', 1280, 230, 51, ['pine0', 'pine1', 'pine2'], 34, 150, 220, '#9fb6b6', '#16261a')
    if want('frostpines'):
        treeline('bg-near-frostpines', 1280, 230, 52, ['pine-frost0', 'pine-frost1', 'pine-snow1'], 30, 150, 220, '#c4d2dc', '#2a3640')
    if want('alpine'):
        mountains('bg-far-alpine', 1280, 340, 61, 5, 0.78, 0.55, ('#3c4656', '#5d6a7c', '#8a96a6'),
                  ('#9fb0c8', '#e3ebf4', '#ffffff'), '#c4d0e0', layers=3, jag=1.25)
    if want('crags'):
        mountains('bg-mid-crags', 1280, 260, 71, 7, 0.6, 0.35, ('#3a3f46', '#58606a', '#7c848e'),
                  ('#a6b6c8', '#e6edf4', '#ffffff'), '#c9d4df', layers=2, jag=1.0)
    print('ok')


def forest_from_farm():
    """The painted green ridges of bg-far-farm, cooled and darkened, with a conifer pelt along every ridge line."""
    im = np.asarray(Image.open(os.path.join(PROPS, 'bg-far-farm.png')).convert('RGBA')).astype(np.float64)
    rgb, a = im[..., :3], im[..., 3] / 255
    H, W = a.shape
    lum = rgb.mean(-1, keepdims=True)
    tint = ramp(np.clip(lum[..., 0] / 255 * 1.2 - 0.1, 0, 1), [(0, '#1b3326'), (0.5, '#3b5a46'), (1, '#9fb4ac')])
    rgb = rgb * 0.35 + tint * 0.65
    # ridge lines = where luminance jumps (one layer over another); sprinkle conifer spikes along them
    r = np.random.default_rng(81)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    gy = np.zeros_like(lum[..., 0])
    gy[1:] = lum[1:, :, 0] - lum[:-1, :, 0]
    ridge = (np.abs(gy) > 4) & (a > 0.9)
    ys, xs = np.nonzero(ridge)
    for i in r.choice(len(ys), min(len(ys), 2600), replace=False):
        y, x = ys[i], xs[i]
        h = r.uniform(5, 11) * (0.6 + 0.8 * y / H)
        w = h * 0.34
        y0, y1 = int(y - h), int(y + 2)
        x0, x1 = int(x - w - 1), int(x + w + 2)
        if y0 < 0 or x0 < 0 or x1 >= W:
            continue
        X = xx[y0:y1, x0:x1] - x
        Y = yy[y0:y1, x0:x1] - (y - h)
        m = np.clip((Y / h) * w - np.abs(X) + 0.6, 0, 1)
        base = rgb[min(H - 1, y + 3), x] * 0.62
        c = base[None, None, :] * (0.85 + 0.3 * np.clip(-X / w, -1, 1))[..., None]
        rgb[y0:y1, x0:x1] = rgb[y0:y1, x0:x1] * (1 - m[..., None]) + c * m[..., None]
        a[y0:y1, x0:x1] = np.maximum(a[y0:y1, x0:x1], m)
    save_rgba(rgb, a, os.path.join(PROPS, 'bg-mid-forest.png'))


if __name__ == '__main__' and 'forest2' in __import__('sys').argv:
    forest_from_farm()

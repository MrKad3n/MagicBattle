"""EmberFall natural rock faces (side view): bedded sandstone/limestone layers broken by joints.
Tiles on both axes. Light from the upper left. Writes images/emberfall/rockface.png (and a cooler
'rockface-cold.png' for the northern gorge)."""
import os
import numpy as np
from ef_common import fbm, fbm_aniso, ramp, save_rgb, hexc, blur_wrap

OUT = os.path.join(os.path.dirname(__file__), '..', 'images', 'emberfall')


def wrap_noise_1d(w, seed, beta=2.2):
    return fbm(8, w, beta, seed)[0]


def rockface(name, seed, palette, stain='#3a3026', lichen='#8d9a62', down=1):
    S = 2                       # supersample, then downsize for soft edges
    h = w = 512 * S
    r = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)

    # --- bedding planes: layer boundaries wrapping vertically (period h)
    ys = []
    y = 0.0
    while True:
        t = r.choice([22, 34, 48, 64, 86], p=[0.18, 0.28, 0.26, 0.18, 0.10]) * S
        if y + t > h - 18 * S:
            break
        ys.append(y)
        y += t
    ys = np.array(ys)
    ys = ys * (h / (y if y > 0 else h))          # stretch so the period is exact
    nL = len(ys)
    th = np.diff(np.append(ys, h))
    # wobble each boundary along x (wrapping horizontally)
    wob = np.stack([(wrap_noise_1d(w, seed + 10 + k) - 0.5) * min(26 * S, th[k] * 0.7) for k in range(nL)])
    wob += np.stack([(wrap_noise_1d(w, seed + 60 + k, 2.4) - 0.5) * 6 * S for k in range(nL)])

    bound = ys[:, None] + wob                     # (nL, w)
    allb = np.concatenate([bound - h, bound, bound + h], 0)
    allb = np.maximum.accumulate(allb, axis=0)       # keep beds ordered
    # index of the bed each pixel sits in (searched per column, so the wrap is seamless)
    idx = np.zeros((h, w), dtype=np.int64)
    for k in range(allb.shape[0]):
        idx += (yy >= allb[k][None, :]).astype(np.int64)
    idx = np.clip(idx - 1, 0, allb.shape[0] - 2)
    cols = np.arange(w)[None, :].repeat(h, 0)
    top = allb[idx, cols]
    nxt = allb[idx + 1, cols]
    L = idx % nL
    yv = yy
    dt = yv - top
    db = nxt - yv
    thick = nxt - top

    # --- joints: wandering cracks per bed; many stop part way down
    dj = np.full((h, w), 1e9)
    jside = np.zeros((h, w))
    jstr = np.zeros((h, w))
    wig = (fbm(h, w, 2.4, seed + 21) - 0.5) * 26 * S
    for k in range(nL):
        m = L == k
        if not m.any():
            continue
        n = max(1, int(w / r.uniform(110 * S, 260 * S)))
        jx = r.uniform(0, w, n)
        slant = r.normal(0, 0.18, n)
        reach = r.uniform(0.35, 1.0, n)           # fraction of the bed the crack runs down
        px = xx[m] + wig[m] * 0.6
        py = dt[m]
        tk = thick[m]
        best = np.full(px.shape, 1e9)
        side = np.zeros(px.shape)
        st = np.zeros(px.shape)
        for j in range(n):
            cx = jx[j] + slant[j] * py
            d = (px - cx + w / 2) % w - w / 2
            fade = np.clip((reach[j] * tk - py) / (8 * S), 0, 1)
            better = np.abs(d) < np.abs(best)
            best = np.where(better, d, best)
            st = np.where(better, fade, st)
        dj[m] = np.abs(best)
        jside[m] = np.sign(best)
        jstr[m] = st

    # --- irregular plate fractures (faint) so faces don't read as masonry
    from ef_textures import voronoi_plates
    pc, pe = voronoi_plates(h // S, w // S, 140, seed + 30, sx=0.5, sy=1.0, warp=40)
    pe = np.kron(pe, np.ones((S, S)))
    pcell = np.kron(pc, np.ones((S, S), dtype=np.int64))
    ptone = np.random.default_rng(seed + 31).uniform(-1, 1, 140)[pcell]

    bedtone = np.random.default_rng(seed + 4).uniform(-1, 1, nL)[L]
    recess = (np.random.default_rng(seed + 12).random(nL) < 0.3)[L]
    grain = fbm(h, w, 0.5, seed + 5)
    broad = fbm(h, w, 2.6, seed + 6)
    streak = fbm_aniso(h, w, 2.0, seed + 7, sx=3.0, sy=0.25)
    t = 0.5 + 0.12 * bedtone + 0.07 * ptone + 0.24 * (broad - 0.5) + 0.12 * (streak - 0.5) + 0.12 * (grain - 0.5) - 0.08 * recess
    rgb = ramp(t, palette)

    # --- form: each bed bulges like a weathered ledge, lit from above-left
    ny = np.clip((dt - db) / np.maximum(thick, 1), -1, 1)          # -1 top of bed .. +1 bottom
    bulge = np.sqrt(np.clip(1 - ny * ny, 0, 1))
    light = 0.80 + 0.22 * bulge - 0.18 * np.clip(ny, 0, 1) ** 2 + 0.12 * np.clip(-ny, 0, 1)
    light += 0.18 * np.exp(-dt / (3.0 * S))
    light -= (0.45 + 0.2 * recess) * np.exp(-db / (5.0 * S))           # overhang shadow
    light -= 0.12 * recess
    crack = np.exp(-(dj / (1.3 * S)) ** 2) * jstr
    light -= 0.5 * crack
    light += 0.08 * np.exp(-dj / (4 * S)) * (jside > 0) * jstr
    light -= 0.10 * np.exp(-dj / (4 * S)) * (jside < 0) * jstr
    light -= 0.22 * np.exp(-(pe / 1.0) ** 2) * (fbm(h // S, w // S, 2.0, seed + 33) > 0.4).repeat(S, 0).repeat(S, 1)
    pits = np.clip((fbm(h, w, 0.4, seed + 8) - 0.76) * 7, 0, 1)
    light -= 0.16 * pits
    light += (grain - 0.5) * 0.18
    rgb *= np.clip(light, 0.22, 1.45)[..., None]

    # --- weathering: stains running down from ledges, lichen on the upper faces
    edge = np.minimum(np.minimum(dt, db), dj)
    st = fbm_aniso(h, w, 2.0, seed + 9, sx=0.15, sy=3.0)
    st = np.clip((st - 0.52) * 3.0, 0, 1) * np.exp(-dt / (50 * S))
    rgb = rgb * (1 - 0.35 * st[..., None]) + hexc(stain)[None, None, :] * 0.35 * st[..., None]
    li = np.clip((fbm(h, w, 2.6, seed + 11) - 0.66) * 5, 0, 1) * np.exp(-dt / (16 * S)) * np.clip(edge / (3 * S), 0, 1)
    rgb = rgb * (1 - 0.45 * li[..., None]) + hexc(lichen)[None, None, :] * 0.45 * li[..., None]

    from PIL import Image
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB').resize((512, 512), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    return im


if __name__ == '__main__':
    rockface('rockface', 301, [(0, '#3d362e'), (0.3, '#5a5044'), (0.55, '#786b59'), (0.8, '#93856d'), (1, '#ab9c80')])
    rockface('rockface-cold', 302, [(0, '#2f3236'), (0.3, '#474a4d'), (0.55, '#62635f'), (0.8, '#7d7c74'), (1, '#97958b')],
             stain='#2a2c2e', lichen='#7d8f7a')
    print('ok')

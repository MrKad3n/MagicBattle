"""Make the painted backdrop bands tile seamlessly.

Each band is tiled edge to edge by blitStrip. The last `k` columns and the first `k` columns are overlapped,
a minimum-error vertical seam is found through the overlap (image quilting), and the two are feathered across it.
The result is k pixels narrower and wraps with no visible cut. Usage: python3 ef_seamless.py src.png out.png [frac]
"""
import sys
import numpy as np
from PIL import Image


def seamless(a, frac=0.3, feather=10):
    h, w, _ = a.shape
    k = int(w * frac)
    A = a[:, w - k:]  # end of the strip (left side of the overlap)
    B = a[:, :k]      # start of the strip (right side of the overlap)
    al = (A[..., 3:] + B[..., 3:]) / 510.0
    cost = (np.abs(A[..., :3] - B[..., :3]) * al).sum(2) + np.abs(A[..., 3] - B[..., 3]) * 3.0
    # keep the seam away from the overlap's ends so the feather has room
    cost[:, :feather * 2] += 1e6
    cost[:, -feather * 2:] += 1e6
    acc = cost.copy()
    back = np.zeros((h, k), dtype=np.int64)
    for y in range(1, h):
        prev = acc[y - 1]
        l = np.r_[np.inf, prev[:-1]]
        r = np.r_[prev[1:], np.inf]
        st = np.stack([l, prev, r])
        idx = st.argmin(0)
        acc[y] += st[idx, np.arange(k)]
        back[y] = np.arange(k) + idx - 1
    path = np.zeros(h, dtype=np.int64)
    path[-1] = int(acc[-1].argmin())
    for y in range(h - 1, 0, -1):
        path[y - 1] = back[y, path[y]]
    xs = np.arange(k)[None, :]
    m = np.clip((xs - path[:, None]) / feather + 0.5, 0, 1)  # 0 = take A, 1 = take B
    m = (m * m * (3 - 2 * m))[..., None]
    # blend premultiplied so a ridge fading out never leaves a dark halo
    pa = np.concatenate([A[..., :3] * A[..., 3:] / 255, A[..., 3:]], 2)
    pb = np.concatenate([B[..., :3] * B[..., 3:] / 255, B[..., 3:]], 2)
    pm = pa * (1 - m) + pb * m
    al = pm[..., 3:]
    rgb = np.where(al > 0, pm[..., :3] * 255 / np.maximum(al, 1e-6), 0)
    blend = np.concatenate([rgb, al], 2)
    return np.concatenate([blend, a[:, k:w - k]], 1)


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    frac = float(sys.argv[3]) if len(sys.argv) > 3 else 0.3
    a = np.asarray(Image.open(src).convert('RGBA')).astype(float)
    r = seamless(a, frac)
    Image.fromarray(np.clip(r + 0.5, 0, 255).astype(np.uint8), 'RGBA').save(out, optimize=True)
    d = np.abs(r[:, 0] - r[:, -1]).mean(0)
    print(out, r.shape, 'edge diff', d.round(1))

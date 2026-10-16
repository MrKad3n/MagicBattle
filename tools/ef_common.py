"""Shared helpers for the EmberFall art generators (numpy painterly rendering)."""
import numpy as np
from PIL import Image, ImageFilter

RNG = np.random.default_rng(7)


def fbm(h, w, beta=2.0, seed=0, lo=1.0):
    """Tileable fractal noise in [0,1] (spectral synthesis, so it wraps on both axes)."""
    r = np.random.default_rng(seed)
    white = r.standard_normal((h, w))
    F = np.fft.fft2(white)
    fy = np.fft.fftfreq(h)[:, None] * h
    fx = np.fft.fftfreq(w)[None, :] * w
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1
    amp = 1.0 / np.maximum(f, lo) ** (beta / 2.0)
    amp[0, 0] = 0
    n = np.real(np.fft.ifft2(F * amp))
    n -= n.min()
    n /= max(1e-9, n.max())
    return n


def fbm_aniso(h, w, beta=2.0, seed=0, sx=1.0, sy=1.0, lo=1.0):
    """Tileable noise stretched along an axis (sx > 1 = longer streaks horizontally)."""
    r = np.random.default_rng(seed)
    white = r.standard_normal((h, w))
    F = np.fft.fft2(white)
    fy = np.fft.fftfreq(h)[:, None] * h * sy
    fx = np.fft.fftfreq(w)[None, :] * w * sx
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1
    amp = 1.0 / np.maximum(f, lo) ** (beta / 2.0)
    amp[0, 0] = 0
    n = np.real(np.fft.ifft2(F * amp))
    n -= n.min()
    n /= max(1e-9, n.max())
    return n


def hexc(s):
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def ramp(t, stops):
    """Map t in [0,1] (any shape) through colour stops [(pos, '#hex'), ...] -> (...,3)."""
    t = np.clip(t, 0, 1)
    pos = np.array([p for p, _ in stops])
    cols = np.array([hexc(c) for _, c in stops])
    out = np.zeros(t.shape + (3,))
    for ch in range(3):
        out[..., ch] = np.interp(t, pos, cols[:, ch])
    return out


def save_rgba(rgb, alpha, path, down=1):
    a = np.clip(alpha, 0, 1)
    img = np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)
    im = Image.fromarray(img, 'RGBA')
    if down > 1:
        im = premul_resize(im, (im.width // down, im.height // down))
    im.save(path, optimize=True)
    return im


def premul_resize(im, size):
    """Resize RGBA without dark fringes (premultiplied)."""
    a = np.asarray(im).astype(np.float64) / 255.0
    rgb = a[..., :3] * a[..., 3:4]
    pm = Image.fromarray((np.dstack([rgb, a[..., 3]]) * 255).astype(np.uint8), 'RGBA')
    pm = pm.resize(size, Image.LANCZOS)
    b = np.asarray(pm).astype(np.float64) / 255.0
    al = b[..., 3:4]
    rgb2 = np.where(al > 1e-4, b[..., :3] / np.maximum(al, 1e-4), 0)
    return Image.fromarray((np.dstack([np.clip(rgb2, 0, 1), al[..., 0]]) * 255).astype(np.uint8), 'RGBA')


def save_rgb(rgb, path):
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB').save(path, optimize=True)


def blur(a, r):
    if r <= 0:
        return a
    from scipy.ndimage import gaussian_filter
    return gaussian_filter(a, r)


def blur_wrap(a, r):
    from scipy.ndimage import gaussian_filter
    return gaussian_filter(a, r, mode='wrap')


def grid(h, w):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    return yy, xx


def trim(im, pad=2):
    """Crop an RGBA image to its opaque pixels (+pad)."""
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 3)
    if len(xs) == 0:
        return im, (0, 0)
    x0, x1 = max(0, xs.min() - pad), min(im.width, xs.max() + 1 + pad)
    y0, y1 = max(0, ys.min() - pad), min(im.height, ys.max() + 1 + pad)
    return im.crop((x0, y0, x1, y1)), (x0, y0)

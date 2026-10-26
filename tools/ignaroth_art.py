"""Paints Ignaroth's rig parts as shaded raster sprites (not flat vectors) in the style of the
fire-dragon sprite sheet: crimson scales with cel-ish shading, orange segmented belly plates,
brown ridged horns, cream teeth, a dark maroon outline. Each part is drawn as a silhouette mask
at 4 px / rig unit, turned into a height field (distance transform) and lit, then textured with
a cellular scale pattern and downsampled to 3 px / unit. Output: rig.png + meta.json."""
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

SS = 4          # supersample px per rig unit while painting
OUT = 3         # px per rig unit in the final sheet
OUTDIR = sys.argv[1]

LIGHT = np.array([-0.45, -0.75, 0.55]); LIGHT = LIGHT / np.linalg.norm(LIGHT)
RED_HI = np.array([214, 46, 44]); RED_MID = np.array([168, 24, 32]); RED_LO = np.array([92, 10, 22])
ORANGE_HI = np.array([255, 170, 70]); ORANGE_MID = np.array([236, 112, 34]); ORANGE_LO = np.array([168, 58, 18])
OUTLINE = np.array([38, 6, 10])
HORN_HI = np.array([170, 120, 84]); HORN_LO = np.array([74, 42, 30])
BONE_HI = np.array([120, 30, 34]); BONE_LO = np.array([54, 8, 16])
rng = np.random.default_rng(7)

def smooth_pts(pts, closed=True, steps=10):
    """Chaikin-ish smoothing via quadratic midpoints."""
    out = []
    n = len(pts)
    rngn = range(n) if closed else range(n - 1)
    for i in rngn:
        a = np.array(pts[i]); b = np.array(pts[(i + 1) % n]); c = np.array(pts[(i + 2) % n])
        m0 = (a + b) / 2; m1 = (b + c) / 2
        for k in range(steps):
            t = k / steps
            out.append(tuple((1 - t) ** 2 * m0 + 2 * (1 - t) * t * b + t * t * m1))
    return out

class Part:
    def __init__(self, name, x0, y0, x1, y1):
        self.name = name; self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1
        self.W = int(math.ceil((x1 - x0) * SS)); self.H = int(math.ceil((y1 - y0) * SS))
        self.layers = []      # (mask, kind, params)
    def P(self, pts):
        return [((x - self.x0) * SS, (y - self.y0) * SS) for x, y in pts]
    def mask(self):
        return Image.new('L', (self.W, self.H), 0)
    def poly(self, pts, smooth=True):
        m = self.mask(); d = ImageDraw.Draw(m)
        p = smooth_pts(pts) if smooth else pts
        d.polygon(self.P(p), fill=255)
        return np.array(m) > 127
    def ellipse(self, cx, cy, rx, ry):
        m = self.mask(); d = ImageDraw.Draw(m)
        d.ellipse([(cx - rx - self.x0) * SS, (cy - ry - self.y0) * SS, (cx + rx - self.x0) * SS, (cy + ry - self.y0) * SS], fill=255)
        return np.array(m) > 127
    def coords(self):
        yy, xx = np.mgrid[0:self.H, 0:self.W]
        return xx / SS + self.x0, yy / SS + self.y0

def height(mask, radius):
    d = ndimage.distance_transform_edt(mask) / SS
    h = np.sqrt(np.clip(d / radius, 0, 1))
    return ndimage.gaussian_filter(h, 1.5)

def lit(h, strength=1.0):
    gy, gx = np.gradient(h * strength * 6)
    n = np.dstack([-gx, -gy, np.ones_like(h) * 0.35])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return np.clip((n @ LIGHT), 0, 1)

def voronoi_edges(part, cell, jitter=0.9, seed=1):
    """cellular scales: 0 in the middle of a scale, 1 on the seams"""
    X, Y = part.coords()
    r = np.random.default_rng(seed)
    gx = np.floor(X / cell); gy = np.floor(Y / cell)
    d1 = np.full(X.shape, 1e9); d2 = np.full(X.shape, 1e9)
    for ox in (-1, 0, 1):
        for oy in (-1, 0, 1):
            cx = gx + ox; cy = gy + oy
            hsh = (np.sin(cx * 127.1 + cy * 311.7) * 43758.5453) % 1
            hsh2 = (np.sin(cx * 269.5 + cy * 183.3) * 43758.5453) % 1
            px = (cx + 0.5 + (hsh - 0.5) * jitter) * cell
            py = (cy + 0.5 + (hsh2 - 0.5) * jitter) * cell
            # scales overlap downwards: squash vertically a little
            dd = np.hypot(X - px, (Y - py) * 1.25)
            closer = dd < d1
            d2 = np.where(closer, d1, np.minimum(d2, dd))
            d1 = np.where(closer, dd, d1)
    edge = np.clip(1 - (d2 - d1) / (cell * 0.22), 0, 1)
    centre = np.clip(1 - d1 / (cell * 0.75), 0, 1)
    return edge, centre

def paint_scales(part, mask, h, cell=4.2, seed=1, hi=RED_HI, mid=RED_MID, lo=RED_LO, scale_k=1.0, strength=1.0):
    sh = lit(h, strength)
    edge, centre = voronoi_edges(part, cell, seed=seed)
    tone = 0.18 + 0.82 * sh
    tone = np.clip(tone - 0.22 * edge * scale_k + 0.1 * centre * scale_k * sh, 0, 1)
    # three-tone ramp for the cartoon look, softened
    c = np.where(tone[..., None] > 0.55, mid + (hi - mid) * ((tone[..., None] - 0.55) / 0.45), lo + (mid - lo) * (tone[..., None] / 0.55))
    return c, mask

def bands(part, mask, h, axis_fn, spacing, hi=ORANGE_HI, mid=ORANGE_MID, lo=ORANGE_LO, strength=1.0):
    """segmented belly plates: tone bands across axis_fn(x, y)"""
    X, Y = part.coords()
    s = axis_fn(X, Y) / spacing
    fr = s - np.floor(s)
    seam = np.clip(1 - np.minimum(fr, 1 - fr) / 0.09, 0, 1)
    plate_shade = 0.75 + 0.25 * np.cos((fr - 0.35) * math.pi)      # each plate rounded
    sh = lit(h, strength)
    tone = np.clip((0.3 + 0.7 * sh) * plate_shade - 0.35 * seam, 0, 1)
    c = np.where(tone[..., None] > 0.5, mid + (hi - mid) * ((tone[..., None] - 0.5) / 0.5), lo + (mid - lo) * (tone[..., None] / 0.5))
    return c, mask

class Canvas:
    def __init__(self, part):
        self.part = part
        self.rgb = np.zeros((part.H, part.W, 3)); self.a = np.zeros((part.H, part.W))
    def put(self, c, mask, alpha=1.0):
        m = mask.astype(float) * alpha
        self.rgb = self.rgb * (1 - m[..., None]) + c * m[..., None]
        self.a = np.maximum(self.a, m)
    def outline(self, mask, w=1.1, col=OUTLINE):
        """a dark ink line around a shape that sits on top of earlier layers"""
        r = int(round(w * SS))
        dil = ndimage.binary_dilation(mask, iterations=r)
        ring = dil & ~mask
        self.put(np.broadcast_to(col, self.rgb.shape), ring)
    def inner_line(self, mask, w=0.6, col=OUTLINE, alpha=0.8):
        r = max(1, int(round(w * SS)))
        er = ndimage.binary_erosion(mask, iterations=r)
        ring = mask & ~er
        self.put(np.broadcast_to(col, self.rgb.shape), ring, alpha)
    def image(self):
        rgba = np.dstack([np.clip(self.rgb, 0, 255), np.clip(self.a * 255, 0, 255)]).astype(np.uint8)
        im = Image.fromarray(rgba, 'RGBA')
        W = int(round((self.part.x1 - self.part.x0) * OUT)); H = int(round((self.part.y1 - self.part.y0) * OUT))
        # premultiply for a clean downscale
        arr = np.array(im).astype(float); a = arr[..., 3:4] / 255
        pm = np.dstack([arr[..., :3] * a, arr[..., 3:4]]).astype(np.uint8)
        small = np.array(Image.fromarray(pm, 'RGBA').resize((W, H), Image.LANCZOS)).astype(float)
        aa = small[..., 3:4] / 255
        rgb = np.where(aa > 0.003, small[..., :3] / np.maximum(aa, 0.003), 0)
        return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), small[..., 3:4]]).astype(np.uint8), 'RGBA')

def spike(cv, part, x, y, h, w, ang, col_hi=RED_MID, col_lo=RED_LO):
    ca, sa = math.cos(ang), math.sin(ang)
    def R(px, py): return (x + px * ca - py * sa, y + px * sa + py * ca)
    pts = [R(-w, 2), R(-w * 0.3, -h * 0.55), R(-h * 0.18, -h), R(w * 0.25, -h * 0.45), R(w, 2)]
    m = part.poly(pts, smooth=False)
    hm = height(m, w * 0.6)
    sh = lit(hm)
    c = col_lo + (col_hi - col_lo) * sh[..., None]
    cv.outline(m, 0.8)
    cv.put(c, m)

def bez(ctrl, n=24):
    """sample a smooth curve through control points (Catmull-Rom)"""
    P = [ctrl[0]] + list(ctrl) + [ctrl[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = map(np.array, (P[i - 1], P[i], P[i + 1], P[i + 2]))
        for k in range(n):
            t = k / n
            out.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)))
    out.append(tuple(ctrl[-1]))
    return out

def horn(cv, part, ctrl, w0, w1):
    """a smooth curved tapering horn, banded with growth rings"""
    pts = bez(ctrl)
    L = []; Rr = []
    n = len(pts)
    for i, (px, py) in enumerate(pts):
        a = pts[max(0, i - 1)]; b = pts[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]; d = math.hypot(dx, dy) or 1
        u = i / (n - 1)
        w = (w0 + (w1 - w0) * u ** 0.8) / 2
        L.append((px - dy / d * w, py + dx / d * w)); Rr.append((px + dy / d * w, py - dx / d * w))
    m = part.poly(L + Rr[::-1], smooth=False)
    hm = height(m, w0 * 0.45)
    sh = lit(hm)
    # growth rings follow the horn: distance along it from the root
    X, Y = part.coords()
    arc = np.zeros(X.shape); best = np.full(X.shape, 1e9); acc = 0.0
    for i in range(0, n, 2):
        dd = (X - pts[i][0]) ** 2 + (Y - pts[i][1]) ** 2
        upd = dd < best; best = np.where(upd, dd, best); arc = np.where(upd, i / n, arc)
    rings = np.clip(np.sin(arc * 34) * 2.2, 0, 1)
    tone = np.clip(0.12 + 0.88 * sh - 0.16 * rings, 0, 1)
    tipk = np.clip((arc - 0.6) / 0.4, 0, 1)
    c = HORN_LO + (HORN_HI - HORN_LO) * tone[..., None]
    c = c + tipk[..., None] * np.array([40, 34, 28])
    cv.outline(m, 1.0)
    cv.put(c, m)

def teeth(cv, part, xs, y, h, up=True):
    for x in xs:
        pts = [(x - 1.8, y), (x, y + (h if up else -h)), (x + 1.8, y)]
        m = part.poly(pts, smooth=False)
        cv.put(np.broadcast_to(np.array([246, 232, 196]), cv.rgb.shape), m)
        cv.inner_line(m, 0.3, alpha=0.6)

PARTS = {}
def save(name, part, cv, ax=0, ay=0):
    PARTS[name] = (cv.image(), part)

# ---------------------------------------------------------------- torso
def torso():
    p = Part('torso', -132, -104, 118, 66)
    cv = Canvas(p)
    body = [(106, -18), (98, -54), (70, -78), (22, -82), (-36, -66), (-84, -46), (-116, -18), (-110, 10), (-80, 32), (-24, 44), (34, 52), (84, 36)]
    for i in range(10, -1, -1):          # dorsal spikes along the back
        u = i / 10
        x = 70 - 172 * u; y = -70 + 36 * u * u - math.sin(u * math.pi) * 8
        spike(cv, p, x, y, 13 + 6 * math.sin(u * math.pi), 5 + 2 * math.sin(u * math.pi), -0.45)
    m = p.poly(body)
    h = height(m, 34)
    c, _ = paint_scales(p, m, h, cell=5.0, seed=3)
    cv.outline(m, 1.4)
    cv.put(c, m)
    # belly: the orange plated underside running from the chest back under the barrel
    belly = p.poly([(100, 0), (92, 22), (60, 42), (0, 52), (-56, 46), (-98, 20), (-92, 8), (-50, 28), (0, 34), (54, 26), (84, 6)])
    bh = height(belly & m, 10)
    bc, _ = bands(p, belly & m, bh, lambda X, Y: X * 1.0, 11)
    cv.put(bc, belly & m)
    cv.inner_line(belly & m, 0.45, alpha=0.55)
    # muscle masses: a soft lit bulge on the shoulder and haunch
    X, Y = p.coords()
    for (cx, cy, rx, ry) in [(50, -20, 30, 28), (-72, -12, 34, 30)]:
        dd = np.hypot((X - cx) / rx, (Y - cy) / ry)
        hi = np.clip(1 - dd, 0, 1) ** 1.5 * m * ~belly
        cv.rgb = cv.rgb + (hi * 26)[..., None] * np.array([1.0, 0.2, 0.15])
    save('torso', p, cv)

def torso_hot():
    p = Part('torsoHot', -132, -104, 118, 66)
    cv = Canvas(p)
    body = [(106, -18), (98, -54), (70, -78), (22, -82), (-36, -66), (-84, -46), (-116, -18), (-110, 10), (-80, 32), (-24, 44), (34, 52), (84, 36)]
    m = p.poly(body)
    cracks = [[(72, -36), (52, -22), (58, -6), (34, 4), (40, 22)], [(18, -60), (6, -40), (22, -24), (2, -8)], [(-30, -56), (-42, -36), (-26, -20), (-48, -2), (-40, 18)], [(-86, -30), (-70, -12), (-88, 2), (-76, 20)]]
    glow = np.zeros((p.H, p.W)); core = np.zeros((p.H, p.W))
    img = Image.new('L', (p.W, p.H), 0); d = ImageDraw.Draw(img)
    img2 = Image.new('L', (p.W, p.H), 0); d2 = ImageDraw.Draw(img2)
    for cr in cracks:
        d.line(p.P(cr), fill=255, width=int(5 * SS), joint='curve')
        d2.line(p.P(cr), fill=255, width=int(1.6 * SS), joint='curve')
    glow = ndimage.gaussian_filter(np.array(img) / 255.0, 2.5 * SS) * 1.6
    core = np.array(img2) / 255.0
    a = np.clip(glow * 0.8 + core, 0, 1) * m
    col = np.dstack([np.full(a.shape, 255.0), 120 + 120 * core, 30 + 120 * core])
    cv.rgb = col; cv.a = a
    save('torsoHot', p, cv)

# ---------------------------------------------------------------- neck vertebra (+x along the neck, throat on +y)
def tube_slice(name, x_len, half_w, belly_side, seed, spike_side, spike_h):
    """one slice of a smooth tube (neck / tail). The long sides carry the ink line; the two ends fade out so the
    slices, laid overlapping along the spine, read as one continuous neck instead of a stack of beads."""
    pad = 6
    p = Part(name, -pad, -half_w - spike_h - 2, x_len + pad, half_w + spike_h + 2)
    cv = Canvas(p)
    sgn = 1 if spike_side > 0 else -1
    spike(cv, p, x_len * 0.45, sgn * (half_w - 3), spike_h, 4.5, 0 if sgn < 0 else math.pi)
    X, Y = p.coords()
    m = (np.abs(Y) <= half_w) & (X >= -pad) & (X <= x_len + pad)
    # a cylinder: height from the distance to the long axis only
    h = np.sqrt(np.clip(1 - (Y / half_w) ** 2, 0, 1))
    h = ndimage.gaussian_filter(h, 1.0)
    c, _ = paint_scales(p, m, h, cell=4.4, seed=seed)
    band = m & ((Y * belly_side) > half_w * 0.18)
    bc, _ = bands(p, band, h, lambda X, Y: X, 7.5)
    # ink along the long sides
    ink = m & (np.abs(Y) > half_w - 1.2)
    fade = np.clip(np.minimum(X + pad, x_len + pad - X) / pad, 0, 1)
    prev_a = cv.a.copy()
    cv.put(c, m)
    cv.put(bc, band)
    cv.put(np.broadcast_to(OUTLINE, cv.rgb.shape), ink)
    cv.a = np.maximum(prev_a, m * fade)
    save(name, p, cv)

def neck():
    # throat (orange plates) on +y = the front of the neck; spines on -y = the back
    tube_slice('neck', 30, 25, +1, 5, -1, 13)

# ---------------------------------------------------------------- head (faces +x; origin = the head joint)
def head():
    p = Part('head', -112, -78, 92, 30)
    cv = Canvas(p)
    # back pair of horns (behind the skull)
    horn(cv, p, [(-16, -16), (-38, -34), (-62, -42), (-82, -36), (-90, -22)], 15, 3)
    horn(cv, p, [(-6, -24), (-18, -44), (-36, -56), (-54, -54), (-62, -44)], 13, 3)
    # neck frill spikes
    for i, (x, y, a) in enumerate([(-30, 0, 2.2), (-34, -10, 2.5), (-28, -18, 2.8)]):
        spike(cv, p, x, y, 12, 4, a)
    skull = [(-34, -4), (-28, -22), (-6, -32), (22, -26), (48, -16), (74, -12), (84, -4), (82, 6), (62, 10), (30, 12), (-6, 12), (-28, 10)]
    m = p.poly(skull)
    h = height(m, 16)
    c, _ = paint_scales(p, m, h, cell=3.6, seed=9)
    cv.outline(m, 1.3)
    cv.put(c, m)
    # brow ridge and cheek plate, nostril, eye
    brow = p.poly([(-6, -30), (24, -26), (34, -18), (14, -16), (-6, -20)])
    cv.put(np.broadcast_to(RED_LO, cv.rgb.shape), brow & m, 0.55)
    nos = p.ellipse(72, -6, 3.0, 1.6)
    cv.put(np.broadcast_to(np.array([30, 4, 6]), cv.rgb.shape), nos)
    eye = p.poly([(4, -14), (14, -19), (27, -15), (16, -10)])
    X, Y = p.coords()
    eg = np.clip(1 - np.hypot(X - 15, Y - 14.5) / 9, 0, 1)
    ecol = np.dstack([np.full(X.shape, 255.0), 190 + 60 * eg, 30 + 80 * eg])
    cv.outline(eye, 0.8)
    cv.put(ecol, eye)
    pupil = p.ellipse(17, -14.5, 1.1, 3.0) & eye
    cv.put(np.broadcast_to(np.array([30, 6, 6]), cv.rgb.shape), pupil)
    # front horn pair (in front of the skull) and a small nose horn
    horn(cv, p, [(8, -26), (0, -44), (-14, -58), (-32, -62), (-42, -54)], 13, 2.5)
    horn(cv, p, [(58, -12), (57, -20), (52, -27)], 6, 1.6)
    teeth(cv, p, [16, 24, 32, 40, 48, 56, 64, 72], 10, 7)
    save('head', p, cv)

def jaw():
    # sprite origin = the hinge (-12, 10) in head space
    p = Part('jaw', -14, -6, 96, 30)
    cv = Canvas(p)
    sh = lambda pts: [(x + 12, y - 10) for x, y in pts]
    teeth(cv, p, [x + 12 for x in (18, 27, 36, 45, 54, 62)], 4.5, 7, up=False)
    m = p.poly(sh([(-18, 10), (8, 22), (44, 26), (70, 18), (80, 10), (54, 13), (14, 15)]))
    h = height(m, 6)
    c, _ = bands(p, m, h, lambda X, Y: X, 7)
    top = p.poly(sh([(-18, 10), (14, 14), (54, 13), (80, 10), (78, 6), (40, 8), (0, 8)])) & m
    cr, _ = paint_scales(p, m, h, cell=3.4, seed=11)
    cv.outline(m, 1.1)
    cv.put(c, m)
    cv.put(cr, top)
    save('jaw', p, cv)

# ---------------------------------------------------------------- limbs (along +x from the joint)
def limb(name, length, w0, w1, belly=False, seed=13):
    """a muscular limb bone along +x. The root end has no ink and fades out, so the limb grows out of the body
    (or the bone above it) instead of looking bolted on."""
    p = Part(name, -w0 * 0.6, -w0 * 0.8, length + w1 * 0.75, w0 * 0.8)
    cv = Canvas(p)
    pts = [(-w0 * 0.3, -w0 / 2), (length * 0.32, -w0 * 0.5 - 3), (length * 0.75, -w1 / 2 - 1), (length, -w1 / 2), (length + w1 * 0.45, 0), (length, w1 / 2), (length * 0.6, w1 / 2 + 3), (length * 0.25, w0 / 2 + 1), (-w0 * 0.3, w0 / 2)]
    m = p.poly(pts)
    X, Y = p.coords()
    h = height(m, w0 * 0.42)
    c, _ = paint_scales(p, m, h, cell=4.0, seed=seed)
    # a muscle highlight high on the limb, a shadow line where it narrows
    hi = np.clip(1 - np.hypot((X - length * 0.3) / (length * 0.32), (Y + w0 * 0.12) / (w0 * 0.36)), 0, 1) * m
    c = c + (hi ** 1.3 * 30)[..., None] * np.array([1.0, 0.22, 0.18])
    ink = m & ~ndimage.binary_erosion(m, iterations=int(1.1 * SS))
    fade = np.clip((X + w0 * 0.3) / (w0 * 0.55), 0, 1)
    ink = ink & (X > w0 * 0.15)
    cv.put(c, m)
    cv.put(np.broadcast_to(OUTLINE, cv.rgb.shape), ink)
    cv.a = m * fade
    save(name, p, cv)

def knee():
    p = Part('knee', -12, -12, 12, 12)
    cv = Canvas(p)
    m = p.ellipse(0, 0, 8, 8)
    c, _ = paint_scales(p, m, height(m, 7), cell=3.6, seed=17)
    X, Y = p.coords()
    fade = np.clip(1 - (np.hypot(X, Y) - 5.5) / 3, 0, 1)
    cv.put(c, m)
    cv.a = m * fade
    save('knee', p, cv)

def foot():
    p = Part('foot', -24, -16, 44, 14)
    cv = Canvas(p)
    for i, cx in enumerate([12, 20, 28]):      # claws
        cm = p.poly([(cx - 3, 0), (cx + 8, 4 + i), (cx + 13, 10), (cx + 2, 6), (cx - 3, 5)], smooth=False)
        cc = np.array([58, 30, 26]) + (np.array([150, 110, 96]) - np.array([58, 30, 26])) * lit(height(cm, 2.5))[..., None]
        cv.outline(cm, 0.7); cv.put(cc, cm)
    m = p.poly([(-16, -6), (-6, -12), (12, -10), (26, -4), (30, 4), (16, 7), (-8, 6), (-18, 2)])
    c, _ = paint_scales(p, m, height(m, 8), cell=3.4, seed=19)
    cv.outline(m, 1.1); cv.put(c, m)
    spur = p.poly([(-14, 0), (-22, 6), (-12, 4)], smooth=False)
    cv.outline(spur, 0.6); cv.put(np.broadcast_to(np.array([70, 36, 30]), cv.rgb.shape), spur)
    save('foot', p, cv)

# ---------------------------------------------------------------- wing parts
def wing_arm():
    p = Part('wingArm', -10, -12, 112, 12)
    cv = Canvas(p)
    m = p.poly([(0, -8), (50, -6), (100, -4.5), (106, 0), (100, 4.5), (50, 6), (0, 8), (-7, 0)])
    h = height(m, 6)
    sh = lit(h)
    c = BONE_LO + (BONE_HI - BONE_LO) * (0.2 + 0.8 * sh)[..., None]
    cv.outline(m, 1.0); cv.put(c, m)
    save('wingArm', p, cv)

def finger():
    p = Part('finger', -4, -5, 104, 5)
    cv = Canvas(p)
    m = p.poly([(0, -3), (100, -1.3), (102, 0), (100, 1.3), (0, 3)], smooth=False)
    sh = lit(height(m, 2.5))
    c = BONE_LO + (BONE_HI - BONE_LO) * (0.2 + 0.8 * sh)[..., None]
    cv.outline(m, 0.7); cv.put(c, m)
    save('finger', p, cv)

def claw():
    p = Part('claw', -3, -6, 20, 6)
    cv = Canvas(p)
    m = p.poly([(0, -3.5), (10, -2.5), (18, 1), (8, 2.5), (0, 3.5)], smooth=False)
    c = HORN_LO + (HORN_HI - HORN_LO) * lit(height(m, 2.5))[..., None]
    cv.outline(m, 0.6); cv.put(c, m)
    save('claw', p, cv)

def wrist():
    p = Part('wrist', -14, -26, 26, 14)
    cv = Canvas(p)
    cm = p.poly([(0, -4), (8, -14), (20, -22), (12, -8), (4, 4)], smooth=False)
    cv.outline(cm, 0.8); cv.put(HORN_LO + (HORN_HI - HORN_LO) * lit(height(cm, 3))[..., None], cm)
    m = p.ellipse(0, 0, 8, 7.5)
    cv.outline(m, 1.0)
    cv.put(BONE_LO + (BONE_HI - BONE_LO) * (0.2 + 0.8 * lit(height(m, 6)))[..., None], m)
    save('wrist', p, cv)

def membrane(dark):
    """tileable wing-membrane texture: deep crimson, soft folds and veins, painted noise"""
    N = 256
    yy, xx = np.mgrid[0:N, 0:N] / N
    r = np.random.default_rng(23)
    base = np.zeros((N, N))
    for k in range(1, 6):          # periodic noise (tiles seamlessly)
        for _ in range(3):
            fx, fy, ph = r.integers(1, 4 * k), r.integers(1, 4 * k), r.random() * 6.28
            base += np.sin(2 * math.pi * (fx * xx + fy * yy) + ph) / k
    base = (base - base.min()) / (base.max() - base.min())
    folds = 0.5 + 0.5 * np.sin(2 * math.pi * (xx * 3 + yy * 1) + base * 2)
    tone = np.clip(0.35 + 0.35 * base + 0.2 * folds, 0, 1)
    lo = np.array([70, 6, 18]); hi = np.array([170, 28, 40])
    c = (lo + (hi - lo) * tone[..., None]) * dark
    return Image.fromarray(np.dstack([np.clip(c, 0, 255), np.full((N, N), 245)]).astype(np.uint8), 'RGBA')

def tail_seg():
    # the tail is laid pointing backwards (angle ~ PI): local -y ends up underneath, so the belly is on -y, spines on +y
    tube_slice('tail', 30, 18, -1, 29, +1, 14)

def tail_tip():
    p = Part('tailTip', -6, -26, 60, 26)
    cv = Canvas(p)
    m = p.poly([(0, -6), (18, -14), (30, -22), (54, 0), (30, 22), (18, 14), (0, 6)], smooth=False)
    m = ndimage.binary_closing(m, iterations=2)
    h = height(m, 9)
    c, _ = paint_scales(p, m, h, cell=4.0, seed=31, hi=np.array([190, 34, 40]), mid=np.array([130, 16, 28]), lo=np.array([70, 8, 18]))
    cv.outline(m, 1.2); cv.put(c, m)
    save('tailTip', p, cv)

for fn in (torso, torso_hot, neck, head, jaw, knee, foot, wing_arm, finger, claw, wrist, tail_seg, tail_tip):
    fn()
limb('thighF', 56, 30, 20, belly=False, seed=41)
limb('shinF', 60, 20, 12, belly=False, seed=43)
limb('thighB', 68, 40, 24, belly=False, seed=45)
limb('shinB', 64, 22, 12, belly=False, seed=47)

# pack into one sheet (simple shelf packing), with dark copies for the far side
items = []
for name, (im, part) in PARTS.items():
    items.append((name, im, part))
    if name in ('thighF', 'shinF', 'thighB', 'shinB', 'knee', 'foot', 'wingArm', 'finger', 'wrist', 'claw'):
        arr = np.array(im).astype(float)
        arr[..., :3] *= 0.58
        items.append((name + 'D', Image.fromarray(arr.astype(np.uint8), 'RGBA'), part))
mem = membrane(1.0); memD = membrane(0.62)
SHEET_W = 2048
x = y = rowh = 0
meta = {}
placed = []
for name, im, part in sorted(items, key=lambda t: -t[1].size[1]):
    w, h = im.size
    if x + w + 2 > SHEET_W: x = 0; y += rowh + 2; rowh = 0
    placed.append((name, im, x, y))
    meta[name] = {'sx': x, 'sy': y, 'sw': w, 'sh': h, 'x0': round(part.x0, 2), 'y0': round(part.y0, 2), 'w': round(part.x1 - part.x0, 2), 'h': round(part.y1 - part.y0, 2)}
    x += w + 2; rowh = max(rowh, h)
y += rowh + 2
for name, im in (('membrane', mem), ('membraneD', memD)):
    if x + 258 > SHEET_W: x = 0; y += rowh + 2; rowh = 0
    placed.append((name, im, x, y)); meta[name] = {'sx': x, 'sy': y, 'sw': 256, 'sh': 256}
    x += 258; rowh = max(rowh, 256)
H = y + rowh + 2
sheet = Image.new('RGBA', (SHEET_W, H), (0, 0, 0, 0))
for name, im, px, py in placed: sheet.paste(im, (px, py))
sheet.save(OUTDIR + '/rig.png', optimize=True)
json.dump({'scale': OUT, 'parts': meta}, open(OUTDIR + '/meta.json', 'w'))
print('sheet', sheet.size, len(meta))

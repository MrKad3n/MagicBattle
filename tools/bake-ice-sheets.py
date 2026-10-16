# Bake Glacial Reach tileset. Smooth ice masonry, no grain, no snow-cap stripes.
import os, struct, zlib, shutil

OUT = os.path.join(os.path.dirname(__file__), '..', 'images', 'dungeon')
ASSETS = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.cursor', 'projects', 'c-Users-kaden-OneDrive-Documents-GitHub-Games', 'assets'))
# Fallback: Cursor assets folder on this machine
ASSETS_CANDIDATES = [
    r'C:\Users\kaden\.cursor\projects\c-Users-kaden-OneDrive-Documents-GitHub-Games\assets',
    os.path.join(os.path.dirname(__file__), '..', 'assets'),
]

def u32(n):
    return struct.pack('>I', n & 0xffffffff)

def crc32(data):
    return zlib.crc32(data) & 0xffffffff

def chunk(typ, data):
    body = typ + data
    return u32(len(data)) + body + u32(crc32(body))

def write_png(path, w, h, rgba):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw.extend(rgba[y*stride:(y+1)*stride])
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', u32(w)+u32(h)+b'\x08\x06\x00\x00\x00') + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)

class C:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.d = bytearray(w * h * 4)
    def set(self, x, y, col):
        if x < 0 or y < 0 or x >= self.w or y >= self.h: return
        i = (y * self.w + x) * 4
        a = 255 if len(col) < 4 else col[3]
        self.d[i:i+4] = bytes((col[0], col[1], col[2], a))
    def fill(self, x, y, w, h, col):
        for yy in range(y, y+h):
            for xx in range(x, x+w):
                self.set(xx, yy, col)

def h2(x, y, s):
    n = ((x + 0x9e3779b9) * 0x85ebca6b ^ (y + 0x165667b1) * 0xc2b2ae35 ^ (s * 0x27d4eb2f)) & 0xffffffff
    n = ((n ^ (n >> 15)) * 0x85ebca6b) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffffffff

def mix(a, b, t):
    return (int(a[0]+(b[0]-a[0])*t), int(a[1]+(b[1]-a[1])*t), int(a[2]+(b[2]-a[2])*t), 255)

# Ice-stone palette sampled from the interactable sheet. No pure-white snow bands.
PAL = {
    'packed': {
        'mortar': (52, 74, 94),
        'a': (96, 128, 152),
        'b': (118, 150, 174),
        'c': (84, 114, 138),
        'hi': (148, 176, 196),
    },
    'crack': {
        'mortar': (48, 70, 90),
        'a': (110, 142, 166),
        'b': (132, 164, 186),
        'c': (90, 122, 146),
        'hi': (168, 196, 214),
        'crack': (196, 220, 232),
    },
    'snow': {
        'mortar': (72, 96, 116),
        'a': (140, 168, 188),
        'b': (158, 184, 202),
        'c': (122, 150, 172),
        'hi': (178, 200, 214),
    },
    'deep': {
        'mortar': (28, 44, 62),
        'a': (46, 72, 96),
        'b': (58, 86, 112),
        'c': (38, 60, 82),
        'hi': (78, 108, 132),
    },
}

def brick_color(pal, row, col, seed):
    n = h2(row, col, seed) & 3
    if n == 0: return pal['a']
    if n == 1: return pal['b']
    if n == 2: return pal['c']
    return mix(pal['a'], pal['b'], 0.45)

def paint_wall(dst, ox, oy, kind, seed):
    pal = PAL[kind]
    dst.fill(ox, oy, 40, 40, pal['mortar'])
    bh = 10
    bw = 20
    for row in range(4):
        y = row * bh
        odd = row & 1
        x0 = -10 if odd else 0
        bi = 0
        x = x0
        while x < 40:
            x1 = x
            x2 = x + bw
            ix = max(0, x1)
            iw = min(40, x2) - ix
            if iw > 1:
                col = brick_color(pal, row, bi + seed, seed)
                dst.fill(ox + ix, oy + y + 1, iw, bh - 2, col)
                # tiny inner shade, not a full-tile stripe
                if iw > 4:
                    dst.fill(ox + ix + 1, oy + y + 2, max(1, iw - 3), 1, pal['hi'])
                    dst.fill(ox + ix + 1, oy + y + bh - 2, max(1, iw - 3), 1, mix(col, pal['mortar'], 0.35))
                if kind == 'crack' and (h2(row, bi, seed + 9) & 7) == 0:
                    cx = ix + iw // 2
                    for k in range(2, bh - 2):
                        dst.set(ox + min(39, cx + (k & 1)), oy + y + k, pal['crack'])
            x += bw
            bi += 1
    if kind == 'crack':
        for k in range(6, 34):
            dst.set(ox + 12 + (k // 8), oy + k, PAL['crack']['crack'])

def paint_floor(dst, ox, oy, kind, seed):
    pal = PAL[kind]
    base = pal['b'] if kind == 'snow' else pal['a']
    dst.fill(ox, oy, 40, 40, base)
    # large slabs, not pixel noise
    if seed & 1:
        dst.fill(ox + 19, oy + 3, 1, 34, pal['mortar'])
        dst.fill(ox + 3, oy + 3, 16, 1, mix(base, pal['mortar'], 0.4))
        dst.fill(ox + 21, oy + 21, 16, 1, mix(base, pal['mortar'], 0.4))
    else:
        dst.fill(ox + 3, oy + 19, 34, 1, pal['mortar'])
        dst.fill(ox + 3, oy + 3, 1, 16, mix(base, pal['mortar'], 0.4))
        dst.fill(ox + 21, oy + 21, 1, 16, mix(base, pal['mortar'], 0.4))
    # faint corner shade so the tile has depth without a cap line
    dst.fill(ox, oy + 38, 40, 2, mix(base, pal['mortar'], 0.25))
    if kind == 'crack':
        for k in range(4, 36):
            dst.set(ox + 8 + k // 2, oy + k, pal['crack'])
            dst.set(ox + 9 + k // 2, oy + k, mix(pal['crack'], base, 0.4))

def paint_ceil(dst, ox, oy, seed, icicles=False):
    pal = PAL['deep']
    dst.fill(ox, oy, 40, 40, pal['a'])
    dst.fill(ox, oy, 40, 12, pal['c'])
    dst.fill(ox + 6, oy + 14, 12, 8, pal['b'])
    dst.fill(ox + 22, oy + 16, 10, 6, pal['b'])
    if icicles:
        for i, cx in enumerate((8, 20, 32)):
            h = 16 + (h2(i, seed, 3) & 7)
            for y in range(h):
                w = max(1, 5 - y // 4)
                dst.fill(ox + cx - w // 2, oy + 22 + y, w, 1, (132, 176, 198) if y < 3 else (96, 144, 172))

def paint_side(dst, ox, oy, direc):
    paint_wall(dst, ox, oy, 'packed', 11 if direc == 'L' else 17)
    if direc == 'L':
        dst.fill(ox, oy, 3, 40, PAL['packed']['hi'])
    else:
        dst.fill(ox + 37, oy, 3, 40, PAL['packed']['hi'])

def paint_ramp(dst, ox, oy, direc, seed):
    for y in range(40):
        for x in range(40):
            t = (39 - x) / 39 if direc == 'L' else x / 39 if direc == 'R' else 0.5
            cut = int((1 - t) * 34) + 3
            if y < cut:
                dst.set(ox + x, oy + y, (0, 0, 0, 0))
                continue
            pal = PAL['packed']
            col = pal['a'] if ((x // 10 + y // 10 + seed) & 1) else pal['b']
            if y == cut:
                col = pal['hi']
            dst.set(ox + x, oy + y, col)

def paint_beam(dst, ox, oy, part, seed):
    # Ice platform beam: fill the tile with masonry, no snow stripe.
    paint_wall(dst, ox, oy, 'snow' if part != 'T' else 'packed', seed)
    if part == 'L':
        dst.fill(ox, oy, 4, 40, PAL['snow']['hi'])
    if part == 'R':
        dst.fill(ox + 36, oy, 4, 40, PAL['snow']['hi'])
    if part == 'T':
        for y in range(40):
            for x in range(40):
                if x < 6 or x > 33:
                    dst.set(ox + x, oy + y, (0, 0, 0, 0))

def paint_pillar(dst, ox, oy, part, seed):
    pal = PAL['packed']
    dst.fill(ox, oy, 40, 40, (0, 0, 0, 0))
    if part == 'top':
        dst.fill(ox + 8, oy + 18, 24, 22, pal['a'])
        dst.fill(ox + 4, oy + 10, 32, 10, pal['b'])
        dst.fill(ox + 10, oy + 12, 20, 6, pal['hi'])
    elif part == 'mid':
        dst.fill(ox + 10, oy, 20, 40, pal['a'])
        dst.fill(ox + 12, oy, 4, 40, pal['hi'])
        dst.fill(ox + 24, oy, 4, 40, pal['c'])
    else:
        dst.fill(ox + 8, oy, 24, 22, pal['a'])
        dst.fill(ox + 4, oy + 20, 32, 16, pal['b'])
        dst.fill(ox + 6, oy + 32, 28, 8, pal['c'])

def paint_hang(dst, ox, oy):
    dst.fill(ox, oy, 40, 40, (0, 0, 0, 0))
    dst.fill(ox, oy, 40, 6, PAL['deep']['a'])
    for i, cx in enumerate((7, 16, 26, 34)):
        h = 22 + (i * 3) % 11
        for y in range(h):
            w = max(1, 6 - y // 5)
            col = (168, 206, 222) if y < 4 else (112, 160, 186)
            dst.fill(ox + cx - w // 2, oy + 6 + y, w, 1, col)

def paint_floor_edge(dst, ox, oy, seed):
    paint_floor(dst, ox, oy, 'packed', seed)
    # walkable lip: one ice-lit pixel, not a snow cap
    dst.fill(ox, oy, 40, 1, PAL['packed']['hi'])

def bake_tileset():
    c = C(320, 240)
    def W(col, row, k, s): paint_wall(c, col*40, row*40, k, s)
    def F(col, row, k, s): paint_floor(c, col*40, row*40, k, s)
    W(0,0,'packed',1); W(1,0,'packed',2); W(2,0,'crack',3); W(3,0,'crack',4)
    W(4,0,'snow',5); W(5,0,'snow',6); W(6,0,'deep',7); W(7,0,'deep',8)
    F(0,1,'snow',11); F(1,1,'snow',12); F(2,1,'packed',13); F(3,1,'packed',14)
    F(4,1,'deep',15); F(5,1,'deep',16); F(6,1,'crack',17); F(7,1,'crack',18)
    paint_ceil(c, 0, 80, 21, False); paint_ceil(c, 40, 80, 22, False)
    paint_side(c, 80, 80, 'L'); paint_side(c, 120, 80, 'R')
    paint_ramp(c, 160, 80, 'L', 31); paint_ramp(c, 200, 80, 'R', 32); paint_ramp(c, 240, 80, 'M', 33)
    paint_floor_edge(c, 280, 80, 19)
    paint_beam(c, 0, 120, 'L', 41); paint_beam(c, 40, 120, 'M', 42)
    paint_beam(c, 80, 120, 'R', 43); paint_beam(c, 120, 120, 'T', 44)
    paint_pillar(c, 160, 120, 'top', 45)
    paint_pillar(c, 200, 120, 'mid', 46)
    paint_pillar(c, 240, 120, 'base', 47)
    paint_hang(c, 280, 120)
    W(0,4,'packed',51); W(1,4,'crack',52); W(2,4,'snow',53); W(3,4,'deep',54)
    F(4,4,'snow',55); F(5,4,'packed',56); F(6,4,'snow',57); F(7,4,'deep',58)
    W(0,5,'snow',61); W(1,5,'crack',62); F(2,5,'snow',63); F(3,5,'deep',64)
    paint_ceil(c, 160, 200, 24, False); paint_ceil(c, 200, 200, 25, True)
    paint_ramp(c, 240, 200, 'L', 65); paint_ramp(c, 280, 200, 'R', 66)
    write_png(os.path.join(OUT, 'ice-tileset.png'), 320, 240, c.d)

def copy_props():
    names = ['ice-props-sheet.png', 'ice-crystal-sheet.png', 'ice-light-sheet.png', 'ice-ruin-sheet.png']
    src_dir = None
    for cand in ASSETS_CANDIDATES:
        if os.path.isdir(cand) and os.path.isfile(os.path.join(cand, names[0])):
            src_dir = cand
            break
    if not src_dir:
        print('prop assets not found; tileset only')
        return
    os.makedirs(OUT, exist_ok=True)
    for n in names:
        shutil.copy2(os.path.join(src_dir, n), os.path.join(OUT, n))
        print('copied', n)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    bake_tileset()
    copy_props()
    print('baked ice-tileset + copied ice prop sheets')

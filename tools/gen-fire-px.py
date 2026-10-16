"""Pixel-art Fire dungeon + fluid tiles matching the magma golem sheet."""
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'images' / 'dungeon'
OUT.mkdir(parents=True, exist_ok=True)

# Magma-golem palette: charcoal rock, orange veins, hard pixels.
K = (0, 0, 0, 0)
INK = (22, 16, 14, 255)
ROCK0 = (26, 21, 19, 255)
ROCK1 = (42, 35, 32, 255)
ROCK2 = (58, 48, 43, 255)
ROCK3 = (78, 64, 56, 255)
ASH = (96, 78, 66, 255)
LAVA0 = (122, 28, 8, 255)
LAVA1 = (196, 58, 12, 255)
LAVA2 = (255, 110, 24, 255)
LAVA3 = (255, 188, 64, 255)
METAL0 = (36, 30, 28, 255)
METAL1 = (62, 50, 44, 255)
METAL2 = (92, 74, 58, 255)
METAL3 = (140, 108, 72, 255)
W0 = (10, 28, 36, 255)
W1 = (18, 62, 74, 255)
W2 = (36, 110, 118, 255)
W3 = (120, 196, 196, 255)
W4 = (210, 240, 236, 255)


def new(w, h):
    return Image.new('RGBA', (w, h), K)


def p(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height and c[3]:
        im.putpixel((x, y), c)


def rect(im, x, y, w, h, c):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            p(im, xx, yy, c)


def hline(im, x0, x1, y, c):
    if x1 < x0:
        x0, x1 = x1, x0
    for x in range(x0, x1 + 1):
        p(im, x, y, c)


def vline(im, x, y0, y1, c):
    if y1 < y0:
        y0, y1 = y1, y0
    for y in range(y0, y1 + 1):
        p(im, x, y, c)


def outline(im):
    w, h = im.size
    src = im.copy()
    for y in range(h):
        for x in range(w):
            if src.getpixel((x, y))[3] == 0:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h or src.getpixel((nx, ny))[3] == 0:
                    p(im, x, y, INK)
                    break


def crack(im, x0, y0, x1, y1, cols):
    x, y = x0, y0
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        xx = x0 + (x1 - x0) * i // n + (1 if i % 5 == 2 else 0)
        yy = y0 + (y1 - y0) * i // n + (1 if i % 7 == 3 else -1 if i % 6 == 1 else 0)
        p(im, xx, yy, cols[i % len(cols)])
        if i % 4 == 0:
            p(im, xx + 1, yy, cols[0])


def save(im, name):
    path = OUT / name
    im.save(path)
    print('wrote', path)


def lava_surface():
    im = new(48, 16)
    for y in range(16):
        for x in range(48):
            band = y
            c = LAVA1 if band < 4 else LAVA0 if band > 10 else LAVA1
            if (x + y * 3) % 11 == 0:
                c = LAVA2
            if y < 2:
                c = LAVA3 if (x + y) % 5 != 2 else LAVA2
            elif y < 5:
                c = LAVA2 if (x % 7) != 3 else LAVA1
            if y > 12:
                c = ROCK0 if (x + y) % 9 == 0 else LAVA0
            p(im, x, y, c)
    for x in range(48):
        p(im, x, 0, LAVA3 if x % 6 != 4 else LAVA2)
        p(im, x, 1, LAVA2)
    for i in range(6):
        bx = (i * 9 + 3) % 48
        p(im, bx, 6, LAVA3)
        p(im, bx + 1, 7, LAVA2)
    save(im, 'lava-surface-px.png')


def lava_body():
    im = new(48, 32)
    for y in range(32):
        for x in range(48):
            c = LAVA0 if y > 18 else LAVA1
            if (x * 3 + y * 5) % 13 == 0:
                c = LAVA2
            if (x + y * 2) % 17 == 4:
                c = ROCK0
            if y > 24:
                c = ROCK0 if (x + y) % 8 == 0 else (18, 8, 6, 255)
            p(im, x, y, c)
    for i in range(8):
        bx = (i * 7 + 2) % 48
        by = 8 + (i * 5) % 16
        p(im, bx, by, LAVA3)
        p(im, bx, by + 1, LAVA2)
    save(im, 'lava-body-px.png')


def water_surface():
    im = new(48, 16)
    for y in range(16):
        for x in range(48):
            c = W2 if y < 6 else W1
            if y < 2:
                c = W4 if (x + y) % 6 != 3 else W3
            elif y < 5:
                c = W3 if (x % 8) != 5 else W2
            if (x + y * 4) % 15 == 0:
                c = W3
            p(im, x, y, c)
    for x in range(48):
        p(im, x, 0, W4)
    save(im, 'water-surface-px.png')


def water_body():
    im = new(48, 32)
    for y in range(32):
        for x in range(48):
            c = W1 if y < 14 else W0
            if (x * 2 + y * 3) % 11 == 0:
                c = W2
            if y > 22:
                c = (8, 20, 26, 255)
            p(im, x, y, c)
    save(im, 'water-body-px.png')


def pillar():
    im = new(48, 120)
    rect(im, 10, 8, 28, 100, ROCK1)
    rect(im, 12, 10, 8, 96, ROCK2)
    rect(im, 28, 14, 6, 88, ROCK0)
    rect(im, 6, 4, 36, 12, ROCK2)
    rect(im, 8, 6, 32, 4, ROCK3)
    rect(im, 4, 104, 40, 16, ROCK1)
    rect(im, 6, 106, 36, 6, ROCK2)
    rect(im, 10, 112, 28, 6, ROCK0)
    crack(im, 16, 18, 20, 96, (LAVA1, LAVA2, LAVA0))
    crack(im, 30, 22, 26, 90, (LAVA0, LAVA1))
    p(im, 18, 40, LAVA3)
    p(im, 19, 56, LAVA2)
    outline(im)
    save(im, 'fire-pillar-px.png')


def furnace():
    im = new(96, 100)
    rect(im, 8, 28, 80, 64, ROCK1)
    rect(im, 12, 32, 72, 52, ROCK0)
    rect(im, 18, 18, 60, 16, ROCK2)
    rect(im, 22, 12, 52, 10, ROCK1)
    rect(im, 28, 6, 40, 10, METAL1)
    rect(im, 32, 2, 32, 6, METAL2)
    rect(im, 24, 40, 48, 36, INK)
    rect(im, 28, 44, 40, 28, LAVA0)
    rect(im, 32, 48, 32, 16, LAVA1)
    rect(im, 38, 52, 12, 8, LAVA3)
    rect(im, 8, 88, 80, 12, ROCK2)
    rect(im, 12, 90, 72, 4, ROCK3)
    for x in range(30, 66, 8):
        vline(im, x, 44, 70, LAVA2)
    rect(im, 14, 50, 8, 18, METAL1)
    rect(im, 74, 50, 8, 18, METAL1)
    crack(im, 16, 34, 20, 84, (LAVA1, LAVA2))
    outline(im)
    save(im, 'fire-furnace-px.png')


def altar():
    im = new(80, 64)
    rect(im, 8, 36, 64, 20, ROCK1)
    rect(im, 12, 38, 56, 8, ROCK2)
    rect(im, 18, 20, 44, 20, ROCK1)
    rect(im, 22, 10, 36, 14, ROCK2)
    rect(im, 30, 4, 20, 10, ROCK3)
    rect(im, 34, 8, 12, 6, LAVA1)
    rect(im, 36, 10, 8, 3, LAVA3)
    crack(im, 24, 22, 28, 52, (LAVA1, LAVA2))
    crack(im, 52, 24, 50, 50, (LAVA0, LAVA1))
    rect(im, 6, 52, 68, 12, ROCK0)
    outline(im)
    save(im, 'fire-altar-px.png')


def anvil():
    im = new(56, 40)
    rect(im, 6, 10, 44, 10, METAL2)
    rect(im, 2, 12, 10, 6, METAL3)
    rect(im, 44, 14, 10, 4, METAL1)
    rect(im, 18, 20, 20, 12, METAL1)
    rect(im, 12, 30, 32, 8, ROCK1)
    rect(im, 20, 22, 8, 4, LAVA1)
    outline(im)
    save(im, 'fire-anvil-px.png')


def chain():
    im = new(16, 96)
    for i in range(12):
        y = 2 + i * 8
        even = i % 2 == 0
        if even:
            rect(im, 5, y, 6, 7, METAL2)
            rect(im, 6, y + 1, 4, 5, METAL1)
            p(im, 7, y + 2, METAL3)
        else:
            rect(im, 3, y + 1, 10, 5, METAL1)
            rect(im, 4, y + 2, 8, 3, METAL2)
    outline(im)
    save(im, 'fire-chain-px.png')


def vent():
    im = new(48, 20)
    rect(im, 2, 8, 44, 12, METAL1)
    rect(im, 4, 10, 40, 8, ROCK0)
    for x in range(8, 42, 6):
        vline(im, x, 10, 16, METAL2)
    rect(im, 10, 4, 28, 6, LAVA1)
    rect(im, 16, 2, 16, 4, LAVA2)
    p(im, 22, 1, LAVA3)
    outline(im)
    save(im, 'fire-vent-px.png')


def pipe():
    im = new(28, 88)
    rect(im, 8, 0, 12, 88, METAL1)
    rect(im, 10, 0, 4, 88, METAL2)
    rect(im, 16, 0, 2, 88, METAL0)
    for y in (10, 28, 46, 64):
        rect(im, 6, y, 16, 6, METAL2)
        rect(im, 7, y + 1, 14, 2, METAL3)
    rect(im, 10, 76, 8, 12, LAVA1)
    rect(im, 12, 80, 4, 6, LAVA3)
    outline(im)
    save(im, 'fire-pipe-px.png')


def gate():
    im = new(36, 120)
    rect(im, 4, 8, 12, 104, ROCK1)
    rect(im, 6, 10, 4, 100, ROCK2)
    rect(im, 0, 4, 28, 14, METAL1)
    rect(im, 2, 6, 24, 6, METAL2)
    rect(im, 0, 100, 28, 16, ROCK2)
    for y in range(24, 96, 14):
        rect(im, 16, y, 14, 6, METAL1)
        rect(im, 18, y + 1, 8, 2, LAVA1)
    crack(im, 8, 20, 10, 96, (LAVA1, LAVA2))
    outline(im)
    save(im, 'fire-gate-px.png')


def bridge():
    im = new(120, 40)
    rect(im, 4, 16, 112, 10, ROCK1)
    rect(im, 6, 18, 108, 4, ROCK2)
    rect(im, 0, 10, 18, 22, ROCK2)
    rect(im, 102, 8, 18, 24, ROCK1)
    rect(im, 20, 14, 16, 8, ROCK0)
    rect(im, 70, 12, 22, 6, ROCK3)
    # broken gap
    rect(im, 48, 16, 18, 10, K)
    rect(im, 50, 22, 8, 10, ROCK1)
    rect(im, 78, 24, 10, 8, ROCK0)
    crack(im, 24, 18, 46, 22, (LAVA1, LAVA0))
    outline(im)
    save(im, 'fire-bridge-px.png')


def debris():
    im = new(40, 24)
    rect(im, 4, 12, 18, 10, ROCK1)
    rect(im, 8, 8, 10, 8, ROCK2)
    rect(im, 20, 14, 16, 8, ROCK0)
    rect(im, 24, 10, 8, 6, ROCK3)
    p(im, 12, 10, LAVA2)
    p(im, 28, 12, LAVA1)
    outline(im)
    save(im, 'fire-debris-px.png')


def basalt():
    im = new(80, 72)
    rect(im, 10, 20, 54, 48, ROCK1)
    rect(im, 16, 8, 36, 24, ROCK2)
    rect(im, 22, 2, 22, 12, ROCK1)
    rect(im, 48, 28, 24, 36, ROCK0)
    rect(im, 6, 40, 20, 28, ROCK0)
    crack(im, 24, 12, 30, 60, (LAVA1, LAVA2, LAVA0))
    crack(im, 50, 32, 44, 64, (LAVA0, LAVA1))
    p(im, 28, 28, LAVA3)
    outline(im)
    save(im, 'fire-basalt-px.png')


def reservoir():
    im = new(64, 28)
    rect(im, 2, 10, 60, 16, ROCK1)
    rect(im, 4, 12, 56, 6, ROCK2)
    rect(im, 8, 4, 48, 10, ROCK0)
    rect(im, 12, 6, 40, 6, LAVA1)
    rect(im, 16, 8, 32, 3, LAVA2)
    rect(im, 0, 20, 64, 8, ROCK2)
    outline(im)
    save(im, 'fire-reservoir-px.png')


def trench():
    im = new(80, 24)
    rect(im, 0, 0, 80, 8, ROCK2)
    rect(im, 0, 16, 80, 8, ROCK1)
    rect(im, 2, 8, 76, 8, LAVA1)
    rect(im, 6, 10, 68, 4, LAVA2)
    for x in range(10, 70, 14):
        p(im, x, 11, LAVA3)
    outline(im)
    save(im, 'fire-trench-px.png')


def brazier():
    im = new(32, 48)
    rect(im, 14, 0, 4, 18, METAL1)
    rect(im, 6, 16, 20, 8, METAL2)
    rect(im, 8, 18, 16, 10, METAL1)
    rect(im, 10, 20, 12, 8, LAVA1)
    rect(im, 12, 18, 8, 6, LAVA3)
    rect(im, 4, 36, 24, 8, METAL1)
    outline(im)
    save(im, 'fire-brazier-px.png')


def cracked():
    im = new(64, 16)
    rect(im, 0, 6, 64, 10, ROCK1)
    rect(im, 0, 8, 64, 4, ROCK0)
    crack(im, 4, 8, 28, 12, (LAVA1, LAVA2))
    crack(im, 30, 7, 60, 13, (LAVA0, LAVA1))
    outline(im)
    save(im, 'fire-cracked-px.png')


def containment():
    im = new(40, 72)
    rect(im, 6, 8, 22, 56, ROCK1)
    rect(im, 8, 12, 8, 48, ROCK2)
    rect(im, 20, 16, 6, 40, ROCK0)
    rect(im, 4, 4, 28, 10, ROCK2)
    # broken bite
    rect(im, 18, 28, 16, 18, K)
    rect(im, 16, 40, 10, 8, ROCK0)
    crack(im, 10, 14, 14, 60, (LAVA1, LAVA2))
    outline(im)
    save(im, 'fire-containment-px.png')


if __name__ == '__main__':
    lava_surface()
    lava_body()
    water_surface()
    water_body()
    pillar()
    furnace()
    altar()
    anvil()
    chain()
    vent()
    pipe()
    gate()
    bridge()
    debris()
    basalt()
    reservoir()
    trench()
    brazier()
    cracked()
    containment()
    print('done')

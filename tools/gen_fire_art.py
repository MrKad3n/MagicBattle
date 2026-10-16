#!/usr/bin/env python3
"""Generate Infernal Depths tileset, backgrounds, and prop atlas.

Crisp 2D pixel art: dark basalt + thin lava veins, same family as the
magma golem. Tiles are 40x40 so they map 1:1 to gameplay TILE.
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "images", "dungeon"))
TS = 40

# Magma-golem family
OUTL = (16, 10, 8, 255)
D0 = (32, 20, 16, 255)
D1 = (52, 36, 30, 255)
D2 = (74, 52, 42, 255)
D3 = (96, 70, 56, 255)
D4 = (118, 88, 70, 255)
D5 = (142, 108, 86, 255)
D6 = (168, 128, 100, 255)
ASH0 = (36, 30, 26, 255)
ASH1 = (50, 42, 36, 255)
ASH2 = (66, 56, 46, 255)
ASH3 = (84, 70, 56, 255)
ASH4 = (104, 86, 66, 255)
L1 = (255, 214, 90, 255)
L2 = (255, 154, 40, 255)
L3 = (255, 90, 16, 255)
L4 = (196, 40, 4, 255)
L5 = (120, 20, 4, 255)
IRON0 = (28, 26, 30, 255)
IRON1 = (48, 46, 52, 255)
IRON2 = (72, 70, 78, 255)
IRON3 = (104, 100, 108, 255)
VOID = (0, 0, 0, 0)


def new_img(w, h, color=VOID):
    im = Image.new("RGBA", (w, h), color)
    return im, im.load()


def px(p, x, y, c):
    w, h = p.size if hasattr(p, "size") else (0, 0)
    # p is pixels access
    try:
        p[x, y] = c
    except Exception:
        pass


def put(pix, w, h, x, y, c):
    if 0 <= x < w and 0 <= y < h:
        pix[x, y] = c


def rect(pix, w, h, x, y, rw, rh, c):
    for yy in range(y, y + rh):
        for xx in range(x, x + rw):
            put(pix, w, h, xx, yy, c)


def hline(pix, w, h, x, y, n, c):
    for i in range(n):
        put(pix, w, h, x + i, y, c)


def vline(pix, w, h, x, y, n, c):
    for i in range(n):
        put(pix, w, h, x, y + i, c)


def outline_round_rect(pix, w, h, x, y, rw, rh, fill, outline, rad=3):
    for yy in range(y, y + rh):
        for xx in range(x, x + rw):
            dx = min(xx - x, x + rw - 1 - xx)
            dy = min(yy - y, y + rh - 1 - yy)
            if dx + dy < rad - 1:
                continue
            put(pix, w, h, xx, yy, fill)
    for yy in range(y, y + rh):
        for xx in range(x, x + rw):
            dx = min(xx - x, x + rw - 1 - xx)
            dy = min(yy - y, y + rh - 1 - yy)
            if dx + dy < rad - 1:
                continue
            edge = dx == 0 or dy == 0 or (dx + dy == rad - 1)
            if edge:
                put(pix, w, h, xx, yy, outline)


def hash2(a, b):
    return ((a * 73 + b * 137 + 19) * 1103515245 + 12345) & 0x7FFFFFFF


def brick_fill(pix, w, h, x, y, rw, rh, seed=0, hot=False, dark=False):
    """Offset brick pattern that tiles when rw/rh are multiples of 40."""
    colors = [D1, D2, D3, D2, D1]
    if dark:
        colors = [D0, D1, D2, D1, D0]
    for yy in range(y, y + rh):
        row = (yy - y) // 8
        off = 10 if row % 2 else 0
        for xx in range(x, x + rw):
            col = (xx - x + off) // 20
            hsh = hash2(row + seed, col + seed * 3)
            c = colors[hsh % len(colors)]
            # mortar
            local_x = (xx - x + off) % 20
            local_y = (yy - y) % 8
            if local_x == 0 or local_y == 0:
                c = OUTL
            elif local_x == 1 or local_y == 1:
                c = D0
            elif local_x == 19 or local_y == 7:
                c = D4 if not dark else D3
            put(pix, w, h, xx, yy, c)
            if hot and hsh % 17 == 0 and local_x not in (0, 1) and local_y not in (0, 1):
                put(pix, w, h, xx, yy, L3 if hsh % 2 else L4)


def lava_vein(pix, w, h, pts, color=L3):
    if len(pts) < 2:
        return
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for s in range(steps + 1):
            t = s / steps
            xx = int(x0 + (x1 - x0) * t)
            yy = int(y0 + (y1 - y0) * t)
            put(pix, w, h, xx, yy, color)
            if s % 3 == 0:
                put(pix, w, h, xx, yy, L2)


def cobble_fill(pix, w, h, x, y, rw, rh, seed=0, cracks=True):
    """Rounded cobbles like the golem body / cemetery stone."""
    rect(pix, w, h, x, y, rw, rh, D1)
    blobs = [
        (4, 4, 8, 7), (16, 3, 9, 8), (28, 5, 8, 7),
        (6, 16, 9, 8), (20, 15, 10, 9), (32, 18, 7, 7),
        (3, 28, 10, 8), (18, 27, 9, 8), (30, 26, 8, 9),
    ]
    for i, (bx, by, bw, bh) in enumerate(blobs):
        hsh = hash2(seed, i)
        fill = [D2, D3, D2, D4][hsh % 4]
        shade = D1
        for yy in range(by, by + bh):
            for xx in range(bx, bx + bw):
                dx = min(xx - bx, bx + bw - 1 - xx)
                dy = min(yy - by, by + bh - 1 - yy)
                if dx + dy < 2:
                    continue
                c = fill
                if dy <= 1:
                    c = D4 if fill != D4 else D5
                if yy >= by + bh - 2:
                    c = shade
                put(pix, w, h, x + xx, y + yy, c)
    if cracks:
        lava_vein(pix, w, h, [(x + 8, y + 2), (x + 10, y + 18), (x + 7, y + 36)], L3 if seed % 2 == 0 else L4)
        if seed % 3 == 0:
            lava_vein(pix, w, h, [(x + 24, y + 6), (x + 28, y + 22), (x + 22, y + 38)], L4)


def floor_top_strip(pix, w, h, x, y, rw, variant=0):
    """Ash / ember crust — cemetery grass analog."""
    for xx in range(x, x + rw):
        n = hash2(xx, variant)
        hgt = 5 + (n % 3)
        for k in range(hgt):
            c = ASH3 if k < 2 else (ASH2 if k < 4 else ASH1)
            if (n + k) % 11 == 0:
                c = ASH4
            if (n + k) % 17 == 0:
                c = L3
            put(pix, w, h, xx, y + k, c)
        # dirt under crust
        put(pix, w, h, xx, y + hgt, D2)
        put(pix, w, h, xx, y, ASH4 if n % 5 else D6)


def draw_wall_tile(im, variant):
    pix, w, h = im.load(), *im.size
    hot = variant in (2, 5)
    dark = variant in (3,)
    brick = variant in (4, 0, 1, 5)
    if brick:
        brick_fill(pix, w, h, 0, 0, 40, 40, seed=variant, hot=hot, dark=dark)
    else:
        cobble_fill(pix, w, h, 0, 0, 40, 40, seed=variant + 3, cracks=hot or variant == 2)
    if variant == 2:
        lava_vein(pix, w, h, [(18, 0), (20, 14), (16, 28), (22, 39)], L2)


def draw_ceil_tile(im, variant):
    pix, w, h = im.load(), *im.size
    brick_fill(pix, w, h, 0, 0, 40, 40, seed=20 + variant, dark=True)
    # darker drip edge at bottom (faces the room)
    for x in range(40):
        put(pix, w, h, x, 38, D0)
        put(pix, w, h, x, 39, OUTL)
        if hash2(x, variant) % 6 == 0:
            put(pix, w, h, x, 37, L5)


def draw_floor_tile(im, variant):
    pix, w, h = im.load(), *im.size
    if variant == 5:
        # dedicated walk-surface cap
        cobble_fill(pix, w, h, 0, 8, 40, 32, seed=11, cracks=False)
        floor_top_strip(pix, w, h, 0, 0, 40, 5)
        return
    if variant == 3:
        cobble_fill(pix, w, h, 0, 0, 40, 40, seed=7, cracks=True)
        lava_vein(pix, w, h, [(4, 8), (16, 18), (10, 32), (28, 38)], L2)
        return
    if variant == 4:
        brick_fill(pix, w, h, 0, 0, 40, 40, seed=9, hot=True)
        return
    if variant == 2:
        brick_fill(pix, w, h, 0, 0, 40, 40, seed=4)
        return
    if variant == 6:
        rect(pix, w, h, 0, 0, 40, 40, ASH0)
        for i in range(40):
            for j in range(40):
                if hash2(i, j) % 9 == 0:
                    put(pix, w, h, i, j, ASH1)
                if hash2(i + 3, j) % 23 == 0:
                    put(pix, w, h, i, j, ASH2)
        return
    if variant == 7:
        cobble_fill(pix, w, h, 0, 0, 40, 40, seed=15, cracks=False)
        vline(pix, w, h, 0, 0, 40, D5)
        return
    cobble_fill(pix, w, h, 0, 0, 40, 40, seed=variant, cracks=variant == 1)
    if variant <= 1:
        floor_top_strip(pix, w, h, 0, 0, 40, variant)


def stone_beam(pix, w, h, x, y, rw, rh, cap_left=False, cap_right=False, cracked=False, seed=0):
    """Cemetery-style rounded stone beam."""
    for yy in range(y, y + rh):
        for xx in range(x, x + rw):
            # round left/right caps
            lx = xx - x
            rx = x + rw - 1 - xx
            ty = yy - y
            by = y + rh - 1 - yy
            if cap_left and lx < 6 and (lx + min(ty, by) < 4):
                continue
            if cap_right and rx < 6 and (rx + min(ty, by) < 4):
                continue
            c = D3
            if ty <= 2:
                c = D5
            elif ty <= 5:
                c = D4
            elif by <= 2:
                c = D1
            elif by <= 5:
                c = D2
            if (lx + ty + seed) % 13 == 0:
                c = D4
            put(pix, w, h, xx, yy, c)
    # outline
    for yy in range(y, y + rh):
        for xx in range(x, x + rw):
            cur = pix[xx, yy]
            if cur[3] == 0:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = xx + dx, yy + dy
                empty = True
                if 0 <= nx < w and 0 <= ny < h:
                    empty = pix[nx, ny][3] == 0
                if empty:
                    put(pix, w, h, xx, yy, OUTL)
                    break
    # inner highlight
    for xx in range(x + 3, x + rw - 3):
        put(pix, w, h, xx, y + 2, D6)
    if cracked:
        lava_vein(pix, w, h, [(x + 8, y + 4), (x + rw // 2, y + rh // 2), (x + rw - 10, y + rh - 5)], L3)


def draw_beam_tile(im, kind):
    pix, w, h = im.load(), *im.size
    # beam sits in the top ~18px like cemetery platforms
    y0, bh = 8, 18
    if kind == 0:  # left cap
        stone_beam(pix, w, h, 2, y0, 38, bh, cap_left=True, seed=1)
    elif kind == 1:  # mid
        stone_beam(pix, w, h, 0, y0, 40, bh, seed=2)
        # faint mortar joints
        vline(pix, w, h, 20, y0 + 2, bh - 4, D2)
    elif kind == 2:  # right cap
        stone_beam(pix, w, h, 0, y0, 38, bh, cap_right=True, seed=3)
    elif kind == 3:  # T-junction (beam + down join)
        stone_beam(pix, w, h, 0, y0, 40, bh, seed=4)
        stone_beam(pix, w, h, 12, y0 + bh - 2, 16, 40 - (y0 + bh - 2), seed=5)
    elif kind == 4:  # join nub
        stone_beam(pix, w, h, 0, y0, 40, bh, seed=6)
        rect(pix, w, h, 14, y0 + bh - 1, 12, 6, D3)
    elif kind == 5:  # cracked mid
        stone_beam(pix, w, h, 0, y0, 40, bh, cracked=True, seed=7)
    elif kind == 6:  # thin beam
        stone_beam(pix, w, h, 0, 12, 40, 12, seed=8)
    else:  # end stub
        stone_beam(pix, w, h, 8, y0, 24, bh, cap_left=True, cap_right=True, seed=9)


def draw_pillar_tile(im, kind):
    pix, w, h = im.load(), *im.size
    cx = 20
    if kind == 0:  # capital
        stone_beam(pix, w, h, 4, 8, 32, 14, cap_left=True, cap_right=True, seed=10)
        stone_beam(pix, w, h, 12, 20, 16, 20, seed=11)
    elif kind == 1:  # shaft
        stone_beam(pix, w, h, 12, 0, 16, 40, seed=12)
        lava_vein(pix, w, h, [(20, 2), (19, 20), (21, 38)], L4)
    elif kind == 2:  # base
        stone_beam(pix, w, h, 12, 0, 16, 18, seed=13)
        stone_beam(pix, w, h, 4, 20, 32, 16, cap_left=True, cap_right=True, seed=14)
    elif kind == 3:  # thin shaft
        stone_beam(pix, w, h, 15, 0, 10, 40, seed=15)
    elif kind == 4:  # hot shaft
        stone_beam(pix, w, h, 12, 0, 16, 40, cracked=True, seed=16)
        lava_vein(pix, w, h, [(20, 0), (18, 16), (22, 28), (19, 39)], L2)
    elif kind == 5:  # wide capital
        stone_beam(pix, w, h, 2, 6, 36, 16, cap_left=True, cap_right=True, seed=17)
        stone_beam(pix, w, h, 10, 20, 20, 20, seed=18)
    elif kind == 6:  # stub / short post
        stone_beam(pix, w, h, 10, 10, 20, 26, cap_left=True, cap_right=True, seed=19)
    else:  # chain segment
        for i in range(3):
            yy = 4 + i * 12
            rect(pix, w, h, 17, yy, 6, 8, IRON1)
            rect(pix, w, h, 18, yy + 1, 4, 6, IRON2)
            put(pix, w, h, 19, yy + 2, IRON3)
            # outline
            hline(pix, w, h, 17, yy, 6, OUTL)
            hline(pix, w, h, 17, yy + 7, 6, OUTL)


def draw_fence(im, variant=0):
    pix, w, h = im.load(), *im.size
    # cemetery-style iron fence, darker + ember tips
    for x in (4, 14, 24, 34):
        vline(pix, w, h, x, 8, 28, IRON1)
        vline(pix, w, h, x + 1, 8, 28, IRON2)
        put(pix, w, h, x, 6, IRON3)
        put(pix, w, h, x + 1, 5, L2 if variant else IRON3)
        put(pix, w, h, x, 5, L3 if variant else IRON2)
    hline(pix, w, h, 2, 18, 36, IRON2)
    hline(pix, w, h, 2, 19, 36, IRON1)


def draw_bush(im, variant=0):
    pix, w, h = im.load(), *im.size
    # ember-leaf bush (cemetery foliage analog)
    blobs = [(8, 18, 14, 12), (18, 14, 16, 14), (6, 24, 12, 10), (22, 22, 14, 12)]
    if variant:
        blobs = [(10, 16, 16, 14), (4, 22, 14, 12), (20, 20, 16, 14)]
    cols = [ASH1, ASH2, D3, ASH3]
    for i, (bx, by, bw, bh) in enumerate(blobs):
        fill = cols[i % len(cols)]
        for yy in range(by, by + bh):
            for xx in range(bx, bx + bw):
                dx = min(xx - bx, bx + bw - 1 - xx)
                dy = min(yy - by, by + bh - 1 - yy)
                if dx + dy < 3:
                    continue
                c = fill
                if dy < 2:
                    c = ASH3
                if hash2(xx, yy + variant) % 8 == 0:
                    c = L3
                elif hash2(xx + 2, yy) % 11 == 0:
                    c = L2
                put(pix, w, h, xx, yy, c)
    # stem
    vline(pix, w, h, 19, 30, 8, D1)
    vline(pix, w, h, 20, 30, 8, D2)


def draw_mound(im, variant=0):
    pix, w, h = im.load(), *im.size
    # dirt/ash mound like cemetery dirt blob, smaller
    for yy in range(40):
        for xx in range(40):
            cx, cy = 20, 28
            rx, ry = 18, 12
            nx = (xx - cx) / rx
            ny = (yy - cy) / ry
            if nx * nx + ny * ny <= 1:
                c = ASH1
                if ny > 0.3:
                    c = ASH0
                if ny < -0.2:
                    c = ASH2
                if hash2(xx, yy + variant) % 13 == 0:
                    c = ASH3
                if hash2(xx, yy) % 19 == 0:
                    c = L4
                put(pix, w, h, xx, yy, c)


def draw_grate(im):
    pix, w, h = im.load(), *im.size
    rect(pix, w, h, 2, 4, 36, 32, IRON0)
    for x in range(6, 36, 6):
        vline(pix, w, h, x, 6, 28, IRON2)
    for y in range(8, 34, 6):
        hline(pix, w, h, 4, y, 32, IRON1)
    for x in range(2, 38):
        put(pix, w, h, x, 4, IRON3)
        put(pix, w, h, x, 35, OUTL)


def draw_glow(im, variant=0):
    pix, w, h = im.load(), *im.size
    cobble_fill(pix, w, h, 0, 0, 40, 40, seed=30, cracks=False)
    for yy in range(8, 32):
        for xx in range(8, 32):
            d = ((xx - 20) ** 2 + (yy - 20) ** 2) ** 0.5
            if d < 10:
                put(pix, w, h, xx, yy, L1 if d < 3 else (L2 if d < 6 else L3))


def draw_face_brick(im):
    pix, w, h = im.load(), *im.size
    brick_fill(pix, w, h, 0, 0, 40, 40, seed=22)
    # carved arch hint
    for a in range(10, 30):
        put(pix, w, h, a, 12, D5)
        put(pix, w, h, 10, 12 + (a - 10), D4)
        put(pix, w, h, 29, 12 + (a - 10), D4)


def draw_arch_brick(im):
    pix, w, h = im.load(), *im.size
    brick_fill(pix, w, h, 0, 0, 40, 40, seed=25, dark=True)
    for xx in range(40):
        for yy in range(40):
            # circular hole in lower half
            if ((xx - 20) ** 2 + (yy - 28) ** 2) < 140:
                put(pix, w, h, xx, yy, VOID)


def draw_door_piece(im, kind):
    pix, w, h = im.load(), *im.size
    brick_fill(pix, w, h, 0, 0, 40, 40, seed=40 + kind)
    if kind == 0:  # left jamb
        rect(pix, w, h, 0, 0, 14, 40, D3)
        vline(pix, w, h, 13, 0, 40, D5)
        lava_vein(pix, w, h, [(6, 2), (7, 20), (5, 38)], L3)
    elif kind == 1:
        rect(pix, w, h, 26, 0, 14, 40, D3)
        vline(pix, w, h, 26, 0, 40, D5)
        lava_vein(pix, w, h, [(33, 2), (32, 20), (34, 38)], L3)
    elif kind == 2:  # lintel
        stone_beam(pix, w, h, 0, 10, 40, 16, seed=41)
    else:
        stone_beam(pix, w, h, 0, 18, 40, 16, seed=42)


def draw_bracket(im):
    pix, w, h = im.load(), *im.size
    rect(pix, w, h, 14, 10, 6, 16, IRON1)
    rect(pix, w, h, 12, 24, 16, 6, IRON2)
    # flame
    put(pix, w, h, 20, 8, L1)
    put(pix, w, h, 19, 9, L2)
    put(pix, w, h, 21, 9, L2)
    put(pix, w, h, 20, 10, L3)
    put(pix, w, h, 18, 11, L3)
    put(pix, w, h, 22, 11, L4)


def draw_rubble(im):
    pix, w, h = im.load(), *im.size
    chunks = [(6, 26, 10, 8), (14, 22, 12, 12), (24, 28, 10, 8), (10, 32, 16, 6)]
    for i, (bx, by, bw, bh) in enumerate(chunks):
        for yy in range(by, by + bh):
            for xx in range(bx, bx + bw):
                dx = min(xx - bx, bx + bw - 1 - xx)
                dy = min(yy - by, by + bh - 1 - yy)
                if dx + dy < 1:
                    continue
                c = D3 if i % 2 == 0 else D2
                if dy == 0:
                    c = D4
                put(pix, w, h, xx, yy, c)
        if i == 1:
            put(pix, w, h, bx + 4, by + 4, L3)


def draw_vent_tile(im):
    pix, w, h = im.load(), *im.size
    stone_beam(pix, w, h, 4, 16, 32, 16, cap_left=True, cap_right=True, seed=50)
    rect(pix, w, h, 12, 20, 16, 8, D0)
    for x in range(14, 26, 3):
        vline(pix, w, h, x, 20, 8, IRON1)
    put(pix, w, h, 18, 18, L2)
    put(pix, w, h, 20, 17, L3)


def draw_ramp(im, kind):
    pix, w, h = im.load(), *im.size
    # sloped stone: kind 0 rises to the right, 1 falls to the right
    for x in range(40):
        t = x / 39
        if kind == 1:
            t = 1 - t
        top = int(20 - t * 12)
        stone_beam(pix, w, h, x, top, 1, 16, seed=60 + kind)
    # clean outline along slope
    for x in range(40):
        t = x / 39
        if kind == 1:
            t = 1 - t
        top = int(20 - t * 12)
        put(pix, w, h, x, top, OUTL)


def draw_edge_wall(im, kind):
    pix, w, h = im.load(), *im.size
    brick_fill(pix, w, h, 0, 0, 40, 40, seed=70 + kind)
    if kind == 0:  # left face
        vline(pix, w, h, 0, 0, 40, D5)
        vline(pix, w, h, 1, 0, 40, D4)
    elif kind == 1:
        vline(pix, w, h, 39, 0, 40, D5)
        vline(pix, w, h, 38, 0, 40, D4)
    elif kind == 2:
        hline(pix, w, h, 0, 0, 40, D5)
        floor_top_strip(pix, w, h, 0, 0, 40, 8)
    else:
        hline(pix, w, h, 0, 39, 40, OUTL)
        hline(pix, w, h, 0, 38, 40, D0)


def build_tileset():
    cols, rows = 8, 8
    im, _ = new_img(cols * TS, rows * TS)
    cells = {}

    def cell(c, r):
        box = (c * TS, r * TS, (c + 1) * TS, (r + 1) * TS)
        tile = Image.new("RGBA", (TS, TS), VOID)
        return tile, box

    def paste(tile, c, r, name):
        im.paste(tile, (c * TS, r * TS))
        cells[name] = (c, r)

    # Row 0 walls
    names0 = ["wallA", "wallB", "wallVein", "wallDark", "wallBrick", "wallHot", "ceilA", "ceilB"]
    for i, name in enumerate(names0):
        t, _ = cell(i, 0)
        if i >= 6:
            draw_ceil_tile(t, i - 6)
        else:
            draw_wall_tile(t, i)
        paste(t, i, 0, name)

    # Row 1 floors
    names1 = ["floorAshA", "floorAshB", "floorBrick", "floorCrack", "floorHot", "floorTop", "floorDirt", "floorEdge"]
    for i, name in enumerate(names1):
        t, _ = cell(i, 1)
        draw_floor_tile(t, i)
        paste(t, i, 1, name)

    # Row 2 beams
    names2 = ["beamL", "beamM", "beamR", "beamT", "beamJoin", "beamCrack", "beamThin", "beamEnd"]
    for i, name in enumerate(names2):
        t, _ = cell(i, 2)
        draw_beam_tile(t, i)
        paste(t, i, 2, name)

    # Row 3 pillars
    names3 = ["pilTop", "pilMid", "pilBase", "pilThin", "pilHot", "pilWide", "pilStub", "chain"]
    for i, name in enumerate(names3):
        t, _ = cell(i, 3)
        draw_pillar_tile(t, i)
        paste(t, i, 3, name)

    # Row 4 dressing
    names4 = ["grate", "fence", "bush", "mound", "glow", "crackDec", "face", "arch"]
    drawers4 = [draw_grate, lambda t: draw_fence(t, 0), lambda t: draw_bush(t, 0),
                lambda t: draw_mound(t, 0), lambda t: draw_glow(t, 0),
                lambda t: draw_floor_tile(t, 3), draw_face_brick, draw_arch_brick]
    for i, name in enumerate(names4):
        t, _ = cell(i, 4)
        drawers4[i](t)
        paste(t, i, 4, name)

    # Row 5
    names5 = ["doorL", "doorR", "doorTop", "doorBot", "bracket", "statueBase", "rubble", "vent"]
    for i, name in enumerate(names5):
        t, _ = cell(i, 5)
        if i < 4:
            draw_door_piece(t, i)
        elif i == 4:
            draw_bracket(t)
        elif i == 5:
            draw_pillar_tile(t, 2)
        elif i == 6:
            draw_rubble(t)
        else:
            draw_vent_tile(t)
        paste(t, i, 5, name)

    # Row 6 edges / ramps
    names6 = ["rampL", "rampR", "rampM", "beamShadow", "wallL", "wallR", "wallTop", "wallBot"]
    for i, name in enumerate(names6):
        t, _ = cell(i, 6)
        if i <= 1:
            draw_ramp(t, i)
        elif i == 2:
            draw_beam_tile(t, 1)
        elif i == 3:
            rect(t.load(), 40, 40, 0, 20, 40, 8, (0, 0, 0, 70))
        else:
            draw_edge_wall(t, i - 4)
        paste(t, i, 6, name)

    # Row 7 variants
    t, _ = cell(0, 7)
    draw_wall_tile(t, 1)
    paste(t, 0, 7, "wallC")
    t, _ = cell(1, 7)
    draw_floor_tile(t, 1)
    paste(t, 1, 7, "floorC")
    t, _ = cell(2, 7)
    draw_beam_tile(t, 5)
    paste(t, 2, 7, "beamM2")
    t, _ = cell(3, 7)
    draw_pillar_tile(t, 4)
    paste(t, 3, 7, "pilMid2")
    t, _ = cell(4, 7)
    draw_bush(t, 1)
    paste(t, 4, 7, "bush2")
    t, _ = cell(5, 7)
    draw_mound(t, 1)
    paste(t, 5, 7, "mound2")
    t, _ = cell(6, 7)
    draw_fence(t, 1)
    paste(t, 6, 7, "fence2")
    t, _ = cell(7, 7)
    draw_glow(t, 1)
    paste(t, 7, 7, "glow2")

    path = os.path.join(OUT, "fire-tileset.png")
    im.save(path)
    return path, cells


def silhouette_temple(pix, w, h, x, y, scale=1, color=(22, 10, 12, 255)):
    # peaked hall + twin spires (cemetery church analog)
    s = scale
    rect(pix, w, h, x, y + 20 * s, 70 * s, 40 * s, color)
    # roof
    for i in range(40 * s):
        half = int((1 - i / (40 * s)) * 36 * s)
        hline(pix, w, h, x + 35 * s - half, y + i, half * 2, color)
    # spires
    vline(pix, w, h, x + 12 * s, y + 4 * s, 20 * s, color)
    vline(pix, w, h, x + 56 * s, y + 2 * s, 22 * s, color)
    put(pix, w, h, x + 12 * s, y + 2 * s, color)
    put(pix, w, h, x + 56 * s, y + 0 * s, color)
    # door hole
    rect(pix, w, h, x + 28 * s, y + 36 * s, 14 * s, 24 * s, (10, 4, 6, 255))


def build_bg_far():
    w, h = 480, 240
    im, pix = new_img(w, h, (12, 6, 8, 255))
    # vertical cavern gradient
    for y in range(h):
        t = y / (h - 1)
        r = int(10 + t * 28)
        g = int(4 + t * 8)
        b = int(8 + t * 4)
        hline(pix, w, h, 0, y, w, (r, g, b, 255))
    # magma moon
    cx, cy, rad = 120, 52, 28
    for yy in range(cy - rad - 8, cy + rad + 9):
        for xx in range(cx - rad - 8, cx + rad + 9):
            d = ((xx - cx) ** 2 + (yy - cy) ** 2) ** 0.5
            if d < rad:
                c = L1 if d < rad * 0.35 else (L2 if d < rad * 0.7 else L3)
                put(pix, w, h, xx, yy, c)
            elif d < rad + 10:
                a = int(80 * (1 - (d - rad) / 10))
                put(pix, w, h, xx, yy, (255, 90, 20, a))
    # distant temples
    silhouette_temple(pix, w, h, 40, 110, 1, (20, 8, 10, 255))
    silhouette_temple(pix, w, h, 200, 90, 2, (16, 6, 8, 255))
    silhouette_temple(pix, w, h, 360, 120, 1, (22, 9, 11, 255))
    # distant nubs (basalt "headstones")
    for i, x in enumerate(range(16, 470, 28)):
        hh = 8 + (i * 7) % 14
        rect(pix, w, h, x, 200 - hh, 6 + i % 3, hh, (18, 8, 10, 255))
    # haze
    for y in range(180, 240):
        a = int(40 + (y - 180) * 1.2)
        for x in range(w):
            r, g, b, _ = pix[x, y]
            put(pix, w, h, x, y, (min(255, r + 20), min(255, g + 6), b, 255))
    path = os.path.join(OUT, "fire-bg-far.png")
    im.save(path)
    return path


def build_bg_mid():
    w, h = 400, 200
    im, pix = new_img(w, h, VOID)
    col = (28, 14, 14, 255)
    # broken columns
    for x, ht in ((30, 160), (90, 120), (200, 180), (270, 90), (340, 150)):
        rect(pix, w, h, x, h - ht, 18, ht, col)
        rect(pix, w, h, x - 4, h - ht, 26, 10, (36, 18, 16, 255))
        if ht > 140:
            rect(pix, w, h, x + 2, h - ht + 30, 14, 8, L5)
    # arch
    for xx in range(120, 200):
        for yy in range(40, 120):
            d = ((xx - 160) ** 2 / 1600 + (yy - 120) ** 2 / 2500)
            if 0.7 < d < 1.05:
                put(pix, w, h, xx, yy, (32, 16, 14, 255))
    # hanging stubs
    for x in (150, 170, 310):
        vline(pix, w, h, x, 0, 28, (40, 22, 18, 255))
    path = os.path.join(OUT, "fire-bg-mid.png")
    im.save(path)
    return path


def build_bg_near():
    w, h = 240, 100
    im, pix = new_img(w, h, VOID)
    # row of ember bushes + ash
    for i, x in enumerate((8, 50, 100, 150, 190)):
        tile = Image.new("RGBA", (40, 40), VOID)
        draw_bush(tile, i % 2)
        im.paste(tile, (x, 50), tile)
        mound = Image.new("RGBA", (40, 40), VOID)
        draw_mound(mound, i)
        im.paste(mound, (x + 10, 60), mound)
    path = os.path.join(OUT, "fire-bg-near.png")
    im.save(path)
    return path


def prop_brazier(im):
    pix, w, h = im.load(), *im.size
    # standing bowl on a short pillar — 40x56 drawn in 80 cell
    ox, oy = 20, 24
    stone_beam(pix, w, h, ox + 12, oy + 28, 16, 24, seed=80)
    stone_beam(pix, w, h, ox + 4, oy + 16, 32, 14, cap_left=True, cap_right=True, seed=81)
    # fire
    for i, (fx, fy, c) in enumerate(((20, 10, L1), (16, 14, L2), (24, 14, L2), (20, 16, L3), (14, 18, L3), (26, 18, L4))):
        put(pix, w, h, ox + fx, oy + fy, c)
        put(pix, w, h, ox + fx + 1, oy + fy, c)


def prop_anvil(im):
    pix, w, h = im.load(), *im.size
    ox, oy = 16, 28
    stone_beam(pix, w, h, ox, oy + 24, 48, 16, seed=82)
    # anvil body
    rect(pix, w, h, ox + 8, oy + 8, 36, 16, IRON1)
    rect(pix, w, h, ox + 4, oy + 4, 40, 8, IRON2)
    rect(pix, w, h, ox + 2, oy + 6, 10, 6, IRON3)  # horn
    rect(pix, w, h, ox + 40, oy + 6, 8, 6, IRON2)
    lava_vein(pix, w, h, [(ox + 16, oy + 6), (ox + 22, oy + 16), (ox + 18, oy + 24)], L3)


def prop_altar(im):
    pix, w, h = im.load(), *im.size
    ox, oy = 12, 20
    stone_beam(pix, w, h, ox + 8, oy + 28, 40, 20, seed=83)
    stone_beam(pix, w, h, ox + 4, oy + 16, 48, 14, seed=84)
    stone_beam(pix, w, h, ox + 14, oy + 4, 28, 14, cap_left=True, cap_right=True, seed=85)
    # bowl
    rect(pix, w, h, ox + 22, oy + 2, 12, 6, D2)
    put(pix, w, h, ox + 27, oy + 0, L1)
    put(pix, w, h, ox + 26, oy + 1, L2)
    put(pix, w, h, ox + 28, oy + 1, L3)


def prop_furnace(im):
    pix, w, h = im.load(), *im.size
    brick_fill(pix, w, h, 12, 16, 56, 56, seed=90)
    # taper top
    for y in range(0, 16):
        inset = 16 - y
        brick_fill(pix, w, h, 12 + inset, y, 56 - inset * 2, 1, seed=91)
    # chimney
    brick_fill(pix, w, h, 32, 0, 16, 12, seed=92)
    # arch mouth
    for yy in range(36, 72):
        for xx in range(28, 52):
            if ((xx - 40) ** 2 / 100 + (yy - 56) ** 2 / 180) < 1:
                put(pix, w, h, xx, yy, D0)
    put(pix, w, h, 40, 50, L1)
    put(pix, w, h, 38, 54, L2)
    put(pix, w, h, 42, 54, L3)
    put(pix, w, h, 40, 58, L2)
    # iron bands
    hline(pix, w, h, 16, 24, 48, IRON1)
    hline(pix, w, h, 14, 40, 52, IRON1)


def prop_debris(im):
    pix, w, h = im.load(), *im.size
    draw_rubble(im)
    # shift down into 80 cell
    pass


def prop_chain(im):
    pix, w, h = im.load(), *im.size
    for i in range(6):
        yy = 4 + i * 12
        rect(pix, w, h, 37, yy, 6, 9, IRON1)
        rect(pix, w, h, 38, yy + 1, 4, 7, IRON2)
        hline(pix, w, h, 37, yy, 6, OUTL)


def prop_pipe(im):
    pix, w, h = im.load(), *im.size
    rect(pix, w, h, 34, 4, 12, 72, IRON1)
    rect(pix, w, h, 36, 6, 4, 68, IRON3)
    rect(pix, w, h, 30, 4, 20, 8, IRON2)
    put(pix, w, h, 38, 70, L3)
    put(pix, w, h, 39, 68, L2)


def prop_gate(im):
    pix, w, h = im.load(), *im.size
    # stone frame
    stone_beam(pix, w, h, 16, 4, 48, 10, seed=100)
    stone_beam(pix, w, h, 16, 4, 10, 72, seed=101)
    stone_beam(pix, w, h, 54, 4, 10, 72, seed=102)
    stone_beam(pix, w, h, 12, 68, 56, 10, seed=103)
    # dark opening
    rect(pix, w, h, 26, 14, 28, 54, (8, 4, 4, 255))


def prop_basalt(im):
    pix, w, h = im.load(), *im.size
    draw_mound(im, 2)
    # larger mound using extra blobs
    for bx, by, bw, bh in ((20, 40, 40, 28), (8, 50, 28, 20), (44, 48, 28, 22)):
        for yy in range(by, by + bh):
            for xx in range(bx, bx + bw):
                dx = min(xx - bx, bx + bw - 1 - xx)
                dy = min(yy - by, by + bh - 1 - yy)
                if dx + dy < 4:
                    continue
                c = D2 if dy > 8 else D3
                if hash2(xx, yy) % 15 == 0:
                    c = L4
                put(pix, w, h, xx, yy, c)


def prop_idol(im):
    """Hooded statue analog — folded arms, lava-stone robe."""
    pix, w, h = im.load(), *im.size
    ox, oy = 16, 8
    # pedestal
    stone_beam(pix, w, h, ox + 4, oy + 60, 40, 12, seed=110)
    # body
    for yy in range(18, 62):
        width = 18 + (yy - 18) // 6
        x0 = ox + 24 - width // 2
        for xx in range(x0, x0 + width):
            c = D3 if yy < 40 else D2
            if xx == x0 or xx == x0 + width - 1:
                c = OUTL
            put(pix, w, h, xx, oy + yy - 18 + 8, c)
    # hood
    for yy in range(0, 22):
        width = 10 + yy
        if yy > 14:
            width = 24 - (yy - 14)
        x0 = ox + 24 - width // 2
        for xx in range(x0, x0 + width):
            put(pix, w, h, xx, oy + yy, D2 if yy > 4 else D1)
        hline(pix, w, h, x0, oy + yy, width, OUTL if yy in (0, 21) else D2)
    # void face
    rect(pix, w, h, ox + 20, oy + 10, 8, 10, D0)
    # folded arms
    hline(pix, w, h, ox + 12, oy + 36, 24, D4)
    hline(pix, w, h, ox + 12, oy + 37, 24, D3)
    # lava crack
    lava_vein(pix, w, h, [(ox + 24, oy + 22), (ox + 22, oy + 40), (ox + 26, oy + 58)], L3)


def prop_containment(im):
    pix, w, h = im.load(), *im.size
    stone_beam(pix, w, h, 24, 16, 16, 56, seed=120)
    stone_beam(pix, w, h, 16, 12, 32, 10, seed=121)
    # iron hoop
    for y in (28, 44, 60):
        hline(pix, w, h, 20, y, 24, IRON2)


def prop_hang_brazier(im):
    pix, w, h = im.load(), *im.size
    vline(pix, w, h, 40, 2, 16, IRON1)
    # triangle hang
    for i in range(12):
        put(pix, w, h, 40 - i, 18 + i, IRON1)
        put(pix, w, h, 40 + i, 18 + i, IRON1)
    # bowl
    for yy in range(30, 50):
        half = 16 - (yy - 30) // 2
        hline(pix, w, h, 40 - half, yy, half * 2, D2)
    put(pix, w, h, 40, 28, L1)
    put(pix, w, h, 38, 30, L2)
    put(pix, w, h, 42, 30, L3)


def build_props():
    cols, rows = 4, 4
    cw = ch = 80
    im, _ = new_img(cols * cw, rows * ch)
    names = [
        ["furnace", "altar", "anvil", "brazier"],
        ["gate", "idol", "basalt", "containment"],
        ["chain", "pipe", "debris", "hangBrazier"],
        ["bush", "mound", "fence", "vent"],
    ]
    drawers = {
        "furnace": prop_furnace, "altar": prop_altar, "anvil": prop_anvil, "brazier": prop_brazier,
        "gate": prop_gate, "idol": prop_idol, "basalt": prop_basalt, "containment": prop_containment,
        "chain": prop_chain, "pipe": prop_pipe, "debris": prop_debris, "hangBrazier": prop_hang_brazier,
        "bush": lambda t: draw_bush(t, 0), "mound": lambda t: draw_mound(t, 0),
        "fence": lambda t: draw_fence(t, 1), "vent": draw_vent_tile,
    }
    atlas = {}
    for r, row in enumerate(names):
        for c, name in enumerate(row):
            tile = Image.new("RGBA", (cw, ch), VOID)
            drawers[name](tile)
            im.paste(tile, (c * cw, r * ch), tile)
            atlas[name] = {"c": c, "r": r, "w": cw, "h": ch}
    path = os.path.join(OUT, "fire-props-sheet.png")
    im.save(path)
    return path, atlas


def build_cavern_arch():
    """Large modular cave mouth — cemetery wall-opening analog."""
    w, h = 160, 160
    im, pix = new_img(w, h, VOID)
    brick_fill(pix, w, h, 0, 0, w, h, seed=200)
    # cross-shaped opening
    for yy in range(h):
        for xx in range(w):
            in_v = 48 <= xx < 112 and 16 <= yy < 160
            in_h = 16 <= xx < 144 and 48 <= yy < 112
            if in_v or in_h:
                put(pix, w, h, xx, yy, VOID)
    # rim highlight
    for yy in range(h):
        for xx in range(w):
            if pix[xx, yy][3] == 0:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = xx + dx, yy + dy
                if 0 <= nx < w and 0 <= ny < h and pix[nx, ny][3] == 0:
                    put(pix, w, h, xx, yy, D5)
                    break
    path = os.path.join(OUT, "fire-cavern-arch.png")
    im.save(path)
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    ts, cells = build_tileset()
    far = build_bg_far()
    mid = build_bg_mid()
    near = build_bg_near()
    props, atlas = build_props()
    arch = build_cavern_arch()
    print("wrote", ts)
    print("cells", cells)
    print("wrote", far, mid, near, props, arch)
    print("atlas", atlas)


if __name__ == "__main__":
    main()

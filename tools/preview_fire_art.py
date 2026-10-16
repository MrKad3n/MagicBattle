#!/usr/bin/env python3
"""Composite a cemetery-style sample scene from the fire tileset."""
import os
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
DUN = os.path.join(ROOT, "images", "dungeon")
T = 40
P = 80

CELLS = {
    "wallA": (0, 0), "wallB": (1, 0), "wallVein": (2, 0), "wallHot": (5, 0), "ceilA": (6, 0),
    "floorAshA": (0, 1), "floorAshB": (1, 1), "floorBrick": (2, 1), "floorCrack": (3, 1), "floorTop": (5, 1),
    "beamL": (0, 2), "beamM": (1, 2), "beamR": (2, 2), "beamT": (3, 2), "beamCrack": (5, 2),
    "pilTop": (0, 3), "pilMid": (1, 3), "pilBase": (2, 3), "pilThin": (3, 3), "pilHot": (4, 3), "pilWide": (5, 3),
    "fence": (1, 4), "bush": (2, 4), "mound": (3, 4), "glow": (4, 4),
    "doorL": (0, 5), "rubble": (6, 5), "fence2": (6, 7), "bush2": (4, 7),
}

PROPS = {
    "furnace": (0, 0), "altar": (1, 0), "anvil": (2, 0), "brazier": (3, 0),
    "idol": (1, 1), "basalt": (2, 1),
}


def tile(sheet, name):
    c, r = CELLS[name]
    return sheet.crop((c * T, r * T, (c + 1) * T, (r + 1) * T))


def prop(ps, name):
    c, r = PROPS[name]
    return ps.crop((c * P, r * P, (c + 1) * P, (r + 1) * P))


def paste(dst, src, xy):
    dst.paste(src, xy, src)


def main():
    sheet = Image.open(os.path.join(DUN, "fire-tileset.png")).convert("RGBA")
    ps = Image.open(os.path.join(DUN, "fire-props-sheet.png")).convert("RGBA")
    far = Image.open(os.path.join(DUN, "fire-bg-far.png")).convert("RGBA")
    mid = Image.open(os.path.join(DUN, "fire-bg-mid.png")).convert("RGBA")
    near = Image.open(os.path.join(DUN, "fire-bg-near.png")).convert("RGBA")
    arch = Image.open(os.path.join(DUN, "fire-cavern-arch.png")).convert("RGBA")

    W, H = 960, 540
    out = Image.new("RGBA", (W, H), (18, 8, 10, 255))
    # far / mid / near layers
    out.paste(far.resize((480, 240), Image.NEAREST), (0, 40), far.resize((480, 240), Image.NEAREST))
    out.paste(far.resize((480, 240), Image.NEAREST), (480, 40), far.resize((480, 240), Image.NEAREST))
    out.paste(mid, (40, 160), mid)
    out.paste(mid, (440, 180), mid)
    paste(out, arch, (80, 140))
    out.paste(near, (0, 360), near)
    out.paste(near, (240, 360), near)
    out.paste(near, (480, 360), near)
    out.paste(near, (720, 360), near)

    # left wall stack
    for r in range(0, 10):
        paste(out, tile(sheet, "wallA" if r % 2 == 0 else "wallB"), (0, r * T))
        paste(out, tile(sheet, "wallVein" if r % 3 == 0 else "wallHot"), (T, r * T))
    # ceiling
    for c in range(0, 24):
        paste(out, tile(sheet, "ceilA"), (c * T, 0))

    # ground row
    gy = 400
    for c in range(0, 24):
        name = "floorTop" if c % 3 else ("floorAshA" if c % 2 == 0 else "floorCrack")
        paste(out, tile(sheet, name), (c * T, gy))
        paste(out, tile(sheet, "floorBrick"), (c * T, gy + T))
        paste(out, tile(sheet, "wallA"), (c * T, gy + T * 2))

    # fence on ground
    for c in range(2, 6):
        paste(out, tile(sheet, "fence"), (c * T, gy - T))

    # assembled platform: ramp-ish beam + pillars
    px, py = 200, 240
    paste(out, tile(sheet, "beamL"), (px, py))
    paste(out, tile(sheet, "beamM"), (px + T, py))
    paste(out, tile(sheet, "beamM"), (px + T * 2, py))
    paste(out, tile(sheet, "beamT"), (px + T * 3, py))
    paste(out, tile(sheet, "beamR"), (px + T * 4, py))
    paste(out, tile(sheet, "pilTop"), (px + T, py + T - 8))
    paste(out, tile(sheet, "pilMid"), (px + T, py + T * 2 - 8))
    paste(out, tile(sheet, "pilBase"), (px + T, py + T * 3 - 8))
    paste(out, tile(sheet, "pilTop"), (px + T * 3, py + T - 8))
    paste(out, tile(sheet, "pilHot"), (px + T * 3, py + T * 2 - 8))
    paste(out, tile(sheet, "pilBase"), (px + T * 3, py + T * 3 - 8))

    # high beam
    hx, hy = 560, 160
    paste(out, tile(sheet, "beamL"), (hx, hy))
    paste(out, tile(sheet, "beamM"), (hx + T, hy))
    paste(out, tile(sheet, "beamCrack"), (hx + T * 2, hy))
    paste(out, tile(sheet, "beamR"), (hx + T * 3, hy))
    paste(out, tile(sheet, "pilWide"), (hx + T, hy + T - 8))
    paste(out, tile(sheet, "pilMid"), (hx + T, hy + T * 2 - 8))
    paste(out, tile(sheet, "pilMid"), (hx + T, hy + T * 3 - 8))
    paste(out, tile(sheet, "pilBase"), (hx + T, hy + T * 4 - 8))
    paste(out, tile(sheet, "pilThin"), (hx + T * 3, hy + T - 8))
    paste(out, tile(sheet, "pilThin"), (hx + T * 3, hy + T * 2 - 8))
    paste(out, tile(sheet, "pilBase"), (hx + T * 3, hy + T * 3 - 8))

    # props at 2x
    def prop2(name, xy):
        im = prop(ps, name).resize((160, 160), Image.NEAREST)
        paste(out, im, xy)

    prop2("idol", (40, gy - 160))
    prop2("brazier", (280, gy - 160))
    prop2("anvil", (720, gy - 160))
    paste(out, tile(sheet, "bush"), (360, gy - T))
    paste(out, tile(sheet, "bush2"), (500, gy - T))
    paste(out, tile(sheet, "mound"), (620, gy - T))
    paste(out, tile(sheet, "rubble"), (840, gy - T))
    paste(out, tile(sheet, "glow"), (440, 80))

    path = os.path.join(DUN, "fire-preview-assembly.png")
    out.save(path)
    print("wrote", path)


if __name__ == "__main__":
    main()

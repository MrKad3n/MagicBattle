"""High-quality 64px EmberFall city tileset from painted source textures."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
TILES = ROOT / "images" / "tiles"
OUT = TILES / "emberfall-city-tileset.png"
TS = 64
COLS = 16
ROWS = 8


def load(name):
    return Image.open(TILES / name).convert("RGBA")


def crop_tile(src, ox, oy, dark=1.0, sat=1.0, contrast=1.02):
    w, h = src.size
    ox = max(0, min(int(ox), max(0, w - TS)))
    oy = max(0, min(int(oy), max(0, h - TS)))
    tile = src.crop((ox, oy, ox + TS, oy + TS)).copy()
    if dark != 1.0:
        tile = ImageEnhance.Brightness(tile).enhance(dark)
    if sat != 1.0:
        tile = ImageEnhance.Color(tile).enhance(sat)
    if contrast != 1.0:
        tile = ImageEnhance.Contrast(tile).enhance(contrast)
    return tile.filter(ImageFilter.UnsharpMask(radius=0.55, percent=28, threshold=2))


def overlay_window(base, glow, frame=(48, 38, 30, 255), mullion=(22, 18, 14, 230)):
    t = base.copy()
    d = ImageDraw.Draw(t, "RGBA")
    x0, y0, x1, y1 = 12, 10, 51, 53
    d.rectangle((x0, y0, x1, y1), fill=frame)
    d.rectangle((x0 + 4, y0 + 4, x1 - 4, y1 - 4), fill=glow)
    d.line((32, y0 + 4, 32, y1 - 4), fill=mullion, width=3)
    d.line((x0 + 4, 32, x1 - 4, 32), fill=mullion, width=2)
    shine = Image.new("RGBA", (TS, TS), (0, 0, 0, 0))
    ImageDraw.Draw(shine).rectangle((x0 + 6, y0 + 6, 28, 26), fill=(255, 244, 210, 36))
    return Image.alpha_composite(t, shine)


def overlay_door(base, iron=False):
    t = base.copy()
    d = ImageDraw.Draw(t, "RGBA")
    outer = (46, 36, 28, 255) if not iron else (52, 54, 60, 255)
    inner = (78, 56, 40, 255) if not iron else (74, 78, 86, 255)
    d.rounded_rectangle((14, 6, 50, 63), radius=7, fill=outer)
    d.rounded_rectangle((18, 10, 46, 63), radius=5, fill=inner)
    d.line((32, 12, 32, 62), fill=(28, 22, 16, 255), width=3)
    d.ellipse((38, 34, 45, 41), fill=(210, 176, 72, 255))
    if iron:
        d.rectangle((17, 28, 47, 32), fill=(32, 34, 38, 255))
        d.rectangle((17, 46, 47, 50), fill=(32, 34, 38, 255))
    return t


def battlement(stone):
    result = Image.new("RGBA", (TS, TS), (0, 0, 0, 0))
    result.paste(stone.crop((0, 30, 64, 64)), (0, 30))
    result.paste(stone.crop((6, 0, 26, 34)), (6, 0))
    result.paste(stone.crop((38, 0, 58, 34)), (38, 0))
    return result


def slit(stone):
    t = stone.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((27, 8, 36, 55), fill=(10, 9, 8, 255))
    d.rectangle((28, 10, 35, 53), fill=(16, 14, 12, 255))
    return t


def banner(base, color):
    t = base.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((29, 0, 34, 12), fill=(42, 32, 24, 255))
    d.polygon([(16, 11), (47, 11), (47, 46), (32, 58), (16, 46)], fill=color)
    d.line((16, 11, 47, 11), fill=(32, 24, 18, 255), width=3)
    return t


def crate(wood):
    t = wood.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((8, 16, 55, 57), outline=(48, 34, 20, 255), width=3)
    d.line((8, 29, 55, 29), fill=(48, 34, 20, 255), width=2)
    d.line((8, 45, 55, 45), fill=(48, 34, 20, 255), width=2)
    d.line((32, 16, 32, 57), fill=(48, 34, 20, 255), width=2)
    return t


def barrel(wood):
    mask = Image.new("L", (TS, TS), 0)
    ImageDraw.Draw(mask).ellipse((11, 7, 52, 57), fill=255)
    out = Image.new("RGBA", (TS, TS), (0, 0, 0, 0))
    out.paste(wood, (0, 0))
    out.putalpha(mask)
    d = ImageDraw.Draw(out, "RGBA")
    d.arc((11, 7, 52, 57), 0, 360, fill=(48, 32, 16, 255), width=3)
    d.line((15, 22, 48, 22), fill=(56, 38, 20, 230), width=3)
    d.line((15, 42, 48, 42), fill=(56, 38, 20, 230), width=3)
    return out


def awning(roof):
    mask = Image.new("L", (TS, TS), 0)
    ImageDraw.Draw(mask).polygon([(1, 16), (62, 16), (57, 50), (6, 50)], fill=255)
    out = Image.new("RGBA", (TS, TS), (0, 0, 0, 0))
    out.paste(roof, (0, 0))
    out.putalpha(mask)
    d = ImageDraw.Draw(out, "RGBA")
    d.line((4, 18, 59, 18), fill=(40, 20, 14, 180), width=2)
    return out


def water_tile():
    t = Image.new("RGBA", (TS, TS), (46, 104, 142, 255))
    d = ImageDraw.Draw(t, "RGBA")
    for i in range(5):
        y = 6 + i * 11
        d.arc((3, y, 60, y + 18), 200, 340, fill=(120, 180, 210, 150), width=2)
    return t


def crystal():
    t = Image.new("RGBA", (TS, TS), (0, 0, 0, 0))
    d = ImageDraw.Draw(t, "RGBA")
    d.polygon([(32, 4), (50, 28), (42, 60), (22, 60), (14, 28)], fill=(86, 138, 224, 235))
    d.polygon([(32, 8), (42, 28), (32, 52), (22, 28)], fill=(190, 220, 255, 210))
    return t


def chimney(stone):
    t = Image.new("RGBA", (TS, TS), (0, 0, 0, 0))
    t.paste(stone, (0, 0))
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((16, 10, 47, 63), fill=(72, 58, 50, 255))
    d.rectangle((12, 4, 51, 16), fill=(52, 42, 36, 255))
    return t


def stair(stone):
    t = stone.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((0, 48, 63, 63), fill=(96, 86, 74, 255))
    d.rectangle((16, 32, 63, 48), fill=(106, 94, 80, 255))
    d.rectangle((32, 16, 63, 32), fill=(114, 102, 86, 255))
    d.rectangle((48, 0, 63, 16), fill=(122, 110, 92, 255))
    return t


def gate_wood(wood):
    t = overlay_door(wood, iron=False)
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((6, 2, 57, 63), outline=(32, 22, 16, 255), width=4)
    return t


def portcullis(stone):
    t = stone.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((6, 2, 57, 63), fill=(16, 14, 12, 255))
    for x in range(12, 56, 8):
        d.line((x, 4, x, 62), fill=(78, 78, 82, 255), width=3)
    for y in range(12, 60, 10):
        d.line((8, y, 55, y), fill=(78, 78, 82, 255), width=2)
    return t


def flower(plaster):
    t = plaster.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((9, 40, 54, 58), fill=(92, 52, 32, 255))
    for cx, col in ((20, (214, 72, 82)), (32, (232, 192, 56)), (44, (82, 154, 74))):
        d.ellipse((cx - 6, 26, cx + 6, 42), fill=col + (255,))
    return t


def timber_cross(plaster, timber):
    t = plaster.copy()
    beam = timber.resize((TS, 10), Image.Resampling.LANCZOS)
    post = timber.resize((10, TS), Image.Resampling.LANCZOS)
    t.paste(beam, (0, 8), beam)
    t.paste(beam, (0, 46), beam)
    t.paste(post, (6, 0), post)
    t.paste(post, (48, 0), post)
    return t


def stall(wood, roof):
    t = wood.copy()
    aw = awning(roof)
    t = Image.alpha_composite(t, aw)
    return t


def overlay_carpet(base, rgb):
    t = base.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((2, 2, 61, 61), fill=rgb + (235,))
    d.rectangle((6, 6, 57, 57), outline=(80, 20, 18, 180), width=2)
    d.line((8, 32, 55, 32), fill=(200, 80, 70, 60), width=1)
    return t


def overlay_shelf(timber, wood):
    t = timber.copy()
    d = ImageDraw.Draw(t, "RGBA")
    for y in (8, 28, 48):
        d.rectangle((4, y, 59, y + 6), fill=(72, 48, 28, 255))
        for x in (8, 22, 36, 48):
            d.rectangle((x, y - 10, x + 8, y), fill=(90, 36, 28, 255))
    return t


def overlay_stained(stone):
    t = stone.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((8, 6, 55, 58), fill=(40, 28, 22, 255))
    cols = [(160, 50, 48), (48, 80, 150), (200, 170, 60), (70, 120, 70)]
    i = 0
    for y in range(10, 52, 14):
        for x in range(12, 50, 14):
            d.polygon([(x, y), (x + 10, y + 4), (x + 6, y + 14), (x - 2, y + 10)], fill=cols[i % 4] + (210,))
            i += 1
    d.line((32, 8, 32, 56), fill=(50, 36, 28, 255), width=3)
    d.line((10, 32, 54, 32), fill=(50, 36, 28, 255), width=3)
    return t


def overlay_runes(stone):
    t = stone.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.ellipse((10, 10, 54, 54), outline=(90, 160, 220, 200), width=3)
    d.ellipse((20, 20, 44, 44), outline=(140, 200, 255, 160), width=2)
    d.line((32, 8, 32, 56), fill=(120, 190, 255, 140), width=2)
    d.line((8, 32, 56, 32), fill=(120, 190, 255, 140), width=2)
    return t


def overlay_hedge(grass):
    t = grass.copy()
    d = ImageDraw.Draw(t, "RGBA")
    for cx, cy in ((16, 20), (32, 14), (48, 22), (24, 36), (40, 40), (18, 48), (46, 50)):
        d.ellipse((cx - 10, cy - 8, cx + 10, cy + 10), fill=(40, 90, 42, 230))
    return t


def overlay_bars(stone):
    t = stone.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((0, 4, 63, 10), fill=(48, 48, 52, 255))
    d.rectangle((0, 54, 63, 60), fill=(48, 48, 52, 255))
    for x in range(8, 60, 10):
        d.rectangle((x, 6, x + 4, 58), fill=(70, 70, 76, 255))
    return t


def overlay_pillar(stone):
    t = stone.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((16, 0, 47, 63), fill=(92, 84, 72, 255))
    d.rectangle((12, 0, 51, 8), fill=(110, 100, 86, 255))
    d.rectangle((12, 56, 51, 63), fill=(70, 64, 54, 255))
    d.line((22, 10, 22, 54), fill=(60, 54, 46, 180), width=2)
    return t


def overlay_table(wood):
    t = wood.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((4, 18, 59, 30), fill=(96, 68, 40, 255))
    d.rectangle((8, 30, 14, 58), fill=(72, 50, 30, 255))
    d.rectangle((50, 30, 56, 58), fill=(72, 50, 30, 255))
    return t


def overlay_bed(wood, cloth):
    t = wood.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((6, 28, 58, 52), fill=(160, 150, 140, 255))
    d.rectangle((6, 22, 22, 36), fill=(180, 170, 160, 255))
    d.rectangle((4, 48, 60, 58), fill=(70, 48, 30, 255))
    return t


def overlay_mosaic(stone):
    t = stone.copy()
    d = ImageDraw.Draw(t, "RGBA")
    cols = [(120, 90, 60, 90), (80, 70, 90, 90), (140, 120, 80, 80)]
    i = 0
    for y in range(0, 64, 16):
        for x in range(0, 64, 16):
            d.rectangle((x + 1, y + 1, x + 14, y + 14), fill=cols[i % 3])
            i += 1
    return t


def slope_tile(roof, side):
    """Triangular roof edge. L = / face, R = \\ face."""
    mask = Image.new("L", (TS, TS), 0)
    md = ImageDraw.Draw(mask)
    if side == "L":
        md.polygon([(0, TS - 1), (TS - 1, 0), (TS - 1, TS - 1)], fill=255)
    else:
        md.polygon([(0, 0), (0, TS - 1), (TS - 1, TS - 1)], fill=255)
    out = Image.new("RGBA", (TS, TS), (0, 0, 0, 0))
    out.paste(roof, (0, 0))
    out.putalpha(mask)
    d = ImageDraw.Draw(out, "RGBA")
    edge = (52, 28, 20, 220)
    if side == "L":
        d.line((1, TS - 2, TS - 2, 1), fill=edge, width=4)
        d.line((4, TS - 2, TS - 2, 4), fill=(255, 220, 180, 50), width=2)
    else:
        d.line((1, 1, TS - 2, TS - 2), fill=edge, width=4)
        d.line((1, 4, TS - 5, TS - 2), fill=(255, 220, 180, 50), width=2)
    return out


def fountain(stone, water):
    t = stone.copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.ellipse((8, 18, 55, 58), fill=(70, 64, 56, 255))
    d.ellipse((16, 26, 47, 50), fill=(52, 120, 156, 220))
    d.rectangle((29, 8, 34, 30), fill=(90, 84, 74, 255))
    return t


def statue(stone):
    t = Image.new("RGBA", (TS, TS), (0, 0, 0, 0))
    t.paste(stone, (0, 0))
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((20, 40, 43, 63), fill=(92, 86, 76, 255))
    d.rectangle((26, 18, 37, 42), fill=(108, 100, 88, 255))
    d.ellipse((24, 6, 39, 22), fill=(118, 110, 96, 255))
    return t


def main():
    cobble = load("cobblestone-tile.png")
    grass = load("grass-dirt-tile.png")
    stone = load("stone-brick-tile.png")
    plaster = load("plaster-tile.png")
    timber = load("timber-tile.png")
    wood = load("wood-floor-tile.png")
    red = load("roof-red-tile.png")
    slate = load("roof-slate-tile.png")
    thatch = load("roof-thatch-tile.png")

    s0 = crop_tile(stone, 8, 8)
    s1 = crop_tile(stone, 160, 70, dark=0.78, sat=0.88)
    s2 = crop_tile(stone, 280, 140, dark=0.62, sat=0.75)
    p0 = crop_tile(plaster, 20, 16, dark=0.94)
    p1 = crop_tile(plaster, 180, 90, dark=0.86, sat=0.82)
    t0 = crop_tile(timber, 10, 10)
    w0 = crop_tile(wood, 18, 18)
    r0 = crop_tile(red, 12, 8)
    sl0 = crop_tile(slate, 16, 12)
    th0 = crop_tile(thatch, 20, 16)

    tiles = [
        Image.new("RGBA", (TS, TS), (0, 0, 0, 0)),
        crop_tile(cobble, 16, 16),
        crop_tile(cobble, 200, 90, dark=0.84),
        crop_tile(grass, 36, 24),
        crop_tile(grass, 210, 130, dark=0.9, sat=0.72),
        s0, s1, s2, p0, t0, w0, r0, sl0, th0,
        overlay_window(s0, (20, 18, 16, 255)),
        overlay_window(p0, (255, 176, 78, 230)),
        overlay_window(s1, (96, 164, 255, 230)),
        overlay_door(t0, iron=False),
        overlay_door(s0, iron=True),
        battlement(s0),
        slit(s1),
        banner(s0, (168, 42, 38, 255)),
        crate(w0),
        barrel(w0),
        awning(r0),
        water_tile(),
        crystal(),
        chimney(s1),
        stair(s0),
        gate_wood(t0),
        portcullis(s1),
        flower(p0),
        crop_tile(red, 90, 40, dark=0.88),
        crop_tile(slate, 90, 30, dark=0.9),
        crop_tile(thatch, 110, 50, dark=0.86),
        overlay_window(p1, (255, 214, 128, 210)),
        overlay_window(t0, (48, 86, 168, 220)),
        crop_tile(stone, 220, 120, dark=0.82),
        p1,
        banner(s0, (48, 72, 156, 255)),
        crop_tile(cobble, 80, 160, dark=0.9),
        crop_tile(grass, 90, 200),
        crop_tile(wood, 120, 60, dark=0.82),
        crop_tile(timber, 100, 80, dark=0.86),
        overlay_window(s1, (255, 96, 42, 210)),
        crop_tile(slate, 40, 80, dark=0.76),
        crop_tile(red, 170, 20),
        crop_tile(stone, 40, 180, dark=0.64),
        timber_cross(p0, t0),
        timber_cross(p1, crop_tile(timber, 40, 40, dark=0.8)),
        stall(w0, r0),
        fountain(s0, None),
        statue(s1),
        overlay_window(s2, (180, 210, 255, 200)),
        banner(s1, (196, 86, 32, 255)),
        crop_tile(stone, 90, 200, dark=0.7, sat=0.8),
        crop_tile(plaster, 90, 140, dark=0.78, sat=0.7),
        overlay_door(crop_tile(timber, 60, 20), iron=False),
        overlay_window(p0, (255, 120, 70, 180)),
        crop_tile(red, 40, 90, dark=0.7),
        crop_tile(slate, 160, 80, dark=0.68),
        crop_tile(thatch, 40, 90, dark=0.75),
        crop_tile(cobble, 140, 40, dark=0.76),
        crop_tile(grass, 20, 80, sat=1.1),
        overlay_window(s0, (255, 220, 140, 160)),
        crop_tile(wood, 40, 100, dark=0.7),
        crop_tile(timber, 20, 120, dark=0.75),
        crop_tile(stone, 40, 40, dark=0.9),
        slope_tile(r0, "L"),
        slope_tile(r0, "R"),
        slope_tile(sl0, "L"),
        slope_tile(sl0, "R"),
        slope_tile(th0, "L"),
        slope_tile(th0, "R"),
        slope_tile(crop_tile(red, 90, 40, dark=0.88), "L"),
        slope_tile(crop_tile(red, 90, 40, dark=0.88), "R"),
        slope_tile(crop_tile(slate, 90, 30, dark=0.9), "L"),
        slope_tile(crop_tile(slate, 90, 30, dark=0.9), "R"),
        crop_tile(stone, 60, 40, dark=1.05, sat=0.85),
        crop_tile(stone, 140, 80, dark=0.88, sat=0.8),
        crop_tile(plaster, 40, 30, dark=1.06, sat=0.7),
        crop_tile(plaster, 120, 80, dark=0.92, sat=0.65),
        overlay_carpet(crop_tile(wood, 20, 20, dark=0.7), (140, 36, 36)),
        overlay_carpet(crop_tile(wood, 80, 40, dark=0.62), (110, 28, 28)),
        overlay_shelf(crop_tile(timber, 20, 20, dark=0.8), crop_tile(wood, 40, 40)),
        overlay_stained(crop_tile(stone, 20, 20, dark=0.7)),
        overlay_runes(crop_tile(stone, 80, 40, dark=0.55, sat=0.5)),
        crop_tile(stone, 10, 10, dark=1.15, sat=0.4),
        overlay_hedge(crop_tile(grass, 40, 40, sat=1.15)),
        overlay_bars(crop_tile(stone, 40, 80, dark=0.45)),
        crop_tile(stone, 200, 40, dark=0.38, sat=0.4),
        overlay_pillar(crop_tile(stone, 30, 30, dark=0.95)),
        overlay_table(crop_tile(wood, 60, 20, dark=0.75)),
        overlay_bed(crop_tile(wood, 20, 80), crop_tile(plaster, 10, 10)),
        crop_tile(grass, 80, 40, sat=1.2, dark=1.05),
        overlay_mosaic(crop_tile(stone, 100, 60, dark=0.8)),
    ]

    while len(tiles) < COLS * ROWS:
        tiles.append(Image.new("RGBA", (TS, TS), (0, 0, 0, 0)))

    sheet = Image.new("RGBA", (COLS * TS, ROWS * TS), (0, 0, 0, 0))
    for i, tile in enumerate(tiles[: COLS * ROWS]):
        if tile.size != (TS, TS):
            tile = tile.resize((TS, TS), Image.Resampling.LANCZOS)
        c, r = i % COLS, i // COLS
        sheet.paste(tile, (c * TS, r * TS))

    sheet.save(OUT, "PNG")
    print("wrote", OUT, sheet.size, "tiles", min(len(tiles), COLS * ROWS))


if __name__ == "__main__":
    main()

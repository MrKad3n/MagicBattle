"""Transparent EmberFall castle/city prop sheet. No backdrop — objects only."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images" / "props" / "emberfall-props-sheet.png"
CELL = 128
COLS = 4
ROWS = 4


def blank():
    return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))


def throne():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((28, 40, 100, 118), fill=(72, 48, 28, 255))
    d.rectangle((22, 34, 106, 52), fill=(168, 132, 48, 255))
    d.polygon([(36, 34), (64, 8), (92, 34)], fill=(140, 42, 38, 255))
    d.rectangle((40, 56, 88, 78), fill=(120, 36, 34, 255))
    d.ellipse((56, 14, 72, 30), fill=(212, 176, 64, 255))
    return im


def chandelier():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((62, 4, 66, 28), fill=(70, 58, 36, 255))
    d.ellipse((36, 26, 92, 48), outline=(180, 150, 60, 255), width=4)
    d.line((40, 36, 88, 36), fill=(160, 130, 50, 255), width=3)
    for x in (42, 54, 64, 74, 86):
        d.rectangle((x - 3, 46, x + 3, 62), fill=(90, 70, 40, 255))
        d.ellipse((x - 6, 58, x + 6, 78), fill=(255, 190, 80, 220))
        d.ellipse((x - 3, 60, x + 3, 70), fill=(255, 230, 140, 230))
    return im


def statue():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((32, 100, 96, 124), fill=(90, 84, 74, 255))
    d.rectangle((48, 70, 80, 102), fill=(118, 110, 96, 255))
    d.rectangle((54, 40, 74, 72), fill=(128, 120, 104, 255))
    d.ellipse((50, 16, 78, 46), fill=(138, 130, 112, 255))
    d.rectangle((38, 50, 52, 86), fill=(118, 110, 96, 255))
    d.rectangle((76, 50, 90, 86), fill=(118, 110, 96, 255))
    return im


def weapon_rack():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((20, 20, 28, 118), fill=(70, 48, 28, 255))
    d.rectangle((100, 20, 108, 118), fill=(70, 48, 28, 255))
    d.rectangle((18, 36, 110, 46), fill=(90, 64, 36, 255))
    d.rectangle((18, 78, 110, 88), fill=(90, 64, 36, 255))
    d.line((40, 18, 36, 112), fill=(160, 160, 168, 255), width=4)
    d.line((58, 16, 62, 112), fill=(150, 150, 155, 255), width=4)
    d.line((78, 20, 86, 112), fill=(80, 50, 30, 255), width=5)
    d.polygon([(78, 16), (96, 28), (80, 34)], fill=(170, 170, 176, 255))
    return im


def dummy():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((58, 70, 70, 122), fill=(70, 50, 30, 255))
    d.ellipse((38, 18, 90, 72), fill=(150, 120, 80, 255))
    d.rectangle((24, 40, 104, 52), fill=(120, 90, 55, 255))
    d.ellipse((50, 28, 78, 54), fill=(90, 40, 36, 255))
    return im


def chest():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle((24, 48, 104, 108), radius=8, fill=(96, 64, 28, 255))
    d.rectangle((24, 70, 104, 80), fill=(180, 140, 50, 255))
    d.ellipse((58, 66, 70, 82), fill=(220, 180, 60, 255))
    d.rectangle((28, 52, 100, 64), fill=(120, 82, 36, 255))
    return im


def altar():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((22, 70, 106, 118), fill=(86, 80, 70, 255))
    d.rectangle((16, 58, 112, 74), fill=(110, 102, 88, 255))
    d.polygon([(64, 16), (78, 50), (50, 50)], fill=(200, 190, 140, 255))
    d.ellipse((56, 40, 72, 54), fill=(255, 210, 90, 200))
    return im


def map_table():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((10, 48, 118, 72), fill=(78, 56, 32, 255))
    d.rectangle((18, 72, 28, 118), fill=(60, 42, 24, 255))
    d.rectangle((100, 72, 110, 118), fill=(60, 42, 24, 255))
    d.ellipse((22, 40, 106, 78), fill=(90, 130, 80, 255))
    d.polygon([(40, 50), (70, 44), (88, 58), (50, 66)], fill=(70, 110, 70, 255))
    d.rectangle((48, 52, 58, 62), fill=(90, 70, 50, 255))
    d.ellipse((74, 54, 84, 64), fill=(180, 50, 40, 255))
    return im


def crystal():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.polygon([(64, 8), (88, 50), (76, 116), (52, 116), (40, 50)], fill=(70, 140, 210, 230))
    d.polygon([(64, 16), (76, 50), (64, 100), (52, 50)], fill=(180, 220, 255, 210))
    d.polygon([(30, 70), (46, 58), (50, 100), (28, 108)], fill=(90, 160, 230, 200))
    return im


def cauldron():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.ellipse((28, 40, 100, 112), fill=(46, 48, 54, 255))
    d.ellipse((36, 48, 92, 86), fill=(40, 120, 70, 220))
    d.ellipse((48, 56, 70, 74), fill=(120, 220, 140, 120))
    d.rectangle((24, 50, 36, 58), fill=(70, 70, 76, 255))
    d.rectangle((92, 50, 104, 58), fill=(70, 70, 76, 255))
    return im


def cell_door():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((30, 8, 98, 120), fill=(36, 34, 32, 255))
    for x in range(40, 96, 12):
        d.rectangle((x, 12, x + 5, 116), fill=(78, 78, 84, 255))
    d.rectangle((32, 12, 96, 18), fill=(90, 90, 96, 255))
    d.rectangle((32, 108, 96, 116), fill=(90, 90, 96, 255))
    d.ellipse((80, 60, 92, 72), fill=(180, 150, 50, 255))
    return im


def urn():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((48, 70, 80, 118), fill=(90, 70, 48, 255))
    d.ellipse((40, 48, 88, 86), fill=(50, 110, 52, 255))
    d.ellipse((50, 36, 78, 64), fill=(70, 140, 64, 255))
    return im


def candles():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((36, 90, 92, 118), fill=(70, 50, 30, 255))
    for x, h in ((48, 40), (64, 54), (80, 36)):
        d.rectangle((x - 4, 90 - h, x + 4, 90), fill=(230, 220, 190, 255))
        d.ellipse((x - 5, 90 - h - 12, x + 5, 90 - h + 2), fill=(255, 170, 60, 230))
    return im


def banner():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((20, 10, 108, 18), fill=(60, 42, 24, 255))
    d.polygon([(28, 18), (100, 18), (100, 88), (64, 112), (28, 88)], fill=(150, 36, 34, 255))
    d.ellipse((52, 40, 76, 64), fill=(200, 170, 60, 255))
    return im


def marker():
    im = blank()
    d = ImageDraw.Draw(im, "RGBA")
    d.polygon([(64, 16), (80, 70), (48, 70)], fill=(180, 50, 40, 255))
    d.ellipse((50, 62, 78, 90), fill=(180, 50, 40, 255))
    d.ellipse((56, 68, 72, 84), fill=(240, 220, 180, 255))
    return im


def main():
    tiles = [
        throne(), chandelier(), statue(), weapon_rack(),
        dummy(), chest(), altar(), map_table(),
        crystal(), cauldron(), cell_door(), urn(),
        candles(), banner(), marker(), blank(),
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (COLS * CELL, ROWS * CELL), (0, 0, 0, 0))
    for i, tile in enumerate(tiles):
        sheet.paste(tile, ((i % COLS) * CELL, (i // COLS) * CELL), tile)
    sheet.save(OUT, "PNG")
    print("wrote", OUT, sheet.size)


if __name__ == "__main__":
    main()

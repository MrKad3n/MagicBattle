"""Original EmberFall prop cells and a hatch tile. Not traced from the layout painting."""
from PIL import Image, ImageDraw

CELL = 128
ROOT = r"images"


def new():
    return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))


def torch():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((54, 36, 74, 118), fill=(92, 64, 40, 255))
    d.polygon([(48, 36), (80, 36), (64, 8)], fill=(255, 150, 40, 255))
    d.polygon([(56, 34), (72, 34), (64, 16)], fill=(255, 220, 120, 255))
    d.ellipse((58, 20, 70, 32), fill=(255, 244, 200, 230))
    return t


def brazier():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    d.polygon([(28, 78), (100, 78), (88, 108), (40, 108)], fill=(70, 72, 78, 255))
    d.rectangle((58, 108, 70, 124), fill=(50, 52, 58, 255))
    d.ellipse((36, 40, 92, 84), fill=(255, 120, 30, 255))
    d.ellipse((48, 50, 80, 74), fill=(255, 210, 90, 255))
    d.ellipse((56, 56, 72, 68), fill=(255, 245, 210, 240))
    return t


def lantern():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((60, 8, 68, 28), fill=(40, 36, 32, 255))
    d.rounded_rectangle((40, 28, 88, 100), radius=8, fill=(70, 58, 40, 255))
    d.rounded_rectangle((48, 36, 80, 92), radius=4, fill=(255, 196, 80, 255))
    d.rectangle((60, 44, 68, 84), fill=(255, 240, 180, 255))
    d.polygon([(40, 100), (88, 100), (64, 118)], fill=(70, 58, 40, 255))
    return t


def candelabra():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((58, 70, 70, 118), fill=(160, 130, 50, 255))
    d.ellipse((40, 112, 88, 126), fill=(140, 110, 40, 255))
    d.line((64, 74, 28, 40), fill=(180, 150, 60, 255), width=4)
    d.line((64, 74, 100, 40), fill=(180, 150, 60, 255), width=4)
    for x in (22, 58, 94):
        d.rectangle((x, 28, x + 12, 46), fill=(245, 236, 210, 255))
        d.polygon([(x - 2, 28), (x + 14, 28), (x + 6, 10)], fill=(255, 160, 50, 255))
    return t


def ladder():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((36, 4, 48, 124), fill=(120, 78, 40, 255))
    d.rectangle((80, 4, 92, 124), fill=(120, 78, 40, 255))
    for y in range(16, 120, 18):
        d.rectangle((40, y, 88, y + 6), fill=(160, 110, 55, 255))
    return t


def bookcase():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((16, 8, 112, 120), fill=(92, 58, 36, 255))
    colors = [(140, 40, 36), (40, 70, 130), (40, 110, 60), (150, 120, 40), (90, 50, 110), (160, 90, 40)]
    for shelf in (22, 52, 82):
        d.rectangle((20, shelf + 22, 108, shelf + 28), fill=(70, 44, 28, 255))
        x = 24
        for i, c in enumerate(colors):
            w = 12 + (i % 3)
            d.rectangle((x, shelf, x + w, shelf + 22), fill=c + (255,))
            x += w + 2
    return t


def armor():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((60, 8, 68, 120), fill=(70, 72, 78, 255))
    d.polygon([(40, 36), (88, 36), (80, 78), (48, 78)], fill=(150, 156, 164, 255))
    d.ellipse((48, 16, 80, 40), fill=(170, 176, 184, 255))
    d.rectangle((36, 78, 52, 110), fill=(130, 136, 144, 255))
    d.rectangle((76, 78, 92, 110), fill=(130, 136, 144, 255))
    return t


def fountain():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    d.ellipse((16, 70, 112, 120), fill=(90, 92, 98, 255))
    d.ellipse((28, 80, 100, 112), fill=(70, 150, 190, 255))
    d.rectangle((58, 28, 70, 84), fill=(120, 122, 128, 255))
    d.ellipse((50, 16, 78, 40), fill=(180, 220, 240, 255))
    return t


def bed():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((18, 40, 110, 110), fill=(110, 70, 44, 255))
    d.rectangle((26, 50, 102, 100), fill=(150, 40, 48, 255))
    d.ellipse((28, 28, 70, 58), fill=(230, 220, 200, 255))
    d.rectangle((18, 36, 110, 46), fill=(80, 52, 34, 255))
    return t


def glass():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    d.polygon([(64, 8), (112, 28), (112, 100), (64, 120), (16, 100), (16, 28)], fill=(40, 36, 32, 255))
    d.polygon([(64, 16), (104, 32), (104, 94), (64, 110), (24, 94), (24, 32)], fill=(70, 110, 180, 255))
    d.polygon([(64, 16), (104, 32), (64, 60)], fill=(180, 50, 60, 255))
    d.polygon([(24, 32), (64, 16), (64, 60)], fill=(210, 170, 50, 255))
    d.polygon([(24, 94), (64, 110), (64, 60)], fill=(50, 120, 70, 255))
    d.polygon([(104, 94), (64, 110), (64, 60)], fill=(90, 50, 140, 255))
    return t


def plant():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    d.polygon([(44, 90), (84, 90), (78, 120), (50, 120)], fill=(120, 80, 48, 255))
    d.ellipse((30, 40, 70, 90), fill=(50, 130, 60, 255))
    d.ellipse((58, 28, 100, 84), fill=(40, 110, 55, 255))
    d.ellipse((48, 20, 80, 56), fill=(90, 170, 70, 255))
    d.ellipse((62, 36, 74, 48), fill=(220, 80, 90, 255))
    return t


def coins():
    t = new()
    d = ImageDraw.Draw(t, "RGBA")
    for x, y, w, h in ((20, 70, 50, 28), (48, 56, 56, 30), (30, 40, 40, 24), (62, 78, 44, 26)):
        d.ellipse((x, y, x + w, y + h), fill=(212, 168, 48, 255))
        d.ellipse((x + 8, y + 6, x + w - 10, y + 14), fill=(255, 220, 120, 200))
    return t


def hatch_tile():
    t = Image.new("RGBA", (64, 64), (28, 24, 22, 255))
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle((0, 0, 63, 63), outline=(180, 140, 60, 255), width=4)
    d.rectangle((10, 8, 18, 56), fill=(140, 90, 48, 255))
    d.rectangle((46, 8, 54, 56), fill=(140, 90, 48, 255))
    for y in (16, 30, 44):
        d.rectangle((12, y, 52, y + 5), fill=(200, 150, 70, 255))
    d.rectangle((22, 10, 42, 54), fill=(8, 8, 12, 180))
    return t


def main():
    old = Image.open(ROOT + "/props/emberfall-props-sheet.png").convert("RGBA")
    sheet = Image.new("RGBA", (CELL * 4, CELL * 8), (0, 0, 0, 0))
    sheet.paste(old, (0, 0))
    cells = [torch(), brazier(), lantern(), candelabra(), ladder(), bookcase(), armor(), fountain(), bed(), glass(), plant(), coins()]
    for i, im in enumerate(cells):
        idx = 15 + i
        c, r = idx % 4, idx // 4
        sheet.paste(im, (c * CELL, r * CELL), im)
    sheet.save(ROOT + "/props/emberfall-props-sheet.png")
    tiles = Image.open(ROOT + "/tiles/emberfall-city-tileset.png").convert("RGBA")
    ht = hatch_tile()
    tiles.paste(ht, ((96 % 16) * 64, (96 // 16) * 64))
    tiles.save(ROOT + "/tiles/emberfall-city-tileset.png")
    print("props", sheet.size, "tiles", tiles.size)


if __name__ == "__main__":
    main()

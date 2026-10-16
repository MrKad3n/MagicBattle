"""Key magenta backgrounds and pack generated castle props into the dress sheet."""
from PIL import Image
import os

ROOT = r"C:\Users\kaden\.cursor\projects\c-Users-kaden-OneDrive-Documents-GitHub-Games\assets"
OUT = r"images/props/emberfall-castle-dress.png"
CELL = 256
COLS = 8
FILES = [
    "prop-drape.png", "prop-curtain.png", "prop-column.png", "prop-throne.png",
    "prop-shelf.png", "prop-warmap.png", "prop-council.png", "prop-hearth.png",
    "prop-canopy.png", "prop-stores.png", "prop-prison.png", "prop-mage.png",
    "prop-hoard.png", "prop-dais.png", "prop-knight.png", "prop-bower.png",
    "prop-tree.png", "prop-feast.png", "prop-rose.png", "prop-pews.png",
    "prop-armory.png", "prop-infirm.png", "prop-guest.png", "prop-sewer.png",
    "prop-rune.png", "prop-planter.png", "prop-desk.png", "prop-telescope.png",
    "prop-flight.png",
]


def is_bg(r, g, b):
    # The generator's backdrop is a crimson-magenta, about (230, 6, 134).
    if g > 100 or r < 130 or b < 70:
        return False
    return r > g * 2.2 and b > g * 1.4


def key_magenta(im):
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_bg(r, g, b):
                px[x, y] = (0, 0, 0, 0)
    return im


def trim(im, pad=8):
    bbox = im.getbbox()
    if not bbox:
        return im
    cropped = im.crop(bbox)
    side = max(cropped.size) + pad * 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - cropped.size[0]) // 2, (side - cropped.size[1]) // 2), cropped)
    return canvas.resize((CELL, CELL), Image.Resampling.LANCZOS)


def main():
    rows = (len(FILES) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (CELL * COLS, CELL * rows), (0, 0, 0, 0))
    for i, name in enumerate(FILES):
        im = key_magenta(Image.open(os.path.join(ROOT, name)))
        im = trim(im)
        sheet.paste(im, ((i % COLS) * CELL, (i // COLS) * CELL), im)
    sheet.save(OUT)
    print(OUT, sheet.size)


if __name__ == "__main__":
    main()

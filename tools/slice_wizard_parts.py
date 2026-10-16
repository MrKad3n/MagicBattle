"""Cut the generated wizard sheets into jointed parts."""
from PIL import Image
import json, os

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "images", "melee")
BODY_SRC = os.path.join(ROOT, "..", "..", "..", ".cursor", "projects", "c-Users-kaden-OneDrive-Documents-GitHub-Games", "assets", "wizard-body-parts.jpg")
# The generator path is outside the repo. Fall back to the known absolute path.
BODY_SRC = r"C:\Users\kaden\.cursor\projects\c-Users-kaden-OneDrive-Documents-GitHub-Games\assets\wizard-body-parts.jpg"
WEP_SRC = r"C:\Users\kaden\.cursor\projects\c-Users-kaden-OneDrive-Documents-GitHub-Games\assets\wizard-weapons.jpg"

BODY_NAMES = ["head", "hat", "torso", "skirt", "sleeve", "hand", "leg", "boot"]
WEP_NAMES = ["sword", "dagger", "spear", "greatsword", "hammer", "scythe", "glaive", "whip", "chain", "staff", "gauntlet", "link"]
# Destination height in rig units. Spear is long and thin; staff is shorter with an orb.
DH = {
    "head": 22, "hat": 20, "torso": 24, "skirt": 20, "sleeve": 14, "hand": 8, "leg": 15, "boot": 11,
    "sword": 36, "dagger": 18, "spear": 64, "greatsword": 48, "hammer": 40, "scythe": 50,
    "glaive": 46, "whip": 14, "chain": 18, "staff": 42, "gauntlet": 14, "link": 6,
}
# Pivot: fraction across the cropped sprite. ay is from the top.
PIVOT = {
    "head": (0.50, 0.92),
    "hat": (0.48, 0.78),
    "torso": (0.50, 0.12),
    "skirt": (0.50, 0.08),
    "sleeve": (0.50, 0.08),
    "hand": (0.50, 0.12),
    "leg": (0.50, 0.06),
    "boot": (0.48, 0.08),
    "sword": (0.50, 0.08),
    "dagger": (0.50, 0.10),
    "spear": (0.50, 0.04),
    "greatsword": (0.50, 0.08),
    "hammer": (0.50, 0.06),
    "scythe": (0.42, 0.06),
    "glaive": (0.55, 0.06),
    "whip": (0.50, 0.08),
    "chain": (0.55, 0.12),
    "staff": (0.50, 0.06),
    "gauntlet": (0.50, 0.10),
    "link": (0.50, 0.50),
}


def is_magenta(r, g, b):
    return r > 170 and b > 70 and g < 100 and r > g + 60 and b > g + 30


def take_parts(path, names, cols, rows):
    im = key_magenta(Image.open(path))
    w, h = im.size
    cw, ch = w // cols, h // rows
    parts = []
    for i, name in enumerate(names):
        c, r = i % cols, i // cols
        cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
        bbox = cell.getbbox()
        if not bbox:
            raise SystemExit("empty cell " + name)
        crop = cell.crop(bbox)
        if name == "torso":
            crop = strip_sleeves(crop)
        parts.append((name, crop))
    return parts


def key_magenta(im):
    im = im.convert("RGBA")
    pix = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if is_magenta(r, g, b):
                pix[x, y] = (0, 0, 0, 0)
    # Eat the pink fringe on the edges of the character.
    for _ in range(2):
        clear = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                r, g, b, a = pix[x, y]
                if a < 10: continue
                neighbors = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if pix[x + dx, y + dy][3] < 10:
                            neighbors += 1
                if neighbors >= 3 and (r > 160 and b > 100 and g < 140):
                    clear.append((x, y))
        for x, y in clear:
            pix[x, y] = (0, 0, 0, 0)
    return im


def components(im, min_area):
    w, h = im.size
    pix = im.load()
    seen = bytearray(w * h)
    out = []
    for y in range(h):
        row = y * w
        for x in range(w):
            i = row + x
            if seen[i]: continue
            if pix[x, y][3] < 30:
                seen[i] = 1
                continue
            stack = [(x, y)]
            seen[i] = 1
            minx = maxx = x
            miny = maxy = y
            count = 0
            while stack:
                cx, cy = stack.pop()
                count += 1
                if cx < minx: minx = cx
                if cx > maxx: maxx = cx
                if cy < miny: miny = cy
                if cy > maxy: maxy = cy
                for nx, ny in ((cx-1, cy), (cx+1, cy), (cx, cy-1), (cx, cy+1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h: continue
                    j = ny * w + nx
                    if seen[j]: continue
                    if pix[nx, ny][3] < 30:
                        seen[j] = 1
                        continue
                    seen[j] = 1
                    stack.append((nx, ny))
            if count >= min_area:
                out.append((minx, miny, maxx + 1, maxy + 1, count))
    return out


def strip_sleeves(im):
    w, h = im.size
    pix = im.load()
    xs = []
    for y in range(int(h * 0.05), int(h * 0.5)):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a > 80 and r > 170 and g > 130 and b < 130:
                xs.append(x)
    cx = int(sum(xs) / len(xs)) if xs else w // 2
    half = max(18, int(w * 0.30))
    for y in range(int(h * 0.22), h):
        for x in range(w):
            if abs(x - cx) > half:
                pix[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def pack(parts):
    fitted = []
    for name, im in parts:
        dh = DH[name]
        aspect = im.width / max(1, im.height)
        dw = max(4, int(round(dh * aspect)))
        fx, fy = PIVOT[name]
        ax = int(im.width * fx)
        ay = int(im.height * fy)
        fitted.append((name, im, ax, ay, dw, dh))
    sheet = Image.new("RGBA", (sum(im.width for _, im, *_ in fitted) + 4 * len(fitted), max(im.height for _, im, *_ in fitted)), (0, 0, 0, 0))
    meta = {}
    x = 0
    for name, im, ax, ay, dw, dh in fitted:
        sheet.paste(im, (x, 0), im)
        meta[name] = {"sx": x, "sy": 0, "sw": im.width, "sh": im.height, "ax": ax, "ay": ay, "dw": dw, "dh": dh}
        x += im.width + 4
    return sheet, meta


def preview(body, bmeta, wep, wmeta):
    im = Image.new("RGBA", (720, 420), (22, 26, 40, 255))
    def blit(sheet, spec, x, y, scale=3):
        crop = sheet.crop((spec["sx"], spec["sy"], spec["sx"] + spec["sw"], spec["sy"] + spec["sh"]))
        dw, dh = int(spec["dw"] * scale), int(spec["dh"] * scale)
        crop = crop.resize((max(1, dw), max(1, dh)), Image.Resampling.LANCZOS)
        ox = int(x - spec["ax"] * (dw / spec["sw"]))
        oy = int(y - spec["ay"] * (dh / spec["sh"]))
        im.alpha_composite(crop, (ox, oy))
    # Feet at y=340. Rough stand-in of the rig.
    blit(body, bmeta["leg"], 160, 250)
    blit(body, bmeta["leg"], 190, 250)
    blit(body, bmeta["boot"], 160, 300)
    blit(body, bmeta["boot"], 190, 300)
    blit(body, bmeta["skirt"], 175, 230)
    blit(body, bmeta["torso"], 175, 175)
    blit(body, bmeta["sleeve"], 145, 185)
    blit(body, bmeta["sleeve"], 205, 185)
    blit(body, bmeta["head"], 175, 150)
    blit(body, bmeta["hat"], 175, 132)
    blit(wep, wmeta["spear"], 280, 160, 2.2)
    blit(wep, wmeta["staff"], 400, 180, 2.2)
    im.save(os.path.join(OUT, "preview.png"))


def main():
    os.makedirs(OUT, exist_ok=True)
    body_parts = take_parts(BODY_SRC, BODY_NAMES, 4, 2)
    wep_parts = take_parts(WEP_SRC, WEP_NAMES, 4, 3)
    body, bmeta = pack(body_parts)
    wep, wmeta = pack(wep_parts)
    body.save(os.path.join(OUT, "body.png"))
    wep.save(os.path.join(OUT, "weapons.png"))
    with open(os.path.join(OUT, "parts.json"), "w", encoding="utf-8") as f:
        json.dump({"body": bmeta, "weapons": wmeta}, f, indent=2)
    preview(body, bmeta, wep, wmeta)
    print("parts", len(bmeta), len(wmeta))


if __name__ == "__main__":
    main()

"""Paint the melee rig parts. Cloth is the blue wizard; the game recolors blue pixels."""
from PIL import Image, ImageDraw, ImageFilter
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "images", "melee")
os.makedirs(OUT, exist_ok=True)

INK = (32, 24, 20, 255)
SKIN = (236, 190, 150, 255)
SKIN_S = (196, 142, 108, 255)
SKIN_H = (255, 224, 196, 255)
HAIR = (98, 62, 42, 255)
HAIR_D = (62, 38, 26, 255)
HAIR_H = (150, 104, 68, 255)
BOOT = (112, 72, 44, 255)
BOOT_D = (68, 40, 24, 255)
BOOT_H = (156, 108, 68, 255)
GOLD = (236, 196, 92, 255)
GOLD_D = (168, 122, 42, 255)
GOLD_H = (255, 236, 170, 255)
ROBE = (58, 104, 186, 255)
ROBE_L = (118, 164, 224, 255)
ROBE_D = (32, 68, 132, 255)
ROBE_S = (22, 44, 96, 255)
STEEL = (214, 224, 232, 255)
STEEL_D = (108, 124, 142, 255)
STEEL_H = (255, 255, 255, 255)
STEEL_E = (168, 184, 198, 255)
WOOD = (128, 86, 52, 255)
WOOD_D = (78, 50, 30, 255)
WOOD_H = (176, 128, 82, 255)
ORB = (126, 206, 255, 255)
ORB_D = (64, 140, 210, 255)
LEATHER = (154, 92, 48, 255)
LEATHER_D = (96, 54, 28, 255)

CELL = 180


def canvas():
    return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))


def inked(d, box, fill, w=4):
    d.ellipse(box, fill=INK)
    d.ellipse((box[0] + w, box[1] + w, box[2] - w, box[3] - w), fill=fill)


def poly(d, pts, fill, width=4):
    d.polygon(pts, fill=INK)
    # inset by drawing the fill on top; outline is the larger stroke under it
    d.line(pts + [pts[0]], fill=INK, width=width)
    d.polygon(pts, fill=fill)


def head():
    im = canvas()
    d = ImageDraw.Draw(im)
    # hair back
    inked(d, (38, 28, 146, 128), HAIR_D, 5)
    d.ellipse((48, 36, 136, 118), fill=HAIR)
    d.polygon([(48, 70), (36, 108), (58, 96)], fill=HAIR)
    d.polygon([(132, 68), (150, 104), (124, 92)], fill=HAIR_D)
    # face
    inked(d, (52, 46, 132, 128), SKIN_S, 4)
    d.ellipse((58, 52, 126, 122), fill=SKIN)
    d.ellipse((78, 58, 124, 100), fill=SKIN_H)
    # bangs
    d.polygon([(58, 62), (78, 46), (96, 64), (70, 78)], fill=HAIR)
    d.polygon([(96, 48), (128, 58), (118, 78), (92, 66)], fill=HAIR_D)
    d.ellipse((64, 50, 100, 72), fill=HAIR_H)
    # eyes
    d.ellipse((70, 78, 90, 96), fill=(255, 255, 255, 255))
    d.ellipse((100, 78, 122, 96), fill=(255, 255, 255, 255))
    d.ellipse((76, 82, 88, 95), fill=(42, 78, 140, 255))
    d.ellipse((106, 82, 118, 95), fill=(42, 78, 140, 255))
    d.ellipse((80, 84, 86, 91), fill=INK)
    d.ellipse((110, 84, 116, 91), fill=INK)
    d.ellipse((78, 84, 82, 88), fill=(255, 255, 255, 255))
    d.ellipse((108, 84, 112, 88), fill=(255, 255, 255, 255))
    # brows
    d.line([(68, 74), (90, 76)], fill=HAIR_D, width=3)
    d.line([(100, 76), (124, 73)], fill=HAIR_D, width=3)
    # nose and mouth
    d.line([(96, 96), (92, 106)], fill=SKIN_S, width=2)
    d.arc((84, 104, 112, 120), 20, 160, fill=(168, 92, 92, 255), width=2)
    d.ellipse((66, 98, 78, 108), fill=(232, 150, 140, 90))
    d.ellipse((114, 98, 126, 108), fill=(232, 150, 140, 90))
    # ear
    d.ellipse((124, 86, 140, 106), fill=SKIN)
    d.ellipse((128, 90, 138, 102), fill=SKIN_S)
    return im


def hat():
    im = canvas()
    d = ImageDraw.Draw(im)
    # brim
    d.ellipse((18, 108, 164, 150), fill=INK)
    d.ellipse((26, 114, 156, 144), fill=ROBE_D)
    d.ellipse((40, 118, 150, 138), fill=ROBE)
    # cone
    d.polygon([(90, 16), (48, 122), (132, 122)], fill=INK)
    d.polygon([(90, 26), (56, 116), (124, 116)], fill=ROBE)
    d.polygon([(90, 32), (78, 112), (108, 70)], fill=ROBE_L)
    d.polygon([(90, 40), (108, 116), (124, 116)], fill=ROBE_D)
    # band
    d.polygon([(54, 100), (126, 100), (130, 116), (50, 116)], fill=GOLD_D)
    d.polygon([(56, 102), (124, 102), (126, 112), (54, 112)], fill=GOLD)
    d.rectangle((84, 100, 98, 116), fill=GOLD_H)
    # buckle
    d.ellipse((80, 102, 102, 116), fill=GOLD_D)
    d.ellipse((84, 105, 98, 114), fill=(90, 150, 210, 255))
    # tip fold
    d.polygon([(90, 16), (104, 18), (96, 36)], fill=ROBE_D)
    return im


def torso():
    im = canvas()
    d = ImageDraw.Draw(im)
    d.polygon([(40, 18), (140, 18), (156, 150), (24, 150), (32, 70)], fill=INK)
    d.polygon([(48, 26), (132, 26), (146, 142), (34, 142), (40, 74)], fill=ROBE)
    d.polygon([(48, 26), (90, 30), (78, 142), (34, 142), (40, 74)], fill=ROBE_L)
    d.polygon([(100, 36), (132, 26), (146, 142), (108, 142)], fill=ROBE_D)
    # center opening
    d.polygon([(82, 48), (98, 48), (104, 142), (76, 142)], fill=ROBE_S)
    d.line([(90, 50), (90, 140)], fill=GOLD_D, width=3)
    # collar
    d.polygon([(62, 18), (118, 18), (108, 40), (72, 40)], fill=ROBE_D)
    d.polygon([(70, 22), (110, 22), (102, 36), (78, 36)], fill=ROBE)
    # brooch
    d.ellipse((76, 28, 104, 52), fill=GOLD_D)
    d.ellipse((80, 32, 100, 48), fill=GOLD)
    d.ellipse((86, 36, 96, 46), fill=ORB)
    d.ellipse((88, 38, 92, 42), fill=(255, 255, 255, 220))
    # fold lines
    d.line([(58, 70), (70, 138)], fill=ROBE_D, width=2)
    d.line([(122, 64), (128, 136)], fill=ROBE_S, width=2)
    return im


def skirt():
    im = canvas()
    d = ImageDraw.Draw(im)
    d.polygon([(28, 8), (152, 8), (168, 150), (12, 150)], fill=INK)
    d.polygon([(36, 16), (144, 16), (158, 142), (22, 142)], fill=ROBE)
    d.polygon([(36, 16), (90, 20), (80, 142), (22, 142)], fill=ROBE_L)
    d.polygon([(100, 20), (144, 16), (158, 142), (96, 142)], fill=ROBE_D)
    d.polygon([(78, 16), (102, 16), (110, 142), (70, 142)], fill=ROBE_S)
    # hem gold
    d.polygon([(22, 124), (158, 124), (158, 142), (22, 142)], fill=GOLD_D)
    d.polygon([(26, 128), (154, 128), (154, 138), (26, 138)], fill=GOLD)
    d.line([(40, 40), (48, 120)], fill=ROBE_D, width=2)
    d.line([(136, 36), (140, 118)], fill=ROBE_S, width=2)
    return im


def sleeve():
    im = canvas()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((58, 8, 122, 150), 18, fill=INK)
    d.rounded_rectangle((66, 16, 114, 140), 14, fill=ROBE)
    d.polygon([(66, 20), (88, 24), (84, 136), (66, 132)], fill=ROBE_L)
    d.polygon([(96, 24), (114, 20), (114, 136), (98, 132)], fill=ROBE_D)
    d.rounded_rectangle((60, 118, 120, 148), 10, fill=GOLD_D)
    d.rounded_rectangle((66, 122, 114, 142), 8, fill=GOLD)
    return im


def hand():
    im = canvas()
    d = ImageDraw.Draw(im)
    inked(d, (48, 36, 132, 128), SKIN_S, 4)
    d.ellipse((56, 44, 124, 120), fill=SKIN)
    d.ellipse((70, 50, 118, 90), fill=SKIN_H)
    # fingers
    d.rounded_rectangle((58, 96, 78, 150), 8, fill=INK)
    d.rounded_rectangle((78, 104, 100, 158), 8, fill=INK)
    d.rounded_rectangle((100, 98, 122, 148), 8, fill=INK)
    d.rounded_rectangle((62, 100, 74, 144), 6, fill=SKIN)
    d.rounded_rectangle((82, 108, 96, 152), 6, fill=SKIN_S)
    d.rounded_rectangle((104, 102, 118, 142), 6, fill=SKIN)
    return im


def leg():
    im = canvas()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((62, 6, 118, 168), 16, fill=INK)
    d.rounded_rectangle((70, 14, 110, 158), 12, fill=ROBE_D)
    d.polygon([(70, 18), (88, 22), (86, 150), (70, 146)], fill=ROBE)
    return im


def boot():
    im = canvas()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((48, 28, 124, 132), 16, fill=INK)
    d.polygon([(40, 108), (150, 108), (156, 156), (28, 156)], fill=INK)
    d.rounded_rectangle((56, 36, 116, 124), 12, fill=BOOT)
    d.polygon([(56, 40), (82, 44), (80, 116), (56, 112)], fill=BOOT_H)
    d.polygon([(48, 116), (142, 116), (146, 148), (36, 148)], fill=BOOT_D)
    d.polygon([(52, 120), (138, 120), (140, 140), (42, 140)], fill=BOOT)
    # cuff
    d.rounded_rectangle((52, 28, 120, 58), 8, fill=BOOT_D)
    d.rectangle((64, 36, 108, 50), fill=GOLD)
    d.ellipse((78, 34, 96, 52), fill=GOLD_H)
    return im


def sword():
    im = Image.new("RGBA", (CELL, 260), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # grip
    d.rounded_rectangle((78, 18, 102, 70), 6, fill=INK)
    d.rounded_rectangle((82, 22, 98, 66), 4, fill=LEATHER)
    d.line([(86, 28), (94, 28)], fill=GOLD, width=2)
    d.line([(86, 40), (94, 40)], fill=GOLD, width=2)
    d.line([(86, 52), (94, 52)], fill=GOLD, width=2)
    # guard
    d.polygon([(40, 66), (140, 66), (132, 86), (48, 86)], fill=INK)
    d.polygon([(48, 70), (132, 70), (126, 82), (54, 82)], fill=GOLD)
    d.polygon([(70, 70), (110, 70), (106, 82), (74, 82)], fill=GOLD_H)
    # blade
    d.polygon([(90, 78), (112, 96), (100, 236), (90, 250), (80, 236), (68, 96)], fill=INK)
    d.polygon([(90, 86), (106, 100), (96, 230), (90, 242), (84, 230), (74, 100)], fill=STEEL)
    d.polygon([(90, 92), (100, 104), (94, 226), (90, 234)], fill=STEEL_H)
    d.polygon([(90, 100), (80, 112), (86, 228), (90, 236)], fill=STEEL_D)
    d.line([(90, 110), (90, 228)], fill=STEEL_E, width=2)
    return im


def dagger():
    im = canvas()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((78, 28, 102, 78), 5, fill=INK)
    d.rounded_rectangle((82, 32, 98, 74), 4, fill=(48, 48, 58, 255))
    d.polygon([(46, 74), (134, 74), (124, 90), (56, 90)], fill=GOLD_D)
    d.polygon([(54, 78), (126, 78), (118, 86), (62, 86)], fill=GOLD)
    d.polygon([(90, 84), (106, 98), (96, 150), (90, 162), (84, 150), (74, 98)], fill=INK)
    d.polygon([(90, 90), (100, 102), (94, 146), (90, 154), (86, 146), (80, 102)], fill=STEEL)
    d.polygon([(90, 96), (96, 106), (93, 142)], fill=STEEL_H)
    return im


def spear():
    im = Image.new("RGBA", (CELL, 320), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((80, 18, 100, 230), 6, fill=INK)
    d.rounded_rectangle((84, 24, 96, 224), 4, fill=WOOD)
    d.polygon([(84, 28), (90, 32), (90, 218), (84, 214)], fill=WOOD_H)
    d.rectangle((76, 36, 104, 58), fill=LEATHER)
    d.rectangle((78, 70, 102, 82), fill=GOLD_D)
    d.polygon([(90, 312), (124, 268), (96, 236), (90, 248), (84, 236), (56, 268)], fill=INK)
    d.polygon([(90, 304), (116, 268), (94, 244), (90, 254), (86, 244), (64, 268)], fill=STEEL)
    d.polygon([(90, 296), (108, 270), (94, 250)], fill=STEEL_H)
    d.polygon([(90, 292), (74, 268), (88, 250)], fill=STEEL_D)
    return im


def greatsword():
    im = Image.new("RGBA", (CELL, 280), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((74, 16, 106, 78), 6, fill=INK)
    d.rounded_rectangle((80, 22, 100, 72), 4, fill=LEATHER_D)
    d.line([(84, 30), (96, 30)], fill=GOLD, width=3)
    d.line([(84, 44), (96, 44)], fill=GOLD, width=3)
    d.line([(84, 58), (96, 58)], fill=GOLD, width=3)
    d.polygon([(18, 70), (162, 70), (150, 98), (30, 98)], fill=INK)
    d.polygon([(28, 76), (152, 76), (144, 92), (36, 92)], fill=GOLD)
    d.polygon([(60, 76), (120, 76), (114, 92), (66, 92)], fill=GOLD_H)
    d.polygon([(90, 86), (132, 112), (112, 248), (90, 266), (68, 248), (48, 112)], fill=INK)
    d.polygon([(90, 96), (122, 116), (106, 242), (90, 254), (74, 242), (58, 116)], fill=STEEL)
    d.polygon([(90, 108), (112, 124), (100, 236)], fill=STEEL_H)
    d.polygon([(90, 116), (70, 130), (82, 236)], fill=STEEL_D)
    d.polygon([(86, 140), (94, 140), (94, 230), (86, 230)], fill=(150, 168, 186, 255))
    return im


def hammer():
    im = Image.new("RGBA", (CELL, 260), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((80, 28, 100, 168), 5, fill=INK)
    d.rounded_rectangle((84, 34, 96, 162), 4, fill=WOOD_D)
    d.polygon([(84, 36), (90, 40), (90, 158), (84, 154)], fill=WOOD)
    d.rectangle((76, 70, 104, 86), fill=LEATHER)
    # head
    d.rounded_rectangle((28, 150, 152, 230), 12, fill=INK)
    d.rounded_rectangle((36, 158, 144, 222), 8, fill=STEEL_D)
    d.polygon([(36, 158), (90, 166), (90, 214), (36, 206)], fill=STEEL)
    d.polygon([(90, 166), (144, 158), (144, 206), (90, 214)], fill=(78, 90, 104, 255))
    d.rectangle((36, 186, 144, 196), fill=GOLD)
    d.polygon([(24, 168), (36, 160), (36, 220), (24, 210)], fill=GOLD_D)
    d.polygon([(144, 160), (160, 168), (156, 214), (144, 220)], fill=STEEL_E)
    return im


def scythe():
    im = Image.new("RGBA", (CELL, 280), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.line([(88, 16), (88, 190)], fill=INK, width=16)
    d.line([(88, 22), (88, 184)], fill=WOOD_D, width=8)
    d.line([(85, 26), (85, 180)], fill=WOOD_H, width=3)
    d.ellipse((78, 168, 100, 190), fill=GOLD_D)
    d.arc((8, 120, 150, 268), 200, 30, fill=INK, width=22)
    d.arc((16, 128, 142, 260), 206, 22, fill=STEEL, width=12)
    d.arc((22, 136, 134, 252), 214, 10, fill=STEEL_H, width=4)
    d.polygon([(28, 196), (8, 188), (20, 214)], fill=STEEL)
    return im


def glaive():
    im = Image.new("RGBA", (CELL, 300), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((82, 16, 100, 210), 5, fill=INK)
    d.rounded_rectangle((86, 22, 96, 204), 4, fill=WOOD)
    d.polygon([(86, 26), (91, 30), (91, 198), (86, 194)], fill=WOOD_H)
    d.rectangle((78, 40, 104, 56), fill=LEATHER)
    d.polygon([(90, 292), (138, 228), (104, 198), (90, 214), (70, 198), (48, 236)], fill=INK)
    d.polygon([(90, 284), (128, 230), (100, 208), (90, 222), (78, 208), (58, 236)], fill=STEEL)
    d.polygon([(90, 276), (118, 234), (98, 216)], fill=STEEL_H)
    d.polygon([(90, 270), (68, 236), (84, 216)], fill=(90, 160, 150, 255))
    return im


def whip_handle():
    im = canvas()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((76, 36, 104, 150), 8, fill=INK)
    d.rounded_rectangle((82, 42, 98, 142), 6, fill=LEATHER)
    d.rectangle((80, 60, 100, 70), fill=GOLD)
    d.rectangle((80, 100, 100, 110), fill=GOLD_D)
    d.ellipse((74, 28, 106, 52), fill=GOLD)
    return im


def chain_blade():
    im = canvas()
    d = ImageDraw.Draw(im)
    d.polygon([(70, 40), (130, 70), (118, 96), (40, 120), (28, 96), (78, 70)], fill=INK)
    d.polygon([(76, 48), (122, 72), (112, 90), (48, 110), (38, 96), (82, 72)], fill=STEEL)
    d.polygon([(84, 54), (114, 72), (100, 84)], fill=STEEL_H)
    d.polygon([(50, 96), (90, 78), (70, 104)], fill=(180, 70, 70, 255))
    d.ellipse((78, 70, 100, 92), fill=GOLD_D)
    return im


def chain_link():
    im = Image.new("RGBA", (64, 36), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((4, 4, 60, 32), 12, fill=INK)
    d.rounded_rectangle((10, 9, 54, 27), 10, fill=(0, 0, 0, 0))
    d.arc((8, 6, 56, 30), 200, 340, fill=STEEL, width=5)
    d.arc((8, 6, 56, 30), 20, 160, fill=STEEL_D, width=5)
    return im


def staff():
    im = Image.new("RGBA", (CELL, 300), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((80, 16, 100, 220), 6, fill=INK)
    d.rounded_rectangle((84, 22, 96, 214), 4, fill=WOOD)
    d.polygon([(84, 26), (90, 30), (90, 208), (84, 204)], fill=WOOD_H)
    for y in (36, 78, 120, 162):
        d.rectangle((78, y, 102, y + 10), fill=LEATHER_D)
        d.rectangle((80, y + 2, 100, y + 7), fill=GOLD_D)
    d.polygon([(70, 214), (110, 214), (118, 244), (62, 244)], fill=GOLD_D)
    d.polygon([(76, 218), (104, 218), (110, 238), (70, 238)], fill=GOLD)
    d.ellipse((62, 236, 118, 292), fill=INK)
    d.ellipse((70, 244, 110, 284), fill=ORB_D)
    d.ellipse((76, 248, 106, 278), fill=ORB)
    d.ellipse((84, 254, 96, 266), fill=(255, 255, 255, 230))
    return im


def gauntlet():
    im = canvas()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((48, 36, 132, 148), 18, fill=INK)
    d.rounded_rectangle((56, 44, 124, 140), 14, fill=STEEL_D)
    d.polygon([(56, 50), (90, 48), (86, 132), (56, 128)], fill=STEEL)
    d.polygon([(96, 50), (124, 48), (124, 128), (100, 132)], fill=(80, 92, 108, 255))
    d.rounded_rectangle((52, 78, 128, 100), 6, fill=GOLD_D)
    d.rounded_rectangle((58, 82, 122, 96), 4, fill=GOLD)
    # knuckles
    for x in (62, 86, 108):
        d.ellipse((x, 44, x + 22, 68), fill=INK)
        d.ellipse((x + 3, 48, x + 18, 64), fill=STEEL_H)
    d.polygon([(48, 110), (36, 128), (56, 140)], fill=GOLD)
    return im


def fit(im, ax, ay, dh):
    bbox = im.getbbox() or (0, 0, im.width, im.height)
    im = im.crop(bbox)
    ax = int(ax - bbox[0])
    ay = int(ay - bbox[1])
    ax = max(0, min(im.width - 1, ax))
    ay = max(0, min(im.height - 1, ay))
    aspect = im.width / max(1, im.height)
    dw = max(4, int(round(dh * aspect)))
    return im, ax, ay, dw


def pack(items):
    """items: list of (name, image, ax, ay, dh)"""
    fitted = []
    for name, im, ax, ay, dh in items:
        im, ax, ay, dw = fit(im, ax, ay, dh)
        fitted.append((name, im, ax, ay, dw, dh))
    sheet = Image.new("RGBA", (sum(im.width for _, im, *_ in fitted) + 4 * len(fitted), max(im.height for _, im, *_ in fitted)), (0, 0, 0, 0))
    meta = {}
    x = 0
    for name, im, ax, ay, dw, dh in fitted:
        sheet.paste(im, (x, 0), im)
        meta[name] = {"sx": x, "sy": 0, "sw": im.width, "sh": im.height, "ax": ax, "ay": ay, "dw": dw, "dh": dh}
        x += im.width + 4
    return sheet, meta


def preview(meta_body, body, meta_wep, wep):
    im = Image.new("RGBA", (640, 360), (24, 28, 40, 255))
    d = ImageDraw.Draw(im)
    d.text((16, 12), "assembled", fill=(220, 226, 240, 255))

    def blit(sheet, spec, dx, dy):
        crop = sheet.crop((spec["sx"], spec["sy"], spec["sx"] + spec["sw"], spec["sy"] + spec["sh"]))
        scale = 3.2
        dw, dh = int(spec["dw"] * scale), int(spec["dh"] * scale)
        crop = crop.resize((max(1, dw), max(1, dh)), Image.Resampling.NEAREST)
        ox = int(dx - spec["ax"] * (dw / spec["sw"]))
        oy = int(dy - spec["ay"] * (dh / spec["sh"]))
        im.alpha_composite(crop, (ox, oy))

    # idle wizard, feet near (180, 300)
    blit(body, meta_body["leg"], 168, 248)
    blit(body, meta_body["leg"], 196, 248)
    blit(body, meta_body["boot"], 168, 292)
    blit(body, meta_body["boot"], 196, 292)
    blit(body, meta_body["skirt"], 182, 230)
    blit(body, meta_body["torso"], 182, 168)
    blit(body, meta_body["sleeve"], 150, 176)
    blit(body, meta_body["sleeve"], 214, 176)
    blit(body, meta_body["hand"], 150, 220)
    blit(body, meta_body["hand"], 214, 220)
    blit(body, meta_body["head"], 182, 150)
    blit(body, meta_body["hat"], 182, 132)
    blit(wep, meta_wep["sword"], 214, 228)
    x = 280
    for name in ("dagger", "spear", "greatsword", "hammer", "scythe", "glaive", "staff", "gauntlet", "chain", "whip"):
        blit(wep, meta_wep[name], x, 80 if name in ("spear", "greatsword", "scythe", "glaive", "staff") else 200)
        x += 8
    im.save(os.path.join(OUT, "preview.png"))


def main():
    body_items = [
        ("head", head(), 90, 124, 22),
        ("hat", hat(), 90, 128, 26),
        ("torso", torso(), 90, 28, 28),
        ("skirt", skirt(), 90, 16, 24),
        ("sleeve", sleeve(), 90, 18, 16),
        ("hand", hand(), 90, 70, 10),
        ("leg", leg(), 90, 16, 16),
        ("boot", boot(), 90, 36, 12),
    ]
    body, bmeta = pack(body_items)
    wep_items = [
        ("sword", sword(), 90, 36, 36),
        ("dagger", dagger(), 90, 40, 20),
        ("spear", spear(), 90, 42, 62),
        ("greatsword", greatsword(), 90, 28, 48),
        ("hammer", hammer(), 90, 40, 42),
        ("scythe", scythe(), 88, 28, 52),
        ("glaive", glaive(), 90, 36, 54),
        ("whip", whip_handle(), 90, 48, 16),
        ("chain", chain_blade(), 78, 78, 16),
        ("staff", staff(), 90, 36, 54),
        ("gauntlet", gauntlet(), 90, 100, 14),
        ("link", chain_link(), 32, 18, 5),
    ]
    wep, wmeta = pack(wep_items)
    body.save(os.path.join(OUT, "body.png"))
    wep.save(os.path.join(OUT, "weapons.png"))
    with open(os.path.join(OUT, "parts.json"), "w", encoding="utf-8") as f:
        json.dump({"body": bmeta, "weapons": wmeta}, f, indent=2)
    preview(bmeta, body, wmeta, wep)
    print("wrote", OUT)


if __name__ == "__main__":
    main()

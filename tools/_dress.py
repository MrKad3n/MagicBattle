"""Original castle dress sprites. Illustrated, not traced from the layout painting."""
from PIL import Image, ImageDraw

S = 256
OUT = r"images/props/emberfall-castle-dress.png"


def cell():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def drape():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((18, 6, 238, 22), fill=(186, 146, 52, 255))
    d.polygon([(28, 22), (228, 22), (206, 250), (50, 250)], fill=(148, 32, 40, 255))
    d.polygon([(70, 22), (186, 22), (170, 250), (86, 250)], fill=(96, 16, 24, 255))
    d.polygon([(118, 40), (138, 40), (128, 78)], fill=(230, 196, 90, 255))
    d.ellipse((108, 86, 148, 126), fill=(212, 170, 58, 255))
    return im


def curtain():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((10, 8, 246, 26), fill=(70, 48, 32, 255))
    for x, c in ((16, (120, 28, 36)), (70, (86, 18, 28)), (124, (150, 40, 48)), (178, (90, 16, 26))):
        d.polygon([(x, 26), (x + 62, 26), (x + 48, 248), (x + 14, 248)], fill=c + (255,))
    d.rectangle((24, 26, 232, 34), fill=(186, 146, 52, 255))
    return im


def column():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((78, 28, 178, 232), fill=(168, 162, 150, 255))
    d.rectangle((90, 40, 166, 220), fill=(196, 190, 176, 255))
    d.rectangle((70, 16, 186, 40), fill=(120, 114, 104, 255))
    d.rectangle((64, 220, 192, 248), fill=(110, 104, 96, 255))
    d.rectangle((104, 70, 152, 150), fill=(150, 40, 46, 255))
    d.ellipse((112, 96, 144, 128), fill=(220, 180, 70, 255))
    return im


def grandthrone():
    im = cell(); d = ImageDraw.Draw(im)
    d.polygon([(40, 36), (216, 36), (196, 70), (60, 70)], fill=(150, 28, 36, 255))
    d.rectangle((70, 70, 186, 150), fill=(120, 22, 30, 255))
    d.polygon([(78, 78), (178, 78), (168, 140), (88, 140)], fill=(186, 36, 46, 255))
    d.polygon([(108, 88), (148, 88), (128, 120)], fill=(230, 196, 80, 255))
    d.rectangle((48, 146, 208, 176), fill=(90, 18, 24, 255))
    d.rectangle((36, 176, 220, 210), fill=(150, 116, 48, 255))
    d.rectangle((24, 206, 232, 236), fill=(120, 90, 36, 255))
    d.rectangle((16, 230, 240, 250), fill=(90, 24, 28, 255))
    return im


def shelfwall():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((8, 8, 248, 248), fill=(92, 58, 34, 255))
    books = [(150, 36, 36), (36, 70, 140), (36, 110, 60), (160, 120, 40), (90, 40, 120), (180, 90, 40), (40, 90, 100), (120, 40, 40)]
    y = 18
    while y < 230:
        d.rectangle((16, y + 28, 240, y + 36), fill=(64, 40, 24, 255))
        x = 20
        i = 0
        while x < 230:
            c = books[(i + y) % len(books)]
            w = 14 + (i % 4) * 3
            d.rectangle((x, y, x + w, y + 28), fill=c + (255,))
            d.rectangle((x + 2, y + 4, x + w - 2, y + 7), fill=(240, 230, 200, 180))
            x += w + 2
            i += 1
        y += 40
    return im


def warmap():
    im = cell(); d = ImageDraw.Draw(im)
    d.ellipse((16, 150, 240, 240), fill=(110, 70, 40, 255))
    d.ellipse((36, 70, 220, 200), fill=(196, 170, 120, 255))
    d.polygon([(70, 100), (120, 90), (150, 120), (100, 150)], fill=(70, 130, 70, 255))
    d.polygon([(130, 110), (190, 100), (180, 160), (140, 150)], fill=(60, 100, 160, 255))
    d.ellipse((150, 130, 166, 146), fill=(180, 40, 40, 255))
    d.line((80, 160, 190, 110), fill=(120, 40, 40, 255), width=3)
    for x, y in ((70, 210), (170, 210)):
        d.rectangle((x, y, x + 16, 252), fill=(80, 52, 32, 255))
    return im


def council():
    im = cell(); d = ImageDraw.Draw(im)
    d.rounded_rectangle((20, 90, 236, 150), radius=16, fill=(120, 74, 42, 255))
    d.rounded_rectangle((36, 100, 220, 138), radius=10, fill=(150, 96, 54, 255))
    for x in (28, 196):
        d.ellipse((x, 150, x + 36, 190), fill=(90, 40, 28, 255))
        d.rectangle((x + 12, 186, x + 24, 240), fill=(70, 46, 30, 255))
    for x in (70, 118, 166):
        d.polygon([(x, 150), (x + 28, 150), (x + 22, 210), (x + 6, 210)], fill=(140, 30, 36, 255))
    d.ellipse((112, 108, 144, 132), fill=(212, 170, 60, 255))
    return im


def hearth():
    im = cell(); d = ImageDraw.Draw(im)
    d.polygon([(30, 40), (226, 40), (210, 230), (46, 230)], fill=(96, 92, 88, 255))
    d.pieslice((60, 70, 196, 210), 200, 340, fill=(40, 28, 24, 255))
    d.ellipse((86, 120, 170, 190), fill=(255, 120, 30, 255))
    d.ellipse((104, 136, 152, 174), fill=(255, 210, 90, 255))
    d.ellipse((118, 148, 138, 166), fill=(255, 245, 210, 230))
    d.ellipse((96, 168, 160, 214), fill=(50, 52, 56, 255))
    d.ellipse((108, 178, 148, 208), fill=(40, 90, 50, 255))
    return im


def canopy():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((36, 24, 220, 40), fill=(140, 28, 36, 255))
    for x in (40, 200):
        d.rectangle((x, 36, x + 14, 230), fill=(110, 70, 40, 255))
    d.rectangle((48, 120, 208, 210), fill=(150, 36, 44, 255))
    d.rectangle((60, 132, 196, 196), fill=(190, 50, 56, 255))
    d.ellipse((64, 100, 120, 140), fill=(236, 226, 206, 255))
    d.polygon([(36, 40), (220, 40), (200, 90), (56, 90)], fill=(120, 22, 30, 180))
    return im


def stores():
    im = cell(); d = ImageDraw.Draw(im)
    boxes = [(20, 140, 110, 230, (140, 96, 48)), (100, 100, 200, 180, (120, 78, 40)), (150, 170, 236, 246, (160, 110, 54))]
    for x0, y0, x1, y1, c in boxes:
        d.rectangle((x0, y0, x1, y1), fill=c + (255,))
        d.line((x0, (y0 + y1) // 2, x1, (y0 + y1) // 2), fill=(80, 50, 28, 255), width=3)
        d.line(((x0 + x1) // 2, y0, (x0 + x1) // 2, y1), fill=(80, 50, 28, 255), width=3)
    d.ellipse((40, 60, 100, 120), fill=(90, 58, 32, 255))
    d.rectangle((64, 48, 76, 70), fill=(70, 46, 28, 255))
    return im


def prison():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((24, 16, 232, 248), fill=(70, 68, 66, 255))
    d.rectangle((40, 32, 216, 230), fill=(28, 26, 24, 255))
    for x in range(52, 210, 22):
        d.rectangle((x, 36, x + 8, 220), fill=(150, 150, 154, 255))
    d.rectangle((40, 120, 216, 132), fill=(140, 140, 146, 255))
    d.arc((150, 70, 200, 130), 20, 200, fill=(180, 160, 80, 255), width=4)
    d.ellipse((70, 180, 130, 220), fill=(140, 120, 60, 255))
    return im


def magewell():
    im = cell(); d = ImageDraw.Draw(im)
    d.ellipse((28, 150, 228, 240), fill=(48, 36, 70, 255))
    d.ellipse((48, 164, 208, 226), fill=(90, 50, 140, 255))
    for i, ang in enumerate((40, 140, 230)):
        d.polygon([(128, 150), (70 + i * 30, 80), (100 + i * 24, 70)], fill=(80, 160, 230, 255))
    d.polygon([(128, 20), (168, 90), (128, 150), (88, 90)], fill=(90, 170, 240, 255))
    d.polygon([(128, 40), (150, 90), (128, 130), (106, 90)], fill=(200, 230, 255, 255))
    d.ellipse((112, 176, 144, 204), fill=(255, 220, 120, 255))
    return im


def hoard():
    im = cell(); d = ImageDraw.Draw(im)
    d.ellipse((20, 150, 140, 230), fill=(196, 150, 40, 255))
    d.ellipse((90, 120, 230, 220), fill=(220, 176, 54, 255))
    d.ellipse((60, 170, 180, 246), fill=(160, 120, 30, 255))
    for x, y in ((50, 160), (100, 140), (150, 150), (180, 180), (80, 200)):
        d.ellipse((x, y, x + 28, y + 16), fill=(255, 220, 110, 255))
    d.rectangle((70, 90, 150, 150), fill=(120, 72, 36, 255))
    d.rectangle((78, 98, 142, 112), fill=(200, 160, 50, 255))
    return im


def dais():
    im = cell(); d = ImageDraw.Draw(im)
    d.polygon([(10, 200), (246, 200), (220, 250), (36, 250)], fill=(120, 24, 30, 255))
    d.polygon([(30, 150), (226, 150), (206, 200), (50, 200)], fill=(160, 32, 40, 255))
    d.polygon([(54, 100), (202, 100), (186, 150), (70, 150)], fill=(190, 40, 48, 255))
    d.rectangle((40, 96, 216, 108), fill=(210, 170, 60, 255))
    return im


def knight():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((118, 16, 138, 248), fill=(70, 72, 78, 255))
    d.ellipse((96, 28, 160, 78), fill=(186, 190, 196, 255))
    d.polygon([(78, 78), (178, 78), (164, 160), (92, 160)], fill=(160, 166, 174, 255))
    d.rectangle((86, 160, 112, 230), fill=(140, 146, 154, 255))
    d.rectangle((144, 160, 170, 230), fill=(140, 146, 154, 255))
    d.polygon([(40, 90), (78, 100), (70, 200), (36, 180)], fill=(150, 30, 36, 255))
    return im


def bower():
    im = cell(); d = ImageDraw.Draw(im)
    d.ellipse((20, 120, 236, 200), fill=(100, 102, 108, 255))
    d.ellipse((40, 136, 216, 188), fill=(70, 150, 190, 255))
    d.rectangle((118, 50, 138, 150), fill=(130, 132, 138, 255))
    d.ellipse((96, 24, 160, 78), fill=(190, 230, 245, 255))
    for x in (30, 190):
        d.ellipse((x, 70, x + 50, 130), fill=(50, 130, 60, 255))
    return im


def oaktree():
    im = cell(); d = ImageDraw.Draw(im)
    d.polygon([(118, 150), (138, 150), (150, 248), (106, 248)], fill=(110, 72, 40, 255))
    d.ellipse((30, 40, 150, 160), fill=(36, 110, 48, 255))
    d.ellipse((90, 20, 230, 150), fill=(46, 130, 58, 255))
    d.ellipse((70, 70, 190, 180), fill=(60, 150, 70, 255))
    d.ellipse((120, 60, 150, 86), fill=(220, 70, 80, 255))
    return im


def feast():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((12, 150, 244, 190), fill=(120, 74, 40, 255))
    d.rectangle((20, 130, 236, 158), fill=(150, 96, 52, 255))
    for x in (40, 100, 160, 210):
        d.ellipse((x, 108, x + 28, 128), fill=(220, 210, 190, 255))
        d.ellipse((x + 6, 96, x + 20, 112), fill=(160, 30, 36, 255))
    d.rectangle((118, 70, 138, 130), fill=(180, 150, 60, 255))
    d.polygon([(108, 70), (148, 70), (128, 40)], fill=(255, 180, 70, 255))
    for x in (24, 210):
        d.rectangle((x, 186, x + 16, 248), fill=(80, 50, 30, 255))
    return im


def rosewin():
    im = cell(); d = ImageDraw.Draw(im)
    d.ellipse((18, 18, 238, 238), fill=(40, 36, 34, 255))
    d.ellipse((36, 36, 220, 220), fill=(70, 110, 180, 255))
    d.pieslice((36, 36, 220, 220), 200, 340, fill=(180, 40, 50, 255))
    d.pieslice((36, 36, 220, 220), 20, 160, fill=(210, 170, 50, 255))
    d.ellipse((96, 96, 160, 160), fill=(240, 220, 140, 255))
    d.line((128, 36, 128, 220), fill=(50, 40, 36, 255), width=6)
    d.line((36, 128, 220, 128), fill=(50, 40, 36, 255), width=6)
    return im


def pews():
    im = cell(); d = ImageDraw.Draw(im)
    for y in (40, 100, 160):
        d.rounded_rectangle((20, y, 236, y + 36), radius=8, fill=(110, 68, 38, 255))
        d.rectangle((28, y + 8, 228, y + 22), fill=(150, 96, 52, 255))
    return im


def armory():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((20, 30, 236, 50), fill=(90, 60, 36, 255))
    d.rectangle((30, 180, 226, 230), fill=(80, 54, 32, 255))
    for x, col in ((50, (180, 186, 190)), (110, (160, 166, 172)), (170, (190, 170, 60))):
        d.polygon([(x, 48), (x + 16, 48), (x + 10, 190)], fill=col + (255,))
        d.rectangle((x - 10, 70, x + 26, 82), fill=(140, 144, 150, 255))
    return im


def infirm():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((24, 90, 232, 200), fill=(150, 100, 60, 255))
    d.rectangle((36, 104, 220, 186), fill=(236, 232, 220, 255))
    d.ellipse((40, 70, 110, 120), fill=(250, 246, 236, 255))
    d.rectangle((150, 120, 210, 150), fill=(180, 40, 40, 255))
    d.rectangle((40, 196, 54, 246), fill=(90, 60, 36, 255))
    d.rectangle((202, 196, 216, 246), fill=(90, 60, 36, 255))
    return im


def guestbed():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((30, 20, 226, 36), fill=(40, 70, 120, 255))
    for x in (36, 206):
        d.rectangle((x, 32, x + 12, 236), fill=(90, 60, 36, 255))
    d.rectangle((44, 110, 212, 210), fill=(50, 90, 150, 255))
    d.rectangle((56, 124, 200, 196), fill=(80, 120, 180, 255))
    d.ellipse((60, 90, 120, 130), fill=(230, 224, 210, 255))
    d.polygon([(30, 36), (226, 36), (200, 86), (56, 86)], fill=(30, 50, 90, 160))
    return im


def sewerarch():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((16, 20, 240, 248), fill=(72, 78, 84, 255))
    d.pieslice((40, 40, 216, 230), 200, 340, fill=(16, 24, 28, 255))
    d.rectangle((40, 140, 216, 240), fill=(20, 70, 60, 255))
    d.rectangle((40, 150, 216, 168), fill=(40, 120, 90, 180))
    return im


def runepillar():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((90, 24, 166, 236), fill=(40, 48, 70, 255))
    d.rectangle((78, 16, 178, 36), fill=(30, 36, 54, 255))
    d.rectangle((74, 220, 182, 248), fill=(30, 36, 54, 255))
    d.polygon([(128, 60), (150, 100), (128, 140), (106, 100)], fill=(80, 180, 255, 255))
    d.ellipse((112, 150, 144, 182), fill=(60, 220, 200, 255))
    d.rectangle((110, 186, 146, 198), fill=(80, 160, 255, 255))
    return im


def planter():
    im = cell(); d = ImageDraw.Draw(im)
    d.polygon([(50, 140), (206, 140), (186, 230), (70, 230)], fill=(130, 84, 48, 255))
    d.ellipse((40, 50, 120, 150), fill=(40, 130, 60, 255))
    d.ellipse((100, 30, 200, 140), fill=(50, 150, 70, 255))
    d.ellipse((80, 70, 160, 150), fill=(70, 170, 80, 255))
    for x, y, c in ((90, 70, (220, 60, 70)), (140, 50, (240, 180, 60)), (120, 100, (200, 80, 180))):
        d.ellipse((x, y, x + 22, y + 22), fill=c + (255,))
    return im


def desk():
    im = cell(); d = ImageDraw.Draw(im)
    d.rectangle((16, 120, 240, 170), fill=(120, 76, 42, 255))
    d.rectangle((28, 168, 48, 240), fill=(80, 50, 30, 255))
    d.rectangle((208, 168, 228, 240), fill=(80, 50, 30, 255))
    d.rectangle((40, 80, 120, 118), fill=(230, 220, 190, 255))
    d.rectangle((130, 90, 210, 116), fill=(40, 70, 130, 255))
    d.polygon([(150, 40), (190, 50), (170, 90)], fill=(200, 40, 40, 255))
    return im


def telescope():
    im = cell(); d = ImageDraw.Draw(im)
    d.polygon([(110, 200), (146, 200), (170, 248), (86, 248)], fill=(70, 72, 78, 255))
    d.polygon([(70, 150), (200, 70), (214, 90), (84, 170)], fill=(150, 120, 50, 255))
    d.ellipse((186, 48, 230, 92), fill=(80, 140, 190, 255))
    d.ellipse((60, 150, 96, 186), fill=(90, 70, 36, 255))
    return im


def flight():
    im = cell(); d = ImageDraw.Draw(im)
    n = 8
    for i in range(n):
        x0 = 6 + i * 30
        y0 = 228 - i * 26
        d.polygon([(x0, y0 + 10), (x0 + 40, y0), (x0 + 40, y0 + 28), (x0, y0 + 38)], fill=(132, 122, 110, 255))
        d.polygon([(x0, y0 + 10), (x0 + 40, y0), (x0 + 40, y0 + 8), (x0, y0 + 18)], fill=(214, 202, 176, 255))
        d.line((x0, y0 + 10, x0 + 40, y0), fill=(186, 146, 58, 255), width=3)
        d.line((x0 + 40, y0, x0 + 40, y0 + 28), fill=(90, 82, 74, 255), width=2)
    return im


def main():
    names = [
        drape, curtain, column, grandthrone, shelfwall, warmap, council, hearth,
        canopy, stores, prison, magewell, hoard, dais, knight, bower,
        oaktree, feast, rosewin, pews, armory, infirm, guestbed, sewerarch,
        runepillar, planter, desk, telescope, flight,
    ]
    cols = 8
    sheet = Image.new("RGBA", (S * cols, S * ((len(names) + cols - 1) // cols)), (0, 0, 0, 0))
    for i, fn in enumerate(names):
        im = fn()
        sheet.paste(im, ((i % cols) * S, (i // cols) * S), im)
    sheet.save(OUT)
    print(OUT, sheet.size, len(names))


if __name__ == "__main__":
    main()

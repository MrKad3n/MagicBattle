"""Palette-compress the mini-boss sheets (256 colours with alpha). Run after build.js.
   python3 tools/miniboss-art/shrink.py"""
import os, glob
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
for f in sorted(glob.glob(os.path.join(here, '..', '..', 'images', 'minibosses', '*.png'))):
    im = Image.open(f).convert('RGBA')
    q = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(f, 'PNG', optimize=True)
    print(os.path.basename(f), os.path.getsize(f) // 1024, 'KB')

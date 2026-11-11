#!/usr/bin/env python3
"""Кадры шотов без сборки ролика: по 3 кадра (30 %, 62 %, 93 % длины) на шот, листами по 6 шотов.

    python3 scripts/stills.py videos/<имя> ['s3_|s7_']   # сначала scripts/check.py — он собирает план

Листы: videos/<имя>/review/stills_<N>.png. Смотри их сам (наложения, обрезки, пустые кадры, мелкий текст).
"""
import glob, os, subprocess, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vid = os.path.abspath(sys.argv[1]); reel = os.path.join(vid, "reel"); rx = sys.argv[2] if len(sys.argv) > 2 else "."
st = os.path.join(reel, "build", "stills"); os.makedirs(st, exist_ok=True)
for f in glob.glob(os.path.join(st, "*.png")): os.remove(f)
subprocess.run(["node", "render_stage.js", rx, "--still"], cwd=os.path.join(ROOT, "engine"), env=dict(os.environ, VIDEO=reel, STILL_AT="0.3,0.62,0.93"), check=True, stdout=subprocess.DEVNULL)
import json
have = {os.path.basename(f).rsplit("_p", 1)[0] for f in glob.glob(os.path.join(st, "*_p0.png"))}
ids = [s["id"] for s in json.load(open(os.path.join(reel, "build", "timing.json"), encoding="utf-8"))["shots"] if s["id"] in have]
out = os.path.join(vid, "review"); os.makedirs(out, exist_ok=True)
W, H = 480, 444
for k in range(0, len(ids), 6):
    part = ids[k:k + 6]; sh = Image.new("RGB", (W * 3, H * len(part)), "black"); dr = ImageDraw.Draw(sh)
    for r, i in enumerate(part):
        for c in range(3):
            p = os.path.join(st, f"{i}_p{c}.png")
            if os.path.exists(p): sh.paste(Image.open(p).convert("RGB").resize((W, H)), (c * W, r * H))
            dr.text((c * W + 6, r * H + 4), f"{i}  {['30%', '62%', '93%'][c]}", fill="red")
        dr.line([(0, r * H), (W * 3, r * H)], fill="black", width=3)
    fn = os.path.join(out, f"stills_{k // 6 + 1}.png"); sh.save(fn); print(fn)

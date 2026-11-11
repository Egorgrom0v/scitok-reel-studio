"""Step 7: contact sheet: frame of every shot at max(mid, anchor+0.4 s), 7 per row, with timecode -> contact_sheet.jpg; prints pacing stats."""
import json, os, subprocess, statistics
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from common import BUILD as B, VIDEO, OUT_MP4
VID = os.environ.get("OUT", OUT_MP4)
T = json.load(open(os.path.join(B, "timing.json")))
TW, TH, COLS = 300, 533, 7
shots = T["shots"]; rows = (len(shots) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * TW + (COLS + 1) * 10, rows * (TH + 44) + 10), (20, 22, 26))
d = ImageDraw.Draw(sheet); f = ImageFont.truetype(os.path.join(B, "fonts", "JBM-700.ttf"), 18)
for i, sh in enumerate(shots):
    fm = min(sh["f1"] - 1, max((sh["f0"] + sh["f1"]) // 2, round((sh["anchor"] + 0.4) * 30)))   # after the anchor: main element is on screen
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", VID, "-vf", f"select=eq(n\\,{fm}),scale={TW}:{TH}", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    im = Image.fromarray(np.frombuffer(raw, np.uint8).reshape(TH, TW, 3))
    x = 10 + (i % COLS) * (TW + 10); y = 10 + (i // COLS) * (TH + 44)
    sheet.paste(im, (x, y + 34))
    t = fm / 30
    d.text((x, y + 8), f"{sh['id']}  {int(t // 60):02d}:{t % 60:05.2f}  {(sh['f1'] - sh['f0']) / 30:.2f}s", font=f, fill=(230, 230, 230))
out = os.path.join(VIDEO, "contact_sheet.jpg"); sheet.save(out, quality=88)
durs = [(s["f1"] - s["f0"]) / 30 for s in shots]
cuts3 = sum(1 for s in shots[1:] if s["t0"] < 3.0)
print(f"shots {len(shots)}, total {T['frames'] / 30:.2f}s, median shot {statistics.median(durs):.2f}s, mean {statistics.mean(durs):.2f}s, "
      f"cuts/min {(len(shots) - 1) / (T['frames'] / 30) * 60:.1f}, cuts in first 3s: {cuts3}")
print("saved", out)

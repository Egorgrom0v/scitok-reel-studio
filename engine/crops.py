"""Step 3: paper crops at 300 dpi + highlight rects -> build/crops/*.png, build/crops.json.
Helpers below; WHAT to crop is defined per video in <video>/crops.py (executed with these helpers in scope)."""
import pymupdf as fitz, json, os
from common import VIDEO, BUILD, pdf_path
OUT = os.path.join(BUILD, "crops"); os.makedirs(OUT, exist_ok=True)
S = 300 / 72
spec = os.path.join(VIDEO, "crops.py")
if not os.path.exists(spec):
    json.dump({}, open(os.path.join(BUILD, "crops.json"), "w")); print("no crops.py — no paper crops"); raise SystemExit(0)
doc = fitz.open(pdf_path())


def U(rects):
    r = fitz.Rect(rects[0])
    for x in rects[1:]: r |= x
    return r


def find(pg, q, idx=None):
    rs = doc[pg - 1].search_for(q)
    assert rs, f"text not found on page {pg}: {q!r}"
    return rs if idx is None else [rs[idx]]


def words_in(pg, clip):
    return [w for w in doc[pg - 1].get_text("words") if fitz.Rect(w[:4]).intersects(clip)]


def word(pg, text, clip=None, n=0):
    ws = [w for w in doc[pg - 1].get_text("words") if w[4] == text and (clip is None or fitz.Rect(w[:4]).intersects(clip))]
    assert ws, f"word not found on page {pg}: {text!r}"
    return fitz.Rect(ws[n][:4])


crops = {}


def crop(name, pg, clip, hls, rotate=0, pad=2.5, label=""):
    clip = fitz.Rect(clip)
    page = doc[pg - 1]
    pix = page.get_pixmap(dpi=300, clip=clip)
    p = os.path.join(OUT, name + ".png"); pix.save(p)
    W, H = pix.width, pix.height
    boxes = []
    for h in hls:
        groups = h if isinstance(h, list) else [h]
        r = U([fitz.Rect(g) for g in groups])
        x0, y0, x1, y1 = (r.x0 - pad - clip.x0) * S, (r.y0 - pad - clip.y0) * S, (r.x1 + pad - clip.x0) * S, (r.y1 + pad - clip.y0) * S
        boxes.append([x0, y0, x1, y1])
    if rotate == 90:  # rotate clockwise (figures printed sideways)
        from PIL import Image
        im = Image.open(p).transpose(Image.Transpose.ROTATE_270); im.save(p)
        boxes = [[H - y1, x0, H - y0, x1] for x0, y0, x1, y1 in boxes]
        W, H = H, W
    crops[name] = {"file": f"crops/{name}.png", "w": W, "h": H, "boxes": [[round(v) for v in b] for b in boxes], "label": label}


if True:
    exec(compile(open(spec, encoding="utf-8").read(), spec, "exec"),
         {"doc": doc, "fitz": fitz, "find": find, "word": word, "words_in": words_in, "U": U, "crop": crop, "__name__": "crops_spec"})
json.dump(crops, open(os.path.join(BUILD, "crops.json"), "w"), ensure_ascii=False, indent=1)
for k, v in crops.items(): print(k, v["w"], v["h"], v["boxes"])

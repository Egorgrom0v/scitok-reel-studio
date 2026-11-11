"""Step 2: merge fontsource woff2 subsets into TTFs for PIL; write fonts.css for HTML; check glyph coverage."""
import os, glob
from fontTools.ttLib import TTFont
from fontTools.merge import Merger
from common import KIT, BUILD
NM = os.path.join(KIT, "node_modules", "@fontsource")
OUT = os.path.join(BUILD, "fonts"); os.makedirs(OUT, exist_ok=True)
SUBS = ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek", "greek-ext"]
SPEC = [("fira-sans", "Fira", 400, "normal"), ("fira-sans", "Fira", 800, "normal"), ("fira-sans", "Fira", 800, "italic"),
        ("fira-sans", "Fira", 400, "italic"),
        ("jetbrains-mono", "JBM", 500, "normal"), ("jetbrains-mono", "JBM", 700, "normal"),
        ("inter", "Inter", 400, "normal"), ("inter", "Inter", 600, "normal"), ("inter", "Inter", 800, "normal")]
NEED = "×²¹⁹⁰·–—ёЁ«»αβσΔ"
css = []
for pkg, fam, w, st in SPEC:
    srcs = []
    for sub in SUBS:
        p = os.path.join(NM, pkg, "files", f"{pkg}-{sub}-{w}-{st}.woff2")
        if os.path.exists(p): srcs.append(p)
    tmp = []
    for p in srcs:
        f = TTFont(p); f.flavor = None
        t = os.path.join(OUT, os.path.basename(p).replace(".woff2", ".ttf")); f.save(t); tmp.append(t)
    m = Merger(); merged = m.merge(tmp)
    out = os.path.join(OUT, f"{fam}-{w}{'i' if st == 'italic' else ''}.ttf"); merged.save(out)
    for t in tmp: os.remove(t)
    cmap = TTFont(out).getBestCmap()
    miss = [c for c in NEED if ord(c) not in cmap]
    print(os.path.basename(out), "missing:", "".join(miss) or "none")
    css.append(f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:{st};src:url('fonts/{os.path.basename(out)}') format('truetype');}}")
# symbol fallback (→ ≈ ≤ ≥ ☉ ⊙ ± √ ∞ …): Noto Sans Math, used by the browser when Fira/JBM lack a glyph
sym_src = os.path.join(NM, "noto-sans-math", "files", "noto-sans-math-latin-400-normal.woff2")
SYM = set()
if os.path.exists(sym_src):
    f = TTFont(sym_src); f.flavor = None; sym_out = os.path.join(OUT, "Sym-400.ttf"); f.save(sym_out)
    SYM = set(TTFont(sym_out).getBestCmap().keys())
    for w in (400, 500, 700, 800):
        css.append(f"@font-face{{font-family:'Sym';font-weight:{w};src:url('fonts/Sym-400.ttf') format('truetype');}}")
else:
    print("!! symbol fallback font missing: run bash setup.sh")
open(os.path.join(BUILD, "fonts.css"), "w").write("\n".join(css))
import json
common = None
for fn in glob.glob(os.path.join(OUT, "*.ttf")):
    if os.path.basename(fn).startswith(("Sym", "Inter")): continue
    cm = set(TTFont(fn).getBestCmap().keys()); common = cm if common is None else common & cm
common |= SYM
json.dump(sorted(common), open(os.path.join(BUILD, "glyphs.json"), "w"))

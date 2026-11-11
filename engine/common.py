"""Shared paths and config for the SciTok engine.

Every engine script works on one video folder:  VIDEO=videos/<slug>  (env var, or first CLI arg).
Video folder layout (written by the chat that makes the video):
  video.json        meta: titles, credit, voice, avatar, options (see engine/README.md)
  storyboard.json   scenes -> shots (text, tts, accent, beat, shots[share, source, visual, anchor_word, badge, sfx, note])
  crops.py          which places of the PDF to crop/highlight (uses helpers from engine/crops.py)
  shots.js          SH.<shot_id> = () => {...} stage animations (uses engine/lib.js)
  *.pdf             the paper
Build output goes to <video>/build/, final mp4 and contact sheet to <video>/.
"""
import json, os, sys

ENGINE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.dirname(ENGINE)


def _video_dir():
    v = os.environ.get("VIDEO")
    if not v:
        args = [a for a in sys.argv[1:] if not a.startswith("-")]
        v = args[0] if args else None
    if not v:
        sys.exit("set VIDEO=videos/<slug> (or pass the video folder as the first argument)")
    v = os.path.abspath(v)
    if not os.path.isfile(os.path.join(v, "video.json")):
        sys.exit(f"no video.json in {v}")
    return v


VIDEO = _video_dir()
BUILD = os.path.join(VIDEO, "build")
os.makedirs(BUILD, exist_ok=True)
CFG = json.load(open(os.path.join(VIDEO, "video.json"), encoding="utf-8"))
SLUG = CFG.get("slug") or os.path.basename(VIDEO)
OUT_MP4 = os.path.join(VIDEO, CFG.get("output", SLUG + ".mp4"))
FPS = 30


def storyboard():
    return json.load(open(os.path.join(VIDEO, "storyboard.json"), encoding="utf-8"))


def pdf_path():
    import glob
    p = CFG.get("pdf")
    if p:
        return p if os.path.isabs(p) else os.path.join(VIDEO, p)
    pdfs = sorted(glob.glob(os.path.join(VIDEO, "*.pdf")))
    if not pdfs:
        sys.exit("no PDF: put the paper into the video folder or set \"pdf\" in video.json")
    return pdfs[0]


def avatar_dir():
    """Folder with avatar mp4 clips: env AVATAR_DIR > video.json "avatar_dir" (relative to the video) > <kit>/avatar."""
    cands = [os.environ.get("AVATAR_DIR")]
    if CFG.get("avatar_dir"):
        a = CFG["avatar_dir"]
        cands.append(a if os.path.isabs(a) else os.path.join(VIDEO, a))
    cands.append(os.path.join(KIT, "avatar"))
    for c in cands:
        if c and os.path.isdir(c):
            return c
    return None

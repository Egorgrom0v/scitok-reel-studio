"""Step 6 (horizontal): 1920x1080 — stage left, avatar full-height strip right, subtitles under the stage. Based on compose.py.
Old doc: frame-by-frame composite 1080x1920, layout v8, mux with build/mix.wav.
Layout v8 (default): stage (animation) on top, enlarged; avatar full-width on the bottom ~half; subtitles over the avatar.
No header, progress bar, kicker, badge row or credit block (badge/note stay in storyboard.json for the report, not on screen).
Config (video.json): theme "light"|"dark" (default light), stage_zoom (default 1.12), avatar_h (default 900),
subtitles "seam"|"avatar"|"off" (default seam: on the border between stage and avatar), xfade [shot ids]."""
import json, os, subprocess, glob, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from common import BUILD as B, CFG, OUT_MP4, avatar_dir
AVA_DIR = avatar_dir()
OUT = os.environ.get("OUT", OUT_MP4)
T = json.load(open(os.path.join(B, "timing.json")))
FPS = 30; W, H = 1920, 1080; NF = T["frames"]
F = os.path.join(B, "fonts")
def font(name, size): return ImageFont.truetype(os.path.join(F, name), size)
THEME = os.environ.get("THEME") or CFG.get("theme", "light")
if THEME == "light":
    BG = (244, 244, 246); INK = (29, 29, 31); PANEL = (255, 255, 255)
else:
    BG = (7, 9, 13); INK = (242, 244, 247); PANEL = (14, 19, 27)
WHITE = (255, 255, 255); SUB_BLUE = (0, 113, 227); SUB_RED = (227, 52, 47)   # subtitles sit on video: bright accents + dark outline

# ---------- geometry ----------
AW = int(CFG.get("avatar_w", 640)); AX = W - AW; AH = H     # avatar: full-height strip on the right
SRC_Y0, SRC_H = 96, 904
ZS = float(CFG.get("stage_zoom_h", 0.94))
SW = int(round(1080 * ZS / 2) * 2); SH_ = int(round(SRC_H * ZS / 2) * 2)
SX = (AX - SW) // 2; SY = int(CFG.get("stage_y", 34))
base = Image.new("RGB", (W, H), BG)
BASE = np.array(base)
# soft fade from background into the avatar's top edge (video.json "avatar_fade": false turns it off)
FADE = 0
fade_a = np.linspace(1.0, 0.0, FADE, dtype=np.float32)[:, None, None]

# ---------- subtitles ----------
SHORT = {"a", "the", "of", "to", "and", "in", "on", "with", "by", "for", "at", "an", "from", "that", "as", "а", "и", "в", "на", "к", "с", "о", "у", "до", "по", "за", "из", "от", "не", "что", "её", "это", "как", "тем"}
FS = int(CFG.get("sub_size_h", 44)); FA = FS
fsub = font("Inter-600.ttf", FS); fsubA = font("Inter-800.ttf", FA)
tmpd = ImageDraw.Draw(Image.new("RGB", (10, 10)))
def wlen(w): return len(w)
stacks = []  # {scene, t_on, t_off, lines:[[word idx]], words:[{w,t0,acc}]}
for i, sc in enumerate(T["scenes"]):
    words = sc["words"]; acc_done = False; ws = []
    for w in words:
        a = (not acc_done) and re.sub(r"[^\wё]", "", w["w"].lower()) == re.sub(r"[^\wё]", "", sc["accent"].lower())
        if a: acc_done = True
        ws.append({"w": w["w"], "t0": w["t0"], "acc": a})
    assert acc_done, ("accent not found", sc["id"])
    # punctuation from the original subtitle (same tokenisation as tts.py, keeping marks)
    raw = sc["subtitle"].replace("«", "").replace("»", "").replace(" —", "—").replace(" –", "–").split()
    assert len(raw) == len(ws), (sc["id"], raw, [w["w"] for w in ws])
    endp = [2 if x[-1] in ".?!" else 1 if x[-1] in ",:;—–" else 0 for x in raw]
    for w_, r_ in zip(ws, raw): w_["w"] = r_
    n = len(ws); L = lambda a, b: sum(wlen(ws[k]["w"]) for k in range(a, b)) + (b - a - 1)
    def lcost(a, b):
        l = L(a, b)
        if l > 46: return 1e9
        c = (44 - l) ** 2 + (120 * (l - 44) if l > 44 else 0)
        if b < n and ws[b - 1]["w"].lower() in SHORT: c += 2000
        if b < n: c -= {0: 0, 1: 40, 2: 400}[endp[b - 1]]
        return c
    best = [0] + [1e18] * n; prv = [0] * (n + 1)
    for b_ in range(1, n + 1):
        for a_ in range(b_):
            c = best[a_] + lcost(a_, b_)
            if c < best[b_]: best[b_] = c; prv[b_] = a_
    cuts = []; x = n
    while x > 0: cuts.append((prv[x], x)); x = prv[x]
    lines = [list(range(a_, b_)) for a_, b_ in reversed(cuts)]
    # group lines into stacks of <=2, preferring stack breaks at sentence ends
    m = len(lines); sb = [0] + [1e18] * m; sp = [0] * (m + 1)
    for j in range(1, m + 1):
        for g in (1, 2):
            i0 = j - g
            if i0 < 0: continue
            c = sb[i0] + (70 if g == 1 else 0)
            if j < m: c -= {0: 0, 1: 15, 2: 120}[endp[lines[j - 1][-1]]]
            if c < sb[j]: sb[j] = c; sp[j] = i0
    grps = []; x = m
    while x > 0: grps.append(lines[sp[x]:x]); x = sp[x]
    grps.reverse()
    t_end = T["scenes"][i + 1]["t0"] if i + 1 < len(T["scenes"]) else NF / FPS + 1
    for gi, grp in enumerate(grps):
        t_on = ws[grp[0][0]]["t0"]
        nxt = grps[gi + 1][0][0] if gi + 1 < len(grps) else None
        t_off = ws[nxt]["t0"] if nxt is not None else t_end
        stacks.append({"scene": sc["id"], "beat": sc["beat"], "t_on": t_on, "t_off": t_off, "lines": grp, "ws": ws})
SUB_MODE = CFG.get("subtitles", "seam")      # seam: centred on the stage/avatar border · avatar: low on the avatar · off
SUB_H = 150; SUB_W = AX
SUB_Y0 = SY + SH_ + (H - SY - SH_ - SUB_H) // 2
def render_stack(st, t):
    im = Image.new("RGBA", (SUB_W, SUB_H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    accc = SUB_RED if st["beat"] in ("ПРОБЛЕМА", "ОГРАНИЧЕНИЕ") else SUB_BLUE
    n = len(st["lines"]); lh = 60; cy = SUB_H // 2
    ys = [cy] if n == 1 else [cy - lh / 2, cy + lh / 2]
    for li, ln in enumerate(st["lines"]):
        parts = [(st["ws"][k], fsubA if st["ws"][k]["acc"] else fsub) for k in ln]
        sp = d.textlength(" ", font=fsub)
        tw = sum(d.textlength(w["w"], font=f) for w, f in parts) + sp * (len(parts) - 1)
        x = SUB_W / 2 - tw / 2
        for w, f in parts:
            if w["t0"] <= t + 1e-6:
                col = accc if w["acc"] else INK
                d.text((x, ys[li]), w["w"], font=f, fill=col, anchor="lm")
            else:
                d.text((x, ys[li]), w["w"], font=f, fill=(29, 29, 31, 46), anchor="lm")
            x += d.textlength(w["w"], font=f) + sp
    return np.array(im)
def blend(dst, rgba, x, y):
    h, w = rgba.shape[:2]; a = rgba[..., 3:4].astype(np.float32) / 255.0
    reg = dst[y:y + h, x:x + w].astype(np.float32)
    dst[y:y + h, x:x + w] = (reg * (1 - a) + rgba[..., :3].astype(np.float32) * a).astype(np.uint8)

# ---------- inputs ----------
AVA_CROP_Y = float(CFG.get("avatar_crop_y", 0.08))   # where the 900-px window starts in the scaled avatar video (0 = top)
def avatar_crop():
    return f"scale=-2:{AH}:flags=lanczos,crop={AW}:{AH}:(iw-{AW})/2:0,fps=30"
def synced_avatar():
    """Real avatar synced to the voice: videos/<slug>/avatar.mp4 (or video.json "avatar_file").
    Starts at t=0 together with voice.mp3, played once (no loop); the last frame is held if it is shorter."""
    from common import VIDEO
    f = CFG.get("avatar_file") or "avatar.mp4"
    p = f if os.path.isabs(f) else os.path.join(VIDEO, f)
    return p if os.path.exists(p) else None
def avatar_source():
    sync = synced_avatar()
    if sync:
        out = os.path.join(B, "avatar_sync_h.mp4")
        if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(sync):
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", sync, "-an", "-vf", avatar_crop() + f",tpad=stop_mode=clone:stop_duration={NF / FPS + 2}",
                            "-frames:v", str(NF), "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", out], check=True)
        print("avatar: synced", os.path.basename(sync))
        return out, False
    out = os.path.join(B, "avatar_loop_h.mp4")
    clips = sorted(glob.glob(os.path.join(AVA_DIR, "*.mp4"))) if AVA_DIR else []
    if not clips:  # no avatar clips: placeholder card
        if not os.path.exists(out):
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=0x{'D9DEE5' if THEME == 'light' else '0E131B'}:s={AW}x{AH}:r=30:d=5",
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", out], check=True)
        return out, True
    if not os.path.exists(out):
        lst = os.path.join(B, "avatar_list.txt"); open(lst, "w").write("".join(f"file '{c}'\n" for c in clips))
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-an", "-vf", avatar_crop(), "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", out], check=True)
    print("avatar: looped placeholder clips")
    return out, True
_ava_src, _ava_loop = avatar_source()
ava = subprocess.Popen(["ffmpeg", "-v", "error"] + (["-stream_loop", "-1"] if _ava_loop else []) + ["-i", _ava_src, "-frames:v", str(NF), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
lst = os.path.join(B, "shots_list.txt"); open(lst, "w").write("".join(f"file '{os.path.join(B, 'shots', s['id'] + '.mp4')}'\n" for s in T["shots"]))
stg = subprocess.Popen(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
                        "-vf", f"crop=1080:{SRC_H}:0:{SRC_Y0},scale={SW}:{SH_}:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                        "-i", os.path.join(B, "mix.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
# shot "bottom": "<media id>" — videos/<slug>/media/<id>.mp4 plays in the avatar zone instead of the avatar for that shot
from common import VIDEO
_bot = {"id": None, "proc": None}
def bottom_frame(sh, k):
    mid = sh.get("bottom")
    if not mid:
        if _bot["proc"]: _bot["proc"].kill(); _bot.update(id=None, proc=None)
        return None
    if _bot["id"] != sh["id"]:
        if _bot["proc"]: _bot["proc"].kill()
        src = next((p for p in glob.glob(os.path.join(VIDEO, "media", mid + ".*")) if p.endswith((".mp4", ".mov", ".webm"))), None)
        if not src: print("!! bottom media not found:", mid); return None
        n = sh["f1"] - sh["f0"]; bh = int(sh.get("bottom_h", AH)); mz = float(CFG.get("media_zoom", 1.02))
        vf = (f"scale={int(W * mz)}:{int(bh * mz)}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{bh},fps={FPS},"
              f"tpad=stop_mode=clone:stop_duration=10")
        _bot.update(id=sh["id"], proc=subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-an", "-vf", vf, "-frames:v", str(n), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE))
    bh = int(sh.get("bottom_h", AH)); buf = _bot["proc"].stdout.read(W * bh * 3)
    return np.frombuffer(buf, np.uint8).reshape(bh, W, 3) if len(buf) == W * bh * 3 else None
XFADE = set(CFG.get("xfade", []))  # same background, continuation of one scheme
shot_of = [];
for s in T["shots"]: shot_of += [s] * (s["f1"] - s["f0"])
scene_idx = {sc["id"]: i for i, sc in enumerate(T["scenes"])}
SS = SW * SH_ * 3; AA = AW * AH * 3
prev_last = None; cache_key = None; cache_img = None
for f in range(NF):
    t = f / FPS; sh = shot_of[f]
    sbuf = stg.stdout.read(SS); abuf = ava.stdout.read(AA)
    stage = np.frombuffer(sbuf, np.uint8).reshape(SH_, SW, 3)
    k = f - sh["f0"]
    if sh["id"] in XFADE and k < 5 and prev_last is not None:
        a = (k + 1) / 6.0; stage = (stage.astype(np.float32) * a + prev_last.astype(np.float32) * (1 - a)).astype(np.uint8)
    if f == sh["f1"] - 1: prev_last = stage.copy()
    fr = BASE.copy()
    fr[SY:SY + SH_, SX:SX + SW] = stage
    av = np.frombuffer(abuf, np.uint8).reshape(AH, AW, 3)
    fr[:, AX:] = av
    if SUB_MODE == "off": enc.stdin.write(fr.tobytes()); continue
    st = next((s for s in stacks if s["t_on"] - 1e-6 <= t < s["t_off"]), None)
    if st is None:  # gap between scenes: keep previous scene's last stack
        prev = [s for s in stacks if s["t_on"] <= t]; st = prev[-1] if prev else None
    if st is not None:
        nvis = sum(1 for ln in st["lines"] for k2 in ln if st["ws"][k2]["t0"] <= t + 1e-6)
        key = (id(st), nvis)
        if key != cache_key: cache_img = render_stack(st, t); cache_key = key
        blend(fr, cache_img, 0, SUB_Y0)
    enc.stdin.write(fr.tobytes())
enc.stdin.close(); enc.wait(); stg.wait(); ava.wait()
json.dump([{"scene": s["scene"], "t_on": round(s["t_on"], 2), "lines": [" ".join(s["ws"][k]["w"] for k in ln) for ln in s["lines"]]} for s in stacks],
          open(os.path.join(B, "subs.json"), "w"), ensure_ascii=False, indent=1)
print("written", OUT)

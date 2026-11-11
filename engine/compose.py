"""Step 6: frame-by-frame composite 1080x1920, layout v8, mux with build/mix.wav.
Layout v8 (default): stage (animation) on top, enlarged; avatar full-width on the bottom ~half; subtitles over the avatar.
No header, progress bar, kicker, badge row or credit block (badge/note stay in storyboard.json for the report, not on screen).
Config (video.json): theme "light"|"dark" (default light), stage_zoom (default 1.12), avatar_h (default 860),
subtitles "seam"|"avatar"|"off" (default seam: on the border between stage and avatar), xfade [shot ids].
Avatar: avatar_mode "loop" (default: clips from avatar_dir concatenated and looped — kit / drafts) or "sync" (production:
one lip-synced track "avatar_file", default avatar.mp4, made for this voice; played once, its length must equal the video ± 1 frame,
override the tolerance with "avatar_tolerance_frames")."""
import json, os, subprocess, glob, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from common import BUILD as B, CFG, OUT_MP4, avatar_dir
AVA_DIR = avatar_dir()
OUT = os.environ.get("OUT", OUT_MP4)
T = json.load(open(os.path.join(B, "timing.json")))
FPS = 30; W, H = 1080, 1920; NF = T["frames"]
F = os.path.join(B, "fonts")
def font(name, size): return ImageFont.truetype(os.path.join(F, name), size)
THEME = os.environ.get("THEME") or CFG.get("theme", "light")
if THEME == "light":
    BG = (244, 245, 247); INK = (17, 21, 27); PANEL = (255, 255, 255)
else:
    BG = (7, 9, 13); INK = (242, 244, 247); PANEL = (14, 19, 27)
WHITE = (255, 255, 255); SUB_BLUE = (92, 156, 255); SUB_RED = (255, 98, 86)   # subtitles sit on video: bright accents + dark outline

# ---------- geometry ----------
AH = int(CFG.get("avatar_h", 860)); AY = H - AH            # avatar: full width, bottom (31.10: 900 -> 860, the stage gets 40 px)
ZS = float(CFG.get("stage_zoom", 1.12))                    # stage: drop the old kicker zone (top 96 px of 1000) and enlarge
SRC_Y0, SRC_H = 96, 904
SW = int(round(1080 * ZS / 2) * 2); SH_ = int(round(SRC_H * ZS / 2) * 2)
SH_ = min(SH_, AY)                                          # never overlap the avatar
if CFG.get("stage_fill", True) and SH_ < AY:              # fill the whole space above the avatar (no light strips)
    SH_ = AY; SW = int(round(1080 * AY / SRC_H / 2) * 2)
SX = (SW - 1080) // 2
SY = max(0, (AY - SH_) // 2)                                # centred in the space above the avatar

base = Image.new("RGB", (W, H), BG)
BASE = np.array(base)
# a hard border between the stage and the avatar (Egor 31.10); video.json "avatar_fade": true brings back the soft fade
FADE = 48 if CFG.get("avatar_fade", False) else 0
fade_a = np.linspace(1.0, 0.0, FADE, dtype=np.float32)[:, None, None]

# ---------- subtitles ----------
SHORT = {"а", "и", "в", "на", "к", "с", "о", "у", "до", "по", "за", "из", "от", "не", "что", "её", "это", "как", "тем"}
FS = 58; FA = int(FS * 1.1)
fsub = font("Fira-800.ttf", FS); fsubA = font("Fira-800.ttf", FA)
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
    n = len(ws); L = lambda a, b: sum(wlen(ws[k]["w"]) for k in range(a, b)) + (b - a - 1)
    def lcost(a, b):
        l = L(a, b)
        if l > 26: return 1e9
        c = (25 - l) ** 2 + (120 * (l - 25) if l > 25 else 0)
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
SUB_H = 200
SUB_Y0 = (AY - SUB_H // 2 + 20) if SUB_MODE == "seam" else (H - 150 - SUB_H // 2 - 40)
def render_stack(st, t):
    im = Image.new("RGBA", (W, SUB_H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    accc = SUB_RED if st["beat"] in ("ПРОБЛЕМА", "ОГРАНИЧЕНИЕ") else SUB_BLUE
    n = len(st["lines"]); lh = 74; cy = SUB_H // 2
    ys = [cy] if n == 1 else [cy - lh / 2, cy + lh / 2]
    for li, ln in enumerate(st["lines"]):
        parts = [(st["ws"][k], fsubA if st["ws"][k]["acc"] else fsub) for k in ln]
        sp = d.textlength(" ", font=fsub)
        tw = sum(d.textlength(w["w"], font=f) for w, f in parts) + sp * (len(parts) - 1)
        x = W / 2 - tw / 2
        for w, f in parts:
            if w["t0"] <= t + 1e-6:
                col = accc if w["acc"] else WHITE
                d.text((x, ys[li]), w["w"], font=f, fill=col, anchor="lm", stroke_width=6, stroke_fill=(0, 0, 0, 235))
            x += d.textlength(w["w"], font=f) + sp
    return np.array(im)
def blend(dst, rgba, x, y):
    h, w = rgba.shape[:2]; a = rgba[..., 3:4].astype(np.float32) / 255.0
    reg = dst[y:y + h, x:x + w].astype(np.float32)
    dst[y:y + h, x:x + w] = (reg * (1 - a) + rgba[..., :3].astype(np.float32) * a).astype(np.uint8)

# ---------- inputs ----------
AVA_CROP_Y = float(CFG.get("avatar_crop_y", 0.08))   # where the 900-px window starts in the scaled avatar video (0 = top)
def avatar_crop():
    return f"scale={W}:-2:flags=lanczos,crop={W}:{AH}:0:'min(ih-{AH},ih*{AVA_CROP_Y})',fps=30"
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
        out = os.path.join(B, "avatar_sync.mp4")
        if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(sync):
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", sync, "-an", "-vf", avatar_crop() + f",tpad=stop_mode=clone:stop_duration={NF / FPS + 2}",
                            "-frames:v", str(NF), "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", out], check=True)
        print("avatar: synced", os.path.basename(sync))
        return out, False
    out = os.path.join(B, "avatar_loop.mp4")
    clips = sorted(glob.glob(os.path.join(AVA_DIR, "*.mp4"))) if AVA_DIR else []
    if not clips:  # no avatar clips: placeholder card
        if not os.path.exists(out):
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=0x{'D9DEE5' if THEME == 'light' else '0E131B'}:s={W}x{AH}:r=30:d=5",
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", out], check=True)
        return out, True
    if not os.path.exists(out):
        lst = os.path.join(B, "avatar_list.txt"); open(lst, "w").write("".join(f"file '{c}'\n" for c in clips))
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-an", "-vf", avatar_crop(), "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", out], check=True)
    print("avatar: looped placeholder clips")
    return out, True
AVATAR_MODE = CFG.get("avatar_mode", "loop")
AVATAR_INFO = {"mode": AVATAR_MODE}
def probe_frames(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
                        "stream=nb_read_packets,r_frame_rate:format=duration", "-of", "json", p], capture_output=True, text=True, check=True)
    j = json.loads(r.stdout); st = j["streams"][0]; num, den = (int(x) for x in st["r_frame_rate"].split("/"))
    return int(st["nb_read_packets"]), num / den, float(j["format"]["duration"])
if AVATAR_MODE == "sync":
    src_ava = CFG.get("avatar_file", "avatar.mp4")
    src_ava = src_ava if os.path.isabs(src_ava) else os.path.join(os.path.dirname(B), src_ava)
    if not os.path.exists(src_ava): raise SystemExit(f"avatar_mode=sync: no avatar track {src_ava}")
    nfr, rate, adur = probe_frames(src_ava)
    tol = int(CFG.get("avatar_tolerance_frames", 1))
    delta = round(adur * FPS) - NF
    AVATAR_INFO.update(file=os.path.basename(src_ava), duration=round(adur, 3), frames_at_30=round(adur * FPS), video_frames=NF, delta_frames=delta)
    if abs(delta) > tol:
        raise SystemExit(f"avatar_mode=sync: avatar is {adur:.3f}s = {round(adur * FPS)} frames, video is {NF} frames "
                         f"(delta {delta}, tolerance {tol}). Render the avatar for this exact voice track (+ tail), or pad it.")
    # played once: fps=30 resamples, tpad repeats the last frame only to cover a <= tol frame shortfall
    ava = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src_ava, "-an", "-vf",
                            f"{avatar_crop()},tpad=stop_mode=clone:stop={max(tol, 1)}",
                            "-frames:v", str(NF), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
else:   # kit behaviour: avatar.mp4 next to the video if present (held last frame), else looped clips
    _ava_src, _ava_loop = avatar_source()
    ava = subprocess.Popen(["ffmpeg", "-v", "error"] + (["-stream_loop", "-1"] if _ava_loop else []) + ["-i", _ava_src, "-frames:v", str(NF), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
lst = os.path.join(B, "shots_list.txt"); open(lst, "w").write("".join(f"file '{os.path.join(B, 'shots', s['id'] + '.mp4')}'\n" for s in T["shots"]))
stg = subprocess.Popen(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
                        "-vf", f"crop=1080:{SRC_H}:0:{SRC_Y0},scale={SW}:{SH_}:flags=lanczos,crop=1080:{SH_}:{SX}:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
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
SS = 1080 * SH_ * 3; AA = W * AH * 3
prev_last = None; cache_key = None; cache_img = None
for f in range(NF):
    t = f / FPS; sh = shot_of[f]
    sbuf = stg.stdout.read(SS); abuf = ava.stdout.read(AA)
    if len(abuf) < AA:                          # avatar stream ended early: must not happen (sync is length-checked, loop is infinite)
        raise SystemExit(f"avatar stream ended at frame {f} of {NF}")
    stage = np.frombuffer(sbuf, np.uint8).reshape(SH_, 1080, 3)
    k = f - sh["f0"]
    if sh["id"] in XFADE and k < 5 and prev_last is not None:
        a = (k + 1) / 6.0; stage = (stage.astype(np.float32) * a + prev_last.astype(np.float32) * (1 - a)).astype(np.uint8)
    if f == sh["f1"] - 1: prev_last = stage.copy()
    fr = BASE.copy()
    fr[SY:SY + SH_] = stage
    av = np.frombuffer(abuf, np.uint8).reshape(AH, W, 3)
    fr[AY:] = av
    bot = bottom_frame(sh, k)
    if bot is not None: fr[H - bot.shape[0]:] = bot
    if FADE:
        top = fr[AY:AY + FADE].astype(np.float32)
        fr[AY:AY + FADE] = (top * (1 - fade_a) + np.array(BG, np.float32) * fade_a).astype(np.uint8)
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
json.dump(AVATAR_INFO, open(os.path.join(B, "avatar.json"), "w"), ensure_ascii=False, indent=1)
print("written", OUT)

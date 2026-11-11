"""Step 8: build/timing.json + sfx.json + avatar.json + glyphs_missing.json + mix loudness -> <video>/metrics.json.
Machine-readable numbers for the backend render gate and for reports (pacing, sound, loudness, glyphs, voice alignment, avatar sync,
time shares by shot source and badge). Never fails the build: missing inputs are reported as null."""
import json, os, re, statistics, subprocess
from common import BUILD as B, VIDEO, CFG, OUT_MP4, ENGINE

def load(name, default=None):
    p = os.path.join(B, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else default

T = load("timing.json")
if T is None: raise SystemExit("no build/timing.json: run tts.py first")
FPS = T["fps"]; shots = T["shots"]; total = T["frames"] / FPS
durs = [(s["f1"] - s["f0"]) / FPS for s in shots]
longest = max(shots, key=lambda s: s["f1"] - s["f0"]) if shots else None
sfx = load("sfx.json", {})

def loudness(path):
    if not os.path.exists(path): return None
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    try:
        js = json.loads(r[r.rindex("{"):r.rindex("}") + 1])
        return {"integrated_lufs": float(js["input_i"]), "true_peak_db": float(js["input_tp"]), "lra": float(js["input_lra"])}
    except (ValueError, KeyError):
        return None

def share_by(key):
    acc = {}
    for s, d in zip(shots, durs):
        k = (s.get(key) or "—").strip() or "—"
        acc[k] = acc.get(k, 0.0) + d
    return {k: round(v / total, 3) for k, v in sorted(acc.items(), key=lambda kv: -kv[1])} if total else {}

def sub_words(s):
    s = s.replace("—", " ").replace("«", "").replace("»", "")
    s = re.sub(r"(\d),(\d)", r"\1§\2", s)
    return re.sub(r"[.,:;!?]", "", s).replace("§", ",").split()

nwords = sum(len(sub_words(sc["subtitle"])) for sc in T["scenes"])
speech_s = sum(sc["dur"] for sc in T["scenes"])
version = open(os.path.join(ENGINE, "VERSION")).read().strip() if os.path.exists(os.path.join(ENGINE, "VERSION")) else None
glyphs = load("glyphs_missing.json", None)
M = {
    "engine": "kit_v8", "engine_version": version, "slug": CFG.get("slug") or os.path.basename(VIDEO),
    "audience": CFG.get("audience"), "output": os.path.basename(OUT_MP4),
    "duration_s": round(total, 3), "frames": T["frames"], "fps": FPS,
    "scenes": len(T["scenes"]), "shots": len(shots),
    "shot_s": {"median": round(statistics.median(durs), 3), "mean": round(statistics.mean(durs), 3), "min": round(min(durs), 3),
               "max": round(max(durs), 3), "longest_id": longest["id"], "over_3_5s": sum(d > 3.5 for d in durs)} if durs else None,
    "cuts_per_min": round((len(shots) - 1) / total * 60, 2) if total else None,
    "cuts_first_3s": sum(1 for s in shots[1:] if s["t0"] < 3.0),
    "words": nwords, "words_per_s": round(nwords / speech_s, 3) if speech_s else None,
    "scene_gap_s": T.get("scene_gap"), "tail_s": T.get("tail"),
    "voice": T.get("voice"), "anchors_clamped": T.get("anchors_clamped"),
    "sound": {"cuts_with_sound": sfx.get("cuts_with_sound"), "cuts": sfx.get("cuts"),
              "share": round(sfx["cuts_with_sound"] / sfx["cuts"], 3) if sfx.get("cuts") else None},
    "loudness": loudness(os.path.join(B, "mix.wav")),
    "glyphs_missing": glyphs, "glyphs_ok": (not glyphs) if glyphs is not None else None,
    "avatar": load("avatar.json"),
    "share_by_source": share_by("source"), "share_by_badge": share_by("badge"),
}
out = os.path.join(VIDEO, "metrics.json")
json.dump(M, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"metrics: {M['duration_s']}s, {M['shots']} shots, median {M['shot_s']['median'] if durs else '-'}s, "
      f"sound {M['sound']['share']}, LUFS {(M['loudness'] or {}).get('integrated_lufs')}, glyphs_ok {M['glyphs_ok']}, avatar {(M['avatar'] or {}).get('mode')}")
print("saved", out)

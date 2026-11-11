"""Step 1: RHVoice TTS per scene -> build/tts/sNN.wav + build/timing.json
timing.json: scenes (audio t0/t1, words with times, accent), shots (exact frame bounds f0/f1, anchor time).
Config (video.json): "voice" (default aleksandr-hq), "tts_rate" (default 145), "spoken_syllables" {latin word: syllables}.
Env: REDO_TTS=1 to re-synthesize, TTS_RATE to override rate.
External voice (ElevenLabs etc.): put voice.mp3 / voice.wav into the video folder (or "voice_file" in video.json).
Then RHVoice is skipped: the file is transcribed offline with word timestamps (asr_words.mjs, needs setup.sh --asr),
aligned to the subtitle words, cut into per-scene wavs at the pauses between scenes; real word times drive shots and subtitles.
Per-scene voice (production: Fish TTS + WhisperX): voice/<scene>.wav for every scene + alignment.json. RHVoice and ASR are skipped;
alignment words are matched to the subtitle words of their scene. alignment.json formats (see services/reel_engine/README.md):
  {"scenes": {"s01": [{"w": "...", "t0": 0.12, "t1": 0.4}, ...]}}            seconds, relative to the scene wav
  [{"text": "...", "time_begin": 120, "time_end": 400}, ...]                  ms on the concatenated track (WhisperX / backend
                                                                               tts/alignment.json), scenes joined with "alignment_gap" s
Mode: video.json "voice_mode": "auto" (default) | "scenes" | "file" | "rhvoice". auto: voice/ with all scenes > voice file > RHVoice."""
import json, subprocess, os, re, wave, glob
from common import BUILD, CFG, FPS, VIDEO, storyboard

os.makedirs(os.path.join(BUILD, "tts"), exist_ok=True)
GAP = float(CFG.get("scene_gap", 0.25))
TAIL = float(CFG.get("tail", 1.2))
RATE = int(os.environ.get("TTS_RATE", CFG.get("tts_rate", 145)))
VOICE = CFG.get("voice", "aleksandr-hq")
SR = 24000
VOW = set("аеёиоуыэюяaeiouy")
SPOKEN = CFG.get("spoken_syllables", {})

sb = storyboard()


def wav_dur(p):
    with wave.open(p) as w:
        return w.getnframes() / w.getframerate()


def synth(text, out):
    raw = out + ".raw.wav"
    subprocess.run(["RHVoice-test", "-p", VOICE, "-r", str(RATE), "-o", raw], input=text.encode(), check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af",
                    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,"
                    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse",
                    "-ar", str(SR), "-ac", "1", out], check=True)
    os.remove(raw)


def sub_words(s):
    s = s.replace("—", " ").replace("«", "").replace("»", "")
    s = re.sub(r"(\d),(\d)", r"\1§\2", s); s = re.sub(r"(\d)\.(\d)", r"\1¤\2", s)
    s = re.sub(r"[.,:;!?]", "", s).replace("§", ",").replace("¤", ".")
    return s.split()



def find_voice():
    if CFG.get("voice_file"): return os.path.join(VIDEO, CFG["voice_file"])
    for ext in ("wav", "mp3", "m4a", "flac"):
        p = os.path.join(VIDEO, "voice." + ext)
        if os.path.exists(p): return p
    return None


def norm(x): return re.sub(r"[^\wё]", "", x.lower()).replace("ё", "е")


def lev(a, b):
    if a == b: return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1): cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def sim(a, b):
    if not a or not b: return 0.0
    return 1 - lev(a, b) / max(len(a), len(b))


def syl(w):
    return SPOKEN.get(w) or max(1, sum(c in VOW for c in w.lower()))


def align_words(sw, toks, dur_all):
    """Needleman-Wunsch alignment of script words sw [{w, n, ...}] to ASR tokens [{n, t0, t1}] in place (adds t0/t1).
    Unmatched words are filled by syllable-weighted interpolation between matched neighbours, within [0, dur_all].
    Returns the number of matched words."""
    n, m = len(sw), len(toks); G = -0.6
    S = [[0.0] * (m + 1) for _ in range(n + 1)]; P = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1): S[i][0] = i * G; P[i][0] = 1
    for j in range(1, m + 1): S[0][j] = j * G; P[0][j] = 2
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            q = sim(sw[i - 1]["n"], toks[j - 1]["n"]); d = S[i - 1][j - 1] + (2 * q if q >= 0.5 else -1)
            u = S[i - 1][j] + G; l = S[i][j - 1] + G
            S[i][j], P[i][j] = max((d, 0), (u, 1), (l, 2))
    i, j = n, m
    while i > 0 and j > 0:
        if P[i][j] == 0:
            if sim(sw[i - 1]["n"], toks[j - 1]["n"]) >= 0.5: sw[i - 1]["t0"], sw[i - 1]["t1"] = toks[j - 1]["t0"], toks[j - 1]["t1"]
            i -= 1; j -= 1
        elif P[i][j] == 1: i -= 1
        else: j -= 1
    matched = sum("t0" in w for w in sw)
    # fill unmatched words by syllable-weighted interpolation between matched neighbours
    k = 0
    while k < len(sw):
        if "t0" in sw[k]: k += 1; continue
        e = k
        while e < len(sw) and "t0" not in sw[e]: e += 1
        lo = sw[k - 1]["t1"] if k > 0 else max(0.0, (sw[e]["t0"] if e < len(sw) else dur_all) - 0.4 * (e - k))
        hi = sw[e]["t0"] if e < len(sw) else min(dur_all, lo + 0.4 * (e - k))
        wts = [syl(sw[x]["w"]) for x in range(k, e)]; tot = sum(wts); t = lo
        for x, wt in zip(range(k, e), wts):
            dd = (hi - lo) * wt / tot; sw[x]["t0"], sw[x]["t1"] = t, t + dd; t += dd
        k = e
    for a_, b_ in zip(sw, sw[1:]):             # keep monotonic
        if b_["t0"] < a_["t0"]: b_["t0"] = a_["t0"] + 0.05
        b_["t1"] = max(b_["t1"], b_["t0"] + 0.08)
    return matched


def asr_tokens(chunks):
    """ASR chunks [{text, t0, t1}] (a chunk may hold several words) -> one token per word, time split evenly."""
    toks = []
    for c in chunks:
        ws = [w for w in c["text"].split() if norm(w)]
        if not ws: continue
        span = (c["t1"] - c["t0"]) / len(ws)
        for k, w in enumerate(ws): toks.append({"n": norm(w), "t0": c["t0"] + k * span, "t1": c["t0"] + (k + 1) * span})
    return toks


def external_scenes(src):
    asr_json = os.path.join(BUILD, "voice_asr.json")
    if not os.path.exists(asr_json) or os.path.getmtime(asr_json) < os.path.getmtime(src):
        subprocess.run(["node", os.path.join(os.path.dirname(__file__), "asr_words.mjs"), src], check=True, env={**os.environ, "VIDEO": VIDEO})
    A = json.load(open(asr_json)); dur_all = A["duration"]
    toks = asr_tokens(A["chunks"])             # ASR words with times
    sw = []                                    # script words: (scene index, word)
    for i, sc in enumerate(sb):
        for w in sub_words(sc["subtitle"]): sw.append({"sc": i, "w": w, "n": norm(w)})
    matched = align_words(sw, toks, dur_all)
    VOICE_STATS.update(aligned=matched, words=len(sw))
    print(f"external voice: {os.path.basename(src)}, {dur_all:.1f}s, aligned {matched}/{len(sw)} words")
    if matched < 0.6 * len(sw):
        errors.append(f"voice file matches only {matched}/{len(sw)} subtitle words: is it the same text?")
    # cut points between scenes: middle of the silence in the gap, else midpoint
    sil = []
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", src, "-af", "silencedetect=noise=-38dB:d=0.12", "-f", "null", "-"], capture_output=True, text=True).stderr
    st = None
    for ln in r.splitlines():
        mm = re.search(r"silence_start: ([\d.]+)", ln)
        if mm: st = float(mm.group(1))
        mm = re.search(r"silence_end: ([\d.]+)", ln)
        if mm and st is not None: sil.append((st, float(mm.group(1)))); st = None
    first = [next(w for w in sw if w["sc"] == i) for i in range(len(sb))]
    last = [[w for w in sw if w["sc"] == i][-1] for i in range(len(sb))]
    cuts = [0.0]
    for i in range(1, len(sb)):
        e, s_ = last[i - 1]["t1"], first[i]["t0"]
        cand = [x for x in sil if x[1] > e - 0.35 and x[0] < s_ + 0.35]
        if cand: x = max(cand, key=lambda q: q[1] - q[0]); c = (x[0] + x[1]) / 2
        else: c = (e + s_) / 2
        cuts.append(max(c, cuts[-1] + 0.3))
    cuts.append(dur_all)
    out = []
    for i, sc in enumerate(sb):
        sid = sc["scene"]; wav = os.path.join(BUILD, "tts", sid + ".wav")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{cuts[i]:.3f}", "-to", f"{cuts[i + 1]:.3f}", "-i", src,
                        "-ar", str(SR), "-ac", "1", wav], check=True)
        wl = [{"w": w["w"], "t0": round(w["t0"], 3), "t1": round(w["t1"], 3)} for w in sw if w["sc"] == i]
        out.append((sc, wav, cuts[i], wav_dur(wav), wl))
    return out


def scene_voice_files():
    """voice/<scene>.(wav|mp3|flac|m4a) for every scene of the storyboard, or None if any is missing."""
    d = os.path.join(VIDEO, CFG.get("voice_dir", "voice"))
    if not os.path.isdir(d): return None
    out = {}
    for sc in sb:
        p = next((os.path.join(d, sc["scene"] + "." + e) for e in ("wav", "mp3", "flac", "m4a")
                  if os.path.exists(os.path.join(d, sc["scene"] + "." + e))), None)
        if not p: return None
        out[sc["scene"]] = p
    return out


def ms_or_s(w, k_s, k_ms):
    if w.get(k_s) is not None: return float(w[k_s])
    if w.get(k_ms) is not None: return float(w[k_ms]) / 1000.0
    return None


def load_alignment(durs):
    """alignment.json -> {scene_id: [{n, t0, t1}]} with times relative to the scene wav. durs: {scene: wav duration}."""
    p = os.path.join(VIDEO, CFG.get("alignment_file", "alignment.json"))
    if not os.path.exists(p):
        return {}, "missing"
    A = json.load(open(p, encoding="utf-8"))
    def tok(w):
        text = w.get("w") or w.get("word") or w.get("text") or ""
        t0 = ms_or_s(w, "t0", "time_begin"); t0 = ms_or_s(w, "start", "time_begin") if t0 is None else t0
        t1 = ms_or_s(w, "t1", "time_end"); t1 = ms_or_s(w, "end", "time_end") if t1 is None else t1
        if t0 is None or t1 is None: return []
        ws = [x for x in text.split() if norm(x)]
        span = (t1 - t0) / max(1, len(ws))
        return [{"n": norm(x), "t0": t0 + k * span, "t1": t0 + (k + 1) * span} for k, x in enumerate(ws)]
    if isinstance(A, dict) and isinstance(A.get("scenes"), dict):          # per-scene, relative seconds
        return {sid: [t for w in ws for t in tok(w)] for sid, ws in A["scenes"].items()}, "scenes"
    words = A.get("words") if isinstance(A, dict) else A                   # flat list on the concatenated track
    gap = float(CFG.get("alignment_gap", CFG.get("scene_gap", 0.25)))
    out, t = {}, 0.0
    bounds = []
    for sc in sb:
        bounds.append((sc["scene"], t, t + durs[sc["scene"]])); t += durs[sc["scene"]] + gap
    for w in words or []:
        for x in tok(w):
            mid = (x["t0"] + x["t1"]) / 2
            for k, (sid, a, b) in enumerate(bounds):
                nxt = bounds[k + 1][1] if k + 1 < len(bounds) else float("inf")
                if mid < (b + nxt) / 2:                                    # words in a gap go to the nearer scene
                    out.setdefault(sid, []).append({"n": x["n"], "t0": max(0.0, x["t0"] - a), "t1": max(0.0, x["t1"] - a)})
                    break
    return out, "track"


def per_scene_voice(files):
    durs, wavs = {}, {}
    for sc in sb:
        sid = sc["scene"]; out = os.path.join(BUILD, "tts", sid + ".wav")
        if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(files[sid]):
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", files[sid], "-ar", str(SR), "-ac", "1", out], check=True)
        wavs[sid] = out; durs[sid] = wav_dur(out)
    al, fmt = load_alignment(durs)
    if fmt == "missing":
        print("  note: no alignment.json — word times are estimated by syllables inside each scene wav")
    res, matched_all, words_all = {}, 0, 0
    for sc in sb:
        sid = sc["scene"]
        sw = [{"w": w, "n": norm(w)} for w in sub_words(sc["subtitle"])]
        toks = al.get(sid, [])
        m = align_words(sw, toks, durs[sid]) if toks else 0
        if not toks:
            tot = sum(syl(w["w"]) for w in sw); acc = 0.0
            for w in sw:
                dd = durs[sid] * syl(w["w"]) / tot; w["t0"], w["t1"] = acc, acc + dd; acc += dd
            if fmt != "missing": print(f"  note {sid}: no alignment words for this scene — estimated by syllables")
        for w in sw:                                                       # stay inside the scene audio
            w["t0"] = min(max(0.0, w["t0"]), durs[sid]); w["t1"] = min(max(w["t0"] + 0.02, w["t1"]), durs[sid] + 0.02)
        matched_all += m; words_all += len(sw)
        res[sid] = (wavs[sid], durs[sid], sw)
    VOICE_STATS.update(aligned=matched_all, words=words_all, alignment=fmt)
    print(f"scene voice: {len(files)} files, alignment {fmt}, aligned {matched_all}/{words_all} words")
    if fmt != "missing" and matched_all < 0.6 * words_all:
        errors.append(f"alignment matches only {matched_all}/{words_all} subtitle words: is it the same text?")
    return res


errors = []
scenes = []
VOICE_STATS = {}
MODE = CFG.get("voice_mode", "auto")
SCENE_FILES = scene_voice_files() if MODE in ("auto", "scenes") else None
if MODE == "scenes" and not SCENE_FILES:
    raise SystemExit("voice_mode=scenes: need voice/<scene>.wav for every scene of storyboard.json")
VOICE_SRC = find_voice() if MODE in ("auto", "file") and not SCENE_FILES else None
if MODE == "file" and not VOICE_SRC:
    raise SystemExit("voice_mode=file: no voice.mp3/voice.wav (or video.json voice_file)")
items = per_scene = None
if SCENE_FILES:
    MODE = "scenes"; VOICE = "scenes:" + CFG.get("voice_dir", "voice")
    per_scene = per_scene_voice(SCENE_FILES)
elif VOICE_SRC:
    MODE = "file"; GAP = 0.0; TAIL = float(CFG.get("tail", 0.6)); VOICE = "external:" + os.path.basename(VOICE_SRC)
    items = external_scenes(VOICE_SRC)
else:
    MODE = "rhvoice"
t = 0.0
for k_sc, sc in enumerate(sb):
    sid = sc["scene"]
    if items:
        _, out, t, d, wl = items[k_sc]
    elif per_scene:
        out, d, sw_ = per_scene[sid]
        wl = [{"w": w["w"], "t0": round(t + w["t0"], 3), "t1": round(t + w["t1"], 3)} for w in sw_]
    else:
        out = os.path.join(BUILD, "tts", sid + ".wav")
        if not os.path.exists(out) or os.environ.get("REDO_TTS"):
            synth(sc["tts"], out)
        d = wav_dur(out)
        words = sub_words(sc["subtitle"])
        wts = []
        for w in words:
            if w in SPOKEN:
                wts.append(SPOKEN[w]); continue
            wts.append(max(1, sum(c in VOW for c in w.lower())))
        tot = sum(wts); raw = [d * x / tot for x in wts]
        short = [max(0.12, r) for r in raw]
        k = d / sum(short); dur = [x * k for x in short]
        wl = []; acc = t
        for w, dd in zip(words, dur):
            wl.append({"w": w, "t0": round(acc, 3), "t1": round(acc + dd, 3)}); acc += dd
    accent = sc.get("accent", "")
    norm = lambda x: re.sub(r"[^\wё]", "", x.lower())
    if accent and not any(norm(w["w"]) == norm(accent) for w in wl):
        errors.append(f"{sid}: accent '{accent}' is not a word of the subtitle")
    if abs(sum(s["share"] for s in sc["shots"]) - 1) > 0.02:
        errors.append(f"{sid}: shot shares sum to {sum(s['share'] for s in sc['shots']):.2f}, must be 1")
    scenes.append({"id": sid, "beat": sc["beat"], "subtitle": sc["subtitle"], "t0": t, "t1": t + d,
                   "wav": out, "dur": d, "words": wl, "accent": accent, "shots": sc["shots"]})
    t += d + GAP

total = scenes[-1]["t1"] + TAIL
shots = []
for i, sc in enumerate(scenes):
    v0 = 0.0 if i == 0 else sc["t0"]
    v1 = scenes[i + 1]["t0"] if i + 1 < len(scenes) else total
    sc["v0"], sc["v1"] = v0, v1
    acc = v0
    for j, sh in enumerate(sc["shots"]):
        a = acc; b = v1 if j == len(sc["shots"]) - 1 else acc + (v1 - v0) * sh["share"]
        acc = b
        f0, f1 = round(a * FPS), round(b * FPS)
        anc = None
        aw = re.sub(r"[^\wё,]", "", sh.get("anchor_word", "").lower()).strip(",")
        nw = lambda x: re.sub(r"[^\wё,]", "", x.lower()).strip(",")
        for test in (lambda w: nw(w) == aw, lambda w: nw(w).startswith(aw), lambda w: aw in nw(w)):   # exact > prefix > substring
            if anc is None and aw:
                anc = next((w["t0"] for w in sc["words"] if test(w["w"])), None)
        if anc is None:
            errors.append(f"{sc['id']}_{j+1}: anchor_word '{sh.get('anchor_word')}' not found in scene text")
            anc = a
        anc_raw = anc
        anc = min(max(anc, a), b - 0.45)
        if anc_raw < a - 0.05 or anc_raw > b + 0.05:
            print(f"  note {sc['id']}_{j+1}: anchor '{sh.get('anchor_word')}' at {anc_raw:.2f}s is outside the shot "
                  f"[{a:.2f}, {b:.2f}] -> clamped; consider reordering shots or changing shares")
        shots.append({"id": f"{sc['id']}_{j+1}", "scene": sc["id"], "idx": j, "f0": f0, "f1": f1,
                      "t0": f0 / FPS, "t1": f1 / FPS, "anchor": anc, "anchor_raw": anc_raw, **sh})
clamped = sum(1 for sh in shots if sh["anchor_raw"] < sh["t0"] - 0.05 or sh["anchor_raw"] > sh["t1"] + 0.05)
json.dump({"fps": FPS, "total": total, "frames": round(total * FPS), "scene_gap": GAP, "tail": TAIL,
           "voice": {"mode": MODE, "source": VOICE, **VOICE_STATS}, "anchors_clamped": clamped, "scenes": scenes, "shots": shots},
          open(os.path.join(BUILD, "timing.json"), "w"), ensure_ascii=False, indent=1)
print(f"total {total:.2f}s, voice {VOICE}, rate {RATE}, scenes {len(scenes)}, shots {len(shots)}")
for sh in shots:
    print(sh["id"], f"{sh['t0']:.2f}-{sh['t1']:.2f}", f"{sh['t1']-sh['t0']:.2f}s", "anchor", sh.get("anchor_word"), f"{sh['anchor']:.2f}")
if errors:
    print("\nERRORS:\n  " + "\n  ".join(errors)); raise SystemExit(1)

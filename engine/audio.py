"""Step 5: voice + synthesized SFX + ambient drone -> build/mix.wav (-14 LUFS, TP -1.5) and build/sfx.json
Shot "sfx" field: "whoosh" | "deep whoosh" | "pop" (on the anchor) | "impact" (on the anchor) | "riser" (ends at shot end)
| "none" (silent cut) | "—"/"" (default: soft whoosh on the cut). Aim: sound on 75-80 % of cuts."""
import json, os, wave, subprocess
import numpy as np
from scipy.signal import butter, sosfilt
from common import BUILD as B, CFG
SR = 48000
T = json.load(open(os.path.join(B, "timing.json")))
N = int(T["frames"] / 30 * SR) + SR
rng = np.random.default_rng(7)

def load_wav(p):
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).copy()

def place(buf, x, t, g=1.0):
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), len(buf) - i)
    if n > 0: buf[i:i + n] += g * x[:n]

# ---------- voice ----------
voice = np.zeros(N, np.float32)
for sc in T["scenes"]:
    place(voice, load_wav(sc["wav"]), sc["t0"])
voice /= (np.abs(voice).max() + 1e-9); voice *= 0.7
# voice only, 16 kHz mono, for the lip-synced avatar (step avatar)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-ar", "16000", "-ac", "1",
                "-c:a", "pcm_s16le", os.path.join(B, "voice16k.wav")], input=voice.astype(np.float32).tobytes(), check=True)

# ---------- sfx synthesis ----------
def env(n, att, dec_tau):
    t = np.arange(n) / SR
    e = np.minimum(1, t / att) * np.exp(-np.maximum(0, t - att) / dec_tau)
    return e
def sweep_noise(f0, f1, dur, att=0.06, tau=0.1):
    n = int(dur * SR); noise = rng.standard_normal(n + SR // 5)
    out = np.zeros(n); blk = 256
    for k in range(0, n, blk):
        fc = f0 * (f1 / f0) ** (k / n)
        sos = butter(2, [fc * 0.7, min(fc * 1.4, SR / 2 - 100)], btype="band", fs=SR, output="sos")
        seg = sosfilt(sos, noise[k:k + blk + 512])[512 // 2: 512 // 2 + blk] if False else sosfilt(sos, noise[max(0, k - 512):k + blk])[-blk:]
        out[k:k + blk] = seg[:len(out[k:k + blk])]
    e = np.concatenate([np.minimum(1, np.arange(int(dur * SR * 0.6)) / (att * SR)), np.exp(-np.arange(n - int(dur * SR * 0.6)) / (tau * SR))])
    o = out * e[:n]; return o / (np.abs(o).max() + 1e-9)
def whoosh(): return sweep_noise(900, 6500, 0.3, 0.12, 0.1)
def deep_whoosh(): return sweep_noise(280, 2600, 0.5, 0.2, 0.12)
def pop():
    d = 0.12; n = int(d * SR); t = np.arange(n) / SR
    f = 880 * (220 / 880) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.05)
    click = np.zeros(n); c = int(0.004 * SR); click[:c] = rng.standard_normal(c) * np.linspace(1, 0, c) * 0.6
    o = s + click; return o / np.abs(o).max()
def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 180 * (1400 / 180) ** (t / dur); s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    nz = sosfilt(butter(2, 3000, btype="high", fs=SR, output="sos"), rng.standard_normal(n)) * 0.5
    e = (t / dur) ** 2; o = (s * 0.6 + nz) * e; return o / np.abs(o).max()
def impact():
    d = 0.6; n = int(d * SR); t = np.arange(n) / SR
    f = 120 * (40 / 120) ** np.minimum(1, t / 0.3); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.3)
    nz = sosfilt(butter(2, 1200, btype="low", fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-t / 0.05)
    o = s + 0.6 * nz; return o / np.abs(o).max()
LIB = {"whoosh": whoosh(), "deep whoosh": deep_whoosh(), "pop": pop(), "impact": impact()}

sfx = np.zeros(N, np.float32); events = []
shots = T["shots"]
QUIET_SKIP = {sh["id"] for sh in shots if sh.get("sfx", "").strip().lower() == "none"}  # cuts left without sound
cuts_with = 0
for k, sh in enumerate(shots):
    kind = sh.get("sfx", "").replace("riser к концу", "riser").strip()
    cut = sh["t0"]; anc = sh["anchor"] - 0.1 if sh["anchor"] - 0.1 > cut else cut
    has = False
    if kind in ("whoosh", "deep whoosh"):
        x = LIB[kind]; place(sfx, x, cut - (0.18 if kind == "whoosh" else 0.3), 0.55 if kind == "whoosh" else 0.7); has = True
    elif kind == "pop":
        place(sfx, LIB["pop"], max(cut, anc), 0.5); has = abs(anc - cut) < 0.3
        if not has and k > 0 and sh["id"] not in QUIET_SKIP: place(sfx, LIB["whoosh"], cut - 0.18, 0.33); has = True
    elif kind == "impact":
        place(sfx, LIB["impact"], max(cut, anc), 0.8); has = abs(anc - cut) < 0.3
        if not has and k > 0: place(sfx, LIB["whoosh"], cut - 0.18, 0.33); has = True
    elif kind == "riser":
        d = min(1.6, sh["t1"] - sh["t0"]); place(sfx, riser(d), sh["t1"] - d, 0.35)
        place(sfx, LIB["whoosh"], cut - 0.18, 0.33); has = True
    else:  # unmarked cut
        if k > 0 and sh["id"] not in QUIET_SKIP: place(sfx, LIB["whoosh"], cut - 0.18, 0.55 * 0.6); has = True
    if k > 0 and has: cuts_with += 1
    events.append({"id": sh["id"], "kind": kind, "cut_sound": has})
ncuts = len(shots) - 1
print(f"cuts with sound: {cuts_with}/{ncuts} = {cuts_with / ncuts:.0%}")

# ---------- ambient drone Am(add9) ----------
t = np.arange(N) / SR
freqs = [(110.0, 1.0), (164.81, 0.6), (220.0, 0.5), (261.63, 0.35), (493.88, 0.18), (329.63, 0.25)]
dr = sum(a * np.sin(2 * np.pi * f * t + i) * (1 + 0.003 * np.sin(2 * np.pi * 0.07 * t * (i + 1))) for i, (f, a) in enumerate(freqs))
dr += 0.15 * rng.standard_normal(N)
dr = sosfilt(butter(4, 1200, btype="low", fs=SR, output="sos"), dr)
dr *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * t)
total = T["frames"] / 30
fade = np.clip(t / 0.5, 0, 1) * np.clip((total - t) / 1.5, 0, 1)
dr = dr / np.abs(dr).max() * fade
# music ~20 dB below voice (RMS-based)
vr = np.sqrt(np.mean(voice[voice != 0] ** 2)); mr = np.sqrt(np.mean(dr ** 2))
dr *= (vr * 10 ** (-float(CFG.get("music_db_below_voice", 20)) / 20)) / mr
if CFG.get("sound_design", True) is False:   # video.json "sound_design": false -> voice only, no SFX, no drone
    sfx[:] = 0; dr[:] = 0; events = []; cuts_with = 0
    print("sound_design off: voice only")
elif CFG.get("sound_design") == "custom":     # own sound files: kit sfx/ + events from shots (lib.js sfx) + storyboard "cut_sfx"
    import glob as _g
    sfx[:] = 0; dr[:] = 0; events = []; cuts_with = 0
    SFX_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sfx")
    GAIN = {"Whoosh": .22, "Whoosh_6": .2, "Reversed Whoosh": .2, "Riser_4": .2, "Boom, Impact_2": .32, "Cartoon_Pop": .2,
            "Select": .16, "Select_3": .16, "Button_2": .12, "Button_5": .14, "Click_UI Buttons_2": .1, "Mechanical_Click_Button_2": .2,
            "Beep_8": .12, "Sci_Fi": .18, "Sci_Fi_2": .18, "тррр_длинный_4": .12, "тррр_короткий_4": .12}
    _cache = {}
    def snd(name):
        if name not in _cache:
            import unicodedata as _u
            f = next((os.path.join(SFX_DIR, q) for q in os.listdir(SFX_DIR) if _u.normalize("NFC", os.path.splitext(q)[0]) == _u.normalize("NFC", name)), None)
            if not f: print("!! sfx not found:", name); _cache[name] = None
            else:
                x = load_wav(f); x /= (np.abs(x).max() + 1e-9)
                env_ = np.abs(x); k = max(1, int(0.01 * SR)); sm = np.convolve(env_, np.ones(k) / k, mode="same")
                _cache[name] = (x, int(np.argmax(sm)) / SR)
        return _cache[name]
    def put(name, t, gain=None, align="peak", lead=0.0):
        r = snd(name)
        if r is None: return
        x, pk = r; g = gain if gain is not None else GAIN.get(name, .15)
        start = (t - lead - pk) if align in ("peak", "end") else t
        place(sfx, x, start, g); events.append({"name": name, "t": round(t, 3), "start": round(start, 3)})
    for sh in shots:
        evf = os.path.join(B, "sfx_events", sh["id"] + ".json")
        for e in (json.load(open(evf)) if os.path.exists(evf) else []):
            put(e["name"], sh["t0"] + e["t"], e.get("gain"), e.get("align", "peak"), e.get("lead", 0))
        c = sh.get("cut_sfx")
        if c: put(c["name"], sh["t0"], c.get("gain"), "end", c.get("lead", 0.12))
    for e in CFG.get("sfx_abs", []): put(e["name"], e["t"], e.get("gain"), e.get("align", "peak"), e.get("lead", 0))
    cuts_with = sum(1 for k, sh in enumerate(shots) if k > 0 and any(abs(ev["t"] - sh["t0"]) < 0.35 for ev in events))
    print(f"custom sfx: {len(events)} events")
mix = voice + sfx * (1.0 if CFG.get("sound_design") == "custom" else 0.45) + dr
mix = mix[: int(total * SR)]
raw = os.path.join(B, "mix_raw.wav")
with wave.open(raw, "w") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix / (np.abs(mix).max() + 1e-9) * 0.8, -1, 1) * 32767).astype(np.int16).tobytes())
# two-pass loudnorm
m = subprocess.run(["ffmpeg", "-hide_banner", "-i", raw, "-af", "alimiter=limit=0.7:level=false,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
js = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
af = (f"alimiter=limit=0.7:level=false,loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
      f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af", af, "-ar", "48000", "-ac", "2", os.path.join(B, "mix.wav")], check=True)
json.dump({"events": events, "cuts_with_sound": cuts_with, "cuts": ncuts}, open(os.path.join(B, "sfx.json"), "w"), ensure_ascii=False, indent=1)
print("mix written")

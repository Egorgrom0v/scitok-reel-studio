"""Step avatar: the lip-synced avatar (SoulX-FlashHead) for the finished voice track, pipeline v4.

audio.py writes build/voice16k.wav (voice only, 16 kHz mono, the video's timeline). This step sends it with
the portrait to the FlashHead service (services/flashhead_avatar, POST /v1/avatar, model kept loaded) and
saves videos/<slug>/avatar.mp4; compose.py plays it under the stage from t=0 (last frame held for the tail).
avatar.json remembers the hashes of voice and portrait: the same voice is not rendered twice.

Env: FLASHHEAD_URL (e.g. http://host.docker.internal:18195), AVATAR_IMAGE (portrait PNG/JPG, frontal, mouth closed);
AVATAR_TIMEOUT seconds (default 3600). Without them the placeholder avatar stays. Only the standard library is used.
"""
import hashlib, json, os, time, urllib.request, uuid
from common import VIDEO, BUILD

URL = os.environ.get("FLASHHEAD_URL", "").rstrip("/")
IMAGE = os.environ.get("AVATAR_IMAGE", "")
VOICE = os.path.join(BUILD, "voice16k.wav")
OUT = os.path.join(VIDEO, "avatar.mp4")
BOOK = os.path.join(VIDEO, "avatar.json")


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()[:16]


def multipart(files):
    boundary = uuid.uuid4().hex
    body = b""
    for field, path, ctype in files:
        body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"{os.path.basename(path)}\"\r\n"
                 f"Content-Type: {ctype}\r\n\r\n").encode() + open(path, "rb").read() + b"\r\n"
    return body + f"--{boundary}--\r\n".encode(), f"multipart/form-data; boundary={boundary}"


def main():
    if not URL or not IMAGE:
        print("avatar: FLASHHEAD_URL / AVATAR_IMAGE not set — placeholder avatar"); return
    if not os.path.exists(IMAGE):
        print(f"!! avatar: no portrait {IMAGE} — placeholder avatar"); return
    if not os.path.exists(VOICE):
        raise SystemExit("avatar: no build/voice16k.wav — run the audio step first")
    key = {"voice": sha(VOICE), "image": sha(IMAGE)}
    if os.path.exists(OUT) and os.path.exists(BOOK) and json.load(open(BOOK)).get("key") == key:
        print("avatar: avatar.mp4 is already made for this voice"); return
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))  # the service is local: no proxy
    try:
        print("avatar: health", opener.open(URL + "/healthz", timeout=10).read().decode()[:200])
    except Exception as e:  # noqa: BLE001
        print(f"!! avatar: FlashHead service at {URL} does not answer ({e}) — placeholder avatar; start the service and re-run --from avatar")
        return
    ctype_img = "image/png" if IMAGE.lower().endswith(".png") else "image/jpeg"
    body, ctype = multipart([("image", IMAGE, ctype_img), ("audio", VOICE, "audio/wav")])
    t0 = time.time()
    req = urllib.request.Request(URL + "/v1/avatar", data=body, method="POST", headers={"Content-Type": ctype})
    print("avatar: rendering (FlashHead Pro, ~4 s per second of voice)…")
    try:
        with opener.open(req, timeout=float(os.environ.get("AVATAR_TIMEOUT", "3600"))) as r:
            data = r.read()
    except Exception as e:  # noqa: BLE001 — the video is still built, with the placeholder
        print(f"!! avatar: FlashHead failed ({e}) — placeholder avatar"); return
    if not data:
        raise SystemExit("avatar: the service returned an empty file")
    tmp = OUT + ".part"
    open(tmp, "wb").write(data)
    os.replace(tmp, OUT)
    json.dump({"key": key, "seconds": round(time.time() - t0, 1), "image": os.path.basename(IMAGE)}, open(BOOK, "w"), indent=1)
    print(f"avatar: avatar.mp4 {len(data) / 1e6:.1f} MB in {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()

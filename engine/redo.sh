#!/usr/bin/env bash
# Redo some shots of a finished video folder and rebuild the final mp4. Voice, avatar and video inserts are reused:
# no keys, no GPU, no money. Usage (from services/reel_engine):
#   bash engine/redo.sh <video folder> '<shot id regex>'        e.g.  's05_|s12_2'
#   SUBS=off bash engine/redo.sh …                               the same video without subtitles (video.json is not changed)
# Shots whose length changed (a new share in shot_plan.json) are re-rendered too, even if the regex missed them.
set -euo pipefail
ENGINE="$(cd "$(dirname "$0")" && pwd)"
VIDEO="$(cd "${1:?usage: bash engine/redo.sh <video folder> '<shot id regex>'}" && pwd)"; RE="${2:?shot id regex, e.g. 's05_'}"
export VIDEO
PY="${PYTHON:-python3}"
cd "$ENGINE"
B="$VIDEO/build"
[ -f "$B/timing.json" ] || { echo "no build/timing.json: this is not a built video folder (copy the whole reel/ folder)"; exit 1; }
cp "$B/timing.json" "$B/timing.prev.json"
"$PY" plan.py                       # shot_plan.json -> storyboard.json + shots.js (hero_code.json / hero_world.json kept)
"$PY" tts.py > /dev/null            # timings from the same voice; only changed shares move shot bounds
RE="$("$PY" - "$RE" "$B" <<'EOF'
import json, re, sys
pat, b = sys.argv[1], sys.argv[2]
old = {s["id"]: (s["f0"], s["f1"]) for s in json.load(open(f"{b}/timing.prev.json"))["shots"]}
new = {s["id"]: (s["f0"], s["f1"]) for s in json.load(open(f"{b}/timing.json"))["shots"]}
moved = sorted(i for i in new if old.get(i) != new[i] and not re.search(pat, i))
if moved:
    print(f"also re-rendered (their length changed): {', '.join(moved)}", file=sys.stderr)
print("|".join([f"(?:{pat})"] + [f"^{re.escape(i)}$" for i in moved]))
EOF
)"
node render_stage.js "$RE" --check
node render_stage.js "$RE"
"$PY" audio.py
OUT_FILE="$("$PY" -c 'import common; print(common.OUT_MP4)')"
if [ -n "${SUBS:-}" ]; then   # another subtitle mode goes to its own file: <video>_subs-off.mp4
  cp "$VIDEO/video.json" "$B/video.json.bak"
  trap 'mv "$B/video.json.bak" "$VIDEO/video.json"' EXIT
  "$PY" -c "import json,sys; p=sys.argv[1]; c=json.load(open(p)); c['subtitles']=sys.argv[2]; json.dump(c,open(p,'w'),ensure_ascii=False,indent=1)" "$VIDEO/video.json" "$SUBS"
  OUT_FILE="${OUT_FILE%.mp4}_subs-$SUBS.mp4"
fi
OUT="$OUT_FILE" "$PY" compose.py
OUT="$OUT_FILE" "$PY" contact_sheet.py
"$PY" metrics.py > /dev/null || true
echo "done: $OUT_FILE  ·  contact sheet: $VIDEO/contact_sheet.jpg"

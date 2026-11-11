#!/usr/bin/env bash
# Build one video end to end.   Usage (from the kit root):  bash engine/build.sh videos/<slug> [--from STEP] [--to STEP]
# Steps: plan tts fonts crops hero media check stage audio avatar compose sheet metrics   (e.g. --from stage to re-render after editing shots.js)
set -euo pipefail
KIT="$(cd "$(dirname "$0")/.." && pwd)"
VIDEO="$(cd "${1:?usage: bash engine/build.sh videos/<slug> [--from STEP]}" && pwd)"; shift
FROM="plan"; TO=""
while [ $# -gt 0 ]; do case "$1" in --from) FROM="$2"; shift 2;; --to) TO="$2"; shift 2;; *) shift;; esac; done
export VIDEO
PY="${PYTHON:-python3}"   # interpreter with the engine deps (numpy scipy pillow pymupdf fonttools brotli)
cd "$KIT/engine"
run=0
step() {
  if [ "$1" = "$FROM" ]; then run=1; fi
  if [ $run = 1 ]; then local name="$1"; echo "== $1"; shift; "$@"; if [ "$name" = "$TO" ]; then echo "== stop after $TO"; exit 0; fi; fi
}
step plan    "$PY" plan.py         # shot_plan.json -> storyboard.json + shots.js (no plan: hand-written files)
step tts     "$PY" tts.py
step fonts   "$PY" fonts.py
step crops   "$PY" crops.py
step hero    "$PY" hero.py          # hero world (one metaphor through 4–6 shots) + single hero shots (OpenRouter key needed; else skipped)
step media   "$PY" media.py         # video inserts: HeyGen heygen-video-1 for empty media slots (HEYGEN_API_KEY; else placeholders)
step check   node render_stage.js --check   # DOM checks -> build/dom_check.json (DOM_STRICT=1: errors stop the build)
step stage   node render_stage.js
step audio   "$PY" audio.py
step avatar  "$PY" avatar.py        # lip-synced avatar.mp4 from the FlashHead service (FLASHHEAD_URL + AVATAR_IMAGE; else placeholder)
step compose "$PY" compose.py
step sheet   "$PY" contact_sheet.py
step metrics "$PY" metrics.py
echo "done: $("$PY" -c 'import common; print(common.OUT_MP4)')"

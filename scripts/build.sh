#!/usr/bin/env bash
# Собрать ролик целиком: свой план -> рендер шотов -> звук -> аватар -> субтитры -> mp4.
#   bash scripts/build.sh videos/<имя>
# Голос, аватар и видеовставки берутся из папки ролика: ключи и GPU не нужны. Итог: videos/<имя>/out/reel_<имя>.mp4
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VID="$(cd "${1:?usage: bash scripts/build.sh videos/<имя>}" && pwd)"; NAME="$(basename "$VID")"
python3 "$ROOT/kit/apply.py" "$VID"
if [ -f "$VID/reel/build/timing.json" ]; then
  bash "$ROOT/engine/redo.sh" "$VID/reel" '.'          # быстрая пересборка готового ролика
else
  bash "$ROOT/engine/build.sh" "$VID/reel"             # в архиве не было сборки — с нуля
fi
mkdir -p "$VID/out"
cp "$VID/reel/reel.mp4" "$VID/out/reel_$NAME.mp4"
ffmpeg -v error -i "$VID/out/reel_$NAME.mp4" -f null - && echo "готово: $VID/out/reel_$NAME.mp4  ·  кадр каждого шота: $VID/reel/contact_sheet.jpg"

#!/usr/bin/env bash
# Один раз: python-пакеты, node-пакеты, Chromium для рендера. Нужны python3, node >= 18, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."
for c in python3 node ffmpeg; do command -v $c >/dev/null || { echo "!! нет $c — поставь его (macOS: brew install $c; Ubuntu: apt install $c)"; exit 1; }; done
python3 -m pip install -q pymupdf fonttools brotli scipy numpy pillow 2>/dev/null || python3 -m pip install -q --break-system-packages pymupdf fonttools brotli scipy numpy pillow
npm ci --ignore-scripts --no-fund --no-audit
npx playwright install chromium
case "$(pwd)" in *"Mobile Documents"*|"$HOME/Documents"*|"$HOME/Desktop"*) echo "?  папка лежит в Документах/на Рабочем столе: если они синхронизируются с iCloud, macOS может выгрузить файлы и рендер зависнет. Лучше держать репозиторий в ~/scitok-reel-studio";; esac
echo "готово"

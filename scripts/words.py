#!/usr/bin/env python3
"""Слова каждой сцены и их время (с от начала сцены) — по ним анимация попадает в слова диктора.

    python3 scripts/words.py videos/<имя>

Пишет то же в videos/<имя>/work/words.txt. Внутри шота время слова даёт wt('слово') / Wv('слово', запас):
если сцена — один шот (так делает kit/apply.py), время от начала шота = время от начала сцены.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vid = os.path.abspath(sys.argv[1]); reel = os.path.join(vid, "reel")
env = dict(os.environ, VIDEO=reel)
eng = os.path.join(ROOT, "engine")
tp = os.path.join(reel, "build", "timing.json")
if not os.path.exists(tp):
    subprocess.run([sys.executable, "plan.py"], cwd=eng, env=env, check=True)
    subprocess.run([sys.executable, "tts.py"], cwd=eng, env=env, check=True, stdout=subprocess.DEVNULL)
t = json.load(open(tp, encoding="utf-8"))
lines = []
for S in t["scenes"]:
    lines.append(f"{S['id']}  {S['dur']:.2f} с  · {S.get('subtitle', '')}")
    lines.append("    " + "  ".join(f"{w['w']}@{w['t0'] - S['t0']:.2f}" for w in S["words"]))
plan = json.load(open(os.path.join(reel, "shot_plan.orig.json" if os.path.exists(os.path.join(reel, "shot_plan.orig.json")) else "shot_plan.json"), encoding="utf-8"))
lines.append("\nисходные шоты (что было):")
for sc in plan["scenes"]:
    for i, sh in enumerate(sc["shots"]):
        kind = next((k for k in ("template", "diagram", "custom", "media") if k in sh), "?")
        what = sh.get("template") or sh.get("diagram") or (sh.get("media") or {}).get("ru", "") if kind != "custom" else "свой код"
        lines.append(f"  {sc['scene']}_{i + 1}  share {sh.get('share')}  {kind}  {str(what)[:70]}  facts {sc.get('fact_ids', [])}")
os.makedirs(os.path.join(vid, "work"), exist_ok=True)
open(os.path.join(vid, "work", "words.txt"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\n".join(lines))

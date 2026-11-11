#!/usr/bin/env python3
"""Собрать reel/shot_plan.json из исходного плана и своих шотов.

    python3 kit/apply.py videos/<имя>

Свои шоты лежат в videos/<имя>/work/:
  <сцена>.js            — сцена целиком становится одним custom-шотом (так проще всего: время слов = время в шоте);
  <сцена>_1.js, _2.js   — сцена из нескольких шотов, доли — в plan.json → "split": {"s3": [0.6, 0.4]};
  _local.js             — твои помощники для этого ролика (вставляются после kit/*.js);
  plan.json             — {"kits": ["core", "chem"], "order": [...], "drop": [...]} (всё необязательно).
Сцены без своего файла остаются как были (шаблоны, видеовставки). "order" — новый порядок сцен,
"drop" — выкинуть сцены (например, без голоса). Текст сцен менять нельзя: голос уже записан.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vid = os.path.abspath(sys.argv[1]); reel = os.path.join(vid, "reel"); work = os.path.join(vid, "work")
orig = os.path.join(reel, "shot_plan.orig.json")
if not os.path.exists(orig):
    sys.exit("!! нет reel/shot_plan.orig.json — импортируй ролик через scripts/import.py")
plan = json.load(open(orig, encoding="utf-8"))
cfg = json.load(open(os.path.join(work, "plan.json"), encoding="utf-8")) if os.path.exists(os.path.join(work, "plan.json")) else {}
read = lambda p: open(p, encoding="utf-8").read()
head = "\n".join(read(os.path.join(ROOT, "kit", k + ".js")) for k in cfg.get("kits", ["core"]))
if os.path.exists(os.path.join(work, "_local.js")):
    head += "\n" + read(os.path.join(work, "_local.js"))
by = {sc["scene"]: sc for sc in plan["scenes"]}
order = [s for s in cfg.get("order", [sc["scene"] for sc in plan["scenes"]]) if s not in set(cfg.get("drop", []))]
unknown = [s for s in order if s not in by]
if unknown:
    sys.exit(f"!! в order неизвестные сцены: {unknown}")
DROP_KEYS = ("template", "props", "diagram", "steps", "media", "hero", "world", "state", "reset", "custom")
n = 0
for sid in order:
    sc = by[sid]; base = sc["shots"][0]
    keep = {k: v for k, v in base.items() if k in ("anchor_word", "sfx", "cut_sfx")}
    one = os.path.join(work, sid + ".js")
    if os.path.exists(one):
        sc["shots"] = [keep | {"share": 1.0, "custom": head + "\n" + read(one), "visual": "custom " + sid}]; n += 1
        continue
    shares = cfg.get("split", {}).get(sid)
    parts = [os.path.join(work, f"{sid}_{i + 1}.js") for i in range(len(shares))] if shares else []
    if parts and all(os.path.exists(p) for p in parts):
        if abs(sum(shares) - 1) > 1e-6:
            sys.exit(f"!! split {sid}: доли в сумме должны давать 1")
        sc["shots"] = [(keep if i == 0 else {}) | {"share": s, "custom": head + "\n" + read(p), "visual": f"custom {sid}_{i + 1}"} for i, (s, p) in enumerate(zip(shares, parts))]; n += len(parts)
plan["scenes"] = [by[s] for s in order]
json.dump(plan, open(os.path.join(reel, "shot_plan.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"plan: {len(order)} сцен, своих шотов {n} -> reel/shot_plan.json")

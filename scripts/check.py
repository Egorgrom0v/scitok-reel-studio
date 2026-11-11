#!/usr/bin/env python3
"""Собрать план и проверить вёрстку всех шотов (DOM): наложения, обрезка краем, мелкий шрифт, текст вне безопасной зоны.

    python3 scripts/check.py videos/<имя>            # все шоты
    python3 scripts/check.py videos/<имя> 's3_|s7_'  # только эти

Строки «!!» — ошибки, их чинить. Предупреждения — посмотреть глазами.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vid = os.path.abspath(sys.argv[1]); reel = os.path.join(vid, "reel"); rx = sys.argv[2] if len(sys.argv) > 2 else "."
env = dict(os.environ, VIDEO=reel); eng = os.path.join(ROOT, "engine"); B = os.path.join(reel, "build")
run = lambda *a, **k: subprocess.run(list(a), cwd=eng, env=env, check=True, **k)
run(sys.executable, os.path.join(ROOT, "kit", "apply.py"), vid)
run(sys.executable, "plan.py")
run(sys.executable, "tts.py", stdout=subprocess.DEVNULL)
if not os.path.exists(os.path.join(B, "fonts.css")): run(sys.executable, "fonts.py")
if not os.path.exists(os.path.join(B, "crops.json")): run(sys.executable, "crops.py")
r = subprocess.run(["node", "render_stage.js", rx, "--check"], cwd=eng, env=env, capture_output=True, text=True)
if r.returncode:
    print(r.stdout[-3000:], r.stderr[-3000:]); sys.exit("!! шот не запустился (ошибка JS выше)")
d = json.load(open(os.path.join(B, "dom_check.json"), encoding="utf-8"))
for s in d["shots"]:
    for i in s["issues"]:
        print(("!! " if i["severity"] == "error" else "?  ") + f"{s['id']} {i.get('t', 0):.2f}s {i['msg']}")
print(f"dom check: {d['errors']} ошибок, {d['warnings']} предупреждений")

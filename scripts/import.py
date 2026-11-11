#!/usr/bin/env python3
"""Взять архив ролика с сайта SciTok и разложить его для доработки.

    python3 scripts/import.py ~/Downloads/research-reels-<job_id>-debug.zip [имя]
    python3 scripts/import.py ~/Downloads/research-reels-<job_id>-debug/      [имя]   # уже распакованная папка

Кладёт в videos/<имя>/: reel/ (папка ролика для движка), v4/ (бриф: факты с цитатами), figures/, portrait.png.
Сохраняет исходный план как reel/shot_plan.orig.json — kit/apply.py всегда собирает план от него.
Проверяет, что ролик целый: голос всех сцен, аватар, видеовставки. Чего нет — пишет, что делать.
"""
import json, os, re, shutil, subprocess, sys, tempfile, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def dur(p):
    try:
        return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                                    capture_output=True, text=True).stdout.strip() or 0)
    except ValueError:
        return 0.0


def find_artifacts(base):
    for dp, dn, fn in os.walk(base):
        if os.path.basename(dp) == "reel" and "shot_plan.json" in fn:
            return os.path.dirname(dp)
    sys.exit(f"!! в {base} нет папки reel/ с shot_plan.json — это точно архив ролика SciTok («Скачать полный архив генерации»)?")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = os.path.abspath(os.path.expanduser(sys.argv[1]))
    if "Mobile Documents" in os.path.realpath(src):
        print("!! файл лежит в папке iCloud: если macOS выгрузила его в облако, чтение может зависнуть. Скопируй архив в Загрузки.")
    job = re.search(r"([0-9a-f]{32})", os.path.basename(src.rstrip("/")))
    name = sys.argv[2] if len(sys.argv) > 2 else (job.group(1)[:8] if job else "reel1")
    dst = os.path.join(ROOT, "videos", name)
    if os.path.exists(os.path.join(dst, "reel")):
        sys.exit(f"!! videos/{name} уже есть. Удали её или дай другое имя вторым аргументом.")
    tmp = None
    if zipfile.is_zipfile(src):
        tmp = tempfile.mkdtemp(prefix="scitok_")
        with zipfile.ZipFile(src) as z:
            for m in z.namelist():                       # не даём архиву писать за пределы временной папки
                if m.startswith("/") or ".." in m.split("/"):
                    sys.exit(f"!! странный путь в архиве: {m}")
            z.extractall(tmp)
        base = tmp
    else:
        base = src
    art = find_artifacts(base)
    os.makedirs(dst, exist_ok=True)
    shutil.copytree(os.path.join(art, "reel"), os.path.join(dst, "reel"))
    for sub in ("v4", "figures"):
        if os.path.isdir(os.path.join(art, sub)):
            shutil.copytree(os.path.join(art, sub), os.path.join(dst, sub))
    for p in ("avatar/source.png", "avatar/source.jpg", "reel/portrait.png", "v4/portrait.png"):
        if os.path.exists(os.path.join(art, p)):
            shutil.copy(os.path.join(art, p), os.path.join(dst, "portrait.png")); break
    if tmp:
        shutil.rmtree(tmp, ignore_errors=True)

    reel = os.path.join(dst, "reel")
    shutil.copy(os.path.join(reel, "shot_plan.json"), os.path.join(reel, "shot_plan.orig.json"))
    plan = json.load(open(os.path.join(reel, "shot_plan.json"), encoding="utf-8"))
    al = {}
    if os.path.exists(os.path.join(reel, "alignment.json")):
        a = json.load(open(os.path.join(reel, "alignment.json"), encoding="utf-8"))
        al = a.get("scenes", {}) if isinstance(a, dict) else {}

    print(f"ролик: videos/{name}  ·  сцен {len(plan['scenes'])}")
    problems = []
    # голос
    for sc in plan["scenes"]:
        sid = sc["scene"]; w = os.path.join(reel, "voice", sid + ".wav")
        d = dur(w) if os.path.exists(w) else 0.0
        need = max((x.get("t1", 0) for x in al.get(sid, [])), default=0)
        if d < 0.3 or (need and d + 0.05 < need):
            problems.append(f"голос сцены {sid}: файл {d:.2f} с, а слова идут до {need:.2f} с — озвучка обрезана")
    # аватар
    if not os.path.exists(os.path.join(reel, "avatar.mp4")):
        port = os.path.join(dst, "portrait.png")
        if os.path.exists(port):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", port, "-vf",
                            "scale=1200:1200,zoompan=z='1+0.04*on/2400':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1080:fps=30",
                            "-frames:v", "2400", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
                            os.path.join(reel, "avatar.mp4")], check=True)
            problems.append("нет avatar.mp4 — поставлена заглушка из портрета (без движения губ)")
        else:
            problems.append("нет avatar.mp4 и портрета — внизу будет серая заглушка")
    # видеовставки
    for sc in plan["scenes"]:
        for i, sh in enumerate(sc["shots"]):
            if sh.get("media"):
                sid = f"{sc['scene']}_{i + 1}"
                if not any(os.path.exists(os.path.join(reel, "media", sid + e)) for e in (".mp4", ".mov", ".webm", ".png", ".jpg")):
                    problems.append(f"шот {sid}: видеовставки нет — на её месте заглушка «ГЕНЕРАЦИЯ»; замени шот своей анимацией")
    built = os.path.exists(os.path.join(reel, "build", "timing.json"))
    print("сборка в архиве: " + ("есть (быстрая пересборка redo.sh)" if built else "нет (соберётся с нуля, это дольше)"))
    for p in problems:
        print("!! " + p)
    if not problems:
        print("всё на месте: голос, аватар, вставки")
    print(f"\nдальше:  python3 scripts/words.py videos/{name}      # слова и их время по сценам")


if __name__ == "__main__":
    main()

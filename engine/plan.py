"""Step 0: shot plan -> storyboard.json + shots.js (+ crops.py).

The director (backend, pipeline v4) writes <video>/shot_plan.json: per scene the
text and a list of shots, each shot either a template from tpl/catalog.json with
its props, a media slot (generation / outside footage) or a hand-written
``custom`` shot body. This step compiles it into the files the rest of the
engine reads, so a hand-made video folder (storyboard.json + shots.js written by
a person) keeps working: without shot_plan.json the step does nothing.

The backend validates the plan against the fact registry before export
(video_backend/shot_plan.py). Here only the structure is checked again, so a
broken plan stops the build with a readable message instead of a blank shot.
"""
import json, os, re, sys
from common import VIDEO

TPL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tpl")
PLAN = os.path.join(VIDEO, "shot_plan.json")
GENERATED = "# generated from shot_plan.json by engine/plan.py"
SHOT_KEYS = ("share", "source", "anchor_word", "badge", "sfx", "cut_sfx")


def load_catalog():
    with open(os.path.join(TPL_DIR, "catalog.json"), encoding="utf-8") as f:
        return json.load(f)["templates"]


def check_props(props, schema, where, errors):
    if not isinstance(props, dict):
        errors.append(f"{where}: props must be an object"); return
    for key in props:
        if key not in schema:
            errors.append(f"{where}: unknown prop '{key}' (allowed: {', '.join(schema)})")
    for key, spec in schema.items():
        if spec.get("required") and props.get(key) in (None, "", []):
            errors.append(f"{where}: required prop '{key}' is missing")
        val = props.get(key)
        if val is None: continue
        if spec["type"] == "list":
            if not isinstance(val, list): errors.append(f"{where}.{key}: must be a list"); continue
            for i, item in enumerate(val): check_props(item, spec["item"], f"{where}.{key}[{i}]", errors)
        elif spec["type"] == "object":
            check_props(val, spec["props"], f"{where}.{key}", errors)


def compile_plan(plan, catalog):
    errors, scenes, sh_lines = [], [], []
    crops = plan.get("crops") or {}
    diagrams = plan.get("diagrams") or {}
    done = {}  # diagram id -> steps already played in earlier shots (replayed instantly)
    hero_path = os.path.join(VIDEO, "hero_code.json")
    heroes = json.load(open(hero_path, encoding="utf-8")) if os.path.exists(hero_path) else {}
    world = load_world()   # engine/hero.py wrote the hero world: one code, a state per shot
    ids = [f"{sc.get('scene')}_{j + 1}" for sc in plan.get("scenes", []) for j, _ in enumerate(sc.get("shots") or [])]
    all_shots = [s for sc in plan.get("scenes", []) for s in sc.get("shots") or []]
    # the plan still asks for the world on this shot (a re-plan may have moved it) and the world has the state
    in_world = [bool(world) and i in world["shots"] and s.get("world") == world["id"] and s.get("state") == world["shots"][i]
                for i, s in zip(ids, all_shots)]
    flat = [None if i in heroes or w else s.get("diagram") for i, s, w in zip(ids, all_shots, in_world)]
    k_flat = -1
    for sc in plan.get("scenes", []):
        sid = sc.get("scene")
        if not sid: errors.append("scene without id"); continue
        shots = []
        for j, shot in enumerate(sc.get("shots") or []):
            shot_id, where = f"{sid}_{j + 1}", f"{sid}_{j + 1}"
            out = {k: shot[k] for k in SHOT_KEYS if k in shot}
            out.setdefault("badge", ""); out.setdefault("sfx", "none")
            # sound_design "custom": a soft whoosh on every cut (as in the hand-made videos) unless the plan says otherwise
            if "cut_sfx" not in shot and (scenes or j > 0):
                out["cut_sfx"] = {"name": "Whoosh_6", "lead": 0.12}
            k_flat += 1
            kinds = [k for k in ("template", "media", "custom", "diagram") if shot.get(k)]
            if in_world[k_flat]:   # a state of the hero world; the planned shot is the fallback
                state = world["shots"][shot_id]
                o = {"cont_prev": k_flat > 0 and in_world[k_flat - 1] and world["shots"][ids[k_flat - 1]] == state - 1,
                     "cont_next": k_flat + 1 < len(ids) and in_world[k_flat + 1] and world["shots"][ids[k_flat + 1]] == state + 1}
                sh_lines.append(f"SH[{json.dumps(shot_id)}] = () => HW_RUN({json.dumps(world['id'])}, {state}, {json.dumps(o)});")
                out["visual"] = f"мир {world['id']}, состояние {state}"
                out.setdefault("source", "СХЕМА")
                if o["cont_prev"]: out.pop("cut_sfx", None)  # the picture just goes on
                if shot.get("diagram"):
                    done[shot["diagram"]] = done.get(shot["diagram"], []) + (shot.get("steps") or [])
                shots.append(out)
                continue
            if shot_id in heroes and shot.get("hero"):   # engine/hero.py wrote this shot by hand; the planned one is the fallback
                sh_lines.append(f"SH[{json.dumps(shot_id)}] = () => {{\n{heroes[shot_id]}\n}};")
                out["visual"] = "герой: " + str(shot["hero"])[:60]
                out.setdefault("source", "СХЕМА")
                if shot.get("diagram"):   # keep the diagram's story for the shots after it
                    done[shot["diagram"]] = done.get(shot["diagram"], []) + (shot.get("steps") or [])
                shots.append(out)
                continue
            if len(kinds) != 1:
                errors.append(f"{where}: a shot needs exactly one of template / media / custom / diagram, got {kinds or 'none'}")
            elif kinds[0] == "diagram":
                did = shot["diagram"]
                if did not in diagrams:
                    errors.append(f"{where}: diagram '{did}' is not defined in plan.diagrams")
                else:
                    if shot.get("reset"): done[did] = []
                    props = {
                        "objects": diagrams[did].get("objects") or [],
                        "prior": done.get(did, []),
                        "steps": shot.get("steps") or [],
                        # the same picture on both sides of a cut: no exit and no entrance, it just goes on
                        "cont_prev": bool(done.get(did) is not None and k_flat > 0 and flat[k_flat - 1] == did and not shot.get("reset")),
                        "cont_next": k_flat + 1 < len(flat) and flat[k_flat + 1] == did,
                    }
                    if shot.get("eyebrow"): props["eyebrow"] = shot["eyebrow"]
                    if diagrams[did].get("title"): props["title"] = diagrams[did]["title"]  # what the picture is, on every shot
                    done[did] = done.get(did, []) + props["steps"]
                    sh_lines.append(f"SH[{json.dumps(shot_id)}] = () => TPL.diagram({json.dumps(props, ensure_ascii=False)});")
                    if props["cont_prev"]: out.pop("cut_sfx", None)  # an invisible cut has no whoosh
                out["visual"] = shot.get("visual") or f"схема {did}"
                out.setdefault("source", "СХЕМА")
            elif kinds[0] == "template":
                name = shot["template"]
                if name not in catalog:
                    errors.append(f"{where}: unknown template '{name}'")
                else:
                    props = shot.get("props") or {}
                    check_props(props, catalog[name]["props"], where, errors)
                    for key, spec in catalog[name]["props"].items():
                        if spec["type"] == "crop" and props.get(key) and props[key] not in crops:
                            errors.append(f"{where}: crop '{props[key]}' is not defined in plan.crops")
                    sh_lines.append(f"SH[{json.dumps(shot_id)}] = () => TPL.{name}({json.dumps(props, ensure_ascii=False)});")
                out["visual"] = shot.get("visual") or name
                out.setdefault("source", "СХЕМА")
            elif kinds[0] == "media":
                out["media"] = shot["media"]
                out["visual"] = shot.get("visual") or shot["media"].get("ru", "")
                out.setdefault("source", "ГЕН" if shot["media"].get("kind") == "gen" else "ВНЕШНЕЕ")
            else:
                code = shot["custom"]
                sh_lines.append(f"SH[{json.dumps(shot_id)}] = () => {{\n{code}\n}};")
                out["visual"] = shot.get("visual") or "custom"
                out.setdefault("source", "СХЕМА")
            shots.append(out)
        scenes.append({"scene": sid, "beat": sc.get("beat", ""), "subtitle": sc["subtitle"], "tts": sc.get("tts") or sc["subtitle"],
                       "accent": pick_accent(sc), "claims": sc.get("claims", []), "shots": shots})
    return scenes, sh_lines, errors


def load_world():
    """<video>/hero_world.json {"id", "code", "shots": {shot_id: state}} or None (no world, or it failed)."""
    path = os.path.join(VIDEO, "hero_world.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        w = json.load(f)
    if not w.get("code") or not w.get("shots") or not re.fullmatch(r"w\d+", str(w.get("id", ""))):
        return None
    return w


def _word(w):
    return re.sub(r"[^\wё]", "", w.lower())


def pick_accent(sc):
    """The accented subtitle word (compose.py needs one per scene): the planned one if it is a word of
    the subtitle, else the anchor of the first shot, else the longest word."""
    words = [w for w in sc["subtitle"].replace("«", "").replace("»", "").split() if _word(w)]
    norm = {_word(w): w for w in words}
    for cand in (sc.get("accent"), *(s.get("anchor_word") for s in sc.get("shots") or [])):
        if cand and _word(cand) in norm:
            return norm[_word(cand)]
    return max(words, key=lambda w: len(_word(w))) if words else ""


def crops_py(crops):
    lines = [GENERATED]
    for name, c in crops.items():
        pg = int(c["page"])
        clip = "doc[%d].rect" % (pg - 1) if c.get("clip") in (None, "page") else tuple(float(x) for x in c["clip"])
        hls = []
        for h in c.get("highlights") or []:
            if isinstance(h, list): hls.append(repr(tuple(float(x) for x in h)))
            elif "word" in h: hls.append(f"word({pg}, {h['word']!r}, clip={'None' if c.get('clip') in (None, 'page') else 'CLIP'}, n={int(h.get('n', 0))})")
            else: hls.append(f"find({pg}, {h['text']!r}, {int(h.get('n', 0))})[0]")
        clip_src = clip if isinstance(clip, str) else repr(clip)
        lines.append(f"CLIP = {clip_src}")
        lines.append(f"crop({name!r}, {pg}, CLIP, [{', '.join(hls)}], rotate={int(c.get('rotate', 0))}, "
                     f"pad={float(c.get('pad', 2.5))}, label={c.get('label', '')!r})")
    return "\n".join(lines) + "\n"


def main():
    if not os.path.exists(PLAN):
        print("no shot_plan.json — storyboard.json and shots.js are hand-written"); return
    with open(PLAN, encoding="utf-8") as f:
        plan = json.load(f)
    scenes, sh_lines, errors = compile_plan(plan, load_catalog())
    if errors:
        print("shot_plan.json has errors:\n  " + "\n  ".join(errors), file=sys.stderr); sys.exit(1)
    with open(os.path.join(VIDEO, "storyboard.json"), "w", encoding="utf-8") as f:
        json.dump(scenes, f, ensure_ascii=False, indent=1)
    parts = [f"// {GENERATED[2:]} — edit the plan, not this file"]
    for name in ("ds_apple.js", "templates.js", "diagram.js", "world.js"):
        with open(os.path.join(TPL_DIR, name), encoding="utf-8") as f: parts.append(f.read())
    world = load_world()
    if world and any(ln.startswith("SH") and "HW_RUN(" in ln for ln in sh_lines):
        parts.append(f"HW.{world['id']} = () => {{\n{world['code']}\n}};")
    parts.append("\n".join(sh_lines))
    with open(os.path.join(VIDEO, "shots.js"), "w", encoding="utf-8") as f:
        f.write("\n".join(parts) + "\n")
    cp = os.path.join(VIDEO, "crops.py")
    if plan.get("crops"):
        hand = os.path.exists(cp) and not open(cp, encoding="utf-8").read().startswith(GENERATED)
        if hand: print("note: crops.py is hand-written, plan.crops ignored")
        else:
            with open(cp, "w", encoding="utf-8") as f: f.write(crops_py(plan["crops"]))
    n = sum(len(s["shots"]) for s in scenes)
    print(f"plan: {len(scenes)} scenes, {n} shots, {len(sh_lines)} template/custom, {n - len(sh_lines)} media")


if __name__ == "__main__":
    main()

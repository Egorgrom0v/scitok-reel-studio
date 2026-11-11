"""Step hero: the hero world and hand-coded shots for the places the director marked with "hero" (pipeline v4).

Hero world (01.11): one drawn metaphor of the paper lives through 4–6 shots marked {"world": "w1", "state": k}.
The LLM writes the world once (HW.w1 = () => [state0, state1, …], see tpl/world.js); all its shots are rendered
and shown to the model in one message, up to ROUNDS times. States that still fail drop out from the first
broken one on (later states build on it); a world with fewer than two clean shots is dropped. Writes
<video>/hero_world.json {"id", "idea", "code", "shots": {shot_id: state}}; the failed attempt is kept in
hero_world.failed.json for the debug bundle. World shots keep their planned shot as the fallback.

Single hero shots (up to HERO_MAX, default 4):

For each such shot an LLM (Sonnet via OpenRouter, the same key and proxy as the
backend) writes the shot body on the design-system API, the shot is rendered to
stills (25 / 60 / 92 %) with the DOM check, and the model looks at the frames and
fixes them, up to ROUNDS times. A shot that still fails (JS error, DOM errors)
keeps the director's own template or diagram shot, so the video never breaks.

Writes <video>/hero_code.json {shot_id: code}; plan.py puts the code in shots.js.
No hero shots or no API key: nothing to do. Only the standard library is used.

Env: VIDEO_BACKEND_OPENROUTER_API_KEY (or OPENROUTER_API_KEY), VIDEO_BACKEND_OPENROUTER_PROXY_URL,
HERO_MODEL (default anthropic/claude-sonnet-5.5), HERO_ROUNDS (default 2).
"""
import base64, glob, json, os, re, subprocess, sys, time, urllib.request
from common import VIDEO, BUILD

ENGINE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.join(ENGINE, "tpl")
PLAN = os.path.join(VIDEO, "shot_plan.json")
OUT = os.path.join(VIDEO, "hero_code.json")
WORLD = os.path.join(VIDEO, "hero_world.json")
META = os.path.join(VIDEO, "hero_meta.json")  # {shot_id: idea}: a re-run (repair of other shots) keeps finished heroes
MODEL = os.environ.get("HERO_MODEL", "anthropic/claude-sonnet-5.5")
ROUNDS = int(os.environ.get("HERO_ROUNDS", "2"))
MAX_HEROES = int(os.environ.get("HERO_MAX", "4"))  # 01.11: two were too few, and one of them failed
KEY = os.environ.get("VIDEO_BACKEND_OPENROUTER_API_KEY") or os.environ.get("OPENROUTER_API_KEY") or ""
PROXY = os.environ.get("VIDEO_BACKEND_OPENROUTER_PROXY_URL") or os.environ.get("HTTPS_PROXY") or ""
URL = os.environ.get("OPENROUTER_URL", "https://openrouter.ai/api/v1/chat/completions")


def chat(messages, max_tokens=12000):
    body = {"model": MODEL, "messages": messages, "max_tokens": max_tokens,
            "response_format": {"type": "json_object"}, "reasoning": {"max_tokens": 3000}}
    handlers = [urllib.request.ProxyHandler({"https": PROXY, "http": PROXY})] if PROXY else []
    opener = urllib.request.build_opener(*handlers)
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    for attempt in range(3):
        try:
            with opener.open(req, timeout=300) as r:
                data = json.loads(r.read())
            msg = data["choices"][0]["message"]
            text = msg.get("content") or ""
            m = re.search(r"\{.*\}", text, re.S)
            if not m:
                raise ValueError(f"no JSON in the answer: {text[:200]!r}")
            usage = data.get("usage") or {}
            print(f"  llm: {usage.get('prompt_tokens')} in / {usage.get('completion_tokens')} out, ${usage.get('cost', 0):.3f}")
            return json.loads(m.group(0))
        except Exception as e:  # noqa: BLE001 — network hiccups and a bad answer are retried
            print(f"  llm attempt {attempt + 1} failed: {e}")
            time.sleep(3)
    return None


def image_part(path):
    return {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()}}


def render(shot_id, still_at="0.25,0.6,0.92"):
    """Stills + DOM check of one shot. Returns (error text or '', [png paths], [dom issues])."""
    env = {**os.environ, "VIDEO": VIDEO, "STILL_AT": still_at}
    pat = f"^{re.escape(shot_id)}$"
    for f in glob.glob(os.path.join(BUILD, "stills", shot_id + "_p*.png")):
        os.remove(f)
    r = subprocess.run(["node", "render_stage.js", pat, "--still"], cwd=ENGINE, env=env, capture_output=True, text=True, timeout=600)
    if r.returncode != 0:
        return (r.stderr or r.stdout)[-1500:], [], []
    c = subprocess.run(["node", "render_stage.js", pat, "--check"], cwd=ENGINE, env=env, capture_output=True, text=True, timeout=600)
    issues = []
    try:
        rep = json.load(open(os.path.join(BUILD, "dom_check.json")))
        issues = [i for s in rep["shots"] if s["id"] == shot_id for i in s["issues"]]
    except Exception:  # noqa: BLE001
        pass
    if c.returncode != 0 and not issues:
        return (c.stderr or c.stdout)[-1500:], [], []
    return "", sorted(glob.glob(os.path.join(BUILD, "stills", shot_id + "_p*.png"))), issues


def compile_plan():
    r = subprocess.run([sys.executable, "plan.py"], cwd=ENGINE, env={**os.environ, "VIDEO": VIDEO}, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("plan.py failed: " + r.stderr[-800:])


def shot_words(timing, shot_id, scene_id):
    tsh = next((s for s in timing["shots"] if s["id"] == shot_id), None)
    tsc = next((s for s in timing["scenes"] if s["id"] == scene_id), None)
    if not tsh or not tsc:
        return None, []
    return tsh, [{"w": w["w"], "t0": round(w["t0"] - tsh["t0"], 2)} for w in tsc["words"] if tsh["t0"] - 0.3 <= w["t0"] <= tsh["t1"]]


def world_items(plan):
    """[(shot_id, scene, shot)] of the hero world, in state order: one world (the first id), states 0, 1, 2 … without gaps."""
    marked = [(f"{sc['scene']}_{j + 1}", sc, shot) for sc in plan.get("scenes", []) for j, shot in enumerate(sc.get("shots") or [])
              if shot.get("world")]
    if not marked:
        return None, []
    wid = str(marked[0][2]["world"])
    items, want = [], 0
    for item in marked:   # plan order is the story order; a state out of order ends the world there
        if item[2]["world"] == wid and item[2].get("state") == want:
            items.append(item); want += 1
        elif item[2]["world"] == wid:
            print(f"world {wid}: {item[0]} has state {item[2].get('state')}, expected {want} — the world ends before it"); break
    return wid, items


def api_section():
    """Frame, style and API of the single-hero prompt (the world prompt adds its own contract)."""
    text = open(os.path.join(TPL, "hero_prompt.md"), encoding="utf-8").read()
    a, b = text.find("## Кадр и стиль"), text.find("## Примеры")
    body = text[a:b] if a >= 0 and b > a else text
    return body.replace("- Шот кончается `exitAll()` — всё мягко уходит.\n", "")


def make_world(plan, timing, crops, examples):
    wid, items = world_items(plan)
    if not items:
        if os.path.exists(WORLD): os.remove(WORLD)
        return
    concept = plan.get("concept") or {}
    hw = concept.get("hero_world") or {}
    idea = hw.get("idea") or next((shot.get("hero") for _, _, shot in items if shot.get("hero")), "") or ""
    changes = {str(s.get("scene_id")): s.get("change") or s.get("idea") or "" for s in hw.get("states") or [] if isinstance(s, dict)}
    mapping = {shot_id: shot["state"] for shot_id, _, shot in items}
    if len(items) < 2:
        print(f"world {wid}: {len(items)} shot — not a world, the director's shot stays")
        if os.path.exists(WORLD): os.remove(WORLD)
        return
    failed = WORLD.replace(".json", ".failed.json")
    for path, what in ((WORLD, "already made"), (failed, "already failed")):   # a re-run (repair of other shots) does not pay again
        old = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
        if old.get("code") and old.get("id") == wid and old.get("idea") == idea and old.get("asked") == mapping:
            print(f"world {wid}: {what} for this idea")
            if what == "already failed" and os.path.exists(WORLD): os.remove(WORLD)
            return
    states = []
    for shot_id, sc, shot in items:
        tsh, words = shot_words(timing, shot_id, sc["scene"])
        if not tsh:
            print(f"world {wid}: no timing for {shot_id}"); return
        states.append({"state": shot["state"], "shot_id": shot_id, "phrase": sc["subtitle"],
                       "change": changes.get(sc["scene"]) or shot.get("hero") or "", "duration_s": round(tsh["t1"] - tsh["t0"], 2),
                       "words": words, "numbers_allowed": sorted({n for n in re.findall(r"\d+(?:[.,]\d+)?", sc["subtitle"])})})
    task = {"world_id": wid, "idea": idea, "mechanism": concept.get("mechanism"), "states": states,
            "crops": {k: {"w": v["w"], "h": v["h"], "label": v.get("label", "")} for k, v in crops.items()}, "examples": examples}
    system = open(os.path.join(TPL, "hero_world_prompt.md"), encoding="utf-8").read() + "\n\n" + api_section()
    print(f"world {wid}: {len(items)} shots ({', '.join(mapping)}): {idea[:80]}")
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": json.dumps(task, ensure_ascii=False)}]
    code = (chat(msgs, max_tokens=20000) or {}).get("code")
    results = {}
    for rnd in range(ROUNDS + 1):
        if not code:
            break
        json.dump({"id": wid, "idea": idea, "code": code, "shots": mapping, "asked": mapping}, open(WORLD, "w"), ensure_ascii=False, indent=1)
        compile_plan()
        results = {shot_id: render(shot_id, "0.15,0.9") for shot_id in mapping}
        bad = {i: (err.strip()[-600:] if err else [x for x in issues if x["severity"] == "error"]) for i, (err, _, issues) in results.items()
               if err or any(x["severity"] == "error" for x in issues)}
        print(f"  world round {rnd}: {len(mapping) - len(bad)}/{len(mapping)} shots clean" + (f", broken: {', '.join(bad)}" if bad else ""))
        if rnd == ROUNDS:
            break
        parts = [{"type": "text", "text": "Шоты мира по порядку, у каждого кадр в начале (15 %) и в конце (90 %). Проверка: "
                  + json.dumps({i: v for i, v in bad.items()} or "ошибок нет", ensure_ascii=False)}]
        for shot_id, (err, stills, _) in results.items():
            parts.append({"type": "text", "text": f"{shot_id} — состояние {mapping[shot_id]}" + (" (ошибка JS, кадров нет)" if err else "")})
            parts += [image_part(p) for p in stills]
        msgs += [{"role": "assistant", "content": json.dumps({"code": code}, ensure_ascii=False)}, {"role": "user", "content": parts}]
        ans = chat(msgs, max_tokens=20000)
        if ans and ans.get("ok") and not bad:
            break
        new = (ans or {}).get("code")
        if not new:
            break
        code = new
    # states build on each other: keep the shots up to the first broken one
    keep = {}
    for shot_id, state in mapping.items():
        err, _, issues = results.get(shot_id, ("not rendered", [], []))
        if err or any(x["severity"] == "error" for x in issues):
            break
        keep[shot_id] = state
    if len(keep) < 2:
        print(f"  world {wid}: dropped, the director's shots stay")
        if code:
            json.dump({"id": wid, "idea": idea, "code": code, "shots": mapping, "asked": mapping}, open(failed, "w"), ensure_ascii=False, indent=1)
        if os.path.exists(WORLD): os.remove(WORLD)
    else:
        if len(keep) < len(mapping):
            print(f"  world {wid}: keeps {', '.join(keep)}; the rest fall back to the director's shots")
        json.dump({"id": wid, "idea": idea, "code": code, "shots": keep, "asked": mapping}, open(WORLD, "w"), ensure_ascii=False, indent=1)
        if os.path.exists(failed): os.remove(failed)
    compile_plan()


def main():
    if not os.path.exists(PLAN):
        print("no shot_plan.json — no hero shots"); return
    plan = json.load(open(PLAN, encoding="utf-8"))
    heroes = [(f"{sc['scene']}_{j + 1}", sc, shot) for sc in plan.get("scenes", []) for j, shot in enumerate(sc.get("shots") or [])
              if shot.get("hero") and not shot.get("world")]
    if not heroes and not world_items(plan)[1]:
        print("no hero shots")
        if os.path.exists(WORLD): os.remove(WORLD); compile_plan()
        return
    if not KEY:
        print("hero: no OpenRouter key in the environment — the director's shots stay"); return
    timing = json.load(open(os.path.join(BUILD, "timing.json")))
    crops = json.load(open(os.path.join(BUILD, "crops.json"))) if os.path.exists(os.path.join(BUILD, "crops.json")) else {}
    system = open(os.path.join(TPL, "hero_prompt.md"), encoding="utf-8").read()
    examples = open(os.path.join(TPL, "hero_examples.js"), encoding="utf-8").read()
    make_world(plan, timing, crops, examples)
    codes = json.load(open(OUT)) if os.path.exists(OUT) else {}
    meta = json.load(open(META)) if os.path.exists(META) else {}
    wanted = {shot_id for shot_id, _, _ in heroes[:MAX_HEROES]}
    for gone in [k for k in codes if k not in wanted]:
        codes.pop(gone); meta.pop(gone, None)
    for shot_id, sc, shot in heroes[:MAX_HEROES]:
        if codes.get(shot_id) and meta.get(shot_id) == shot["hero"]:
            print(f"hero {shot_id}: already made for this idea"); continue
        tsh = next((s for s in timing["shots"] if s["id"] == shot_id), None)
        tsc = next((s for s in timing["scenes"] if s["id"] == sc["scene"]), None)
        if not tsh or not tsc:
            continue
        words = [{"w": w["w"], "t0": round(w["t0"] - tsh["t0"], 2)} for w in tsc["words"] if tsh["t0"] - 0.3 <= w["t0"] <= tsh["t1"]]
        task = {
            "shot_id": shot_id, "idea": shot["hero"], "phrase": sc["subtitle"],
            "mechanism": (plan.get("concept") or {}).get("mechanism"), "duration_s": round(tsh["t1"] - tsh["t0"], 2),
            "words": words, "numbers_allowed": sorted({n for n in re.findall(r"\d+(?:[.,]\d+)?", sc["subtitle"])}),
            "fallback_shot": {k: shot[k] for k in ("template", "props", "diagram", "steps") if k in shot},
            "crops": {k: {"w": v["w"], "h": v["h"], "label": v.get("label", "")} for k, v in crops.items()},
            "examples": examples,
        }
        print(f"hero {shot_id}: {shot['hero'][:80]}")
        msgs = [{"role": "system", "content": system}, {"role": "user", "content": json.dumps(task, ensure_ascii=False)}]
        ans = chat(msgs)
        code = (ans or {}).get("code")
        ok = False
        for rnd in range(ROUNDS + 1):
            if not code:
                break
            codes[shot_id] = code
            json.dump(codes, open(OUT, "w"), ensure_ascii=False, indent=1)
            compile_plan()
            err, stills, issues = render(shot_id)
            errors = [i for i in issues if i["severity"] == "error"]
            clean = not err and not errors
            first = next((ln.strip() for ln in (err or "").splitlines() if "Error" in ln), (err or "").strip()[:160])
            print(f"  round {rnd}: {'JS error: ' + first[:200] if err else f'{len(errors)} DOM errors, {len(issues) - len(errors)} warnings'}")
            if rnd == ROUNDS:
                ok = clean
                break
            note = {"render_error": err} if err else {"dom_issues": issues}
            parts = [{"type": "text", "text": "Кадры шота (25 %, 60 %, 92 %) и проверка: " + json.dumps(note, ensure_ascii=False)}]
            parts += [image_part(p) for p in stills]
            msgs += [{"role": "assistant", "content": json.dumps({"code": code}, ensure_ascii=False)}, {"role": "user", "content": parts}]
            ans = chat(msgs)
            if ans and ans.get("ok") and clean:
                ok = True
                break
            new = (ans or {}).get("code")
            if not new:
                ok = clean
                break
            code = new
        if not ok:
            print(f"  {shot_id}: keeps the director's shot")
            codes.pop(shot_id, None)
            meta.pop(shot_id, None)
        else:
            meta[shot_id] = shot["hero"]
        json.dump(codes, open(OUT, "w"), ensure_ascii=False, indent=1)
        json.dump(meta, open(META, "w"), ensure_ascii=False, indent=1)
    compile_plan()
    world = json.load(open(WORLD, encoding="utf-8")) if os.path.exists(WORLD) else {}
    print(f"hero: {len(codes)} hand-coded shot(s): {', '.join(codes) or '—'}; world: {', '.join(world.get('shots') or {}) or '—'}")


if __name__ == "__main__":
    main()

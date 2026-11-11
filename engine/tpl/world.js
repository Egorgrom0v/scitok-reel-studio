// SciTok · «геройский мир» (pipeline v4, 01.11): одна нарисованная метафора статьи тянется через 4–6 фраз.
// Агент героя пишет мир один раз:
//   HW.w1 = () => { const w = {}; return [ () => { /* состояние 0: строит мир */ }, () => { /* 1: что добавилось */ }, … ]; };
// Каждое состояние пишется обычным API шота (Tx, Kc, chip, inA, tl.to …) на словах своей фразы (wt('слово') ?? запас).
// Шот мира = HW_RUN('w1', k): состояния 0…k-1 проматываются мгновенно (их анимации сразу в конечном виде,
// звуки не звучат), состояние k играет на словах этой фразы. Как живая схема: прошлые шаги — мгновенно, свои — на словах.
// Загружается после lib.js, ds_apple.js, templates.js, diagram.js.

const HW = {};

// all tweens / sets / calls the code adds to the shot timeline are applied at once, in time order, and taken out of it
function HW_instant(fn) {
  const before = new Set(tl.getChildren(false, true, true));
  const nsfx = window.SFX_EVENTS.length;
  fn();
  const added = tl.getChildren(false, true, true).filter((c) => !before.has(c));
  added.sort((a, b) => a.startTime() - b.startTime());
  for (const c of added) {
    tl.remove(c);
    c.progress(1, false);   // events on: a tl.call() (text swap) runs too
    c.kill();
  }
  window.SFX_EVENTS.length = nsfx;
}

// o.cont_prev: the shot before was this world (the cut is invisible); o.cont_next: the next one is too (no exit)
function HW_RUN(id, k, o = {}) {
  if (typeof HW[id] !== 'function') throw new Error(`world ${id} is not defined`);
  const states = HW[id]();
  if (!Array.isArray(states) || typeof states[k] !== 'function') throw new Error(`world ${id}: no state ${k} (has ${Array.isArray(states) ? states.length : 0})`);
  const kids = new Set(cam.children);
  HW_instant(() => { for (let i = 0; i < k; i++) states[i](); });
  const built = [...cam.children].filter((e) => !kids.has(e));
  // the world comes back after other shots: it fades in as it was left
  if (k > 0 && !o.cont_prev && built.length) tl.from(built, { opacity: 0, y: 14, duration: 0.4, ease: 'power2.out' }, 0);
  states[k]();
  if (!o.cont_next) exitAll();
}

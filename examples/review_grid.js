// ПРИМЕР · проверка партии: 30 писем, по ним проходит «лупа» эксперта, половине — штамп «БРАК».
// Числа — только из статьи (здесь 15 из 30). Наборы: core.
const FAIL = [1, 3, 4, 7, 10, 12, 13, 16, 18, 20, 22, 25, 26, 28, 29];
const L = letterGrid(30, 6, 0.05, { y0: 250 });
actor('врач', 540, 172, Wv('врач', 0.55) - 0.1, { size: 32, h: 62 });
const t0 = Wv('посмотрел', 0.75), t1 = Wv('половину', Math.min(3.35, D - 0.6)), step = (t1 - t0) / 30;
const cur = el('div', null, { position: 'absolute', left: '0px', top: '0px', width: '120px', height: '120px', borderRadius: '50%', boxShadow: `inset 0 0 0 5px ${A.ink}`, zIndex: 10 });
gsap.set(cur, { x: L[0].x - 60, y: L[0].y - 60, opacity: 0 }); tl.to(cur, { opacity: 1, duration: 0.15 }, t0);
L.forEach((l, i) => { const t = t0 + i * step;
  tl.to(cur, { x: l.x - 60, y: l.y - 60, duration: step * 0.8, ease: 'power1.inOut' }, clampT(t));
  if (FAIL.includes(i)) { stamp('БРАК', l.x, l.y, t + step * 0.8, A.red, { size: 22, h: 40 }); tl.to(l.e, { opacity: 0.55, duration: 0.15 }, clampT(t + step)); }
  else mark(l.x + 48, l.y - 30, true, t + step * 0.8, { r: 15, z: 9, col: A.blue }); });
tl.to(cur, { opacity: 0, duration: 0.2 }, t1);
Tx('15', 470, 830, { size: 120, w: 800, color: A.red, align: 'r', t: t1 - 0.2 });
Tx('из 30 — брак', 495, 840, { size: 52, w: 700, color: A.ink, align: 'l', t: t1 - 0.1 });
exitAll();

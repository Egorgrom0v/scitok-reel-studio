// ===== kit/core.js — общие помощники для своих (custom) шотов =====
// Вставляется в начало каждого custom-шота скриптом kit/apply.py. Работает поверх API движка:
// Tx, Kc, chip, num, inA, outA, popA, show, el, svgLayer, sv, lineA, drawOn, arrowHead, wt, clampT, tl, D, A, sfx, exitAll.
// Координаты: стейдж 1080×1000, безопасная зона x 100–980, y 140–950.

// время слова фразы (с запасным значением, если слово не нашлось)
const Wv = (w, fb, n = 0) => { const t = wt(w, n); return clampT(t == null ? fb : t); };
// ВАЖНО: chip(..., null) и Kc(..., null) видны с первого кадра (движок делает show(e, 0)).
// Если элемент должен появиться позже своей анимацией — оберни в hide0().
const hide0 = e => { tl.set(e, { opacity: 0 }, 0); return e; };
// детерминированный генератор случайных чисел (кадры рендерятся вразнобой — Math.random нельзя)
const rng = seed => { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; };

// --- плашки и значки
function amberChip(text, x, y, t, o = {}) { const c = chip(text, x, y, t, { ...o }); c.style.background = A.tint(A.amber, 0.14); c.style.color = A.amber; return c; }
function toneChip(text, col, x, y, t, o = {}) { const c = chip(text, x, y, t, { ...o }); c.style.background = A.tint(col, 0.14); c.style.color = col; return c; }
// ✓ / ✗ в круге. t == null — спрятан до твоей анимации
function mark(x, y, ok, t, o = {}) {
  const r = o.r || 30, col = o.col || (ok ? A.green : A.red);
  const e = el('div', null, { position: 'absolute', left: (x - r) + 'px', top: (y - r) + 'px', width: 2 * r + 'px', height: 2 * r + 'px', borderRadius: '50%', background: col, zIndex: o.z || 6 }, null, o.parent);
  const s = svgLayer(e); s.setAttribute('width', 2 * r); s.setAttribute('height', 2 * r);
  const d = ok ? `M${r * 0.52} ${r * 1.02} L${r * 0.86} ${r * 1.36} L${r * 1.5} ${r * 0.68}` : `M${r * 0.66} ${r * 0.66} L${r * 1.34} ${r * 1.34} M${r * 1.34} ${r * 0.66} L${r * 0.66} ${r * 1.34}`;
  sv(s, 'path', { d, stroke: '#fff', 'stroke-width': r * 0.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  if (t != null) popA(e, t); else hide0(e);
  return e;
}
// штамп «БРАК» / «ГОДНО» с ударом
function stamp(text, x, y, t, col, o = {}) {
  const e = el('div', 'apchip', { left: x + 'px', top: y + 'px', height: (o.h || 44) + 'px', padding: '0 14px', borderRadius: '10px', boxShadow: `inset 0 0 0 3px ${col}`, color: col, background: A.tint(col, 0.08), fontSize: (o.size || 24) + 'px', fontWeight: 800, letterSpacing: '0.04em', zIndex: o.z || 8 }, text, o.parent);
  gsap.set(e, { xPercent: -50, yPercent: -50, rotation: o.rot ?? -10 });
  tl.fromTo(e, { opacity: 0, scale: 2.2 }, { opacity: 1, scale: 1, duration: 0.22, ease: 'power3.in' }, clampT(t));
  return e;
}
// стрелка-наконечник, появляется вместе с линией (иначе висит с первого кадра)
function arrowAt(svg, path, col, size, t) { const h = arrowHead(svg, path, col, size); tl.fromTo(h, { opacity: 0 }, { opacity: 1, duration: 0.15 }, clampT(t)); return h; }
// расходящееся кольцо-«пульс»
function ringPulse(svg, x, y, r, t, col = A.blue) { const c = sv(svg, 'circle', { cx: x, cy: y, r, fill: 'none', stroke: col, 'stroke-width': 4 });
  tl.set(c, { opacity: 0 }, 0); tl.fromTo(c, { attr: { r: r * 0.3 }, opacity: 0.9 }, { attr: { r: r * 1.6 }, opacity: 0, duration: 0.6, ease: 'expo.out' }, clampT(t)); return c; }

// --- текст по словам: пузырь сообщения / пост. Каждое слово — span (подсветка, «вылет» слова)
function bubble(x, y, w, text, t, o = {}) {
  const b = el('div', 'apc', { left: x + 'px', top: y + 'px', width: w + 'px', padding: '30px 38px', boxSizing: 'border-box', borderRadius: '36px 36px 36px 10px', zIndex: 3,
    fontFamily: "'Inter','Sym'", fontWeight: 600, fontSize: (o.size || 40) + 'px', lineHeight: '1.32', color: A.ink, whiteSpace: 'normal' });
  const sp = text.split(' ').map(s => el('span', null, { display: 'inline-block', marginRight: '0.28em', borderRadius: '10px', padding: '0 4px', position: 'relative' }, s, b));
  inA(b, t, { dy: 24 });
  if (o.type) sp.forEach((s, i) => tl.fromTo(s, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }, clampT(t + 0.1 + o.type * i / sp.length)));
  if (o.who) chip(o.who, x + 24, y - 30, t, { tone: 'gray', size: 24, h: 44, align: 'l' });
  b._sp = sp; return b;
}
// центр слова-span в координатах сцены (b — контейнер с position absolute на сцене, bx/by — его left/top)
const spanXY = (s, bx, by) => [bx + s.offsetLeft + s.offsetWidth / 2, by + s.offsetTop + s.offsetHeight / 2];
function hlWord(s, t, col = A.blue) { tl.to(s, { backgroundColor: A.tint(col, 0.16), color: col, duration: 0.3, ease: 'power2.out' }, clampT(t)); }
// пост с форума: аватарка-значок, ник, текст по словам
function postCard(x, y, w, text, t, o = {}) {
  const card = Kc(x, y, w, o.h || 300, t, { r: 30 });
  const s0 = svgLayer(card); person(s0, 54, 58, 44, A.faint);
  Tx(o.user || 'аноним · форум', 96, 52, { parent: card, size: 26, w: 600, color: A.sub, align: 'l' });
  const body = el('div', null, { position: 'absolute', left: '34px', top: '100px', width: (w - 68) + 'px', fontFamily: "'Inter','Sym'", fontWeight: 600, fontSize: (o.size || 36) + 'px', lineHeight: '1.3', color: A.ink, whiteSpace: 'normal' }, null, card);
  const sp = text.split(' ').map(s => el('span', null, { display: 'inline-block', marginRight: '0.26em', borderRadius: '8px', padding: '0 3px' }, s, body));
  if (o.type != null) sp.forEach((s, i) => tl.fromTo(s, { opacity: 0 }, { opacity: 1, duration: 0.12 }, clampT(t + 0.15 + o.type * i / sp.length)));
  return { card, sp, body };
}

// --- ячейки-«поля»: подпись сверху, значение крупно; смена значения
function slot(x, y, w, h, label, value, t, o = {}) {
  const k = Kc(x, y, w, h, t, { r: 24, z: 3, dy: o.dy });
  Tx(label, w / 2, 34, { parent: k, size: 24, w: 500, color: A.sub });
  k._v = Tx(value, w / 2, h / 2 + 18, { parent: k, size: o.vs || 52, w: 700, color: o.vc || A.ink });
  return k;
}
function ring(k, col, t, d = 0.3) { tl.to(k, { boxShadow: `0 0 0 4px ${col}, 0 12px 32px rgba(0,0,0,.07)`, duration: d, ease: 'power2.out' }, clampT(t)); }
function swapV(k, txt, t, o = {}) { const old = k._v; tl.to(old, { opacity: 0, y: -14, duration: 0.18, ease: 'power2.in' }, clampT(t));
  const n = Tx(txt, parseFloat(old.style.left), parseFloat(old.style.top), { parent: k, size: o.vs || 52, w: 700, color: o.vc || A.ink });
  tl.fromTo(n, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.25, ease: 'expo.out' }, clampT(t + 0.12)); k._v = n; return n; }
// тёмная таблетка-«исполнитель» (нейросеть, программа, врач) с пульсом
function actor(text, x, y, t, o = {}) {
  const c = chip(text, x, y, t, { tone: 'dark', size: o.size || 32, h: o.h || 72, px: 34 });
  (o.pulse || []).forEach(p => tl.fromTo(c, { scale: 1 }, { scale: 1.08, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' }, clampT(p)));
  return c;
}

// --- предметы
// абстрактный человек (реальных людей не рисуем)
function person(svg, x, y, s, col, o = {}) {
  const g = sv(svg, 'g', {});
  sv(g, 'circle', { cx: x, cy: y - s * 0.55, r: s * 0.32, fill: col });
  sv(g, 'path', { d: `M${x - s * 0.55} ${y + s * 0.55} Q${x - s * 0.55} ${y - s * 0.12} ${x} ${y - s * 0.12} Q${x + s * 0.55} ${y - s * 0.12} ${x + s * 0.55} ${y + s * 0.55} Z`, fill: col });
  if (o.t != null) tl.fromTo(g, { opacity: 0, scale: 0.4, svgOrigin: `${x} ${y}` }, { opacity: 1, scale: 1, svgOrigin: `${x} ${y}`, duration: 0.4, ease: 'back.out(2)' }, clampT(o.t));
  return g;
}
// конверт-письмо; x, y — центр
function envelope(x, y, w, t, o = {}) {
  const h = w * 0.68;
  const e = el('div', null, { position: 'absolute', left: (x - w / 2) + 'px', top: (y - h / 2) + 'px', width: w + 'px', height: h + 'px', borderRadius: (w * 0.1) + 'px', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.05), 0 8px 20px rgba(0,0,0,.08)', zIndex: o.z || 3, overflow: 'hidden' }, null, o.parent);
  const s = svgLayer(e); s.setAttribute('width', w); s.setAttribute('height', h);
  sv(s, 'path', { d: `M${w * 0.08} ${h * 0.14} L${w / 2} ${h * 0.55} L${w * 0.92} ${h * 0.14}`, fill: 'none', stroke: A.line, 'stroke-width': Math.max(2, w * 0.035), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  if (t != null) inA(e, t, { dy: 14, d: 0.4 }); return e;
}
// сетка конвертов n штук по cols в ряд: [{e, x, y}]
function letterGrid(n, cols, t, o = {}) {
  const out = [], W = o.w || 120, gx = o.gx || 146, gy = o.gy || 112, x0 = o.x0 ?? (540 - gx * (cols - 1) / 2), y0 = o.y0 || 230;
  for (let i = 0; i < n; i++) { const x = x0 + (i % cols) * gx, y = y0 + Math.floor(i / cols) * gy; const e = envelope(x, y, W, t == null ? null : t + i * 0.025); if (t == null) show(e, 0); out.push({ e, x, y }); }
  return out;
}
// база данных — цилиндр
function dbCyl(svg, cx, cy, w, h, t) {
  const g = sv(svg, 'g', {}), rx = w / 2, ry = w * 0.14;
  sv(g, 'path', { d: `M${cx - rx} ${cy - h / 2} L${cx - rx} ${cy + h / 2} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy + h / 2} L${cx + rx} ${cy - h / 2}`, fill: '#fff', stroke: A.ink, 'stroke-width': 6 });
  [0.18, 0.5].forEach(f => sv(g, 'path', { d: `M${cx - rx} ${cy - h / 2 + h * f} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy - h / 2 + h * f}`, fill: 'none', stroke: A.line, 'stroke-width': 4 }));
  sv(g, 'ellipse', { cx, cy: cy - h / 2, rx, ry, fill: A.soft, stroke: A.ink, 'stroke-width': 6 });
  if (t != null) tl.fromTo(g, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, clampT(t));
  return g;
}
// сетка точек для «N из M»: перекрашивай нужные через tl.to(c, {attr: {fill}})
function dots(svg, n, cols, x0, y0, cell, r, fill, t, step = 0.004) {
  const out = []; for (let i = 0; i < n; i++) { const c = sv(svg, 'circle', { cx: x0 + (i % cols) * cell, cy: y0 + Math.floor(i / cols) * cell, r, fill });
    if (t != null) tl.fromTo(c, { attr: { r: 0 } }, { attr: { r }, duration: 0.2, ease: 'back.out(2)' }, clampT(t + i * step)); out.push(c); } return out;
}
// плашка, которая переворачивается (было → стало): возвращает функцию flip(t)
function flipBadge(parent, x, y, w, h, a, b) {
  const box = el('div', null, { position: 'absolute', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', perspective: '900px' }, null, parent);
  const inner = el('div', null, { position: 'absolute', left: 0, top: 0, width: w + 'px', height: h + 'px', transformStyle: 'preserve-3d' }, null, box);
  const face = ([txt, col], back) => el('div', 'apchip', { position: 'absolute', left: 0, top: 0, width: w + 'px', height: h + 'px', borderRadius: (h / 4) + 'px', background: A.tint(col, 0.14), color: col, fontSize: (h * 0.38) + 'px', fontWeight: 800, backfaceVisibility: 'hidden', transform: back ? 'rotateX(180deg)' : 'none' }, txt, inner);
  const f1 = face(a, false), f2 = face(b, true); tl.set(f2, { opacity: 0 }, 0);   // обе грани сразу ловит DOM-проверка как наложение
  box.flip = t => { tl.to(inner, { rotationX: 180, duration: 0.7, ease: 'back.inOut(1.4)' }, clampT(t)); tl.set(f2, { opacity: 1 }, clampT(t + 0.35)); tl.set(f1, { opacity: 0 }, clampT(t + 0.35)); };
  return box;
}

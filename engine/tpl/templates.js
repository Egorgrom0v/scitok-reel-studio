// SciTok · шаблоны шотов (pipeline v4). Загружается после lib.js и ds_apple.js.
// Каждый шаблон: TPL.<name>(props) рисует весь шот 1080×1000 в дизайн-системе Apple,
// сам раскладывается в безопасной зоне (x 100–980, y 140–950, центр ~y 560),
// вешает появления на слова (`at: {word, n}`) и в конце мягко уводит всё (exitAll).
// Пропсы приходят из плана шотов режиссёра; компилятор проверяет их схемой (reel_engine/templates.py).

const TPL = {};
const SAFE = { x0: 100, x1: 980, y0: 140, y1: 950, cx: 540, cy: 560 };

// Время: число секунд от начала шота или {word, n, lead, fb} — слово из реплики этой сцены.
function AT(a, fb = 0.1) {
  if (a == null) return clampT(fb);
  if (typeof a === 'number') return clampT(a);
  const want = String(a.word || '').toLowerCase().replace(/ё/g, 'е');
  const hits = S.words.filter((w) => w.w.toLowerCase().replace(/ё/g, 'е').replace(/[«»„“"]/g, '').startsWith(want)).map((w) => w.t0);
  const inside = hits.filter((x) => x >= -0.05);
  const pool = inside.length ? inside : hits;
  const t = pool.length ? pool[Math.min(a.n || 0, pool.length - 1)] : null;
  if (t == null) return clampT(a.fb != null ? a.fb : fb);
  return clampT(Math.max(0.05, t - (a.lead != null ? a.lead : 0.15)));
}
const TONE = { ink: () => A.ink, blue: () => A.blue, red: () => A.red, green: () => A.green, amber: () => A.amber, gray: () => A.faint };
const toneColor = (t, fb = 'ink') => (TONE[t] || TONE[fb])();
// Числа по-русски: десятичная запятая, неразрывный пробел в тысячах.
function fmtNum(v, dec = 0) {
  const s = Number(v).toFixed(dec).replace('.', ',');
  const [i, f] = s.split(',');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return f != null ? g + ',' + f : g;
}
// Сколько знаков после запятой у самого числа (2.8 → 1, 0.96 → 2, 84 → 0), если dec не задан явно.
// «4,9 BLEU», «84 %»: a word or unit after a number gets a non-breaking space unless the plan put one.
const sfxOf = (s) => (s && /^[\p{L}%°]/u.test(s) ? '\u00A0' + s : s || '');
const decOf = (v, dec) => (dec != null ? dec : Math.min(2, (String(v).split('.')[1] || '').length));
function sfxSoft(name, t, gain = 0.08) { if (typeof sfx === 'function') sfx(name, t, { gain }); }
// Подпись источника под кропом: «Таблица 1», «Рис. 3» (24 px, не меньше 22 по правилам).
function srcTag(text, r, t) {
  if (!text) return null;
  // under the picture if there is room, else a small tag on a light pad in the top-left corner (frameless pages fill the stage)
  const below = r.top + r.H + 36;
  if (below <= 945) return Tx(text, Math.max(110, Math.min(r.left + 8, 700)), below, { size: 24, w: 600, color: A.sub, align: 'l', t: clampT(t + 0.15), z: 6 });
  const tag = Tx(text, 110, 150, { size: 24, w: 600, color: A.sub, align: 'l', t: clampT(t + 0.15), z: 6 });
  Object.assign(tag.style, { background: 'rgba(244,245,247,0.92)', padding: '4px 10px', borderRadius: '8px' });
  return tag;
}

// 1. Заголовок: надстрочник, крупный заголовок, подзаголовок.
TPL.title_card = (p) => {
  const t0 = AT(p.at, 0.1);
  if (p.eyebrow) eyebrow(p.eyebrow, 400, t0);
  Tx(p.title, SAFE.cx, 560, { size: p.size || (p.title.length <= 22 ? 110 : 84), w: 800, wrap: true, width: 880, talign: 'center', t: t0 + 0.1 });
  if (p.sub) Tx(p.sub, SAFE.cx, 740, { size: 38, w: 500, color: A.sub, wrap: true, width: 820, talign: 'center', t: AT(p.sub_at, t0 + 0.35) });
  exitAll();
};

// 2. Крупное число со счётчиком: «87 %», «149 из 163».
TPL.big_number = (p) => {
  const t0 = AT(p.at, 0.15);
  if (p.eyebrow) eyebrow(p.eyebrow, 300, Math.max(0.05, t0 - 0.2));
  const color = toneColor(p.tone, 'ink');
  const final = (p.prefix || '') + fmtNum(p.value, decOf(p.value, p.dec)) + sfxOf(p.suffix);
  const fit = Math.floor(860 / (Math.max(1, final.length) * 0.6));  // 31.10: «+72,85 %» at 240 px ran off both edges
  const e = Tx('', SAFE.cx, 520, { size: Math.min(p.size || 240, fit), w: 800, color });
  const st = { v: p.from || 0 };
  const show_ = (v) => { e.textContent = (p.prefix || '') + fmtNum(v, decOf(p.value, p.dec)) + sfxOf(p.suffix); };
  show_(st.v); inA(e, t0, { dy: 20 });
  tl.to(st, { v: p.value, duration: p.dur || 0.9, ease: 'power3.out', onUpdate: () => show_(st.v) }, t0);
  sfxSoft('Select', t0 + 0.6);
  if (p.label) Tx(p.label, SAFE.cx, 720, { size: 48, w: 600, wrap: true, width: 880, talign: 'center', t: AT(p.label_at, t0 + 0.3) });
  if (p.sub) Tx(p.sub, SAFE.cx, 840, { size: 34, w: 500, color: A.sub, wrap: true, width: 820, talign: 'center', t: AT(p.sub_at, t0 + 0.5) });
  exitAll();
};

// 3. Столбики «было → стало» (2–4 столбика), опционально дельта.
TPL.bars_compare = (p) => {
  const bars = p.bars || [];
  if (p.eyebrow) eyebrow(p.eyebrow, 170, 0.05);
  const base = 850, maxH = 500;
  const max = Math.max(...bars.map((b) => b.value), 1e-9);
  const n = bars.length, w = n <= 2 ? 200 : n === 3 ? 170 : 140;
  const gap = n <= 2 ? 160 : 70;
  const total = n * w + (n - 1) * gap;
  bars.forEach((b, i) => {
    const x = SAFE.cx - total / 2 + w / 2 + i * (w + gap);
    const col = b.tone ? toneColor(b.tone) : (i === n - 1 ? A.blue : A.faint);
    vbarA(x, base, b.value, maxH / max, AT(b.at, 0.3 + i * 0.6), { w, color: col, dec: decOf(b.value, p.dec), suf: sfxOf(p.suffix), label: b.label, ns: 60 });
  });
  const line = el('div', null, { position: 'absolute', left: (SAFE.cx - total / 2 - 30) + 'px', top: base + 'px', width: (total + 60) + 'px', height: '3px', background: A.line, zIndex: 2 });
  show(line, 0);
  if (p.delta) chip(p.delta, SAFE.cx, 240, AT(p.delta_at, 0.3 + n * 0.6), { tone: p.delta_tone || 'blue', size: 30, h: 60 });
  exitAll();
};

// 4. Сетка 10×10 точек: «N из 100».
TPL.dot_grid = (p) => {
  const total = p.total || 100, n = Math.round(p.n);
  if (p.eyebrow) eyebrow(p.eyebrow, 170, 0.05);
  const cols = 10, rows = Math.ceil(total / cols), step = 58, r = 21;
  const x0 = SAFE.cx - ((cols - 1) * step) / 2, y0 = 230;
  const t0 = AT(p.at, 0.3), col = toneColor(p.tone, 'blue');
  for (let i = 0; i < total; i++) {
    const cx = x0 + (i % cols) * step, cy = y0 + Math.floor(i / cols) * step;
    const d = el('div', null, { position: 'absolute', left: (cx - r) + 'px', top: (cy - r) + 'px', width: 2 * r + 'px', height: 2 * r + 'px', borderRadius: '50%', background: A.soft, zIndex: 3 });
    show(d, 0);
    if (i < n) tl.to(d, { background: col, duration: 0.2 }, clampT(t0 + (i / Math.max(1, n)) * (p.fill_dur || 1.2)));
  }
  const yl = y0 + rows * step + 40;
  Tx(`${fmtNum(n)} из ${fmtNum(total)}`, SAFE.cx, yl, { size: 72, w: 800, color: col, t: clampT(t0 + (p.fill_dur || 1.2)) });
  if (p.label) Tx(p.label, SAFE.cx, yl + 84, { size: 36, w: 500, color: A.sub, wrap: true, width: 860, talign: 'center', t: clampT(t0 + (p.fill_dur || 1.2) + 0.2) });
  exitAll();
};

// 5. Место в рейтинге: «149 из 163».
TPL.rank_bar = (p) => {
  const total = p.total, place = p.place;
  if (p.eyebrow) eyebrow(p.eyebrow, 250, 0.05);
  const x0 = 130, x1 = 950, y = 580, t0 = AT(p.at, 0.3);
  const track = el('div', null, { position: 'absolute', left: x0 + 'px', top: (y - 18) + 'px', width: (x1 - x0) + 'px', height: '36px', borderRadius: '18px', background: A.soft, zIndex: 2 });
  inA(track, 0.1, { dy: 0 });
  const frac = (place - 1) / Math.max(1, total - 1);
  const col = toneColor(p.tone, frac > 0.5 ? 'red' : 'green');
  const fill = el('div', null, { position: 'absolute', left: x0 + 'px', top: (y - 18) + 'px', width: (x1 - x0) * frac + 'px', height: '36px', borderRadius: '18px', background: A.tint(col, 0.25), zIndex: 3 });
  tl.fromTo(fill, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 1.0, ease: 'expo.out' }, t0);
  const mx = x0 + (x1 - x0) * frac;
  const dot = el('div', null, { position: 'absolute', left: (mx - 32) + 'px', top: (y - 32) + 'px', width: '64px', height: '64px', borderRadius: '50%', background: col, zIndex: 4, boxShadow: '0 6px 16px rgba(0,0,0,.15)' });
  tl.fromTo(dot, { x: -(x1 - x0) * frac, opacity: 0 }, { x: 0, opacity: 1, duration: 1.0, ease: 'expo.out' }, t0);
  Tx('1 место', x0, y + 80, { size: 30, w: 600, color: A.sub, t: 0.2, align: 'l' });
  Tx(`${fmtNum(total)}`, x1, y + 80, { size: 30, w: 600, color: A.sub, t: 0.2, align: 'r' });
  Tx(`${fmtNum(place)} из ${fmtNum(total)}`, SAFE.cx, y - 150, { size: 110, w: 800, color: col, t: clampT(t0 + 0.8) });
  if (p.label) Tx(p.label, SAFE.cx, y + 210, { size: 40, w: 500, color: A.sub, wrap: true, width: 860, talign: 'center', t: clampT(t0 + 1.0) });
  exitAll();
};

// 6. Кольцо прогресса: доля в процентах.
TPL.ring_progress = (p) => {
  if (p.eyebrow) eyebrow(p.eyebrow, 180, 0.05);
  const R = 230, cx = SAFE.cx, cy = 530, t0 = AT(p.at, 0.3), col = toneColor(p.tone, 'blue');
  const svg = svgLayer(cam);
  const C2 = 2 * Math.PI * R;
  sv(svg, 'circle', { cx, cy, r: R, fill: 'none', stroke: A.soft, 'stroke-width': 36 });
  const arc = sv(svg, 'circle', { cx, cy, r: R, fill: 'none', stroke: col, 'stroke-width': 36, 'stroke-linecap': 'round', 'stroke-dasharray': C2, 'stroke-dashoffset': C2, transform: `rotate(-90 ${cx} ${cy})` });
  tl.to(arc, { attr: { 'stroke-dashoffset': C2 * (1 - Math.max(0, Math.min(100, p.value)) / 100) }, duration: 1.1, ease: 'power3.out' }, t0);
  const e = Tx('', cx, cy, { size: 132, w: 800, color: col });
  const st = { v: 0 };
  const show_ = (v) => { e.textContent = fmtNum(v, decOf(p.value, p.dec)) + ' %'; };
  show_(0); inA(e, t0, { dy: 10 });
  tl.to(st, { v: p.value, duration: 1.1, ease: 'power3.out', onUpdate: () => show_(st.v) }, t0);
  if (p.label) Tx(p.label, cx, cy + R + 100, { size: 42, w: 600, wrap: true, width: 860, talign: 'center', t: clampT(t0 + 0.4) });
  exitAll();
};

// 7. Список карточек-пунктов, каждая появляется на своём слове.
TPL.chips_stack = (p) => {
  const items = p.items || [];
  if (p.eyebrow) eyebrow(p.eyebrow, 200, 0.05);
  const h = 124, gap = 30, total = items.length * h + (items.length - 1) * gap;
  const y0 = SAFE.cy + 30 - total / 2;
  items.forEach((it, i) => {
    const y = y0 + i * (h + gap), t = AT(it.at, 0.3 + i * 0.6);
    const tone = it.tone || 'gray';
    const card = Kc(120, y, 840, h, t, { r: 28, border: tone === 'gray' ? null : toneColor(tone), bw: 3 });
    const room = it.mark ? 560 : 760;  // the text must end before the mark chip (31.10: long lines ran under it)
    Tx(it.text, 52, h / 2, { parent: card, size: Math.max(28, Math.min(44, Math.floor(room / (String(it.text).length * 0.6)))), w: 600, align: 'l' });
    if (it.mark) chip(it.mark, 840 - 130, h / 2, clampT(t + 0.25), { parent: card, tone: tone === 'gray' ? 'dark' : tone, size: 28, h: 56 });
  });
  exitAll();
};

// 8. Две карточки рядом: «глазами — долго» / «большая нейронка — дорого».
TPL.compare_cards = (p) => {
  if (p.eyebrow) eyebrow(p.eyebrow, 210, 0.05);
  [p.left, p.right].forEach((c, i) => {
    if (!c) return;
    const x = i === 0 ? 110 : 560, t = AT(c.at, i === 0 ? 0.15 : 1.5);
    const H = c.big ? 640 : 500, Y = c.big ? 250 : 330;   // no big number: a shorter card, centred lower
    const card = Kc(x, Y, 410, H, t, { r: 32, border: c.tone && c.tone !== 'gray' ? toneColor(c.tone) : null, bw: 3 });
    if (c.big) Tx(c.big, 205, 190, { parent: card, size: 130, w: 800, color: toneColor(c.tone, 'ink') });
    Tx(c.title, 205, c.big ? 360 : 170, { parent: card, size: c.big ? 46 : 52, w: 700, wrap: true, width: 360, talign: 'center' });
    if (c.text) Tx(c.text, 205, c.big ? 450 : 300, { parent: card, size: c.big ? 30 : 34, w: 500, color: A.sub, wrap: true, width: 360, talign: 'center' });
    if (c.chip) chip(c.chip, 205, H - 90, AT(c.chip_at, t + 0.6), { parent: card, tone: c.tone || 'gray', size: 34, h: 68 });
  });
  exitAll();
};

// 9. Конвейер шагов сверху вниз; текущий шаг горит, внизу исход.
TPL.flow_steps = (p) => {
  const steps = p.steps || [];
  if (p.eyebrow) eyebrow(p.eyebrow, 170, 0.05);
  const n = steps.length, h = 120, gap = 60, total = n * h + (n - 1) * gap + (p.outcome ? gap + h : 0);
  const y0 = SAFE.cy + 30 - total / 2;
  const svg = svgLayer(cam);
  steps.forEach((s, i) => {
    const y = y0 + i * (h + gap), t = AT(s.at, 0.2 + i * 0.7);
    const active = p.active === i;
    const card = Kc(160, y, 760, h, t, { r: 28, bg: active ? A.tint(A.blue, 0.1) : '#fff', border: active ? A.blue : null, bw: 3 });
    Tx(s.text, 380, h / 2, { parent: card, size: 44, w: active ? 700 : 600, color: active ? A.blue : A.ink });
    if (i > 0) lineA(svg, SAFE.cx, y - gap + 8, SAFE.cx, y - 8, clampT(t - 0.15), { color: A.line, w: 4 });
  });
  if (p.outcome) {
    const y = y0 + n * (h + gap), t = AT(p.outcome.at, 0.2 + n * 0.7);
    lineA(svg, SAFE.cx, y - gap + 8, SAFE.cx, y - 8, clampT(t - 0.15), { color: A.line, w: 4 });
    chip(p.outcome.text, SAFE.cx, y + h / 2, t, { tone: p.outcome.tone || 'green', size: 40, h: 88 });
    sfxSoft('Select', t);
  }
  exitAll();
};

// 10. Лесенка выводов: каждый следующий вывод ступенькой ниже и правее.
TPL.staircase = (p) => {
  const items = p.items || [];
  if (p.eyebrow) eyebrow(p.eyebrow, 190, 0.05);
  const n = items.length, gap = 30, dx = n > 1 ? Math.min(80, 200 / (n - 1)) : 0;
  const w = 840 - dx * (n - 1);
  // a long item gets a second line: its card grows instead of overflowing
  const fs = items.map((it) => (it.text.length > 30 ? 36 : 42));
  const hs = items.map((it, i) => (it.text.length * fs[i] * 0.52 > w - 150 ? 150 : 116));
  const total = hs.reduce((a, b) => a + b, 0) + (n - 1) * gap;
  let y = SAFE.cy + 30 - total / 2;
  items.forEach((it, i) => {
    const t = AT(it.at, 0.3 + i * 0.8), h = hs[i];
    const last = i === n - 1;
    const card = Kc(120 + i * dx, y, w, h, t, { r: 28, bg: last ? A.ink : '#fff' });
    Tx(`${i + 1}`, 56, h / 2, { parent: card, size: 46, w: 800, color: last ? '#fff' : A.blue });
    Tx(it.text, 110, h / 2, { parent: card, size: fs[i], w: 600, color: last ? '#fff' : A.ink, align: 'l', wrap: true, width: w - 150 });
    y += h + gap;
  });
  exitAll();
};

// 11. Понятие зачёркивается и заменяется верным.
TPL.concept_strike = (p) => {
  if (p.eyebrow) eyebrow(p.eyebrow, 260, 0.05);
  const tw = AT(p.wrong_at, 0.15), tr = AT(p.right_at, 1.4);
  const short = String(p.wrong).length <= 8 && String(p.right).length <= 8;
  const w = Tx(p.wrong, SAFE.cx, 440, { size: short ? 130 : 80, w: 700, color: A.sub, t: tw });
  const ww = Math.min(860, w.getBoundingClientRect().width + 40);
  const bar = el('div', null, { position: 'absolute', left: (SAFE.cx - ww / 2) + 'px', top: '436px', width: ww + 'px', height: '8px', borderRadius: '4px', background: A.red, zIndex: 5 });
  tl.fromTo(bar, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.45, ease: 'expo.out' }, clampT(tr - 0.35));
  tl.to(w, { opacity: 0.45, duration: 0.3 }, clampT(tr - 0.2));
  Tx(p.right, SAFE.cx, short ? 650 : 620, { size: short ? 190 : 96, w: 800, color: A.blue, wrap: true, width: 860, talign: 'center', t: tr });
  if (p.sub) Tx(p.sub, SAFE.cx, short ? 820 : 780, { size: 38, w: 500, color: A.sub, wrap: true, width: 820, talign: 'center', t: clampT(tr + 0.3) });
  sfxSoft('Select', tr);
  exitAll();
};

// 12. Фрагмент статьи (кроп PDF) с подсветкой нужных строк по центру.
TPL.paper_focus = (p) => {
  const t0 = AT(p.at, 0.05), th = AT(p.hl_at, 0.9);
  // the page itself, no card: big, may bleed past the edges (Egor's rule: no frames, fill the top part)
  const r = docCard(p.crop, { at: t0, hlAt: th, cy: p.cy || 540, maxW: 1000, maxH: 840, frame: false, bleed: 1.1, zoom: [1, 1], color: p.tone === 'red' ? 'red' : null });
  const tag = srcTag(p.label, r, t0);
  zoomTo(r, Math.min(th, 0.7), readZoom(r, 1.5), 1.1, tag, 545, regionBox(r, p.region));   // push in until the paper's text is readable
  exitAll();
};

// Zoom at which the paper's own text is readable: a 7-pt figure label must reach ~20 px on screen.
// 31.10 (PIVOT): whole figures at 1.3–1.5x left the curves and legends unreadable on a phone.
function readZoom(r, base) { const pxPerPt = r.sc * 300 / 72; return Math.min(2.8, Math.max(base, 2.9 / pxPerPt)); }
// "region": [x0, y0, x1, y1] — fractions of the crop the director wants to zoom into (the curves, a table row).
function regionBox(r, reg) {
  if (!Array.isArray(reg) || reg.length !== 4) return null;
  const iw = r.W - 2 * r.pad, ih = r.H - 2 * r.pad;
  return [r.pad + reg[0] * iw, r.pad + reg[1] * ih, r.pad + reg[2] * iw, r.pad + reg[3] * ih];
}

// Наезд карточки кропа на подсветку: не дальше, чем подсветка помещается в безопасную зону, и к центру кадра.
function zoomTo(r, t, zmax, dur, tag = null, cy = 545, box = null) {
  // Where to look: the highlight (the first one when they are far apart), else the director's region, else the middle.
  // How close: readable (zmax), only less when the highlight itself would not fit the frame.
  // 31.10: a region as wide as the figure and a highlight on the last word left the page small and unreadable.
  let b = r.boxes.length ? r.boxes.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[2], q[2]), Math.max(a[3], q[3])]) : null;
  if (b && r.boxes.length > 1 && Math.min(840 / (b[2] - b[0] + 24), 560 / (b[3] - b[1] + 24)) < zmax * 0.8) b = r.boxes[0];
  const look = b || box || [r.W * 0.3, r.H * 0.3, r.W * 0.7, r.H * 0.7];
  const z = Math.max(1, Math.min(zmax, b ? Math.min(840 / (b[2] - b[0] + 24), 560 / (b[3] - b[1] + 24)) : zmax));
  if (z < 1.03) return;
  if (tag) outA(tag, clampT(t - 0.1));   // the source caption would sit on the zoomed picture
  const fx = (look[0] + look[2]) / 2, fy = (look[1] + look[3]) / 2, hx = r.left + fx, hy = r.top + fy;
  gsap.set(r.card, { transformOrigin: `${fx}px ${fy}px` });
  tl.fromTo(r.card, { scale: 1, x: 0, y: 0 }, { scale: z, x: (SAFE.cx - hx) * 0.9, y: (cy - hy) * 0.9, duration: dur, ease: 'expo.inOut' }, clampT(t - 0.1));
}

// 12b. Деталь рисунка: сначала весь рисунок, на слове — сильный наезд в подсвеченное место.
TPL.figure_zoom = (p) => {
  const th = AT(p.hl_at, 1.0);
  const t0 = AT(p.at, 0.05);
  const r = docCard(p.crop, { at: t0, hlAt: th, cy: 545, maxW: 1000, maxH: 840, frame: false, bleed: 1.1, zoom: [1, 1], color: p.tone === 'red' ? 'red' : null });
  const tag = srcTag(p.label, r, t0);
  zoomTo(r, Math.min(th, 0.8), readZoom(r, p.zoom || 1.8), 0.9, tag, 545, regionBox(r, p.region));
  exitAll();
};

// 12c. Строка таблицы или место рисунка + крупное число из неё.
TPL.paper_number = (p) => {
  const t0 = AT(p.at, 0.05);
  const r = docCard(p.crop, { at: t0, hlAt: AT(p.hl_at, 0.6), cy: 330, maxW: 960, maxH: 380, frame: true, focus: 'all', zoom: [1, 1.04] });
  srcTag(p.label, r, t0);
  const tn = AT(p.number_at, t0 + 1.0), color = toneColor(p.tone, 'blue');
  const e = Tx('', SAFE.cx, 690, { size: p.size || 170, w: 800, color });
  const st = { v: p.from || 0 };
  const show_ = (v) => { e.textContent = (p.prefix || '') + fmtNum(v, decOf(p.value, p.dec)) + sfxOf(p.suffix); };
  show_(st.v); inA(e, tn, { dy: 20 });
  tl.to(st, { v: p.value, duration: 0.8, ease: 'power3.out', onUpdate: () => show_(st.v) }, tn);
  if (p.caption) Tx(p.caption, SAFE.cx, 840, { size: 40, w: 600, wrap: true, width: 860, talign: 'center', t: clampT(tn + 0.3) });
  sfxSoft('Select', tn + 0.5);
  exitAll();
};

// 14. Термин и его смысл простыми словами (+ пример).
TPL.term_def = (p) => {
  const t0 = AT(p.at, 0.1);
  if (p.eyebrow) eyebrow(p.eyebrow, 300, t0);
  Tx(p.term, SAFE.cx, 450, { size: p.term.length > 14 ? 88 : 120, w: 800, color: A.blue, wrap: true, width: 880, talign: 'center', t: t0 + 0.05 });
  Tx(p.meaning, SAFE.cx, 640, { size: 46, w: 600, wrap: true, width: 860, talign: 'center', t: AT(p.meaning_at, t0 + 0.5) });
  if (p.example) chip(p.example, SAFE.cx, 800, AT(p.example_at, t0 + 1.2), { tone: 'gray', size: 32, h: 66 });
  exitAll();
};

// 15. Цитата из статьи (только дословный текст статьи) с подписью источника.
TPL.quote_card = (p) => {
  const t0 = AT(p.at, 0.1);
  Tx('“', SAFE.cx, 300, { size: 200, w: 800, color: A.blue, t: t0 });
  Tx(p.quote, SAFE.cx, 520, { size: p.quote.length > 90 ? 44 : 56, w: 600, wrap: true, width: 860, talign: 'center', t: t0 + 0.1 });
  if (p.source) Tx(p.source, SAFE.cx, 800, { size: 30, w: 500, color: A.sub, wrap: true, width: 820, talign: 'center', t: clampT(t0 + 0.4) });
  exitAll();
};

// 13. Пара «оригинал / испорченная копия» с рамками на отличиях.
// orig/bad — файлы build/pairs/<имя>.png, size — [ширина, высота] картинки в пикселях, diffs — рамки в пикселях картинки.
TPL.pair_diff = (p) => {
  const [pw, ph] = p.size;
  const side = ph > pw * 0.8;   // tall pictures go side by side, wide ones stacked
  const maxW = side ? 400 : 860, maxH = side ? 680 : 340, sc = Math.min(maxW / pw, maxH / ph);
  const w = pw * sc, h = ph * sc;
  const pos = side
    ? [[SAFE.cx - 20 - w, SAFE.cy + 20 - h / 2], [SAFE.cx + 20, SAFE.cy + 20 - h / 2]]
    : [[SAFE.cx - w / 2, SAFE.cy - 25 - h], [SAFE.cx - w / 2, SAFE.cy + 65]];
  const card = (file, k, t, label, tone) => {
    const [x, y] = pos[k];
    const c = el('div', 'apdoc', { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', zIndex: 2 });
    const im = el('img', null, { position: 'absolute', left: 0, top: 0, width: w + 'px', height: h + 'px' }, null, c);
    im.src = window.BUILD_URL + '/pairs/' + file + '.png';
    inA(c, t, { dy: 16 });
    chip(label, x + 16, y - 8, clampT(t + 0.15), { tone, size: 26, h: 50, align: 'l', z: 6 });
    return c;
  };
  card(p.orig, 0, AT(p.orig_at, 0.1), p.orig_label || 'оригинал', 'gray');
  const bad = card(p.bad, 1, AT(p.bad_at, 0.9), p.bad_label || 'испорчено', 'red');
  const tm = AT(p.marks_at, 1.6);
  (p.diffs || []).forEach((b, i) => {
    const m = el('div', null, { position: 'absolute', left: (b[0] * sc - 6) + 'px', top: (b[1] * sc - 4) + 'px', width: ((b[2] - b[0]) * sc + 12) + 'px', height: ((b[3] - b[1]) * sc + 8) + 'px', borderRadius: '10px', background: A.tint(A.red, 0.14), boxShadow: `inset 0 0 0 3px ${A.red}`, zIndex: 5 }, null, bad);
    tl.fromTo(m, { opacity: 0, scale: 1.2 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'expo.out' }, clampT(tm + i * 0.2));
  });
  if ((p.diffs || []).length) sfxSoft('Beep_8', tm, 0.1);
  exitAll();
};

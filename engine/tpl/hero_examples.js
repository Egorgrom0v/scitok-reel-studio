// Примеры геройских шотов из ручных роликов (vgate, стиль Apple). Только образец стиля, не исполняется.
function Wv(word, fb, n = 0) { const t = wt(word, n); return clampT(t == null ? fb : t); }
function downArrow(x, y, h, t, col) {
  const a = el('div', null, { position: 'absolute', left: (x - 20) + 'px', top: y + 'px', width: '40px', height: h + 'px', zIndex: 3 });
  const ln = el('div', null, { position: 'absolute', left: '18px', top: 0, width: '4px', height: (h - 16) + 'px', borderRadius: '2px', background: col || A.ink }, null, a);
  const hd = el('div', null, { position: 'absolute', left: '8px', top: (h - 20) + 'px', width: 0, height: 0, borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: `20px solid ${col || A.ink}` }, null, a);
  inA(a, t, { dy: -10 }); a._ln = ln; a._hd = hd; return a;
}

// s01_1 · хук: кадр-схема собирается сама, одна стрелка разворачивается
SH.s01_1 = () => {
  const card = Kc(250, 165, 580, 700, 0.05, { r: 36 });
  chip('сгенерировано нейросетью', 290, 60, 0.35, { tone: 'blue', size: 22, h: 46, parent: card });
  const steps = [['Солнечный свет', A.tint(A.amber, 0.12), A.amber], ['Лист', A.tint(A.green, 0.12), A.green], ['Сахар', A.tint(A.blue, 0.1), A.blue]];
  const boxes = steps.map(([s, bg, col], i) => {
    const b = el('div', 'apchip', { left: '110px', top: (130 + i * 190) + 'px', width: '360px', height: '96px', borderRadius: '24px', background: bg, color: col, fontSize: '34px', zIndex: 3 }, s, card);
    inA(b, 0.55 + i * 0.45, { dy: 20 }); return b;
  });
  const a1 = downArrow(290, 232, 82, 0.8, A.ink); card.appendChild(a1);
  const a2 = downArrow(290, 422, 82, 1.25, A.ink); card.appendChild(a2);
  Tx('фотосинтез', 290, 655, { parent: card, size: 24, w: 500, color: A.sub, t: 1.6 });
  const tf = Wv('стрелка', 4.5) - 0.1;
  tl.to(a2, { rotation: 180, duration: 0.7, ease: 'back.inOut(1.6)' }, tf);
  tl.to([a2._ln], { background: A.red, duration: 0.3 }, tf + 0.1); tl.to([a2._hd], { borderTopColor: A.red, duration: 0.3 }, tf + 0.1);
  tl.to(card, { boxShadow: `0 0 0 3px ${A.red}, 0 12px 32px rgba(0,0,0,.07)`, duration: 0.4 }, tf + 0.4);
  sfx('Beep_8', tf + 0.4, { gain: 0.1 });
  const tm = Math.max(tf + 1.0, Wv('механизм', 6.9) - 0.2);
  chip('механизм наоборот', 540, 925, tm, { tone: 'red', size: 30, h: 64 });
  exitAll();
};

// s02_2 · глазами долго, большой нейронкой дорого
SH.s02_2 = () => {
  const t1 = 0.15, t2 = Wv('нейронку', 3.6) - 0.4;
  // карточка 1: глаз + лента кадров
  const c1 = Kc(110, 300, 410, 640, t1, { r: 32 });
  const svg1 = svgLayer(c1);
  const eye1 = sv(svg1, 'path', { d: 'M125 120 Q205 50 285 120 Q205 190 125 120 Z', fill: 'none', stroke: A.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' });
  const eye2 = sv(svg1, 'circle', { cx: 205, cy: 120, r: 26, fill: A.ink });
  [0.9, 2.3, 3.5, 4.6].forEach(b => { if (t1 + b < D - 0.4) { tl.to([eye1, eye2], { scaleY: 0.08, svgOrigin: '205 120', duration: 0.08, ease: 'power2.in' }, t1 + b); tl.to([eye1, eye2], { scaleY: 1, svgOrigin: '205 120', duration: 0.12, ease: 'power2.out' }, t1 + b + 0.1); } });
  const strip = el('div', null, { position: 'absolute', left: '20px', top: '210px', width: '370px', height: '240px', overflow: 'hidden', borderRadius: '14px', background: A.bg }, null, c1);
  const files = ['transformer_orig', 'llama12_orig', 'deepseek_orig', 'gemma_orig', 'mistral_orig', 'bert_orig', 'scaling_orig', 'llama14_orig', 'transformer_bad', 'deepseek_bad'];
  const row = el('div', null, { position: 'absolute', left: 0, top: '15px', height: '210px', width: (files.length * 290) + 'px' }, null, strip);
  files.forEach((f, i) => { const b = el('div', null, { position: 'absolute', left: (i * 290 + 10) + 'px', top: 0, width: '270px', height: '210px', background: '#fff', borderRadius: '12px' }, null, row);
    const im = el('img', null, { position: 'absolute', left: '8px', top: '8px', width: '254px', height: '194px', objectFit: 'contain' }, null, b); im.src = window.BUILD_URL + '/pairs/' + f + '.png'; });
  tl.fromTo(row, { x: 0 }, { x: -(files.length * 290 - 370), duration: Math.max(1, D - t1), ease: 'none' }, t1);
  Tx('смотреть глазами', 205, 520, { parent: c1, size: 32, w: 700 });
  chip('долго', 205, 590, t1 + 0.6, { parent: c1, size: 26, h: 50 });
  // карточка 2: большая нейронка + монеты
  const c2 = Kc(560, 300, 410, 640, t2, { r: 32 });
  [0, 1, 2, 3, 4].forEach(i => { const co = el('div', null, { position: 'absolute', left: '135px', top: (250 - i * 26) + 'px', width: '140px', height: '44px', borderRadius: '50%', background: '#F4C04E', boxShadow: 'inset 0 -6px 0 #D99A1E', zIndex: 3 + i }, null, c2);
    tl.fromTo(co, { y: -80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'bounce.out' }, clampT(t2 + 0.15 + i * 0.12)); });
  Tx('большая нейронка', 205, 520, { parent: c2, size: 32, w: 700 });
  const tc = Math.max(t2 + 0.6, Wv('дорого', 4.6) - 0.15);
  chip('дорого', 205, 590, tc, { parent: c2, tone: 'red', size: 26, h: 50 });
  sfx('Select', tc, { gain: 0.1 });
  exitAll();
};

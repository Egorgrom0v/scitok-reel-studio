// ПРИМЕР · наборы: core. // s3 · ДНК: двойная спираль, одна «ступенька» под вопросом; бланк с результатом «неопределённый»
const svg = svgLayer();
const y0 = 360, A_ = 95, N = 20, x0 = 100, x1 = 980;
const g = sv(svg, 'g', {});
const st = { ph: 0 };
const rungs = [], s1 = sv(g, 'path', { fill: 'none', stroke: A.ink, 'stroke-width': 8, 'stroke-linecap': 'round' }), s2 = sv(g, 'path', { fill: 'none', stroke: A.blue, 'stroke-width': 8, 'stroke-linecap': 'round' });
for (let i = 0; i < N; i++) rungs.push(sv(g, 'line', { stroke: i === 11 ? A.amber : A.line, 'stroke-width': i === 11 ? 9 : 5, 'stroke-linecap': 'round' }));
const draw = () => { let d1 = '', d2 = '';
  for (let x = x0; x <= x1; x += 6) { const a = (x - x0) / 70 + st.ph; d1 += (x === x0 ? 'M' : 'L') + x + ' ' + (y0 + Math.sin(a) * A_); d2 += (x === x0 ? 'M' : 'L') + x + ' ' + (y0 - Math.sin(a) * A_); }
  s1.setAttribute('d', d1); s2.setAttribute('d', d2);
  rungs.forEach((r, i) => { const x = x0 + 22 + i * (x1 - x0 - 44) / (N - 1), a = (x - x0) / 70 + st.ph; r.setAttribute('x1', x); r.setAttribute('x2', x); r.setAttribute('y1', y0 + Math.sin(a) * A_); r.setAttribute('y2', y0 - Math.sin(a) * A_); }); };
draw(); tl.to(st, { ph: 2.2, duration: D, ease: 'none', onUpdate: draw }, 0);
tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.05);
const rx = x0 + 22 + 11 * (x1 - x0 - 44) / (N - 1);
const q = el('div', 'apchip', { left: (rx - 36) + 'px', top: (y0 - 36) + 'px', width: '72px', height: '72px', borderRadius: '50%', background: '#fff', color: A.amber, fontSize: '44px', fontWeight: 800, boxShadow: `0 0 0 4px ${A.amber}`, zIndex: 6 }, '?');
hide0(q); popA(q, Wv('человеку', 0.6));
// бланк анализа
const tb = Wv('выдать', 1.2) - 0.1;
const card = Kc(190, 560, 700, 330, tb, { r: 30 });
Tx('Результат генетического теста', 40, 56, { parent: card, size: 30, w: 600, color: A.sub, align: 'l' });
Tx('BRCA2 · вариант', 40, 130, { parent: card, size: 48, w: 800, align: 'l' });
const bdg = toneChip('неопределённый', A.amber, 40, 220, Wv('неопределённый', 1.5) - 0.05, { parent: card, size: 34, h: 66, align: 'l' });
sfx('Select', Wv('неопределённый', 1.5), { gain: 0.07 });
const tq = Wv('опасна', 3.2) - 0.1;
Tx('опасен?', 560, 220, { parent: card, size: 40, w: 800, color: A.amber, t: tq });
tl.fromTo(q, { scale: 1 }, { scale: 1.25, duration: 0.2, yoyo: true, repeat: 3 }, tq);
exitAll();

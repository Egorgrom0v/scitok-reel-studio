// ПРИМЕР · наборы: core, chem. // s17 · ГЕРОЙ: из двух исходных веществ слоями вырастает сеть — 108 веществ и 122 реакции
const svg = svgLayer();
const cx = 540, cy = 470;
const layers = [2, 12, 26, 34, 34], radii = [0, 95, 175, 255, 330];
const T = [0.05, 0.45, 0.85, 1.25, 1.65];
const r = rng(108);
const nodes = [];
layers.forEach((n, L) => { for (let i = 0; i < n; i++) {
  const a = (i + (L % 2) * 0.5) * 2 * Math.PI / n + (r() - 0.5) * 0.12, rr = L === 0 ? 34 : radii[L] + (r() - 0.5) * 26;
  nodes.push({ L, x: L === 0 ? cx + (i ? 34 : -34) : cx + Math.cos(a) * rr, y: L === 0 ? cy : cy + Math.sin(a) * rr * 0.98, a });
} });
const eg = sv(svg, 'g', {}), ng = sv(svg, 'g', {});
const edges = [];
nodes.forEach((n, k) => { if (n.L === 0) return;
  let best = -1, bd = 1e9; nodes.forEach((m, j) => { if (m.L === n.L - 1) { const d = Math.hypot(m.x - n.x, m.y - n.y); if (d < bd) { bd = d; best = j; } } });
  edges.push([best, k]); n.par = best; });
while (edges.length < 122) { const i = Math.floor(r() * nodes.length), j = Math.floor(r() * nodes.length); const a = nodes[i], b = nodes[j];
  if (i !== j && Math.abs(a.L - b.L) <= 1 && Math.hypot(a.x - b.x, a.y - b.y) < 120 && !edges.some(e => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i))) edges.push([i, j]); }
const tOf = n => T[n.L] + (n.L ? (nodes.filter(m => m.L === n.L).indexOf(n)) * 0.35 / layers[n.L] : 0);
const lines = edges.map(([i, j]) => { const a = nodes[i], b = nodes[j];
  const l = sv(eg, 'line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: A.line, 'stroke-width': 2.5 });
  tl.fromTo(l, { opacity: 0 }, { opacity: 1, duration: 0.25 }, clampT(Math.max(tOf(a), tOf(b)))); return l; });
nodes.forEach(n => { const rad = n.L === 0 ? 18 : n.L === 1 ? 11 : 8;
  n.c = sv(ng, 'circle', { cx: n.x, cy: n.y, r: rad, fill: n.L === 0 ? A.blue : A.ink });
  tl.fromTo(n.c, { attr: { r: 0 } }, { attr: { r: rad }, duration: 0.25, ease: 'back.out(2)' }, clampT(tOf(n))); });
T.forEach((t, L) => sfx('Click_UI Buttons_2', t, { gain: 0.04 }));
const t1 = Wv('108', 1.75) - 0.2, t2 = Wv('122', 2.9) - 0.2;
num(108, 330, 870, t1, { size: 84, w: 800, color: A.ink, dur: 0.7 });
Tx('веществ', 330, 935, { size: 28, w: 600, color: A.sub, t: t1 + 0.1 });
num(122, 750, 870, t2, { size: 84, w: 800, color: A.blue, dur: 0.7 });
Tx('реакций', 750, 935, { size: 28, w: 600, color: A.sub, t: t2 + 0.1 });
// одна ветка от исходных веществ до края загорается синим
const tp = Wv('реакции', 3.7) - 0.4;
let k = nodes.length - 7; const chain = []; while (k != null && nodes[k]) { chain.push(k); k = nodes[k].par; }
chain.forEach((idx, s) => { const n = nodes[idx]; tl.to(n.c, { attr: { fill: A.blue, r: n.L ? 13 : 20 }, duration: 0.2 }, clampT(tp + (chain.length - s) * 0.08));
  if (n.par != null) { const e = edges.findIndex(e => e[1] === idx); tl.to(lines[e], { attr: { stroke: A.blue, 'stroke-width': 6 }, duration: 0.2 }, clampT(tp + (chain.length - s) * 0.08)); } });
sfx('Select', tp + 0.3, { gain: 0.07 });
exitAll();

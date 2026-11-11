// ===== kit/chem.js — молекулы, энергетический профиль, ветки реакций =====
// Подключается вместе с kit/core.js (в work/plan.json: "kits": ["core", "chem"]).
// Молекула — SVG: атомы-кружки (C графит, O синий, N серый, H белый), связи-линии; 'ts' — частичная связь (пунктир).
// Анимация атомов идёт через состояние a.p {x, y, r, op} и M.draw() — связи сами тянутся за атомами.
// цвета атомов: углерод — графит, кислород — синий акцент, азот — серый, водород — белый с обводкой, фосфор — светло-серый
const ATOM = { C: { r: 24, fill: A.ink }, O: { r: 24, fill: A.blue, lab: 'O' }, N: { r: 24, fill: '#6E6E73', lab: 'N' }, P: { r: 26, fill: '#8E8E93', lab: 'P' }, H: { r: 13, fill: '#fff', stroke: A.faint } };
// молекула: atoms [[el, x, y], ...] в координатах сцены, bonds [[i, j, kind]] kind: 1 | 2 | 'ts' (частичная связь, пунктир)
function Mol(svg, atoms, bonds, o = {}) {
  const k = o.s || 1;
  const gB = sv(svg, 'g', {}), gA = sv(svg, 'g', {});
  const M = { atoms: [], bonds: [], gA, gB };
  atoms.forEach(([el, x, y], i) => {
    const st = ATOM[el] || ATOM.C, r = st.r * k;
    const c = sv(gA, 'circle', { cx: x, cy: y, r, fill: st.fill, stroke: st.stroke || 'none', 'stroke-width': st.stroke ? 3 : 0 });
    const lab = st.lab && k >= 0.9 ? sv(gA, 'text', { x, y: y + 8.5 * k, 'text-anchor': 'middle', 'font-family': 'Inter', 'font-weight': 700, 'font-size': 24 * k, fill: '#fff' }) : null;
    if (lab) lab.textContent = st.lab;
    M.atoms.push({ el, p: { x, y, r, op: 1 }, c, lab, r });
  });
  bonds.forEach(([i, j, kind]) => {
    const ls = (kind === 2 ? [-1, 1] : [0]).map(() => sv(gB, 'line', { stroke: kind === 'ts' ? A.blue : A.ink, 'stroke-width': (kind === 'ts' ? 5 : 6) * k, 'stroke-linecap': 'round', 'stroke-dasharray': kind === 'ts' ? `${8 * k} ${9 * k}` : '' }));
    M.bonds.push({ i, j, kind, ls, p: { op: 1 } });
  });
  M.draw = () => {
    M.atoms.forEach(a => { a.c.setAttribute('cx', a.p.x); a.c.setAttribute('cy', a.p.y); a.c.setAttribute('r', Math.max(0, a.p.r)); a.c.setAttribute('opacity', a.p.op);
      if (a.lab) { a.lab.setAttribute('x', a.p.x); a.lab.setAttribute('y', a.p.y + 8.5 * k); a.lab.setAttribute('opacity', a.p.op * Math.min(1, a.p.r / a.r)); } });
    M.bonds.forEach(b => { const A1 = M.atoms[b.i].p, B1 = M.atoms[b.j].p; const dx = B1.x - A1.x, dy = B1.y - A1.y, L = Math.hypot(dx, dy) || 1; const nx = -dy / L * 5 * k, ny = dx / L * 5 * k;
      const vis = Math.min(A1.r / M.atoms[b.i].r, B1.r / M.atoms[b.j].r, 1) * b.p.op * Math.min(A1.op, B1.op);
      b.ls.forEach((l, q) => { const s = b.ls.length === 2 ? (q ? 1 : -1) : 0; l.setAttribute('x1', A1.x + nx * s); l.setAttribute('y1', A1.y + ny * s); l.setAttribute('x2', B1.x + nx * s); l.setAttribute('y2', B1.y + ny * s); l.setAttribute('opacity', vis); }); });
  };
  // появление: атомы «выпрыгивают» по очереди, связи проявляются следом
  M.pop = (t, step = 0.04) => { M.atoms.forEach((a, i) => { a.p.r = 0; tl.fromTo(a.p, { r: 0 }, { r: a.r, duration: 0.35, ease: 'back.out(2)', onUpdate: M.draw }, clampT(t + i * step)); }); return M; };
  M.move = (i, x, y, t, d = 0.6, ease = 'power2.inOut') => { tl.to(M.atoms[i].p, { x, y, duration: d, ease, onUpdate: M.draw }, clampT(t)); return M; };
  M.shift = (dx, dy, t, d = 0.6, ease = 'power2.inOut') => { M.atoms.forEach(a => tl.to(a.p, { x: '+=' + dx, y: '+=' + dy, duration: d, ease, onUpdate: M.draw }, clampT(t))); return M; };
  M.bondOp = (n, op, t, d = 0.3) => { tl.to(M.bonds[n].p, { op, duration: d, onUpdate: M.draw }, clampT(t)); return M; };
  M.fade = (op, t, d = 0.3) => { M.atoms.forEach(a => tl.to(a.p, { op, duration: d, onUpdate: M.draw }, clampT(t))); return M; };
  M.color = (i, fill, t) => { tl.to(M.atoms[i].c, { attr: { fill }, duration: 0.25 }, clampT(t)); return M; };
  M.draw();
  if (o.t != null) M.pop(o.t, o.step); else M.draw();
  return M;
}
// готовая форма: atoms относительно центра (cx, cy) в «единицах» u
function molAt(svg, cx, cy, u, spec, o = {}) { return Mol(svg, spec.a.map(([el, x, y]) => [el, cx + x * u, cy + y * u]), spec.b, o); }
// несколько молекул-шаблонов (условные, для иллюстрации)
const SP = {
  ketone: { a: [['C', -1, 0], ['C', 0, -0.6], ['O', 0, -1.75], ['C', 1, 0], ['H', -1.8, -0.5], ['H', 1.8, -0.5]], b: [[0, 1, 1], [1, 2, 2], [1, 3, 1], [0, 4, 1], [3, 5, 1]] },
  aldehyde: { a: [['C', -1.1, 0.3], ['C', -0.1, -0.3], ['C', 0.9, 0.3], ['O', 1.9, -0.3], ['H', 0.9, 1.4]], b: [[0, 1, 2], [1, 2, 1], [2, 3, 2], [2, 4, 1]] },
  ring: { a: [[0, -1.2], [1.04, -0.6], [1.04, 0.6], [0, 1.2], [-1.04, 0.6], [-1.04, -0.6]].map(([x, y]) => ['C', x, y]).concat([['O', 2.1, -1.2]]), b: [[0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 2], [5, 0, 1], [1, 6, 1]] },
  amine: { a: [['N', 0, 0], ['C', -1.1, 0.6], ['C', 1.1, 0.6], ['H', 0, -1.1]], b: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
  small: { a: [['C', -0.6, 0], ['O', 0.6, 0], ['H', -1.4, -0.6], ['H', -1.4, 0.6]], b: [[0, 1, 2], [0, 2, 1], [0, 3, 1]] },
};
// крошечная «молекула-значок» для сетей и толп: 3–5 кружков со связями (случайная форма по seed)
function miniMol(svg, cx, cy, s, seed, t, o = {}) {
  const r = rng(seed * 7 + 3); const n = 3 + Math.floor(r() * 3); const pts = [[0, 0]]; let ang = r() * 6.28;
  for (let i = 1; i < n; i++) { ang += 1.2 + r() * 1.6; const b = pts[Math.floor(r() * pts.length)]; pts.push([b[0] + Math.cos(ang), b[1] + Math.sin(ang)]); }
  const mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  const g = sv(svg, 'g', {});
  pts.forEach((p, i) => { if (i) { const q = pts[Math.max(0, i - 1 - Math.floor(r() * i))]; sv(g, 'line', { x1: cx + (q[0] - mx) * s, y1: cy + (q[1] - my) * s, x2: cx + (p[0] - mx) * s, y2: cy + (p[1] - my) * s, stroke: o.bond || A.ink, 'stroke-width': Math.max(2, s * 0.22), 'stroke-linecap': 'round' }); } });
  pts.forEach((p, i) => sv(g, 'circle', { cx: cx + (p[0] - mx) * s, cy: cy + (p[1] - my) * s, r: s * 0.36, fill: o.fill || (r() < 0.25 ? A.blue : A.ink) }));
  if (t != null) tl.fromTo(g, { opacity: 0, scale: 0.2, svgOrigin: `${cx} ${cy}` }, { opacity: o.op ?? 1, scale: 1, svgOrigin: `${cx} ${cy}`, duration: 0.35, ease: 'back.out(2)' }, clampT(t));
  return g;
}
// энергетический профиль: долина реагентов слева, перевал, долина продуктов справа
function eProfile(x0, x1, yL, yP, yR, xm) { xm = xm ?? (x0 + x1) / 2; const w = x1 - x0;
  return `M${x0} ${yL} C${x0 + w * 0.22} ${yL} ${xm - w * 0.16} ${yP} ${xm} ${yP} C${xm + w * 0.16} ${yP} ${x1 - w * 0.22} ${yR} ${x1} ${yR}`; }
// точка на пути (0..1) — для шарика, катящегося по профилю
function along(path, f) { const L = path.getTotalLength(); return path.getPointAtLength(Math.max(0, Math.min(1, f)) * L); }
function ballOn(svg, path, f0, f1, t, d, o = {}) {
  const p0 = along(path, f0); const b = sv(svg, 'circle', { cx: p0.x, cy: p0.y - (o.r || 20), r: o.r || 20, fill: o.fill || A.blue });
  const st = { f: f0 }; tl.to(st, { f: f1, duration: d, ease: o.ease || 'power1.inOut', onUpdate: () => { const p = along(path, st.f); b.setAttribute('cx', p.x); b.setAttribute('cy', p.y - (o.r || 20)); } }, clampT(t));
  return b;
}

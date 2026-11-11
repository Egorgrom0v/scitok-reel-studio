// ПРИМЕР · «N из M» точками: 399 точек, 123 перекрашиваются, счётчик на слове числа. Наборы: core.
const svg = svgLayer();
const cols = 21, cell = 30, x0 = 540 - (cols - 1) * cell / 2;
const d = dots(svg, 399, cols, x0, 170, cell, 10, A.line, 0.05, 0.002);
Tx('399 постов дошли до сверки', 540, 760, { size: 30, w: 600, color: A.sub, t: 0.3 });
const tc = Wv('сто', 2.3) - 0.5;
const r = rng(123); const idx = [...Array(399).keys()].sort(() => r() - 0.5).slice(0, 123);
idx.forEach((i, k) => tl.to(d[i], { attr: { fill: A.blue, r: 12 }, duration: 0.15 }, clampT(tc + k * 0.006)));
num(123, 540, 860, tc, { size: 110, w: 800, color: A.blue, dur: 0.8 });
exitAll();

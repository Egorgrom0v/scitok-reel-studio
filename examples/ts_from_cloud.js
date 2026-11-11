// ПРИМЕР · наборы: core, chem. // s7 · ГЕРОЙ: из схемы связей модель сама собирает переходное состояние на вершине перевала
const svg = svgLayer();
// схема на входе
const card = Kc(130, 165, 330, 230, 0.05, { r: 30 });
const svg2 = svgLayer(); svg2.style.zIndex = 5;
const sch = molAt(svg2, 295, 280, 44, SP.ketone, { s: 0.7, t: 0.15, step: 0.04 });
chip('схема связей', 295, 430, Wv('схему', 0.65), { tone: 'gray', size: 28, h: 54 });
const ar = lineA(svg, 480, 280, 630, 280, Wv('вещества', 0.95), { color: A.ink, w: 5, dur: 0.3 }); arrowAt(svg, ar, A.ink, 18, Wv('вещества', 0.95) + 0.25);
const brain = chip('модель', 760, 280, Wv('сама', 1.65) - 0.2, { tone: 'dark', size: 36, h: 80, px: 40 });
// энергетический профиль
const path = sv(svg, 'path', { d: eProfile(130, 950, 880, 620, 900, 540), fill: 'none', stroke: A.line, 'stroke-width': 8, 'stroke-linecap': 'round' });
drawOn(path, Wv('предлагает', 1.95) - 0.3, 0.6);
const hl = sv(svg, 'path', { d: eProfile(130, 950, 880, 620, 900, 540), fill: 'none', stroke: A.blue, 'stroke-width': 8, 'stroke-linecap': 'round' });
drawOn(hl, Wv('пути', 2.9) - 0.1, 0.7);
// облако атомов → переходное состояние на перевале
const TS = [['C', -1.1, 0.2], ['C', 0, -0.4], ['O', 0, -1.6], ['C', 1.1, 0.2], ['N', 2.0, -0.5], ['H', -1.9, -0.4], ['H', 1.0, 1.2], ['C', -1.2, 1.4]];
const r = rng(5);
const start = TS.map(() => [200 + r() * 680, 520 + r() * 300]);
const m = Mol(svg, TS.map(([el], i) => [el, start[i][0], start[i][1]]), [[0, 1, 1], [1, 2, 2], [1, 3, 1], [3, 4, 'ts'], [0, 5, 1], [3, 6, 'ts'], [0, 7, 1]], { s: 1.0 });
m.bonds.forEach(b => { b.p.op = 0; }); m.draw();
m.pop(Wv('сама', 1.65) - 0.1, 0.04);
const tp = Wv('перевал', 2.4) - 0.5;
TS.forEach(([, x, y], i) => m.move(i, 540 + x * 58, 520 + y * 58, tp + i * 0.03, 0.7, 'expo.inOut'));
m.bonds.forEach((b, i) => m.bondOp(i, 1, tp + 0.6 + i * 0.04, 0.25));
ringPulse(svg, 540, 520, 150, tp + 0.7);
tl.fromTo(brain, { scale: 1 }, { scale: 1.1, duration: 0.15, yoyo: true, repeat: 1 }, tp);
sfx('Riser_4', tp, { gain: 0.05, align: 'end' }); sfx('Select', tp + 0.7, { gain: 0.08 });
chip('переходное состояние', 540, 915, tp + 0.75, { tone: 'blue', size: 32, h: 64 });
exitAll();

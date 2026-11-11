// ПРИМЕР · «перевод»: человек пишет просьбу словами, ключевые слова вылетают из пузыря,
// проходят через исполнителя и садятся в ячейки строгого формата. Наборы: core.
// Подставь свой текст, индексы ключевых слов и подписи ячеек; слова фразы диктора — в Wv(...).
const TEXT = 'Размести сервис и держи загрузку процессора ниже 40 %';
const KEY = [5, 6, 7, 8];                       // индексы слов TEXT.split(' '), которые станут полями
const L = ['Метрика', 'Знак', 'Значение', 'Единица'], V = ['CPU', '≤', '40', '%'];
const bx = 120, by = 190;
const b = bubble(bx, by, 840, TEXT, 0.08, { type: Wv('словами', 1.7) - 0.1, who: 'Оператор' });
const nn = actor('Нейросеть', 540, 500, Wv('система', 2.35) - 0.15, { pulse: [Wv('переводит', 2.8)] });
const tsl = Wv('переводит', 2.8) - 0.2;
const slots = L.map((l, i) => slot(140 + i * 205, 640, 185, 160, l, '', tsl + 0.05 * i, { dy: 16 }));
const tf = Wv('переводит', 2.8) + 0.15;
KEY.forEach((k, i) => {
  hlWord(b._sp[k], Wv('обычными', 1.3) + 0.12 * i);
  const [sx, sy] = spanXY(b._sp[k], bx, by);
  const fly = hide0(chip(b._sp[k].textContent, sx, sy, null, { tone: 'blue', size: 34, h: 58, z: 7 }));
  const t0 = tf + i * 0.2, tx = 140 + i * 205 + 92, ty = 738;
  tl.set(fly, { opacity: 1 }, t0);
  tl.to(fly, { x: 540 - sx, y: 500 - sy, scale: 0.6, duration: 0.32, ease: 'power2.in' }, t0);      // в исполнителя
  tl.to(fly, { x: tx - sx, y: ty - sy, scale: 1, duration: 0.36, ease: 'expo.out' }, t0 + 0.32);  // в ячейку
  tl.to(fly, { opacity: 0, duration: 0.14 }, t0 + 0.6);
  swapV(slots[i], V[i], t0 + 0.58, { vc: A.blue });
  sfx('Click_UI Buttons_2', t0 + 0.6, { gain: 0.05 });
});
const tr = Math.max(tf + 1.3, Wv('требования', 4.35));
slots.forEach((k, i) => ring(k, A.blue, tr + 0.04 * i));
Tx('Требование', 540, 880, { size: 34, w: 600, color: A.blue, t: tr });
exitAll();

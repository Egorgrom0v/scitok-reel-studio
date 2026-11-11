// ПРИМЕР · «было → стало»: плашка статуса переворачивается на нужном слове. Наборы: core.
const card = Kc(190, 220, 700, 520, 0.05, { r: 40 });
Tx('BRCA2', 350, 110, { parent: card, size: 96, w: 800 });
Tx('вариант из поста', 350, 185, { parent: card, size: 30, w: 500, color: A.sub, t: 0.2 });
const fb = flipBadge(card, 110, 250, 480, 130, ['неопределённый', A.amber], ['патогенный', A.red]);
inA(fb, 0.3, { dy: 16 });
const when = Tx('когда писал пост', 350, 440, { parent: card, size: 32, w: 600, color: A.sub, t: 0.45 });
const tf = Wv('патогенным', Math.min(3.95, D - 0.4)) - 0.55;
fb.flip(tf); tl.to(when, { opacity: 0, duration: 0.15 }, tf);
Tx('сейчас в базе', 350, 440, { parent: card, size: 32, w: 700, t: tf + 0.4 });
sfx('Whoosh_6', tf, { gain: 0.06, align: 'end' }); sfx('Beep_8', tf + 0.6, { gain: 0.07 });
exitAll();

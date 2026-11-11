// DOM checks of a rendered shot (render_stage.js --check), no pixels and no vision model.
// Catches what Egor fixed by hand on stills: overlapping texts, text out of the safe zone or cut by the frame,
// an empty frame right after the cut, content that fills too little of the frame, small fonts.
// Each issue: {code, severity: 'error'|'warn', t, msg, text?}. Messages are in Russian: they go to the director.

const SAFE = { x0: 70, x1: 1010, y0: 110, y1: 975 };   // engine safe zone (100–980 × 140–950) + camera drift (±24 px) + tolerance
const STAGE = { w: 1080, h: 1000 };
const MIN_FONT = 22, EMPTY_AT = 0.35, MIN_FILL = 0.55;
// one big element by design: judged by a lower fill (storyboard "visual" = template name for compiled plans)
const SPARSE = { title_card: 0.2, big_number: 0.35, concept_strike: 0.35, term_def: 0.35, quote_card: 0.35 };

// runs in the page: visible boxes under #cam at the current time
function snapshot() {
  const cam = document.getElementById('cam');
  const opacityOf = (e) => { let o = 1; for (let x = e; x && x !== cam.parentElement; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity || '1'); return o; };
  const els = [...cam.querySelectorAll('*')];
  els.forEach((e, i) => { e.dataset.k = String(i); });
  const out = [];
  for (const e of els) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    let r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    const cls = typeof e.className === 'string' ? e.className : '';
    const bg = cs.backgroundColor, painted = bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg);
    const shape = ['IMG', 'circle', 'path', 'rect', 'line'].includes(e.tagName) || /\b(apc|apdoc|doc)\b/.test(cls) || painted;
    if (!own && !shape) continue;
    const op = opacityOf(e);
    if (op < 0.05) continue;
    const scale = e.offsetHeight ? r.height / e.offsetHeight : 1;
    if (own) {   // the glyphs, not the box: a wrapped text block is wider than its lines
      const rg = document.createRange(); rg.selectNodeContents(e);
      const rs = [...rg.getClientRects()].filter((q) => q.width > 0);
      if (rs.length) r = { left: Math.min(...rs.map((q) => q.left)), top: Math.min(...rs.map((q) => q.top)), right: Math.max(...rs.map((q) => q.right)), bottom: Math.max(...rs.map((q) => q.bottom)) };
    }
    const anc = [];
    for (let x = e.parentElement; x && x !== cam; x = x.parentElement) anc.push(x.dataset.k);
    out.push({ kind: own ? 'text' : 'shape', text: own.slice(0, 40), op, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom,
      font: own ? parseFloat(cs.fontSize) * scale : 0, mono: /mono/i.test(cs.fontFamily), k: e.dataset.k, anc });
  }
  return out;
}

const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const inter = (a, b) => area({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });

async function domCheck(page, sh, N, FPS) {
  const D = N / FPS, issues = [];
  const add = (code, severity, t, msg, text) => { if (!issues.some((i) => i.code === code && i.text === text)) issues.push({ code, severity, t: +t.toFixed(2), msg, ...(text ? { text } : {}) }); };
  const at = async (t) => { await page.evaluate((x) => window.seek(x), t); return page.evaluate(snapshot); };

  // 1. empty frame right after the cut
  const first = await at(Math.min(EMPTY_AT, D * 0.3));
  if (!first.some((b) => b.op > 0.3)) add('empty_start', 'error', EMPTY_AT, 'Пустой кадр после склейки: к 0,35 с на экране ничего нет. Первый элемент — с начала шота.');

  // 2–4. layout at the anchor and before the exit (exitAll starts at D − 0.32 s)
  const anchor = sh.anchor - sh.t0;
  const times = [D * 0.5, Math.min(D - 0.45, Math.max(0.4, anchor + 0.7)), D - 0.45].filter((t, i, a) => t > 0.2 && a.indexOf(t) === i);
  let fullest = null;
  for (const t of times) {
    const boxes = await at(t);
    const texts = boxes.filter((b) => b.kind === 'text' && b.op > 0.5);
    for (const b of texts) {
      if (b.x0 < 0 || b.x1 > STAGE.w || b.y0 < 0 || b.y1 > STAGE.h) add('text_cut', 'error', t, `Текст обрезан краем кадра: «${b.text}».`, b.text);
      else if (b.x0 < SAFE.x0 || b.x1 > SAFE.x1 || b.y0 < SAFE.y0 || b.y1 > SAFE.y1) add('text_unsafe', 'warn', t, `Текст вне безопасной зоны (x 100–980, y 140–950): «${b.text}».`, b.text);
      if (b.font && b.font < MIN_FONT) add('font_small', b.mono ? 'warn' : 'error', t, `Шрифт ${Math.round(b.font)} px меньше ${MIN_FONT}: «${b.text}».`, b.text);
    }
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if ((a.k && b.anc.includes(a.k)) || (b.k && a.anc.includes(b.k))) continue;
      const ov = inter(a, b);
      if (ov > 0.15 * Math.min(area(a), area(b))) add('overlap', 'error', t, `Тексты наезжают друг на друга: «${a.text}» и «${b.text}».`, `${a.text}|${b.text}`);
    }
    const vis = boxes.filter((b) => b.op > 0.3);
    if (vis.length) {
      const u = vis.reduce((m, b) => ({ x0: Math.min(m.x0, b.x0), y0: Math.min(m.y0, b.y0), x1: Math.max(m.x1, b.x1), y1: Math.max(m.y1, b.y1) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
      const fill = Math.max((Math.min(u.y1, SAFE.y1) - Math.max(u.y0, SAFE.y0)) / (SAFE.y1 - SAFE.y0), 0);
      const fillW = Math.max((Math.min(u.x1, SAFE.x1) - Math.max(u.x0, SAFE.x0)) / (SAFE.x1 - SAFE.x0), 0);
      if (!fullest || fill > fullest.fill) fullest = { t, fill, fillW, cy: (u.y0 + u.y1) / 2 };
    }
  }
  // a paper crop whose highlight was not found shows the page with nothing marked: the zoom has no target
  const paper = await page.evaluate(() => ({ docs: document.querySelectorAll('#cam .doc').length, hls: document.querySelectorAll('#cam .hl').length }));
  if (paper.docs && !paper.hls) add('paper_no_highlight', 'error', D - 0.45, 'Кроп статьи без подсветки: нужный текст не найден в кропе. Проверить highlight / цитату факта или взять другой кроп.');
  // fill is judged at the fullest moment: a counter that grows is fine if it ends big
  const minFill = SPARSE[sh.visual] || (String(sh.visual || '').startsWith('схема') ? 0.3 : MIN_FILL);
  if (fullest && fullest.fill < minFill && fullest.fillW < 0.8)
    add('too_small', 'warn', fullest.t, `Содержимое занимает ${Math.round(fullest.fill * 100)} % высоты кадра (нужно ≥ ${Math.round(minFill * 100)} %): крупнее или больше элементов.`);
  if (fullest && fullest.cy < 430) add('too_high', 'warn', fullest.t, `Содержимое сидит высоко (центр y ${Math.round(fullest.cy)}, нужен ~560): опустить.`);
  return issues;
}

module.exports = { domCheck };

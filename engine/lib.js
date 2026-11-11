// SciTok engine: component library for stage shots. Loaded before the video's shots.js.
// Globals for shots.js: S (shot data), C (crops), tl (GSAP timeline), cam, hud, COL, D (shot duration),
// ANC (anchor time - 0.1), clampT, el, txt, appear, show, wt, svgLayer, sv, drawOn, arrowHead, kicker, corners,
// srcLabel, docCard, wordCard, activate, bigNum, wordGraph, edge, rel. Define shots as SH.<shot_id> = () => {...}.
const S = window.SHOT, C = window.CROPS;
const tl = gsap.timeline({ paused: true });
const cam = document.getElementById('cam'), hud = document.getElementById('hud');
const THEME = window.THEME || 'light';
// PAL: palette the shots are written in. Old shots.js (v7, first wave) were written for dark: video.json "shots_theme": "dark"
// keeps COL dark while building and run.js recolours the result to light. New videos: write for COL, no flag.
const PAL = window.SHOTS_THEME || THEME;
const COL = PAL === 'light'
  ? { bg: '#F4F5F7', panel: '#FFFFFF', line: '#D5DAE1', ink: '#11151B', dim: '#5F6977', blue: '#2563EB', red: '#DC2F25', green: '#0E9F6E', amber: '#B97700' }
  : { bg: '#07090D', panel: '#0E131B', line: '#1E2733', ink: '#F2F4F7', dim: '#8A94A3', blue: '#4C8DFF', red: '#FF5A4E', green: '#3DDC97', amber: '#FFC24B' };
const NS = 'http://www.w3.org/2000/svg';
const D = S.dur;
const ANC = Math.max(0.05, S.anchor - 0.1);
const clampT = t => Math.max(0, Math.min(D - 0.05, t));

function el(tag, cls, css, html, parent) {
  const e = document.createElement(tag); if (cls) e.className = cls;
  if (css) Object.assign(e.style, css); if (html != null) e.innerHTML = html;
  (parent || cam).appendChild(e); return e;
}
// text: y is the vertical centre; align c|l|r
function txt(html, x, y, o = {}) {
  const e = el('div', 'abs', {
    left: x + 'px', top: y + 'px', fontFamily: o.font === 'mono' ? "'JBM','Sym'" : "'Fira','Sym'",
    fontWeight: o.w || (o.font === 'mono' ? 500 : 800), fontSize: (o.size || 48) + 'px', color: o.color || COL.ink,
    letterSpacing: o.ls || '0', fontStyle: o.italic ? 'italic' : 'normal', lineHeight: o.lh || '1.0',
    textTransform: o.caps ? 'uppercase' : 'none', opacity: o.op == null ? 1 : o.op, whiteSpace: o.wrap ? 'normal' : 'nowrap',
    width: o.width ? o.width + 'px' : 'auto', textAlign: o.talign || 'left'
  }, html, o.parent);
  const xp = o.align === 'l' ? 0 : o.align === 'r' ? -100 : -50;
  gsap.set(e, { xPercent: xp, yPercent: -50 });
  return e;
}
function appear(e, t, o = {}) {
  t = clampT(t);
  tl.fromTo(e, { y: o.dy == null ? 40 : o.dy, opacity: 0, filter: 'blur(8px)' },
    { y: 0, opacity: o.op == null ? 1 : o.op, filter: 'blur(0px)', duration: o.d || 0.42, ease: o.ease || 'expo.out' }, t);
  return e;
}
function show(e, t, op = 1) { tl.set(e, { opacity: op }, clampT(t)); }
function wt(word, n = 0) {
  let k = 0;
  for (const w of S.words) { if (w.w.toLowerCase().replace(/[«»„“"]/g, '').startsWith(word.toLowerCase())) { if (k === n) return w.t0; k++; } }
  return null;
}
function svgLayer(parent) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('width', 1080); s.setAttribute('height', 1000);
  Object.assign(s.style, { position: 'absolute', left: 0, top: 0, overflow: 'visible' });
  (parent || cam).appendChild(s); return s;
}
function sv(parent, tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; }
function drawOn(p, t, d = 0.45, ease = 'power2.out') {
  const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
  tl.to(p, { strokeDashoffset: 0, duration: d, ease }, clampT(t)); return p;
}
function arrowHead(svg, path, color, size = 18) {
  const L = path.getTotalLength(); const a = path.getPointAtLength(L), b = path.getPointAtLength(Math.max(0, L - 6));
  const ang = Math.atan2(a.y - b.y, a.x - b.x);
  const p1 = [a.x - size * Math.cos(ang - 0.45), a.y - size * Math.sin(ang - 0.45)], p2 = [a.x - size * Math.cos(ang + 0.45), a.y - size * Math.sin(ang + 0.45)];
  return sv(svg, 'polygon', { points: `${a.x},${a.y} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`, fill: color });
}
// kicker: hidden by default (layout v8 has no top HUD); kept so old shots.js still run. video.json "chrome_ui": true brings it back.
function kicker(text) {
  if (!window.CHROME_UI) return;
  el('div', 'kbr', null, null, hud);
  el('div', 'kicker', null, text, hud);
  el('div', 'kline', null, null, hud);
}
function corners() {
  if (!window.CHROME_UI) return;
  const L = 40, c = [[L, L, 'Top', 'Left'], [1080 - L - 28, L, 'Top', 'Right'], [L, 1000 - L - 28, 'Bottom', 'Left'], [1080 - L - 28, 1000 - L - 28, 'Bottom', 'Right']];
  for (const [x, y, v, h] of c) { const e = el('div', 'corner', { left: x + 'px', top: y + 'px' }, null, hud); e.style['border' + v + 'Width'] = '2px'; e.style['border' + h + 'Width'] = '2px'; }
}
function srcLabel(text, x, y, align = 'l') { return txt(text, x, y, { font: 'mono', size: 18, color: COL.dim, align }); }

// ---- document card ----
// Default (v8): frameless — no white card, no shadow, no clipping; the crop is drawn larger (bleed) and may run past the
// stage edges; zoom moves the whole image. In the light theme paper white blends into the background (multiply).
// o.frame: true gives the old white card with zoom inside it. o.bleed (default 1.2) scales the fit box beyond maxW/maxH.
function docCard(key, o) {
  const c = C[key]; const framed = !!o.frame;
  const pad = framed ? (o.pad == null ? 22 : o.pad) : 0;
  const bleed = framed ? 1 : (o.bleed == null ? 1.2 : o.bleed);
  const maxW = (o.maxW || 960) * bleed, maxH = (o.maxH || 760) * bleed;
  const sc = Math.min((maxW - 2 * pad) / c.w, (maxH - 2 * pad) / c.h);
  const iw = c.w * sc, ih = c.h * sc, W = iw + 2 * pad, H = ih + 2 * pad;
  const cx = o.cx == null ? 540 : o.cx, cy = o.cy == null ? 540 : o.cy;
  const left = cx - W / 2, top = cy - H / 2;
  const card = el('div', framed ? 'doc' : null, framed ? { left: left + 'px', top: top + 'px', width: W + 'px', height: H + 'px' }
    : { position: 'absolute', left: left + 'px', top: top + 'px', width: W + 'px', height: H + 'px', overflow: 'visible' });
  const inner = el('div', null, { position: 'absolute', left: 0, top: 0, width: W + 'px', height: H + 'px' }, null, card);
  const img = el('img', null, { position: 'absolute', left: pad + 'px', top: pad + 'px', width: iw + 'px', height: ih + 'px' }, null, inner);
  img.src = window.BUILD_URL + '/' + c.file;
  if (!framed && PAL === 'light') img.style.mixBlendMode = 'multiply';
  const boxes = c.boxes.map(b => [pad + b[0] * sc, pad + b[1] * sc, pad + b[2] * sc, pad + b[3] * sc]);
  const hls = [];
  if (o.hlAt != null && boxes.length) {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('width', W); s.setAttribute('height', H);
    Object.assign(s.style, { position: 'absolute', left: 0, top: 0, overflow: 'visible' }); inner.appendChild(s);
    const m = sv(s, 'mask', { id: 'm_' + key }); sv(m, 'rect', { x: 0, y: 0, width: W, height: H, fill: 'white' });
    for (const b of boxes) sv(m, 'rect', { x: b[0], y: b[1], width: b[2] - b[0], height: b[3] - b[1], rx: 8, fill: 'black' });
    const ov = sv(s, 'rect', { x: 0, y: 0, width: W, height: H, fill: PAL === 'light' ? 'rgba(244,245,247,0.72)' : 'rgba(7,9,13,0.55)', mask: `url(#m_${key})` });
    s.style.opacity = 0; tl.to(s, { opacity: 1, duration: 0.35, ease: 'expo.out' }, clampT(o.hlAt));
    boxes.forEach((b, i) => {
      const h = el('div', 'hl' + (o.color === 'red' ? ' red' : ''), { left: (b[0] - 6) + 'px', top: (b[1] - 6) + 'px', width: (b[2] - b[0] + 12) + 'px', height: (b[3] - b[1] + 12) + 'px' }, null, inner);
      const t = o.hlAt + (o.hlStagger || 0) * i;
      tl.fromTo(h, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'expo.out' }, clampT(t));
      hls.push(h);
    });
  }
  appear(card, o.at || 0, { dy: o.dy == null ? 40 : o.dy });
  const zoom = o.zoom || (framed ? null : [1, 1.08]);
  if (zoom) {
    let fx = W / 2, fy = H / 2;
    if (o.focus != null && boxes.length) { const b = o.focus === 'all' ? boxes.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[2], q[2]), Math.max(a[3], q[3])]) : boxes[o.focus]; fx = o.originX === 'left' ? Math.max(0, b[0] - 10) : o.originX === 'right' ? Math.min(W, b[2] + 10) : (b[0] + b[2]) / 2; fy = (b[1] + b[3]) / 2; }
    gsap.set(inner, { transformOrigin: `${fx}px ${fy}px` });
    tl.fromTo(inner, { scale: zoom[0] }, { scale: zoom[1], duration: o.zoomD || D, ease: o.zoomEase || 'power2.inOut' }, o.zoomAt || 0);
  }
  if (o.label) {   // source caption: under the image, kept inside the visible stage
    const ly = Math.min(top + H + 30, 965), lx = Math.max(90, Math.min(left, 700));
    const l = srcLabel(o.label, lx, ly, 'l'); l.style.zIndex = 5; l.style.background = COL.bg; l.style.padding = '3px 8px'; appear(l, (o.at || 0) + 0.15);
  }
  return { card, inner, boxes, left, top, W, H, sc, pad, hls };
}

// ---- word card ----
function wordCard(text, x, y, o = {}) {
  const w = o.w || 300, h = o.h || 78;
  const e = el('div', 'card', { left: (x - w / 2) + 'px', top: (y - h / 2) + 'px', width: w + 'px', height: h + 'px' }, null, o.parent);
  const t = txt(text, w / 2, h / 2 - 2, { size: o.size || 38, parent: e, color: o.color || COL.ink });
  if (o.dimText) t.style.opacity = 0.25;
  e._t = t; return e;
}
function activate(card, t, color = COL.blue) {
  tl.to(card, { borderColor: color, borderWidth: 4, duration: 0.18, ease: 'power2.out' }, clampT(t));
}
// ---- big number: chars appear left to right ----
function bigNum(chars, x, y, o = {}) {
  const box = el('div', 'abs', { left: x + 'px', top: y + 'px', fontFamily: "'Fira','Sym'", fontWeight: 800, fontSize: (o.size || 250) + 'px', color: o.color || COL.ink, lineHeight: 1, display: 'flex', alignItems: 'baseline', textShadow: o.glow ? `0 0 40px ${o.glow}` : 'none' });
  gsap.set(box, { xPercent: -50, yPercent: -50 });
  const spans = chars.map(ch => {
    const s = el('span', null, { display: 'inline-block', whiteSpace: 'pre', fontSize: ch.size ? ch.size + 'px' : 'inherit', color: ch.color || 'inherit', marginLeft: ch.ml ? ch.ml + 'px' : 0, fontFamily: ch.mono ? 'JBM' : 'inherit', fontWeight: ch.mono ? 700 : 'inherit' }, ch.t != null ? ch.t : ch, box);
    return s;
  });
  spans.forEach((s, i) => appear(s, (o.at || 0) + i * (o.step || 0.08), { dy: 50 }));
  return box;
}
// ---- graph of words on a circle ----
function wordGraph(words, cx, cy, r, o = {}) {
  const svg = svgLayer(o.parent); const nodes = [];
  const pos = words.map((w, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / words.length; return [cx + r * Math.cos(a), cy + r * Math.sin(a) * (o.ry || 1)]; });
  const edgesG = sv(svg, 'g', {});
  words.forEach((w, i) => {
    const n = el('div', 'card', { left: pos[i][0] + 'px', top: pos[i][1] + 'px', padding: '0 18px', height: (o.nh || 62) + 'px', borderRadius: '31px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontFamily: 'Fira', fontWeight: 800, fontSize: (o.fs || 30) + 'px', color: COL.ink, zIndex: 2 }, w, o.parent);
    gsap.set(n, { xPercent: -50, yPercent: -50 }); nodes.push(n);
  });
  return { svg, edgesG, pos, nodes };
}
function edge(g, p, q, o = {}) {
  return sv(g, 'line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: o.color || COL.blue, 'stroke-width': o.w || 3, 'stroke-linecap': 'round', opacity: o.op == null ? 0.75 : o.op });
}

// ---- common frame ----
corners();
tl.fromTo(cam, { scale: 1, x: 0 }, { scale: 1.04, x: S.driftX || 0, duration: D, ease: 'power1.out' }, 0);

// ---- media slot placeholder: where a generation (Flow) or outside footage will go ----
// m = {kind: 'gen' | 'stock', ru: 'what is in the frame (Russian)', prompt: 'English prompt for Flow'}.
// Real file: videos/<slug>/media/<shot_id>.mp4|png — render_stage.js puts it in place of this placeholder.
function mediaSlot(m) {
  const gen = m.kind === 'gen';
  const bg = el('div', null, { position: 'absolute', inset: '0', background: PAL === 'light'
    ? (gen ? 'linear-gradient(160deg,#E4E9F2,#CFD8E6)' : 'linear-gradient(160deg,#ECE8E1,#DAD3C8)')
    : 'linear-gradient(160deg,#121823,#0B0F16)' }, null, hud);
  const sheen = el('div', null, { position: 'absolute', top: '-20%', bottom: '-20%', width: '260px', left: '-300px',
    background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)', transform: 'skewX(-18deg)' }, null, hud);
  tl.fromTo(sheen, { x: 0 }, { x: 1700, duration: Math.max(1.2, D), ease: 'none' }, 0);
  el('div', null, { position: 'absolute', left: '100px', top: '130px', right: '100px', bottom: '110px', border: `3px dashed ${COL.dim}`,
    borderRadius: '24px', opacity: 0.55 }, null, hud);
  const tag = txt(gen ? 'ГЕНЕРАЦИЯ · FLOW' : 'ВНЕШНИЙ КАДР · ФОТО / ВИДЕО', 140, 185, { font: 'mono', size: 24, color: gen ? COL.blue : COL.amber, align: 'l', ls: '.12em', parent: hud });
  const ru = txt(m.ru || '', 540, 470, { size: 46, color: COL.ink, wrap: true, width: 780, talign: 'center', lh: '1.15', parent: hud });
  ru.style.whiteSpace = 'normal';
  const pr = txt(m.prompt || '', 540, 700, { font: 'mono', size: 20, color: COL.dim, wrap: true, width: 780, talign: 'center', lh: '1.35', parent: hud });
  pr.style.whiteSpace = 'normal';
  txt(S.id + ' · ' + D.toFixed(1) + ' с', 940, 850, { font: 'mono', size: 20, color: COL.dim, align: 'r', parent: hud });
  appear(ru, 0.05); appear(pr, 0.15); appear(tag, 0);
}

function rel(e) { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }
// ---- sound: sfx('Select', t, {gain, align}) — a file from kit sfx/ (name without extension).
// align 'peak' (default): the loudest moment of the file lands on t — for sounds that voice an action (click, pop, draw).
// align 'end': the peak lands slightly before t (lead) — for atmosphere (whoosh, riser) before a change. gain: 0..1.
window.SFX_EVENTS = [];
function sfx(name, t, o = {}) { window.SFX_EVENTS.push({ name, t: clampT(t), gain: o.gain == null ? null : o.gain, align: o.align || 'peak', lead: o.lead || 0 }); }
const SH = {};

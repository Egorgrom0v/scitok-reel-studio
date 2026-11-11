// SciTok · «живая схема» (pipeline v4): механизм статьи одной картинкой, которая живёт через несколько фраз.
// Режиссёр описывает объекты (ряд слов, блоки, точки, шкала, подписи) один раз на ролик и шаги на словах озвучки:
// подсветить, провести связи, сканер, головы внимания, метки позиций, перемешать, дорастить, зачеркнуть, приблизить.
// Раскладку, размеры, цвета и движение делает код — стиль Apple из ds_apple.js не плывёт.
// Шот схемы = все прежние шаги этой схемы мгновенно (prior) + свои шаги на словах (steps).
// Загружается после lib.js, ds_apple.js и templates.js (AT, toneColor, sfxSoft, SAFE).

const DG = (() => {
  const BAND = { top: 330, center: 560, bottom: 800 };
  const yOf = (y, fb = 'center') => (typeof y === 'number' ? y : BAND[y] || BAND[fb]);

  function make(p) {
    const root = el('div', null, { position: 'absolute', left: 0, top: 0, width: '1080px', height: '1000px', transformOrigin: '540px 560px' });
    const svg = svgLayer(root); svg.style.zIndex = 4;
    const g = { root, svg, obj: {}, links: {}, nlink: 0, beam: null, p };
    for (const o of p.objects || []) g.obj[o.id] = build(g, o);
    unstack(g);
    for (const ob of Object.values(g.obj)) if (ob.chain) ob.items.forEach((it, i) => { if (i > 0) it.edgeIn = chainArrow(g, ob.items[i - 1], it); });
    return g;
  }

  // Objects declared at the same band would overlap (31.10: a puzzle grid over the stage boxes): keep their order
  // top to bottom, push each one below the previous with a gap, and if the stack is too tall, squeeze the gaps.
  // rectangles already on the stage: every item of every object (but the one a label belongs to) and the captions
  function occupied(g, except) {
    const out = [];
    for (const ob of Object.values(g.obj)) {
      for (const it of ob.items) if (it !== except && it.w) out.push([it.x - it.w / 2 - 6, it.y - it.h / 2 - 6, it.x + it.w / 2 + 6, it.y + it.h / 2 + 6]);
      if (ob.label) { const r = ob.label.getBoundingClientRect(); out.push([r.left - 6, r.top - 6, r.right + 6, r.bottom + 6]); }
    }
    return out;
  }

  function unstack(g) {
    const obs = Object.values(g.obj).filter((ob) => ob.items.length && ob.type !== 'label');
    const ext = (ob) => { let a = 1e9, b = -1e9; for (const it of ob.items) { a = Math.min(a, it.y - it.h / 2); b = Math.max(b, it.y + it.h / 2); }
      if (ob.label) a -= 70; return [a, b]; };
    obs.sort((u, v) => (ext(u)[0] + ext(u)[1]) - (ext(v)[0] + ext(v)[1]));
    const shift = (ob, dy) => { if (!dy) return; for (const it of ob.items) place(it, it.x, it.y + dy);
      if (ob.label) gsap.set(ob.label, { y: '+=' + dy }); };
    for (let i = 1; i < obs.length; i++) { const prev = ext(obs[i - 1])[1], [top] = ext(obs[i]); if (top < prev + 36) shift(obs[i], prev + 36 - top); }
    const last = obs.length ? ext(obs[obs.length - 1])[1] : 0, first = obs.length ? ext(obs[0])[0] : 0;
    if (last > 930) { const up = Math.min(last - 930, Math.max(0, first - 150)); obs.forEach((ob) => shift(ob, -up)); }
    if (obs.length) { // the stack as a whole sits around y 560 (leave room for a title on top and a note below)
      const top = Math.min(...obs.map((ob) => ext(ob)[0])), bottom = Math.max(...obs.map((ob) => ext(ob)[1]));
      const want = (g.p.title ? 600 : 560) - (top + bottom) / 2, room = Math.max(0, 870 - bottom), up = Math.max(0, top - 250);
      const dy = Math.max(-up, Math.min(room, want));
      if (Math.abs(dy) > 8) obs.forEach((ob) => shift(ob, dy));
    }
    g.bottom = obs.length ? Math.max(...obs.map((ob) => ext(ob)[1])) : 800;  // notes go under the lowest object
  }

  // an arrow from one chain step to the next (same row: straight; next row: down and back to the start)
  function chainArrow(g, a, b) {
    let d;
    if (Math.abs(a.y - b.y) < 4) d = `M ${a.x + a.w / 2 + 8} ${a.y} L ${b.x - b.w / 2 - 12} ${b.y}`;
    else { const my = (a.y + b.y) / 2; d = `M ${a.x} ${a.y + a.h / 2 + 6} L ${a.x} ${my} L ${b.x} ${my} L ${b.x} ${b.y - b.h / 2 - 12}`; }
    const path = sv(g.svg, 'path', { d, fill: 'none', stroke: A.faint, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    arrowHead(g.svg, path, A.faint, 14); path.style.opacity = 0; path._head = path.nextSibling;
    if (path._head) path._head.style.opacity = 0;
    return path;
  }
  function showEdge(it, t, now) {
    const p = it.edgeIn; if (!p) return;
    if (now) { p.style.opacity = 1; if (p._head) p._head.style.opacity = 1; return; }
    tl.set(p, { opacity: 1 }, clampT(t)); drawOn(p, t, 0.35); if (p._head) tl.to(p._head, { opacity: 1, duration: 0.2 }, clampT(t + 0.3));
  }

  // ---------------------------------------------------------------- objects
  function pill(g, text, o = {}) {
    const e = el('div', 'apc', { display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', fontFamily: "'Inter','Sym'",
      fontWeight: o.w || 600, fontSize: (o.size || 44) + 'px', color: A.ink, height: (o.h || 78) + 'px', padding: `0 ${o.px || 22}px`,
      borderRadius: (o.r || 20) + 'px', zIndex: 3, opacity: 0, transition: 'none' }, text, g.root);
    return e;
  }
  function place(it, x, y) { it.x = x; it.y = y; gsap.set(it.e, { left: x, top: y, xPercent: -50, yPercent: -50 }); }
  function rowLayout(items, cy, maxW = 900, gap = 12, lh = 150) {
    const rows = [[]]; let cur = 0;
    for (const it of items) { if (cur + it.w > maxW && rows[rows.length - 1].length) { rows.push([]); cur = 0; } rows[rows.length - 1].push(it); cur += it.w + gap; }
    const y0 = cy - (rows.length - 1) * lh / 2;
    rows.forEach((r, ri) => { const tot = r.reduce((a, it) => a + it.w, 0) + gap * (r.length - 1); let x = 540 - tot / 2;
      for (const it of r) { place(it, x + it.w / 2, y0 + ri * lh); x += it.w + gap; } });
    return rows.length;
  }
  function fitTokens(g, o, words) {
    // one line if it fits at a readable size (links read best on one row), else the biggest two-line size
    const make_ = (size) => words.map((w) => { const e = pill(g, w, { size, h: Math.round(size * 1.7), px: Math.round(size * 0.42) }); return { e, w: e.offsetWidth, h: e.offsetHeight, text: w }; });
    const width = (items) => items.reduce((a, it) => a + it.w, 0) + 12 * (items.length - 1);
    for (const size of [52, 46, 40, 36, 32]) {
      const items = make_(size); if (width(items) <= 900) return { items, size };
      items.forEach((it) => it.e.remove());
    }
    for (const size of [48, 42, 36, 30]) {
      const items = make_(size); if (width(items) <= 880 * 2 || size === 30) return { items, size };
      items.forEach((it) => it.e.remove());
    }
  }
  function build(g, o) {
    const ob = { id: o.id, type: o.type, o, items: [], hidden: !!o.hidden };
    if (o.type === 'tokens') {
      const { items, size } = fitTokens(g, o, o.items); ob.items = items; ob.size = size;
      const oneLine = items.reduce((a, it) => a + it.w, 0) + 12 * (items.length - 1) <= 900;
      // a phrase that needs two lines reads better as a ring: links stay straight and do not cross the rows
      if (o.layout === 'ring' || (!o.layout && !oneLine && items.length <= 12)) {
        const r = o.r || Math.min(330, 150 + items.length * 20), cy = yOf(o.y) + 20;
        items.forEach((it, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / items.length; place(it, 540 + r * Math.cos(a), cy + r * 0.9 * Math.sin(a)); });
        ob.ring = true;
      } else ob.rows = rowLayout(items, yOf(o.y));
    } else if (o.type === 'boxes') {
      const col = o.layout === 'column';
      // a row stays inside the safe zone (x 100–980; the stage zoom crops the edges: 01.11 «…агенты», «Продук…»)
      const n = o.items.length, rowGap = n > 3 ? 36 : 60, w = col ? 620 : Math.min(380, (860 - (n - 1) * rowGap) / n), h = col ? Math.min(130, 560 / n - 40) : 190;
      ob.items = o.items.map((b) => {
        const e = el('div', 'apc', { width: w + 'px', height: h + 'px', borderRadius: '26px', zIndex: 3, opacity: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center' }, null, g.root);
        const t = typeof b === 'string' ? b : b.text, sub = typeof b === 'string' ? '' : b.sub;  // a bare string has String.prototype.sub
        const td = el('div', null, { fontFamily: "'Inter','Sym'", fontWeight: 700, fontSize: (col ? 44 : t.length > 12 ? 36 : 46) + 'px', color: A.ink, lineHeight: 1.1, padding: '0 14px', maxWidth: w + 'px', boxSizing: 'border-box' }, t, e);
        // a word never breaks inside: the text gets smaller until the longest word fits the card
        for (let fs = col ? 44 : t.length > 12 ? 36 : 46; td.scrollWidth > w + 1 && fs > 22; fs -= 2) td.style.fontSize = fs - 2 + 'px';
        if (sub) el('div', null, { fontFamily: "'Inter','Sym'", fontWeight: 500, fontSize: '28px', color: A.sub, lineHeight: 1.15, padding: '0 14px' }, sub, e);
        return { e, w, h, text: t };
      });
      if (col) { const gap = 46, tot = n * h + (n - 1) * gap, y0 = yOf(o.y) - tot / 2 + h / 2; ob.items.forEach((it, i) => place(it, 540, y0 + i * (h + gap))); }
      else { const gap = rowGap, tot = n * w + (n - 1) * gap, x0 = 540 - tot / 2 + w / 2; ob.items.forEach((it, i) => place(it, x0 + i * (w + gap), yOf(o.y))); }
      ob.col = col;
    } else if (o.type === 'dots') {
      const n = Math.min(400, o.n || 100), cols = o.cols || Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      const step = Math.min(64, 860 / cols, 440 / rows), r = step * 0.34, y0 = yOf(o.y) - ((rows - 1) * step) / 2, x0 = 540 - ((cols - 1) * step) / 2;
      for (let i = 0; i < n; i++) {
        const e = el('div', null, { position: 'absolute', width: 2 * r + 'px', height: 2 * r + 'px', borderRadius: '50%', background: A.soft, zIndex: 3, opacity: 0 }, null, g.root);
        const it = { e, w: 2 * r, h: 2 * r }; place(it, x0 + (i % cols) * step, y0 + Math.floor(i / cols) * step); ob.items.push(it);
      }
      ob.dot = true;
    } else if (o.type === 'chain') {
      // a sequence the viewer reads left to right: question -> step -> step -> answer; arrows show what leads to what
      const words = o.items.map((w) => (typeof w === 'string' ? w : w.text));
      let size = 44, made;
      for (size of [44, 40, 36, 32, 28]) {
        made = words.map((w) => { const e = pill(g, w, { size, h: Math.round(size * 1.75), px: Math.round(size * 0.45) }); return { e, w: e.offsetWidth, h: e.offsetHeight, text: w }; });
        const rowsNeeded = Math.ceil(made.reduce((a, it) => a + it.w + 64, -64) / 860);
        if (rowsNeeded <= 2 || size === 28) break;
        made.forEach((it) => it.e.remove());
      }
      ob.items = made; ob.size = size;
      ob.rows = rowLayout(made, yOf(o.y), 860, 64, Math.round(size * 1.75) + 64);
      ob.chain = true;  // the arrows are drawn after the layout (unstack may move the chain)
    } else if (o.type === 'grid') {
      // a puzzle board, a small table or matrix: cells in rows (Survo, sudoku, attention matrix); a cell is a child id.k
      const cells = o.items || [], cols = Math.max(1, o.cols || Math.ceil(Math.sqrt(cells.length))), rows = Math.ceil(cells.length / cols);
      const step = Math.min(150, 880 / cols, (o.y === 'center' ? 520 : 400) / rows), side = Math.round(step - 12), size = Math.max(24, Math.round(side * 0.42));
      const y0 = yOf(o.y) - ((rows - 1) * step) / 2, x0 = 540 - ((cols - 1) * step) / 2;
      ob.items = cells.map((c, i) => {
        const text = c == null ? '' : String(c);
        const e = pill(g, text, { size, h: side, px: 0, r: Math.round(side * 0.18), w: 700 });
        e.style.width = side + 'px';
        const it = { e, w: side, h: side, text }; place(it, x0 + (i % cols) * step, y0 + Math.floor(i / cols) * step); return it;
      });
      ob.grid = true;
    } else if (o.type === 'meter') {
      const y = yOf(o.y, 'bottom'), x0 = 170, w = 740;
      const track = el('div', null, { position: 'absolute', left: x0 + 'px', top: (y - 14) + 'px', width: w + 'px', height: '28px', borderRadius: '14px', background: A.soft, zIndex: 3, opacity: 0 }, null, g.root);
      const fill = el('div', null, { position: 'absolute', left: 0, top: 0, width: w + 'px', height: '28px', borderRadius: '14px', background: toneColor(o.tone, 'blue'), transformOrigin: '0% 50%' }, null, track);
      gsap.set(fill, { scaleX: Math.max(0, Math.min(1, (o.value || 0) / (o.max || 1))) });
      const lab = o.label ? Tx(o.label, 540, y - 52, { size: 30, w: 600, color: A.sub, parent: g.root }) : null; if (lab) lab.style.opacity = 0;
      ob.items = [{ e: track, x: 540, y, w, h: 28 }]; ob.fill = fill; ob.label = lab; ob.max = o.max || 1;
    } else if (o.type === 'label') {
      const e = Tx(o.text, 540, yOf(o.y, 'bottom'), { size: o.size || 34, w: 600, color: toneColor(o.tone, 'gray') === A.faint ? A.sub : toneColor(o.tone, 'ink'), wrap: true, width: 860, talign: 'center', parent: g.root });
      e.style.opacity = 0; ob.items = [{ e, x: 540, y: yOf(o.y, 'bottom'), w: e.offsetWidth, h: e.offsetHeight }];
    }
    return ob;
  }

  // ---------------------------------------------------------------- targets
  function items(g, ref) {
    const refs = Array.isArray(ref) ? ref : String(ref).split(',');
    const out = [];
    for (const r0 of refs) {
      const r = r0.trim(); const [id, k] = r.split('.'); const ob = g.obj[id];
      if (!ob) continue;
      if (k == null || k === '*') out.push(...ob.items);
      else if (k.includes('-')) { const [a, b] = k.split('-').map(Number); out.push(...ob.items.slice(a, b + 1)); }
      else if (ob.items[+k]) out.push(ob.items[+k]);
    }
    return out;
  }
  const groupOf = (g, ref) => g.obj[String(Array.isArray(ref) ? ref[0] : ref).split(',')[0].trim().split('.')[0]];

  // ---------------------------------------------------------------- steps
  // every action: (g, s, t, now) — now = applied instantly at t (earlier shots of the same diagram)
  const ease = 'expo.out';
  const to = (g, target, vars, t, now, d = 0.4) => (now ? tl.set(target, vars, 0) : tl.to(target, { ...vars, duration: d, ease }, clampT(t)));
  function ring(e, col, wpx = 4) { return `0 0 0 ${wpx}px ${col}, 0 12px 32px rgba(0,0,0,.07)`; }
  function linkPath(g, a, b, s, grp) {
    const col = toneColor(s.tone, 'blue');
    let d;
    // a row: an arc above it — tokens always; boxes and chain steps when other items stand between the two
    // (01.11: a straight line from «Вершина» to «Продукт» ran through «Спуск» and read as a strike-out)
    const skip = grp && grp.items && Math.abs(grp.items.indexOf(a) - grp.items.indexOf(b)) > 1;
    if (grp && !grp.ring && Math.abs(a.y - b.y) < 5 && (grp.type === 'tokens' || (skip && !grp.col))) {
      if (grp.type === 'boxes') {  // tall cards: a low arc under the row (above it stand the title and other objects)
        const drop = Math.min(130, 50 + Math.abs(b.x - a.x) * 0.18), ya = a.y + a.h / 2 + 6, yb = b.y + b.h / 2 + 6;
        d = `M${a.x} ${ya} Q ${(a.x + b.x) / 2} ${Math.max(ya, yb) + drop} ${b.x} ${yb}`;
        return { d, col };
      }
      const lift = Math.min(250, 60 + Math.abs(b.x - a.x) * 0.38), ya = a.y - a.h / 2 - 6, yb = b.y - b.h / 2 - 6;
      d = `M${a.x} ${ya} Q ${(a.x + b.x) / 2} ${Math.min(ya, yb) - lift} ${b.x} ${yb}`;
    } else {                                                                           // a straight line, edge to edge
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const ra = Math.min(a.w, a.h) / 2 + 6, rb = Math.min(b.w, b.h) / 2 + 10;
      const ka = Math.abs(ux) * a.w / 2 > Math.abs(uy) * a.h / 2 ? a.w / 2 / Math.max(0.2, Math.abs(ux)) : a.h / 2 / Math.max(0.2, Math.abs(uy));
      const kb = Math.abs(ux) * b.w / 2 > Math.abs(uy) * b.h / 2 ? b.w / 2 / Math.max(0.2, Math.abs(ux)) : b.h / 2 / Math.max(0.2, Math.abs(uy));
      const sa = Math.min(ka, L / 2.5) + 6 || ra, sb = Math.min(kb, L / 2.5) + 10 || rb;
      d = `M${a.x + ux * sa} ${a.y + uy * sa} L${b.x - ux * sb} ${b.y - uy * sb}`;
    }
    return { d, col };
  }
  function addLink(g, a, b, s, w, t, now, k, name, label) {
    const grp = s._grp, { d, col } = linkPath(g, a, b, s, grp);
    const width = 2 + 10 * w, op = 0.35 + 0.65 * w;
    const p = sv(g.svg, 'path', { d, stroke: col, 'stroke-width': width, fill: 'none', 'stroke-linecap': 'round', opacity: op });
    const parts = [p];
    if (s.arrow) { const h = arrowHead(g.svg, p, col, 14 + width); h.style.opacity = now ? op : 0; parts.push(h); if (!now) tl.to(h, { opacity: op, duration: 0.1 }, clampT(t + 0.35 + k * 0.06)); }
    if (label) {
      const mid = p.getPointAtLength(p.getTotalLength() / 2);
      const l = Tx(label, mid.x, mid.y - 4, { size: 26, w: 700, color: col, parent: g.root, z: 6 });
      l.style.background = A.bg; l.style.padding = '2px 8px'; l.style.borderRadius = '8px'; l.style.opacity = now ? 1 : 0; parts.push(l);
      if (!now) tl.to(l, { opacity: 1, duration: 0.2 }, clampT(t + 0.3 + k * 0.06));
    }
    if (now) show(p, 0, op); else drawOn(p, clampT(t + k * 0.06), 0.4);
    (g.links[name] = g.links[name] || []).push(...parts);
  }
  const A_ = {
    show(g, s, t, now) { items(g, s.target).forEach((it, i) => { now ? show(it.e, 0) : inA(it.e, t + i * (s.stagger ?? 0.05), { dy: 18, d: 0.45 }); showEdge(it, t + i * (s.stagger ?? 0.05), now); });
      for (const ob of Object.values(g.obj)) if (ob.label && items(g, s.target).includes(ob.items[0])) now ? show(ob.label, 0) : inA(ob.label, t); },
    hide(g, s, t, now) { items(g, s.target).forEach((it) => to(g, it.e, { opacity: 0 }, t, now, 0.3)); },
    focus(g, s, t, now) {
      const col = toneColor(s.tone, 'blue'), on = items(g, s.target), grp = groupOf(g, s.target);
      on.forEach((it) => { to(g, it.e, { opacity: 1, boxShadow: ring(it.e, col), backgroundColor: A.tint(col, 0.1), scale: 1.06 }, t, now, 0.35); });
      if (grp && s.dim_rest !== false) grp.items.filter((it) => !on.includes(it)).forEach((it) => to(g, it.e, { opacity: 0.35 }, t, now, 0.35));
      if (!now) sfxSoft('Select', t);
    },
    unfocus(g, s, t, now) { items(g, s.target).forEach((it) => to(g, it.e, { opacity: 1, boxShadow: '0 1px 2px rgba(0,0,0,.04),0 12px 32px rgba(0,0,0,.07)', backgroundColor: '#ffffff', scale: 1 }, t, now, 0.35)); },
    dim(g, s, t, now) { items(g, s.target).forEach((it) => to(g, it.e, { opacity: s.opacity ?? 0.3, filter: s.blur ? `blur(${s.blur}px)` : 'blur(0px)' }, t, now, 0.5)); },
    tone(g, s, t, now) { const col = toneColor(s.tone, 'blue'), dots = !!(groupOf(g, s.target) || {}).dot;
      items(g, s.target).forEach((it) => to(g, it.e, dots ? { backgroundColor: col } : { boxShadow: ring(it.e, col, 3) }, t, now, 0.3)); },
    fill_dots(g, s, t, now) { // dots: the first n change colour one after another
      const its = items(g, s.target).slice(0, s.n ?? 9999), col = toneColor(s.tone, 'blue'), d = s.dur ?? 1.0;
      its.forEach((it, i) => (now ? tl.set(it.e, { backgroundColor: col }, 0) : tl.to(it.e, { backgroundColor: col, duration: 0.15 }, clampT(t + (i / Math.max(1, its.length)) * d))));
    },
    scan(g, s, t, now) { // a beam reads the items one by one
      const its = items(g, s.target); if (!its.length) return;
      const col = toneColor(s.tone, 'blue'), d = s.dur ?? Math.min(2.4, its.length * 0.35), step = d / its.length;
      if (!g.beam) { g.beam = el('div', null, { position: 'absolute', width: '14px', borderRadius: '7px', background: col, boxShadow: `0 0 36px ${col}`, zIndex: 5, opacity: 0 }, null, g.root); }
      const b = g.beam, last = its[its.length - 1];
      if (now) { tl.set(b, { left: last.x + last.w / 2 + 4, top: last.y - last.h, height: last.h * 2, opacity: s.keep ? 0.85 : 0 }, 0); its.forEach((it) => tl.set(it.e, { opacity: 1 }, 0)); return; }
      its.forEach((it, i) => {
        const ti = clampT(t + i * step);
        tl.set(b, { left: it.x - it.w / 2 - 12, top: it.y - it.h, height: it.h * 2, opacity: 0.85 }, ti);
        tl.to(b, { left: it.x + it.w / 2 + 4, duration: step * 0.9, ease: 'none' }, ti);
        tl.to(it.e, { opacity: 1, boxShadow: ring(it.e, col, 3), duration: 0.12 }, ti);
        if (i > 0) tl.to(its[i - 1].e, { boxShadow: '0 1px 2px rgba(0,0,0,.04),0 12px 32px rgba(0,0,0,.07)', duration: 0.2 }, ti);
        sfxSoft('Click_UI Buttons_2', ti, 0.05);
      });
      if (!s.keep) tl.to(b, { opacity: 0, duration: 0.2 }, clampT(t + d + 0.1));
    },
    link(g, s, t, now) {
      const from = items(g, s.from)[0], tos = items(g, s.to); if (!from) return;
      s._grp = groupOf(g, s.from);
      tos.forEach((b, k) => { if (b === from) return; const w = s.weights ? s.weights[k] ?? 0.3 : 0.6;
        // neighbours in a chain already have an arrow: colour it instead of drawing a second line across the picture
        const edge = b.edgeIn && s._grp && s._grp.chain && s._grp.items[s._grp.items.indexOf(b) - 1] === from ? b.edgeIn : null;
        if (edge) { const col = toneColor(s.tone, 'blue');
          if (now) { gsap.set(edge, { stroke: col }); if (edge._head) gsap.set(edge._head, { fill: col }); }
          else { tl.to(edge, { stroke: col, duration: 0.3 }, clampT(t + k * 0.15)); if (edge._head) tl.to(edge._head, { fill: col, duration: 0.3 }, clampT(t + k * 0.15)); }
          return; }
        addLink(g, from, b, s, w, t, now, k, s.as || 'links', s.labels ? s.labels[k] : null); });
      if (!now) sfxSoft('Select', t + 0.2, 0.06);
    },
    links_all(g, s, t, now) { // every item to every other: the web
      const its = items(g, s.target); s._grp = groupOf(g, s.target); let k = 0;
      for (let i = 0; i < its.length; i++) for (let j = i + 1; j < its.length; j++) addLink(g, its[i], its[j], { ...s, tone: s.tone || 'gray' }, s.weight ?? 0.15, t, now, Math.min(k++, 30) * 0.3, s.as || 'web', null);
    },
    heads(g, s, t, now) { // several attention heads: each a colour and its own links from one item
      const from = items(g, s.from)[0]; s._grp = groupOf(g, s.from); const tones = ['blue', 'green', 'amber', 'red'];
      (s.sets || []).forEach((set, h) => items(g, set).forEach((b, k) => addLink(g, from, b, { ...s, tone: tones[h % 4] }, 0.55, t + h * 0.35, now, k, s.as || 'heads', null)));
    },
    unlink(g, s, t, now) { const names = s.as ? [s.as] : Object.keys(g.links);
      for (const n of names) (g.links[n] || []).forEach((e) => to(g, e, { opacity: 0 }, t, now, 0.3)); },
    badge(g, s, t, now) { // small chips above items (positions 1..n or given texts); they travel with the item
      const grp = groupOf(g, s.target);
      items(g, s.target).forEach((it, i) => {
        const text = Array.isArray(s.texts) ? s.texts[i] : String(i + 1); if (text == null) return;
        let bx = it.w / 2, by = -32;
        if (grp && grp.ring) { // on a ring the chip sits outside, away from the neighbours
          const dx = it.x - 540, dy = it.y - (yOf(grp.o.y) + 20), L = Math.hypot(dx, dy) || 1;
          bx = it.w / 2 + (dx / L) * (it.w / 2 + 22); by = it.h / 2 + (dy / L) * (it.h / 2 + 22);
        }
        const c = chip(text, bx, by, null, { tone: s.tone || 'blue', size: 26, h: 44, px: 14, parent: it.e, z: 6 });
        if (now) show(c, 0); else { c.style.opacity = 0; popA(c, t + i * 0.06); }
      });
    },
    shuffle(g, s, t, now) { // items leave their places (order lost)
      const its = items(g, s.target);
      // every item takes the place of another one (no overlaps), slightly tilted
      const n = its.length, step = n % 2 ? 2 : 3, perm = its.map((_, i) => (i * step + 1) % n);
      its.forEach((it, i) => { const q = its[perm[i]], r = ((i * 31) % 7 - 3) * 4;
        to(g, it.e, { x: q.x - it.x, y: q.y - it.y, rotation: r }, t + i * 0.03, now, 0.6);
        it.e.querySelectorAll('.apchip').forEach((c) => to(g, c, { opacity: 0 }, t, now, 0.2)); }); // position chips leave with the order
    },
    order(g, s, t, now) { items(g, s.target).forEach((it, i) => { to(g, it.e, { x: 0, y: 0, rotation: 0 }, t + i * 0.05, now, 0.6);
      it.e.querySelectorAll('.apchip').forEach((c) => to(g, c, { opacity: 1 }, t + 0.5, now, 0.3)); }); },
    grow(g, s, t, now) { // the row gets longer: more items, everything shrinks to fit
      const ob = g.obj[s.target]; if (!ob || ob.type !== 'tokens') return;
      const extra = (s.add || []).map((w) => { const e = pill(g, w, { size: ob.size, h: Math.round(ob.size * 1.7), px: Math.round(ob.size * 0.45) }); return { e, w: e.offsetWidth, h: e.offsetHeight, text: w }; });
      const sc = 0.72, all = [...ob.items, ...extra];
      all.forEach((it) => { it.w = it.w * sc; it.h = it.h * sc; });
      const before = ob.items.map((it) => [it.x, it.y]);
      rowLayout(all, yOf(ob.o.y), 920, 8, 96);
      ob.items.forEach((it, i) => { const [x0, y0] = before[i]; gsap.set(it.e, { left: x0, top: y0 }); to(g, it.e, { left: it.x, top: it.y, scale: sc }, t, now, 0.7); });
      extra.forEach((it, i) => (now ? tl.set(it.e, { scale: sc, opacity: 1 }, 0)
        : tl.fromTo(it.e, { opacity: 0, scale: sc * 0.8, y: 14 }, { opacity: 1, scale: sc, y: 0, duration: 0.4, ease }, clampT(t + 0.3 + i * 0.04))));
      ob.items = all;
    },
    strike(g, s, t, now) { items(g, s.target).forEach((it) => { const bar = el('div', null, { position: 'absolute', left: (it.x - it.w / 2 - 8) + 'px', top: (it.y - 4) + 'px', width: (it.w + 16) + 'px', height: '8px', borderRadius: '4px', background: A.red, zIndex: 7, transformOrigin: '0% 50%' }, null, g.root);
      now ? gsap.set(bar, { scaleX: 1 }) : tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease }, clampT(t)); to(g, it.e, { opacity: 0.45 }, t, now, 0.3); }); },
    swap(g, s, t, now) { const it = items(g, s.target)[0]; if (!it) return;
      if (now) { it.e.textContent = s.text; return; }
      tl.to(it.e, { rotationX: 90, duration: 0.18 }, clampT(t)); tl.call(() => { it.e.textContent = s.text; }, null, clampT(t + 0.18)); tl.to(it.e, { rotationX: 0, duration: 0.2 }, clampT(t + 0.19)); },
    label(g, s, t, now) { // a short note next to an item: the asked side if free, else the first free side
      const it = items(g, s.target)[0]; if (!it) return;
      const w = String(s.text).length * 18 + 44, h = 56;
      // a new label on the same item replaces the old one (31.10: «ошибка» then «тупик» on one word)
      const old = (g.labelOf = g.labelOf || new Map()).get(it);
      if (old) { g.labels = (g.labels || []).filter((b) => b !== old.box);
        if (now) old.el.remove(); else tl.to(old.el, { opacity: 0, duration: 0.2 }, clampT(t - 0.05)); }
      const sides = { below: [it.x, it.y + it.h / 2 + 44], above: [it.x, it.y - it.h / 2 - 44],
        right: [it.x + it.w / 2 + w / 2 + 18, it.y], left: [it.x - it.w / 2 - w / 2 - 18, it.y] };
      const order = [s.side === 'above' ? 'above' : 'below', s.side === 'above' ? 'below' : 'above', 'right', 'left'];
      const box = (x, y) => [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
      const taken = [...occupied(g, it), ...(g.labels || []), ...(g.p.title ? [[60, 150, 1020, 270]] : [])];
      let pick = order.map((k) => sides[k]).find(([x, y]) => { const b = box(x, y); return b[0] > 60 && b[2] < 1020 && b[1] > 120 && b[3] < 960 && !taken.some((r) => hit(b, r)); });
      pick = pick || sides[order[0]];
      const placed = box(pick[0], pick[1]); (g.labels = g.labels || []).push(placed);
      const c = chip(s.text, pick[0], pick[1], null, { tone: s.tone || 'gray', size: 32, h: h, px: 20, parent: g.root, z: 6 });
      g.labelOf.set(it, { el: c, box: placed });
      if (now) show(c, 0); else { c.style.opacity = 0; inA(c, t + (old ? 0.25 : 0), { dy: 10 }); }
    },
    note(g, s, t, now) { // one note at a time: a new one replaces the previous (31.10: notes piled up over the shots)
      const prev = g.note; const e = Tx(s.text, 540, s.y ? yOf(s.y) : Math.min(925, (g.bottom || 800) + 55), { size: 34, w: 600, color: A.sub, wrap: true, width: 860, talign: 'center', parent: g.root });
      g.note = e;
      if (now) { if (prev) prev.remove(); show(e, 0); return; }
      if (prev) tl.to(prev, { opacity: 0, y: -10, duration: 0.25 }, clampT(t - 0.05));
      e.style.opacity = 0; inA(e, t + (prev ? 0.15 : 0), { dy: 12 }); },
    fill(g, s, t, now) { const ob = g.obj[s.target]; if (!ob || !ob.fill) return; const v = Math.max(0, Math.min(1, s.value / ob.max));
      now ? tl.set(ob.fill, { scaleX: v }, 0) : tl.to(ob.fill, { scaleX: v, duration: s.dur ?? 1.2, ease: s.slow ? 'none' : 'power2.out' }, clampT(t)); },
    camera(g, s, t, now) { const its = items(g, s.target); if (!its.length) { to(g, g.root, { scale: 1, x: 0, y: 0 }, t, now, 0.8); return; }
      const cx = its.reduce((a, it) => a + it.x, 0) / its.length, cy = its.reduce((a, it) => a + it.y, 0) / its.length, z = Math.min(2.2, s.zoom || 1.6);
      to(g, g.root, { scale: z, x: (540 - cx) * z * 0.85, y: (560 - cy) * z * 0.85 }, t, now, 0.9); },
    pulse(g, s, t, now) { if (now) return; items(g, s.target).forEach((it, i) => tl.fromTo(it.e, { scale: 1 }, { scale: 1.12, duration: 0.18, yoyo: true, repeat: 1 }, clampT(t + i * 0.05))); },
  };

  function run(p) {
    const g = make(p);
    // objects: visible from the start (first shot of the diagram: they come in; later shots: already there)
    const vis = Object.values(g.obj).filter((ob) => !ob.hidden);
    vis.forEach((ob, k) => { const st = Math.min(0.03, 0.6 / Math.max(1, ob.items.length));
      ob.items.forEach((it, i) => { p.cont_prev ? show(it.e, 0) : inA(it.e, 0.05 + k * 0.12 + i * st, { dy: 16, d: 0.45 }); showEdge(it, 0.05 + k * 0.12 + i * st, p.cont_prev); }); });
    vis.forEach((ob) => { if (ob.label) (p.cont_prev ? show(ob.label, 0) : inA(ob.label, 0.1)); });
    for (const s of p.prior || []) (A_[s.do] || (() => {}))(g, s, 0, true);
    for (const s of p.steps || []) (A_[s.do] || (() => {}))(g, s, AT(s.at, 0.3), false);
    if (p.title) { const tt = Tx(p.title, 540, 205, { size: 40, w: 700, color: A.ink, wrap: true, width: 900, talign: 'center' });
      if (p.cont_prev) show(tt, 0); else { tt.style.opacity = 0; inA(tt, 0.05, { dy: 10 }); } }
    else if (p.eyebrow) eyebrow(p.eyebrow, 170, 0.05);
    if (!p.cont_next) exitAll();
    return g;
  }
  return { run, ACTIONS: Object.keys(A_) };
})();

TPL.diagram = (p) => DG.run(p);

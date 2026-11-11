// SciTok · дизайн-система «в стиле Apple»: светлый фон, белые карточки с мягкой тенью, Inter,
// один акцент (синий), красный/зелёный только для «ошибка/верно». Движение — пружинное (expo/back), вход и выход каждого шота.
(function () {
  const st = document.createElement('style');
  st.textContent = `
  #stage,#cam{background:#F5F5F7!important} #dots,#tint{display:none!important}
  .ap{position:absolute;font-family:'Inter','Sym';color:#1D1D1F;white-space:nowrap}
  .apc{position:absolute;background:#FFFFFF;border-radius:28px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 12px 32px rgba(0,0,0,.07)}
  .apchip{position:absolute;font-family:'Inter','Sym';font-weight:600;border-radius:999px;white-space:nowrap;display:flex;align-items:center;justify-content:center}
  .hl{border:3px solid #0071E3!important;box-shadow:none!important;background:rgba(0,113,227,.10);border-radius:8px!important}
  .hl.red{border-color:#E3342F!important;background:rgba(227,52,47,.10)}
  .doc{box-shadow:0 2px 6px rgba(0,0,0,.05),0 24px 60px rgba(0,0,0,.12)!important;border:none!important}
  .apdoc{position:absolute;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.05),0 24px 60px rgba(0,0,0,.12)}
  `;
  document.head.appendChild(st);
})();
const A = {
  ink: '#1D1D1F', sub: '#6E6E73', faint: '#AEAEB2', line: '#D2D2D7', soft: '#E8E8ED', bg: '#F5F5F7',
  blue: '#0071E3', green: '#28A745', red: '#E3342F', amber: '#C77700',
  tint: (c, a) => c + Math.round(a * 255).toString(16).padStart(2, '0'),
};
// --- движение
function inA(e, t, o = {}) { tl.fromTo(e, { opacity: 0, y: o.dy == null ? 28 : o.dy, scale: o.s == null ? 0.97 : o.s, filter: 'blur(10px)' }, { opacity: o.op == null ? 1 : o.op, y: 0, scale: 1, filter: 'blur(0px)', duration: o.d || 0.6, ease: o.ease || 'expo.out' }, clampT(t)); return e; }
function outA(e, t, o = {}) { tl.to(e, { opacity: 0, y: o.dy == null ? -18 : o.dy, scale: o.s == null ? 0.98 : o.s, filter: 'blur(8px)', duration: o.d || 0.35, ease: 'power2.in' }, clampT(t)); return e; }
function popA(e, t) { tl.fromTo(e, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.7)' }, clampT(t)); return e; }
// выход всего шота: всё, что на сцене, мягко уходит в последние 0.3 с (переход в стиле Remotion)
function exitAll(o = {}) { const t = Math.max(0.2, D - (o.d || 0.32)); tl.to(cam.children, { opacity: 0, y: -16, filter: 'blur(8px)', duration: o.d || 0.32, ease: 'power2.in' }, t); }
// --- элементы
function Tx(text, x, y, o = {}) { // текст Inter
  const e = el('div', 'ap', { left: x + 'px', top: y + 'px', fontWeight: o.w || 600, fontSize: (o.size || 40) + 'px', color: o.color || A.ink, letterSpacing: o.ls || (o.size >= 80 ? '-0.035em' : o.size >= 48 ? '-0.02em' : '0'), lineHeight: o.lh || '1.15', textAlign: o.talign || 'left', whiteSpace: o.wrap ? 'normal' : 'nowrap', width: o.width ? o.width + 'px' : 'auto', zIndex: o.z || 3 }, text, o.parent);
  gsap.set(e, { xPercent: o.align === 'l' ? 0 : o.align === 'r' ? -100 : -50, yPercent: -50 });
  if (o.t != null) inA(e, o.t, o); return e;
}
function eyebrow(text, y, t, o = {}) { return Tx(text, o.x || 540, y, { size: 24, w: 600, color: o.color || A.sub, ls: '0.08em', t, ...o, align: o.align }); }
function Kc(x, y, w, h, t, o = {}) { const e = el('div', 'apc', { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', zIndex: o.z || 2, background: o.bg || '#fff', borderRadius: (o.r || 28) + 'px' }); if (o.border) e.style.boxShadow = `0 0 0 ${o.bw || 3}px ${o.border}, 0 12px 32px rgba(0,0,0,.07)`; if (t != null) inA(e, t, o); else show(e, 0); return e; }
function chip(text, x, y, t, o = {}) { const tone = o.tone || 'gray'; const bg = tone === 'blue' ? A.tint(A.blue, 0.1) : tone === 'green' ? A.tint(A.green, 0.12) : tone === 'red' ? A.tint(A.red, 0.1) : tone === 'dark' ? A.ink : A.soft; const col = tone === 'blue' ? A.blue : tone === 'green' ? A.green : tone === 'red' ? A.red : tone === 'dark' ? '#fff' : A.ink;
  const e = el('div', 'apchip', { left: x + 'px', top: y + 'px', height: (o.h || 56) + 'px', padding: `0 ${o.px || 24}px`, background: bg, color: col, fontSize: (o.size || 26) + 'px', zIndex: o.z || 4 }, text, o.parent); gsap.set(e, { xPercent: o.align === 'l' ? 0 : -50, yPercent: -50 }); if (t != null) inA(e, t, { dy: 14, ...o }); else show(e, 0); return e; }
function num(to, x, y, t, o = {}) { // крупное число со счётчиком
  const e = Tx('', x, y, { size: o.size || 160, w: 800, color: o.color || A.ink, align: o.align, z: o.z }); const st = { v: o.from || 0 };
  const fmt = v => (o.dec ? v.toFixed(o.dec).replace('.', ',') : Math.round(v)) + (o.suf || '');
  e.textContent = fmt(st.v); inA(e, t, { dy: 20 }); tl.to(st, { v: to, duration: o.dur || 0.9, ease: 'power3.out', onUpdate: () => { e.textContent = fmt(st.v); } }, clampT(t)); return e;
}
function vbarA(x, base, v, k, t, o = {}) { // столбик с подписью
  const w = o.w || 120, h = v * k; const col = o.color || A.faint;
  const b = el('div', null, { position: 'absolute', left: (x - w / 2) + 'px', top: (base - h) + 'px', width: w + 'px', height: h + 'px', borderRadius: '18px 18px 6px 6px', background: col, zIndex: 3 });
  tl.fromTo(b, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.8, ease: 'expo.out' }, clampT(t));
  const n = num(v, x, base - h - 44, t + 0.05, { size: o.ns || 56, color: o.ncolor || (col === A.faint ? A.ink : col), dec: o.dec, suf: o.suf, dur: 0.8 });
  const l = Tx(o.label || '', x, base + 40, { size: 26, w: 500, color: A.sub, t: t + 0.1 });
  return { b, n, l };
}
function docA(file, x, y, w, t, o = {}) { const [pw, ph] = DOC[file]; const h = w * ph / pw; const c = el('div', 'apdoc', { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', zIndex: o.z || 2 });
  const im = el('img', null, { position: 'absolute', left: 0, top: 0, width: w + 'px', height: h + 'px' }, null, c); im.src = window.BUILD_URL + '/pairs/' + file + '.png';
  c._sc = w / pw; c._h = h; c._w = w; if (t != null) inA(c, t, o); else show(c, 0); return c; }
function markA(c, b, t, o = {}) { const sc = c._sc, col = o.color || A.blue; const e = el('div', null, { position: 'absolute', left: (b[0] * sc - 6) + 'px', top: (b[1] * sc - 4) + 'px', width: ((b[2] - b[0]) * sc + 12) + 'px', height: ((b[3] - b[1]) * sc + 8) + 'px', borderRadius: '10px', background: A.tint(col, 0.14), boxShadow: `inset 0 0 0 2.5px ${col}`, zIndex: 5 }, null, c);
  tl.fromTo(e, { opacity: 0, scaleX: 0.9 }, { opacity: 1, scaleX: 1, duration: 0.45, ease: 'expo.out' }, clampT(t)); return e; }
function lineA(svg, x1, y1, x2, y2, t, o = {}) { const p = sv(svg, 'path', { d: o.d || `M${x1} ${y1} L${x2} ${y2}`, stroke: o.color || A.line, 'stroke-width': o.w || 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': o.dash || '' }); if (!o.dash) drawOn(p, t, o.dur || 0.5); else inA(p, t, { dy: 0 }); return p; }
function cursorA(x, y, t) { const e = el('div', null, { position: 'absolute', left: x + 'px', top: y + 'px', width: '3px', height: '40px', background: A.blue, zIndex: 6 }); tl.fromTo(e, { opacity: 1 }, { opacity: 0, duration: 0.01, repeat: 20, yoyo: true, repeatDelay: 0.35 }, clampT(t)); return e; }

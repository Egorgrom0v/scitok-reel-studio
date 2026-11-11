// SciTok engine: run the current shot's builder and expose seek(t).
(SH[S.id] || (S.media ? () => mediaSlot(S.media) : () => { txt('MISSING ' + S.id, 540, 500, { size: 60, color: COL.red }); }))();

// Light theme: shots written for the dark palette (hardcoded '#16233A', 'rgba(255,255,255,.1)'…) are
// re-coloured here, so old shots.js render correctly. New shots should use COL.* and need none of this.
if (THEME === 'light' && PAL === 'dark') {
  const ACC = { '4c8dff': '#2563EB', 'ff5a4e': '#DC2F25', '3ddc97': '#0E9F6E', 'ffc24b': '#B97700', 'f2f4f7': '#11151B', '07090d': '#F4F5F7',
                '0e131b': '#FFFFFF', '1e2733': '#D5DAE1', '8a94a3': '#5F6977' };
  const hex2 = h => { h = h.replace('#', ''); if (h.length <= 4) h = [...h].map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1]; };
  const toHex = (r, g, b) => [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  function hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
  function rgb(h, s, l) { if (!s) return [l * 255, l * 255, l * 255]; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)]; }
  function map1(r, g, b, a, ctx) {
    const k = toHex(r, g, b);
    if (ACC[k]) { const [R, G, B] = hex2(ACC[k]); return [R, G, B, a]; }
    const [h, s, l] = hsl(r, g, b);
    if (ctx === 'shadow' && l < .3 && s < .4) return [r, g, b, a * .3];          // dark shadows stay dark, softer
    if (ctx === 'bg' && l > .97 && a === 1) return [r, g, b, a];                   // white paper stays white
    if (s < .4 || l < .3) { const [R, G, B] = rgb(h, s * .8, Math.min(.985, 1 - l)); return [R, G, B, a]; }  // neutrals & dark tints: invert lightness
    const [R, G, B] = rgb(h, Math.min(1, s), l * .8); return [R, G, B, a];        // saturated accents: a bit darker
  }
  const out = ([r, g, b, a]) => a >= 1 ? '#' + toHex(r, g, b) : `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${+a.toFixed(3)})`;
  const RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)/g;
  window.recolor = (str, ctx) => typeof str !== 'string' ? str : str.replace(RE, m => {
    if (m[0] === '#') { const [r, g, b, a] = hex2(m); return out(map1(r, g, b, a, ctx)); }
    const v = m.match(/[\d.]+/g).map(Number); return out(map1(v[0], v[1], v[2], v.length > 3 ? v[3] : 1, ctx));
  });
  const ctxOf = p => /shadow/i.test(p) ? 'shadow' : /^background/i.test(p) ? 'bg' : 'fg';
  const PROPS = ['color', 'background', 'backgroundColor', 'backgroundImage', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor',
                 'borderLeftColor', 'boxShadow', 'textShadow', 'outlineColor', 'fill', 'stroke', 'filter', 'stopColor'];
  for (const e of document.querySelectorAll('#cam *, #hud *')) {
    for (const p of PROPS) { const v = e.style && e.style[p]; if (v && RE.test(v)) { RE.lastIndex = 0; e.style[p] = recolor(v, ctxOf(p)); } RE.lastIndex = 0; }
    if (e instanceof SVGElement) for (const a of ['fill', 'stroke', 'stop-color', 'flood-color']) {
      const v = e.getAttribute(a); if (v && v !== 'none' && !v.startsWith('url')) e.setAttribute(a, recolor(v, 'fg'));
    }
  }
  // colours inside tweens (tl.to(x, {backgroundColor: '#16233A'}) etc.) — vars are parsed on first render, so patch them now
  const fix = o => { if (!o) return; for (const k in o) { if (typeof o[k] === 'string') o[k] = recolor(o[k], ctxOf(k)); else if (k === 'attr' || k === 'css' || k === 'startAt') fix(o[k]); } };
  for (const tw of tl.getChildren(true, true, false)) { fix(tw.vars); }
}

tl.seek(0, false);
window.seek = t => { tl.seek(t, false); };
window.READY = true;

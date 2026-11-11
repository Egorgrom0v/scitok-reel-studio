// Step 4: render every stage shot (1080x1000) frame-exact via Playwright -> <video>/build/shots/<id>.mp4
// usage: VIDEO=videos/<slug> node engine/render_stage.js [shotIdRegex] [--still]
//   --still: only mid + last frame PNGs per shot into build/stills/ (fast preview while iterating on shots.js)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const ENGINE = __dirname, KIT = path.resolve(__dirname, '..');
if (!process.env.VIDEO) { console.error('set VIDEO=videos/<slug>'); process.exit(1); }
const VIDEO = path.resolve(process.env.VIDEO);
const B = path.join(VIDEO, 'build');
const url = p => 'file://' + p;
const CFG = JSON.parse(fs.readFileSync(path.join(VIDEO, 'video.json'), 'utf8'));
const THEME = process.env.THEME || CFG.theme || 'light';
const CHROME_UI = !!CFG.chrome_ui;   // old v7 HUD inside the stage (kicker, corner brackets)
fs.writeFileSync(path.join(B, 'stage.html'), fs.readFileSync(path.join(ENGINE, 'stage.html'), 'utf8')
  .replaceAll('{{BUILD_URL}}', url(B)).replaceAll('{{KIT_URL}}', url(KIT))
  .replaceAll('{{ENGINE_URL}}', url(ENGINE)).replaceAll('{{VIDEO_URL}}', url(VIDEO))
  .replaceAll('{{THEME}}', THEME).replaceAll('{{SHOTS_THEME}}', CFG.shots_theme || '').replaceAll('{{CHROME_UI}}', String(CHROME_UI)));
const timing = JSON.parse(fs.readFileSync(path.join(B, 'timing.json')));
const crops = JSON.parse(fs.readFileSync(path.join(B, 'crops.json')));
const glyphs = new Set(JSON.parse(fs.readFileSync(path.join(B, 'glyphs.json'))));
const filt = process.argv[2] && !process.argv[2].startsWith('--') ? new RegExp(process.argv[2]) : null;
const STILL = process.argv.includes('--still');
const CHECK = process.argv.includes('--check');   // DOM checks only (dom_check.js) -> build/dom_check.json, no video
const { domCheck } = require('./dom_check');
const CHECKS = {};
const FPS = 30;
const MISSING = {};   // shot id -> glyphs not covered by the fonts (-> build/glyphs_missing.json, read by metrics.py)
fs.mkdirSync(path.join(B, 'shots'), { recursive: true }); fs.mkdirSync(path.join(B, 'stills'), { recursive: true });

const DRIFT = [0, 24, -24, 0, 20, -20];
function shotData(sh, k) {
  const sc = timing.scenes.find(s => s.id === sh.scene);
  const dur = (sh.f1 - sh.f0) / FPS;
  return { id: sh.id, dur, anchor: sh.anchor - sh.t0, scene: sh.scene, driftX: DRIFT[k % DRIFT.length], media: sh.media || null,
    words: sc.words.map(w => ({ w: w.w, t0: w.t0 - sh.t0, t1: w.t1 - sh.t0 })) };
}

// Media slots: a shot with "media" in storyboard.json is a generation (Flow) or an outside photo/video.
// If videos/<slug>/media/<shot_id>.{mp4,mov,webm,png,jpg,jpeg,webp} exists, it fills the stage (cover, slow push-in);
// otherwise the shot renders as a labelled placeholder (lib.js mediaSlot) — unless shots.js defines SH.<id> itself.
const MEDIA_DIR = path.join(VIDEO, 'media');
function mediaFile(id) {
  for (const ext of ['mp4', 'mov', 'webm', 'png', 'jpg', 'jpeg', 'webp']) { const p = path.join(MEDIA_DIR, `${id}.${ext}`); if (fs.existsSync(p)) return p; }
  return null;
}
function renderMediaFile(sh, file) {
  const N = sh.f1 - sh.f0, out = path.join(B, 'shots', sh.id + '.mp4');
  const still = /\.(png|jpe?g|webp)$/i.test(file);
  const zoom = `zoompan=z='1+0.08*on/${N}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${N}:s=1080x1000:fps=${FPS}`;
  const MZ = +(CFG.media_zoom || 1.02);   // video.json media_zoom: extra zoom of generations so no edge/letterbox shows
  const cover = `scale=${Math.round(1080 * MZ / 2) * 2}:${Math.round(1000 * MZ / 2) * 2}:force_original_aspect_ratio=increase,crop=1080:1000`;
  const args = still
    ? ['-y', '-v', 'error', '-loop', '1', '-i', file, '-vf', `scale=2160:2000:force_original_aspect_ratio=increase,crop=2160:2000,${zoom}`, '-frames:v', String(N)]
    : ['-y', '-v', 'error', '-stream_loop', '-1', '-i', file, '-an', '-vf', `${cover},fps=${FPS},setpts=PTS-STARTPTS`, '-frames:v', String(N)];
  require('child_process').execFileSync('ffmpeg', [...args, '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out]);
}

async function renderShot(browser, sh, k) {
  const mf = sh.media ? mediaFile(sh.id) : null;
  if (mf && !STILL) { if (!CHECK) renderMediaFile(sh, mf); return; }
  if (CHECK && sh.media) return;   // a media placeholder has no layout to check
  const page = await browser.newPage({ viewport: { width: 1080, height: 1000 }, deviceScaleFactor: 1 });
  const data = shotData(sh, k);
  await page.addInitScript(([d, c]) => { window.SHOT = d; window.CROPS = c; }, [data, crops]);
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url(path.join(B, 'stage.html')));
  // a JS error in the shot never sets READY: stop at the error itself, not at a 30 s timeout (01.11: the hero agent got "Timeout")
  for (const t0 = Date.now(); !errs.length && !(await page.evaluate(() => !!(window.READY && window.IMGS)));) {
    if (Date.now() - t0 > 30000) throw new Error(sh.id + ': the stage was not ready in 30 s');
    await new Promise((r) => setTimeout(r, 100));
  }
  if (errs.length) throw new Error(sh.id + ': ' + errs.join('; '));
  // glyph coverage check
  const text = await page.evaluate(() => document.getElementById('stage').innerText);
  const bad = [...new Set([...text].filter(ch => !/\s/.test(ch) && !glyphsHas(ch)))];
  function glyphsHas(ch) { return glyphs.has(ch.codePointAt(0)); }
  if (bad.length) console.warn(`!! ${sh.id} glyphs missing in fonts: ${bad.join(' ')}`);
  MISSING[sh.id] = bad;
  // sound events requested by the shot (lib.js sfx()) -> build/sfx_events/<id>.json, mixed by audio.py
  const ev = await page.evaluate(() => window.SFX_EVENTS || []);
  fs.mkdirSync(path.join(B, 'sfx_events'), { recursive: true });
  fs.writeFileSync(path.join(B, 'sfx_events', sh.id + '.json'), JSON.stringify(ev));
  const N = sh.f1 - sh.f0;
  if (CHECK) { CHECKS[sh.id] = await domCheck(page, sh, N, FPS); await page.close(); return; }
  if (STILL) {
    const fr = process.env.STILL_AT ? process.env.STILL_AT.split(',').map((x, i) => ['p' + i, Math.min(N - 1, Math.round(N * parseFloat(x)))]) : [['a', Math.round(N * 0.5)], ['c', Math.max(0, N - 1 - Math.round(FPS * 0.45))], ['b', N - 1]];
    for (const [lab, f] of fr) {
      await page.evaluate(t => window.seek(t), f / FPS);
      await page.screenshot({ path: path.join(B, 'stills', `${sh.id}_${lab}.png`) });
    }
    await page.close(); return;
  }
  const out = path.join(B, 'shots', sh.id + '.mp4');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-frames:v', String(N), '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < N; f++) {
    await page.evaluate(t => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await page.close();
}

(async () => {
  const fsx = require('fs');
  const exe = process.env.CHROME || (fsx.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const list = timing.shots.map((s, k) => [s, k]).filter(([s]) => !filt || filt.test(s.id));
  const W = Number(process.env.PAGES || 4); let i = 0;
  await Promise.all(Array.from({ length: W }, async () => {
    while (i < list.length) { const [s, k] = list[i++]; const t = Date.now(); await renderShot(browser, s, k); console.log(s.id, s.f1 - s.f0, 'fr', ((Date.now() - t) / 1000).toFixed(1) + 's'); }
  }));
  await browser.close();
  if (CHECK) {
    const all = Object.entries(CHECKS).sort().map(([id, issues]) => ({ id, issues }));
    const n = (s) => all.reduce((a, x) => a + x.issues.filter((i) => i.severity === s).length, 0);
    fs.writeFileSync(path.join(B, 'dom_check.json'), JSON.stringify({ errors: n('error'), warnings: n('warn'), shots: all.filter((x) => x.issues.length) }, null, 1));
    for (const x of all) for (const i of x.issues) console.log(`${i.severity === 'error' ? '!!' : ' ~'} ${x.id} ${i.t}s ${i.code}: ${i.msg}`);
    console.log(`dom check: ${n('error')} errors, ${n('warn')} warnings -> build/dom_check.json`);
    if (process.env.DOM_STRICT === '1' && n('error')) process.exit(2);
    return;
  }
  if (!STILL) {
    const gp = path.join(B, 'glyphs_missing.json');
    const prev = fs.existsSync(gp) ? JSON.parse(fs.readFileSync(gp)) : {};
    for (const [id, g] of Object.entries(MISSING)) { if (g.length) prev[id] = g; else delete prev[id]; }
    fs.writeFileSync(gp, JSON.stringify(prev, null, 1));
  }
  // list of media slots for generation / footage search
  const slots = timing.shots.filter(s => s.media).map(s => ({ id: s.id, t0: +s.t0.toFixed(2), dur: +(s.t1 - s.t0).toFixed(2),
    kind: s.media.kind, ru: s.media.ru || '', prompt: s.media.prompt || '', file: mediaFile(s.id) ? path.basename(mediaFile(s.id)) : null }));
  fs.writeFileSync(path.join(VIDEO, 'media_slots.json'), JSON.stringify(slots, null, 1));
  if (slots.length) fs.writeFileSync(path.join(VIDEO, 'media_slots.md'), '# Слоты под генерации и внешние кадры\n\nФайл кладётся в `media/<id>.mp4` (или .png/.jpg) — при следующей сборке встанет вместо заготовки. Длительность — минимум `dur` секунд, кадр вертикальный или квадратный, главное — в центре.\n\n| id | время | с | тип | что в кадре | промпт (Flow) | файл |\n|---|---|---|---|---|---|---|\n' +
    slots.map(m => `| ${m.id} | ${m.t0} | ${m.dur} | ${m.kind === 'gen' ? 'генерация' : 'внешний'} | ${m.ru} | ${m.prompt} | ${m.file || '—'} |`).join('\n') + '\n');
})().catch(e => { console.error(e); process.exit(1); });

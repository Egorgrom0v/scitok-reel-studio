// External voiceover: offline ASR with timestamps -> <video>/build/voice_asr.json  (used by tts.py in external-voice mode)
// usage: VIDEO=videos/<slug> node engine/asr_words.mjs <audio file>      (needs: bash setup.sh --asr)
// Tries word-level timestamps; if the model can't, falls back to phrase-level chunks (tts.py handles both).
import { execFileSync } from 'child_process';
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const KIT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ASR = process.env.ASR_DIR || path.join(KIT, 'tools', 'asr');
const require = createRequire(path.join(ASR, 'package.json'));
const tf = await import(require.resolve('@huggingface/transformers'));
tf.env.allowRemoteModels = false; tf.env.localModelPath = path.join(ASR, 'node_modules/sts-whisper-small/models/');
const asr = await tf.pipeline('automatic-speech-recognition', 'Xenova/whisper-small', { dtype: 'q8' });
const VIDEO = path.resolve(process.env.VIDEO || '.');
const src = process.argv[2];
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
const audio = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
// 20 s zones, each decoded with 3 s of context on both sides; a word belongs to the zone where it starts
const SR = 16000, ZONE = 20, CTX = 3, out = [];
let mode = process.env.ASR_MODE || 'word';
const total = audio.length / SR;
for (let s = 0; s < total; s += ZONE) {
  const w0 = Math.max(0, s - CTX), w1 = Math.min(total, s + ZONE + CTX);
  const seg = audio.subarray(Math.round(w0 * SR), Math.round(w1 * SR));
  let r;
  try { r = await asr(seg, { language: process.env.ASR_LANG || 'russian', task: 'transcribe', return_timestamps: mode === 'word' ? 'word' : true }); }
  catch (e) { if (mode === 'word') { console.warn('word timestamps unavailable, using phrase chunks:', String(e).slice(0, 120)); mode = 'phrase'; s -= ZONE; continue; } throw e; }
  for (const c of r.chunks || []) {
    const [a, b] = c.timestamp; if (a == null) continue;
    const t0 = w0 + a, t1 = w0 + (b == null ? a + 0.3 : b);
    if (t0 < s - 0.05 || t0 >= s + ZONE - 0.05) continue;
    if (out.length && t0 < out[out.length - 1].t0) continue;
    out.push({ text: c.text.trim(), t0: +t0.toFixed(3), t1: +t1.toFixed(3) });
  }
  process.stderr.write(`asr ${s}s\r`);
}
fs.mkdirSync(path.join(VIDEO, 'build'), { recursive: true });
fs.writeFileSync(path.join(VIDEO, 'build', 'voice_asr.json'), JSON.stringify({ mode, duration: audio.length / SR, chunks: out }, null, 1));
console.log(`\n${mode}: ${out.length} chunks, ${(audio.length / SR).toFixed(1)} s`);
console.log(out.slice(0, 12).map(c => `${c.t0.toFixed(2)} ${c.text}`).join('\n'));

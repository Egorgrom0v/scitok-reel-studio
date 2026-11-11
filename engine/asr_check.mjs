// Step 8 (QA): offline ASR spot-check of the finished video (whisper-small q8 from npm package sts-whisper-small).
// usage: VIDEO=videos/<slug> node engine/asr_check.mjs s07 s15 s21     (needs: bash setup.sh --asr)
import { execFileSync } from 'child_process';
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const KIT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ASR = process.env.ASR_DIR || path.join(KIT, 'tools', 'asr');
const require = createRequire(path.join(ASR, 'package.json'));
const tf = await import(require.resolve('@huggingface/transformers'));
tf.env.allowRemoteModels = false; tf.env.localModelPath = path.join(ASR, 'node_modules/sts-whisper-small/models/');
const asr = await tf.pipeline('automatic-speech-recognition', 'Xenova/whisper-small', { dtype: 'q8' });
const VIDEO = path.resolve(process.env.VIDEO || '.');
const cfg = JSON.parse(fs.readFileSync(path.join(VIDEO, 'video.json')));
const video = path.join(VIDEO, cfg.output || (cfg.slug + '.mp4'));
const scenes = process.argv.slice(2);
const T = JSON.parse(fs.readFileSync(path.join(VIDEO, 'build', 'timing.json')));
for (const id of scenes) {
  const sc = T.scenes.find(s => s.id === id);
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(sc.t0), '-t', String(sc.dur + 0.1), '-i', video, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const audio = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  const out = await asr(audio, { language: 'russian', task: 'transcribe' });
  console.log(`${id}\n  текст:  ${sc.subtitle}\n  ASR:    ${out.text.trim()}`);
}

// Импорт готовой озвучки из ElevenLabs (если генерируешь на сайте вручную).
//
//   npm run voice:import -- путь/к/озвучке.mp3     один файл со всем текстом: режется по паузам на 12 реплик
//   npm run voice:import -- путь/к/папке           папка с файлами L01.mp3 … L12.mp3 (или .wav)
//
// Речь не ускоряется: под фактическую длину фраз подгоняется тайминг сцен.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {GEN_PATH, VOICE_DIR, duration, readTL, retime, saveTL, writeGen} from './voice-lib.mjs';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('Укажи путь к MP3/WAV или к папке с L01…L12: npm run voice:import -- ./my-voice.mp3');
  process.exit(1);
}
const tl = readTL();
const N = tl.voice.length;
fs.mkdirSync(VOICE_DIR, {recursive: true});
const lines = {};
const durs = {};

const cut = (input, a, b, out) =>
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', input, '-ss', String(a), '-to', String(b), '-af', 'afade=t=in:d=0.01,areverse,afade=t=in:d=0.04,areverse', '-c:a', 'libmp3lame', '-q:a', '2', out]);

if (fs.statSync(src).isDirectory()) {
  for (const v of tl.voice) {
    const f = ['mp3', 'wav', 'm4a'].map((e) => path.join(src, `${v.id}.${e}`)).find((p) => fs.existsSync(p));
    if (!f) throw new Error(`Нет файла ${v.id}.mp3 в ${src}`);
    const out = path.join(VOICE_DIR, `${v.id}.mp3`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-c:a', 'libmp3lame', '-q:a', '2', out]);
    durs[v.id] = duration(out);
    lines[v.id] = {dur: durs[v.id], file: `${v.id}.mp3`};
  }
} else {
  // ищем паузы между фразами и берём N−1 самых длинных как точки разреза
  const det = spawnSync('ffmpeg', ['-hide_banner', '-i', src, '-af', 'silencedetect=noise=-38dB:d=0.15', '-f', 'null', '-'], {encoding: 'utf8'});
  const text = det.stderr || '';
  const total = duration(src);
  const sil = [];
  let s0 = null;
  for (const line of text.split('\n')) {
    const a = line.match(/silence_start: ([\d.]+)/);
    const b = line.match(/silence_end: ([\d.]+)/);
    if (a) s0 = parseFloat(a[1]);
    if (b && s0 !== null) {
      sil.push({a: s0, b: parseFloat(b[1])});
      s0 = null;
    }
  }
  const inner = sil.filter((x) => x.a > 0.05 && x.b < total - 0.05);
  if (inner.length < N - 1) throw new Error(`Найдено пауз: ${inner.length}, нужно ${N - 1}. Сделай паузы между фразами чуть длиннее или импортируй папку с L01…L12.`);
  const splits = [...inner].sort((x, y) => y.b - y.a - (x.b - x.a)).slice(0, N - 1).sort((x, y) => x.a - y.a);
  const lead = sil.find((x) => x.a <= 0.05);
  const tail = sil.find((x) => x.b >= total - 0.05);
  const bounds = [lead ? lead.b : 0, ...splits.flatMap((x) => [x.a, x.b]), tail ? tail.a : total];
  tl.voice.forEach((v, i) => {
    const a = Math.max(0, bounds[i * 2] - 0.03);
    const b = Math.min(total, bounds[i * 2 + 1] + 0.06);
    const out = path.join(VOICE_DIR, `${v.id}.mp3`);
    cut(src, a, b, out);
    durs[v.id] = duration(out);
    lines[v.id] = {dur: durs[v.id], file: `${v.id}.mp3`};
    console.log(`${v.id}: ${durs[v.id].toFixed(2)} с — «${v.text}»`);
  });
}

const changes = retime(tl, durs);
for (const v of tl.voice) v.est = +durs[v.id].toFixed(2);
saveTL(tl);
writeGen(tl, 'import', lines);
console.log('\nТайминг:', changes.length ? '\n  ' + changes.join('\n  ') : 'реплики помещаются в сцены без изменений');
console.log(`Записано: ${GEN_PATH}. Проверь нарезку (public/voice/L01…L12.mp3), затем: npm run build`);

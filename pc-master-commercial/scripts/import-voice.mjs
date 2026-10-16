// Импорт готовой озвучки из ElevenLabs (если генерируешь на сайте вручную).
//
//   npm run voice:import -- путь/к/озвучке.mp3     один файл со всем текстом: режется по паузам на 12 реплик
//   npm run voice:import -- путь/к/папке           папка с файлами L01.mp3 … L12.mp3 (или .wav)
//
// Речь не ускоряется: под фактическую длину фраз подгоняется тайминг сцен.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
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
  // Один файл: выравниваем по тексту сценария (audio/align_voice.py) — границы каждой фразы и тайминг слов.
  const res = JSON.parse(execFileSync('python3', ['audio/align_voice.py', src], {encoding: 'utf8', maxBuffer: 1 << 26}));
  console.log(`Озвучка: ${res.duration.toFixed(2)} с, фрагментов речи: ${res.segments}`);
  for (const l of res.lines) {
    const out = path.join(VOICE_DIR, `${l.id}.mp3`);
    cut(src, l.start, l.end, out);
    durs[l.id] = duration(out);
    lines[l.id] = {dur: durs[l.id], file: `${l.id}.mp3`, words: l.words};
    const v = tl.voice.find((x) => x.id === l.id);
    console.log(`${l.id}: ${l.start.toFixed(2)}–${l.end.toFixed(2)} (${durs[l.id].toFixed(2)} с) «${v.text}»`);
  }
}

const changes = retime(tl, durs);
for (const v of tl.voice) v.est = +durs[v.id].toFixed(2);
saveTL(tl);
writeGen(tl, 'import', lines);
console.log('\nТайминг:', changes.length ? '\n  ' + changes.join('\n  ') : 'реплики помещаются в сцены без изменений');
console.log(`Записано: ${GEN_PATH}. Проверь нарезку (public/voice/L01…L12.mp3), затем: npm run build`);

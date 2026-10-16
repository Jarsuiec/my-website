// Генерирует субтитры out/PC_MASTER_CINEMATIC_2026.srt (+ .vtt) из тех же данных, что и видео.
import fs from 'node:fs';
import {buildChunks, resolveVoice} from '../src/config/subs.js';

const tl = JSON.parse(fs.readFileSync('src/config/timeline.json', 'utf8'));
const gen = JSON.parse(fs.readFileSync('src/generated/voice.json', 'utf8'));
const chunks = buildChunks(resolveVoice(tl, gen));
const ts = (s, sep) => {
  const ms = Math.round(s * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${sec}${sep}${String(ms % 1000).padStart(3, '0')}`;
};
const base = process.argv[2] || 'out/PC_MASTER_CINEMATIC_2026';
fs.mkdirSync('out', {recursive: true});
fs.writeFileSync(base + '.srt', chunks.map((c, i) => `${i + 1}\n${ts(c.start, ',')} --> ${ts(c.end, ',')}\n${c.text}\n`).join('\n'));
fs.writeFileSync(base + '.vtt', 'WEBVTT\n\n' + chunks.map((c) => `${ts(c.start, '.')} --> ${ts(c.end, '.')}\n${c.text}\n`).join('\n'));
console.log(`Субтитры: ${chunks.length} фрагментов → ${base}.srt/.vtt`);

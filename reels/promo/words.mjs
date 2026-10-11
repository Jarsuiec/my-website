// Builds word-level timings + subtitle cues from script.json, writes words.json and subtitles.srt.
// Words inside a speech chunk are spread by syllables (vowels); punctuation adds a little pause.
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const script = JSON.parse(readFileSync(dir + 'script.json', 'utf8'));
const VOWELS = /[аеёиоуыэюяaeiouy]/gi;
const MAX_LINE = 22;

const words = [];
script.chunks.forEach((c, ci) => {
  const toks = [];
  for (const m of c.text.matchAll(/(\[[^\]]+\]|\{[^}]+\}|<[^>]+>)(\S*)|(\S+)/g)) {
    if (m[3]) { toks.push({ text: m[3], tone: null }); continue; }
    const tone = { '[': 'blue', '{': 'orange', '<': 'green' }[m[1][0]];
    m[1].slice(1, -1).split(' ').forEach((w, i, a) => toks.push({ text: w + (i === a.length - 1 ? m[2] : ''), tone }));
  }
  const weight = w => Math.max(1, (w.text.match(VOWELS) || []).length) + (/[,:]$/.test(w.text) ? .6 : /[.!?]$/.test(w.text) ? .4 : 0) + (w.text === '—' ? .8 : 0);
  const total = toks.reduce((s, w) => s + weight(w), 0), dur = c.t[1] - c.t[0];
  let acc = 0;
  toks.forEach(w => {
    const ws = weight(w);
    words.push({ ...w, chunk: ci, start: +(c.t[0] + dur * acc / total).toFixed(3), end: +(c.t[0] + dur * (acc + ws) / total).toFixed(3) });
    acc += ws;
  });
});

// subtitle cues: max 2 lines of ~MAX_LINE chars, never crossing a speech chunk
const cues = [];
let cur = null;
const len = ws => ws.map(w => w.text).join(' ').length;
words.forEach(w => {
  if (cur && cur.chunk === w.chunk) {
    const lines = cur.lines, last = lines.at(-1);
    if (len([...last, w]) <= MAX_LINE) { last.push(w); return; }
    if (lines.length < 2) { lines.push([w]); return; }
  }
  cur = { chunk: w.chunk, lines: [[w]] };
  cues.push(cur);
});
cues.forEach(c => { c.start = c.lines[0][0].start; });
cues.forEach((c, i) => {
  const all = c.lines.flat();
  const next = cues[i + 1];
  c.end = next && next.chunk === c.chunk ? next.start : Math.min(all.at(-1).end + .25, next ? next.start - .02 : Infinity);
});
writeFileSync(dir + 'words.json', JSON.stringify({ words, cues: cues.map(c => ({ start: c.start, end: +c.end.toFixed(3),
  lines: c.lines.map(l => l.map(w => ({ text: w.text, tone: w.tone, start: w.start }))) })) }, null, 1));

const ts = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
writeFileSync(dir + 'subtitles.srt', cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.lines.map(l => l.map(w => w.text).join(' ')).join('\n')}\n`).join('\n'));
console.log(`${words.length} words, ${cues.length} subtitle cues`);

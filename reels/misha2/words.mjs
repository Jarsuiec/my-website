// Word timings + subtitle cues from script.json. Inside each speech chunk, syllables are mapped
// onto detected vowel-energy peaks (assets/peaks.json), so fast and slow passages both line up.
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const script = JSON.parse(readFileSync(dir + 'script.json', 'utf8'));
const PEAKS = JSON.parse(readFileSync(dir + 'assets/peaks.json', 'utf8'));
const VOW = /[аеєиіїоуюяaeiouy]/gi, MAX_LINE = 18;

const words = [];
script.chunks.forEach((c, ci) => {
  const toks = [];
  for (const m of c.text.matchAll(/(\[[^\]]+\]|\{[^}]+\}|<[^>]+>)(\S*)|(\S+)/g)) {
    const push = (raw, tone, tail = '') => { const [txt, n] = raw.split('|'); toks.push({ text: txt + tail, tone, syl: n ? +n : Math.max(1, (txt.match(VOW) || []).length) }); };
    if (m[3]) { if (m[3] === '—') toks.push({ text: '—', tone: null, syl: .6 }); else push(m[3], null); continue; }
    const tone = { '[': 'yellow', '{': 'red', '<': 'green' }[m[1][0]];
    const parts = m[1].slice(1, -1).split(' ');
    parts.forEach((p, i) => push(p, tone, i === parts.length - 1 ? m[2] : ''));
  }
  const total = toks.reduce((s, w) => s + w.syl, 0);
  const pk = PEAKS.filter(p => p >= c.t[0] && p < c.t[1]);
  const timeAt = s => { // syllable position (0..total) → seconds
    if (pk.length < 3) return c.t[0] + (c.t[1] - c.t[0]) * s / total;
    const x = s / total * pk.length, i = Math.floor(x);
    const pts = [c.t[0], ...pk.map((p, k) => k < pk.length - 1 ? (p + pk[k + 1]) / 2 : p), c.t[1]];
    return pts[Math.min(i, pts.length - 2)] + (pts[Math.min(i + 1, pts.length - 1)] - pts[Math.min(i, pts.length - 2)]) * (x - i);
  };
  let acc = 0;
  toks.forEach(w => { words.push({ text: w.text, tone: w.tone, chunk: ci, start: +timeAt(acc).toFixed(3), end: +timeAt(acc + w.syl).toFixed(3) }); acc += w.syl; });
});

const cues = []; let cur = null;
const len = ws => ws.map(w => w.text).join(' ').length;
words.forEach(w => {
  if (cur && cur.chunk === w.chunk) {
    const last = cur.lines.at(-1);
    if (len([...last, w]) <= MAX_LINE) { last.push(w); return; }
    if (cur.lines.length < 2) { cur.lines.push([w]); return; }
  }
  cur = { chunk: w.chunk, lines: [[w]] }; cues.push(cur);
});
cues.forEach(c => { c.start = c.lines[0][0].start; });
cues.forEach((c, i) => { const n = cues[i + 1], last = c.lines.at(-1).at(-1);
  c.end = n && n.chunk === c.chunk ? n.start : Math.min(last.end + .3, n ? n.start - .02 : Infinity); });
writeFileSync(dir + 'words.json', JSON.stringify({ words, cues: cues.map(c => ({ start: c.start, end: +c.end.toFixed(3),
  lines: c.lines.map(l => l.map(w => ({ text: w.text, tone: w.tone, start: w.start }))) })) }, null, 1));
const ts = s => { const ms = Math.round(s * 1000); return `00:00:${String(Math.floor(ms / 1000)).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
writeFileSync(dir + 'subtitles.srt', cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.lines.map(l => l.map(w => w.text).join(' ')).join('\n')}\n`).join('\n'));
console.log(`${words.length} words, ${cues.length} cues`);

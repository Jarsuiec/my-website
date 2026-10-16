// Общая логика субтитров: используется в видео (overlays.tsx) и в генераторе SRT (scripts/subtitles.mjs).
// Фраза делится на куски ≤ 2 строк; тайминг — по словам из ElevenLabs (если есть), иначе пропорционально символам.
export const MAX_CHARS = 34;

export const chunkLine = (text) => {
  const sentences = (text.match(/[^.?!]+[.?!]?/g) || [text]).map((s) => s.trim()).filter(Boolean);
  const out = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).trim().length <= MAX_CHARS) buf = (buf + ' ' + s).trim();
    else {
      if (buf) out.push(buf);
      if (s.length <= MAX_CHARS * 1.9) buf = s;
      else {
        const w = s.split(' ');
        const half = Math.ceil(w.length / 2);
        out.push(w.slice(0, half).join(' '));
        buf = w.slice(half).join(' ');
      }
    }
  }
  if (buf) out.push(buf);
  return out;
};

// voice: [{text, start, dur, words?}] → [{text, start, end}]
export const buildChunks = (voice) => {
  const all = [];
  for (const v of voice) {
    const parts = chunkLine(v.text);
    const total = parts.reduce((a, p) => a + p.length, 0);
    let acc = 0;
    let wi = 0;
    parts.forEach((p, i) => {
      let s = v.start + (acc / total) * v.dur;
      let e = v.start + ((acc + p.length) / total) * v.dur;
      if (v.words && v.words.length) {
        const nw = p.split(' ').length;
        const ws = v.words.slice(wi, wi + nw);
        if (ws.length) {
          s = v.start + ws[0].s;
          e = v.start + ws[ws.length - 1].e;
        }
        wi += nw;
      }
      acc += p.length;
      all.push({text: p, start: s, end: i === parts.length - 1 ? e + 0.25 : e});
    });
  }
  return all;
};

// Абсолютные времена реплик из timeline.json (+ фактические из voice.json, если голос добавлен).
export const resolveVoice = (tl, gen) => {
  let acc = 0;
  const starts = {};
  for (const s of tl.scenes) {
    starts[s.id] = acc;
    acc += s.dur;
  }
  return tl.voice.map((v) => {
    const g = gen && gen.lines ? gen.lines[v.id] : undefined;
    return {id: v.id, scene: v.scene, text: v.text, start: g ? g.start : starts[v.scene] + v.at, dur: g ? g.dur : v.est, words: g ? g.words : undefined};
  });
};

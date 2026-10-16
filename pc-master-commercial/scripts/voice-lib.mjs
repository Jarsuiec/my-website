// Общие функции для озвучки: длительность файлов, подгонка тайминга сцен под реальную речь, запись voice.json.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

export const TL_PATH = 'src/config/timeline.json';
export const GEN_PATH = 'src/generated/voice.json';
export const VOICE_DIR = 'public/voice';

export const readTL = () => JSON.parse(fs.readFileSync(TL_PATH, 'utf8'));

export const duration = (file) =>
  parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'}).trim());

const sceneStarts = (tl) => {
  let acc = 0;
  const st = {};
  for (const s of tl.scenes) {
    st[s.id] = acc;
    acc += s.dur;
  }
  return st;
};

// Подгоняет тайминг под фактическую длину фраз:
//  • реплика не начинается раньше, чем закончилась предыдущая (+ пауза GAP);
//  • если реплика сильно выходит за свою сцену — сцена удлиняется (с шагом 0.5 с, чтобы музыка осталась в сетке).
// Речь НЕ ускоряется. Возвращает список изменений для отчёта.
export const retime = (tl, durs, {GAP = 0.25, SPILL = 0.5} = {}) => {
  const changes = [];
  // «Хватит это терпеть» (L03) звучит в тишине до удара логотипа: если не помещается — удар переносится (шаг 0.5 с).
  const l3 = tl.voice.find((v) => v.id === 'L03');
  const l4 = tl.voice.find((v) => v.id === 'L04');
  tl.cues = tl.cues || {logoDrop: 1.5};
  if (l3 && durs.L03) {
    const need = Math.ceil((l3.at + durs.L03 + 0.1) / 0.5) * 0.5;
    if (need > tl.cues.logoDrop) {
      changes.push(`удар логотипа: ${tl.cues.logoDrop} → ${need} с от начала сцены (L03 длиннее паузы)`);
      tl.cues.logoDrop = need;
    }
    if (l4 && l4.at < tl.cues.logoDrop + 0.2) l4.at = +(tl.cues.logoDrop + 0.25).toFixed(2);
  }
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;
    const st = sceneStarts(tl);
    let prevEnd = -1;
    for (const v of tl.voice) {
      const d = durs[v.id] ?? v.est;
      let start = st[v.scene] + v.at;
      if (start < prevEnd + GAP) {
        const nat = +(prevEnd + GAP - st[v.scene]).toFixed(2);
        changes.push(`${v.id}: сдвиг начала ${v.at} → ${nat} с`);
        v.at = nat;
        start = st[v.scene] + v.at;
        changed = true;
      }
      const sc = tl.scenes.find((s) => s.id === v.scene);
      const sceneEnd = st[v.scene] + sc.dur;
      const end = start + d;
      if (end > sceneEnd + SPILL) {
        const need = Math.ceil((end - sceneEnd - SPILL + 0.3) / 0.5) * 0.5;
        changes.push(`сцена ${sc.id}: ${sc.dur} → ${sc.dur + need} с (реплика ${v.id} длиннее сцены)`);
        sc.dur += need;
        changed = true;
        break;
      }
      prevEnd = end;
    }
    if (!changed) break;
  }
  return changes;
};

export const writeGen = (tl, source, lines) => {
  const st = sceneStarts(tl);
  const out = {source, lines: {}};
  for (const v of tl.voice) {
    const l = lines[v.id];
    if (!l) continue;
    out.lines[v.id] = {start: +(st[v.scene] + v.at).toFixed(3), dur: +l.dur.toFixed(3), file: l.file, ...(l.words ? {words: l.words} : {})};
  }
  fs.writeFileSync(GEN_PATH, JSON.stringify(out, null, 2) + '\n');
};

export const saveTL = (tl) => {
  fs.copyFileSync(TL_PATH, TL_PATH + '.bak');
  fs.writeFileSync(TL_PATH, JSON.stringify(tl, null, 2) + '\n');
};

export const loadDotEnv = () => {
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
};

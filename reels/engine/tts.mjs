// Generates a voice-over from each scene's "voice" line with RHVoice (offline TTS),
// stretches scenes that are shorter than their line, and writes voice.wav.
// Usage: node reels/engine/tts.mjs reels/videos/01-noutbuk-greetsya [--voice aleksandr-hq] [--rate 125]
// Needs: apt install rhvoice rhvoice-russian
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const videoDir = path.resolve(process.argv[2] || '.');
const opt = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const VOICE = opt('--voice', 'aleksandr-hq'), RATE = opt('--rate', '125');
const cfgPath = path.join(videoDir, 'video.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const tmp = mkdtempSync(path.join(tmpdir(), 'tts-'));
const run = (cmd, args, input) => {
  const r = spawnSync(cmd, args, { input });
  if (r.status) throw new Error(`${cmd} failed: ${r.stderr}`);
  return r.stdout.toString();
};
const duration = f => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));

const LEAD = 0.15, TAIL = 0.35; // pause before / after each line
let shift = 0;
const parts = [];
cfg.scenes.forEach((s, i) => {
  const dur = s.t[1] - s.t[0];
  s.t = [+(s.t[0] + shift).toFixed(2), +(s.t[0] + shift + dur).toFixed(2)];
  if (!s.voice) return;
  const wav = path.join(tmp, `${i}.wav`);
  // "say" overrides pronunciation (e.g. Windows -> виндоус) without changing subtitles
  run('RHVoice-test', ['-p', VOICE, '-r', RATE, '-o', wav], s.say || s.voice);
  const vd = duration(wav);
  s.voiceDur = +vd.toFixed(2);
  const need = LEAD + vd + TAIL;
  if (need > dur) { const extra = +(need - dur).toFixed(2); s.t[1] = +(s.t[1] + extra).toFixed(2); shift += extra; }
  parts.push({ wav, at: s.t[0] + LEAD });
  console.log(`scene ${i + 1}: ${vd.toFixed(2)}s voice in ${(s.t[1] - s.t[0]).toFixed(2)}s scene`);
});

const total = cfg.scenes.at(-1).t[1];
const ins = parts.flatMap(p => ['-i', p.wav]);
const delays = parts.map((p, k) => `[${k}:a]adelay=${Math.round(p.at * 1000)}:all=1[d${k}]`);
const filter = `${delays.join(';')};${parts.map((_, k) => `[d${k}]`).join('')}amix=inputs=${parts.length}:normalize=0,` +
  `apad,atrim=duration=${total},highpass=f=70,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,loudnorm=I=-15:TP=-1.5[out]`;
run('ffmpeg', ['-y', '-loglevel', 'error', ...ins, '-filter_complex', filter, '-map', '[out]', '-ar', '48000', '-ac', '2',
  path.join(videoDir, 'voice.wav')]);

cfg.voice = 'voice.wav';
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
console.log(`voice.wav written (${total}s), scene timings updated in video.json`);

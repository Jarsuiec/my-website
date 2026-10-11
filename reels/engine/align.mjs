// Aligns scenes to a recorded voice-over (e.g. from ElevenLabs): finds the pauses between
// phrases, gives each scene with a "voice" line one phrase, and rewrites scene timings.
// Usage: node reels/engine/align.mjs reels/videos/01-noutbuk-greetsya path/to/voice.mp3
import { spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const videoDir = path.resolve(process.argv[2] || '.');
const src = path.resolve(process.argv[3] || path.join(videoDir, 'voice.mp3'));
const cfgPath = path.join(videoDir, 'video.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const LEAD = 0.12, HOLD = 0.9; // cut slightly before each phrase; hold the last frame after speech

const ffmpeg = args => spawnSync('ffmpeg', args).stderr.toString();
const total = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).stdout);
const silences = [...ffmpeg(['-i', src, '-af', 'silencedetect=noise=-35dB:d=0.2', '-f', 'null', '-'])
  .matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map(m => ({ s: +m[1], e: +m[2] }));

const voiced = cfg.scenes.filter(s => s.voice);
const lead = silences.find(x => x.s < 0.05), trail = silences.find(x => x.e > total - 0.05);
const gaps = silences.filter(x => x !== lead && x !== trail)
  .sort((a, b) => (b.e - b.s) - (a.e - a.s)).slice(0, voiced.length - 1).sort((a, b) => a.s - b.s);
if (gaps.length !== voiced.length - 1)
  throw new Error(`found ${gaps.length + 1} phrases, need ${voiced.length}: add clearer pauses between lines`);

const starts = [lead ? lead.e : 0, ...gaps.map(g => g.e)];
const ends = [...gaps.map(g => g.s), trail ? trail.s : total];
voiced.forEach((s, i) => {
  s.t = [i ? +(starts[i] - LEAD).toFixed(2) : 0, 0];
  s.voiceAt = +(starts[i] - s.t[0]).toFixed(2);
  s.voiceDur = +(ends[i] - starts[i]).toFixed(2);
  console.log(`scene: ${starts[i].toFixed(2)}–${ends[i].toFixed(2)}s  «${s.voice}»`);
});
voiced.forEach((s, i) => { s.t[1] = i < voiced.length - 1 ? voiced[i + 1].t[0] : +(ends[i] + HOLD).toFixed(2); });

const ext = path.extname(src);
copyFileSync(src, path.join(videoDir, 'voice' + ext));
cfg.voice = 'voice' + ext;
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
console.log(`aligned ${voiced.length} scenes, video length ${voiced.at(-1).t[1]}s`);

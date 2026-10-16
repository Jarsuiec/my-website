// Полная сборка ролика: звук → видео (Remotion) → громкость −14 LUFS → MP4 (H.264 + AAC stereo) → субтитры.
//   node scripts/build.mjs            основная версия 9:16, ~51 с
//   node scripts/build.mjs --cut15    15-секундная версия
//   node scripts/build.mjs --audio-only   пересобрать только звук и перемуксить готовое видео
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const cut15 = process.argv.includes('--cut15');
const audioOnly = process.argv.includes('--audio-only');
const id = cut15 ? 'PCMaster15' : 'PCMaster';
const name = cut15 ? 'PC_MASTER_15s_2026' : 'PC_MASTER_CINEMATIC_2026';
const browser = process.env.REMOTION_BROWSER || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const conc = process.env.CONCURRENCY || '3';
const run = (cmd, args, opts = {}) => {
  console.log('\n$ ' + [cmd, ...args].join(' '));
  return execFileSync(cmd, args, {stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', encoding: 'utf8', ...opts});
};
fs.mkdirSync('out/audio', {recursive: true});

// 1. Звук
run('python3', ['audio/mix.py', ...(cut15 ? ['--cut15'] : [])]);
const mix = cut15 ? 'out/audio/mix15.wav' : 'out/audio/mix.wav';

// 2. Видео без звука
const silent = `out/${name}_video.mp4`;
if (!audioOnly || !fs.existsSync(silent)) {
  const args = ['remotion', 'render', 'src/index.ts', id, silent, '--muted', '--codec=h264', '--crf=16', '--x264-preset=slow', '--pixel-format=yuv420p', `--concurrency=${conc}`, `--browser-executable=${browser}`];
  if (process.env.FRAMES) args.push(`--frames=${process.env.FRAMES}`);
  run('npx', args);
}

// 3. Громкость для соцсетей: −14 LUFS, true peak −1 dBTP (двухпроходный loudnorm)
const target = 'I=-14:TP=-1.0:LRA=11';
const r2 = (() => {
  try {
    return execFileSync('ffmpeg', ['-hide_banner', '-i', mix, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], {encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe']});
  } catch (e) {
    return e.stderr;
  }
})();
const meas = JSON.parse(r2.slice(r2.lastIndexOf('{')));
const ln = `loudnorm=${target}:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true`;

// 4. Финальный MP4
const final = `out/${name}.mp4`;
run('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', mix, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', `${ln},aresample=48000`, '-c:a', 'aac', '-b:a', '320k', '-ac', '2', '-shortest', '-movflags', '+faststart', final]);

// 5. Субтитры
if (!cut15) run('node', ['scripts/subtitles.mjs', `out/${name}`]);
console.log('\nГотово:', final);

// Полная сборка ролика: звук → видео (Remotion) → громкость −14 LUFS → MP4 (H.264 + AAC stereo) → субтитры.
//   node scripts/build.mjs            основная версия 9:16, ~51 с
//   node scripts/build.mjs --cut15    15-секундная версия
//   node scripts/build.mjs --audio-only   пересобрать только звук и перемуксить готовое видео
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';

const cut15 = process.argv.includes('--cut15');
const audioOnly = process.argv.includes('--audio-only');
const id = cut15 ? 'PCMaster15' : 'PCMaster';
// V2 — доработанная версия; оригинал v1 сохранён (git-тег pc-master-v1, out/PC_MASTER_CINEMATIC_2026.mp4)
const name = cut15 ? 'PC_MASTER_15s_2026_V2' : 'PC_MASTER_CINEMATIC_2026_V2';
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

// 2. Видео без звука: рендер кусками (по сценам) в кадры JPEG, затем одно кодирование H.264.
//    Каждый кусок — свежий браузер (нет утечки WebGL-контекстов); уже готовые кадры не перерисовываются.
const silent = `out/${name}_video.mp4`;
if (!audioOnly || !fs.existsSync(silent)) {
  const tl = JSON.parse(fs.readFileSync('src/config/timeline.json', 'utf8'));
  const fps = tl.fps;
  let chunks;
  if (cut15) {
    const c = JSON.parse(fs.readFileSync('src/config/cut15.json', 'utf8'));
    chunks = c.segments.map((sg) => [Math.round(sg.dst * fps), Math.round((sg.dst + sg.len) * fps) - 1]);
  } else {
    let acc = 0;
    chunks = tl.scenes.map((sc) => {
      const a = Math.round(acc * fps);
      acc += sc.dur;
      return [a, Math.round(acc * fps) - 1];
    });
  }
  const dir = `out/frames_${name}`;
  fs.mkdirSync(dir, {recursive: true});
  const pad = (n) => String(n).padStart(4, '0');
  for (const [a, b] of chunks) {
    let missing = false;
    for (let fr = a; fr <= b; fr++) if (!fs.existsSync(`${dir}/element-${pad(fr)}.jpeg`)) missing = true;
    if (!missing) {
      console.log(`кадры ${a}–${b} уже готовы`);
      continue;
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        run('npx', ['remotion', 'render', 'src/index.ts', id, dir, '--sequence', `--frames=${a}-${b}`, '--image-format=jpeg', '--jpeg-quality=95', `--concurrency=${conc}`, '--timeout=180000', `--browser-executable=${browser}`]);
        // Remotion пишет element-N.jpeg без ведущих нулей — приводим к element-0000.jpeg
        for (const f of fs.readdirSync(dir)) {
          const m = f.match(/^element-(\d+)\.jpeg$/);
          if (m && m[1].length !== 4) fs.renameSync(`${dir}/${f}`, `${dir}/element-${pad(+m[1])}.jpeg`);
        }
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        console.log(`повтор куска ${a}–${b} (попытка ${attempt + 1})`);
      }
    }
  }
  run('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps), '-start_number', '0', '-i', `${dir}/element-%04d.jpeg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-maxrate', '10M', '-bufsize', '20M', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', silent]);
}

// 3. Громкость для соцсетей: −14 LUFS, true peak −1 dBTP (двухпроходный loudnorm)
const target = 'I=-14:TP=-1.0:LRA=11';
const r2 = spawnSync('ffmpeg', ['-hide_banner', '-i', mix, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], {encoding: 'utf8'}).stderr;
const meas = JSON.parse(r2.slice(r2.lastIndexOf('{')));
const ln = `loudnorm=${target}:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true`;

// 4. Финальный MP4
const final = `out/${name}.mp4`;
run('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', mix, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', `${ln},aresample=192000,alimiter=limit=0.85:attack=1:release=60:level=false,aresample=48000`, '-c:a', 'aac', '-b:a', '320k', '-ac', '2', '-shortest', '-movflags', '+faststart', final]);

// 5. Субтитры
if (!cut15) run('node', ['scripts/subtitles.mjs', `out/${name}`]);
console.log('\nГотово:', final);

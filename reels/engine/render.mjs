// Renders a reel from a video.json: your clips as background + animated graphics overlay.
// Usage: node reels/engine/render.mjs reels/videos/01-noutbuk-greetsya [out.mp4]
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const W = 1080, H = 1920, FPS = 30;
const engineDir = path.dirname(fileURLToPath(import.meta.url));
const videoDir = path.resolve(process.argv[2] || '.');
const cfg = JSON.parse(readFileSync(path.join(videoDir, 'video.json'), 'utf8'));
const out = path.resolve(process.argv[3] || path.join(videoDir, 'out.mp4'));
const abs = p => path.resolve(videoDir, p);

// scenes must be back to back
cfg.scenes.forEach((s, i) => {
  if (i && s.t[0] !== cfg.scenes[i - 1].t[1]) throw new Error(`scene ${i + 1}: starts at ${s.t[0]}, previous ends at ${cfg.scenes[i - 1].t[1]}`);
});
const TOTAL = cfg.scenes.at(-1).t[1];

const hasAudio = f => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', f])
  .stdout.toString().trim() !== '';
const atempo = speed => { const f = []; let s = speed; while (s > 2) { f.push('atempo=2'); s /= 2; } f.push(`atempo=${s}`); return f.join(','); };

// ---- background + audio graph ----
const inputs = [], filters = [], segs = [];
const clipsPresent = cfg.scenes.map(s => s.clip != null && [].concat(s.clip).every(c => existsSync(abs(c))));
cfg.scenes.forEach((s, i) => {
  const dur = s.t[1] - s.t[0];
  const clips = clipsPresent[i] ? [].concat(s.clip) : [null];
  const ins = [].concat(s.in ?? 0);
  clips.forEach((c, j) => {
    const d = dur / clips.length, n = segs.length, speed = s.speed || 1;
    const fmt = 'aformat=sample_rates=48000:channel_layouts=stereo';
    if (!c) {
      filters.push(`color=c=0x0a0a0b:s=${W}x${H}:r=${FPS}:d=${d},setsar=1,format=yuv420p[v${n}]`, `anullsrc=r=48000:cl=stereo,atrim=duration=${d}[a${n}]`);
    } else {
      const k = inputs.push(['-stream_loop', '-1', '-i', abs(c)]) - 1, from = ins[j] ?? 0;
      filters.push(`[${k}:v]trim=start=${from},setpts=(PTS-STARTPTS)/${speed},scale=${W}:${H}:force_original_aspect_ratio=increase,` +
        `crop=${W}:${H},setsar=1,fps=${FPS},trim=duration=${d},setpts=PTS-STARTPTS,format=yuv420p[v${n}]`);
      if (s.clipAudio && hasAudio(abs(c))) {
        filters.push(`[${k}:a]atrim=start=${from},asetpts=PTS-STARTPTS,${atempo(speed)},volume=${s.clipAudio},${fmt},` +
          `apad,atrim=duration=${d}[a${n}]`);
      } else filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${d}[a${n}]`);
    }
    segs.push(n);
  });
});
filters.push(`${segs.map(n => `[v${n}][a${n}]`).join('')}concat=n=${segs.length}:v=1:a=1[bg][clipa]`);

const mix = ['[clipa]'];
if (cfg.voice && existsSync(abs(cfg.voice))) {
  const k = inputs.push(['-i', abs(cfg.voice)]) - 1;
  filters.push(`[${k}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${cfg.voiceVolume ?? 1}[voice]`); mix.push('[voice]');
}
if (cfg.music && existsSync(abs(cfg.music))) {
  const k = inputs.push(['-stream_loop', '-1', '-i', abs(cfg.music)]) - 1;
  filters.push(`[${k}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${cfg.musicVolume ?? .15},` +
    `afade=t=out:st=${TOTAL - 1.5}:d=1.5[music]`); mix.push('[music]');
}
filters.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=first[aout]`);

const ov = inputs.length;
filters.push(`[bg][${ov}:v]overlay=format=auto,format=yuv420p[vout]`);

const args = ['-y', '-loglevel', 'error', ...inputs.flat(),
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-filter_complex', filters.join(';'), '-map', '[vout]', '-map', '[aout]', '-t', String(TOTAL),
  '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out];

// ---- overlay frames ----
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(pathToFileURL(path.join(engineDir, 'overlay.html')).href);
await page.evaluate(([c, p]) => window.setup(c, { clipsPresent: p }), [cfg, clipsPresent]);
await page.evaluate(() => document.fonts.ready);

const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', code => code ? rej(new Error(`ffmpeg exit ${code}`)) : res()));
const total = Math.round(TOTAL * FPS);
console.log(`${cfg.title}: ${total} frames, clips ${clipsPresent.filter(Boolean).length}/${cfg.scenes.length}`);
for (let f = 0; f < total; f++) {
  await page.evaluate(t => window.render(t), f / FPS);
  const buf = await page.screenshot({ type: 'png', omitBackground: true });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 150 === 0) console.log(`  frame ${f}/${total}`);
}
ff.stdin.end();
await done;
await browser.close();
console.log('done:', out);

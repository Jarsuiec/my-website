// Renders a reel from a video.json: clips (or illustrations) + animated graphics + voice, music, sfx.
// Usage: node reels/engine/render.mjs reels/videos/01-noutbuk-greetsya [out.mp4]
// Frames are drawn at 60 fps and blended pairwise into 30 fps for natural motion blur.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const W = 1080, H = 1920, FPS = 30, RFPS = 60;
const engineDir = path.dirname(fileURLToPath(import.meta.url));
const videoDir = path.resolve(process.argv[2] || '.');
const cfg = JSON.parse(readFileSync(path.join(videoDir, 'video.json'), 'utf8'));
const out = path.resolve(process.argv[3] || path.join(videoDir, 'out.mp4'));
const abs = p => path.resolve(videoDir, p);
const has = p => p && existsSync(abs(p));

cfg.scenes.forEach((s, i) => {
  if (i && s.t[0] !== cfg.scenes[i - 1].t[1]) throw new Error(`scene ${i + 1}: starts at ${s.t[0]}, previous ends at ${cfg.scenes[i - 1].t[1]}`);
});
const TOTAL = cfg.scenes.at(-1).t[1];

const hasAudio = f => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', f])
  .stdout.toString().trim() !== '';
const atempo = speed => { const f = []; let s = speed; while (s > 2) { f.push('atempo=2'); s /= 2; } f.push(`atempo=${s}`); return f.join(','); };

// voice loudness per 1/60 s -> drives the HUD level meter
function voiceLevels(file) {
  const sr = 6000, raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 }).stdout;
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4), win = sr / RFPS, lv = [];
  for (let i = 0; i < pcm.length; i += win) {
    let s = 0; for (let j = i; j < i + win && j < pcm.length; j++) s += pcm[j] * pcm[j];
    lv.push(Math.sqrt(s / win));
  }
  const peak = Math.max(...lv) || 1;
  let sm = 0;
  return lv.map(v => (sm = sm * .6 + Math.min(1, v / peak * 1.4) * .4));
}

const clipsPresent = cfg.scenes.map(s => s.clip != null && [].concat(s.clip).every(c => existsSync(abs(c))));
const anyClip = clipsPresent.some(Boolean);
const inputs = [], filters = [];
const fmt = 'aformat=sample_rates=48000:channel_layouts=stereo';

// ---- background clips (only when some exist; otherwise the page draws its own background) ----
if (anyClip) {
  const segs = [];
  cfg.scenes.forEach((s, i) => {
    const dur = s.t[1] - s.t[0], clips = clipsPresent[i] ? [].concat(s.clip) : [null], ins = [].concat(s.in ?? 0);
    clips.forEach((c, j) => {
      const d = dur / clips.length, n = segs.length, speed = s.speed || 1;
      if (!c) {
        filters.push(`color=c=0x060607:s=${W}x${H}:r=${RFPS}:d=${d},setsar=1,format=yuv420p[v${n}]`, `anullsrc=r=48000:cl=stereo,atrim=duration=${d}[a${n}]`);
      } else {
        const k = inputs.push(['-stream_loop', '-1', '-i', abs(c)]) - 1, from = ins[j] ?? 0;
        filters.push(`[${k}:v]trim=start=${from},setpts=(PTS-STARTPTS)/${speed},scale=${W}:${H}:force_original_aspect_ratio=increase,` +
          `crop=${W}:${H},setsar=1,fps=${RFPS},trim=duration=${d},setpts=PTS-STARTPTS,format=yuv420p[v${n}]`);
        filters.push(s.clipAudio && hasAudio(abs(c))
          ? `[${k}:a]atrim=start=${from},asetpts=PTS-STARTPTS,${atempo(speed)},volume=${s.clipAudio},${fmt},apad,atrim=duration=${d}[a${n}]`
          : `anullsrc=r=48000:cl=stereo,atrim=duration=${d}[a${n}]`);
      }
      segs.push(n);
    });
  });
  filters.push(`${segs.map(n => `[v${n}][a${n}]`).join('')}concat=n=${segs.length}:v=1:a=1[bg][clipa]`);
}

// ---- audio: voice + music (ducked under the voice) + sfx ----
const mix = anyClip ? ['[clipa]'] : [];
const voice = has(cfg.voice) ? abs(cfg.voice) : null;
if (voice) {
  const k = inputs.push(['-i', voice]) - 1;
  filters.push(`[${k}:a]${fmt},volume=${cfg.voiceVolume ?? 1},asplit=2[voice][vkey]`); mix.push('[voice]');
}
if (has(cfg.music)) {
  const k = inputs.push(['-stream_loop', '-1', '-i', abs(cfg.music)]) - 1;
  filters.push(`[${k}:a]${fmt},volume=${cfg.musicVolume ?? .3},atrim=duration=${TOTAL},afade=t=out:st=${TOTAL - 1.2}:d=1.2[m0]`);
  if (voice) filters.push('[m0][vkey]sidechaincompress=threshold=0.03:ratio=6:attack=30:release=400[music]');
  else filters.push('[m0]anull[music]');
  mix.push('[music]');
} else if (voice) filters.push('[vkey]anullsink');
if (has(cfg.sfx)) {
  const k = inputs.push(['-i', abs(cfg.sfx)]) - 1;
  filters.push(`[${k}:a]${fmt},volume=${cfg.sfxVolume ?? 1}[sfx]`); mix.push('[sfx]');
}
if (!mix.length) filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${TOTAL}[aout]`);
else filters.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=longest,atrim=duration=${TOTAL},alimiter=limit=0.95[aout]`);

// ---- video: page frames (alpha over clips, or opaque) -> motion-blur blend -> 30 fps ----
const ov = inputs.length;
const blend = `tmix=frames=2:weights='1 1',fps=${FPS}`;
filters.push(anyClip ? `[bg][${ov}:v]overlay=format=auto,${blend},format=yuv420p[vout]` : `[${ov}:v]${blend},format=yuv420p[vout]`);

const args = ['-y', '-loglevel', 'error', ...inputs.flat(),
  '-f', 'image2pipe', '-framerate', String(RFPS), '-c:v', anyClip ? 'png' : 'mjpeg', '-i', '-',
  '-filter_complex', filters.join(';'), '-map', '[vout]', '-map', '[aout]', '-t', String(TOTAL),
  '-c:v', 'libx264', '-crf', '19', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(pathToFileURL(path.join(engineDir, 'overlay.html')).href);
await page.evaluate(() => document.fonts.ready);
const levels = voice ? voiceLevels(voice) : [];
await page.evaluate(([c, o]) => window.setup(c, o), [cfg, { clipsPresent, opaque: !anyClip, levels, levelFps: RFPS }]);
await page.evaluate(() => document.fonts.ready);

const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', code => code ? rej(new Error(`ffmpeg exit ${code}`)) : res()));
const total = Math.round(TOTAL * RFPS);
console.log(`${cfg.title}: ${total} frames @${RFPS}fps, clips ${clipsPresent.filter(Boolean).length}/${cfg.scenes.length}`);
for (let f = 0; f < total; f++) {
  await page.evaluate(t => window.render(t), f / RFPS);
  const buf = anyClip ? await page.screenshot({ type: 'png', omitBackground: true }) : await page.screenshot({ type: 'jpeg', quality: 94 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 300 === 0) console.log(`  frame ${f}/${total}`);
}
ff.stdin.end();
await done;
await browser.close();
console.log('done:', out);

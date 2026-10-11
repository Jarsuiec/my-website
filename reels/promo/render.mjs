// Renders the promo: N parallel headless browsers draw 60 fps frames, ffmpeg blends them into 30 fps
// (motion blur) and mixes voice (unchanged speed) + music (ducked under the voice) + sfx.
// Usage: node reels/promo/render.mjs [--workers 3] [--from 0 --to 56.17] [--out build/pc-master-promo.mp4]
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { serve } from './server.mjs';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const cfg = JSON.parse(readFileSync(path.join(DIR, 'promo.json'), 'utf8'));
const TOTAL = cfg.scenes.at(-1).t[1];
const RFPS = 60, FPS = 30, WORKERS = +arg('--workers', 3);
const FROM = +arg('--from', 0), TO = Math.min(TOTAL, +arg('--to', TOTAL));
const BUILD = path.join(DIR, 'build'); mkdirSync(BUILD, { recursive: true });
const OUT = path.resolve(DIR, arg('--out', 'build/pc-master-promo.mp4'));
const TAG = arg('--tag', ''); // render in parts: --tag A --from 0 --to 28 --frames-only, then --segs A,B --mix-only
const clipsPresent = cfg.scenes.map(s => !!(s.clip && existsSync(path.resolve(DIR, s.clip))));
const anyClip = clipsPresent.some(Boolean);
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const f0 = Math.round(FROM * RFPS), f1 = Math.round(TO * RFPS), per = Math.ceil((f1 - f0) / WORKERS);
const { url, close } = await serve();
const t0 = Date.now();

async function worker(w) {
  const a = f0 + w * per, b = Math.min(f1, a + per);
  if (a >= b) return null;
  const seg = path.join(BUILD, `seg_${TAG}${w}.${anyClip ? 'mov' : 'mp4'}`);
  const browser = await chromium.launch({ args: GL_ARGS });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.log(`[w${w}] PAGE ERROR:`, e.message));
  await page.goto(url + '/promo/index.html');
  await page.waitForFunction(() => typeof window.setup === 'function');
  await page.evaluate(([c, o]) => window.setup(c, o), [cfg, { clipsPresent, transparent: anyClip }]);
  const enc = anyClip ? ['-c:v', 'qtrle'] : ['-c:v', 'libx264', '-crf', '12', '-preset', 'veryfast', '-pix_fmt', 'yuv420p'];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(RFPS), '-c:v', anyClip ? 'png' : 'mjpeg', '-i', '-', ...enc, seg],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
  for (let f = a; f < b; f++) {
    await page.evaluate(t => window.render(t), f / RFPS);
    const buf = anyClip ? await page.screenshot({ type: 'png', omitBackground: true }) : await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 300 === 0) console.log(`[w${w}] ${f - a}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await done; await browser.close();
  return seg;
}

const MIX_ONLY = process.argv.includes('--mix-only'); // reuse frames from the previous run
if (!MIX_ONLY) {
  const segs = (await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w)))).filter(Boolean);
  writeFileSync(path.join(BUILD, `segs${TAG}.txt`), segs.map(s => `file '${s}'`).join('\n'));
}
close();
if (process.argv.includes('--frames-only')) { console.log(`frames ${TAG} done in ${((Date.now() - t0) / 1000).toFixed(0)}s`); process.exit(0); }
if (arg('--segs')) writeFileSync(path.join(BUILD, 'segs.txt'), arg('--segs').split(',').map(tg => readFileSync(path.join(BUILD, `segs${tg}.txt`), 'utf8').trim()).join('\n'));
console.log(`frames done in ${((Date.now() - t0) / 1000).toFixed(0)}s, mixing…`);

// ---- final mix ----
const voice = path.resolve(DIR, 'assets/voice.mp3'), music = path.join(BUILD, 'music.wav'), sfx = path.join(BUILD, 'sfx.wav');
if (!existsSync(music)) spawnSync('python3', [path.join(DIR, 'audio.py')], { stdio: 'inherit' });
const dur = TO - FROM;
// audio: static gains from measured loudness (dynamic loudnorm produced NaN dropouts on quiet passages)
const lufs = (inArgs, filter) => {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...inArgs, '-filter_complex', `${filter},ebur128=framelog=quiet`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...res.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1);
  if (!m) throw new Error('loudness measurement failed'); return +m[1];
};
const cut = f => ['-ss', String(FROM), '-t', String(dur), '-i', f];
const VOICE_CHAIN = 'aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=10:release=160';
const vGain = -16 - lufs(cut(voice), `[0:a]${VOICE_CHAIN}`);
const mixWav = path.join(BUILD, 'mix.wav');
const mixGraph = [`[0:a]${VOICE_CHAIN},volume=${vGain.toFixed(2)}dB,asplit=2[voice][key]`,
  `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${cfg.musicVolume ?? .3}[m0];[m0][key]sidechaincompress=threshold=0.025:ratio=7:attack=25:release=380[music]`,
  `[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${cfg.sfxVolume ?? .9}[sfx]`,
  `[voice][music][sfx]amix=inputs=3:normalize=0:duration=longest,atrim=duration=${dur},alimiter=limit=0.9[a]`].join(';');
const mx = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...cut(voice), ...cut(music), ...cut(sfx), '-filter_complex', mixGraph, '-map', '[a]', '-ar', '48000', '-c:a', 'pcm_f32le', mixWav], { stdio: 'inherit' });
if (mx.status) process.exit(mx.status);
const fGain = -14 - lufs(['-i', mixWav], '[0:a]anull');
console.log(`voice gain ${vGain.toFixed(1)} dB, master gain ${fGain.toFixed(1)} dB`);
const inputs = ['-f', 'concat', '-safe', '0', '-i', path.join(BUILD, 'segs.txt'), '-i', mixWav];
const fc = [];
let vIn = '[0:v]';
if (anyClip) {
  // background clips per scene (others black), graphics composited on top
  const bg = [];
  cfg.scenes.forEach((s, i) => {
    const d = s.t[1] - s.t[0];
    if (clipsPresent[i]) {
      const k = inputs.filter(x => x === '-i').length; inputs.push('-stream_loop', '-1', '-i', path.resolve(DIR, s.clip));
      fc.push(`[${k}:v]trim=start=${s.in || 0},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=${RFPS},trim=duration=${d},setpts=PTS-STARTPTS,format=yuv420p[b${i}]`);
    } else fc.push(`color=c=0x07090c:s=1080x1920:r=${RFPS}:d=${d},setsar=1,format=yuv420p[b${i}]`);
    bg.push(`[b${i}]`);
  });
  fc.push(`${bg.join('')}concat=n=${bg.length}:v=1:a=0,trim=start=${FROM}:duration=${dur},setpts=PTS-STARTPTS[bgv]`);
  fc.push(`[bgv][0:v]overlay=format=auto[comp]`); vIn = '[comp]';
}
fc.push(`${vIn}tmix=frames=2:weights='1 1',fps=${FPS},format=yuv420p[vout]`);
fc.push(`[1:a]volume=${fGain.toFixed(2)}dB,alimiter=limit=0.84:level=false[aout]`);
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc.join(';'), '-map', '[vout]', '-map', '[aout]', '-t', String(dur),
  '-c:v', 'libx264', '-profile:v', 'high', '-crf', '18', '-preset', 'slow', '-r', String(FPS), '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
console.log(`done: ${OUT}  (${((Date.now() - t0) / 1000).toFixed(0)}s total)`);

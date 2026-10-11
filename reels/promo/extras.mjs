// Renders the cover (PNG/JPG), logo PNGs and the stand-alone end card video from the finished master.
// Run after render.mjs: node reels/promo/extras.mjs
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { serve } from './server.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), B = path.join(DIR, 'build');
const cfg = JSON.parse(readFileSync(path.join(DIR, 'promo.json'), 'utf8'));
const { url, close } = await serve();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
// clean 3D stills: overheating laptop + finished gaming PC
await page.goto(url + '/promo/index.html');
await page.waitForFunction(() => typeof window.setup === 'function');
await page.evaluate(c => window.setup(c, { clean: true }), cfg);
for (const [t, name] of [[9.95, 'still-hot'], [40.4, 'still-cool']]) {
  await page.evaluate(x => window.render(x), t);
  await page.screenshot({ path: path.join(B, name + '.jpg'), type: 'jpeg', quality: 95 });
}
await page.goto(url + '/promo/cover.html');
await page.waitForFunction(() => window.ready === true);
await page.screenshot({ path: path.join(B, 'cover.png') });
await page.screenshot({ path: path.join(B, 'cover.jpg'), type: 'jpeg', quality: 92 });
// logo PNGs (transparent)
const lp = await browser.newPage({ viewport: { width: 1520, height: 400 } });
for (const f of ['logo', 'logo-dark-bg']) {
  await lp.goto(url + `/promo/brand/${f}.svg`);
  await lp.setViewportSize({ width: 760, height: 200 });
  await lp.screenshot({ path: path.join(DIR, 'brand', f + '.png'), omitBackground: true, scale: 'device' });
}
await browser.close(); close();
// end card: last frames of the master held for 4 s, with the brand sting
const master = path.join(B, 'pc-master-promo.mp4'), total = cfg.scenes.at(-1).t[1];
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(total - 1.3), '-i', master, '-vf', 'tpad=stop_mode=clone:stop_duration=2.7',
  '-af', 'apad=pad_dur=2.7,afade=t=out:st=3.2:d=0.8', '-t', '4', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart', path.join(B, 'endcard.mp4')], { stdio: 'inherit' });
console.log('cover.png, cover.jpg, brand/*.png, endcard.mp4 done');

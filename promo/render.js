// usage:
//   node render.js stills <outdir> t1 t2 ...
//   node render.js sfx <out.json>
//   node render.js video <out.mp4> <fps> <startFrame> <endFrame>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DIR = __dirname;
const TIMING = fs.readFileSync(path.join(DIR, 'timing.json'), 'utf8');

async function open() {
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.addInitScript(`window.TIMING = ${TIMING};`);
  await page.goto('file://' + path.join(DIR, 'promo.html'));
  await page.waitForFunction('window.READY === true');
  await page.evaluate('document.fonts.ready');
  return { browser, page };
}

(async () => {
  const [mode, out, ...rest] = process.argv.slice(2);
  const { browser, page } = await open();
  const cdp = await page.context().newCDPSession(page);
  const shot = async (fmt = 'jpeg') => Buffer.from((await cdp.send('Page.captureScreenshot', { format: fmt, quality: 95, optimizeForSpeed: true })).data, 'base64');

  if (mode === 'sfx') {
    const sfx = await page.evaluate('({end: window.END, ev: window.SFX})');
    fs.writeFileSync(out, JSON.stringify(sfx, null, 1));
  } else if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const t of rest.map(Number)) {
      await page.evaluate(t0 => { for (let k = 6; k >= 0; k--) window.renderFrame(Math.max(0, t0 - k / 60)); }, t);
      fs.writeFileSync(path.join(out, `t${t.toFixed(2)}.jpg`), await shot());
    }
  } else if (mode === 'video') {
    const fps = Number(rest[0]), f0 = Number(rest[1]), f1 = Number(rest[2]);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      await page.evaluate(t => window.renderFrame(t), f / fps);
      const buf = await shot();
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 300 === 0) console.log(`[${path.basename(out)}] ${f - f0}/${f1 - f0} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();

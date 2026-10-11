// Quick stills: node reels/promo/preview.mjs out_dir 1.0 9.6 24.5 ...
import { chromium } from 'playwright';
import { serve } from './server.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const [outDir, ...times] = process.argv.slice(2);
const dir = path.dirname(new URL(import.meta.url).pathname);
const cfg = JSON.parse(readFileSync(path.join(dir, 'promo.json'), 'utf8'));
const { url, close } = await serve();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', m => m.type() === 'error' && console.log('PAGE:', m.text()));
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
await page.goto(url + '/promo/index.html');
await page.waitForFunction(() => typeof window.setup === 'function');
await page.evaluate(c => window.setup(c), cfg);
for (const t of times) {
  const t0 = Date.now();
  await page.evaluate(x => window.render(x), +t);
  await page.screenshot({ path: path.join(outDir, `f_${String(t).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 90 });
  console.log(t, Date.now() - t0, 'ms');
}
await browser.close(); close();

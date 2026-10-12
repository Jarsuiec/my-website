// Quick stills: node reels/misha/preview.mjs out_dir 1.0 5.5 ...
import { chromium } from 'playwright';
import { serve } from '../promo/server.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const [outDir, ...times] = process.argv.slice(2);
const dir = path.dirname(new URL(import.meta.url).pathname);
const cfg = JSON.parse(readFileSync(path.join(dir, 'misha2.json'), 'utf8'));
const { url, close } = await serve();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
page.on('console', m => m.type() === 'error' && console.log('PAGE:', m.text()));
await page.goto(url + '/misha2/index.html');
await page.waitForFunction(() => typeof window.setup === 'function');
await page.evaluate(c => window.setup(c), cfg);
for (const t of times) { await page.evaluate(x => window.render(x), +t);
  await page.screenshot({ path: path.join(outDir, `m_${String(t).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88 }); }
await browser.close(); close();

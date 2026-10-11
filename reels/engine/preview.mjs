// Renders single frames to PNG for a quick look: node reels/engine/preview.mjs <videoDir> <outDir> 1.2 5 9.5 ...
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const [videoDir, outDir, ...times] = process.argv.slice(2);
const engineDir = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(path.join(videoDir, 'video.json'), 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(pathToFileURL(path.join(engineDir, 'overlay.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.evaluate(c => window.setup(c, { opaque: true }), cfg);
await page.evaluate(() => document.fonts.ready);
for (const t of times) {
  await page.evaluate(x => window.render(x), +t);
  await page.screenshot({ path: path.join(outDir, `p_${String(t).padStart(5, '0')}.png`) });
}
await browser.close();

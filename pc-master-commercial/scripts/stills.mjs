// Быстрый просмотр кадров: node scripts/stills.mjs <секунды через запятую> [composition] [out.jpg]
// Собирает контактный лист из кадров (масштаб 0.4) для контроля качества.
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const secs = (process.argv[2] || '0').split(',').map(Number);
const comp = process.argv[3] || 'PCMaster';
const out = path.resolve(process.argv[4] || 'out/stills/sheet.jpg');
const tmp = path.join(path.dirname(out), 'frames');
fs.mkdirSync(tmp, {recursive: true});
const browserExecutable = process.env.REMOTION_BROWSER || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions: {gl: 'swangle'}});
const composition = await selectComposition({serveUrl, id: comp, puppeteerInstance: browser, browserExecutable, chromiumOptions: {gl: 'swangle'}});
const files = [];
for (const s of secs) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(s * composition.fps));
  const file = path.join(tmp, `f${String(frame).padStart(4, '0')}.jpg`);
  await renderStill({serveUrl, composition, frame, output: file, imageFormat: 'jpeg', jpegQuality: 88, scale: 0.4, puppeteerInstance: browser, chromiumOptions: {gl: 'swangle'}});
  files.push(file);
}
await browser.close({silent: true});
const cols = Math.min(files.length, 6);
const args = [];
files.forEach((f) => args.push('-i', f));
execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', `${files.map((_, i) => `[${i}:v]drawtext=text='${secs[i].toFixed(2)}s':x=10:y=10:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6[v${i}]`).join(';')};${files.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % cols) ? Array.from({length: i % cols}, () => 'w0').join('+') : '0'}_${Math.floor(i / cols) ? Array.from({length: Math.floor(i / cols)}, () => 'h0').join('+') : '0'}`).join('|')}:fill=black`, out]);
console.log(out);

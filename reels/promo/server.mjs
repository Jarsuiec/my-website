// Tiny static server for the reels/ folder (ES modules + import maps need http, not file://).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
export function serve() {
  return new Promise(res => {
    const srv = http.createServer(async (req, rsp) => {
      const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(root)) { rsp.writeHead(403).end(); return; }
      try { const data = await readFile(p); rsp.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }).end(data); }
      catch { rsp.writeHead(404).end(); }
    }).listen(0, '127.0.0.1', () => res({ url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }));
  });
}

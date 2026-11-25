// Static server for a built dist (SPA fallback, gzip like GitHub Pages, immutable cache for hashed names).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.csv': 'text/csv',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const GZ = new Set(['.html', '.js', '.css', '.json', '.csv', '.svg', '.webmanifest', '.txt']);

export const serve = (root, port) =>
  new Promise((resolve) => {
    const gzCache = new Map();
    const server = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(root, u);
      if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        if (u.startsWith('/data/') || u.startsWith('/private-sprites/') || /\.[a-z0-9]+$/i.test(u)) { res.writeHead(404); return res.end(); }
        f = path.join(root, 'index.html');
      }
      const ext = path.extname(f);
      const hashed = /\/assets\//.test(f) || /\.[0-9a-f]{8,}\.(json|csv|bin)$/.test(f);
      const headers = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache', etag: `"${fs.statSync(f).mtimeMs}"` };
      let body = fs.readFileSync(f);
      if (GZ.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) {
        if (!gzCache.has(f)) gzCache.set(f, zlib.gzipSync(body, { level: 6 }));
        body = gzCache.get(f);
        headers['content-encoding'] = 'gzip';
      }
      if (req.headers['if-none-match'] === headers.etag) { res.writeHead(304, headers); return res.end(); }
      res.writeHead(200, { ...headers, 'content-length': body.length });
      res.end(body);
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });

if (process.argv[1] && process.argv[1].endsWith('serve.mjs')) {
  const [root, port = '4181'] = process.argv.slice(2);
  serve(path.resolve(root), Number(port)).then(() => console.log(`serving ${root} on http://127.0.0.1:${port}/`));
}

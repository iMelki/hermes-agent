// Keyless static side-serve of the stamped hermes-web dist (SPA fallback).
// No session token injection, no /api backend, loopback only. Read-only w.r.t. Hermes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'S:/source/CCAI/Assistants/tools/hermes-agent-imelki/hermes_cli/web_dist';
const PORT = 9219;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json',
};

http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let fp = path.join(DIST, urlPath);
    if (!fp.startsWith(path.normalize(DIST))) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(DIST, 'index.html');
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(fp));
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`side-serve ready http://127.0.0.1:${PORT} dist=${DIST}`));

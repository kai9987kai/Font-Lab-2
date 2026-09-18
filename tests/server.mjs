/**
 * A ~40 line static file server so the tests run the lab over http rather than
 * file://, which is what gives it a real origin for localStorage and a secure
 * context for the clipboard. Serves the repository root, read-only.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const requested = decodeURIComponent(url.pathname);
  const target = path.join(ROOT, requested.endsWith('/') ? requested + 'index.html' : requested);

  if (!target.startsWith(ROOT + path.sep) && target !== path.join(ROOT, 'index.html')) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await fs.readFile(target);
    response.writeHead(200, {
      'content-type': TYPES[path.extname(target)] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Font Lab test server on http://127.0.0.1:' + PORT + '/');
});

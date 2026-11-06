/*
 * Command center edge server.
 *
 * Responsibilities:
 *   - Serve the static command-center page and its assets.
 *   - Proxy /api/* requests to the long-running server.mjs process.
 *   - Keep the long-running process off the public edge.
 *
 * Design notes:
 *   - This file is intentionally small. It must never contain business logic.
 *   - It must never store secrets. It forwards cookies transparently.
 *   - staticRoutes is an explicit allowlist. Anything not listed here is not
 *     served as a static asset. Add new public assets to the map below.
 *   - The proxied backend is expected on localhost:PORT_BACKEND. It is started
 *     by the same parent process (see render.yaml / start command).
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(here, 'web');

/*
 * Public static assets. Each entry maps an exact request path to a tuple of
 * [on-disk file name, content type]. Keep this list explicit and reviewed.
 * Files are served with a strong immutable cache header because they are
 * content-addressed in practice (filenames change when content changes).
 */
const staticRoutes = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/favicon.png', ['favicon.png', 'image/png']],
  ['/brand-icon-128.png', ['brand-icon-128.png', 'image/png']],
  ['/brand-icon-180.png', ['brand-icon-180.png', 'image/png']],
  ['/og-image.jpg', ['og-image.jpg', 'image/jpeg']],
  ['/og-image.png', ['og-image.png', 'image/png']],
  ['/home.css', ['home.css', 'text/css; charset=utf-8']],
  ['/home.js', ['home.js', 'text/javascript; charset=utf-8']],
]);

const CACHE_IMMUTABLE = 'public, max-age=86400, immutable';

const MIME_BY_EXTENSION = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const BACKEND_ORIGIN = `http://127.0.0.1:${process.env.PORT_BACKEND || 8081}`;
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';

/*
 * Security helpers
 */

/**
 * Resolve a path inside webDir or null when the path escapes it.
 * Prevents directory traversal (e.g. /../server.mjs).
 */
function safeWebPath(urlPath) {
  const cleaned = decodeURIComponent(urlPath.split('?')[0]);
  const joined = resolve(webDir, '.' + cleaned);
  if (joined !== webDir && !joined.startsWith(webDir + sep)) return null;
  return joined;
}

function isLoopbackRequest(req) {
  // Render terminates TLS at the edge and forwards to us on the local
  // network. X-Forwarded-For being present implies a real edge request.
  return req.headers['x-forwarded-for'] === undefined;
}

/*
 * Main edge server
 */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    /*
     * Static assets (exact allowlist above).
     */
    if (staticRoutes.has(pathname)) {
      const [fileName, contentType] = staticRoutes.get(pathname);
      const filePath = safeWebPath('/' + fileName);
      if (!filePath) throw new Error('blocked');
      const body = await readFile(filePath);
      res.writeHead(200, {
        'content-type': contentType,
        'cache-control': CACHE_IMMUTABLE,
        'x-content-type-options': 'nosniff',
      });
      res.end(body);
      return;
    }

    /*
     * Favicon alias for legacy clients looking for /favicon.ico.
     */
    if (pathname === '/favicon.ico') {
      const body = await readFile(join(webDir, 'favicon.png'));
      res.writeHead(200, {
        'content-type': 'image/png',
        'cache-control': CACHE_IMMUTABLE,
      });
      res.end(body);
      return;
    }

    /*
     * Health probe for the edge itself. Used by Render health checks and
     * by external uptime monitors. No auth, no body.
     */
    if (pathname === '/edge/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, edge: true, ts: Date.now() }));
      return;
    }

    /*
     * Everything else is proxied to the backend (API + auth flows).
     */
    if (pathname.startsWith('/api') || pathname.startsWith('/auth')) {
      const proxied = await proxyToBackend(req);
      res.writeHead(proxied.status, proxied.headers);
      res.end(proxied.body);
      return;
    }

    /*
     * Unknown paths that are not API/auth/static: serve the SPA shell for
     * human navigation but return 404 JSON for obvious scanners.
     */
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      const body = await readFile(join(webDir, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found.' }));
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' });
    }
    res.end(JSON.stringify({ error: 'Edge failure. Check logs.' }));
    console.error('[edge]', pathname, err && err.message ? err.message : err);
  }
});

/**
 * Minimal HTTP proxy to the backend process. Keeps the long-running
 * server.mjs bound to loopback so it is never directly exposed.
 */
async function proxyToBackend(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const headers = { ...req.headers };
  delete headers.host;
  headers['x-forwarded-proto'] = 'https';

  const response = await fetch(BACKEND_ORIGIN + req.url, {
    method: req.method,
    headers,
    body: body.length ? body : undefined,
    redirect: 'manual',
  });

  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  const responseBody = Buffer.from(await response.arrayBuffer());
  return { status: response.status, headers: responseHeaders, body: responseBody };
}

server.listen(PORT, HOST, () => {
  console.log(`[edge] listening on ${HOST}:${PORT}, backend ${BACKEND_ORIGIN}`);
});

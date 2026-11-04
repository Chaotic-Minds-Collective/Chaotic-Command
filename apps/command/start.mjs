import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// Edge wrapper for Chaotic Command.
// Runs the unchanged server.mjs on an internal loopback port and adds:
//   1. Static routes for brand imagery and the homepage tab script.
//   2. A CSP that additionally allows Google Fonts (styles + font files).
// Everything else is proxied verbatim to server.mjs.
const here = dirname(fileURLToPath(import.meta.url));
const externalPort = Number(process.env.PORT || 3000);
const internalPort = 3123 + (externalPort % 1000);
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const staticRoutes = new Map([
  ['/favicon.png', ['favicon.png', 'image/png']],
  ['/brand-icon-128.png', ['brand-icon-128.png', 'image/png']],
  ['/og-image.jpg', ['og-image.jpg', 'image/jpeg']],
  ['/home.js', ['home.js', 'text/javascript; charset=utf-8']]
]);

let stopping = false;
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: here,
  env: { ...process.env, PORT: String(internalPort), HOST: '127.0.0.1' },
  stdio: 'inherit'
});
const stop = () => { stopping = true; try { child.kill('SIGTERM'); } catch {} process.exit(0); };
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
child.once('exit', code => { if (!stopping) { console.error(`server.mjs exited with code ${code}`); process.exit(code ?? 1); } });

const proxy = (req, res) => {
  const upstream = http.request({ host: '127.0.0.1', port: internalPort, path: req.url, method: req.method, headers: req.headers }, upstreamRes => {
    const headers = { ...upstreamRes.headers };
    headers['content-security-policy'] = CSP;
    res.writeHead(upstreamRes.statusCode || 502, headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end('{"error":"Service is starting. Try again."}'); } });
  req.pipe(upstream);
};

const server = http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', CSP);
  if ((process.env.APP_ORIGIN || '').startsWith('https:')) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  const path = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && staticRoutes.has(path)) {
    try {
      const [file, type] = staticRoutes.get(path);
      res.writeHead(200, { 'Content-Type': type });
      res.end(readFileSync(resolve(here, 'web', file)));
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"Not found."}');
    }
    return;
  }
  proxy(req, res);
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(externalPort, process.env.HOST || '0.0.0.0', () => console.log('Chaotic Command edge listening. Open APP_ORIGIN in your browser.'));

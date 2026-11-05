import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const entry = join(dirname(fileURLToPath(import.meta.url)), '..', 'start.mjs');

/** Ask the OS for a free loopback port. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** True when nothing is listening on the port. */
function portIsFree(port) {
  return new Promise(resolve => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

/** The wrapper's backend uses 3123 + (port % 1000), so that port must be free as well. */
async function freeWrapperPort() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const port = await freePort();
    if (await portIsFree(3123 + (port % 1000))) return port;
  }
  throw new Error('Could not find free ports for the wrapper test.');
}

/** Start the edge wrapper as its own process and wait until both the wrapper and the app server are ready. */
async function startWrapper(t) {
  const port = await freeWrapperPort();
  const dataDir = mkdtempSync(join(tmpdir(), 'cc-start-test-'));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const child = spawn(process.execPath, [entry], {
    env: { PATH: process.env.PATH, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, APP_ORIGIN: `http://127.0.0.1:${port}` },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(() => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
  }));
  const deadline = Date.now() + 20000;
  while (!(output.includes('edge listening') && output.includes('Chaotic Command listening'))) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(`Wrapper did not start:\n${output}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return `http://127.0.0.1:${port}`;
}

test('wrapper serves the homepage script with the font-enabled policy', async t => {
  const url = await startWrapper(t);
  const response = await fetch(`${url}/home.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/javascript/);
  assert.match(response.headers.get('content-security-policy'), /style-src 'self' https:\/\/fonts\.googleapis\.com/);
  await response.body?.cancel();
});

test('wrapper proxies the homepage and API to the app server with the font-enabled policy', async t => {
  const url = await startWrapper(t);
  const page = await fetch(`${url}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Chaotic Command/);
  assert.match(page.headers.get('content-security-policy'), /fonts\.gstatic\.com/);

  const health = await fetch(`${url}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, configured: false });
});

test('wrapper stops its app server when it receives SIGTERM', async t => {
  const port = await freeWrapperPort();
  const dataDir = mkdtempSync(join(tmpdir(), 'cc-start-test-'));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const child = spawn(process.execPath, [entry], {
    env: { PATH: process.env.PATH, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, APP_ORIGIN: `http://127.0.0.1:${port}` },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  const deadline = Date.now() + 20000;
  while (!output.includes('Chaotic Command listening')) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(`Wrapper did not start:\n${output}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const exited = new Promise(resolve => child.once('exit', code => resolve(code)));
  child.kill('SIGTERM');
  assert.equal(await exited, 0);
  assert.equal(await portIsFree(port), true);
});

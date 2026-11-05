import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { connect, createServer } from 'node:net';
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
async function startWrapper(t, options = {}) {
  const port = await freeWrapperPort();
  const dataDir = mkdtempSync(join(tmpdir(), 'cc-start-test-'));
  const child = spawn(process.execPath, [entry], {
    cwd: options.cwd,
    env: { PATH: process.env.PATH, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, APP_ORIGIN: `http://127.0.0.1:${port}`, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
    }
    rmSync(dataDir, { recursive: true, force: true });
  });
  const deadline = Date.now() + 20000;
  while (!(output.includes('edge listening') && output.includes('Chaotic Command listening'))) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(`Wrapper did not start:\n${output}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return { url: `http://127.0.0.1:${port}`, port, child };
}

test('wrapper serves the homepage script with the font-enabled policy', async t => {
  const { url } = await startWrapper(t);
  const response = await fetch(`${url}/home.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/javascript/);
  assert.match(response.headers.get('content-security-policy'), /style-src 'self' https:\/\/fonts\.googleapis\.com/);
  await response.body?.cancel();
});

test('wrapper proxies the homepage and API to the app server with the font-enabled policy', async t => {
  const { url } = await startWrapper(t);
  const page = await fetch(`${url}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Chaotic Command/);
  assert.match(page.headers.get('content-security-policy'), /fonts\.gstatic\.com/);

  const health = await fetch(`${url}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, configured: false });
});

test('wrapper stops its app server when it receives SIGTERM', async t => {
  const { port, child } = await startWrapper(t);
  const exited = new Promise(resolve => child.once('exit', code => resolve(code)));
  child.kill('SIGTERM');
  assert.equal(await exited, 0);
  assert.equal(await portIsFree(port), true);
  assert.equal(await portIsFree(3123 + (port % 1000)), true);
});

test('wrapper contains invalid request targets', async t => {
  const { port, url } = await startWrapper(t);
  const response = await new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => socket.write('GET http://[invalid/ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'));
    let data = '';
    socket.on('data', chunk => { data += chunk; });
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
  assert.match(response, /^HTTP\/1\.1 400 /);
  assert.equal((await fetch(`${url}/api/health`)).status, 200);
});

test('relative and default data directories use the caller working directory', async t => {
  for (const dataDir of ['relative-data', '']) {
    const cwd = mkdtempSync(join(tmpdir(), 'cc-start-cwd-'));
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    const { child } = await startWrapper(t, { cwd, env: { DATA_DIR: dataDir } });
    assert.equal(existsSync(join(cwd, dataDir || '.data', 'command.sqlite')), true);
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    assert.equal(await exited, 0);
  }
});

test('wrapper waits for its backend before exiting', { skip: process.platform !== 'linux' }, async t => {
  const { port, child } = await startWrapper(t);
  const backendPid = Number(readFileSync(`/proc/${child.pid}/task/${child.pid}/children`, 'utf8').trim());
  assert.ok(backendPid > 0);
  process.kill(backendPid, 'SIGSTOP');
  const exited = new Promise(resolve => child.once('exit', resolve));
  try {
    child.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(child.exitCode, null);
    assert.equal(await portIsFree(3123 + (port % 1000)), false);
  } finally {
    process.kill(backendPid, 'SIGCONT');
  }
  assert.equal(await exited, 0);
  assert.equal(await portIsFree(3123 + (port % 1000)), true);
});

test('edge listen failure shuts down the backend', async t => {
  const port = await freeWrapperPort();
  const occupied = createServer();
  await new Promise((resolve, reject) => { occupied.once('error', reject); occupied.listen(port, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => occupied.close(resolve)));
  const dataDir = mkdtempSync(join(tmpdir(), 'cc-start-test-'));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const child = spawn(process.execPath, [entry], {
    env: { PATH: process.env.PATH, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, APP_ORIGIN: `http://127.0.0.1:${port}` },
    stdio: 'ignore'
  });
  assert.equal(await new Promise(resolve => child.once('exit', resolve)), 1);
  assert.equal(await portIsFree(3123 + (port % 1000)), true);
});

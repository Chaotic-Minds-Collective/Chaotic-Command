import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createApp } from '../server.mjs';

const origin = 'http://localhost:3000';
const secret = 'fixture-persistent-master-key-at-least-32-characters';
const guilds = ['123456789012345678', '123456789012345679'];
const tokens = ['fixture-persistence-bot-a-not-a-real-token', 'fixture-persistence-bot-b-not-a-real-token'];
const botIds = ['777777777777777777', '888888888888888888'];
const structure = { roles: ['Member'], categories: [{ name: 'Community', channels: ['general'] }] };
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

async function diskFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'chaotic-command-persistence-'));
  const original = join(directory, 'original');
  const calls = [];
  let app, base, dataDir = original, encryptionSecret = secret;
  const mockDiscord = async (input, options = {}) => {
    const path = new URL(input).pathname.replace('/api/v10', '');
    const authorization = options.headers?.Authorization;
    calls.push({ path, authorization, method: options.method || 'GET' });
    if (path === '/oauth2/token' && options.method === 'POST') {
      const code = new URLSearchParams(options.body).get('code');
      return reply({ access_token: `fixture-access-${code}`, expires_in: 3600 });
    }
    if (options.method && options.method !== 'GET') throw new Error('Fixture forbids Discord mutations.');
    if (path === '/users/@me') {
      if (authorization === 'Bearer fixture-access-owner-a') return reply({ id: '111111111111111111', username: 'owner-a' });
      if (authorization === 'Bearer fixture-access-owner-b') return reply({ id: '222222222222222222', username: 'owner-b' });
      const index = tokens.findIndex(token => authorization === `Bot ${token}`);
      if (index >= 0) return reply({ id: botIds[index], username: `fixture-bot-${index}`, bot: true });
      return reply({}, 401);
    }
    if (path === '/users/@me/guilds' && authorization?.startsWith('Bearer fixture-access-')) {
      return reply(guilds.map((id, index) => ({ id, name: `Fixture guild ${index}`, owner: true, permissions: '0' })));
    }
    const match = /^\/guilds\/(\d{17,20})\/(roles|channels|members\/(\d{17,20}))$/.exec(path);
    if (match && guilds.includes(match[1]) && tokens.some(token => authorization === `Bot ${token}`)) {
      if (match[2] === 'roles') return reply([{ id: match[1], name: '@everyone', permissions: '0' }, { id: 'bot-role', name: 'Bot', permissions: '268435472' }]);
      if (match[2] === 'channels') return reply([]);
      if (botIds.includes(match[3])) return reply({ roles: ['bot-role'] });
    }
    throw new Error('Unexpected offline fixture route: ' + path);
  };
  async function stop() {
    if (!app) return;
    const closing = app;
    app = null;
    await closing.close();
  }
  async function start() {
    app = createApp({ env: {
      APP_ORIGIN: origin,
      DATA_DIR: dataDir,
      DISCORD_CLIENT_ID: 'fixture-client-id',
      DISCORD_CLIENT_SECRET: 'fixture-client-secret',
      SESSION_SECRET: encryptionSecret
    }, fetch: mockDiscord });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${app.server.address().port}`;
  }
  t.after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });
  await start();
  async function login(code) {
    const begin = await fetch(`${base}/auth/discord`, { redirect: 'manual' });
    assert.equal(begin.status, 302);
    const state = new URL(begin.headers.get('location')).searchParams.get('state');
    const cookie = begin.headers.get('set-cookie').split(';')[0];
    const callback = await fetch(`${base}/auth/callback?state=${state}&code=${code}`, { redirect: 'manual', headers: { Cookie: cookie } });
    assert.equal(callback.status, 302);
    const signedCookie = callback.headers.get('set-cookie').split(';')[0];
    const session = await (await fetch(`${base}/api/session`, { headers: { Cookie: signedCookie } })).json();
    assert.equal(session.user.username, code);
    return { cookie: signedCookie, csrf: session.csrf };
  }
  async function request(path, auth, value) {
    const response = await fetch(`${base}${path}`, {
      headers: { Cookie: auth.cookie, Origin: origin, 'X-CSRF-Token': auth.csrf, 'Content-Type': 'application/json' },
      ...(value === undefined ? {} : { method: 'POST', body: JSON.stringify(value) })
    });
    return { status: response.status, data: await response.json() };
  }
  return {
    get db() { return app.db; },
    get dbPath() { return join(dataDir, 'command.sqlite'); },
    calls, login, request,
    async restart(options = {}) {
      await stop();
      encryptionSecret = options.secret || encryptionSecret;
      calls.length = 0;
      await start();
    },
    async withStoppedDatabase(action) {
      await stop();
      try { return await action(dataDir); } finally { await start(); }
    },
    async restoreStoppedCopy() {
      const source = join(dataDir, 'command.sqlite');
      await stop();
      dataDir = join(directory, 'restored');
      await mkdir(dataDir, { mode: 0o700 });
      await copyFile(source, join(dataDir, 'command.sqlite'));
      calls.length = 0;
      await start();
    }
  };
}

async function seed(f) {
  const owner = await f.login('owner-a');
  const other = await f.login('owner-b');
  const bots = [];
  for (const [index, token] of tokens.entries()) {
    const connected = await f.request('/api/bots', owner, { token });
    assert.equal(connected.status, 201);
    bots.push(connected.data.bot);
    assert.equal((await f.request(`/api/guilds/${guilds[index]}/bot`, owner, { id: connected.data.bot.id })).status, 200);
  }
  const saved = await f.request('/api/structures', owner, { name: 'Restart fixture', structure });
  assert.equal(saved.status, 201);
  assert.equal((await f.request(`/api/guilds/${guilds[0]}/notes`, owner, { notes: 'Shared fixture notes' })).status, 200);
  return { owner, other, bots, savedId: saved.data.structure.id };
}

async function assertRestored(f, data) {
  const session = await f.request('/api/session', data.owner);
  assert.equal(session.data.user.username, 'owner-a');
  assert.equal(session.data.csrf, data.owner.csrf);
  const listed = await f.request('/api/bots', data.owner);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.data.bots.map(bot => bot.id).sort(), data.bots.map(bot => bot.id).sort());
  assert.equal(listed.data.selectedBotId, data.bots[1].id);
  assert.deepEqual((await f.request('/api/bots', data.other)).data.bots, []);
  const saved = await f.request(`/api/structures/${data.savedId}`, data.owner);
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.data.data, structure);
  assert.equal((await f.request(`/api/structures/${data.savedId}`, data.other)).status, 404);
  assert.equal((await f.request(`/api/guilds/${guilds[0]}/notes`, data.owner)).data.notes, 'Shared fixture notes');
  for (const [index, guild] of guilds.entries()) {
    assert.equal((await f.request(`/api/guilds/${guild}/bot`, data.owner)).data.selectedBotId, data.bots[index].id);
    assert.equal((await f.request(`/api/guilds/${guild}/status`, data.owner)).status, 200);
    assert.ok(f.calls.some(call => call.path === `/guilds/${guild}/roles` && call.authorization === `Bot ${tokens[index]}`));
  }
  const stored = f.db.prepare('SELECT token_encrypted FROM user_bots').all().map(row => row.token_encrypted).join('');
  const sessions = f.db.prepare('SELECT data FROM sessions').all().map(row => row.data).join('');
  for (const token of [...tokens, 'fixture-access-owner-a', 'fixture-access-owner-b']) {
    assert.equal(stored.includes(token), false);
    assert.equal(sessions.includes(token), false);
    assert.equal(JSON.stringify(listed.data).includes(token), false);
  }
}

test('file-backed SQLite preserves sessions, private structures and per-server bots across app restart', async t => {
  const f = await diskFixture(t);
  const data = await seed(f);
  assert.equal((await readFile(f.dbPath)).subarray(0, 16).toString(), 'SQLite format 3\0');
  await f.restart();
  await assertRestored(f, data);
});

test('a stopped SQLite database copy restores data and encrypted credentials with the matching key', async t => {
  const f = await diskFixture(t);
  const data = await seed(f);
  const previousPath = f.dbPath;
  await f.restoreStoppedCopy();
  assert.notEqual(f.dbPath, previousPath);
  await assertRestored(f, data);
});

test('a mismatched session secret fails closed after restart without exposing or deleting bot credentials', async t => {
  const f = await diskFixture(t);
  const data = await seed(f);
  const encrypted = f.db.prepare('SELECT token_encrypted FROM user_bots WHERE id = ?').get(data.bots[0].id).token_encrypted;
  await f.restart({ secret: 'different-fixture-master-key-at-least-32-characters' });
  assert.equal((await f.request('/api/session', data.owner)).data.user, null);
  assert.equal((await f.request('/api/bots', data.owner)).status, 401);
  const fresh = await f.login('owner-a');
  const result = await f.request(`/api/guilds/${guilds[0]}/bot`, fresh);
  assert.equal(result.status, 500);
  assert.equal(result.data.error, 'Unexpected server error. Check server configuration and retry.');
  for (const value of [...tokens, encrypted, secret]) assert.equal(JSON.stringify(result.data).includes(value), false);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM user_bots').get().count, 2);
  assert.equal(f.db.prepare('SELECT token_encrypted FROM user_bots WHERE id = ?').get(data.bots[0].id).token_encrypted, encrypted);
  assert.equal(f.calls.some(call => call.authorization?.startsWith('Bot ')), false);
});

test('corrupted bot and session ciphertext fail closed after restart without affecting the other records', async t => {
  const f = await diskFixture(t);
  const data = await seed(f);
  f.db.prepare('UPDATE user_bots SET token_encrypted = ? WHERE id = ?').run('corrupted-fixture-ciphertext', data.bots[0].id);
  await f.restart();
  const result = await f.request(`/api/guilds/${guilds[0]}/bot`, data.owner);
  assert.equal(result.status, 500);
  assert.equal(result.data.error, 'Unexpected server error. Check server configuration and retry.');
  assert.equal(f.calls.some(call => call.authorization?.startsWith('Bot ')), false);
  assert.equal((await f.request(`/api/guilds/${guilds[1]}/status`, data.owner)).status, 200);
  const sid = data.owner.cookie.split('=')[1];
  const key = createHash('sha256').update(sid).digest('hex');
  assert.equal(f.db.prepare('UPDATE sessions SET data = ? WHERE id = ?').run('corrupted-fixture-session', key).changes, 1);
  await f.restart();
  assert.equal((await f.request('/api/bots', data.owner)).status, 401);
  assert.equal((await f.request('/api/session', data.owner)).data.user, null);
  assert.equal((await f.request('/api/session', data.other)).data.user.username, 'owner-b');
});


test('a separate Node.js process can reopen the SQLite sessions and use the encrypted per-server bot', async t => {
  const f = await diskFixture(t);
  const data = await seed(f);
  const serverUrl = new URL('../server.mjs', import.meta.url).href;
  await f.withStoppedDatabase(async dataDir => {
    const configuration = {
      APP_ORIGIN: origin, DATA_DIR: dataDir, DISCORD_CLIENT_ID: 'fixture-client-id',
      DISCORD_CLIENT_SECRET: 'fixture-client-secret', SESSION_SECRET: secret
    };
    const program = `
      import assert from 'node:assert/strict';
      import { createApp } from ${JSON.stringify(serverUrl)};
      const env = ${JSON.stringify(configuration)};
      const guild = ${JSON.stringify(guilds[0])};
      const token = ${JSON.stringify(tokens[0])};
      const identity = ${JSON.stringify(botIds[0])};
      const cookie = ${JSON.stringify(data.owner.cookie)};
      const reply = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
      const app = createApp({ env, fetch: async (input, options = {}) => {
        const path = new URL(input).pathname.replace('/api/v10', '');
        assert.equal(options.method || 'GET', 'GET');
        if (path === '/users/@me/guilds') {
          assert.equal(options.headers.Authorization, 'Bearer fixture-access-owner-a');
          return reply([{ id: guild, owner: true, permissions: '0' }]);
        }
        assert.equal(options.headers.Authorization, 'Bot ' + token);
        if (path === '/users/@me') return reply({ id: identity, bot: true });
        if (path === '/guilds/' + guild + '/roles') return reply([{ id: guild, name: '@everyone', permissions: '0' }, { id: 'bot-role', name: 'Bot', permissions: '268435472' }]);
        if (path === '/guilds/' + guild + '/channels') return reply([]);
        if (path === '/guilds/' + guild + '/members/' + identity) return reply({ roles: ['bot-role'] });
        throw new Error('Unexpected offline child fixture route.');
      } });
      await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
      const base = 'http://127.0.0.1:' + app.server.address().port;
      try {
        const session = await (await fetch(base + '/api/session', { headers: { Cookie: cookie } })).json();
        const bots = await (await fetch(base + '/api/bots', { headers: { Cookie: cookie } })).json();
        const status = await fetch(base + '/api/guilds/' + guild + '/status', { headers: { Cookie: cookie } });
        const detail = await status.json();
        console.log(JSON.stringify({ userId: session.user?.id, botCount: bots.bots?.length, status: status.status, roles: detail.roles }));
      } finally { await app.close(); }
    `;
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', program], {
      timeout: 10000, env: { PATH: process.env.PATH || '' }
    });
    assert.deepEqual(JSON.parse(stdout), { userId: '111111111111111111', botCount: 2, status: 200, roles: 2 });
  });
});

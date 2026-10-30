import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';

const credentials = {
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_CLIENT_SECRET: 'private-client-secret',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters'
};
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

async function fixture(t, fetcher) {
  const app = createApp({ env: { APP_ORIGIN: 'http://localhost:3000', ...credentials }, dbPath: ':memory:', fetch: fetcher });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  return { ...app, url: `http://127.0.0.1:${app.server.address().port}` };
}
async function signIn(url, code) {
  const start = await fetch(`${url}/auth/discord`, { redirect: 'manual' });
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const initialCookie = start.headers.get('set-cookie').split(';')[0];
  const callback = await fetch(`${url}/auth/callback?state=${state}&code=${code}`, { redirect: 'manual', headers: { Cookie: initialCookie } });
  const cookie = callback.headers.get('set-cookie').split(';')[0];
  const session = await fetch(`${url}/api/session`, { headers: { Cookie: cookie } });
  return { cookie, csrf: (await session.json()).csrf };
}
const headers = auth => ({ Cookie: auth.cookie, Origin: 'http://localhost:3000', 'Content-Type': 'application/json', 'X-CSRF-Token': auth.csrf });

test('personal bot tokens are verified, encrypted, private to their owner, and never returned', async t => {
  const rawToken = 'example.personal.discord.bot.token.value';
  const botId = '987654321098765432';
  const mockDiscord = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname === '/api/v10/oauth2/token' && options.method === 'POST') {
      const code = new URLSearchParams(options.body).get('code');
      return json({ access_token: `user-${code}`, expires_in: 3600 });
    }
    if (url.pathname === '/api/v10/users/@me') {
      const authorization = options.headers?.Authorization;
      if (authorization === 'Bot ' + rawToken) return json({ id: botId, username: 'personal-helper', bot: true });
      if (authorization === 'Bearer user-owner-a') return json({ id: '111111111111111111', username: 'owner-a' });
      if (authorization === 'Bearer user-owner-b') return json({ id: '222222222222222222', username: 'owner-b' });
    }
    throw new Error('Unexpected Discord request: ' + url.pathname);
  };
  const { url, db } = await fixture(t, mockDiscord);
  const ownerA = await signIn(url, 'owner-a');
  const ownerB = await signIn(url, 'owner-b');

  let response = await fetch(`${url}/api/bots`, { method: 'POST', headers: headers(ownerA), body: JSON.stringify({ token: rawToken }) });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.bot.discordBotId, botId);
  assert.equal(created.bot.username, 'personal-helper');
  assert.ok(created.bot.id);
  assert.equal(JSON.stringify(created).includes(rawToken), false);
  assert.equal(JSON.stringify(created).includes('token_encrypted'), false);

  const stored = db.prepare('SELECT owner_id, token_encrypted FROM user_bots WHERE id = ?').get(created.bot.id);
  assert.equal(stored.owner_id, '111111111111111111');
  assert.notEqual(stored.token_encrypted, rawToken);
  assert.equal(stored.token_encrypted.includes(rawToken), false);

  response = await fetch(`${url}/api/bots`, { headers: { Cookie: ownerA.cookie } });
  const listA = await response.json();
  assert.equal(listA.bots.length, 1);
  assert.equal(listA.selectedBotId, created.bot.id);
  assert.equal(JSON.stringify(listA).includes(rawToken), false);

  response = await fetch(`${url}/api/bots`, { headers: { Cookie: ownerB.cookie } });
  assert.deepEqual((await response.json()).bots, []);

  response = await fetch(`${url}/api/bots/${created.bot.id}/delete`, { method: 'POST', headers: headers(ownerB), body: '{}' });
  assert.equal(response.status, 404, 'another account cannot remove this credential');

  response = await fetch(`${url}/api/bots/${created.bot.id}/delete`, { method: 'POST', headers: headers(ownerA), body: '{}' });
  assert.equal(response.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_bots').get().count, 0);
});

test('personal bot connection rejects invalid tokens, non-bot accounts, and missing CSRF', async t => {
  const mockDiscord = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname === '/api/v10/oauth2/token' && options.method === 'POST') return json({ access_token: 'user-token', expires_in: 3600 });
    if (url.pathname === '/api/v10/users/@me' && options.headers?.Authorization === 'Bearer user-token') return json({ id: '111111111111111111', username: 'owner' });
    if (url.pathname === '/api/v10/users/@me' && options.headers?.Authorization === 'Bot valid-but-not-a-bot-token') return json({ id: '222222222222222222', username: 'human', bot: false });
    if (url.pathname === '/api/v10/users/@me') return json({ message: 'Unauthorized' }, 401);
    throw new Error('Unexpected Discord request.');
  };
  const { url } = await fixture(t, mockDiscord);
  const auth = await signIn(url, 'owner');

  let response = await fetch(`${url}/api/bots`, { method: 'POST', headers: { ...headers(auth), 'X-CSRF-Token': '' }, body: JSON.stringify({ token: 'valid-but-not-a-bot-token' }) });
  assert.equal(response.status, 403);

  response = await fetch(`${url}/api/bots`, { method: 'POST', headers: headers(auth), body: JSON.stringify({ token: 'invalid-token-that-is-long-enough' }) });
  assert.equal(response.status, 400);

  response = await fetch(`${url}/api/bots`, { method: 'POST', headers: headers(auth), body: JSON.stringify({ token: 'valid-but-not-a-bot-token' }) });
  assert.equal(response.status, 400);
});

test('server audit and preview use the selected personal bot without a shared bot token', async t => {
  const rawToken = 'customer.bot.token.used.for.discord.calls';
  const guildId = '123456789012345678';
  const botId = '987654321098765432';
  const botRoleId = '333333333333333333';
  const authorizationHeaders = [];
  const mockDiscord = async (input, options = {}) => {
    const url = new URL(input);
    const authorization = options.headers?.Authorization;
    authorizationHeaders.push(authorization);
    if (url.pathname === '/api/v10/oauth2/token' && options.method === 'POST') return json({ access_token: 'customer-user-token', expires_in: 3600 });
    if (url.pathname === '/api/v10/users/@me' && authorization === 'Bearer customer-user-token') return json({ id: '111111111111111111', username: 'customer' });
    if (url.pathname === '/api/v10/users/@me' && authorization === 'Bot ' + rawToken) return json({ id: botId, username: 'customer-helper', bot: true });
    if (url.pathname === '/api/v10/users/@me/guilds') return json([{ id: guildId, name: 'Customer Test Server', owner: true, permissions: '0' }]);
    if (url.pathname === `/api/v10/guilds/${guildId}/roles` && authorization === 'Bot ' + rawToken) {
      return json([
        { id: guildId, name: '@everyone', permissions: '0', managed: false },
        { id: botRoleId, name: 'Customer Helper', permissions: '268435472', managed: false }
      ]);
    }
    if (url.pathname === `/api/v10/guilds/${guildId}/channels` && authorization === 'Bot ' + rawToken) return json([]);
    if (url.pathname === `/api/v10/guilds/${guildId}/members/${botId}` && authorization === 'Bot ' + rawToken) return json({ roles: [botRoleId] });
    throw new Error('Unexpected Discord request: ' + options.method + ' ' + url.pathname + ' (' + authorization + ')');
  };
  const { url } = await fixture(t, mockDiscord);
  const auth = await signIn(url, 'customer');
  let response = await fetch(`${url}/api/bots`, { method: 'POST', headers: headers(auth), body: JSON.stringify({ token: rawToken }) });
  assert.equal(response.status, 201);

  response = await fetch(`${url}/api/guilds/${guildId}/status`, { headers: { Cookie: auth.cookie } });
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.equal(new URL(status.inviteUrl).searchParams.get('client_id'), botId);

  response = await fetch(`${url}/api/guilds/${guildId}/preview`, {
    method: 'POST', headers: headers(auth), body: JSON.stringify({ templateId: 'community' })
  });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).steps.length > 0);
  assert.ok(authorizationHeaders.filter(value => value === 'Bot ' + rawToken).length >= 5);
});

test('per-server bot assignments are isolated by Discord account', async t => {
  const botTokens = new Map([
    ['Bot owner-a-bot-token-is-valid-and-long', { id: '777777777777777777', username: 'owner-a-bot', bot: true }],
    ['Bot owner-b-bot-token-is-valid-and-long', { id: '888888888888888888', username: 'owner-b-bot', bot: true }]
  ]);
  const mockDiscord = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname === '/api/v10/oauth2/token' && options.method === 'POST') {
      const code = new URLSearchParams(options.body).get('code');
      return json({ access_token: `user-${code}`, expires_in: 3600 });
    }
    if (url.pathname === '/api/v10/users/@me') {
      const auth = options.headers?.Authorization;
      if (botTokens.has(auth)) return json(botTokens.get(auth));
      if (auth === 'Bearer user-owner-a') return json({ id: '111111111111111111', username: 'owner-a' });
      if (auth === 'Bearer user-owner-b') return json({ id: '222222222222222222', username: 'owner-b' });
    }
    if (url.pathname === '/api/v10/users/@me/guilds') return json([{ id: '123456789012345678', name: 'Shared Test Server', owner: true, permissions: '0' }]);
    throw new Error('Unexpected Discord request: ' + url.pathname);
  };
  const { url } = await fixture(t, mockDiscord);
  const ownerA = await signIn(url, 'owner-a');
  const ownerB = await signIn(url, 'owner-b');

  let response = await fetch(`${url}/api/bots`, { method: 'POST', headers: headers(ownerA), body: JSON.stringify({ token: 'owner-a-bot-token-is-valid-and-long' }) });
  assert.equal(response.status, 201);
  const botA = (await response.json()).bot;
  response = await fetch(`${url}/api/bots`, { method: 'POST', headers: headers(ownerB), body: JSON.stringify({ token: 'owner-b-bot-token-is-valid-and-long' }) });
  assert.equal(response.status, 201);
  const botB = (await response.json()).bot;

  response = await fetch(`${url}/api/guilds/123456789012345678/bot`, {
    method: 'POST', headers: headers(ownerB), body: JSON.stringify({ id: botA.id })
  });
  assert.equal(response.status, 404, 'an account cannot assign another account\'s bot');

  response = await fetch(`${url}/api/guilds/123456789012345678/bot`, {
    method: 'POST', headers: headers(ownerA), body: JSON.stringify({ id: botA.id })
  });
  assert.equal(response.status, 200);
  response = await fetch(`${url}/api/guilds/123456789012345678/bot`, { headers: { Cookie: ownerA.cookie } });
  assert.equal((await response.json()).selectedBotId, botA.id);

  response = await fetch(`${url}/api/guilds/123456789012345678/bot`, {
    method: 'POST', headers: headers(ownerB), body: JSON.stringify({ id: botB.id })
  });
  assert.equal(response.status, 200);
  response = await fetch(`${url}/api/guilds/123456789012345678/bot`, { headers: { Cookie: ownerB.cookie } });
  assert.equal((await response.json()).selectedBotId, botB.id);
});


async function botSwitchScenario(t) {
  const guildId = '123456789012345678';
  const tokens = ['fixture-bot-a-token-not-a-real-secret', 'fixture-bot-b-token-not-a-real-secret'];
  const identities = tokens.map((token, index) => ({ id: `${index + 7}`.repeat(18), username: `fixture-bot-${index}`, bot: true }));
  const writes = [];
  let onWrite = async () => {};
  const mockDiscord = async (input, options = {}) => {
    const path = new URL(input).pathname.replace('/api/v10', '');
    const auth = options.headers?.Authorization;
    if (path === '/oauth2/token') return json({ access_token: 'fixture-user-token', expires_in: 3600 });
    if (path === '/users/@me') {
      if (auth === 'Bearer fixture-user-token') return json({ id: '111111111111111111', username: 'fixture-owner' });
      const index = tokens.findIndex(token => auth === `Bot ${token}`);
      if (index >= 0) return json(identities[index]);
    }
    if (path === '/users/@me/guilds') return json([{ id: guildId, name: 'Offline fixture', owner: true }]);
    if (options.method === 'POST' && path.startsWith(`/guilds/${guildId}/`)) {
      writes.push({ auth, body: JSON.parse(options.body) });
      await onWrite(writes.length);
      return json({ id: `created-${writes.length}` });
    }
    if (path === `/guilds/${guildId}/roles`) return json([{ id: guildId, name: '@everyone', permissions: '0' }, { id: 'bot-role', name: 'Bot', permissions: '268435472' }]);
    if (path === `/guilds/${guildId}/channels`) return json([]);
    if (identities.some(identity => path === `/guilds/${guildId}/members/${identity.id}`)) return json({ roles: ['bot-role'] });
    throw new Error('Unexpected offline fixture route: ' + path);
  };
  const { url } = await fixture(t, mockDiscord);
  const auth = await signIn(url, 'fixture-owner');
  const request = async (path, data, acting = auth) => {
    const response = await fetch(`${url}${path}`, { headers: headers(acting), ...(data === undefined ? {} : { method: 'POST', body: JSON.stringify(data) }) });
    return { status: response.status, data: await response.json() };
  };
  const bots = [];
  for (const token of tokens) {
    const result = await request('/api/bots', { token });
    assert.equal(result.status, 201);
    bots.push(result.data.bot);
  }
  return { guildId, tokens, bots, writes, request, signIn: () => signIn(url, 'same-owner-another-session'), onWrite: callback => { onWrite = callback; } };
}

for (const mode of ['default', 'server']) {
  test(`changing the ${mode} bot invalidates an earlier preview before any Discord writes`, async t => {
    const f = await botSwitchScenario(t);
    const selectionPath = mode === 'default' ? '/api/bots/select' : `/api/guilds/${f.guildId}/bot`;
    assert.equal((await f.request(selectionPath, { id: f.bots[0].id })).status, 200);
    const preview = await f.request(`/api/guilds/${f.guildId}/preview`, { templateId: 'community' });
    assert.equal(preview.status, 200);
    const acting = mode === 'server' ? await f.signIn() : undefined;
    assert.equal((await f.request(selectionPath, { id: f.bots[1].id }, acting)).status, 200);
    const result = await f.request(`/api/guilds/${f.guildId}/apply`, { nonce: preview.data.nonce, confirm: `APPLY ${f.guildId}` });
    assert.equal(result.status, 409);
    assert.match(result.data.error, /bot.*changed|fresh preview/i);
    assert.equal(f.writes.length, 0);
  });
}

test('an in-flight apply never switches bot credentials between writes', async t => {
  const f = await botSwitchScenario(t);
  const selectionPath = `/api/guilds/${f.guildId}/bot`;
  assert.equal((await f.request(selectionPath, { id: f.bots[0].id })).status, 200);
  const preview = await f.request(`/api/guilds/${f.guildId}/preview`, { templateId: 'community' });
  assert.equal(preview.status, 200);
  f.onWrite(async count => {
    if (count === 1) assert.equal((await f.request(selectionPath, { id: f.bots[1].id })).status, 200);
  });
  const result = await f.request(`/api/guilds/${f.guildId}/apply`, { nonce: preview.data.nonce, confirm: `APPLY ${f.guildId}` });
  assert.equal(result.status, 200);
  assert.equal(result.data.error, undefined);
  assert.equal(f.writes.length, 7);
  assert.ok(f.writes.every(write => write.auth === `Bot ${f.tokens[0]}`));
});

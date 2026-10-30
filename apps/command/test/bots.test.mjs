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

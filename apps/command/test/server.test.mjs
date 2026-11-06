import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';

async function fixture(t, extra = {}, fetcher = async () => { throw new Error('No live Discord calls allowed in tests'); }) {
  const app = createApp({ env: { APP_ORIGIN: 'http://localhost:3000', ...extra }, dbPath: ':memory:', fetch: fetcher });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  t.after(() => app.close());
  return { ...app, url: `http://127.0.0.1:${app.server.address().port}` };
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const credentials = {
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_CLIENT_SECRET: 'private-client-secret',
  DISCORD_BOT_TOKEN: 'private-bot-token',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters'
};
async function signIn(url, code = 'test-code') {
  const start = await fetch(`${url}/auth/discord`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const initialCookie = start.headers.get('set-cookie').split(';')[0];
  const callback = await fetch(`${url}/auth/callback?state=${state}&code=${code}`, {
    redirect: 'manual', headers: { Cookie: initialCookie }
  });
  assert.equal(callback.status, 302);
  assert.equal(new URL(callback.headers.get('location'), url).pathname, '/command');
  const cookie = callback.headers.get('set-cookie').split(';')[0];
  const session = await fetch(`${url}/api/session`, { headers: { Cookie: cookie } });
  const data = await session.json();
  assert.ok(data.user);
  return { cookie, csrf: data.csrf };
}
test('unconfigured app serves UI and health but rejects login and protected requests', async t => {
  const { url } = await fixture(t);
  let response = await fetch(`${url}/api/health`);
  assert.deepEqual(await response.json(), { ok: true, configured: false });
  response = await fetch(url); assert.equal(response.status, 200);
  const homepage = await response.text();
  assert.match(homepage, /Bring order/);
  assert.match(homepage, /href="\/command"/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  response = await fetch(`${url}/home.css`); assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/css/);
  response = await fetch(`${url}/command`); assert.equal(response.status, 200);
  assert.match(await response.text(), /id="workspace"/);
  response = await fetch(`${url}/app.js`); assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  response = await fetch(`${url}/auth/discord`); assert.equal(response.status, 503);
  response = await fetch(`${url}/api/guilds`); assert.equal(response.status, 401);
  response = await fetch(`${url}/api/guilds/123456789012345678/apply`, { method: 'POST', body: '{}' }); assert.equal(response.status, 401);
  response = await fetch(`${url}/.env`); assert.notEqual(response.status, 200);
});
test('OAuth state is random, HttpOnly, and validated; secret is not exposed', async t => {
  const { url, db } = await fixture(t, credentials, async () => { throw new Error('Invalid OAuth state must stop before token exchange'); });
  const response = await fetch(`${url}/auth/discord`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location'));
  assert.equal(location.searchParams.get('scope'), 'identify guilds');
  assert.equal(location.searchParams.get('state').length, 64);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  const persisted = db.prepare('SELECT data FROM sessions').get().data;
  assert.ok(persisted);
  assert.doesNotMatch(persisted, /private-/);
  assert.doesNotMatch(persisted, /oauth/);
  const callback = await fetch(`${url}/auth/callback?state=invalid&code=x`, { headers: { Cookie: response.headers.get('set-cookie').split(';')[0] } });
  assert.equal(callback.status, 400);
  const session = await fetch(`${url}/api/session`);
  assert.ok(!(await session.text()).includes('private-'));
});
test('production requires HTTPS and a strong session secret', async t => {
  await assert.rejects(
    () => fixture(t, { NODE_ENV: 'production', APP_ORIGIN: 'http://insecure.example' }),
    /HTTPS/
  );
  await assert.rejects(
    () => fixture(t, { NODE_ENV: 'production', APP_ORIGIN: 'https://ok.example', SESSION_SECRET: 'short' }),
    /SESSION_SECRET/
  );
});
test('mocked Discord OAuth, CSRF, preview, apply and stale-plan rejection work end to end', async t => {
  const guildId = '123456789012345678';
  const botId = '222222222222222222';
  const botRoleId = '333333333333333333';
  const roles = [
    { id: guildId, name: '@everyone', permissions: '0', managed: false },
    { id: botRoleId, name: 'Chaotic Command', permissions: '268435472', managed: false }
  ];
  const channels = [];
  const writes = [];
  const mockDiscord = async (input, options = {}) => {
    const url = new URL(input);
    const method = options.method || 'GET';
    if (url.pathname === '/api/v10/oauth2/token' && method === 'POST') return json({ access_token: 'mock-user-token', expires_in: 3600 });
    if (url.pathname === '/api/v10/users/@me' && options.headers?.Authorization === 'Bearer mock-user-token') {
      return json({ id: '444444444444444444', username: 'test-user', global_name: 'Test User' });
    }
    if (url.pathname === '/api/v10/users/@me' && options.headers?.Authorization === `Bot ${credentials.DISCORD_BOT_TOKEN}`) {
      return json({ id: botId, username: 'chaotic-command' });
    }
    if (url.pathname === '/api/v10/users/@me/guilds') {
      return json([{ id: guildId, name: 'Disposable Test Server', owner: true, permissions: '0' }, { id: '555555555555555555', name: 'Unauthorized Server', owner: false, permissions: '0' }]);
    }
    if (url.pathname === `/api/v10/guilds/${guildId}/roles` && method === 'GET') return json(roles);
    if (url.pathname === `/api/v10/guilds/${guildId}/channels` && method === 'GET') return json(channels);
    if (url.pathname === `/api/v10/guilds/${guildId}/members/${botId}`) return json({ roles: [botRoleId] });
    if (url.pathname === `/api/v10/guilds/${guildId}/roles` && method === 'POST') {
      const body = JSON.parse(options.body);
      writes.push({ kind: 'role', body });
      const created = { id: `role-${writes.length}`, ...body, managed: false };
      roles.push(created);
      return json(created);
    }
    if (url.pathname === `/api/v10/guilds/${guildId}/channels` && method === 'POST') {
      const body = JSON.parse(options.body);
      writes.push({ kind: 'channel', body });
      const created = { id: `channel-${writes.length}`, ...body };
      channels.push(created);
      return json(created);
    }
    throw new Error(`Unexpected mocked Discord request: ${method} ${url.pathname}`);
  };
  const { url } = await fixture(t, credentials, mockDiscord);
  const { cookie, csrf } = await signIn(url);
  const headers = { Cookie: cookie, Origin: 'http://localhost:3000', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

  const guilds = await fetch(`${url}/api/guilds`, { headers: { Cookie: cookie } });
  assert.deepEqual((await guilds.json()).guilds, [{ id: guildId, name: 'Disposable Test Server' }]);
  let response = await fetch(`${url}/api/guilds/555555555555555555/notes`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 403, 'notes must be unavailable without Manage Server');
  response = await fetch(`${url}/api/guilds/555555555555555555/audit`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 403, 'audit must be unavailable without Manage Server');

  response = await fetch(`${url}/api/guilds/555555555555555555/preview`, {
    method: 'POST', headers, body: JSON.stringify({ templateId: 'community' })
  });
  assert.equal(response.status, 403, 'preview must be unavailable without Manage Server');

  response = await fetch(`${url}/api/guilds/${guildId}/preview`, {
    method: 'POST', headers: { ...headers, 'X-CSRF-Token': '' }, body: JSON.stringify({ templateId: 'community' })
  });
  assert.equal(response.status, 403);
  response = await fetch(`${url}/api/guilds/${guildId}/preview`, {
    method: 'POST', headers: { ...headers, Origin: 'https://attacker.example' }, body: JSON.stringify({ templateId: 'community' })
  });
  assert.equal(response.status, 403);

  response = await fetch(`${url}/api/guilds/${guildId}/status`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.match((await response.json()).inviteUrl, /permissions=268435472/);

  response = await fetch(`${url}/api/guilds/${guildId}/audit`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  const audit = await response.json();
  assert.equal(audit.summary.roleCount, 2);
  assert.equal(audit.summary.categoryCount, 0);

  response = await fetch(`${url}/api/guilds/${guildId}/preview`, {
    method: 'POST', headers, body: JSON.stringify({ templateId: 'community' })
  });
  assert.equal(response.status, 200);
  const preview = await response.json();
  assert.ok(preview.nonce);
  assert.ok(preview.expires > Date.now());
  assert.ok(Array.isArray(preview.creates));

  response = await fetch(`${url}/api/guilds/${guildId}/apply`, {
    method: 'POST', headers, body: JSON.stringify({ nonce: preview.nonce, confirm: 'APPLY ' + '999999999999999999' })
  });
  assert.equal(response.status, 409, 'apply must reject a mismatched confirmation');

  response = await fetch(`${url}/api/guilds/${guildId}/apply`, {
    method: 'POST', headers, body: JSON.stringify({ nonce: preview.nonce, confirm: `APPLY ${guildId}` })
  });
  assert.equal(response.status, 200);
  const applied = await response.json();
  assert.ok(writes.length >= applied.created.length, 'every created object is recorded in the audit log');

  response = await fetch(`${url}/api/guilds/${guildId}/apply`, {
    method: 'POST', headers, body: JSON.stringify({ nonce: preview.nonce, confirm: `APPLY ${guildId}` })
  });
  assert.equal(response.status, 409, 'a replayed preview must be rejected');

  response = await fetch(`${url}/api/guilds/${guildId}/preview`, {
    method: 'POST', headers, body: JSON.stringify({ templateId: 'community' })
  });
  const stale = await response.json();
  roles.push({ id: '999999999999999999', name: 'Drift', permissions: '0', managed: false });
  response = await fetch(`${url}/api/guilds/${guildId}/apply`, {
    method: 'POST', headers, body: JSON.stringify({ nonce: stale.nonce, confirm: `APPLY ${guildId}` })
  });
  assert.equal(response.status, 409, 'a plan made before structural drift must be rejected');
});
test('rate limited and failed Discord calls surface honest errors without leaking tokens', async t => {
  const guildId = '123456789012345678';
  let calls = 0;
  const mockDiscord = async (input, options = {}) => {
    const url = new URL(input);
    const method = options.method || 'GET';
    if (url.pathname === '/api/v10/oauth2/token' && method === 'POST') return json({ access_token: 'mock-user-token', expires_in: 3600 });
    if (url.pathname === '/api/v10/users/@me' && options.headers?.Authorization === 'Bearer mock-user-token') {
      return json({ id: '444444444444444444', username: 'test-user', global_name: 'Test User' });
    }
    if (url.pathname === '/api/v10/users/@me/guilds') {
      calls++;
      if (calls === 1) return json({ retry_after: 0.01 }, 429);
      if (calls === 2) return json({ message: 'Invalid OAuth2 access token' }, 401);
      return json([]);
    }
    throw new Error(`Unexpected mocked Discord request: ${method} ${url.pathname}`);
  };
  const { url } = await fixture(t, credentials, mockDiscord);
  const { cookie } = await signIn(url);
  const response = await fetch(`${url}/api/guilds`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.match(payload.error, /expired|invalid/i);
  assert.doesNotMatch(payload.error, /mock-user-token|private-/);
});
test('bot connection, selection and per-guild assignment stay scoped to the owner', async t => {
  const guildId = '123456789012345678';
  const mockDiscord = async (input, options = {}) => {
    const url = new URL(input);
    const method = options.method || 'GET';
    if (url.pathname === '/api/v10/oauth2/token' && method === 'POST') return json({ access_token: 'mock-user-token', expires_in: 3600 });
    if (url.pathname === '/api/v10/users/@me' && options.headers?.Authorization === 'Bearer mock-user-token') {
      return json({ id: '444444444444444444', username: 'test-user', global_name: 'Test User' });
    }
    if (url.pathname === '/api/v10/users/@me' && options.headers?.Authorization === 'Bot bad-token') return json({}, 401);
    if (url.pathname === '/api/v10/users/@me' && options.headers?.Authorization === 'Bot good-token') return json({ id: '222222222222222222', username: 'my-bot', bot: true });
    if (url.pathname === '/api/v10/users/@me/guilds') return json([{ id: guildId, name: 'Test Server', owner: true, permissions: '0' }]);
    if (url.pathname === `/api/v10/guilds/${guildId}/roles`) return json([{ id: guildId, name: '@everyone', permissions: '0', managed: false }]);
    if (url.pathname === `/api/v10/guilds/${guildId}/channels`) return json([]);
    if (url.pathname === `/api/v10/guilds/${guildId}/members/222222222222222222`) return json({ roles: [] });
    throw new Error(`Unexpected mocked Discord request: ${method} ${url.pathname}`);
  };
  const { url, db } = await fixture(t, credentials, mockDiscord);
  const { cookie, csrf } = await signIn(url);
  const headers = { Cookie: cookie, Origin: 'http://localhost:3000', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

  let response = await fetch(`${url}/api/bots`, { headers: { Cookie: cookie } });
  let data = await response.json();
  assert.deepEqual(data.bots, []);
  assert.equal(data.selectedBotId, '');

  response = await fetch(`${url}/api/bots`, { method: 'POST', headers, body: JSON.stringify({ token: 'bad-token' }) });
  assert.equal(response.status, 400);

  response = await fetch(`${url}/api/bots`, { method: 'POST', headers, body: JSON.stringify({ token: ' good-token ' }) });
  assert.equal(response.status, 201);
  data = await response.json();
  const botId = data.bot.id;
  assert.equal(data.selectedBotId, botId);
  assert.equal(data.bot.username, 'my-bot');
  assert.match(data.bot.inviteUrl, /client_id=222222222222222222/);

  response = await fetch(`${url}/api/bots`, { method: 'POST', headers, body: JSON.stringify({ token: 'good-token', extra: 1 }) });
  assert.equal(response.status, 400, 'extra fields are rejected');

  const stored = db.prepare('SELECT token_encrypted FROM user_bots WHERE id = ?').get(botId);
  assert.ok(stored);
  assert.doesNotMatch(stored.token_encrypted, /good-token/);

  response = await fetch(`${url}/api/bots/select`, { method: 'POST', headers, body: JSON.stringify({ id: null }) });
  assert.equal(response.status, 404, 'the shared bot is unavailable when no DISCORD_BOT_TOKEN is configured');

  response = await fetch(`${url}/api/guilds/${guildId}/bot`, { method: 'POST', headers, body: JSON.stringify({ id: botId }) });
  assert.equal(response.status, 200);
  response = await fetch(`${url}/api/guilds/${guildId}/bot`, { headers: { Cookie: cookie } });
  data = await response.json();
  assert.equal(data.selectedBotId, botId);
  assert.match(data.inviteUrl, /guild_id=/);

  response = await fetch(`${url}/api/bots/${botId}/delete`, { method: 'POST', headers });
  assert.equal(response.status, 200);
  response = await fetch(`${url}/api/bots`, { headers: { Cookie: cookie } });
  data = await response.json();
  assert.deepEqual(data.bots, []);
  assert.equal(data.selectedBotId, '', 'deleting the selected bot clears the selection');
});
test('notes, saved structures and structure limits are enforced per account', async t => {
  const guildId = '123456789012345678';
  const structure = { roles: [{ name: 'Member', color: null }], categories: [] };
  const mockDiscord = async (input, options = {}) => {
    const url = new URL(input);
    const method = options.method || 'GET';
    if (url.pathname === '/api/v10/oauth2/token' && method === 'POST') return json({ access_token: 'mock-user-token', expires_in: 3600 });
    if (url.pathname === '/api/v10/users/@me' && options.headers?.Authorization === 'Bearer mock-user-token') {
      return json({ id: '444444444444444444', username: 'test-user', global_name: 'Test User' });
    }
    if (url.pathname === '/api/v10/users/@me/guilds') return json([{ id: guildId, name: 'Test Server', owner: true, permissions: '0' }]);
    if (url.pathname === `/api/v10/guilds/${guildId}/roles`) return json([{ id: guildId, name: '@everyone', permissions: '0', managed: false }]);
    if (url.pathname === `/api/v10/guilds/${guildId}/channels`) return json([]);
    if (url.pathname === `/api/v10/guilds/${guildId}/members/222222222222222222`) return json({ roles: [] });
    throw new Error(`Unexpected mocked Discord request: ${method} ${url.pathname}`);
  };
  const { url } = await fixture(t, credentials, mockDiscord);
  const { cookie, csrf } = await signIn(url);
  const headers = { Cookie: cookie, Origin: 'http://localhost:3000', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

  let response = await fetch(`${url}/api/guilds/${guildId}/notes`, { method: 'POST', headers, body: JSON.stringify({ notes: 'Keep the welcome channel pinned.' }) });
  assert.equal(response.status, 200);
  response = await fetch(`${url}/api/guilds/${guildId}/notes`, { headers: { Cookie: cookie } });
  assert.equal((await response.json()).notes, 'Keep the welcome channel pinned.');

  response = await fetch(`${url}/api/structures`, { method: 'POST', headers, body: JSON.stringify({ name: 'Gaming layout', structure }) });
  assert.equal(response.status, 201);
  response = await fetch(`${url}/api/structures`, { method: 'POST', headers, body: JSON.stringify({ name: 'gaming LAYOUT', structure }) });
  assert.equal(response.status, 409, 'names are compared case-insensitively after Unicode normalization');

  response = await fetch(`${url}/api/structures`, { headers: { Cookie: cookie } });
  const list = await response.json();
  assert.equal(list.structures.length, 1);
  const savedId = list.structures[0].id;

  response = await fetch(`${url}/api/structures/${savedId}`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, structure);

  response = await fetch(`${url}/api/structures/${savedId}/rename`, { method: 'POST', headers, body: JSON.stringify({ name: 'Raid layout' }) });
  assert.equal(response.status, 200);

  response = await fetch(`${url}/api/structures/${savedId}/rename`, { method: 'POST', headers, body: JSON.stringify({ name: '' }) });
  assert.equal(response.status, 400);

  response = await fetch(`${url}/api/structures/${savedId}/delete`, { method: 'POST', headers });
  assert.equal(response.status, 200);

  response = await fetch(`${url}/api/structures/${savedId}`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 404);

  response = await fetch(`${url}/api/structures`, {
    method: 'POST', headers, body: JSON.stringify({ name: '   ', structure })
  });
  assert.equal(response.status, 400);

  for (let i = 0; i < 20; i++) {
    response = await fetch(`${url}/api/structures`, {
      method: 'POST', headers, body: JSON.stringify({ name: `Template ${i + 1}`, structure })
    });
    assert.equal(response.status, 201);
  }
  response = await fetch(`${url}/api/structures`, {
    method: 'POST', headers, body: JSON.stringify({ name: 'Template 21', structure })
  });
  assert.equal(response.status, 409, 'an account may save no more than 20 personal structures');
});
test('sessions about to expire refresh silently with the stored refresh token', async t => {
  const guildId = '123456789012345678';
  const mockDiscord = async (input, options = {}) => {
    const url = new URL(input);
    const method = options.method || 'GET';
    if (url.pathname === '/api/v10/oauth2/token' && method === 'POST') {
      const params = new URLSearchParams(options.body);
      if (params.get('grant_type') === 'authorization_code') return json({ access_token: 'short-token', expires_in: 1200, refresh_token: 'refresh-1' });
      if (params.get('grant_type') === 'refresh_token' && params.get('refresh_token') === 'refresh-1') return json({ access_token: 'fresh-token', expires_in: 604800, refresh_token: 'refresh-2' });
      return json({ error: 'invalid_grant' }, 400);
    }
    if (url.pathname === '/api/v10/users/@me' && options.headers?.Authorization === 'Bearer short-token') return json({ id: '444444444444444444', username: 'test-user', global_name: 'Test User' });
    if (url.pathname === '/api/v10/users/@me/guilds' && options.headers?.Authorization === 'Bearer fresh-token') return json([{ id: guildId, name: 'Test Server', owner: true, permissions: '0' }]);
    throw new Error(`Unexpected mocked Discord request: ${method} ${url.pathname}`);
  };
  const { url } = await fixture(t, credentials, mockDiscord);
  const { cookie } = await signIn(url);
  const session = await fetch(`${url}/api/session`, { headers: { Cookie: cookie } });
  assert.ok((await session.json()).user, 'a session inside the refresh window silently renews its token');
  const guilds = await fetch(`${url}/api/guilds`, { headers: { Cookie: cookie } });
  assert.equal(guilds.status, 200, 'API calls work with the refreshed token');
  assert.equal((await guilds.json()).guilds[0].id, guildId);
});

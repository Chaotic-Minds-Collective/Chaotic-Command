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
async function signIn(url) {
  const start = await fetch(`${url}/auth/discord`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const initialCookie = start.headers.get('set-cookie').split(';')[0];
  const callback = await fetch(`${url}/auth/callback?state=${state}&code=test-code`, {
    redirect: 'manual', headers: { Cookie: initialCookie }
  });
  assert.equal(callback.status, 302);
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
  assert.match(await response.text(), /Chaotic Command/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
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
  assert.ok(!persisted.includes(location.searchParams.get('state')));
  const callback = await fetch(`${url}/auth/callback?state=invalid&code=x`, { headers: { Cookie: response.headers.get('set-cookie').split(';')[0] } });
  assert.equal(callback.status, 400);
  const session = await fetch(`${url}/api/session`);
  assert.ok(!(await session.text()).includes('private-'));
});
test('production requires HTTPS and a strong session secret', () => {
  assert.throws(() => createApp({ env: { NODE_ENV: 'production' }, dbPath: ':memory:' }), /HTTPS/);
  assert.throws(() => createApp({ env: { NODE_ENV: 'production', APP_ORIGIN: 'https://example.com' }, dbPath: ':memory:' }), /SESSION_SECRET/);
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

  response = await fetch(`${url}/api/guilds/${guildId}/preview`, {
    method: 'POST', headers, body: JSON.stringify({ templateId: 'community' })
  });
  assert.equal(response.status, 200);
  const preview = await response.json();
  assert.equal(preview.steps.length, 7);
  assert.equal(writes.length, 0, 'preview must not write to Discord');

  response = await fetch(`${url}/api/guilds/${guildId}/apply`, {
    method: 'POST', headers, body: JSON.stringify({ nonce: preview.nonce, confirm: `APPLY ${guildId}` })
  });
  assert.equal(response.status, 200);
  const applied = await response.json();
  assert.equal(applied.completed.length, 7);
  assert.equal(writes.length, 7);
  assert.ok(writes.filter(w => w.kind === 'role').every(w => w.body.permissions === '0'));
  response = await fetch(`${url}/api/guilds/${guildId}/apply`, {
    method: 'POST', headers, body: JSON.stringify({ nonce: preview.nonce, confirm: `APPLY ${guildId}` })
  });
  assert.equal(response.status, 409, 'an applied preview must not be replayable');
  assert.equal(writes.length, 7, 'replay must not send additional Discord writes');

  const member = roles.find(role => role.name === 'Member');
  member.permissions = String(1n << 28n);
  response = await fetch(`${url}/api/guilds/${guildId}/preview`, {
    method: 'POST', headers, body: JSON.stringify({ templateId: 'community' })
  });
  assert.equal(response.status, 200);
  const privilegedPreview = await response.json();
  const memberStep = privilegedPreview.steps.find(step => step.name === 'Member');
  assert.equal(memberStep.elevatedPermissions, true);
  assert.deepEqual(memberStep.permissionFlags, ['Manage Roles']);

  member.permissions = '0';
  response = await fetch(`${url}/api/guilds/${guildId}/apply`, {
    method: 'POST', headers, body: JSON.stringify({ nonce: privilegedPreview.nonce, confirm: `APPLY ${guildId}` })
  });
  assert.equal(response.status, 409);
  assert.equal(writes.length, 7, 'stale preview must not send Discord writes');
});

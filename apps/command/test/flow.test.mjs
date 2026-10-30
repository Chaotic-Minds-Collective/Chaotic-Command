import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
const guild = '123456789012345678';
const origin = 'http://localhost:3000';
const env = { APP_ORIGIN: origin, DISCORD_CLIENT_ID: 'public-client-id', DISCORD_CLIENT_SECRET: 'client-secret', DISCORD_BOT_TOKEN: 'bot-secret', SESSION_SECRET: 'test-encryption-key-with-at-least-32-characters' };

async function setup(t) {
  const roles = [{ id: guild, name: '@everyone', permissions: '0' }, { id: 'bot-role', name: 'Bot', permissions: '268435472' }];
  const channels = [], writes = [];
  let allowed = true, botAllowed = true, failAt = -1;
  const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const app = createApp({ env, dbPath: ':memory:', fetch: async (url, options = {}) => {
    const path = new URL(url).pathname.replace('/api/v10', '');
    if (path === '/oauth2/token') return reply({ access_token: 'oauth-secret', expires_in: 3600 });
    if (path === '/users/@me') return reply({ id: 'user-id', username: 'Tester' });
    if (path === '/users/@me/guilds') return reply(allowed ? [{ id: guild, name: 'Test Server', permissions: '32' }] : []);
    if (!botAllowed) return reply({}, 403);
    if (path === `/guilds/${guild}/members/user-id`) return reply({ roles: ['bot-role'] });
    if (options.method === 'POST') {
      const data = JSON.parse(options.body);
      assert.equal(options.headers.Authorization, 'Bot bot-secret');
      assert.ok(options.headers['X-Audit-Log-Reason']);
      writes.push({ path, data });
      if (writes.length === failAt) return reply({}, 403);
      const object = { id: `object-${writes.length}`, ...data };
      (path.endsWith('/roles') ? roles : channels).push(object);
      return reply(object);
    }
    if (path.endsWith('/roles')) return reply(roles);
    if (path.endsWith('/channels')) return reply(channels);
    throw new Error(`Unexpected mock route: ${path}`);
  } });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const login = await fetch(`${base}/auth/discord`, { redirect: 'manual' });
  const oldCookie = login.headers.get('set-cookie').split(';')[0];
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  const callback = await fetch(`${base}/auth/callback?code=fixture&state=${state}`, { redirect: 'manual', headers: { Cookie: oldCookie } });
  assert.equal(callback.status, 302);
  const cookie = callback.headers.get('set-cookie').split(';')[0];
  assert.notEqual(cookie, oldCookie);
  const session = await (await fetch(`${base}/api/session`, { headers: { Cookie: cookie } })).json();
  assert.equal(session.user.username, 'Tester');
  assert.match(session.inviteBase, /client_id=public-client-id/);
  const request = async (path, body, headers = {}) => {
    const response = await fetch(`${base}${path}`, { headers: { Cookie: cookie, Origin: origin, 'X-CSRF-Token': session.csrf, ...headers }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  return { ...app, roles, channels, writes, request, oldCookie, base, setAllowed: value => { allowed = value; }, setBotAllowed: value => { botAllowed = value; }, failAt: value => { failAt = value; } };
}
const path = action => `/api/guilds/${guild}/${action}`;

test('full offline OAuth, notes, CSRF, preview, apply, replay prevention and logout', async t => {
  const f = await setup(t);
  assert.equal((await f.request('/api/guilds')).data.guilds.length, 1);
  assert.equal((await f.request(path('notes'), { notes: 'saved' }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.request(path('notes'), { notes: 'saved' }, { 'X-CSRF-Token': 'invalid' })).status, 403);
  assert.equal((await f.request(path('notes'), { notes: 'saved' })).status, 200);
  assert.equal((await f.request(path('notes'))).data.notes, 'saved');
  const state = await f.request(path('status'));
  assert.equal(state.status, 200);
  assert.equal(state.data.roles, 2);
  const preview = await f.request(path('preview'), { templateId: 'community' });
  assert.equal(preview.status, 200); assert.equal(f.writes.length, 0);
  assert.equal((await f.request(path('apply'), { nonce: preview.data.nonce, confirm: 'wrong' })).status, 409);
  const data = { nonce: preview.data.nonce, confirm: `APPLY ${guild}` };
  const result = await f.request(path('apply'), data);
  assert.equal(result.status, 200); assert.equal(result.data.error, undefined);
  assert.equal(result.data.completed.length, 7); assert.equal(f.writes.length, 7);
  assert.ok(f.writes.filter(w => w.path.endsWith('/roles')).every(w => w.data.permissions === '0'));
  assert.ok(f.writes.filter(w => w.data.type === 0).every(w => w.data.parent_id));
  assert.equal((await f.request(path('apply'), data)).status, 409);
  const repeat = await f.request(path('preview'), { templateId: 'community' });
  assert.ok(repeat.data.steps.every(step => step.existingId));
  const atRest = f.db.prepare('SELECT data FROM sessions').all().map(r => r.data).join('');
  assert.ok(!atRest.includes('oauth-secret'));
  const oldSession = await fetch(`${f.base}/api/guilds`, { headers: { Cookie: f.oldCookie } });
  assert.equal(oldSession.status, 401);
  assert.equal((await f.request('/api/logout', {})).status, 200);
  assert.equal((await f.request('/api/guilds')).status, 401);
});
test('authorization and bot permissions are rechecked; drift invalidates preview', async t => {
  const f = await setup(t);
  f.setAllowed(false); assert.equal((await f.request(path('notes'), { notes: 'saved' })).status, 403);
  f.setAllowed(true); f.setBotAllowed(false);
  assert.equal((await f.request(path('preview'), { templateId: 'community' })).status, 403);
  f.setBotAllowed(true);
  const preview = await f.request(path('preview'), { templateId: 'community' });
  f.roles.push({ name: 'Member', id: 'added-elsewhere', permissions: '0' });
  const result = await f.request(path('apply'), { nonce: preview.data.nonce, confirm: `APPLY ${guild}` });
  assert.equal(result.status, 409); assert.match(result.data.error, /structure changed/);
  assert.equal(f.writes.length, 0);
});
test('partial Discord failure reports completed objects and retry preview reuses them', async t => {
  const f = await setup(t);
  f.failAt(3);
  const preview = await f.request(path('preview'), { templateId: 'gaming' });
  const result = await f.request(path('apply'), { nonce: preview.data.nonce, confirm: `APPLY ${guild}` });
  assert.equal(result.data.completed.length, 2); assert.match(result.data.error, /denied access/);
  const repeat = await f.request(path('preview'), { templateId: 'gaming' });
  assert.equal(repeat.data.steps.filter(step => step.existingId).length, 2);
});

test('custom structure uses the same preview, drift check, confirmation and additive apply protections', async t => {
  const f = await setup(t);
  const structure = { roles: ['Member', 'Event Host'], categories: [{ name: 'Community', channels: ['welcome', 'general-chat'] }, { name: 'Events', channels: ['announcements'] }] };
  const preview = await f.request(path('preview'), { structure });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.templateId, null);
  assert.deepEqual(preview.data.structure, structure);
  assert.equal(preview.data.steps.length, 7);
  assert.equal(f.writes.length, 0, 'custom preview must not write to Discord');
  assert.equal((await f.request(path('preview'), { structure, templateId: 'community' })).status, 400);
  assert.equal((await f.request(path('preview'), { structure, extra: true })).status, 400);
  const result = await f.request(path('apply'), { nonce: preview.data.nonce, confirm: `APPLY ${guild}` });
  assert.equal(result.status, 200);
  assert.equal(result.data.completed.length, 7);
  assert.equal(f.writes.length, 7);
  assert.ok(f.writes.filter(write => write.path.endsWith('/roles')).every(write => write.data.permissions === '0'));
  assert.ok(f.writes.filter(write => write.path.endsWith('/channels')).every(write => write.data.type === 4 || write.data.parent_id));
  assert.equal((await f.request(path('apply'), { nonce: preview.data.nonce, confirm: `APPLY ${guild}` })).status, 409);
});


test('permission-overwrite drift rejects apply with no Discord writes', async t => {
  const f = await setup(t);
  f.channels.push({ id: 'category', name: 'Community', type: 4, permission_overwrites: [] });
  const preview = await f.request(path('preview'), { templateId: 'community' });
  assert.equal(preview.status, 200);
  f.channels[0].permission_overwrites = [{ id: guild, type: 0, allow: '1024', deny: '0' }];
  const result = await f.request(path('apply'), { nonce: preview.data.nonce, confirm: `APPLY ${guild}` });
  assert.equal(result.status, 409);
  assert.match(result.data.error, /structure changed/);
  assert.equal(f.writes.length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';

async function fixture(t, extra = {}) {
  const app = createApp({ env: { APP_ORIGIN: 'http://localhost:3000', ...extra }, dbPath: ':memory:', fetch: async () => { throw new Error('No live Discord calls allowed in tests'); } });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  t.after(() => app.close());
  return { ...app, url: `http://127.0.0.1:${app.server.address().port}` };
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
  const { url, db } = await fixture(t, { DISCORD_CLIENT_ID: '123', DISCORD_CLIENT_SECRET: 'private-client-secret', DISCORD_BOT_TOKEN: 'private-bot-token', SESSION_SECRET: 'test-session-secret-at-least-32-characters' });
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

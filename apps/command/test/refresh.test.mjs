import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';

async function fixture(t, fetcher) {
  const app = createApp({
    env: {
      APP_ORIGIN: 'http://localhost:3000',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_CLIENT_SECRET: 'private-client-secret',
      DISCORD_BOT_TOKEN: 'private-bot-token',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters'
    },
    dbPath: ':memory:', fetch: fetcher
  });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  t.after(() => app.close());
  return `http://127.0.0.1:${app.server.address().port}`;
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

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
  const url = await fixture(t, mockDiscord);
  const start = await fetch(`${url}/auth/discord`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const initialCookie = start.headers.get('set-cookie').split(';')[0];
  const callback = await fetch(`${url}/auth/callback?state=${state}&code=test-code`, { redirect: 'manual', headers: { Cookie: initialCookie } });
  assert.equal(callback.status, 302);
  const cookie = callback.headers.get('set-cookie').split(';')[0];
  const session = await fetch(`${url}/api/session`, { headers: { Cookie: cookie } });
  assert.ok((await session.json()).user, 'a session inside the refresh window silently renews its token');
  const guilds = await fetch(`${url}/api/guilds`, { headers: { Cookie: cookie } });
  assert.equal(guilds.status, 200, 'API calls work with the refreshed token');
  assert.equal((await guilds.json()).guilds[0].id, guildId);
});

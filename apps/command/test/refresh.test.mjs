import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';

async function fixture(t, fetcher, config = {}) {
  const app = createApp({
    env: {
      APP_ORIGIN: 'http://localhost:3000',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_CLIENT_SECRET: 'private-client-secret',
      DISCORD_BOT_TOKEN: 'private-bot-token',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters'
    },
    ...config, dbPath: ':memory:', fetch: fetcher
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
  assert.match(session.headers.get('set-cookie'), /Max-Age=2592000(?:;|$)/);
  assert.ok((await session.json()).user, 'a session inside the refresh window silently renews its token');
  const guilds = await fetch(`${url}/api/guilds`, { headers: { Cookie: cookie } });
  assert.equal(guilds.status, 200, 'API calls work with the refreshed token');
  assert.equal((await guilds.json()).guilds[0].id, guildId);
});

async function signIn(t, refresh, config = {}) {
  const url = await fixture(t, async (input, options = {}) => {
    const path = new URL(input).pathname;
    if (path.endsWith('/oauth2/token')) {
      if (options.body.get('grant_type') === 'refresh_token') return refresh(options.body.get('refresh_token'));
      return json({ access_token: 'short-token', expires_in: 1200, refresh_token: 'refresh-1' });
    }
    if (path.endsWith('/users/@me')) return json({ id: '444444444444444444', username: 'test-user' });
    if (path.endsWith('/users/@me/guilds')) {
      assert.equal(options.headers.Authorization, 'Bearer short-token');
      return json([]);
    }
    throw new Error(`Unexpected path: ${path}`);
  }, config);
  const start = await fetch(`${url}/auth/discord`, { redirect: 'manual' });
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const callback = await fetch(`${url}/auth/callback?state=${state}&code=test-code`, {
    redirect: 'manual', headers: { Cookie: start.headers.get('set-cookie').split(';')[0] }
  });
  assert.equal(callback.status, 302);
  const headers = { Cookie: callback.headers.get('set-cookie').split(';')[0] };
  return { url, headers, request: path => fetch(`${url}${path}`, { headers }) };
}

test('invalid_grant stops retries without discarding the valid access token', async t => {
  let attempts = 0;
  const f = await signIn(t, () => { attempts++; return json({ error: 'invalid_grant' }, 400); });
  assert.ok((await (await f.request('/api/session')).json()).user);
  assert.equal((await f.request('/api/guilds')).status, 200);
  assert.equal(attempts, 1);
});

for (const failure of ['network', 'server', 'malformed', 'other']) {
  test(`refresh retains credentials after ${failure} failure`, async t => {
    let attempts = 0;
    const f = await signIn(t, () => {
      attempts++;
      if (failure === 'network') throw new Error('offline');
      if (failure === 'malformed') return new Response('not json', { status: 400 });
      return json({ error: failure === 'server' ? 'invalid_grant' : 'invalid_client' }, failure === 'server' ? 503 : 400);
    });
    for (let i = 0; i < 2; i++) assert.ok((await (await f.request('/api/session')).json()).user);
    assert.equal(attempts, 1);
    const now = Date.now;
    t.mock.method(Date, 'now', () => now() + 31000);
    assert.ok((await (await f.request('/api/session')).json()).user);
    assert.equal(attempts, 2, 'refresh retries after the cooldown');
  });
}

test('public assets and health do not attempt refresh', async t => {
  let attempts = 0;
  const f = await signIn(t, () => { attempts++; throw new Error('public routes must not refresh'); });
  for (const path of ['/', '/home.css', '/command', '/app.js', '/style.css', '/api/health']) {
    assert.equal((await f.request(path)).status, 200);
  }
  assert.equal(attempts, 0);
});

test('concurrent requests share a refresh and use the rotated token next time', async t => {
  const joined = Promise.withResolvers();
  const started = Promise.withResolvers(), delayed = Promise.withResolvers();
  const tokens = [];
  const f = await signIn(t, token => {
    tokens.push(token);
    if (tokens.length === 1) { started.resolve(); return delayed.promise; }
    return json({ access_token: 'short-token', expires_in: 1200, refresh_token: 'refresh-3' });
  }, { onRefreshWait: () => joined.resolve() });
  const pending = f.request('/api/session');
  await started.promise;
  const concurrent = f.request('/api/session');
  await joined.promise;
  assert.equal(tokens.length, 1);
  delayed.resolve(json({ access_token: 'short-token', expires_in: 1200, refresh_token: 'refresh-2' }));
  assert.ok((await (await pending).json()).user);
  assert.ok((await (await concurrent).json()).user);
  assert.equal((await f.request('/api/guilds')).status, 200);
  assert.deepEqual(tokens, ['refresh-1', 'refresh-2']);
});

test('an in-flight refresh cannot restore a logged-out session', async t => {
  const started = Promise.withResolvers(), delayed = Promise.withResolvers();
  let attempts = 0;
  const f = await signIn(t, () => {
    attempts++;
    if (attempts === 2) { started.resolve(); return delayed.promise; }
    return json({ access_token: 'short-token', expires_in: 1200, refresh_token: 'refresh-1' });
  });
  const csrf = (await (await f.request('/api/session')).json()).csrf;
  const pending = f.request('/api/session');
  await started.promise;
  const logout = await fetch(`${f.url}/api/logout`, { method: 'POST', headers: { ...f.headers, Origin: 'http://localhost:3000', 'x-csrf-token': csrf } });
  assert.equal(logout.status, 200);
  delayed.resolve(json({ access_token: 'fresh-token', expires_in: 604800, refresh_token: 'refresh-2' }));
  const refreshed = await pending;
  assert.equal(refreshed.headers.get('set-cookie'), null, 'logout is not followed by a renewed cookie');
  assert.equal((await refreshed.json()).user, null);
  assert.equal((await (await f.request('/api/session')).json()).user, null);
  assert.equal(attempts, 2);
});

test('sign-in bypasses a pending refresh and logout still requires CSRF', async t => {
  const started = Promise.withResolvers(), delayed = Promise.withResolvers();
  const f = await signIn(t, () => { started.resolve(); return delayed.promise; });
  const pending = f.request('/api/session');
  await started.promise;
  try {
    assert.equal((await fetch(`${f.url}/auth/discord`, { redirect: 'manual', headers: f.headers })).status, 302);
    assert.equal((await fetch(`${f.url}/api/logout`, { method: 'POST', headers: { ...f.headers, Origin: 'http://localhost:3000' } })).status, 403);
  } finally {
    delayed.resolve(json({ error: 'temporary' }, 503));
    await pending;
  }
});

for (const concurrentAction of ['refresh', 'logout', 'sign-in', 'expiry']) {
  test(`a delayed bot connection preserves a concurrent ${concurrentAction}`, { timeout: 10000 }, async t => {
    const started = Promise.withResolvers(), delayed = Promise.withResolvers();
    const now = Date.now();
    let tokenUsed;
    const url = await fixture(t, async (input, options = {}) => {
      const path = new URL(input).pathname;
      if (path.endsWith('/oauth2/token')) {
        return options.body.get('grant_type') === 'refresh_token'
          ? json({ access_token: 'fresh-token', expires_in: 60 * 86400, refresh_token: 'refresh-2' })
          : json({ access_token: 'initial-token', expires_in: 3600, refresh_token: 'refresh-1' });
      }
      if (path.endsWith('/users/@me')) {
        if (options.headers.Authorization.startsWith('Bot ')) {
          started.resolve();
          await delayed.promise;
          return json({ id: '555555555555555555', username: 'test-bot', bot: true });
        }
        return json({ id: '444444444444444444', username: 'test-user' });
      }
      if (path.endsWith('/users/@me/guilds')) {
        tokenUsed = options.headers.Authorization;
        return json([]);
      }
      throw new Error(`Unexpected path: ${path}`);
    });
    const login = async headers => {
      const start = await fetch(`${url}/auth/discord`, { redirect: 'manual', headers });
      const state = new URL(start.headers.get('location')).searchParams.get('state');
      return fetch(`${url}/auth/callback?state=${state}&code=test`, {
        redirect: 'manual', headers: { Cookie: start.headers.get('set-cookie').split(';')[0] }
      });
    };
    const callback = await login();
    const headers = { Cookie: callback.headers.get('set-cookie').split(';')[0] };
    const csrf = (await (await fetch(`${url}/api/session`, { headers })).json()).csrf;
    const pending = fetch(`${url}/api/bots`, { method: 'POST', headers: { ...headers, Origin: 'http://localhost:3000', 'x-csrf-token': csrf }, body: JSON.stringify({ token: 'synthetic-bot-token-long-enough' }) });
    await started.promise;
    try {
      if (concurrentAction === 'refresh') {
        t.mock.method(Date, 'now', () => now + 31 * 60000);
        assert.equal((await fetch(`${url}/api/session`, { headers })).status, 200);
      } else if (concurrentAction === 'logout') {
        assert.equal((await fetch(`${url}/api/logout`, { method: 'POST', headers: { ...headers, Origin: 'http://localhost:3000', 'x-csrf-token': csrf } })).status, 200);
      } else if (concurrentAction === 'expiry') {
        t.mock.method(Date, 'now', () => now + 30 * 86400000 + 60000);
      } else {
        assert.equal((await login(headers)).status, 302);
      }
    } finally { delayed.resolve(); }
    const result = await pending;
    assert.equal(result.status, concurrentAction === 'refresh' ? 201 : 401);
    if (concurrentAction === 'refresh') {
      const selected = (await result.json()).selectedBotId;
      assert.equal((await (await fetch(`${url}/api/bots`, { headers })).json()).selectedBotId, selected);
      assert.equal((await fetch(`${url}/api/guilds`, { headers })).status, 200);
      assert.equal(tokenUsed, 'Bearer fresh-token');
      t.mock.method(Date, 'now', () => now + 30 * 86400000 + 15 * 60000);
      assert.ok((await (await fetch(`${url}/api/session`, { headers })).json()).user, 'the renewed stored expiry survives the bot write');
    } else {
      assert.equal((await (await fetch(`${url}/api/session`, { headers })).json()).user, null);
      const newLogin = await login();
      assert.equal(newLogin.status, 302);
      const newHeaders = { Cookie: newLogin.headers.get('set-cookie').split(';')[0] };
      const bots = await fetch(`${url}/api/bots`, { headers: newHeaders });
      assert.equal(bots.status, 200);
      assert.deepEqual((await bots.json()).bots, [], 'a failed connection must not leave a stored bot');
      const newCsrf = (await (await fetch(`${url}/api/session`, { headers: newHeaders })).json()).csrf;
      const retry = await fetch(`${url}/api/bots`, { method: 'POST', headers: { ...newHeaders, Origin: 'http://localhost:3000', 'x-csrf-token': newCsrf }, body: JSON.stringify({ token: 'synthetic-bot-token-long-enough' }) });
      assert.equal(retry.status, 201, 'the same bot can be connected after signing in again');
    }
  });
}


test('a delayed refresh does not replace the cookie from a newer sign-in', { timeout: 10000 }, async t => {
  const started = Promise.withResolvers(), delayed = Promise.withResolvers();
  const f = await signIn(t, () => { started.resolve(); return delayed.promise; });
  const pending = f.request('/api/session');
  await started.promise;
  try {
    const start = await fetch(`${f.url}/auth/discord`, { redirect: 'manual', headers: f.headers });
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const callback = await fetch(`${f.url}/auth/callback?state=${state}&code=new-sign-in`, { redirect: 'manual', headers: f.headers });
    assert.equal(callback.status, 302);
    assert.notEqual(callback.headers.get('set-cookie').split(';')[0], f.headers.Cookie);
  } finally {
    delayed.resolve(json({ access_token: 'fresh-token', expires_in: 604800, refresh_token: 'refresh-2' }));
  }
  const response = await pending;
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal((await response.json()).user, null);
});

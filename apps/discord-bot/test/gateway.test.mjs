import test from 'node:test';
import assert from 'node:assert/strict';

const initialUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
const resumeUrl = initialUrl;
let fixtureId = 0;

async function fixture(t) {
  const previous = {
    token: process.env.DISCORD_BOT_TOKEN,
    applicationId: process.env.DISCORD_APPLICATION_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    healthPort: process.env.BOT_HEALTH_PORT,
    WebSocket: globalThis.WebSocket,
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    sigterm: process.listeners('SIGTERM'),
    sigint: process.listeners('SIGINT'),
  };
  const sockets = [];
  const timeouts = new Map();
  const intervals = new Map();
  let timerId = 0;

  class FakeSocket {
    static OPEN = 1;
    readyState = FakeSocket.OPEN;
    listeners = {};
    sent = [];
    constructor(url) { this.url = url; sockets.push(this); }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    send(data) { this.sent.push(JSON.parse(data)); }
    message(data) { this.listeners.message({ data: JSON.stringify(data) }); }
    close(code, reason) { this.serverClose(code, reason); }
    serverClose(code, reason = '') {
      this.readyState = 3;
      this.listeners.close({ code, reason });
    }
  }

  process.env.DISCORD_BOT_TOKEN = 'test-token';
  delete process.env.DISCORD_APPLICATION_ID;
  delete process.env.DISCORD_GUILD_ID;
  delete process.env.BOT_HEALTH_PORT;
  globalThis.WebSocket = FakeSocket;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 'bot', username: 'test' }));
  globalThis.setTimeout = callback => { const id = ++timerId; timeouts.set(id, callback); return id; };
  globalThis.clearTimeout = id => timeouts.delete(id);
  globalThis.setInterval = callback => { const id = ++timerId; intervals.set(id, callback); return id; };
  globalThis.clearInterval = id => intervals.delete(id);

  t.after(() => {
    for (const [name, value] of Object.entries({ DISCORD_BOT_TOKEN: previous.token, DISCORD_APPLICATION_ID: previous.applicationId, DISCORD_GUILD_ID: previous.guildId, BOT_HEALTH_PORT: previous.healthPort })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    for (const name of ['WebSocket', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']) globalThis[name] = previous[name];
    for (const [signal, oldListeners] of [['SIGTERM', previous.sigterm], ['SIGINT', previous.sigint]]) {
      for (const listener of process.listeners(signal)) if (!oldListeners.includes(listener)) process.removeListener(signal, listener);
    }
  });

  await import(`../index.mjs?fixture=${++fixtureId}`);
  const first = sockets[0];
  assert.equal(first.url, initialUrl);
  first.message({ op: 10, d: { heartbeat_interval: 45000 } });
  assert.equal(first.sent[0].op, 2);
  first.message({ op: 0, t: 'READY', s: 42, d: { session_id: 'session', resume_gateway_url: 'wss://gateway.discord.gg' } });

  return {
    first,
    reconnect() {
      assert.equal(timeouts.size, 1);
      timeouts.values().next().value();
      assert.equal(sockets.length, 2);
      return sockets[1];
    },
    heartbeat() {
      assert.equal(intervals.size, 1);
      intervals.values().next().value();
    },
    expireHeartbeatAck() {
      assert.equal(timeouts.size, 1);
      timeouts.values().next().value();
    },
  };
}

for (const code of [4007, 4009]) {
  test(`Gateway close ${code} discards the session before reconnecting`, async t => {
    const { first, reconnect, heartbeat } = await fixture(t);
    first.serverClose(code);
    const next = reconnect();
    assert.equal(next.url, initialUrl);
    next.message({ op: 10, d: { heartbeat_interval: 45000 } });
    assert.equal(next.sent[0].op, 2);
    heartbeat();
    assert.deepEqual(next.sent[1], { op: 1, d: null });
  });
}

test('non-resumable Invalid Session reconnects to the initial Gateway and identifies', async t => {
  const { first, reconnect, heartbeat } = await fixture(t);
  first.message({ op: 9, d: false });
  const next = reconnect();
  assert.equal(next.url, initialUrl);
  next.message({ op: 10, d: { heartbeat_interval: 45000 } });
  assert.equal(next.sent[0].op, 2);
  heartbeat();
  assert.deepEqual(next.sent[1], { op: 1, d: null });
});

test('resumable Invalid Session reconnects before resuming on Hello', async t => {
  const { first, reconnect } = await fixture(t);
  first.message({ op: 9, d: true });
  assert.deepEqual(first.sent.map(message => message.op), [2]);
  const next = reconnect();
  assert.equal(next.url, resumeUrl);
  assert.deepEqual(next.sent, []);
  next.message({ op: 10, d: { heartbeat_interval: 45000 } });
  assert.deepEqual(next.sent, [{ op: 6, d: { token: 'test-token', session_id: 'session', seq: 42 } }]);
});

test('heartbeat ACK clears its watchdog, while a missed ACK reconnects and resumes', async t => {
  const { first, heartbeat, expireHeartbeatAck, reconnect } = await fixture(t);
  heartbeat();
  assert.deepEqual(first.sent[1], { op: 1, d: 42 });
  first.message({ op: 11, d: null });
  heartbeat();
  assert.deepEqual(first.sent[2], { op: 1, d: 42 });
  expireHeartbeatAck();
  const next = reconnect();
  next.message({ op: 10, d: { heartbeat_interval: 45000 } });
  assert.deepEqual(next.sent, [{ op: 6, d: { token: 'test-token', session_id: 'session', seq: 42 } }]);
});

test('other Gateway closes preserve the session for resume', async t => {
  const { first, reconnect } = await fixture(t);
  first.serverClose(4000);
  const next = reconnect();
  assert.equal(next.url, resumeUrl);
  next.message({ op: 10, d: { heartbeat_interval: 45000 } });
  assert.deepEqual(next.sent, [{ op: 6, d: { token: 'test-token', session_id: 'session', seq: 42 } }]);
});

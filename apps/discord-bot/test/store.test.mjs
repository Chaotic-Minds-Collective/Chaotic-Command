import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createStore } from '../src/store.js';

test('all storage operations reject redirects while preserving requests', async () => {
  const calls = [];
  const store = createStore({ SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_KEY: 'test-key' }, async (url, init) => {
    calls.push({ url, ...init });
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.apikey, 'test-key');
    assert.equal(init.headers.Authorization, 'Bearer test-key');
    return Response.json([]);
  });
  await store.getConfig('1');
  await store.saveConfig('1', { enabled: true });
  await store.createTicket({ id: '2' });
  await store.deleteTicket('2');
  await store.getTicket('2');
  await store.updateTicket('2', { closed: true });
  await store.countTickets('1');
  await store.savePending('3', { content: 'draft' });
  await store.getPending('3');
  await store.deletePending('3');
  assert.deepEqual([...new Set(calls.map(({ method }) => method))].sort(), ['DELETE', 'GET', 'PATCH', 'POST']);
  assert.equal(calls[1].body, JSON.stringify({ guild_id: '1', config: { enabled: true } }));
});

test('a redirect response fails without sending credentials to its target', async (t) => {
  let targetRequests = 0;
  const server = createServer((req, res) => {
    if (req.url === '/target') {
      targetRequests++;
      res.end('[]');
    } else {
      res.writeHead(302, { Location: '/target' });
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const store = createStore({
    SUPABASE_URL: `http://127.0.0.1:${server.address().port}`,
    SUPABASE_SERVICE_KEY: 'synthetic-test-key',
  });
  await assert.rejects(store.getConfig('1'), TypeError);
  assert.equal(targetRequests, 0);
});

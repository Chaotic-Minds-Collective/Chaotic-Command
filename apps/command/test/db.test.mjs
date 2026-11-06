import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDb } from '../db/index.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'command-db-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('SQLite serializes concurrent startup and repeated migrations', async t => {
  const dir = await fixture(t);
  const databases = await Promise.all(Array.from({ length: 8 }, () => openDb({ env: {}, dbPath: join(dir, 'db.sqlite') })));
  t.after(() => Promise.all(databases.map(db => db.close())));
  await Promise.all(databases.map(db => db.migrate()));
  assert.equal((await databases[0].query('SELECT name FROM schema_migrations')).length, 1);
  await databases[0].prepare('INSERT INTO notes VALUES (?, ?)').run('guild', 'persisted');
  assert.equal((await databases[1].prepare('SELECT value FROM notes WHERE guild = ?').get('guild')).value, 'persisted');
});

test('SQLite rolls back base schema, earlier files, and a partial failing file', async t => {
  const dir = await fixture(t);
  await cp(new URL('../db/', import.meta.url), join(dir, 'db'), { recursive: true });
  await writeFile(join(dir, 'db/migrations/999_failure.sql'), 'CREATE TABLE partial (id TEXT); INVALID SQL;');
  const isolated = await import(pathToFileURL(join(dir, 'db/index.mjs')));
  const filename = join(dir, 'failure.sqlite');
  await assert.rejects(isolated.openDb({ env: {}, dbPath: filename }), /syntax error/);
  const raw = new DatabaseSync(filename);
  assert.deepEqual(raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all(), []);
  raw.close();
});

test('Postgres TLS configuration, transaction client, rollback and failure cleanup', async () => {
  let config, calls, ended, released, failure, failClose;
  const original = new Error('migration failed');
  globalThis.__dbTestPg = {
    Client: pg.Client,
    Pool: class {
      constructor(options) { config = options; calls = []; ended = released = false; }
      async connect() {
        return {
          async query(sql) {
            calls.push(sql);
            if (failure && sql.startsWith('CREATE TABLE')) throw original;
            return { rows: [] };
          },
          release() { released = true; }
        };
      }
      async query() { throw new Error('Migration escaped dedicated client'); }
      async end() { ended = true; if (failClose) throw new Error('close failed'); }
    }
  };
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'pg') return { url: 'data:text/javascript,export default globalThis.__dbTestPg', shortCircuit: true };
      return next(specifier, context);
    }
  });
  try {
    for (const [url, ca, expected] of [
      ['postgres://user:localhost@remote.invalid/db', undefined, { rejectUnauthorized: true }],
      ['postgres://remote.invalid/localhost', undefined, { rejectUnauthorized: true }],
      ['postgres://localhost/db', undefined, false],
      ['postgres://127.0.0.1/db', undefined, false],
      ['postgres://[::1]/db', undefined, false],
      ['postgres://remote.invalid/db?sslmode=disable', 'fixture-ca', false],
      ['postgres://remote.invalid/db?sslmode=verify-full', 'fixture-ca', { ca: 'fixture-ca' }],
      ['postgres://remote.invalid/db', 'fixture-ca', { rejectUnauthorized: true, ca: 'fixture-ca' }]
    ]) {
      const db = await openDb({ env: { DATABASE_URL: url, DATABASE_SSL_CA: ca } });
      assert.deepEqual(config.ssl, expected);
      assert.equal(config.connectionString, undefined);
      assert.equal(calls[0], 'BEGIN');
      assert.match(calls[1], /pg_advisory_xact_lock/);
      assert.ok(calls.findIndex(sql => sql.startsWith('SELECT name')) > 1);
      assert.ok(calls.some(sql => sql.startsWith('INSERT INTO schema_migrations')));
      assert.equal(calls.at(-1), 'COMMIT');
      assert.equal(released, true);
      await db.close();
      assert.equal(ended, true);
    }
    failure = failClose = true;
    await assert.rejects(openDb({ env: { DATABASE_URL: 'postgres://localhost/db' } }), error => error === original);
    assert.equal(calls.at(-1), 'ROLLBACK');
    assert.equal(released, true);
    assert.equal(ended, true);
  } finally {
    hooks.deregister();
    delete globalThis.__dbTestPg;
  }
});

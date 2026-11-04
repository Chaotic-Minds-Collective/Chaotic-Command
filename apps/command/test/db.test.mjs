import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { openDb } from '../db/index.mjs';

const migrationName = '001_community_schema.sql';
const communityTables = [
  'users', 'discord_servers', 'moderation_cases', 'warnings', 'tickets',
  'ticket_messages', 'ticket_transcripts', 'appeals', 'ban_approval_requests',
  'staff_actions', 'audit_events'
];

async function memoryDb(t) {
  const db = await openDb({ env: {}, dbPath: ':memory:' });
  t.after(() => db.close());
  return db;
}

test('SQLite adapter exposes asynchronous prepared statements, query and exec', async t => {
  const db = await memoryDb(t);
  assert.equal(db.kind, 'sqlite');
  assert.equal(db.filename, ':memory:');
  await db.exec('CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
  const insert = db.prepare('INSERT INTO sample (value) VALUES (?)');
  const hostileValue = "value'); DROP TABLE sample; --";
  const inserted = await insert.run(hostileValue);
  assert.equal(inserted.changes, 1);
  assert.equal(inserted.lastInsertRowid, 1);
  await insert.run('second');
  const get = db.prepare('SELECT value FROM sample WHERE id = ?');
  assert.equal((await get.get(1)).value, hostileValue);
  assert.equal(await get.get(99), undefined);
  assert.deepEqual((await db.prepare('SELECT value FROM sample ORDER BY id').all()).map(row => row.value), [hostileValue, 'second']);
  assert.deepEqual((await db.query('SELECT value FROM sample WHERE id > ? ORDER BY id', [1])).map(row => row.value), ['second']);
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM sample'))[0].count, 2);
  assert.equal((await db.prepare('UPDATE sample SET value = ? WHERE id = ?').run('none', 99)).changes, 0);
  await assert.rejects(insert.run(null), /NOT NULL/);
});

test('SQLite startup creates the community schema and migrations run only once', async t => {
  const before = Date.now();
  const db = await memoryDb(t);
  const after = Date.now();
  const names = (await db.query("SELECT name FROM sqlite_master WHERE type = 'table'")).map(row => row.name);
  for (const name of [...communityTables, 'sessions', 'notes', 'saved_structures', 'user_bots', 'guild_bot_selections', 'schema_migrations']) {
    assert.ok(names.includes(name), `missing table ${name}`);
  }
  const migrations = await db.query('SELECT name, applied_at FROM schema_migrations ORDER BY name');
  const communityMigration = migrations.filter(row => row.name === migrationName);
  assert.equal(communityMigration.length, 1);
  assert.ok(communityMigration[0].applied_at >= before && communityMigration[0].applied_at <= after);
  const indexes = (await db.query("SELECT name FROM sqlite_master WHERE type = 'index'")).map(row => row.name);
  for (const name of ['warnings_user', 'ticket_messages_ticket', 'audit_events_guild', 'audit_events_case']) {
    assert.ok(indexes.includes(name), `missing index ${name}`);
  }

  await db.prepare('INSERT INTO discord_servers (id, guild_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('s1', 'g1', 'Server', 1, 1);
  assert.equal((await db.prepare('SELECT settings_json FROM discord_servers WHERE id = ?').get('s1')).settings_json, '{}');
  await assert.rejects(db.prepare('INSERT INTO discord_servers (id, guild_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('s2', 'g1', 'Duplicate', 1, 1), /UNIQUE/);
  await db.prepare('INSERT INTO moderation_cases (id, guild_id, case_number, target_user_id, moderator_user_id, action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('c1', 'g1', 1, 'u1', 'm1', 'warn', 1, 1);
  assert.equal((await db.prepare('SELECT status FROM moderation_cases WHERE id = ?').get('c1')).status, 'open');
  await assert.rejects(db.prepare('INSERT INTO moderation_cases (id, guild_id, case_number, target_user_id, moderator_user_id, action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('c2', 'g1', 1, 'u2', 'm1', 'warn', 1, 1), /UNIQUE/);

  // If the migration ran again, its CREATE INDEX IF NOT EXISTS would restore this index.
  await db.exec('DROP INDEX warnings_user');
  await db.migrate();
  assert.deepEqual(await db.query("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'warnings_user'"), []);
  assert.deepEqual((await db.query('SELECT name, applied_at FROM schema_migrations ORDER BY name')).map(row => [row.name, row.applied_at]), migrations.map(row => [row.name, row.applied_at]));
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM discord_servers'))[0].count, 1);
});

test('SQLite replacement keys and case-insensitive structure names enforce their boundaries', async t => {
  const db = await memoryDb(t);
  const replace = db.prepare('INSERT OR REPLACE INTO guild_bot_selections VALUES (?, ?, ?)');
  await replace.run('owner', 'guild', 'first');
  await replace.run('owner', 'guild', 'second');
  await replace.run('other', 'guild', 'third');
  const selections = await db.query('SELECT owner_id, bot_id FROM guild_bot_selections ORDER BY owner_id');
  assert.deepEqual(selections.map(row => [row.owner_id, row.bot_id]), [['other', 'third'], ['owner', 'second']]);

  const structure = db.prepare('INSERT INTO saved_structures VALUES (?, ?, ?, ?, ?, ?)');
  await structure.run('s1', 'owner', 'Example', '{}', 1, 1);
  await assert.rejects(structure.run('s2', 'owner', 'example', '{}', 1, 1), /UNIQUE/);
  await structure.run('s3', 'other', 'example', '{}', 1, 1);
});

test('SQLite chooses DATA_DIR by default, honors dbPath and persists across reopen', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'command-db-'));
  let db;
  t.after(async () => { if (db) await db.close(); await rm(dir, { recursive: true, force: true }); });
  const dataDir = join(dir, 'nested', 'data');
  db = await openDb({ env: { DATA_DIR: dataDir, DATABASE_URL: '' } });
  assert.equal(db.filename, resolve(dataDir, 'command.sqlite'));
  await db.prepare('INSERT INTO notes VALUES (?, ?)').run('guild', 'persisted');
  await db.close();
  db = undefined;
  db = await openDb({ env: { DATA_DIR: dataDir } });
  assert.equal((await db.prepare('SELECT value FROM notes WHERE guild = ?').get('guild')).value, 'persisted');
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM schema_migrations WHERE name = ?', [migrationName]))[0].count, 1);
  await db.close();
  db = undefined;
  const customPath = join(dir, 'other', 'custom.sqlite');
  db = await openDb({ env: { DATA_DIR: dataDir }, dbPath: customPath });
  assert.equal(db.filename, customPath);
  assert.equal(await db.prepare('SELECT value FROM notes WHERE guild = ?').get('guild'), undefined);
});

test('migration runner opens the configured SQLite file and can be run repeatedly', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'command-migrate-'));
  let db;
  t.after(async () => { if (db) await db.close(); await rm(dir, { recursive: true, force: true }); });
  const runner = new URL('../db/migrate.mjs', import.meta.url);
  for (let i = 0; i < 2; i++) {
    const { stdout } = await promisify(execFile)(process.execPath, [runner.pathname], {
      env: { PATH: process.env.PATH || '', DATA_DIR: dir }, timeout: 10000
    });
    assert.match(stdout, /\[migrate\] driver: sqlite/);
    assert.match(stdout, /\[migrate\] all migrations applied/);
  }
  db = await openDb({ env: { DATA_DIR: dir } });
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM schema_migrations WHERE name = ?', [migrationName]))[0].count, 1);
});

test('PostgreSQL driver is declared as a runtime dependency', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
  assert.ok(manifest.dependencies?.pg, 'openDb requires pg when DATABASE_URL is set');
});

// Intercept only the adapter's dynamic pg import so these tests require no server or credentials.
const pgFixtureKey = Symbol.for('chaotic-command.test.pg');
const pools = [];
class FakePool {
  constructor(config) {
    this.config = config;
    this.calls = [];
    this.applied = new Set();
    this.result = { rows: [], rowCount: 0 };
    pools.push(this);
  }
  async query(sql, params) {
    this.calls.push({ sql, params });
    if (sql === 'SELECT name FROM schema_migrations') return { rows: [...this.applied].map(name => ({ name })) };
    if (sql.startsWith('INSERT INTO schema_migrations')) {
      const name = /^INSERT INTO schema_migrations \(name, applied_at\) VALUES \('((?:''|[^'])*)'/.exec(sql)?.[1];
      if (!name) throw new Error('Unexpected migration record');
      this.applied.add(name.replace(/''/g, "'"));
      return { rows: [], rowCount: 1 };
    }
    if (this.error) throw this.error;
    return this.result;
  }
  async end() { this.closed = true; }
}
globalThis[pgFixtureKey] = { Pool: FakePool };
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'pg' && context.parentURL === new URL('../db/index.mjs', import.meta.url).href) {
      return { url: 'data:text/javascript,export default globalThis%5BSymbol.for(%22chaotic-command.test.pg%22)%5D', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
});
test.after(() => { hooks.deregister(); delete globalThis[pgFixtureKey]; });

async function postgresDb(t, url = 'postgres://user:pass@db.example.test/command') {
  const db = await openDb({ env: { DATABASE_URL: url }, dbPath: ':memory:' });
  const pool = pools.at(-1);
  t.after(() => db.close());
  return { db, pool };
}

test('PostgreSQL selection configures pool and SSL according to connection URL', async t => {
  for (const [url, ssl] of [
    ['postgres://user:pass@db.example.test/command', { rejectUnauthorized: false }],
    ['postgres://user:pass@localhost/command', undefined],
    ['postgres://user:pass@127.0.0.1/command', undefined],
    ['postgres://user:pass@db.example.test/command?sslmode=disable', undefined]
  ]) {
    const { db, pool } = await postgresDb(t, url);
    assert.equal(db.kind, 'postgres');
    assert.equal(pool.config.connectionString, url);
    assert.equal(pool.config.max, 5);
    assert.deepEqual(pool.config.ssl, ssl);
  }
});

test('PostgreSQL adapter translates prepared SQL and returns rows and write counts', async t => {
  const { db, pool } = await postgresDb(t);
  pool.result = { rows: [{ value: 'first' }, { value: 'second' }], rowCount: 2 };
  const statement = db.prepare('SELECT value FROM notes WHERE guild = ? AND value = ? COLLATE NOCASE');
  assert.deepEqual(await statement.get('guild', 'first'), { value: 'first' });
  assert.deepEqual(pool.calls.at(-1), { sql: 'SELECT value FROM notes WHERE guild = $1 AND value = $2', params: ['guild', 'first'] });
  assert.deepEqual(await statement.all('guild', 'second'), [{ value: 'first' }, { value: 'second' }]);
  assert.deepEqual(await statement.run('guild', 'second'), { changes: 2, lastInsertRowid: null });
  pool.result = { rows: [], rowCount: null };
  assert.equal(await statement.get('missing', 'value'), undefined);
  assert.deepEqual(await statement.run('missing', 'value'), { changes: 0, lastInsertRowid: null });
  assert.deepEqual(await db.query('SELECT ? AS value', ['bound']), []);
  assert.deepEqual(pool.calls.at(-1), { sql: 'SELECT $1 AS value', params: ['bound'] });
  await db.query('SELECT 1');
  assert.deepEqual(pool.calls.at(-1), { sql: 'SELECT 1', params: [] });
  await db.exec('PRAGMA journal_mode=WAL; CREATE TABLE sample (name TEXT COLLATE NOCASE)');
  assert.equal(pool.calls.at(-1).sql, ' CREATE TABLE sample (name TEXT)');
});

test('PostgreSQL translates replacement writes for single and composite keys and rejects unknown tables', async t => {
  const { db, pool } = await postgresDb(t);
  const cases = [
    ['INSERT OR REPLACE INTO sessions VALUES (?, ?, ?)', 'INSERT INTO sessions (id, data, expires) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, expires = EXCLUDED.expires', ['s', 'data', 1]],
    ['INSERT OR REPLACE INTO notes (value, guild) VALUES (?, ?)', 'INSERT INTO notes (value, guild) VALUES ($1, $2) ON CONFLICT (guild) DO UPDATE SET value = EXCLUDED.value', ['note', 'g']],
    ['INSERT OR REPLACE INTO guild_bot_selections (owner_id, guild_id, bot_id) VALUES (?, ?, ?)', 'INSERT INTO guild_bot_selections (owner_id, guild_id, bot_id) VALUES ($1, $2, $3) ON CONFLICT (owner_id, guild_id) DO UPDATE SET bot_id = EXCLUDED.bot_id', ['o', 'g', 'b']]
  ];
  for (const [sql, expected, params] of cases) {
    await db.prepare(sql).run(...params);
    assert.deepEqual(pool.calls.at(-1), { sql: expected, params });
  }
  assert.throws(() => db.prepare('INSERT OR REPLACE INTO unknown VALUES (?)'), /No Postgres conflict target defined for table unknown/);
});

test('PostgreSQL migrations are applied once, errors propagate and close ends the pool', async () => {
  const db = await openDb({ env: { DATABASE_URL: 'postgres://localhost/command' } });
  const pool = pools.at(-1);
  assert.ok(pool.calls[0].sql.includes('CREATE TABLE IF NOT EXISTS sessions'));
  assert.ok(pool.calls.some(call => call.sql.includes('CREATE TABLE IF NOT EXISTS audit_events')));
  const migrationWrites = pool.calls.filter(call => call.sql.startsWith('INSERT INTO schema_migrations')).length;
  assert.ok(pool.applied.has(migrationName));
  await db.migrate();
  assert.equal(pool.calls.filter(call => call.sql.includes('CREATE TABLE IF NOT EXISTS audit_events')).length, 1);
  assert.equal(pool.calls.filter(call => call.sql.startsWith('INSERT INTO schema_migrations')).length, migrationWrites);
  const error = new Error('database unavailable');
  pool.error = error;
  await assert.rejects(db.query('SELECT ?', [1]), error);
  await assert.rejects(db.prepare('DELETE FROM notes WHERE guild = ?').run('g'), error);
  await db.close();
  assert.equal(pool.closed, true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { registerHooks } from 'node:module';
import { openDb } from '../db/index.mjs';

const plain = row => row && { ...row };

async function memoryDb(t) {
  const db = await openDb({ env: {}, dbPath: ':memory:' });
  t.after(() => db.close());
  return db;
}

test('SQLite adapter supports parameterized reads, writes and missing rows', async t => {
  const db = await memoryDb(t);
  assert.equal(db.kind, 'sqlite');
  assert.equal(db.filename, ':memory:');
  const insert = db.prepare('INSERT INTO notes (guild, value) VALUES (?, ?)');
  assert.deepEqual(await insert.run('guild-a', "it's ? safe"), { changes: 1, lastInsertRowid: 1 });
  await insert.run('guild-b', 'other');
  const select = db.prepare('SELECT guild, value FROM notes WHERE guild = ?');
  assert.deepEqual(plain(await select.get('guild-a')), { guild: 'guild-a', value: "it's ? safe" });
  assert.equal(await select.get('missing'), undefined);
  assert.deepEqual((await select.all('missing')), []);
  assert.deepEqual((await db.query('SELECT guild FROM notes ORDER BY guild')).map(plain), [{ guild: 'guild-a' }, { guild: 'guild-b' }]);
  assert.deepEqual((await db.query('SELECT value FROM notes WHERE guild = ?', ['guild-b'])).map(plain), [{ value: 'other' }]);
  assert.equal((await db.prepare('DELETE FROM notes WHERE guild = ?').run('missing')).changes, 0);
  await db.exec('CREATE TABLE fixture (value TEXT NOT NULL)');
  await assert.rejects(db.prepare('INSERT INTO fixture VALUES (?)').run(null), /NOT NULL/);
});

test('SQLite creates the community schema, constraints and indexes on open', async t => {
  const db = await memoryDb(t);
  const tables = (await db.query("SELECT name FROM sqlite_master WHERE type = 'table'")).map(row => row.name);
  for (const name of ['sessions', 'notes', 'saved_structures', 'user_bots', 'guild_bot_selections', 'schema_migrations', 'users', 'discord_servers', 'moderation_cases', 'warnings', 'tickets', 'ticket_messages', 'ticket_transcripts', 'appeals', 'ban_approval_requests', 'staff_actions', 'audit_events']) {
    assert.ok(tables.includes(name), `missing table ${name}`);
  }
  const indexes = (await db.query("SELECT name FROM sqlite_master WHERE type = 'index'")).map(row => row.name);
  for (const name of ['moderation_cases_guild', 'warnings_user', 'ticket_messages_ticket', 'audit_events_case']) assert.ok(indexes.includes(name));
  const insertUser = db.prepare('INSERT INTO users (id, discord_user_id, username, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
  await insertUser.run('u1', 'discord-1', 'name', 1, 2);
  assert.deepEqual(plain(await db.prepare('SELECT is_staff, staff_role FROM users WHERE id = ?').get('u1')), { is_staff: 0, staff_role: null });
  await assert.rejects(insertUser.run('u2', 'discord-1', 'duplicate', 1, 2), /UNIQUE/);
  const insertCase = db.prepare('INSERT INTO moderation_cases (id, guild_id, case_number, target_user_id, moderator_user_id, action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  await insertCase.run('c1', 'g1', 1, 'target', 'mod', 'warn', 1, 2);
  await assert.rejects(insertCase.run('c2', 'g1', 1, 'target', 'mod', 'warn', 1, 2), /UNIQUE/);
  await insertCase.run('c3', 'g2', 1, 'target', 'mod', 'warn', 1, 2);
  assert.equal((await db.prepare('SELECT status FROM moderation_cases WHERE id = ?').get('c1')).status, 'open');
});

test('file-backed SQLite selects paths, preserves data and does not reapply migrations', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'command-db-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'nested', 'custom.sqlite');
  let db = await openDb({ env: { DATA_DIR: join(directory, 'ignored'), DATABASE_URL: '' }, dbPath: path });
  assert.equal(db.filename, path);
  await db.prepare('INSERT INTO notes VALUES (?, ?)').run('g', 'kept');
  const before = (await db.query('SELECT name, applied_at FROM schema_migrations')).map(plain);
  assert.deepEqual(before.map(row => row.name), ['001_community_schema.sql']);
  await db.migrate();
  assert.deepEqual((await db.query('SELECT name, applied_at FROM schema_migrations')).map(plain), before);
  await db.close();
  db = await openDb({ env: {}, dbPath: path });
  try {
    assert.equal((await db.prepare('SELECT value FROM notes WHERE guild = ?').get('g')).value, 'kept');
    assert.deepEqual((await db.query('SELECT name, applied_at FROM schema_migrations')).map(plain), before);
  } finally { await db.close(); }
  const defaultDb = await openDb({ env: { DATA_DIR: join(directory, 'data') } });
  assert.equal(defaultDb.filename, join(directory, 'data', 'command.sqlite'));
  await defaultDb.close();
});

test('migration runner works repeatedly against a local database', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'command-migrate-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const runner = new URL('../db/migrate.mjs', import.meta.url);
  for (let i = 0; i < 2; i++) {
    const { stdout } = await promisify(execFile)(process.execPath, [runner.pathname], {
      env: { PATH: process.env.PATH || '', DATA_DIR: directory }, timeout: 10000
    });
    assert.match(stdout, /\[migrate\] driver: sqlite/);
    assert.match(stdout, /\[migrate\] all migrations applied/);
  }
  const db = await openDb({ env: { DATA_DIR: directory } });
  try { assert.equal((await db.query('SELECT name FROM schema_migrations')).length, 1); }
  finally { await db.close(); }
});

test('PostgreSQL adapter translates statements and propagates pool results and failures', async t => {
  const pools = [];
  class FakePool {
    constructor(options) { this.options = options; this.calls = []; this.applied = new Set(); this.response = null; pools.push(this); }
    async query(sql, params) {
      this.calls.push({ sql, params });
      if (this.failure) throw this.failure;
      if (sql === 'SELECT name FROM schema_migrations') return { rows: [...this.applied].map(name => ({ name })) };
      const match = /^INSERT INTO schema_migrations .* VALUES \('([^']+)'/.exec(sql);
      if (match) this.applied.add(match[1]);
      return this.response ?? { rows: [], rowCount: 0 };
    }
    async end() { this.ended = true; }
  }
  const key = Symbol.for('chaotic-command.test.fake-pool');
  globalThis[key] = FakePool;
  const fakeUrl = 'data:text/javascript,export default { Pool: globalThis[Symbol.for("chaotic-command.test.fake-pool")] }';
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    return specifier === 'pg' ? { url: fakeUrl, shortCircuit: true } : nextResolve(specifier, context);
  } });
  t.after(() => { hooks.deregister(); delete globalThis[key]; });

  const db = await openDb({ env: { DATABASE_URL: 'postgres://example.invalid/db' } });
  const pool = pools[0];
  t.after(async () => { if (!pool.ended) await db.close(); });
  assert.equal(db.kind, 'postgres');
  assert.deepEqual(pool.options, { connectionString: 'postgres://example.invalid/db', max: 5, ssl: { rejectUnauthorized: false } });
  assert.ok(pool.calls.some(call => call.sql.includes('CREATE TABLE IF NOT EXISTS users')));
  assert.deepEqual([...pool.applied], ['001_community_schema.sql']);
  const initialMigrationCount = pool.calls.filter(call => call.sql.includes('CREATE TABLE IF NOT EXISTS users')).length;
  await db.migrate();
  assert.equal(pool.calls.filter(call => call.sql.includes('CREATE TABLE IF NOT EXISTS users')).length, initialMigrationCount);

  pool.response = { rows: [{ value: 'result' }, { value: 'second' }], rowCount: 2 };
  const select = db.prepare('SELECT value FROM notes WHERE guild = ? AND value = ? COLLATE NOCASE');
  assert.deepEqual(await select.get('g', 'v'), { value: 'result' });
  assert.deepEqual(pool.calls.at(-1), { sql: 'SELECT value FROM notes WHERE guild = $1 AND value = $2', params: ['g', 'v'] });
  assert.deepEqual(await select.all('g', 'v'), [{ value: 'result' }, { value: 'second' }]);
  assert.deepEqual(await db.query('SELECT ? AS value', ['x']), pool.response.rows);
  assert.deepEqual(pool.calls.at(-1), { sql: 'SELECT $1 AS value', params: ['x'] });
  assert.deepEqual(await db.prepare('INSERT OR REPLACE INTO sessions VALUES (?, ?, ?)').run('id', 'data', 123), { changes: 2, lastInsertRowid: null });
  assert.deepEqual(pool.calls.at(-1), { sql: 'INSERT INTO sessions (id, data, expires) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, expires = EXCLUDED.expires', params: ['id', 'data', 123] });
  await db.prepare('INSERT OR REPLACE INTO guild_bot_selections (bot_id, guild_id, owner_id) VALUES (?, ?, ?)').run('bot', 'guild', 'owner');
  assert.equal(pool.calls.at(-1).sql, 'INSERT INTO guild_bot_selections (bot_id, guild_id, owner_id) VALUES ($1, $2, $3) ON CONFLICT (owner_id, guild_id) DO UPDATE SET bot_id = EXCLUDED.bot_id');
  await db.prepare('INSERT OR REPLACE INTO notes VALUES (?, ?)').run('g', 'n');
  assert.equal(pool.calls.at(-1).sql, 'INSERT INTO notes (guild, value) VALUES ($1, $2) ON CONFLICT (guild) DO UPDATE SET value = EXCLUDED.value');
  assert.throws(() => db.prepare('INSERT OR REPLACE INTO unknown VALUES (?)'), /No Postgres conflict target defined for table unknown/);
  await db.exec('PRAGMA journal_mode=WAL; SELECT 1');
  assert.equal(pool.calls.at(-1).sql.trim(), 'SELECT 1');
  pool.response = { rows: [], rowCount: null };
  assert.equal(await select.get('missing', 'x'), undefined);
  assert.deepEqual(await select.run('missing', 'x'), { changes: 0, lastInsertRowid: null });
  pool.failure = new Error('database unavailable');
  await assert.rejects(db.query('SELECT ?', ['x']), /database unavailable/);
  await assert.rejects(db.migrate(), /database unavailable/);
  pool.failure = null;
  await t.test('preserves question marks inside SQL string literals', async () => {
    await db.query("SELECT '?' AS literal, ? AS value", ['actual']);
    assert.deepEqual(pool.calls.at(-1), { sql: "SELECT '?' AS literal, $1 AS value", params: ['actual'] });
  });
  await t.test('translates case-insensitive SQLite upsert syntax', async () => {
    await db.prepare('insert or replace into notes values (?, ?)').run('guild', 'note');
    assert.match(pool.calls.at(-1).sql, /ON CONFLICT\s*\(guild\)\s+DO UPDATE SET/i);
    assert.deepEqual(pool.calls.at(-1).params, ['guild', 'note']);
  });
  await db.close();
  assert.equal(pool.ended, true);

  for (const url of ['postgres://localhost/db', 'postgres://127.0.0.1/db', 'postgres://remote.example/db?sslmode=disable']) {
    const local = await openDb({ env: { DATABASE_URL: url } });
    assert.deepEqual(pools.at(-1).options, { connectionString: url, max: 5 });
    await local.close();
  }
});

test('PostgreSQL driver is declared as a runtime dependency', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
  assert.ok(manifest.dependencies?.pg, 'package.json must declare pg for DATABASE_URL deployments');
});

test('migration command is available through the package scripts', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
  assert.match(manifest.scripts?.migrate ?? '', /apps\/command\/db\/migrate\.mjs/);
});

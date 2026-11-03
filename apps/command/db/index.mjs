import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Dual-driver persistence: PostgreSQL (Supabase) when DATABASE_URL is set, local SQLite otherwise.
// Both adapters expose the same async API:
//   db.kind                          'sqlite' | 'postgres'
//   db.prepare(sql) -> { get, all, run }   (all methods async)
//   db.exec(sql)                     (async)
//   db.query(sql, params)            (async, raw rows for postgres / array for sqlite)
//   db.migrate()                     (async, applies migrations/*.sql in order)
//   db.close()                       (async)
// All SQL uses ? placeholders and is translated for Postgres automatically.

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

// Tables where INSERT OR REPLACE must map to a Postgres upsert.
const SQLITE_TABLES = {
  sessions: { columns: ['id', 'data', 'expires'], key: ['id'] },
  notes: { columns: ['guild', 'value'], key: ['guild'] },
  guild_bot_selections: { columns: ['owner_id', 'guild_id', 'bot_id'], key: ['owner_id', 'guild_id'] }
};

function translatePostgres(sql) {
  let out = sql.replace(/PRAGMA[^;]*;?/g, '');
  out = out.replace(/INSERT OR REPLACE INTO (\w+)(\s*\([^)]*\))?\s*VALUES\s*\(([^)]*)\)/g, (match, table, columnList, values) => {
    const spec = SQLITE_TABLES[table];
    if (!spec) throw new Error(`No Postgres conflict target defined for table ${table}`);
    const columns = columnList ? columnList.replace(/[()]/g, '').split(',').map(part => part.trim()) : spec.columns;
    const setters = columns.filter(column => !spec.key.includes(column))
      .map(column => `${column} = EXCLUDED.${column}`)
      .join(', ');
    const conflict = spec.key.join(', ');
    return `INSERT INTO ${table}${columnList || ` (${spec.columns.join(', ')})`} VALUES (${values}) ON CONFLICT (${conflict}) DO UPDATE SET ${setters}`;
  });
  return out.replace(/\s+COLLATE NOCASE/g, '');
}

function toPgPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

const SCHEMA = {
  sqlite: `PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notes (guild TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS saved_structures (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, structure_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS saved_structures_owner_name ON saved_structures(owner_id, name COLLATE NOCASE);
CREATE TABLE IF NOT EXISTS user_bots (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, discord_bot_id TEXT NOT NULL, username TEXT NOT NULL, token_encrypted TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(owner_id, discord_bot_id));
CREATE INDEX IF NOT EXISTS user_bots_owner ON user_bots(owner_id, created_at);
CREATE TABLE IF NOT EXISTS guild_bot_selections (owner_id TEXT NOT NULL, guild_id TEXT NOT NULL, bot_id TEXT NOT NULL, PRIMARY KEY(owner_id, guild_id));`,
  postgres: `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS notes (guild TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS saved_structures (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, structure_json TEXT NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS saved_structures_owner_name ON saved_structures(owner_id, lower(name));
CREATE TABLE IF NOT EXISTS user_bots (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, discord_bot_id TEXT NOT NULL, username TEXT NOT NULL, token_encrypted TEXT NOT NULL, created_at BIGINT NOT NULL, UNIQUE(owner_id, discord_bot_id));
CREATE INDEX IF NOT EXISTS user_bots_owner ON user_bots(owner_id, created_at);
CREATE TABLE IF NOT EXISTS guild_bot_selections (owner_id TEXT NOT NULL, guild_id TEXT NOT NULL, bot_id TEXT NOT NULL, PRIMARY KEY(owner_id, guild_id));`
};

function sqliteAdapter(db, filename) {
  const self = {
    kind: 'sqlite',
    filename,
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        get: async (...params) => statement.get(...params) ?? undefined,
        all: async (...params) => statement.all(...params),
        run: async (...params) => {
          const info = statement.run(...params);
          return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
        }
      };
    },
    exec: async sql => { db.exec(sql); },
    query: async (sql, params = []) => db.prepare(sql).all(...params),
    migrate: async () => { db.exec(SCHEMA.sqlite); await runMigrations(self, sqliteMigrationExecutor(db)); },
    close: async () => { db.close(); }
  };
  return self;
}

async function postgresAdapter(connectionString) {
  const pgModule = await import('pg');
  const Pool = pgModule.default.Pool ?? pgModule.default;
  const needsSsl = !/localhost|127\.0\.0\.1/.test(connectionString) && !/sslmode=disable/.test(connectionString);
  const pool = new Pool({ connectionString, max: 5, ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}) });
  const cache = new Map();
  const self = {
    kind: 'postgres',
    prepare(sql) {
      let text = cache.get(sql);
      if (!text) {
        text = toPgPlaceholders(translatePostgres(sql));
        cache.set(sql, text);
      }
      return {
        get: async (...params) => (await pool.query(text, params)).rows[0],
        all: async (...params) => (await pool.query(text, params)).rows,
        run: async (...params) => {
          const result = await pool.query(text, params);
          return { changes: result.rowCount ?? 0, lastInsertRowid: null };
        }
      };
    },
    exec: async sql => { await pool.query(translatePostgres(sql)); },
    query: async (sql, params = []) => (await pool.query(toPgPlaceholders(translatePostgres(sql)), params)).rows,
    migrate: async () => { await pool.query(SCHEMA.postgres); await runMigrations(self, async sql => { await pool.query(sql); }); },
    close: async () => { await pool.end(); }
  };
  return self;
}

function sqliteMigrationExecutor(db) {
  return async sql => db.exec(sql);
}

async function runMigrations(adapter, executeSql) {
  await executeSql(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at BIGINT NOT NULL)`);
  const applied = new Set((await adapter.query('SELECT name FROM schema_migrations')).map(row => row.name));
  const files = readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort();
  for (const name of files) {
    if (applied.has(name)) continue;
    await executeSql(readFileSync(join(migrationsDir, name), 'utf8'));
    await executeSql(`INSERT INTO schema_migrations (name, applied_at) VALUES ('${name.replace(/'/g, "''")}', ${Date.now()})`);
  }
}

export async function openDb({ env = process.env, dbPath } = {}) {
  const databaseUrl = env.DATABASE_URL;
  const db = databaseUrl ? await postgresAdapter(databaseUrl) : await sqliteAdapterFor(dbPath, env);
  await db.migrate();
  return db;
}

async function sqliteAdapterFor(dbPath, env) {
  const path = dbPath ?? resolve(env.DATA_DIR || '.data', 'command.sqlite');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  return sqliteAdapter(new DatabaseSync(path), path);
}

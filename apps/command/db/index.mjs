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

/**
 * Rewrite supported SQLite syntax for PostgreSQL using case-sensitive text matching.
 * INSERT OR REPLACE is supported only for sessions, notes, and guild_bot_selections;
 * a matching statement for another table throws an error.
 */
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

/** Replace every `?` with a numbered PostgreSQL placeholder, including those in literals. */
function toPgPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

const SCHEMA = {
  sqlite: `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL);
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

/**
 * Wrap an open DatabaseSync connection with the shared asynchronous database API.
 * Migrations enable WAL and acquire a write transaction with busy retries; schema
 * creation and migration records commit together or roll back on failure.
 * Closing the adapter closes the supplied connection.
 */
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
    migrate: async () => {
      // Yield between busy attempts so another connection can finish its transaction.
      await sqliteRetry(() => db.exec('PRAGMA journal_mode=WAL'));
      await sqliteRetry(() => db.exec('BEGIN IMMEDIATE'));
      try {
        db.exec(SCHEMA.sqlite);
        await runMigrations(self, async sql => db.exec(sql));
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch { /* Preserve the migration error. */ }
        throw error;
      }
    },
    close: async () => { db.close(); }
  };
  return self;
}

/**
 * Create a five-connection PostgreSQL pool and expose the shared database API.
 * Remote hosts default to verified TLS unless URL SSL options override it; ca
 * augments enabled TLS. Queries translate supported SQLite syntax and placeholders.
 * Migrations use one checked-out client and an advisory transaction lock, releasing
 * the client after commit or rollback. Closing the adapter ends the pool.
 */
async function postgresAdapter(connectionString, ca) {
  const pgModule = await import('pg');
  const Pool = pgModule.default.Pool ?? pgModule.default;
  // Parse once using the driver's own rules, then omit connectionString so it
  // cannot overwrite our TLS defaults (or an explicitly supplied CA).
  const parameters = new pgModule.default.Client({ connectionString }).connectionParameters;
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parameters.host) || parameters.host.startsWith('/');
  const url = new URL(connectionString);
  const explicitSsl = ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some(key => url.searchParams.has(key));
  let ssl = parameters.ssl;
  if (!explicitSsl && !ssl && !local) ssl = { rejectUnauthorized: true };
  if (ssl && ca) ssl = { ...(typeof ssl === 'object' ? ssl : {}), ca };
  const pool = new Pool({ ...parameters, max: 5, ssl });
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
    migrate: async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(1735289201)');
        await client.query(SCHEMA.postgres);
        await runMigrations({ query: async sql => (await client.query(sql)).rows }, async sql => { await client.query(sql); });
        await client.query('COMMIT');
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* Preserve the migration error. */ }
        throw error;
      } finally {
        client.release();
      }
    },
    close: async () => { await pool.end(); }
  };
  return self;
}

/**
 * Run a synchronous SQLite operation, retrying SQLITE_BUSY with asynchronous
 * ten-millisecond waits for up to five seconds. Return its result on success;
 * propagate other errors immediately and the last busy error on timeout.
 */
async function sqliteRetry(operation) {
  const deadline = Date.now() + 5000;
  for (;;) {
    try { return operation(); } catch (error) {
      if (error.errcode !== 5 || Date.now() >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

/** Apply and record pending files inside the caller's serialized transaction. */
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

/**
 * Open a database and apply the base schema and pending migrations before returning.
 * env defaults to process.env. A truthy env.DATABASE_URL selects PostgreSQL;
 * otherwise SQLite uses dbPath, or command.sqlite under env.DATA_DIR (default
 * .data). Use ':memory:' for in-memory SQLite. dbPath is ignored for PostgreSQL.
 * Remote PostgreSQL uses verified TLS by default; loopback/socket hosts use driver
 * defaults. Explicit URL SSL settings are honored. env.DATABASE_SSL_CA supplies
 * optional PEM CA text without being overwritten by URL SSL parameters.
 *
 * The returned adapter exposes kind, prepare(sql), exec(sql), query(sql, params),
 * migrate(), and close(). SQLite adapters also expose filename. Prepared get/all/run
 * accept bound arguments and resolve to the first row or undefined, all rows, and
 * { changes, lastInsertRowid }, respectively; PostgreSQL always returns null for
 * lastInsertRowid. query resolves to rows and defaults params to an empty array.
 * exec accepts SQL without parameters. PostgreSQL prepare and query replace every
 * `?`, even inside literals, and translate only supported SQLite syntax.
 *
 * Opening or migrating can reject with driver, filesystem, or SQL errors; migration
 * failures roll back schema changes and close the adapter. prepare can throw synchronously, and execution
 * and close errors propagate through their returned promises.
 */
export async function openDb({ env = process.env, dbPath } = {}) {
  const databaseUrl = env.DATABASE_URL;
  const db = databaseUrl ? await postgresAdapter(databaseUrl, env.DATABASE_SSL_CA) : await sqliteAdapterFor(dbPath, env);
  try {
    await db.migrate();
    return db;
  } catch (error) {
    try { await db.close(); } catch { /* Preserve the migration error. */ }
    throw error;
  }
}

/**
 * Open SQLite at dbPath or command.sqlite under env.DATA_DIR (default .data).
 * Create parent directories with mode 0700 unless using ':memory:'. Disable the
 * driver's blocking busy timeout so migration lock retries can yield to callers.
 * Filesystem and connection errors reject the returned promise.
 */
async function sqliteAdapterFor(dbPath, env) {
  const path = dbPath ?? resolve(env.DATA_DIR || '.data', 'command.sqlite');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  return sqliteAdapter(new DatabaseSync(path, { timeout: 0 }), path);
}

import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { HttpError, templates, hasPermission, canManage, validateId, validateStructure, makePlan, applyPlan, createGuildLock } from './core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const random = () => randomBytes(32).toString('hex');
const structureNameKey = value => value.normalize('NFKC').toLowerCase();
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const HOUR = 3600000;

/** Dependency-free single-process runtime. Inject fetch/db config for offline integration tests. */
export function createApp(config = {}) {
  const env = config.env || process.env;
  const fetcher = config.fetch || globalThis.fetch;
  const origin = new URL(env.APP_ORIGIN || 'http://localhost:3000').origin;
  const secure = origin.startsWith('https:');
  const configured = Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_BOT_TOKEN);
  if (env.NODE_ENV === 'production' && !secure) throw new Error('Production APP_ORIGIN must use HTTPS.');
  if ((configured || env.NODE_ENV === 'production') && (env.SESSION_SECRET || '').length < 32) throw new Error('Set SESSION_SECRET to at least 32 random characters.');
  const key = createHash('sha256').update(env.SESSION_SECRET || random()).digest();
  const dbPath = config.dbPath || resolve(env.DATA_DIR || '.data', 'command.sqlite');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS notes (guild TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS saved_structures (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, structure_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL); CREATE UNIQUE INDEX IF NOT EXISTS saved_structures_owner_name ON saved_structures(owner_id, name COLLATE NOCASE);`);
  const lock = createGuildLock();
  const encrypt = value => {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    const content = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), content]).toString('base64');
  };
  const decrypt = value => {
    const raw = Buffer.from(value, 'base64'), cipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    cipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString());
  };
  const sessionKey = sid => createHash('sha256').update(sid).digest('hex');
  const saveSession = (sid, session) => {
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    db.prepare('INSERT OR REPLACE INTO sessions VALUES (?, ?, ?)').run(sessionKey(sid), encrypt(session), session.expires);
  };
  const deleteSession = sid => db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionKey(sid));
  const cookie = (sid, age = 28800) => `cc_session=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const ensureConfigured = () => { if (!configured) throw new HttpError(503, 'Configure Discord credentials and SESSION_SECRET on the server, then restart.'); };
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  async function discord(path, token, options = {}, attempt = 0) {
    let response;
    try {
      response = await fetcher(`https://discord.com/api/v10${path}`, { ...options, signal: AbortSignal.timeout(15000), headers: { Authorization: token, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
    } catch { throw new HttpError(502, 'Discord could not be reached. Try again.'); }
    if (response.status === 429 && attempt < 3) {
      const data = await response.json();
      const delay = Number(data.retry_after);
      if (!Number.isFinite(delay) || delay < 0 || delay > 30) throw new HttpError(429, 'Discord rate limit reached. Try again later.');
      await new Promise(r => setTimeout(r, delay * 1000 + 100));
      return discord(path, token, options, attempt + 1);
    }
    if (!response.ok) throw new HttpError(response.status === 401 ? 401 : response.status === 403 ? 403 : 502, response.status === 401 ? 'Discord authorization expired or is invalid. Sign in again or check the bot token.' : response.status === 403 ? 'Discord denied access. Check bot membership, permissions and role hierarchy.' : 'Discord rejected the request. Refresh the preview before retrying.');
    return response.status === 204 ? null : response.json();
  }
  const bot = (path, options) => discord(path, `Bot ${env.DISCORD_BOT_TOKEN}`, options);
  async function guilds(session) {
    if (!session.user || session.tokenExpires <= Date.now()) throw new HttpError(401, 'Sign in with Discord again.');
    const result = [];
    let after = '';
    for (;;) {
      const page = await discord(`/users/@me/guilds?limit=200${after ? `&after=${after}` : ''}`, `Bearer ${session.token}`);
      result.push(...page);
      if (page.length < 200) break;
      after = page.at(-1).id;
    }
    return result.filter(canManage).map(({ id, name }) => ({ id, name }));
  }
  async function authorize(session, id) {
    validateId(id);
    const guild = (await guilds(session)).find(g => g.id === id);
    if (!guild) throw new HttpError(403, 'You need Manage Server permission for this server.');
    return guild;
  }
  async function snapshot(session, id) {
    await authorize(session, id);
    const [roles, channels, me] = await Promise.all([bot(`/guilds/${id}/roles`), bot(`/guilds/${id}/channels`), bot('/users/@me')]);
    const member = await bot(`/guilds/${id}/members/${me.id}`);
    const permissions = roles.filter(r => r.id === id || member.roles.includes(r.id)).reduce((p, r) => p | BigInt(r.permissions), 0n);
    if (!hasPermission(permissions, 16n) || !hasPermission(permissions, 268435456n)) throw new HttpError(403, 'Bot needs Manage Channels and Manage Roles. Place its role above roles it creates.');
    return { roles, channels };
  }
  async function body(req) {
    let text = '';
    for await (const chunk of req) {
      text += chunk;
      if (Buffer.byteLength(text) > 8192) throw new HttpError(413, 'Request too large.');
    }
    try { return JSON.parse(text || '{}'); } catch { throw new HttpError(400, 'Invalid JSON.'); }
  }
  const assets = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/style.css', ['style.css', 'text/css; charset=utf-8']]
  ]);
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    let sid = /(?:^|;\s*)cc_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    let session;
    if (sid) {
      const row = db.prepare('SELECT data FROM sessions WHERE id = ? AND expires > ?').get(sessionKey(sid), Date.now());
      try { if (row) session = decrypt(row.data); } catch { deleteSession(sid); }
    }
    const persist = () => { if (sid && session) saveSession(sid, session); };
    try {
      const url = new URL(req.url, origin), path = url.pathname;
      if (req.method === 'GET' && assets.has(path)) {
        const [file, type] = assets.get(path);
        res.writeHead(200, { 'Content-Type': type }); res.end(readFileSync(resolve(here, 'web', file))); return;
      }
      if (req.method === 'GET' && path === '/api/health') return json(res, 200, { ok: true, configured });
      if (req.method === 'GET' && path === '/api/session') {
        return json(res, 200, { configured, user: session?.tokenExpires > Date.now() ? session.user : null, csrf: session?.csrf || null, inviteBase: configured ? `https://discord.com/oauth2/authorize?${new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, scope: 'bot', permissions: '268435472' })}` : null });
      }
      if (req.method === 'GET' && path === '/auth/discord') {
        ensureConfigured();
        if (!session) {
          db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
          if (db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count >= 10000) throw new HttpError(503, 'Too many sessions. Try later.');
          sid = random(); session = { expires: Date.now() + 10 * 60000, csrf: random() };
        }
        session.oauth = { state: random(), expires: Date.now() + 10 * 60000 };
        persist();
        res.setHeader('Set-Cookie', cookie(sid));
        const params = new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, redirect_uri: `${origin}/auth/callback`, response_type: 'code', scope: 'identify guilds', state: session.oauth.state });
        res.writeHead(302, { Location: `https://discord.com/oauth2/authorize?${params}` }); res.end(); return;
      }
      if (req.method === 'GET' && path === '/auth/callback') {
        ensureConfigured();
        if (!session?.oauth || session.oauth.expires < Date.now() || !equal(url.searchParams.get('state'), session.oauth.state)) throw new HttpError(400, 'Invalid or expired OAuth state. Start sign-in again.');
        delete session.oauth; persist();
        if (!url.searchParams.get('code')) throw new HttpError(400, 'Discord sign-in was cancelled.');
        let response;
        try { response = await fetcher('https://discord.com/api/v10/oauth2/token', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: `${origin}/auth/callback` }) }); } catch { throw new HttpError(502, 'Discord sign-in could not be reached. Start again.'); }
        if (!response.ok) throw new HttpError(401, 'Discord sign-in failed. Start again.');
        const token = await response.json();
        if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new HttpError(502, 'Invalid Discord token response.');
        const user = await discord('/users/@me', `Bearer ${token.access_token}`);
        deleteSession(sid); sid = random();
        session = { csrf: random(), token: token.access_token, tokenExpires: Date.now() + token.expires_in * 1000, user: { id: user.id, username: user.global_name || user.username }, expires: Date.now() + 8 * HOUR };
        persist(); res.setHeader('Set-Cookie', cookie(sid));
        res.writeHead(302, { Location: '/' }); res.end(); return;
      }
      if (!session?.user || session.tokenExpires <= Date.now()) throw new HttpError(401, 'Sign in with Discord.');
      if (!['GET', 'POST'].includes(req.method)) throw new HttpError(405, 'Method not allowed.');
      if (req.method === 'POST' && (req.headers.origin !== origin || !equal(req.headers['x-csrf-token'], session.csrf))) throw new HttpError(403, 'Invalid request origin or CSRF token. Reload the page.');
      if (req.method === 'POST' && path === '/api/logout') {
        deleteSession(sid); sid = null; session = null;
        res.setHeader('Set-Cookie', cookie('', 0)); return json(res, 200, { ok: true });
      }
      ensureConfigured();
      if (req.method === 'GET' && path === '/api/guilds') return json(res, 200, { guilds: await guilds(session) });
      if (req.method === 'GET' && path === '/api/templates') return json(res, 200, { templates });
      // Personal structures are scoped exclusively to the authenticated Discord account.
      if (path === '/api/structures' && req.method === 'GET') {
        const rows = db.prepare('SELECT id, name, created_at, updated_at FROM saved_structures WHERE owner_id = ? ORDER BY updated_at DESC, name COLLATE NOCASE').all(session.user.id);
        return json(res, 200, { structures: rows });
      }
      if (path === '/api/structures' && req.method === 'POST') {
        const data = await body(req);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Template data must be an object.');
        if (Object.keys(data).some(key => !['name', 'structure'].includes(key)) || !Object.hasOwn(data, 'name') || !Object.hasOwn(data, 'structure')) {
          throw new HttpError(400, 'Provide only a template name and structure.');
        }
        if (typeof data.name !== 'string') throw new HttpError(400, 'Template name must be text.');
        const name = data.name.trim();
        if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) throw new HttpError(400, 'Template name must contain 1 to 60 valid characters.');
        const structure = validateStructure(data.structure);
        const count = db.prepare('SELECT COUNT(*) AS count FROM saved_structures WHERE owner_id = ?').get(session.user.id).count;
        if (count >= 20) throw new HttpError(409, 'You can save up to 20 personal structures. Delete one before saving another.');
        const nameKey = structureNameKey(name);
        const existingNames = db.prepare('SELECT name FROM saved_structures WHERE owner_id = ?').all(session.user.id);
        if (existingNames.some(row => structureNameKey(row.name) === nameKey)) {
          throw new HttpError(409, 'You already have a saved structure with that name. Rename it or choose another name.');
        }
        const id = randomBytes(16).toString('hex'), now = Date.now();
        db.prepare('INSERT INTO saved_structures (id, owner_id, name, structure_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, session.user.id, name, JSON.stringify(structure), now, now);
        return json(res, 201, { structure: { id, name, created_at: now, updated_at: now } });
      }
      const savedMatch = /^\/api\/structures\/([a-f0-9]{32})(?:\/(rename|delete))?$/.exec(path);
      if (savedMatch) {
        const [, structureId, action] = savedMatch;
        const row = db.prepare('SELECT id, owner_id, name, structure_json, created_at, updated_at FROM saved_structures WHERE id = ? AND owner_id = ?').get(structureId, session.user.id);
        if (!row) throw new HttpError(404, 'Saved structure not found.');
        if (req.method === 'GET' && !action) {
          let structure;
          try { structure = validateStructure(JSON.parse(row.structure_json)); }
          catch { throw new HttpError(500, 'This saved structure could not be loaded because its stored data is invalid.'); }
          return json(res, 200, { structure: { id: row.id, name: row.name, created_at: row.created_at, updated_at: row.updated_at }, data: structure });
        }
        if (req.method === 'POST' && action === 'rename') {
          const data = await body(req);
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Template name must be an object field.');
          if (Object.keys(data).some(key => key !== 'name') || typeof data.name !== 'string') throw new HttpError(400, 'Provide only the new template name.');
          const name = data.name.trim();
        if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) throw new HttpError(400, 'Template name must contain 1 to 60 valid characters.');
          const nameKey = structureNameKey(name);
          const existingNames = db.prepare('SELECT name FROM saved_structures WHERE owner_id = ? AND id <> ?').all(session.user.id, structureId);
          if (existingNames.some(row => structureNameKey(row.name) === nameKey)) {
            throw new HttpError(409, 'You already have a saved structure with that name.');
          }
          const now = Date.now();
          db.prepare('UPDATE saved_structures SET name = ?, updated_at = ? WHERE id = ? AND owner_id = ?').run(name, now, structureId, session.user.id);
          return json(res, 200, { structure: { id: row.id, name, created_at: row.created_at, updated_at: now } });
        }
        if (req.method === 'POST' && action === 'delete') {
          db.prepare('DELETE FROM saved_structures WHERE id = ? AND owner_id = ?').run(structureId, session.user.id);
          return json(res, 200, { ok: true });
        }
        throw new HttpError(405, 'Method not allowed.');
      }
      const match = /^\/api\/guilds\/(\d{17,20})\/(status|notes|preview|apply)$/.exec(path);
      if (!match) throw new HttpError(404, 'Not found.');
      const [, id, action] = match;
      if (action === 'status' && req.method === 'GET') {
        const state = await snapshot(session, id);
        const params = new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, scope: 'bot', permissions: '268435472', guild_id: id, disable_guild_select: 'true' });
        return json(res, 200, { roles: state.roles.length, channels: state.channels.length, inviteUrl: `https://discord.com/oauth2/authorize?${params}` });
      }
      if (action === 'notes') {
        await authorize(session, id);
        if (req.method === 'POST') {
          const data = await body(req);
          if (typeof data.notes !== 'string' || data.notes.length > 2000) throw new HttpError(400, 'Notes must be text, up to 2000 characters.');
          db.prepare('INSERT OR REPLACE INTO notes VALUES (?, ?)').run(id, data.notes);
        }
        return json(res, 200, { notes: db.prepare('SELECT value FROM notes WHERE guild = ?').get(id)?.value || '' });
      }
      if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
      const data = await body(req);
      if (action === 'preview') {
        const hasTemplate = typeof data.templateId === 'string';
        const hasStructure = Object.hasOwn(data, 'structure');
        if (Object.keys(data).some(key => !['templateId', 'structure'].includes(key)) || hasTemplate === hasStructure) {
          throw new HttpError(400, 'Provide exactly one built-in template ID or custom structure.');
        }
        const state = await snapshot(session, id);
        const requested = hasTemplate ? data.templateId : data.structure;
        const plan = makePlan(requested, state.roles, state.channels);
        session.preview = { id, plan, nonce: random(), expires: Date.now() + 5 * 60000 };
        persist(); return json(res, 200, { ...plan, nonce: session.preview.nonce, expires: session.preview.expires });
      }
      if (action === 'apply') {
        const result = await lock(id, async () => {
          // Reload the authoritative session inside the lock; a queued body may carry stale state.
          const stored = db.prepare('SELECT data FROM sessions WHERE id = ? AND expires > ?').get(sessionKey(sid), Date.now());
          if (!stored) throw new HttpError(401, 'Session expired. Sign in again.');
          session = decrypt(stored.data);
          const pending = session.preview;
          if (!pending || pending.id !== id || pending.expires < Date.now() || !equal(data.nonce, pending.nonce) || data.confirm !== `APPLY ${id}`) throw new HttpError(409, 'Preview expired or confirmation does not match. Preview again.');
          delete session.preview; persist();
          const state = await snapshot(session, id);
          const current = makePlan(pending.plan.structure, state.roles, state.channels);
          if (current.fingerprint !== pending.plan.fingerprint) throw new HttpError(409, 'Server structure changed. Review a fresh preview.');
          return applyPlan(current, (step, parentId) => {
            const path = step.kind === 'role' ? `/guilds/${id}/roles` : `/guilds/${id}/channels`;
            const payload = step.kind === 'role' ? { name: step.name, permissions: '0', mentionable: false } : { name: step.name, type: step.kind === 'category' ? 4 : 0, ...(parentId ? { parent_id: parentId } : {}) };
            return bot(path, { method: 'POST', headers: { 'X-Audit-Log-Reason': encodeURIComponent(`Chaotic Command setup by ${session.user.id}`) }, body: JSON.stringify(payload) });
          });
        });
        return json(res, 200, result);
      }
      throw new HttpError(404, 'Not found.');
    } catch (error) {
      if (!res.headersSent) json(res, error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : 'Unexpected server error. Check server configuration and retry.' });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  return { server, db, close: () => new Promise(resolveClose => { server.close(() => { db.close(); resolveClose(); }); server.closeIdleConnections(); }) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log('Chaotic Command listening. Open APP_ORIGIN in your browser.'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { app.close().then(() => process.exit(0)); });
}

import process from 'node:process';
import http from 'node:http';

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';

// ---------------------------------------------------------------- env
const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const logFormat = process.env.LOG_FORMAT === 'json' ? 'json' : 'text';
const healthPort = Number(process.env.BOT_HEALTH_PORT || 0);

function requireEnv(name, value) {
  if (!value) {
    log('error', `missing required environment variable ${name}`, { var: name });
    process.exit(1);
  }
  return value;
}

requireEnv('DISCORD_BOT_TOKEN', token);

// ---------------------------------------------------------------- logging
function log(level, message, extra = {}) {
  const entry = { ts: new Date().toISOString(), level, app: 'discord-bot', message, ...extra };
  const line = logFormat === 'json' ? JSON.stringify(entry) : `[discord-bot] ${level}: ${message}${Object.keys(extra).length ? ' ' + JSON.stringify(extra) : ''}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}

// ---------------------------------------------------------------- status
const status = {
  state: 'starting',
  connectedSince: null,
  lastReadyAt: null,
  lastSequence: null,
  reconnectAttempts: 0,
  lastError: null,
};

// ---------------------------------------------------------------- gateway
const intents = 1; // GUILDS: enough for the initial Gateway worker and slash-command lifecycle.
let socket;
let heartbeatTimer;
let reconnectTimer;
let sequence = null;
let sessionId = null;
let resumeGatewayUrl = null;
let shuttingDown = false;
let reconnectAttempt = 0;

function clearTimers() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = undefined;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(payload));
  return true;
}

function heartbeat() {
  send({ op: 1, d: sequence });
}

async function discordRequest(path, options = {}) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord API ${response.status} ${path}: ${body}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function validateBot() {
  const bot = await discordRequest('/users/@me');
  log('info', `authenticated as ${bot.username}`, { botId: bot.id });

  if (applicationId && bot.id !== applicationId) {
    throw new Error(`DISCORD_APPLICATION_ID ${applicationId} does not match bot user ${bot.id}`);
  }
}

async function registerHealthCommand() {
  if (!applicationId || !guildId) {
    log('info', 'slash-command registration skipped; set DISCORD_APPLICATION_ID and DISCORD_GUILD_ID to enable it');
    return;
  }

  await discordRequest(`/applications/${applicationId}/guilds/${guildId}/commands`, {
    method: 'PUT',
    body: JSON.stringify([
      {
        name: 'chaotic-health',
        description: 'Check the Chaotic Command bot status',
      },
    ]),
  });
  log('info', 'registered development commands', { guildId });
}

function scheduleReconnect(reason, immediate = false) {
  if (shuttingDown || reconnectTimer) return;
  clearTimers();
  reconnectAttempt += 1;
  status.reconnectAttempts = reconnectAttempt;
  const delay = immediate ? 0 : Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempt - 1, 5));
  log('info', `reconnecting in ${delay}ms`, { reason });
  reconnectTimer = setTimeout(connect, delay);
}

function identify() {
  send({
    op: 2,
    d: {
      token,
      intents,
      properties: {
        os: process.platform,
        browser: 'chaotic-command',
        device: 'chaotic-command',
      },
    },
  });
}

function resume() {
  send({
    op: 6,
    d: {
      token,
      session_id: sessionId,
      seq: sequence,
    },
  });
}

function handleDispatch(event, data) {
  if (event === 'READY') {
    reconnectAttempt = 0;
    status.reconnectAttempts = 0;
    sessionId = data.session_id ?? sessionId;
    resumeGatewayUrl = data.resume_gateway_url ?? resumeGatewayUrl;
    status.state = 'ready';
    status.connectedSince = new Date().toISOString();
    status.lastReadyAt = status.connectedSince;
    log('info', 'Gateway READY', { guilds: data.guilds?.length ?? 0, sessionId });
    return;
  }

  if (event === 'RESUMED') {
    status.state = 'ready';
    log('info', 'Gateway session RESUMED');
    return;
  }

  if (event === 'INTERACTION_CREATE') {
    log('info', 'received interaction', { id: data.id, name: data.data?.name ?? 'unknown' });
    // Interaction handlers, tickets, moderation cases, and approval workflows will be added next.
  }
}

function handleMessage(raw) {
  const message = JSON.parse(raw);
  if (message.s !== null && message.s !== undefined) {
    sequence = message.s;
    status.lastSequence = message.s;
  }

  if (message.op === 10) {
    const interval = Number(message.d.heartbeat_interval);
    heartbeatTimer = setInterval(heartbeat, interval);
    if (sessionId && sequence !== null) resume();
    else identify();
    return;
  }

  if (message.op === 11) return;
  if (message.op === 1) {
    heartbeat();
    return;
  }
  if (message.op === 7) {
    socket?.close(1000, 'Discord requested reconnect');
    return;
  }
  if (message.op === 9) {
    // d === false means the session is not resumable; drop it and re-identify.
    if (message.d === false) {
      log('warn', 'Discord invalidated the session; re-identifying');
      sessionId = null;
      sequence = null;
      resumeGatewayUrl = null;
      status.state = 'reconnecting';
      socket?.close(4000, 'invalid session');
    } else {
      log('info', 'Discord requested session resume');
      socket?.close(4000, 'resume session');
    }
    return;
  }
  if (message.op === 0) handleDispatch(message.t, message.d);
}

function connect() {
  if (shuttingDown) return;
  clearTimers();
  const url = resumeGatewayUrl ? `${resumeGatewayUrl}/?v=10&encoding=json` : DISCORD_GATEWAY;
  socket = new WebSocket(url);

  socket.addEventListener('open', () => log('info', 'Gateway connection opened'));
  socket.addEventListener('message', (event) => {
    try {
      handleMessage(String(event.data));
    } catch (error) {
      status.lastError = String(error);
      log('error', 'Gateway message error', { error: String(error) });
      socket?.close(1011, 'worker error');
    }
  });
  socket.addEventListener('error', (event) => {
    status.lastError = String(event.error ?? event);
    log('error', 'Gateway error', { error: String(event.error ?? event) });
  });
  socket.addEventListener('close', (event) => {
    clearTimers();
    if (event.code === 4007 || event.code === 4009) {
      sessionId = null;
      sequence = null;
      resumeGatewayUrl = null;
    }
    if (status.state === 'ready') status.state = 'disconnected';
    log('info', 'Gateway closed', { code: event.code, reason: event.reason || 'no reason' });
    scheduleReconnect(`close code ${event.code}`);
  });
}

// ---------------------------------------------------------------- health endpoint
function startHealthEndpoint() {
  if (!healthPort) return;
  const server = http.createServer((req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    const healthy = status.state === 'ready';
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  });
  server.listen(healthPort, '0.0.0.0', () => log('info', 'health endpoint listening', { port: healthPort }));
}

// ---------------------------------------------------------------- lifecycle
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimers();
  log('info', 'shutting down', { signal });
  const done = () => process.exit(0);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close(1000, 'worker shutdown');
    setTimeout(done, 3_000).unref();
  } else {
    done();
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await validateBot();
  await registerHealthCommand();
  startHealthEndpoint();
  connect();
} catch (error) {
  log('error', 'startup failed', { error: String(error) });
  process.exit(1);
}

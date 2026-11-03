import process from 'node:process';

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';
const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) {
  console.error('[discord-bot] DISCORD_BOT_TOKEN is required');
  process.exit(1);
}

const intents = 1; // GUILDS: enough for the initial Gateway worker and slash-command lifecycle.
let socket;
let heartbeatTimer;
let reconnectTimer;
let sequence = null;
let shuttingDown = false;
let reconnectAttempt = 0;

function log(message, details = '') {
  console.log(`[discord-bot] ${message}${details ? ` ${details}` : ''}`);
}

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
  log(`authenticated as ${bot.username} (${bot.id})`);

  if (applicationId && bot.id !== applicationId) {
    throw new Error(`DISCORD_APPLICATION_ID ${applicationId} does not match bot user ${bot.id}`);
  }
}

async function registerHealthCommand() {
  if (!applicationId || !guildId) {
    log('slash-command registration skipped; set DISCORD_APPLICATION_ID and DISCORD_GUILD_ID to enable it');
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
  log(`registered development commands for guild ${guildId}`);
}

function scheduleReconnect(reason) {
  if (shuttingDown || reconnectTimer) return;
  clearTimers();
  reconnectAttempt += 1;
  const delay = Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempt - 1, 5));
  log(`reconnecting in ${delay}ms`, reason);
  reconnectTimer = setTimeout(connect, delay);
}

function handleDispatch(event, data) {
  if (event === 'READY') {
    reconnectAttempt = 0;
    log(`Gateway READY as ${data.user?.username ?? 'bot'} in ${data.guilds?.length ?? 0} guild(s)`);
    return;
  }

  if (event === 'INTERACTION_CREATE') {
    log(`received interaction ${data.id} (${data.data?.name ?? 'unknown'})`);
    // Interaction handlers, tickets, moderation cases, and approval workflows will be added next.
  }
}

function handleMessage(raw) {
  const message = JSON.parse(raw);
  if (message.s !== null && message.s !== undefined) sequence = message.s;

  if (message.op === 10) {
    const interval = Number(message.d.heartbeat_interval);
    heartbeatTimer = setInterval(heartbeat, interval);
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
    throw new Error('Discord invalidated the session');
  }
  if (message.op === 0) handleDispatch(message.t, message.d);
}

function connect() {
  if (shuttingDown) return;
  clearTimers();
  socket = new WebSocket(DISCORD_GATEWAY);

  socket.addEventListener('open', () => log('Gateway connection opened'));
  socket.addEventListener('message', (event) => {
    try {
      handleMessage(String(event.data));
    } catch (error) {
      console.error('[discord-bot] Gateway message error', error);
      socket?.close(1011, 'worker error');
    }
  });
  socket.addEventListener('error', (event) => {
    console.error('[discord-bot] Gateway error', event.error ?? event);
  });
  socket.addEventListener('close', (event) => {
    clearTimers();
    log(`Gateway closed (${event.code})`, event.reason || 'no reason');
    scheduleReconnect(`close code ${event.code}`);
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimers();
  log(`shutting down on ${signal}`);
  socket?.close(1000, 'worker shutdown');
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await validateBot();
  await registerHealthCommand();
  connect();
} catch (error) {
  console.error('[discord-bot] startup failed', error);
  process.exit(1);
}

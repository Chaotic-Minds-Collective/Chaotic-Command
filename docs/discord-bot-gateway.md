# Discord bot gateway worker

Covers `apps/discord-bot/index.mjs`, the standalone Discord Gateway worker. It is dependency free: it uses Node built-ins only (HTTP, fetch, the global WebSocket) and runs on Node 24 or newer.

## What it does

- Maintains a persistent Gateway connection: heartbeat, identify, resume, reconnect.
- Registers the development slash command `/chaotic-health` in the configured guild at startup.
- Exposes an optional HTTP health endpoint for uptime checks.

It does not handle interactions yet. The dispatcher logs `INTERACTION_CREATE` events and is the extension point for tickets, moderation, and approval workflows.

## Running

```sh
npm run start:bot
# or: node --env-file-if-exists=.env apps/discord-bot/index.mjs
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | yes | Bot user token. Never commit. |
| `DISCORD_APPLICATION_ID` | no | Validated against the token at startup; startup fails on mismatch. |
| `DISCORD_GUILD_ID` | no | Dev guild used for slash-command registration. Registration is skipped when unset. |
| `BOT_HEALTH_PORT` | no | Port for the HTTP health endpoint. `0` disables it (default). |
| `LOG_FORMAT` | no | `text` (default) or `json` for structured logs. |

## Connection lifecycle

1. Startup validates the token against `/users/@me` and optionally registers commands before connecting.
2. On the Hello event (op 10) the worker starts heartbeating and sends Identify (op 2), or Resume (op 6) when saved session state exists.
3. On READY it stores `session_id` and `resume_gateway_url` and resets the reconnect backoff to zero.
4. Every subsequent heartbeat uses the latest sequence number.

## Reconnect and session recovery

The worker keeps three pieces of session state: session id, last sequence number, and the resume gateway URL from READY.

- **Backoff:** reconnects wait `1s * 2^(attempt - 1)`, capped at 30s. A successful READY resets the attempt counter, so the first retry after a healthy session is 1 second, inside the resume window.
- **Op 7 (reconnect request):** the socket is closed with code 1000 and the reconnect path starts a new connection. The close handler retains cached session state, so the next Hello attempts Resume. Discord invalidates a session after a client-initiated code 1000 close, so this attempt can fail before the worker re-identifies.
- **Op 9 with `d: false` (session not resumable):** session state and the resume gateway URL are cleared, the socket closes with code 4000, and the next connection re-identifies.
- **Op 9 with `d: true` (resumable invalid session):** the worker closes the current socket with code 4000 instead of resuming in place. The reconnect path then opens `resume_gateway_url`, and the Hello handler sends Resume on the new connection. This matches the Discord Gateway resume procedure: Resume belongs on a fresh connection, not on the socket that received the invalid session event.
- **Close codes 4007 and 4009:** session state is cleared before reconnecting so the next connection re-identifies instead of sending a doomed Resume.
- **Other close codes:** session state is kept, including after code 1000, so the first reconnect attempt tries to resume.

Code 4000 is used for the Op 9 close paths and preserves resumability. Code 1000 (normal closure) does not.

## Health endpoint

When `BOT_HEALTH_PORT` is set, the worker serves `GET /health` on that port:

- `200` with a JSON status object when the gateway state is `ready`.
- `503` otherwise.

The status object includes state, connected-since and last-ready timestamps, last sequence number, reconnect attempt count, and the last error (`lastError`). The endpoint binds to `0.0.0.0` and does not authenticate requests. Restrict access to a trusted monitoring network.

## Graceful shutdown

`SIGTERM` and `SIGINT` clear timers, close the socket with code 1000, and exit within 3 seconds.

## Tests

Regression tests for the session recovery behavior live in `apps/discord-bot/test/gateway.test.mjs`. Run the targeted Discord bot test suite with:

```sh
node --test apps/discord-bot/test/*.test.mjs
```

# Chaotic Command

A working, dependency-free Discord setup MVP alongside the original Bit/GuildPilot design prototype.

## Run locally

Requires **Node.js 24 or newer**. The runtime uses built-in HTTP, crypto and SQLite; no package installation or Bit account is required. Node may print an experimental SQLite warning on some releases.

```sh
cp .env.example .env
# Fill in the values described below. Never commit .env.
node --env-file-if-exists=.env apps/command/server.mjs
# Or: npm start
```

Open http://localhost:3000. Without credentials, the UI explains configuration and safely disables login. To develop: `npm run dev`. Validate with `npm run check` and `npm test`, or run `node --test apps/command/test/*.test.mjs` directly. There is no frontend compilation step: the server serves the vanilla browser app directly.

## Discord configuration

1. Create an application at https://discord.com/developers/applications.
2. Under OAuth2, register **exactly** `http://localhost:3000/auth/callback` (or `${APP_ORIGIN}/auth/callback` for your deployment). Set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in `.env`.
3. Under Bot, create/reset the bot token and set `DISCORD_BOT_TOKEN`. Do not put tokens in browser code, URLs, GitHub issues, or any `VITE_` variable.
4. Generate `SESSION_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep it stable across restarts. Changing it invalidates encrypted sessions.
5. Restart, sign in, and select a server where you have **Manage Server** or Administrator permission. Use the bot installation link in the UI. The bot requests **Manage Channels** and **Manage Roles**, not Administrator. Put its role above roles it will create. No privileged Gateway intents are required; this MVP uses REST only.
6. Reselect the server, choose a template, and preview. Review every create/reuse item and channel visibility. Type the requested `APPLY <server-id>` confirmation, then accept the final browser confirmation. Only then are Discord writes sent.

## What works

- Real Discord OAuth with expiring state, session rotation, HttpOnly/SameSite cookies, server-side tokens, AES-256-GCM encrypted sessions, and logout.
- Live manageable-server listing, fresh authorization on every server operation, bot permission preflight, and server role/channel counts.
- Additive community/gaming/support templates. New roles receive **zero permissions** and are not assigned to members. Existing roles are reused without changing their permissions; existing exact-match channels are reused only within the matching category. New channels inherit category/server visibility and may be public; these templates are not a security configuration.
- Expiring, single-use, server-bound previews; changed-plan rejection; sequential writes, bounded Discord rate-limit retries, timeouts, per-server concurrency locks and partial-progress reports. A retry requires a new preview and reuses exact matches. No deletion, rollback, moderation actions or messages are sent.
- Shared server notes persisted in SQLite and restricted to current server managers. Notes do not activate automations.

## Storage and deployment

`DATA_DIR` defaults to `.data` and contains `command.sqlite` plus SQLite WAL files. Restrict access and back up the whole data directory. Sessions expire after eight hours or when the Discord access token expires, whichever comes first; users then sign in again. OAuth tokens are encrypted at rest; notes are plaintext and should not contain secrets. Logout deletes the local session (it does not revoke the Discord application grant).

For deployment set `NODE_ENV=production`, `APP_ORIGIN=https://your-domain`, a stable strong `SESSION_SECRET`, and `HOST=0.0.0.0` if your platform needs it. Terminate HTTPS at a trusted reverse proxy and route all paths to this process. Default binding is loopback for safe local use. Secure cookies are enabled for HTTPS. Mount a private persistent data directory. Keep a **single process/replica**: the setup lock is process-local. Put request/rate limits at the reverse proxy before public exposure; do not expose a development instance to the internet. The runtime limits body size and session count, uses CSP, checks exact POST Origin + CSRF, and never serves files outside its static allowlist.

Discord operations are not transactional. API failures may leave some created objects; inspect the partial report and preview again. Concurrent changes made directly in Discord can still occur after preflight. Test first in a disposable server. Automated tests use fixtures, never real Discord credentials or writes; live OAuth/install/apply still require a manual acceptance test.

## Scope and original workspace

This is a functional setup foundation, **not a completed AI Discord controller**. AI generation, ticket systems, moderation, member onboarding, welcome messages, role assignment, private-channel permission setup, and long-running Gateway automations are not implemented. No UI switch pretends to enable these systems.

The original component design workspace remains under `guildpilot/`, `design/`, `.bitmap`, `workspace.jsonc`, and `pnpm-lock.yaml`. Its pages are mock prototypes and are intentionally not used by this standalone runtime. Continue using Bit tooling for those components; the root start/test scripts target only `apps/command`. This repair does not publish Bit components or modify their versions.

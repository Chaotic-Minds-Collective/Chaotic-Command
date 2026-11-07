# Chaotic Command Discord Bot (shared bot)

HTTP-only Discord bot for the Chaotic Minds Collective ecosystem, hosted on
Cloudflare Workers (free tier, no gateway process, no spin-down).

- Interactions: slash commands + buttons/selects/modals via the Interactions Endpoint
- Webhook events: onboarding DM on APPLICATION_AUTHORIZED
- Components v2 (Containers / Text Display) for the Chaotic branded look
- State: Supabase REST (bot_guilds, bot_tickets, bot_pending) - shared with the command center
- Zero npm dependencies; tests via node:test

## Files

- src/index.js - Worker entry: signature verification, routing, /register
- src/commands.js - slash command definitions (7 commands)
- src/handlers.js - setup / welcome / tickets / moderation / announcements / config / help
- src/lib.js - Ed25519 verification + component builders + Discord REST wrapper
- src/store.js - Supabase REST client
- migrations/001_bot_tables.sql - Supabase tables + RLS
- test/bot.test.mjs - 12 end-to-end tests with mocked Discord + Supabase

## One-time setup checklist (Developer Portal)

1. Reuse the existing idle bot application, rename it "Chaotic Command".
   - General Information: copy Application ID and Public Key.
   - Bot tab: Reset Token, store it in 1Password (never in chat or git).
2. Installation page: enable Guild Install AND User Install.
   - Guild default: scopes bot + applications.commands; permissions: Manage Channels,
     Manage Roles, Manage Messages, Send Messages, Embed Links, Read Message History,
     Use Slash Commands, Kick Members, Ban Members, Moderate Members.
   - User default: scope applications.commands.
3. No privileged gateway intents are needed (HTTP-only bot).
4. After first deploy: set the Interactions Endpoint URL to the workers.dev URL.
5. App settings -> Webhooks: same URL; enable events; subscribe
   APPLICATION_AUTHORIZED and APPLICATION_DEAUTHORIZED.
6. GitHub repo secrets (drives deploys + Worker secrets):
   CLOUDFLARE_API_TOKEN (Workers Scripts:Edit template),
   BOT_DISCORD_TOKEN, BOT_DISCORD_PUBLIC_KEY, BOT_DISCORD_APPLICATION_ID,
   BOT_REGISTER_SECRET, BOT_SUPABASE_SERVICE_KEY, BOT_WORKER_URL (after first deploy).

## Deploy

Push to main runs .github/workflows/deploy-discord-bot.yml:
wrangler deploy via GitHub Actions (no local installs), then wrangler secret put
for each secret, then POST /register to install slash commands globally.

## Known limit

Discord does not deliver member-join events over webhooks, so welcome-on-join
needs a Gateway connection (Durable Object or a small gateway microservice).
Welcome configuration, preview and test work fully over HTTP today.

# Connect your own Discord bot

This guide explains how to connect a Discord bot that you own to Chaotic Command.

## Before you begin

You need:

- A Discord account that can manage the server you want to configure.
- Permission to create an application in the Discord Developer Portal.
- Access to the Chaotic Command site over HTTPS.
- A bot application that you control.

**Important:** You still sign in to Chaotic Command using its normal **Sign in with Discord** button. You do not need to create an OAuth application for Chaotic Command, provide an application client secret, or configure an OAuth redirect URL for your personal bot. Your personal bot is connected with its bot token only.

## 1. Create your Discord application and bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select **New Application** and give the application a name.
3. Open the application's **Bot** page.
4. Add a bot user if Discord has not already created one for the application.
5. Use the token controls on the Bot page to generate or reset the bot token.
6. Copy the bot token and keep it private.

Do not paste the token into a chat, support ticket, screenshot, public repository, or any website other than your HTTPS Chaotic Command connection form. If you believe the token has been exposed, reset it in the Developer Portal before reconnecting.

## 2. Sign in to Chaotic Command

1. Open Chaotic Command.
2. Select **Sign in with Discord**.
3. Authorize the requested Discord identity and server-list access.
4. Wait for your workspace to load.

This sign-in authorizes Chaotic Command to identify your Discord account and list servers you can manage. It is separate from the bot token you are about to connect.

## 3. Connect your bot

1. Find **Your Discord bots**.
2. Paste the bot token into **Discord bot token**.
3. Select **Verify and connect bot**.
4. Chaotic Command checks the token with Discord.
5. If Discord confirms it is a bot account, Chaotic Command stores the credential encrypted and selects it as your default bot.

The token is not returned to the browser after it is saved, and it is not displayed in your bot list. You can connect up to five personal bots to your account.

If verification fails, check that you copied the bot token, not the application ID, public key, or client secret.

## 4. Install the bot in your Discord server

1. Choose a server from the server list.
2. Choose the bot you want that server to use.
3. Select **Use selected bot** to assign it to that server.
4. Select **Install bot in selected server**.
5. Complete Discord's authorization flow.

Chaotic Command requests these bot permissions:

- **Manage Channels**
- **Manage Roles**

The bot does not need the Administrator permission. Make sure its role is positioned appropriately in the server's role hierarchy. Discord must allow the bot to manage the roles and channels required by your plan.

A bot must be installed in a server before Chaotic Command can audit or configure that server with it.

## 5. Choose different bots for different servers

Your account has a default bot. You can also assign a different connected bot to each server:

1. Select the server.
2. Choose a connected bot in **Your Discord bots**.
3. Select **Use selected bot**.
4. The assignment is saved for that server.

The selected server keeps its own assignment. Changing the default bot does not overwrite a server-specific assignment.

## 6. Preview and configure your server

After the bot is installed and has the required permissions:

1. Select the server.
2. Confirm the status says the bot is ready.
3. Run a read-only audit if you want to review the existing server first.
4. Choose a built-in template or create a custom structure.
5. Review the preview carefully.
6. Type the exact confirmation phrase.
7. Select **Apply confirmed changes** only when you are ready.

The existing additive setup safeguards still apply. Chaotic Command does not delete server objects or change existing role permissions. New roles start with zero permissions and are not assigned to members. New channels may be visible according to the server or category's existing visibility rules.

Discord operations are not transactional. If an operation partially fails, inspect the server and create a fresh preview before retrying.

## 7. Remove or replace a connected bot

To remove a personal bot credential from Chaotic Command:

1. Select the personal bot in the bot list.
2. Select **Remove selected personal bot**.
3. Confirm the removal.

This removes the stored credential and its per-server assignments from Chaotic Command. It does not delete the Discord application, revoke the token at Discord, or remove the bot from servers.

To replace a token:

1. Reset the token in the Discord Developer Portal.
2. Remove the old connection from Chaotic Command.
3. Connect the bot again using the new token.
4. Reinstall or reauthorize the bot in servers if Discord requires it.

If a token may have been exposed, reset it at Discord immediately. Removing it from Chaotic Command alone does not invalidate the token.

## Troubleshooting

### Discord says the token is invalid

Make sure you copied the bot token from the application's Bot page. Do not use the application ID, public key, client secret, or OAuth authorization code.

### The server does not appear

Your signed-in Discord account must have **Manage Server** permission or be the server owner. Refresh the server list after changing permissions.

### Chaotic Command says the bot is not installed

Use the installation link shown for the selected server and selected bot. Confirm the Discord authorization flow completed successfully.

### The bot is installed but not ready

Check that it has **Manage Channels** and **Manage Roles** in the server. Review role hierarchy and make sure the bot is not blocked from managing the objects it needs.

### The wrong bot is being used

Select the server, choose the intended bot, and select **Use selected bot**. Each server can have its own bot assignment.

### The bot token may have been exposed

Reset the token in the Discord Developer Portal, remove the old credential from Chaotic Command, and connect the new token. Do not rely on removing the stored credential alone to revoke a leaked token.

## What Chaotic Command stores

Chaotic Command stores the bot's Discord ID, display name, and an encrypted bot token associated with your signed-in Discord account. Bot credentials are encrypted at rest using AES-256-GCM. The token is never included in the bot-list response.

Only connect bots through the HTTPS Chaotic Command site. Your Discord bot and application remain under your control.

## Changing bots after a preview

If you change the selected bot after creating a setup preview, create and review a fresh preview before applying. Chaotic Command rejects a stale preview even if the proposed channel names are unchanged. Changes to the server's roles, channel layout, or permission overwrites can also require a new preview.

If setup is already running, it continues with the bot that was checked for that operation; a new selection applies to the next operation. Changing a selection does not cancel running setup. Always inspect a partial-progress report before retrying.

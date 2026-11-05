# Chaotic Command documentation index

## Product guides (docs/product/)

End-user and operator documentation for Chaotic Command itself - previously hosted separately. Start at [product/index.md](product/index.md); the guide set covers:

| Area | Guides |
| --- | --- |
| Getting started | [quickstart](product/quickstart.md), [FAQ](product/faq.md), [troubleshooting](product/troubleshooting.md) |
| Server owners | [install the bot](product/owners/install-the-bot.md), [safe setup](product/owners/safe-setup.md) |
| Administrators | [role permissions](product/admins/role-permissions.md), [channel visibility](product/admins/channel-visibility.md) |
| Members | [what to expect](product/members/what-to-expect.md) |
| In-depth guides | [preview and review](product/guides/preview-and-review.md), [custom server structure](product/guides/custom-server-structure.md), [apply setup](product/guides/apply-setup.md), [choose a server template](product/guides/choose-server-template.md), [AI-assisted structure design](product/guides/ai-assisted-structure-design.md), [saved server structures](product/guides/saved-server-structures.md), [server notes](product/guides/server-notes.md) |
| Reference | [feature status](product/reference/feature-status.md), [product changelog](product/reference/changelog.md) |
| Development | [architecture](product/developers/architecture.md), [local development](product/developers/local-development.md), [integrations](product/developers/integrations.md), [security and operations](product/developers/security-and-operations.md) |

## Technical documentation

| Document | Covers |
| --- | --- |
| [customer-bring-your-own-bot.md](customer-bring-your-own-bot.md) | Connecting and operating a customer-owned Discord bot (credentials, storage, removal behavior) |
| [discord-bot-gateway.md](discord-bot-gateway.md) | Discord bot gateway architecture and connection lifecycle |
| [development-audit-2026-10-30.md](development-audit-2026-10-30.md) | Current development audit: verified behavior, limits, and next steps |
| [development-audit-supplement-2026-10-31.md](development-audit-supplement-2026-10-31.md) | Follow-up audit notes supplementing the October 30 audit |
| [discord-roles-permissions-operations.md](discord-roles-permissions-operations.md) | Role permission model and safe operations guidance |
| [environment-reference.md](environment-reference.md) | Environment variables and runtime configuration reference |
| [discord-websocket-notes.md](discord-websocket-notes.md) | Notes on Discord WebSocket behavior relevant to the bot |
| [oauth-flow.md](oauth-flow.md) | Discord OAuth flow implementation details |
| [apply-locking.md](apply-locking.md) | Per-server operation locking for apply operations |

## Conventions

- Documentation changes go through a branch and pull request, like code.
- Product guides describe the current `main` baseline; mark unmerged work as planned or in review, never as available.
- Keep the changelog entries factual about what merged; do not describe proposals as shipped features.

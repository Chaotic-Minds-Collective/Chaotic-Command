# Chaotic Command development audit follow-up: 2026-10-30

## Scope and source

- Repository: `Chaotic-Minds-Collective/Chaotic-Command`.
- Branch inspected: `main`.
- Inspected main commit: `499bf58e673e2166d32e027579585d90a03fb0e4`.
- Repository visibility: private.
- Default branch: `main`.
- The current recursive tree contains 236 entries and is not truncated.
- The repository currently has no open issues in the inspected issue list.
- Fifteen pull requests are merged. The most recent merged pull request is #15.
- This is a follow-up to `docs/development-audit-2026-10-30.md`. The earlier report remains a historical snapshot at commit `26797e86e5dce76c5977759a938540b75e3813de`.

## Changes since the earlier audit

The earlier audit ended at PR #13. The current main branch also contains:

| Pull request | Merge commit | Verified change |
| --- | --- | --- |
| #14 | `7a99a6382c30778e8c65cee5f48835557d63cb4d` | Bind setup previews to bot identity and permission context |
| #15 | `499bf58e673e2166d32e027579585d90a03fb0e4` | Add SQLite persistence and encrypted credential recovery tests |

PR #14 adds preview binding to the selected bot identity and canonical role, channel, and permission-overwrite context. It also ensures one captured bot credential is used for an active snapshot or apply operation. This reduces the chance of applying a preview after changing the selected bot or relevant server permissions.

PR #15 adds `apps/command/test/persistence.test.mjs` and `docs/sqlite-persistence-testing.md`. Its verification record reports 36 of 36 tests passing on Node.js v24.22.1. The tests cover application restart, clean-shutdown database-copy recovery, mismatched encryption keys, corrupted encrypted records, and reopening the database in a separate Node.js process.

These tests use offline fixtures and mocked Discord responses. They do not establish live Discord acceptance, hot-backup recovery, abrupt-crash recovery, browser visual behavior, or multi-process safety.

## Current architecture

The active application is a dependency-free Node.js runtime in `apps/command`.

| Path | Responsibility |
| --- | --- |
| `apps/command/server.mjs` | HTTP server, Discord OAuth, sessions, API routes, SQLite access, credential encryption, and static-file allowlist |
| `apps/command/core.mjs` | Templates, structure validation, read-only audit, setup planning, apply operations, and per-server locks |
| `apps/command/web/` | Vanilla browser interface, HTML, CSS, and JavaScript |
| `apps/command/test/` | Node.js tests using mocked Discord responses and offline fixtures |
| `docs/` | Application runbooks, acceptance checklists, and engineering audit records |

The root `package.json` declares Node.js 24 or newer and provides `start`, `dev`, `test`, and `check` scripts. The active runtime does not require a frontend build step or package installation. It uses built-in Node.js HTTP, crypto, and SQLite modules.

The original React/TypeScript Bit workspace remains under `design/` and `guildpilot/`, with `.bitmap`, `workspace.jsonc`, and `pnpm-lock.yaml`. The original GuildPilot prototype uses mock data and is not wired into the active runtime. Preserve this workspace and do not regenerate or delete it as part of standalone runtime work.

## Current implemented capabilities

- Discord OAuth sign-in and manageable-server listing.
- Optional shared bot and up to five customer-owned bots per account.
- AES-256-GCM encrypted customer bot credentials and account-scoped assignments.
- Community, Gaming, and Support setup templates.
- Validated custom role, category, and text-channel structures.
- Up to 20 personal saved structures per account.
- User-directed AI prompt generation and JSON import. No AI provider is called.
- Read-only existing-server audit for supported role, category, and channel findings.
- Expiring, single-use setup previews bound to the selected bot identity and relevant permission context.
- Additive apply operations with exact confirmation, role permission review, and partial-progress reporting.
- SQLite persistence for sessions, saved structures, shared notes, bot credentials, and bot assignments.

## Current limits

The current application is a functional setup foundation, not a complete Discord command center.

Not implemented:

- Creating a new Discord guild or server through the application.
- Full existing-server revamp operations such as moving, renaming, reordering, or deleting existing objects.
- Editing existing role permissions or configuring private-channel permission policies.
- Ticket systems, moderation, onboarding, welcome messages, automatic role assignment, or long-running Gateway automations.
- Direct in-app AI provider integration.
- A Composio adapter in the active runtime.

The existing-server audit is read-only. The setup flow adds missing objects to a server the user already manages. It does not reorganize existing objects or calculate effective member visibility.

## Branch audit

At the time of inspection, the application repository had two existing branches: `main` and `website/rebuild-foundation`.

The `website/rebuild-foundation` branch is five commits ahead of and five commits behind `main`. It contains a public landing page, responsive styling, route changes that separate the homepage from the command workspace, and tests for those routes. It is not merged and has no corresponding open pull request in the inspected PR list.

Do not merge that branch blindly. Its server and test files were based on the earlier main commit at PR #13. Reconcile its route changes against the newer PR #14 preview safeguards and PR #15 persistence work.

A separate main-based review branch, feature/public-homepage-mainline, now carries the ported homepage and route changes. Draft [PR #17](https://github.com/Chaotic-Minds-Collective/Chaotic-Command/pull/17) preserves the current security and persistence code, keeps the command workspace at /command, and corrects the product copy. GitHub Actions runs #167 (push) and #168 (pull_request) both completed successfully on commit 99abd252c04b2a10ca3456fa3abe1b95246738e2. The PR remains a draft and is not merged or deployed.

## Documentation status

The Mintlify deployment `chaoticcommand` is connected to the public GitHub repository `psyryn82/mintlify-docs`, using `main` as its deploy branch.

A draft documentation pull request has been opened in that repository:

- [Documentation PR #6](https://github.com/psyryn82/mintlify-docs/pull/6)
- Adds a Developer guide with architecture, local development, integrations, security and operations, and project status.
- Updates feature status and changelog against the current application baseline.
- Adds product-specific documentation repository instructions.
- Verifies that all 24 navigation page paths resolve to an existing MDX file.

The documentation changes are in draft [PR #6](https://github.com/psyryn82/mintlify-docs/pull/6). This application audit is tracked in draft [PR #16](https://github.com/Chaotic-Minds-Collective/Chaotic-Command/pull/16). Neither PR is merged, and the documentation has not been published to the live site.

## Composio assessment

The active application source uses direct Discord REST requests. No Composio SDK, adapter, or runtime orchestration layer is implemented in `apps/command`.

A future integration must preserve account ownership, per-server authorization, least-privilege tool allowlists, read-only audit and preview boundaries, explicit confirmation before writes, and offline adapter tests. A connected operator Composio account must not be treated as the user's own connection.

## Verification record and remaining gaps

- PR #15 records 36/36 offline tests passing on Node.js v24.22.1.
- The GitHub Actions workflow runs Node.js 24 syntax checks and the test suite on pushes and pull requests targeting `main`.
- The combined-status and workflow-run lookups for the current merge commit returned no status records during this audit. Do not infer a current hosted CI pass from older runs.
- Live OAuth, personal bot connection, bot installation, role hierarchy, audit, preview, and apply still require manual acceptance in a disposable Discord server.
- Browser visual and accessibility testing remain outstanding.
- Production backup automation, hot-backup consistency, abrupt-crash recovery, and multi-process coordination remain unverified.
- The preserved Bit workspace has not been built or type-checked as part of the standalone runtime verification.

## Next milestones

1. Finish and review the main-based public homepage change. Keep the command workspace at a separate route and preserve the existing security and persistence code.
2. Confirm the new homepage routes and all existing application tests through GitHub Actions.
3. Complete live acceptance in a disposable Discord server.
4. Add browser visual and accessibility tests.
5. Define a consistent SQLite backup and recovery procedure.
6. Restore and verify the preserved Bit workspace toolchain without recreating components.
7. Design a tenant-safe, read-only Composio adapter before considering write operations.
8. Plan new-guild provisioning and full existing-server revamp as separate features with action-specific previews and explicit approval gates.

## Operating boundaries

- Keep development within the approved $0 budget.
- Preserve existing code and the original Bit workspace.
- Do not deploy publicly without explicit approval.
- Do not modify live Discord servers without explicit approval.
- Do not add destructive server operations without explicit approval and action-specific previews.
- Never commit credentials or place them in documentation.
- Record changes, test results, and remaining blockers.

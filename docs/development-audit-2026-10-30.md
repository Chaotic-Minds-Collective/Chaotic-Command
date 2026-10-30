# Chaotic Command development audit — 2026-10-30

## Scope and provenance

- Source: `Chaotic-Minds-Collective/Chaotic-Command`, branch `main`, commit `26797e86e5dce76c5977759a938540b75e3813de`.
- Inspected the complete, non-truncated GitHub tree (233 entries); retrieved and Git-blob-verified 29 selected runtime, test, documentation, manifest, prototype, hook, theme and environment files.
- All 19 component roots recorded in `.bitmap` are present in the repository. This verifies directory presence, not completeness of the original Bit history or equivalence with Bit Cloud.
- Two branches were listed: `main` and `website/rebuild-foundation`; neither was marked protected by the branches API. The other branch was not modified or deeply audited. No tags or open issues/PRs were returned.
- The latest five main-branch CI runs inspected succeeded. The run for the pinned commit is https://github.com/Chaotic-Minds-Collective/Chaotic-Command/actions/runs/41094770012.
- Initial implementation and testing were performed in an isolated local review copy, without repository publication or external configuration changes. The owner subsequently approved pushing this safety patch to `fix/preview-bot-permission-binding` and opening a draft PR. No merge, deployment, Mintlify publication, Bit export, Discord mutation or paid provisioning is authorized by that approval.

## Architecture actually present

`apps/command` is a dependency-free Node.js HTTP/crypto/SQLite server with a vanilla JavaScript browser client. The supported target is Node.js 24+. Native `node:sqlite` persists sessions, shared guild notes, personal structures, encrypted bot credentials, and per-account/per-guild bot selections.

The original React/TypeScript Bit workspace remains under `guildpilot/` and `design/`, with `.bitmap`, `workspace.jsonc`, generated TypeScript configuration and the pnpm lockfile. The prototype imports mock server data and has separate Apollo/GraphQL-facing hooks; it is not wired into the standalone REST runtime. Preserve it. Do not replace the active app or regenerate the workspace as a new project.

## Existing functionality versus missing functionality

| Area | Present in inspected implementation | Not established / incomplete |
| --- | --- | --- |
| Authentication | Discord OAuth, state expiry, session rotation, encrypted server-side access token storage, CSRF/Origin checks and logout | Live OAuth acceptance; no refresh-token flow |
| Server discovery | Manageable-guild list, fresh user authorization per guild operation, server selection | This alone is not a public multi-tenant Composio integration |
| Build/setup | Built-in and validated custom additive structures, saved personal structures, preview, explicit apply confirmation and partial-progress reporting | Creating a brand-new Discord guild is not implemented by the runtime; roles are zero-permission and unassigned |
| Revamp/audit | Read-only role/channel inventory and review findings; additive setup can complement existing structures | Moving, renaming, deleting or reordering existing objects and editing permission policies are not implemented |
| AI assistance | User-directed prompt/JSON copy-paste workflow with server-side validation | No in-app AI provider calls or autonomous agent |
| Administration | SQLite-backed shared notes and account-scoped bot assignments | No working automation engine, tickets, moderation workflows or continuous health monitoring |
| Visual system | Preserved React theme and prototype; a separate working browser MVP | The owner confirmed there is no existing Figma design file; use the preserved prototype/theme as the current visual reference |
| Documentation | Customer BYOB guide, operator credential guide, acceptance plan and runbook | Published Mintlify pages and navigation have not been inspected/synchronized |

Server creation and revamping remain equally important product outcomes. Additive setup in an existing server must not be advertised as complete new-server provisioning or a full revamp engine.

## Build and workspace verification

- Local Node version: `v24.22.1`.
- Baseline syntax checks: all three files from the `check` script passed.
- Baseline suite: 25 tests passed, zero failed.
- Reviewed patch syntax checks: passed.
- Reviewed patch suite: 31 tests passed, zero failed or skipped.
- npm and Bit CLIs were not available in this sandbox. The exact Node commands from the package scripts were run directly; no dependencies were installed.
- No standalone build failure was reproduced: this app intentionally serves browser files without frontend compilation.
- The preserved React/TypeScript workspace was not built or type-checked. Its root tsconfig extends a generated `node_modules/.cache/tsconfig.bit.*.json`; it needs the existing Bit dependency/config-generation workflow. This is not proof of a source defect. Do not replace the config or delete the lockfile to hide this requirement.
- Tests use injected Discord responses and loopback HTTP only. No live Discord write acceptance or browser visual/a11y test was performed. Disk-restart/backup/restore testing remains outstanding.

Reproduction commands for the selected runtime files:

```sh
node --check apps/command/server.mjs
node --check apps/command/core.mjs
node --check apps/command/web/app.js
node --test apps/command/test/*.test.mjs
```

## Security / BYOB assessment

Code inspection and the existing tests support AES-256-GCM encryption with fresh IVs, no bot-token return in API responses, account-scoped bot storage, per-account/per-server assignments, fresh Manage Server authorization, minimal runtime install permissions (Manage Channels + Manage Roles), bounded API retries/timeouts, Origin + CSRF validation, static-file allowlisting, typed confirmation, single-use previews and additive-only writes. This is a scoped review, not a penetration test or production-readiness certification.

Two gaps were reproduced with offline regressions:

1. A preview could be applied after changing its bot, and the selected credential could change between writes in the same apply.
2. The fingerprint did not cover category/channel permission overwrites or the broader permission context, so such drift could escape stale-preview rejection.

The local patch binds previews to the stored bot ID and Discord bot ID, captures one credential for a snapshot/apply, and hashes a canonical inventory of roles, channels and permission overwrites. Five regression cases failed on the original code; all six new regression cases, including the order-stability control, pass with the patch. No token is added to public responses or preview data.

Limits remain: server locks are process-local; Discord writes are not transactional; external changes can occur after preflight; effective member visibility is not calculated; token deletion does not revoke Discord credentials; operators must secure SQLite storage/backups and apply request/rate limits before public exposure. An in-flight operation retains its checked bot; changing assignment is not cancellation.

## Composio integration assessment

- Connected GitHub access successfully read the private repository; the account reported administrative/write access. No writes were attempted.
- Connected Discord OAuth authorization was read and guild listing returned 28 memberships. That authorization belongs to Composio, not Chaotic Command's own OAuth application.
- Connected Discord bot authentication returned `auth_ok: true`; connected-guild metadata was readable. This is a Composio bot connection, not proof that Chaotic Command's BYOB credentials are configured.
- Tool discovery exposes role/channel reads and writes, permission-overwrite operations, role reordering and guild audit-log reads. Discovery is not proof of write permission or end-to-end runtime support. No mutation tools were executed.
- A targeted search returned guild-template tools, not a verified direct new-guild-creation tool. Verify current official Discord/Composio support and an owner-controlled creation workflow before selecting an architecture.
- The inspected active runtime contains direct Discord REST calls, not a Composio orchestration adapter or SDK. Bench connections are not automatically available to deployed application users. A tenant-safe integration needs explicit account/credential ownership, scoped tool allowlists, preview/confirmation boundaries and offline adapter tests.
- Figma authentication is active, but the owner confirmed that no existing Figma design file is available. Mintlify MCP authorization did not complete; the owner asked to pause that integration. No Mintlify or Figma content was created, edited or published.

## Changes prepared locally

- `apps/command/server.mjs`: bot-bound previews; operation-scoped credentials.
- `apps/command/core.mjs`: canonical permission-context fingerprints.
- Existing bot/core/flow test files: six regression tests, without live credentials.
- README, customer/operator guidance, and this audit record: behavior and verification limits documented.
- All preserved Bit components, manifests, versions and lockfile remain unchanged.

## Next milestone and approval gates

**M1 — Trustworthy setup/revamp preview foundation.** Review and merge this focused safety patch; add persistent SQLite restart and browser tests; restore the original Bit toolchain in an authenticated development environment without recreating its components; complete an explicitly approved acceptance run on a disposable server. Do not mark live acceptance complete based on mock tests.

**M2 — Creator/revamp parity and integration boundary.** Use the preserved prototype/theme as the current design reference; keep Mintlify integration paused at the owner's request. Agree a shared design/API model that preserves the original work; build a read-only, account-scoped Composio adapter first. Plan new-server onboarding/provisioning and existing-server audit-to-revamp together, with distinct tested acceptance criteria. Any move/rename/reorder/permission edits need reviewed action-specific previews; do not silently expand additive-only execution.

The owner approved publishing this safety patch on the named review branch and opening a draft PR. Separate approval is required before merging/deploying, changing a live Discord configuration, exporting Bit components, publishing documentation or incurring costs. Runtime migration away from the existing preserved design, public hosting, permission expansion and multi-process locking architecture remain decisions to review, not assumptions already approved.

# SQLite persistence and credential recovery tests

## Verification baseline

The baseline is the merged safety patch from PR #14: main commit `7a99a6382c30778e8c65cee5f48835557d63cb4d`. Its Git tree is identical to the reviewed PR head. GitHub's Node.js 24 check passed for the merge commit.

The follow-up adds tests and this guide only; it does not change runtime behavior, migrations, permissions, encryption, deployment settings, or Discord configuration.

## What the offline tests cover

`apps/command/test/persistence.test.mjs` uses native `node:sqlite`, temporary private filesystem directories, injected Discord responses, and loopback HTTP. Unlike the earlier in-memory fixtures, it exercises the runtime's actual `DATA_DIR/command.sqlite` storage path.

Five tests verify:

1. Application close/reopen preserves encrypted sessions, CSRF values, account-private saved structures, shared guild notes, default bots and distinct per-server bot assignments. The reopened app successfully uses the decrypted credentials against the mock Discord client. Other accounts cannot access private saved structures or bot lists.
2. A copy taken after clean application shutdown restores the same data and usable encrypted credentials under the matching `SESSION_SECRET`.
3. A different master secret fails closed: old sessions are rejected and saved bot credentials cannot be used. Error responses do not disclose tokens/ciphertext, and inaccessible credential rows are not silently deleted.
4. Corrupted bot/session ciphertext fails closed on reopen without breaking the unaffected bot or the other account's session.
5. A fresh, separate Node.js process reopens the stopped database, reads the existing session and bot list, and uses the encrypted per-server bot through the runtime's normal status/preflight route. The child process has an explicit fixture-only environment and mock Discord client.

The fixture forbids Discord mutations. No real Discord tokens, paid services, production databases or live Discord writes are used. Cleanup removes only temporary directories created by these tests.

## Run the checks

Requires Node.js 24+. No dependency installation is needed for the standalone runtime.

```sh
node --check apps/command/test/persistence.test.mjs
node --test apps/command/test/persistence.test.mjs
node --test apps/command/test/*.test.mjs
```

The existing test glob automatically includes the new file. No CI/workspace configuration change is required. These tests do not build or type-check the original Bit/React workspace.

## Operator implications

Keep `SESSION_SECRET` stable across restarts and protect it separately from the database. Losing/changing it is not credential rotation: it makes the old encrypted sessions and bot tokens unreadable. Do not infer successful recovery from an HTTP health response alone; verify authorized access and the selected bot's preflight in a controlled environment.

The tested copy/restore procedure is an **offline, clean-shutdown** database copy. It is not a tested hot-backup procedure. Do not copy only the main SQLite file while the process is running; committed state can remain in WAL files. Follow the existing whole-data-directory backup policy and use an explicitly planned consistent backup strategy for live service.

## Still outside this verification

- Production backup automation, online SQLite backup consistency, backup encryption/access controls, and disaster-recovery/RPO/RTO guarantees.
- Abrupt process/host crashes, power loss, disk exhaustion, filesystem permission failures or corrupted whole-database recovery.
- Live Discord OAuth/install/apply acceptance, browser visual/accessibility coverage, or multi-process safety.
- Production deployment or any live Discord configuration changes.

These passing tests establish specific offline persistence and failure-boundary properties; they are not production-readiness certification.

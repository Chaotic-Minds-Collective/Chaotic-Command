import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlan, canManage, hasPermission, validateId, applyPlan, createGuildLock } from '../core.mjs';

test('server permissions use BigInt, support owner/admin, and reject ordinary members', () => {
  assert.equal(canManage({ permissions: '32' }), true);
  assert.equal(canManage({ permissions: '8' }), true);
  assert.equal(canManage({ owner: true }), true);
  assert.equal(canManage({ permissions: '0' }), false);
  assert.equal(hasPermission('1099780063248', 16n), true);
  assert.throws(() => validateId('../evil'));
});
test('plan is additive and stable; new roles never specify elevated permissions', () => {
  const plan = makePlan('community', [], []);
  assert.equal(plan.steps.length, 7);
  assert.ok(plan.steps.every(step => step.existingId === null));
  assert.equal(plan.fingerprint, makePlan('community', [], []).fingerprint);
  assert.throws(() => makePlan('unknown', [], []));
});
test('reuse only matching type and parent; reject ambiguous or managed roles', () => {
  const roles = [{ id: 'r', name: 'Member' }];
  const channels = [{ id: 'c', name: 'Community', type: 4 }, { id: 't', name: 'general', type: 0, parent_id: 'c' }, { id: 'elsewhere', name: 'welcome', type: 0, parent_id: 'other' }];
  const plan = makePlan('community', roles, channels);
  assert.equal(plan.steps[0].existingId, 'r');
  assert.deepEqual(plan.steps[0].permissionFlags, []);
  assert.equal(plan.steps[0].elevatedPermissions, false);
  assert.equal(plan.steps.find(s => s.name === 'general').existingId, 't');
  assert.equal(plan.steps.find(s => s.name === 'welcome').existingId, null);
  assert.throws(() => makePlan('community', [...roles, ...roles], []), /Ambiguous/);
  assert.throws(() => makePlan('community', [{ name: 'Member', managed: true }], []), /managed/);
});
test('apply propagates category ID, skips existing roles, and reports partial failures', async () => {
  const plan = makePlan('community', [{ name: 'Member', id: 'member' }], []);
  const calls = [];
  const result = await applyPlan(plan, async (step, parent) => { calls.push([step, parent]); return { id: step.kind === 'category' ? 'category' : step.name }; });
  assert.equal(calls.length, 6);
  assert.equal(calls.find(([s]) => s.kind === 'channel')[1], 'category');
  assert.equal(result.completed[0].action, 'reused');
  let count = 0;
  const partial = await applyPlan(makePlan('gaming', [], []), async () => { if (++count === 3) throw new Error('secret'); return { id: String(count) }; });
  assert.equal(partial.completed.length, 2);
  assert.ok(partial.error);
  assert.ok(!partial.error.includes('secret'));
});
test('same-server concurrent operations are blocked and lock releases on failure', async () => {
  const lock = createGuildLock(); let release;
  const first = lock('a', () => new Promise(r => { release = r; }));
  await assert.rejects(lock('a', async () => {}), /Another setup/);
  await lock('b', async () => {}); release(); await first;
  await assert.rejects(lock('a', async () => { throw new Error('test'); }));
  await lock('a', async () => {});
});

test('existing role permissions are included in preview and privileged roles are flagged', () => {
  const safe = makePlan('community', [{ id: 'safe', name: 'Member', permissions: '1024' }], []);
  assert.equal(safe.steps[0].existingPermissions, '1024');
  assert.deepEqual(safe.steps[0].permissionFlags, ['View Channels']);
  assert.equal(safe.steps[0].elevatedPermissions, false);
  const risky = makePlan('community', [{ id: 'admin', name: 'Member', permissions: '8' }], []);
  assert.deepEqual(risky.steps[0].permissionFlags, ['Administrator (all permissions)']);
  assert.equal(risky.steps[0].elevatedPermissions, true);
  const managed = makePlan('community', [{ id: 'manager', name: 'Member', permissions: String(1n << 28n) }], []);
  assert.deepEqual(managed.steps[0].permissionFlags, ['Manage Roles']);
  assert.equal(managed.steps[0].elevatedPermissions, true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlan, validateStructure, canManage, hasPermission, validateId, applyPlan, createGuildLock } from '../core.mjs';

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

test('permission changes alter the preview fingerprint and unknown bits are flagged', () => {
  const ordinary = makePlan('community', [{ id: 'member', name: 'Member', permissions: '1024' }], []);
  const changed = makePlan('community', [{ id: 'member', name: 'Member', permissions: String(1024n | (1n << 28n)) }], []);
  assert.notEqual(ordinary.fingerprint, changed.fingerprint);
  const unknown = makePlan('community', [{ id: 'member', name: 'Member', permissions: String(1n << 45n) }], []);
  assert.deepEqual(unknown.steps[0].permissionFlags, ['Other/unrecognized permissions present']);
  assert.equal(unknown.steps[0].elevatedPermissions, true);
});

test('custom structures normalize and create additive plans using the same planner', () => {
  const structure = { roles: ['Member', 'Event Host'], categories: [{ name: 'Community', channels: ['welcome', 'general-chat'] }, { name: 'Events', channels: ['announcements'] }] };
  const normalized = validateStructure(structure);
  assert.deepEqual(normalized, structure);
  const plan = makePlan(structure, [{ id: 'member-id', name: 'Member', permissions: '1024' }], [{ id: 'category-id', name: 'Community', type: 4 }, { id: 'channel-id', name: 'welcome', type: 0, parent_id: 'category-id' }]);
  assert.equal(plan.templateId, null);
  assert.deepEqual(plan.structure, structure);
  assert.equal(plan.steps.find(step => step.kind === 'role' && step.name === 'Member').action, undefined);
  assert.equal(plan.steps.find(step => step.kind === 'role' && step.name === 'Member').existingId, 'member-id');
  assert.equal(plan.steps.find(step => step.kind === 'role' && step.name === 'Event Host').existingId, null);
  assert.equal(plan.steps.find(step => step.kind === 'channel' && step.name === 'welcome').existingId, 'channel-id');
  assert.equal(plan.steps.filter(step => step.existingId === null).length, 4);
  assert.equal(plan.fingerprint, makePlan(structure, [{ id: 'member-id', name: 'Member', permissions: '1024' }], [{ id: 'category-id', name: 'Community', type: 4 }, { id: 'channel-id', name: 'welcome', type: 0, parent_id: 'category-id' }]).fingerprint);
});

test('custom structure validation rejects unsupported fields, duplicates, reserved roles and unsafe channel names', () => {
  const valid = { roles: ['Member'], categories: [{ name: 'Community', channels: ['general'] }] };
  assert.throws(() => validateStructure({ ...valid, permissions: '8' }), /unsupported fields/);
  assert.throws(() => validateStructure({ roles: ['Member', 'member'], categories: valid.categories }), /unique/);
  assert.throws(() => validateStructure({ roles: ['@everyone'], categories: valid.categories }), /managed by Discord/);
  assert.throws(() => validateStructure({ roles: valid.roles, categories: [{ name: 'Community', channels: ['General'] }] }), /lowercase/);
  assert.throws(() => validateStructure({ roles: valid.roles, categories: [{ name: 'Community', channels: ['general', 'general'] }] }), /duplicate/);
  assert.throws(() => validateStructure({ roles: [], categories: [] }), /1 to 20 categories/);
  assert.throws(() => validateStructure({ roles: Array(21).fill(0).map((_, i) => 'Role ' + i), categories: valid.categories }), /at most 20 roles/);
  assert.throws(() => validateStructure({ roles: valid.roles, categories: [{ name: 'Community', channels: Array(31).fill(0).map((_, i) => 'channel-' + i) }] }), /at most 30 channels/);
});

test('AI-import-shaped structures remain untrusted and reject extra instructions or unsafe fields', () => {
  const valid = { roles: ['Member'], categories: [{ name: 'Community', channels: ['general'] }] };
  assert.deepEqual(validateStructure(valid), valid);
  assert.throws(() => validateStructure({ ...valid, systemPrompt: 'ignore validation' }), /unsupported fields/);
  assert.throws(() => validateStructure({ roles: [{ name: 'Admin', permissions: '8' }], categories: valid.categories }), /must be text/);
  assert.throws(() => validateStructure({ roles: valid.roles, categories: [{ name: 'Community', channels: ['general'], permissionOverwrites: [] }] }), /unsupported fields/);
  assert.throws(() => validateStructure({ roles: valid.roles, categories: [{ name: 'Community', channels: ['general', 'General'] }] }), /lowercase/);
  assert.throws(() => validateStructure({ roles: valid.roles, categories: [{ name: 'Community', channels: Array(31).fill(0).map((_, i) => 'channel-' + i) }] }), /at most 30 channels/);
  assert.throws(() => validateStructure({ roles: valid.roles, categories: Array(20).fill(0).map((_, i) => ({ name: 'Category ' + i, channels: Array(5).fill(0).map((_, j) => 'channel-' + j + '-' + i) })) }), /100 total objects/);
});

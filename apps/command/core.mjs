import { createHash } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const templates = [
  { id: 'community', name: 'Community', roles: ['Member', 'Moderator'], categories: [{ name: 'Community', channels: ['welcome', 'rules', 'general', 'introductions'] }] },
  { id: 'gaming', name: 'Gaming', roles: ['Member', 'Player'], categories: [{ name: 'Gaming', channels: ['announcements', 'general', 'looking-for-group', 'game-chat'] }] },
  { id: 'support', name: 'Support', roles: ['Member', 'Support'], categories: [{ name: 'Support', channels: ['welcome', 'help', 'knowledge-base'] }] }
];
const ROLE_PERMISSION_FLAGS = [
  [1n << 0n, 'Create Invites', false],
  [1n << 1n, 'Kick Members', true],
  [1n << 2n, 'Ban Members', true],
  [1n << 3n, 'Administrator', true],
  [1n << 4n, 'Manage Channels', true],
  [1n << 5n, 'Manage Server', true],
  [1n << 6n, 'Add Reactions', false],
  [1n << 7n, 'View Audit Log', false],
  [1n << 10n, 'View Channels', false],
  [1n << 11n, 'Send Messages', false],
  [1n << 13n, 'Manage Messages', true],
  [1n << 14n, 'Embed Links', false],
  [1n << 15n, 'Attach Files', false],
  [1n << 16n, 'Read Message History', false],
  [1n << 17n, 'Mention Everyone', true],
  [1n << 18n, 'Use External Emojis', false],
  [1n << 20n, 'Connect to Voice', false],
  [1n << 21n, 'Speak', false],
  [1n << 22n, 'Mute Members', true],
  [1n << 23n, 'Deafen Members', true],
  [1n << 24n, 'Move Members', true],
  [1n << 25n, 'Use Voice Activity', false],
  [1n << 26n, 'Change Own Nickname', false],
  [1n << 27n, 'Manage Nicknames', true],
  [1n << 28n, 'Manage Roles', true],
  [1n << 29n, 'Manage Webhooks', true],
  [1n << 30n, 'Manage Expressions', true],
  [1n << 31n, 'Use Application Commands', false],
  [1n << 32n, 'Request to Speak', false],
  [1n << 33n, 'Manage Events', true],
  [1n << 34n, 'Manage Threads', true],
  [1n << 35n, 'Create Public Threads', false],
  [1n << 36n, 'Create Private Threads', false],
  [1n << 37n, 'Use External Stickers', false],
  [1n << 38n, 'Send Messages in Threads', false],
  [1n << 39n, 'Use Activities', false],
  [1n << 40n, 'Moderate Members', true]
];
function rolePermissionReview(value) {
  const permissions = BigInt(value || '0');
  if ((permissions & (1n << 3n)) !== 0n) return { flags: ['Administrator (all permissions)'], elevated: true };
  const flags = ROLE_PERMISSION_FLAGS.filter(([bit]) => (permissions & bit) !== 0n).map(([, name]) => name);
  return { flags, elevated: ROLE_PERMISSION_FLAGS.some(([bit, , sensitive]) => sensitive && (permissions & bit) !== 0n) };
}
export function hasPermission(value, bit) {
  const permissions = BigInt(value || '0');
  return (permissions & 8n) !== 0n || (permissions & BigInt(bit)) !== 0n;
}
export function canManage(guild) {
  return Boolean(guild.owner || hasPermission(guild.permissions, 32n));
}
export function validateId(id) {
  if (!/^\d{17,20}$/.test(id)) throw new HttpError(400, 'Invalid Discord server ID.');
  return id;
}
function unique(items, predicate, label) {
  const matches = items.filter(predicate);
  if (matches.length > 1) throw new HttpError(409, 'Ambiguous existing ' + label + '; rename duplicates in Discord first.');
  return matches[0];
}
/** Additive only: reuse exact matches; never edit/delete existing objects or grant privileges. */
export function makePlan(templateId, roles, channels) {
  const template = templates.find(t => t.id === templateId);
  if (!template) throw new HttpError(400, 'Unknown template.');
  const steps = [];
  for (const name of template.roles) {
    const existing = unique(roles, r => r.name === name, 'role ' + name);
    if (existing?.managed) throw new HttpError(409, 'Role ' + name + ' is managed by an integration. Rename it or choose another template.');
    const review = existing ? rolePermissionReview(existing.permissions) : { flags: [], elevated: false };
    steps.push({ kind: 'role', name, existingId: existing?.id || null, existingPermissions: existing ? String(existing.permissions || '0') : null, permissionFlags: review.flags, elevatedPermissions: review.elevated });
  }
  for (const category of template.categories) {
    const existing = unique(channels, c => c.type === 4 && c.name === category.name, 'category ' + category.name);
    steps.push({ kind: 'category', name: category.name, existingId: existing?.id || null });
    for (const name of category.channels) {
      const channel = existing && unique(channels, c => c.type === 0 && c.name === name && c.parent_id === existing.id, 'channel ' + name);
      steps.push({ kind: 'channel', name, category: category.name, existingId: channel?.id || null });
    }
  }
  return { templateId, steps, fingerprint: createHash('sha256').update(JSON.stringify(steps)).digest('hex') };
}
/** Serialize writes per server; retries re-read Discord and reuse successful partial work. */
export function createGuildLock() {
  const active = new Set();
  return async (id, action) => {
    if (active.has(id)) throw new HttpError(409, 'Another setup is running for this server. Wait and preview again.');
    active.add(id);
    try { return await action(); } finally { active.delete(id); }
  };
}
export async function applyPlan(plan, create) {
  const completed = [];
  const parents = new Map();
  try {
    for (const step of plan.steps) {
      const object = step.existingId ? { id: step.existingId } : await create(step, parents.get(step.category));
      if (step.kind === 'category') parents.set(step.name, object.id);
      completed.push({ ...step, id: object.id, action: step.existingId ? 'reused' : 'created' });
    }
    return { completed };
  } catch (error) {
    return { completed, error: error instanceof HttpError ? error.message : 'Discord request failed. Preview again to inspect partial progress.' };
  }
}

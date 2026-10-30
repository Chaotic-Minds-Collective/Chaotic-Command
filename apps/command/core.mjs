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
  const knownMask = ROLE_PERMISSION_FLAGS.reduce((mask, [bit]) => mask | bit, 0n);
  const unknown = (permissions & ~knownMask) !== 0n;
  const flags = ROLE_PERMISSION_FLAGS.filter(([bit]) => (permissions & bit) !== 0n).map(([, name]) => name);
  if (unknown) flags.push('Other/unrecognized permissions present');
  return { flags, elevated: unknown || ROLE_PERMISSION_FLAGS.some(([bit, , sensitive]) => sensitive && (permissions & bit) !== 0n) };
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
const MAX_ROLES = 20;
const MAX_CATEGORIES = 20;
const MAX_CHANNELS_PER_CATEGORY = 30;
const MAX_TOTAL_OBJECTS = 100;

function cleanName(value, label, max = 100) {
  if (typeof value !== 'string') throw new HttpError(400, label + ' must be text.');
  const name = value.trim();
  if (!name || name.length > max || /[\\u0000-\\u001f\\u007f]/.test(name)) {
    throw new HttpError(400, label + ' must contain 1 to ' + max + ' valid characters.');
  }
  return name;
}

/** Normalize an untrusted user-authored structure to the only fields the planner supports. */
export function validateStructure(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Custom structure must be an object.');
  if (Object.keys(value).some(key => !['roles', 'categories'].includes(key))) throw new HttpError(400, 'Custom structure contains unsupported fields.');
  if (!Array.isArray(value.roles) || !Array.isArray(value.categories)) throw new HttpError(400, 'Custom structure needs roles and categories lists.');
  if (value.roles.length > MAX_ROLES) throw new HttpError(400, 'A custom structure can contain at most ' + MAX_ROLES + ' roles.');
  if (!value.categories.length || value.categories.length > MAX_CATEGORIES) throw new HttpError(400, 'A custom structure needs 1 to ' + MAX_CATEGORIES + ' categories.');
  const roles = value.roles.map((item, index) => cleanName(item, 'Role ' + (index + 1)));
  const categories = value.categories.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['name', 'channels'].includes(key))) {
      throw new HttpError(400, 'Category ' + (index + 1) + ' contains unsupported fields.');
    }
    if (!Array.isArray(item.channels) || item.channels.length > MAX_CHANNELS_PER_CATEGORY) {
      throw new HttpError(400, 'Each category can contain at most ' + MAX_CHANNELS_PER_CATEGORY + ' channels.');
    }
    const name = cleanName(item.name, 'Category ' + (index + 1));
    const channels = item.channels.map((channel, channelIndex) => {
      const channelName = cleanName(channel, 'Channel ' + (channelIndex + 1));
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(channelName)) throw new HttpError(400, 'Channel names must use lowercase letters, numbers, hyphens, or underscores.');
      return channelName;
    });
    if (new Set(channels.map(channel => channel.toLowerCase())).size !== channels.length) throw new HttpError(400, 'A category contains duplicate channel names.');
    return { name, channels };
  });
  if (new Set(roles.map(name => name.toLowerCase())).size !== roles.length) throw new HttpError(400, 'Role names must be unique.');
  if (new Set(categories.map(item => item.name.toLowerCase())).size !== categories.length) throw new HttpError(400, 'Category names must be unique.');
  const total = roles.length + categories.length + categories.reduce((sum, item) => sum + item.channels.length, 0);
  if (total > MAX_TOTAL_OBJECTS) throw new HttpError(400, 'A custom structure can contain at most ' + MAX_TOTAL_OBJECTS + ' total objects.');
  return { roles, categories };
}

/** Additive only: reuse exact matches; never edit/delete existing objects or grant privileges. */
export function makePlan(templateOrStructure, roles, channels) {
  const template = typeof templateOrStructure === 'string' ? templates.find(t => t.id === templateOrStructure) : null;
  if (typeof templateOrStructure === 'string' && !template) throw new HttpError(400, 'Unknown template.');
  const structure = validateStructure(template || templateOrStructure);
  const steps = [];
  for (const name of structure.roles) {
    const existing = unique(roles, r => r.name === name, 'role ' + name);
    if (existing?.managed) throw new HttpError(409, 'Role ' + name + ' is managed by an integration. Rename it or choose another name.');
    const review = existing ? rolePermissionReview(existing.permissions) : { flags: [], elevated: false };
    steps.push({ kind: 'role', name, existingId: existing?.id || null, existingPermissions: existing ? String(existing.permissions || '0') : null, permissionFlags: review.flags, elevatedPermissions: review.elevated });
  }
  for (const category of structure.categories) {
    const existing = unique(channels, c => c.type === 4 && c.name === category.name, 'category ' + category.name);
    steps.push({ kind: 'category', name: category.name, existingId: existing?.id || null });
    for (const name of category.channels) {
      const channel = existing && unique(channels, c => c.type === 0 && c.name === name && c.parent_id === existing.id, 'channel ' + name);
      steps.push({ kind: 'channel', name, category: category.name, existingId: channel?.id || null });
    }
  }
  const templateId = template?.id || null;
  return { templateId, structure, steps, fingerprint: createHash('sha256').update(JSON.stringify({ structure, steps })).digest('hex') };
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

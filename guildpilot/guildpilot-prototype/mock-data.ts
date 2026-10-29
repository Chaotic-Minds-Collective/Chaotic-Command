/** A Discord server (guild) managed by GuildPilot. */
export type Server = {
  id: string;
  name: string;
  icon: string;
  members: number;
  online: number;
  boostLevel: number;
  healthScore: number;
};

/** Severity of an audit finding. */
export type Severity = 'critical' | 'warning' | 'upgrade';

/** A single issue or upgrade suggestion found by the server audit. */
export type AuditFinding = {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  fix: string;
  impact: number;
};

/** Ticket status values. */
export type TicketStatus = 'open' | 'pending' | 'closed';

/** A support ticket opened by a member. */
export type Ticket = {
  id: string;
  subject: string;
  user: string;
  category: string;
  status: TicketStatus;
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  createdAt: string;
  messages: { from: string; text: string; staff?: boolean }[];
};

/** A server setup template. */
export type SetupTemplate = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  channels: { category: string; items: string[] }[];
  roles: string[];
  features: string[];
};

/** A moderation log entry. */
export type ModAction = {
  id: string;
  action: 'Ban' | 'Kick' | 'Timeout' | 'Warn' | 'AutoMod';
  target: string;
  moderator: string;
  reason: string;
  time: string;
};

/** A server role. */
export type Role = { name: string; color: string; members: number; admin?: boolean; dangerous?: string[] };

export const servers: Server[] = [
  { id: 's1', name: 'Chaotic Minds HQ', icon: 'CM', members: 4821, online: 1203, boostLevel: 2, healthScore: 72 },
  { id: 's2', name: 'Pixel Forge Gaming', icon: 'PF', members: 12940, online: 3310, boostLevel: 3, healthScore: 88 },
  { id: 's3', name: 'Study Lounge', icon: 'SL', members: 640, online: 98, boostLevel: 0, healthScore: 54 },
];

export const auditFindings: AuditFinding[] = [
  { id: 'a1', severity: 'critical', category: 'Permissions', title: '@everyone can mention @everyone', detail: 'Any member can ping the whole server — a common raid vector.', fix: 'Disable "Mention @everyone" for @everyone role', impact: 8 },
  { id: 'a2', severity: 'critical', category: 'Security', title: '3 roles have Administrator', detail: 'Admin grants every permission and bypasses channel overrides.', fix: 'Replace Administrator with scoped permissions on "Helper" and "Event Team"', impact: 7 },
  { id: 'a3', severity: 'warning', category: 'Verification', title: 'Verification level is Low', detail: 'New accounts can message instantly.', fix: 'Raise verification to Medium (registered 5+ min)', impact: 5 },
  { id: 'a4', severity: 'warning', category: 'AutoMod', title: 'No spam / link filter', detail: 'AutoMod has no keyword or mention-spam rules.', fix: 'Enable recommended AutoMod rule pack', impact: 4 },
  { id: 'a5', severity: 'warning', category: 'Structure', title: '6 inactive channels', detail: 'No messages in 60+ days: #old-memes, #event-2023, and 4 more.', fix: 'Archive inactive channels into "Archive" category', impact: 2 },
  { id: 'a6', severity: 'upgrade', category: 'Community', title: 'Enable Community features', detail: 'Unlock Welcome Screen, Onboarding, Forum channels and Server Insights.', fix: 'Turn on Community and configure rules channel', impact: 1 },
  { id: 'a7', severity: 'upgrade', category: 'Onboarding', title: 'Add onboarding questions', detail: 'Let members pick roles and channels on join.', fix: 'Create onboarding with interest-based roles', impact: 1 },
];

export const tickets: Ticket[] = [
  { id: 'T-1042', subject: "Can't access #vip-lounge after boosting", user: 'nova#2211', category: 'Roles', status: 'open', priority: 'high', createdAt: '4m ago',
    messages: [{ from: 'nova', text: "I boosted the server an hour ago but still don't see the VIP channel." }] },
  { id: 'T-1041', subject: 'Report: user spamming DMs', user: 'kairo#0042', category: 'Report', status: 'open', priority: 'high', createdAt: '18m ago',
    messages: [{ from: 'kairo', text: 'Someone named "free-nitro" is DMing scam links to members.' }] },
  { id: 'T-1039', subject: 'Event idea: weekly game night', user: 'mira#7781', category: 'Suggestion', status: 'pending', priority: 'low', assignee: 'Danielle', createdAt: '2h ago',
    messages: [{ from: 'mira', text: 'Could we run a weekly game night on Fridays?' }, { from: 'Danielle', text: 'Love it — checking with the event team!', staff: true }] },
  { id: 'T-1035', subject: 'Appeal for timeout', user: 'zed#1100', category: 'Appeal', status: 'closed', priority: 'medium', assignee: 'Rook', createdAt: '1d ago',
    messages: [{ from: 'zed', text: 'Sorry about yesterday, can my timeout be lifted?' }, { from: 'Rook', text: 'Lifted. Please keep #general on topic.', staff: true }] },
];

export const templates: SetupTemplate[] = [
  { id: 'gaming', name: 'Gaming Community', emoji: '🎮', description: 'LFG, clips, voice lobbies and game-specific roles.',
    channels: [{ category: 'INFO', items: ['#rules', '#announcements', '#roles'] }, { category: 'COMMUNITY', items: ['#general', '#clips', '#lfg'] }, { category: 'VOICE', items: ['🔊 Lobby 1', '🔊 Lobby 2', '🔊 AFK'] }],
    roles: ['Owner', 'Admin', 'Moderator', 'Member', 'LFG Ping'], features: ['Tickets', 'AutoMod', 'Welcome message', 'Reaction roles'] },
  { id: 'community', name: 'Creator / Community', emoji: '✨', description: 'Fan hub with announcements, events and supporter perks.',
    channels: [{ category: 'START HERE', items: ['#welcome', '#rules', '#announcements'] }, { category: 'HANGOUT', items: ['#chat', '#art', '#memes'] }, { category: 'SUPPORTERS', items: ['#vip-lounge', '🔊 Stage'] }],
    roles: ['Creator', 'Moderator', 'Supporter', 'Member'], features: ['Tickets', 'Onboarding', 'Events', 'Boost perks'] },
  { id: 'study', name: 'Study Group', emoji: '📚', description: 'Subject channels, focus rooms and resource sharing.',
    channels: [{ category: 'INFO', items: ['#rules', '#resources'] }, { category: 'SUBJECTS', items: ['#math', '#science', '#languages'] }, { category: 'FOCUS', items: ['🔊 Pomodoro', '🔊 Silent study'] }],
    roles: ['Admin', 'Tutor', 'Student'], features: ['Tickets', 'AutoMod', 'Forum Q&A'] },
  { id: 'business', name: 'Business / Support', emoji: '💼', description: 'Customer support, changelogs and staff-only areas.',
    channels: [{ category: 'PUBLIC', items: ['#announcements', '#changelog', '#faq'] }, { category: 'SUPPORT', items: ['#open-a-ticket', '#feedback'] }, { category: 'STAFF', items: ['#staff-chat', '#ticket-logs'] }],
    roles: ['Owner', 'Staff', 'Support', 'Customer'], features: ['Tickets', 'Transcripts', 'AutoMod', 'Audit log'] },
];

export const modActions: ModAction[] = [
  { id: 'm1', action: 'AutoMod', target: 'free-nitro#9999', moderator: 'GuildPilot', reason: 'Blocked scam link', time: '6m ago' },
  { id: 'm2', action: 'Ban', target: 'free-nitro#9999', moderator: 'Rook', reason: 'Scam DMs (T-1041)', time: '5m ago' },
  { id: 'm3', action: 'Timeout', target: 'loudguy#3030', moderator: 'Danielle', reason: 'Spam in #general (10 min)', time: '1h ago' },
  { id: 'm4', action: 'Warn', target: 'zed#1100', moderator: 'Rook', reason: 'Off-topic arguing', time: '1d ago' },
  { id: 'm5', action: 'Kick', target: 'alt-acct#1', moderator: 'GuildPilot', reason: 'Raid protection: account < 1 day old', time: '2d ago' },
];

export const roles: Role[] = [
  { name: 'Owner', color: '#F5A524', members: 1, admin: true },
  { name: 'Admin', color: '#ED4245', members: 3, admin: true },
  { name: 'Helper', color: '#3BD6A0', members: 8, admin: true, dangerous: ['Administrator'] },
  { name: 'Moderator', color: '#5865F2', members: 12, dangerous: ['Ban Members'] },
  { name: 'Event Team', color: '#EB459E', members: 5, admin: true, dangerous: ['Administrator'] },
  { name: 'Booster', color: '#FF73FA', members: 41 },
  { name: 'Member', color: '#949BA4', members: 4710 },
];

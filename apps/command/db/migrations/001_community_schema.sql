-- Community schema for the Chaotic Command Discord bot (tickets, moderation, appeals, audit).
-- Portable SQL: runs on both SQLite (development) and PostgreSQL (production).
-- IDs are application-generated hex strings; timestamps are Unix epoch milliseconds (BIGINT/INTEGER).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  linked_web_user_id TEXT,
  is_staff INTEGER NOT NULL DEFAULT 0,
  staff_role TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS users_discord ON users(discord_user_id);
CREATE INDEX IF NOT EXISTS users_web ON users(linked_web_user_id);

CREATE TABLE IF NOT EXISTS discord_servers (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS moderation_cases (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  case_number BIGINT NOT NULL,
  target_user_id TEXT NOT NULL,
  moderator_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE (guild_id, case_number)
);
CREATE INDEX IF NOT EXISTS moderation_cases_guild ON moderation_cases(guild_id);
CREATE INDEX IF NOT EXISTS moderation_cases_target ON moderation_cases(target_user_id);
CREATE INDEX IF NOT EXISTS moderation_cases_case ON moderation_cases(case_number);

CREATE TABLE IF NOT EXISTS warnings (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_user_id TEXT NOT NULL,
  reason TEXT,
  case_id TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS warnings_guild ON warnings(guild_id);
CREATE INDEX IF NOT EXISTS warnings_user ON warnings(user_id);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  creator_user_id TEXT NOT NULL,
  channel_id TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  claimed_by_user_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  closed_at BIGINT
);
CREATE INDEX IF NOT EXISTS tickets_guild ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS tickets_creator ON tickets(creator_user_id);
CREATE INDEX IF NOT EXISTS tickets_channel ON tickets(channel_id);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  author_user_id TEXT,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'discord',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_messages_ticket ON ticket_messages(ticket_id);

CREATE TABLE IF NOT EXISTS ticket_transcripts (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_transcripts_ticket ON ticket_transcripts(ticket_id);

CREATE TABLE IF NOT EXISTS appeals (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  case_id TEXT,
  statement TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by_user_id TEXT,
  decision_reason TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS appeals_guild ON appeals(guild_id);
CREATE INDEX IF NOT EXISTS appeals_user ON appeals(user_id);

CREATE TABLE IF NOT EXISTS ban_approval_requests (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by_user_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS ban_approval_requests_guild ON ban_approval_requests(guild_id);
CREATE INDEX IF NOT EXISTS ban_approval_requests_case ON ban_approval_requests(case_id);

CREATE TABLE IF NOT EXISTS staff_actions (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id TEXT,
  details_json TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_actions_guild ON staff_actions(guild_id);
CREATE INDEX IF NOT EXISTS staff_actions_actor ON staff_actions(actor_user_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id TEXT,
  target_user_id TEXT,
  ticket_id TEXT,
  case_id TEXT,
  details_json TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_events_guild ON audit_events(guild_id);
CREATE INDEX IF NOT EXISTS audit_events_ticket ON audit_events(ticket_id);
CREATE INDEX IF NOT EXISTS audit_events_case ON audit_events(case_id);

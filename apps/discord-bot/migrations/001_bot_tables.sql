-- Chaotic Command bot storage (applied via Supabase SQL editor or MCP)
create table if not exists bot_guilds (
  guild_id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists bot_tickets (
  id text primary key,
  guild_id text not null,
  channel_id text not null,
  user_id text not null,
  subject text not null,
  status text not null default 'open',
  claimed_by text,
  created_at timestamptz not null default now()
);
create table if not exists bot_pending (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table bot_guilds enable row level security;
alter table bot_tickets enable row level security;
alter table bot_pending enable row level security;

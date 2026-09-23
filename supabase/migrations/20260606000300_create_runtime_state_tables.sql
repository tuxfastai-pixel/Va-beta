create table if not exists public.trust_history_records (
  user_id text primary key,
  record jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_trust_history_records_updated_at
  on public.trust_history_records (updated_at desc);

create table if not exists public.user_personalization_states (
  user_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_personalization_states_updated_at
  on public.user_personalization_states (updated_at desc);
-- Server-only RLS boundary.
alter table public.trust_history_records enable row level security;
alter table public.user_personalization_states enable row level security;

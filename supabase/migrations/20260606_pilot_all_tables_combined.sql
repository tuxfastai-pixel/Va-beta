-- ============================================================
-- Pilot Continuity Migration – apply this once in Supabase
-- SQL Editor (https://supabase.com/dashboard > SQL Editor)
-- ============================================================

-- 1. career_profiles
create table if not exists public.career_profiles (
  id text primary key,
  user_id text,
  created_at timestamptz not null default now(),
  intake jsonb not null,
  profile jsonb not null,
  reconstruction jsonb not null
);

create index if not exists idx_career_profiles_user_id
  on public.career_profiles (user_id);

create index if not exists idx_career_profiles_created_at
  on public.career_profiles (created_at desc);

-- 2. trust_history_records
create table if not exists public.trust_history_records (
  user_id text primary key,
  record jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_trust_history_records_updated_at
  on public.trust_history_records (updated_at desc);

-- 3. user_personalization_states
create table if not exists public.user_personalization_states (
  user_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_personalization_states_updated_at
  on public.user_personalization_states (updated_at desc);

-- 4. equilibrium_events
create table if not exists public.equilibrium_events (
  id bigserial primary key,
  user_id text not null,
  event_timestamp bigint not null,
  event_type text not null,
  previous_state text not null,
  next_state text not null,
  pressure_level double precision not null,
  fatigue_risk double precision not null,
  recovery_triggered boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_equilibrium_events_user_ts
  on public.equilibrium_events (user_id, event_timestamp desc);

create index if not exists idx_equilibrium_events_type_ts
  on public.equilibrium_events (event_type, event_timestamp desc);

-- 5. runtime_rollout_policies
create table if not exists public.runtime_rollout_policies (
  policy_key text primary key,
  policy jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 6. runtime_snapshots
create table if not exists public.runtime_snapshots (
  snapshot_id text primary key,
  user_id text not null,
  captured_at bigint not null,
  checksum text not null,
  snapshot_path text,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_runtime_snapshots_user_captured
  on public.runtime_snapshots (user_id, captured_at desc);

-- 7. runtime_snapshot_anchors
create table if not exists public.runtime_snapshot_anchors (
  anchor_id text primary key,
  snapshot_id text not null,
  user_id text not null,
  created_at_ms bigint not null,
  snapshot_path text not null,
  checksum text not null,
  parent_anchor_id text,
  lineage_depth integer not null default 0,
  reason text not null,
  signature text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_runtime_snapshot_anchors_user_created
  on public.runtime_snapshot_anchors (user_id, created_at_ms desc);

create index if not exists idx_runtime_snapshot_anchors_snapshot
  on public.runtime_snapshot_anchors (snapshot_id);

-- Verify all 7 tables were created
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'career_profiles',
    'trust_history_records',
    'user_personalization_states',
    'equilibrium_events',
    'runtime_rollout_policies',
    'runtime_snapshots',
    'runtime_snapshot_anchors'
  )
order by table_name;

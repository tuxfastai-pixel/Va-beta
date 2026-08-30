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

create table if not exists public.runtime_rollout_policies (
  policy_key text primary key,
  policy jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

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
-- Server-only RLS boundary.
alter table public.equilibrium_events enable row level security;
alter table public.runtime_rollout_policies enable row level security;
alter table public.runtime_snapshots enable row level security;
alter table public.runtime_snapshot_anchors enable row level security;

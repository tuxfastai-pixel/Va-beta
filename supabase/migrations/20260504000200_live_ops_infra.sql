-- Production-compatible live-operations infrastructure.
-- Additive only: existing tables, columns and rows are preserved.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  user_id uuid,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.events
  add column if not exists user_id uuid;

create table if not exists public.revenue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  amount numeric not null default 0,
  source text not null,
  stream text not null default 'general',
  created_at timestamptz not null default now()
);

alter table public.revenue
  add column if not exists user_id uuid;

create table if not exists public.tenders (
  id text primary key,
  user_id text,
  title text not null,
  deadline timestamptz,
  closing_date timestamptz,
  status text not null default 'open',
  score integer not null default 0,
  meta jsonb not null default '{}'::jsonb
);

alter table public.tenders
  add column if not exists user_id text,
  add column if not exists closing_date timestamptz;

alter table public.jobs
  add column if not exists link text,
  add column if not exists platform text,
  add column if not exists score integer default 0,
  add column if not exists status text;

create unique index if not exists idx_jobs_link_unique
  on public.jobs (link)
  where link is not null;

create index if not exists idx_events_type_created_at
  on public.events (type, created_at desc);

create index if not exists idx_revenue_created_at
  on public.revenue (created_at desc);

create index if not exists idx_tenders_deadline
  on public.tenders (deadline);

create index if not exists idx_tenders_user_closing
  on public.tenders (user_id, closing_date);
-- Server-only RLS boundary.
alter table public.events enable row level security;
alter table public.revenue enable row level security;
alter table public.tenders enable row level security;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.revenue (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null default 0,
  source text not null,
  stream text not null default 'general',
  created_at timestamptz not null default now()
);

create table if not exists public.tenders (
  id text primary key,
  title text not null,
  deadline timestamptz,
  status text not null default 'open',
  score int not null default 0,
  meta jsonb not null default '{}'::jsonb
);

alter table public.jobs
  add column if not exists link text;

alter table public.jobs
  add column if not exists platform text;

alter table public.jobs
  add column if not exists score int default 0;

create unique index if not exists idx_jobs_link_unique on public.jobs (link);
create index if not exists idx_events_type_created_at on public.events (type, created_at desc);
create index if not exists idx_revenue_created_at on public.revenue (created_at desc);
create index if not exists idx_tenders_deadline on public.tenders (deadline);
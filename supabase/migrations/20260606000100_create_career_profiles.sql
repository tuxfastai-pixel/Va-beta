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
-- Server-only RLS boundary.
alter table public.career_profiles enable row level security;

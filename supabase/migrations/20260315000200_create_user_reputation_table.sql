create table if not exists public.user_reputation (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  jobs_completed integer default 0,
  client_rating numeric default 5.0,
  response_speed numeric default 100,
  automation_success numeric default 100,
  reputation_score numeric default 50,
  score numeric default 50,
  updated_at timestamp default now()
);

alter table if exists public.user_reputation
  add column if not exists score numeric default 50;

alter table public.user_reputation enable row level security;

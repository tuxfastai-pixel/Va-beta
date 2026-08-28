alter table if exists public.profiles
  add column if not exists careers text[] default '{}',
  add column if not exists primary_career text,
  add column if not exists secondary_careers text[] default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'careers_max_3'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint careers_max_3 check (coalesce(array_length(careers, 1), 0) <= 3);
  end if;
end $$;

create index if not exists idx_profiles_careers on public.profiles using gin (careers);

create table if not exists public.career_performance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  career text,
  platform text,
  applications int default 0,
  replies int default 0,
  conversions int default 0,
  revenue numeric default 0,
  last_updated timestamp default now()
);

create index if not exists idx_career_perf_user on public.career_performance(user_id);
create index if not exists idx_career_perf_user_career on public.career_performance(user_id, career);

create table if not exists public.platform_performance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  platform text,
  career text,
  applications int default 0,
  replies int default 0,
  conversions int default 0,
  revenue numeric default 0,
  last_updated timestamp default now()
);

create index if not exists idx_platform_perf_user on public.platform_performance(user_id);
create index if not exists idx_platform_perf_user_platform on public.platform_performance(user_id, platform);

create table if not exists public.deal_intelligence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  job_id text,
  career text,
  proposed_price numeric,
  final_price numeric,
  outcome text,
  client_budget_min numeric,
  client_budget_max numeric,
  urgency text,
  complexity text,
  trust_score numeric,
  quality_score numeric,
  decision text,
  created_at timestamp default now()
);

create index if not exists idx_deal_intelligence_user on public.deal_intelligence(user_id);
create index if not exists idx_deal_intelligence_career on public.deal_intelligence(career);

create table if not exists public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  client_id text,
  platform text,
  rating numeric,
  total_spent numeric,
  hire_rate numeric,
  reviews_count int,
  payment_verified boolean,
  response_time text,
  past_outcomes jsonb,
  trust_score numeric default 0,
  risk_score numeric default 0,
  lifetime_value numeric default 0,
  created_at timestamp default now()
);

create index if not exists idx_client_profiles_user on public.client_profiles(user_id);
create index if not exists idx_client_profiles_client on public.client_profiles(client_id);

alter table if exists public.user_platforms
  add column if not exists last_sync timestamp,
  add column if not exists performance_score numeric default 0;

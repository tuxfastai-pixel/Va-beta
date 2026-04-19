alter table if exists public.profiles
  add column if not exists ai_capabilities jsonb default '[]'::jsonb,
  add column if not exists capabilities jsonb default '[]'::jsonb,
  add column if not exists ai_experience boolean default true,
  add column if not exists ai_memory jsonb default '{}'::jsonb,
  add column if not exists system_paused boolean default false,
  add column if not exists safe_mode boolean default true;

create table if not exists public.user_platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  platform text not null,
  status text default 'pending',
  created_at timestamp default now(),
  unique (user_id, platform)
);

create index if not exists idx_user_platforms_user_id
  on public.user_platforms (user_id);

create index if not exists idx_user_platforms_status
  on public.user_platforms (status);

create table if not exists public.user_trust_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  score int default 0,
  level text default 'new',
  jobs_completed int default 0,
  success_rate double precision default 0,
  updated_at timestamp default now(),
  unique (user_id)
);

create index if not exists idx_user_trust_scores_user_id
  on public.user_trust_scores (user_id);

create index if not exists idx_user_trust_scores_level
  on public.user_trust_scores (level);

create table if not exists public.ai_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text,
  ai_used boolean default true,
  created_at timestamp default now()
);

create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event_type text,
  metadata jsonb,
  created_at timestamp default now()
);

create index if not exists idx_learning_events_user_id
  on public.learning_events (user_id);

create index if not exists idx_learning_events_event_type
  on public.learning_events (event_type);

create index if not exists idx_ai_activity_logs_user_id
  on public.ai_activity_logs (user_id);

create index if not exists idx_ai_activity_logs_created_at
  on public.ai_activity_logs (created_at desc);

create table if not exists public.skill_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  skill text,
  skill_name text,
  progress int default 0,
  last_practiced timestamp,
  ai_supported boolean default true,
  created_at timestamp default now()
);

alter table if exists public.skill_progress
  add column if not exists skill text,
  add column if not exists skill_name text,
  add column if not exists progress int default 0,
  add column if not exists last_practiced timestamp,
  add column if not exists ai_supported boolean default true;

update public.skill_progress
set
  skill = coalesce(skill, skill_name),
  skill_name = coalesce(skill_name, skill)
where skill is null or skill_name is null;

create index if not exists idx_skill_progress_user_id
  on public.skill_progress (user_id);

alter table if exists public.earnings
  add column if not exists source text default 'job',
  add column if not exists ai_assisted boolean default true,
  add column if not exists platform text,
  add column if not exists currency text default 'USD',
  add column if not exists status text default 'pending';

create table if not exists public.orchestrator_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  state text,
  action text,
  result jsonb,
  created_at timestamp default now()
);

create index if not exists idx_orchestrator_logs_user_id
  on public.orchestrator_logs (user_id);

create index if not exists idx_orchestrator_logs_created_at
  on public.orchestrator_logs (created_at desc);

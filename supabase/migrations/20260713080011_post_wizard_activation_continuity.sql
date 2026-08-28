create table if not exists public.career_activation_states (
  user_id text primary key,
  onboarding_completed boolean not null default false,
  completed_step integer not null default 0,
  last_valid_step integer not null default 1,
  completion_timestamp timestamptz,
  answers jsonb not null default '{}'::jsonb,
  career_lanes jsonb not null default '{}'::jsonb,
  payment_readiness jsonb not null default '{}'::jsonb,
  international_readiness jsonb not null default '{}'::jsonb,
  continuity_checkpoint jsonb not null default '{}'::jsonb,
  restart_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_career_activation_states_updated_at
  on public.career_activation_states (updated_at desc);

create table if not exists public.master_career_profiles (
  id text primary key,
  user_id text not null,
  source_type text not null,
  source_payload jsonb not null,
  structured_profile jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_master_career_profiles_user
  on public.master_career_profiles (user_id, updated_at desc);

create table if not exists public.cv_change_records (
  id text primary key,
  user_id text not null,
  profile_id text not null,
  section text not null,
  original_text text not null,
  proposed_text text not null,
  reason text not null,
  source_evidence text not null,
  confidence double precision not null,
  user_approval_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_cv_change_records_user_profile
  on public.cv_change_records (user_id, profile_id, created_at desc);

create table if not exists public.job_application_versions (
  id text primary key,
  user_id text not null,
  job_fingerprint text not null,
  source_job jsonb not null,
  assessment jsonb not null,
  tailored_cv jsonb not null,
  cover_letter text,
  application_status text not null default 'preparing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_application_versions_user_job
  on public.job_application_versions (user_id, job_fingerprint, updated_at desc);

create table if not exists public.learning_sprints (
  id text primary key,
  user_id text not null,
  job_fingerprint text not null,
  sprint jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_learning_sprints_user_job
  on public.learning_sprints (user_id, job_fingerprint, updated_at desc);

create table if not exists public.job_site_application_profiles (
  id text primary key,
  user_id text not null,
  site_name text not null,
  profile_url text,
  resume_version_used text,
  last_update timestamptz,
  update_method text not null,
  automation_permission boolean not null default false,
  terms_risk text not null default 'manual-review-required',
  user_approval_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_site_profiles_user_site
  on public.job_site_application_profiles (user_id, site_name, updated_at desc);
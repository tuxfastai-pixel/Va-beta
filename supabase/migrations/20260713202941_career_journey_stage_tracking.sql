-- Extend career_activation_states with journey stage tracking
-- This enables resume-on-return functionality for the post-wizard career activation flow

alter table if exists public.career_activation_states
add column if not exists current_stage text default 'complete',
add column if not exists completed_stages text[] default array[]::text[],
add column if not exists career_activation_completed boolean default false,
add column if not exists last_job_id text,
add column if not exists last_assessment_id text,
add column if not exists last_cv_version_id text;

-- Create index on current_stage for faster resume-on-return queries
create index if not exists idx_career_activation_states_current_stage
  on public.career_activation_states (user_id, current_stage);

-- Create table to track application pack state (for atomic transactions across components)
create table if not exists public.career_journey_state (
  user_id text primary key,
  stage_data jsonb not null default '{}'::jsonb,
  cv_approval_status text default 'pending',
  cover_letter_approval_status text default 'pending',
  learning_sprint_started boolean default false,
  interview_prep_started boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_career_journey_state_updated_at
  on public.career_journey_state (updated_at desc);

-- Create table to track cover letter generations
create table if not exists public.cover_letter_generations (
  id text primary key,
  user_id text not null,
  job_id text not null,
  cv_id text not null,
  prompt text not null,
  generated_text text,
  status text not null default 'pending',
  error_message text,
  attempt_count integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cover_letter_generations_user_job
  on public.cover_letter_generations (user_id, job_id, created_at desc);
-- Server-only RLS boundary.
alter table public.career_activation_states enable row level security;
alter table public.career_journey_state enable row level security;
alter table public.cover_letter_generations enable row level security;

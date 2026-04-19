alter table if exists public.jobs
  add column if not exists job_match_id text;

create unique index if not exists idx_jobs_job_match_id_unique
  on public.jobs (job_match_id)
  where job_match_id is not null;

alter table if exists public.ai_memory
  add column if not exists job_match_id text,
  add column if not exists context jsonb;

create unique index if not exists idx_ai_memory_job_match_id_unique
  on public.ai_memory (job_match_id)
  where job_match_id is not null;

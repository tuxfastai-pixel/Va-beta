alter table if exists public.jobs
  add column if not exists quality_score integer,
  add column if not exists scam_risk text,
  add column if not exists quality_reason text;

-- Fix: replace partial unique index with a full unique constraint so that
-- supabase upsert onConflict: "job_id" works correctly.
-- A partial index (WHERE job_id IS NOT NULL) is not compatible with ON CONFLICT.

drop index if exists public.idx_deals_job_id_unique;

alter table public.deals
  drop constraint if exists deals_job_id_key;

alter table public.deals
  add constraint deals_job_id_key unique (job_id);

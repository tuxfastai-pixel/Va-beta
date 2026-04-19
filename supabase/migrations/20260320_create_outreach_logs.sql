-- outreach_logs: persists every outreach email sent by outreachAgent
-- so we can audit delivery, avoid duplicates, and track response rates.

create table if not exists public.outreach_logs (
  id         uuid      primary key default gen_random_uuid(),
  email      text,
  subject    text,
  message    text,
  status     text      not null default 'sent',
  created_at timestamp not null default now()
);

create index if not exists idx_outreach_logs_email
  on public.outreach_logs (email);

create index if not exists idx_outreach_logs_created_at
  on public.outreach_logs (created_at desc);

-- Add success + profit columns to jobs (idempotent)
alter table if exists public.jobs
  add column if not exists success         boolean,
  add column if not exists profit_realized numeric;

-- Add profit_score column to ai_memory (idempotent)
alter table if exists public.ai_memory
  add column if not exists profit_score numeric;

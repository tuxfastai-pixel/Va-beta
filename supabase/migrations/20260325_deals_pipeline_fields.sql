alter table if exists public.deals
  add column if not exists user_id uuid,
  add column if not exists job_id uuid,
  add column if not exists last_message text,
  add column if not exists updated_at timestamp default now();

create unique index if not exists idx_deals_job_id_unique
  on public.deals (job_id)
  where job_id is not null;

create index if not exists idx_deals_user_id
  on public.deals (user_id);

create index if not exists idx_deals_updated_at
  on public.deals (updated_at desc);

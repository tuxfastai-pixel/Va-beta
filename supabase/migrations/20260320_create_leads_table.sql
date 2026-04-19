create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  company text,
  message text,
  status text default 'new',
  source text,
  created_at timestamp default now()
);

create unique index if not exists idx_leads_email_unique
  on public.leads (email)
  where email is not null;

create index if not exists idx_leads_status
  on public.leads (status);

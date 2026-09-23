create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  stage text,
  value numeric,
  status text,
  created_at timestamp default now()
);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  message text,
  direction text,
  created_at timestamp default now()
);

create index if not exists idx_deals_lead_id
  on public.deals (lead_id);

create index if not exists idx_deals_status
  on public.deals (status);

create index if not exists idx_interactions_lead_id
  on public.interactions (lead_id);

create index if not exists idx_interactions_created_at
  on public.interactions (created_at desc);

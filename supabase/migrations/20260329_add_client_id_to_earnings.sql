alter table if exists public.earnings
  add column if not exists client_id uuid;

create index if not exists idx_earnings_client_id
  on public.earnings (client_id);
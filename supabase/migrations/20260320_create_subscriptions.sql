create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  plan text,
  status text,
  amount numeric,
  created_at timestamp default now()
);

create index if not exists idx_subscriptions_client_id
  on public.subscriptions (client_id);

create index if not exists idx_subscriptions_status
  on public.subscriptions (status);

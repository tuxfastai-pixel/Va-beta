create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  client_id uuid,
  job_id uuid,
  method text not null check (method in ('paystack', 'paypal', 'bank', 'stripe')),
  amount numeric not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  payment_link text,
  follow_up_stage integer not null default 0,
  last_follow_up_at timestamp,
  expired_at timestamp,
  paid_at timestamp,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists idx_payments_status_created_at
  on public.payments (status, created_at desc);

create index if not exists idx_payments_user_id
  on public.payments (user_id);

create index if not exists idx_payments_client_id
  on public.payments (client_id);

create index if not exists idx_payments_job_id
  on public.payments (job_id);
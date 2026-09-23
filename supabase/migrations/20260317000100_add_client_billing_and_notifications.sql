alter table if exists public.worker_tasks
  add column if not exists client_id uuid;

update public.worker_tasks
set client_id = nullif(payload->>'client_id', '')::uuid
where client_id is null
  and (payload->>'client_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

create index if not exists idx_worker_tasks_client_status_priority
  on public.worker_tasks (client_id, status, priority desc, created_at asc);

create index if not exists idx_worker_tasks_status_priority_client
  on public.worker_tasks (status, priority desc, client_id);

create table if not exists public.client_invoices (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.worker_tasks(id) on delete cascade,
  client_id uuid not null,
  status text not null default 'issued' check (status in ('issued', 'paid', 'failed', 'void')),
  amount numeric(12,2) not null,
  amount_usd numeric(12,2) not null,
  currency text not null default 'USD' check (currency in ('USD', 'GBP', 'EUR', 'AED')),
  fee_breakdown jsonb not null default '{}'::jsonb,
  stripe_checkout_url text,
  paypal_checkout_url text,
  payment_provider text,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(task_id)
);

create index if not exists idx_client_invoices_client_status
  on public.client_invoices (client_id, status, created_at desc);

create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  task_id uuid references public.worker_tasks(id) on delete set null,
  notification_type text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_notifications_client_created
  on public.client_notifications (client_id, created_at desc);

create or replace function public.client_invoices_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_client_invoices_set_updated_at on public.client_invoices;
create trigger trg_client_invoices_set_updated_at
before update on public.client_invoices
for each row
execute function public.client_invoices_set_updated_at();

-- Production-compatible CRM expansion.
-- Existing VA-Beta rows and legacy columns are preserved.
-- New columns remain nullable where historical rows cannot be mapped safely.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subscription_type text,
  api_key text,
  phone text,
  region text default 'global',
  source text,
  notes text,
  score numeric default 0,
  score_tier text default 'low',
  retention_probability numeric default 0,
  lifetime_value numeric default 0,
  jobs_completed integer default 0,
  last_interaction timestamptz,
  message_count integer default 0,
  is_retainer boolean default false,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.clients
  add column if not exists subscription_type text,
  add column if not exists api_key text,
  add column if not exists phone text,
  add column if not exists region text default 'global',
  add column if not exists source text,
  add column if not exists notes text,
  add column if not exists score numeric default 0,
  add column if not exists score_tier text default 'low',
  add column if not exists retention_probability numeric default 0,
  add column if not exists lifetime_value numeric default 0,
  add column if not exists jobs_completed integer default 0,
  add column if not exists last_interaction timestamptz,
  add column if not exists message_count integer default 0,
  add column if not exists is_retainer boolean default false,
  add column if not exists updated_at timestamp default now();

create index if not exists idx_clients_email
  on public.clients (email);

create index if not exists idx_clients_source
  on public.clients (source);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  client_id uuid references public.clients(id),
  job_id uuid,
  user_id uuid,
  title text,
  job_title text,
  company text,
  value numeric default 0,
  stage text default 'lead',
  status text,
  probability integer default 20,
  deal_type text,
  apply_deadline timestamptz,
  scheduled_at timestamptz,
  last_message text,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.deals
  add column if not exists client_id uuid references public.clients(id),
  add column if not exists title text,
  add column if not exists job_title text,
  add column if not exists company text,
  add column if not exists probability integer default 20,
  add column if not exists deal_type text,
  add column if not exists apply_deadline timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists notes text;

create index if not exists idx_deals_client_id
  on public.deals (client_id);

create index if not exists idx_deals_stage
  on public.deals (stage);

create index if not exists idx_deals_created_at
  on public.deals (created_at desc);

create index if not exists idx_deals_user_type
  on public.deals (user_id, deal_type);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  type text not null,
  note text not null,
  metadata jsonb,
  created_at timestamp default now()
);

create index if not exists idx_activities_deal_id
  on public.activities (deal_id);

create index if not exists idx_activities_type
  on public.activities (type);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  content text not null,
  status text default 'draft',
  signed_at timestamp,
  signer_name text,
  signer_ip text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index if not exists idx_contracts_deal_id
  on public.contracts (deal_id);

create index if not exists idx_contracts_status
  on public.contracts (status);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  task_id uuid,
  deal_id uuid references public.deals(id),
  user_id uuid,
  client_email text,
  amount numeric,
  currency text,
  description text,
  status text default 'pending',
  payment_link text,
  due_date timestamp,
  paid_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.invoices
  add column if not exists deal_id uuid references public.deals(id),
  add column if not exists user_id uuid,
  add column if not exists client_email text,
  add column if not exists description text,
  add column if not exists payment_link text,
  add column if not exists due_date timestamp,
  add column if not exists paid_at timestamp,
  add column if not exists updated_at timestamp default now();

create index if not exists idx_invoices_client_id
  on public.invoices (client_id);

create index if not exists idx_invoices_deal_id
  on public.invoices (deal_id);

create index if not exists idx_invoices_status
  on public.invoices (status);

create index if not exists idx_invoices_due_date
  on public.invoices (due_date);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  plan text,
  amount numeric,
  interval text default 'monthly',
  next_billing_date timestamp,
  status text default 'active',
  stripe_subscription_id text,
  stripe_customer_id text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.subscriptions
  add column if not exists interval text default 'monthly',
  add column if not exists next_billing_date timestamp,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists updated_at timestamp default now();

create index if not exists idx_subscriptions_client_id
  on public.subscriptions (client_id);

create index if not exists idx_subscriptions_next_billing_date
  on public.subscriptions (next_billing_date);

create unique index if not exists idx_subscriptions_stripe_subscription
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.auto_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid,
  job_title text not null,
  platform text not null,
  applied_at timestamp default now(),
  status text default 'pending',
  notes text
);

create index if not exists idx_auto_applications_platform
  on public.auto_applications (platform);

create index if not exists idx_auto_applications_applied_at
  on public.auto_applications (applied_at desc);

create table if not exists public.escalations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid,
  job_title text not null,
  platform text not null,
  score numeric not null,
  reasons text[],
  manual_action text,
  created_at timestamp default now(),
  reviewed_at timestamp,
  outcome text
);

create index if not exists idx_escalations_created_at
  on public.escalations (created_at desc);

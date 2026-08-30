-- Server-only RLS boundary for CRM, billing, audit and operational data.
--
-- The application accesses these tables through authenticated server routes
-- using the Supabase service role. The service role bypasses RLS.
--
-- No anon/authenticated policies are created here because the affected CRM
-- tables do not yet contain a reliable per-user ownership key. This prevents
-- one authenticated user from reading another user's clients, deals or billing
-- records.

alter table public.clients enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;
alter table public.subscriptions enable row level security;
alter table public.auto_applications enable row level security;
alter table public.escalations enable row level security;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id text,
  actor text,
  ip_address text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.audit_logs enable row level security;

create index if not exists idx_audit_event_type
  on public.audit_logs (event_type);

create index if not exists idx_audit_entity
  on public.audit_logs (entity_type, entity_id);

create index if not exists idx_audit_created
  on public.audit_logs (created_at);

create table if not exists public.rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  count integer default 0,
  window_end timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.rate_limit_buckets enable row level security;

create index if not exists idx_rate_limit_key
  on public.rate_limit_buckets (key);

create index if not exists idx_rate_limit_window_end
  on public.rate_limit_buckets (window_end);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_type text not null,
  payload jsonb not null,
  signature text,
  verified boolean default false,
  processed boolean default false,
  processed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.webhook_events enable row level security;

create index if not exists idx_webhook_source
  on public.webhook_events (source);

create index if not exists idx_webhook_processed
  on public.webhook_events (processed);

create index if not exists idx_webhook_created
  on public.webhook_events (created_at);

create table if not exists public.revenue_analytics (
  id uuid primary key default gen_random_uuid(),
  period_date date not null,
  platform text,
  role_type text,
  client_category text,
  region text,
  gross_revenue numeric default 0,
  deals_closed integer default 0,
  proposals_sent integer default 0,
  close_rate numeric default 0,
  avg_response_ms bigint default 0,
  created_at timestamptz default now(),
  unique (period_date, platform, role_type, region)
);

alter table public.revenue_analytics enable row level security;

create index if not exists idx_revenue_period
  on public.revenue_analytics (period_date);

create index if not exists idx_revenue_platform
  on public.revenue_analytics (platform);

create index if not exists idx_revenue_role_type
  on public.revenue_analytics (role_type);

create index if not exists idx_revenue_region
  on public.revenue_analytics (region);

create table if not exists public.agent_activities (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  action text not null,
  outcome text,
  kpi_delta numeric default 0,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.agent_activities enable row level security;

create index if not exists idx_agent_name
  on public.agent_activities (agent_name);

create index if not exists idx_agent_action
  on public.agent_activities (action);

create index if not exists idx_agent_created
  on public.agent_activities (created_at);

create table if not exists public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  budget_verified boolean default false,
  trust_score numeric default 0,
  risk_score numeric default 0,
  qualification text default 'unqualified',
  disqualify_reason text,
  deposit_required boolean default false,
  flags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.lead_scores enable row level security;

create index if not exists idx_lead_scores_lead
  on public.lead_scores (lead_id);

create index if not exists idx_lead_qualification
  on public.lead_scores (qualification);

create table if not exists public.sla_records (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id),
  milestone text not null,
  due_date date not null,
  delivered_at timestamptz,
  status text default 'pending',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sla_records enable row level security;

create index if not exists idx_sla_deal
  on public.sla_records (deal_id);

create index if not exists idx_sla_status
  on public.sla_records (status);

create index if not exists idx_sla_due
  on public.sla_records (due_date);

create table if not exists public.outreach_templates (
  id uuid primary key default gen_random_uuid(),
  name text,
  subject text,
  body text,
  channel text,
  success_rate numeric default 0,
  usage_count integer default 0,
  reward_score numeric default 0,
  status text default 'active',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table if exists public.outreach_templates
  add column if not exists status text default 'active',
  add column if not exists updated_at timestamp default now();

create or replace function public.upsert_outreach_template_performance(
  p_template_id uuid,
  p_success_rate double precision
)
returns void
language plpgsql
as $$
begin
  update public.outreach_templates
  set
    success_rate = p_success_rate,
    usage_count = coalesce(usage_count, 0) + 1,
    updated_at = now()
  where id = p_template_id;
end;
$$;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid,
  referrer_user_id text,
  referred_email text,
  referred_client_id uuid,
  referral_code text,
  reward numeric default 0,
  reward_type text default 'free_month',
  reward_value double precision default 1,
  recurring_commission_rate double precision default 0.10,
  status text default 'pending',
  created_at timestamp default now(),
  converted_at timestamp
);

alter table if exists public.referrals
  add column if not exists referrer_user_id text,
  add column if not exists referred_client_id uuid,
  add column if not exists referral_code text,
  add column if not exists reward_type text default 'free_month',
  add column if not exists reward_value double precision default 1,
  add column if not exists recurring_commission_rate double precision default 0.10,
  add column if not exists status text default 'pending',
  add column if not exists converted_at timestamp;

create index if not exists idx_referrals_referrer_user
  on public.referrals(referrer_user_id);

create index if not exists idx_referrals_referred_email
  on public.referrals(referred_email);

create index if not exists idx_referrals_status
  on public.referrals(status);

create table if not exists public.viral_content_logs (
  id uuid primary key default gen_random_uuid(),
  client_id text,
  platform text,
  content text not null,
  metrics jsonb default '{}'::jsonb,
  posted_at timestamp,
  created_at timestamp default now()
);

create table if not exists public.case_studies (
  id uuid primary key default gen_random_uuid(),
  job_id text,
  title text,
  content text,
  views integer default 0,
  shares integer default 0,
  created_at timestamp default now()
);

alter table if exists public.case_studies
  add column if not exists job_id text,
  add column if not exists title text;

create index if not exists idx_viral_content_logs_client
  on public.viral_content_logs(client_id);

create index if not exists idx_viral_content_logs_platform
  on public.viral_content_logs(platform);

create index if not exists idx_case_studies_job_id
  on public.case_studies(job_id);

alter table if exists public.cold_email_sends
  add column if not exists template_id uuid;

do $$
begin
  if to_regclass('public.email_logs') is null
     and to_regclass('public.cold_email_sends') is not null then
    execute $view$
      create view public.email_logs as
      select
        id,
        account_id,
        lead_email,
        subject,
        message as body,
        status,
        template_id,
        sent_at
      from public.cold_email_sends
    $view$;
  end if;
end
$$;

alter table public.outreach_templates enable row level security;
alter table public.referrals enable row level security;
alter table public.viral_content_logs enable row level security;
alter table public.case_studies enable row level security;

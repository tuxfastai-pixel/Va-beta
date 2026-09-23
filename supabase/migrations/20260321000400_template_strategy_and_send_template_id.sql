alter table if exists public.cold_email_sends
  add column if not exists template_id uuid;

create table if not exists public.template_strategy (
  id uuid primary key default gen_random_uuid(),
  template_id uuid,
  status text default 'iterating',
  avg_open_rate numeric,
  avg_reply_rate numeric default 0,
  avg_close_rate numeric,
  updated_at timestamp default now(),
  last_updated timestamp default now()
);

alter table if exists public.template_strategy
  add column if not exists status text default 'iterating',
  add column if not exists updated_at timestamp default now();

create unique index if not exists idx_template_strategy_template_id
  on public.template_strategy(template_id)
  where template_id is not null;

do $$
begin
  if to_regclass('public.cold_email_sends') is not null then
    execute
      'create index if not exists idx_cold_email_sends_template_id
       on public.cold_email_sends(template_id)';
  end if;
end
$$;

alter table public.template_strategy enable row level security;

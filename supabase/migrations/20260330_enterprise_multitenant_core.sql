create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'starter',
  license_per_user_usd numeric not null default 10,
  created_at timestamp not null default now()
);

alter table if exists public.users
  add column if not exists company_id uuid references public.companies(id);

alter table if exists public.client_users
  add column if not exists company_id uuid references public.companies(id);

create index if not exists idx_client_users_company_id on public.client_users (company_id);
create index if not exists idx_users_company_id on public.users (company_id);

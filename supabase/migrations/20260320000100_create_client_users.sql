create table if not exists public.client_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password text not null,
  name text,
  role text default 'client',
  created_at timestamp default now()
);

create unique index if not exists idx_client_users_email_unique
  on public.client_users (email);
